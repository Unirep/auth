const { ethers } = require('hardhat')
const { expect } = require('chai')
const assert = require('assert')
const randomf = require('randomf')
const prover = require('../../provers/default')
const RegisterProof = require('../../src/RegisterProof')
const { poseidon1, poseidon2 } = require('poseidon-lite')
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

    const identityTree = await id.sync.buildIdentityTree()
    const identityTreeRoot = await contract.identityTreeRoot()
    assert.equal(identityTree.root.toString(), identityTreeRoot.toString())
  })

  it('should register and then recover identity', async () => {
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

    const recoveryCode = await id.sync._db.findOne('RecoveryCode', {
      where: {
        pubkey: id.pubkey.toString(),
      },
    })
    const recoverProof = await id.recoveryProof({
      recoveryCode: recoveryCode.code,
    })
    const { publicSignals, proof } = recoverProof
    await contract
      .connect(accounts[0])
      .recoverIdentity(publicSignals, proof)
      .then((t) => t.wait())
    await id.sync.waitForSync()

    const nullifierCount = await id.sync._db.count('RecoveryNullifier', {
      hash: recoverProof.backupNullifier.toString(),
    })
    expect(nullifierCount).to.equal(1)
    const identity = await id.sync._db.findOne('Identity', {
      where: {
        pubkey: id.pubkey.toString(),
      },
    })
    expect(identity.s0).to.equal(recoverProof.s0.toString())

    const identityTree = await id.sync.buildIdentityTree()
    const identityTreeRoot = await contract.identityTreeRoot()
    assert.equal(identityTree.root.toString(), identityTreeRoot.toString())
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

  it('should register and add/remove tokens', async () => {
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

    // add a bunch of tokens
    const tokenHashes = []
    for (let x = 0; x < 4; x++) {
      const addProof = await id.addTokenProof()
      tokenHashes.push(addProof.tokenHash)
      const { publicSignals, proof } = addProof
      await contract
        .connect(accounts[0])
        .addToken(publicSignals, proof)
        .then((t) => t.wait())
      await id.sync.waitForSync()
    }

    // then remove them
    for (let x = 3; x >= 0; x--) {
      const { publicSignals, proof } = await id.removeTokenProof({
        tokenHash: tokenHashes[x],
      })
      await contract
        .connect(accounts[0])
        .removeToken(publicSignals, proof)
        .then((t) => t.wait())
      await id.sync.waitForSync()
    }

    // now create a new identity
    const id2 = new Identity({
      prover,
      address: contract.address,
      provider: ethers.provider,
      pubkey: id.pubkey,
    })
    await id2.sync.start()
    await id2.sync.waitForSync()

    // and add a new token
    {
      const secret = await id.loadSecret()
      const addProof = await id2.addTokenProof({ secret })
      await contract
        .connect(accounts[0])
        .addToken(addProof.publicSignals, addProof.proof)
        .then((t) => t.wait())
      await id2.sync.waitForSync()
    }

    // and remove the original token
    {
      const { publicSignals, proof } = await id2.removeTokenProof({
        tokenHash: poseidon1([id.token.y]),
      })
      await contract
        .connect(accounts[0])
        .removeToken(publicSignals, proof)
        .then((t) => t.wait())
    }
    await id2.sync.waitForSync()
    await id.sync.waitForSync()
    id2.sync.stop()
    id.sync.stop()

    const identityTree = await id.sync.buildIdentityTree()
    const identityTreeRoot = await contract.identityTreeRoot()
    assert.equal(identityTree.root.toString(), identityTreeRoot.toString())
  })
})
