const { EventEmitter } = require('events')
const { ethers } = require('ethers')
const { IncrementalMerkleTree } = require('@zk-kit/incremental-merkle-tree')
const { poseidon2 } = require('poseidon-lite/poseidon2')
const ABI = require('../abi/Auth.json')
const schema = require('./schema')
const { nanoid } = require('nanoid')
// TODO: consolidate these into 'anondb' index
const { constructSchema } = require('anondb/types')
const { MemoryConnector } = require('anondb/web')
const AsyncLock = require('async-lock')

function toDecString(content) {
  return BigInt(content).toString()
}

module.exports = class Synchronizer extends EventEmitter {
  constructor(config) {
    super()
    const { db, address, provider, pubkey } = config

    this._db = db ?? new MemoryConnector(constructSchema(schema))
    this.contract = new ethers.Contract(address, ABI, provider)
    this.provider = provider
    this.settings = {
      sesionTreeDepth: 0,
      backupTreeDepth: 0,
    }
    this.pollRate = 4000
    this.blockRate = 100000
    this.lock = new AsyncLock()

    if (!pubkey) {
      throw new Error('No pubkey')
    }
    this.pubkey = pubkey

    const allEventNames = {}

    this._eventHandlers = Object.keys(this.contracts).reduce((acc, address) => {
      // build _eventHandlers and decodeData functions
      const { contract, eventNames } = this.contracts[address]
      const handlers = {}
      for (const name of eventNames) {
        if (allEventNames[name]) {
          throw new Error(`duplicate event name registered "${name}"`)
        }
        allEventNames[name] = true
        const topic = contract.filters[name]().topics[0]
        const handlerName = `handle${name}`
        if (typeof this[handlerName] !== 'function') {
          throw new Error(
            `No handler for event ${name} expected property "${handlerName}" to exist and be a function`
          )
        }
        // set this up here to avoid re-binding on every call
        const handler = this[`handle${name}`].bind(this)
        handlers[topic] = ({ event, ...args }) => {
          const { contract: _contract } = this.contracts[address]
          const decodedData = _contract.interface.decodeEventLog(
            name,
            event.data,
            event.topics
          )
          // call the handler with the event and decodedData
          return handler({ decodedData, event, ...args })
            .then((r) => {
              if (r) {
                this.emit(name, { decodedData, event })
              }
              return r
            })
            .catch((err) => {
              console.log(`${name} handler error`)
              throw err
            })
          // uncomment this to debug
          // console.log(name, decodedData)
        }
      }
      return {
        ...acc,
        ...handlers,
      }
    }, {})
    this._eventFilters = Object.keys(this.contracts).reduce((acc, address) => {
      const { contract, eventNames } = this.contracts[address]
      const filter = {
        address,
        topics: [
          // don't spread here, it should be a nested array
          eventNames.map((name) => contract.filters[name]().topics[0]),
        ],
      }
      return {
        ...acc,
        [address]: filter,
      }
    }, {})
    this.setup().then(() => (this.setupComplete = true))
  }

  async setup() {
    if (this.setupPromise) return this.setupPromise
    this.setupPromise = this._setup().catch((err) => {
      this.setupPromise = undefined
      this.setupComplete = false
      throw err
    })
    return this.setupPromise
  }

  async _setup() {
    if (this.setupComplete) return
    const config = await this.contract.config()
    this.settings.sessionTreeDepth = config.sessionTreeDepth
    this.settings.backupTreeDepth = config.backupTreeDepth

    await this._findStartBlock()
    this.setupComplete = true
  }

  async _findStartBlock() {
    const filter = this.contract.filters.Register()
    filter.topics?.push(`0x${''.padStart(64, '0')}`)
    const events = await this.contract.queryFilter(filter)
    if (events.length === 0) {
      throw new Error(`Synchronizer: failed to fetch genesis event`)
    }

    if (events.length > 1) {
      throw new Error(`Synchronizer: found multiple genesis events`)
    }
    const [event] = events
    const syncStartBlock = event.blockNumber - 1
    await this._db.upsert('SynchronizerState', {
      where: {
        pubkey: toDecString(this.pubkey),
      },
      create: {
        pubkey: toDecString(this.pubkey),
        latestCompleteBlock: syncStartBlock,
      },
      update: {},
    })
  }

  async buildSessionTree(pubkey = this.pubkey) {
    await this.setup()
    const leaves = await this._db.findMany('Token', {
      where: {
        pubkey: toDecString(pubkey),
      },
      orderBy: {
        index: 'asc',
      },
    })
    const tree = new IncrementalMerkleTree(
      poseidon2,
      this.settings.sessionTreeDepth,
      0n
    )
    for (const leaf of leaves) {
      tree.insert(leaf.hash)
    }
    return tree
  }

  /**
   * Start polling the blockchain for new events. If we're behind the HEAD
   * block we'll poll many times quickly
   */
  start() {
    const pollId = nanoid()
    this.pollId = pollId
    ;(async () => {
      await this.setup()
      if (this.pollId !== pollId) return
      const minBackoff = 128
      let backoff = minBackoff
      for (;;) {
        // poll repeatedly until we're up to date
        try {
          if (this.pollId !== pollId) return
          const { complete } = await this.poll()
          if (complete) break
          backoff = Math.max(backoff / 2, minBackoff)
        } catch (err) {
          backoff *= 2
          console.error(`--- poll failed`)
          console.error(err)
          console.error(`---`)
        }
        await new Promise((r) => setTimeout(r, backoff))
        if (pollId != this.pollId) break
      }
      for (;;) {
        await new Promise((r) => setTimeout(r, this.pollRate))
        if (pollId != this.pollId) break
        await this.poll().catch((err) => {
          console.error(`--- poll failed`)
          console.error(err)
          console.error(`---`)
        })
      }
    })()
  }

  /**
   * Stop synchronizing with contract.
   */
  stop() {
    this.pollId = null
  }

  // Poll for any new changes from the blockchain
  async poll() {
    return this.lock.acquire('poll', () => this._poll())
  }

  async _poll() {
    if (!this.setupComplete) {
      console.warn('Synchronizer: polled before setup, nooping')
      return { complete: false }
    }
    this.emit('pollStart')

    const state = await this._db.findOne('SynchronizerState', {
      where: {
        pubkey: toDecString(this.pubkey),
      },
      orderBy: {
        latestCompleteBlock: 'asc',
      },
    })
    const latestProcessed = state.latestCompleteBlock
    const latestBlock = await this.provider.getBlockNumber()
    const blockStart = latestProcessed + 1
    const blockEnd = Math.min(+latestBlock, blockStart + this.blockRate)
    if (blockStart > latestBlock) return { complete: true }

    const newEvents = await this.loadNewEvents(latestProcessed + 1, blockEnd)

    // filter out the events that have already been seen
    const unprocessedEvents = newEvents.filter((e) => {
      if (e.blockNumber === state.latestProcessedBlock) {
        if (e.transactionIndex === state.latestProcessedTransactionIndex) {
          return e.logIndex > state.latestProcessedEventIndex
        }
        return e.transactionIndex > state.latestProcessedTransactionIndex
      }
      return e.blockNumber > state.latestProcessedBlock
    })
    await this.processEvents(unprocessedEvents)
    await this._db.update('SynchronizerState', {
      where: {
        pubkey: toDecString(this.pubkey),
      },
      update: {
        latestCompleteBlock: blockEnd,
      },
    })
    this.emit('pollEnd')
    return {
      complete: latestBlock === blockEnd,
    }
  }

  // Overridden in subclasses
  async loadNewEvents(fromBlock, toBlock) {
    const promises = []
    for (const address of Object.keys(this.contracts)) {
      const { contract } = this.contracts[address]
      const filter = this._eventFilters[address]
      promises.push(contract.queryFilter(filter, fromBlock, toBlock))
    }
    return (await Promise.all(promises)).flat()
  }

  // override this and only this
  get contracts() {
    return {
      [this.contract.address]: {
        contract: this.contract,
        eventNames: ['Register', 'AddToken', 'RemoveToken', 'RecoverIdentity'],
      },
    }
  }

  async processEvents(events) {
    if (events.length === 0) return
    events.sort((a, b) => {
      if (a.blockNumber !== b.blockNumber) {
        return a.blockNumber - b.blockNumber
      }
      if (a.transactionIndex !== b.transactionIndex) {
        return a.transactionIndex - b.transactionIndex
      }
      return a.logIndex - b.logIndex
    })

    for (const event of events) {
      try {
        let success
        await this._db.transaction(async (db) => {
          const handler = this._eventHandlers[event.topics[0]]
          if (!handler) {
            throw new Error(
              `Synchronizer: Unrecognized event topic "${event.topics[0]}"`
            )
          }
          success = await handler({
            event,
            db,
          })
          db.update('SynchronizerState', {
            where: {
              pubkey: toDecString(this.pubkey),
            },
            update: {
              latestProcessedBlock: +event.blockNumber,
              latestProcessedTransactionIndex: +event.transactionIndex,
              latestProcessedEventIndex: +event.logIndex,
            },
          })
        })
        if (success) this.emit(event.topics[0], event)
        this.emit('processedEvent', event)
      } catch (err) {
        console.log(`Synchronizer: Error processing event:`, err)
        console.log(event)
        throw err
      }
    }
  }

  /**
   * Wait the synchronizer to process the events until the latest block.
   */
  async waitForSync(blockNumber) {
    const latestBlock = blockNumber ?? (await this.provider.getBlockNumber())
    for (;;) {
      const state = await this._db.findOne('SynchronizerState', {
        where: {
          pubkey: toDecString(this.pubkey),
        },
        orderBy: {
          latestCompleteBlock: 'asc',
        },
      })
      if (state && state.latestCompleteBlock >= latestBlock) return
      await new Promise((r) => setTimeout(r, 250))
    }
  }

  async handleRegister({ event, db, decodedData }) {
    const { pubkey, s0, tokenHash } = decodedData
    const count = await this._db.count('Token', {
      pubkey: toDecString(pubkey),
    })
    db.create('Token', {
      pubkey: toDecString(pubkey),
      hash: toDecString(tokenHash),
      index: count,
    })
    db.create('Identity', {
      s0: toDecString(s0),
      pubkey: toDecString(pubkey),
    })
  }

  async handleAddToken({ event, db, decodedData }) {
    const { pubkey, s0, tokenHash } = decodedData
    const count = await this._db.count('Token', {
      pubkey: toDecString(pubkey),
    })
    db.create('Token', {
      pubkey: toDecString(pubkey),
      hash: toDecString(tokenHash),
      index: count,
    })
  }

  async handleRemoveToken({ event, db, decodedData }) {
    const { pubkey, tokenHash } = decodedData
    db.update('Token', {
      where: {
        pubkey: toDecString(pubkey),
        hash: toDecString(tokenHash),
      },
      update: {
        hash: '0',
      },
    })
  }

  async handleRecoverIdentity({ event, db, decodedData }) {}
}
