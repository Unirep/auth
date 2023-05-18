const { ethers } = require('hardhat')
const { expect } = require('chai')
const assert = require('assert')
const randomf = require('randomf')
const prover = require('../../provers/default')
const RegisterProof = require('../../src/RegisterProof')
const { poseidon2 } = require('poseidon-lite/poseidon2')
const { F } = require('../../src/math')

describe('register', function () {
  {
    let snapshot
    beforeEach(async () => {
      snapshot = await ethers.provider.send('evm_snapshot', [])
    })

    afterEach(() => ethers.provider.send('evm_revert', [snapshot]))
  }

  it('should deploy auth contract', async () => {
    const { deploy } = await import('../../deploy/deploy.mjs')
    const accounts = await ethers.getSigners()
    await deploy(accounts[0])
  })

  it('should register a new identity', async () => {
    const { deploy } = await import('../../deploy/deploy.mjs')
    const accounts = await ethers.getSigners()
    const contract = await deploy(accounts[0])

    const { publicSignals, proof } = await prover.genProofAndPublicSignals(
      'register',
      {
        s0: randomf(F),
        session_token: randomf(F),
        backup_tree_root: randomf(F),
      }
    )
    const registerProof = new RegisterProof(publicSignals, proof, prover)
    assert.equal(await registerProof.verify(), true)
    const tx = await contract
      .connect(accounts[0])
      .register(registerProof.publicSignals, registerProof.proof)

    const expectedPubkey = registerProof.pubkey
    await expect(tx)
      .to.emit(contract, 'Register')
      .withArgs(expectedPubkey, registerProof.tokenHash, registerProof.s0)

    const identity = await contract.identities(expectedPubkey)
    assert.equal(identity.pubkey, expectedPubkey)
    assert.equal(
      identity.backupTreeRoot.toString(),
      registerProof.backupTreeRoot
    )
    const expectedIdentityRoot = poseidon2([
      expectedPubkey,
      registerProof.identityHash,
    ])
    assert.equal(identity.identityRoot.toString(), expectedIdentityRoot)
  })
})
