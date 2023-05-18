const { ethers } = require('hardhat')
const { expect } = require('chai')
const assert = require('assert')
const randomf = require('randomf')
const prover = require('../../provers/default')
const RegisterProof = require('../../src/RegisterProof')
const AddTokenProof = require('../../src/AddTokenProof')
const RecoverIdentityProof = require('../../src/RecoverIdentityProof')
const { poseidon1, poseidon2 } = require('poseidon-lite')
const { safemod, F } = require('../../src/math')
const { IncrementalMerkleTree } = require('@zk-kit/incremental-merkle-tree')
const CircuitConfig = require('../../src/CircuitConfig')

const { SESSION_TREE_DEPTH, BACKUP_TREE_DEPTH } = new CircuitConfig()

describe('recoverIdentity', function () {
  {
    let snapshot
    beforeEach(async () => {
      snapshot = await ethers.provider.send('evm_snapshot', [])
    })

    afterEach(() => ethers.provider.send('evm_revert', [snapshot]))
  }

  it('should recover an identity using a backup code', async () => {
    const { deploy } = await import('../../deploy/deploy.mjs')
    const accounts = await ethers.getSigners()
    const contract = await deploy(accounts[0])

    const backupTree = new IncrementalMerkleTree(
      poseidon2,
      BACKUP_TREE_DEPTH,
      0n
    )
    const backupCodes = []
    for (let x = 0; x < 2 ** BACKUP_TREE_DEPTH; x++) {
      const code = randomf(F)
      backupCodes.push(code)
      backupTree.insert(code)
    }

    // first register an identity
    let pubkey
    {
      const s0 = randomf(F)
      const sessionToken = randomf(F)
      const secret = safemod(2n * s0 - sessionToken)
      const { publicSignals, proof } = await prover.genProofAndPublicSignals(
        'register',
        {
          s0,
          session_token: sessionToken,
          backup_tree_root: backupTree.root,
        }
      )
      const registerProof = new RegisterProof(publicSignals, proof, prover)
      pubkey = registerProof.pubkey
      assert.equal(await registerProof.verify(), true)
      await contract
        .connect(accounts[0])
        .register(registerProof.publicSignals, registerProof.proof)
        .then((t) => t.wait())
    }
    // now recover the identity with a new s0/token
    const s0 = randomf(F)
    const sessionToken = randomf(F)
    const secret = safemod(2n * s0 - sessionToken)

    const backupCodeIndex = 4
    const backupCode = backupCodes[backupCodeIndex]
    const backupTreeProof = backupTree.createProof(backupCodeIndex)

    const { publicSignals, proof } = await prover.genProofAndPublicSignals(
      'recoverIdentity',
      {
        new_s0: s0,
        new_session_token: sessionToken,
        backup_tree_indices: backupTreeProof.pathIndices,
        backup_tree_siblings: backupTreeProof.siblings,
        backup_code: backupCode,
        pubkey,
      }
    )
    const recoverProof = new RecoverIdentityProof(publicSignals, proof, prover)
    assert.equal(await recoverProof.verify(), true)
    const tx = await contract
      .connect(accounts[0])
      .recoverIdentity(recoverProof.publicSignals, recoverProof.proof)
    await expect(tx)
      .to.emit(contract, 'RecoverIdentity')
      .withArgs(pubkey, recoverProof.tokenHash, recoverProof.s0)

    const identity = await contract.identities(pubkey)
    assert.equal(identity.identityRoot, recoverProof.identityRoot)
    const nullifierUsed = await contract.backupCodeNullifiers(
      recoverProof.backupNullifier
    )
    assert.equal(nullifierUsed, true)
  })
})
