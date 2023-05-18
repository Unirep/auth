const { ethers } = require('hardhat')
const { expect } = require('chai')
const assert = require('assert')
const randomf = require('randomf')
const prover = require('../../provers/default')
const RegisterProof = require('../../src/RegisterProof')
const { poseidon2 } = require('poseidon-lite/poseidon2')
const { F } = require('../../src/math')
const Identity = require('../../src/Identity')

describe('Identity', function () {
  this.timeout(0)

  {
    let snapshot
    beforeEach(async () => {
      snapshot = await ethers.provider.send('evm_snapshot', [])
    })

    afterEach(() => ethers.provider.send('evm_revert', [snapshot]))
  }

  it('should register a new identity', async () => {
    const { deploy } = await import('../../deploy/deploy.mjs')
    const accounts = await ethers.getSigners()
    const contract = await deploy(accounts[0])

    const id = new Identity({
      prover,
      address: contract.address,
      provider: ethers.provider,
    })
    await id.sync.setup()

    const { publicSignals, proof } = await id.registerProof()
    await contract
      .connect(accounts[0])
      .register(publicSignals, proof)
      .then((t) => t.wait())
  })

  it('should register an identity and start sync', async () => {
    const { deploy } = await import('../../deploy/deploy.mjs')
    const accounts = await ethers.getSigners()
    const contract = await deploy(accounts[0])

    const id = new Identity({
      prover,
      address: contract.address,
      provider: ethers.provider,
    })
    await id.sync.start()

    {
      const registerProof = await id.registerProof()
      const { publicSignals, proof } = registerProof
      await contract
        .connect(accounts[0])
        .register(publicSignals, proof)
        .then((t) => t.wait())
    }

    await id.sync.waitForSync()

    {
      const { publicSignals, proof } = await id.addTokenProof()
      await contract
        .connect(accounts[0])
        .addToken(publicSignals, proof)
        .then((t) => t.wait())
    }

    await id.sync.waitForSync()
    const sessionTree = await id.sync.buildSessionTree()
    assert.equal(sessionTree.leaves.length, 2)
  })

  it('should initialize with no token', async () => {
    const { deploy } = await import('../../deploy/deploy.mjs')
    const accounts = await ethers.getSigners()
    const contract = await deploy(accounts[0])

    let pubkey
    let secret

    {
      const id = new Identity({
        prover,
        address: contract.address,
        provider: ethers.provider,
      })
      await id.sync.start()
      pubkey = id.pubkey
      const registerProof = await id.registerProof()
      const { publicSignals, proof } = registerProof
      await contract
        .connect(accounts[0])
        .register(publicSignals, proof)
        .then((t) => t.wait())
      await id.sync.waitForSync()
      secret = await id.loadSecret()
      id.sync.stop()
    }
    const id = new Identity({
      prover,
      address: contract.address,
      provider: ethers.provider,
      pubkey,
    })
    await id.sync.start()
    await id.sync.waitForSync()
    const { publicSignals, proof } = await id.addTokenProof({ secret })
    await contract
      .connect(accounts[0])
      .addToken(publicSignals, proof)
      .then((t) => t.wait())
    await id.sync.waitForSync()
    assert.equal(secret, await id.loadSecret())
    id.sync.stop()
  })

  it('should register and add many tokens', async () => {
    const { deploy } = await import('../../deploy/deploy.mjs')
    const accounts = await ethers.getSigners()
    const contract = await deploy(accounts[0])

    const id = new Identity({
      prover,
      address: contract.address,
      provider: ethers.provider,
    })
    await id.sync.start()

    {
      const registerProof = await id.registerProof()
      const { publicSignals, proof } = registerProof
      await contract
        .connect(accounts[0])
        .register(publicSignals, proof)
        .then((t) => t.wait())
    }

    await id.sync.waitForSync()
    for (let x = 0; x < 4; x++) {
      const { publicSignals, proof } = await id.addTokenProof()
      await contract
        .connect(accounts[0])
        .addToken(publicSignals, proof)
        .then((t) => t.wait())
      await id.sync.waitForSync()
    }
  })
})
