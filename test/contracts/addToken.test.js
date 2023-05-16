const { ethers } = require('hardhat')
const assert = require('assert')
const randomf = require('randomf')
const prover = require('../../provers/default')
const RegisterProof = require('../../src/RegisterProof')
const AddTokenProof = require('../../src/AddTokenProof')
const { poseidon2 } = require('poseidon-lite/poseidon2')
const { poseidon1 } = require('poseidon-lite/poseidon1')
const { safemod, F } = require('../../src/math')
const { IncrementalMerkleTree } = require('@zk-kit/incremental-merkle-tree')
const CircuitConfig = require('../../src/CircuitConfig')

const { SESSION_TREE_DEPTH } = new CircuitConfig()

describe('addToken', function () {
  {
    let snapshot
    beforeEach(async () => {
      snapshot = await ethers.provider.send('evm_snapshot', [])
    })

    afterEach(() => ethers.provider.send('evm_revert', [snapshot]))
  }

  it('should register a new token', async () => {
    const { deploy } = await import('../../deploy/deploy.mjs')
    const accounts = await ethers.getSigners()
    const contract = await deploy(accounts[0])

    const s0 = randomf(F)
    const sessionToken = randomf(F)
    const secret = safemod(2n * s0 - sessionToken)

    // first register an identity
    {
      const { publicSignals, proof } = await prover.genProofAndPublicSignals(
        'register',
        {
          s0,
          session_token: sessionToken,
          backup_tree_root: randomf(F),
        }
      )
      const registerProof = new RegisterProof(publicSignals, proof, prover)
      assert.equal(await registerProof.verify(), true)
      await contract
        .connect(accounts[0])
        .register(registerProof.publicSignals, registerProof.proof)
        .then((t) => t.wait())
    }
    const pubkey = 1

    const shareCount = 3n
    const newToken = safemod(secret + (s0 - secret) * shareCount)

    const sessionTree = new IncrementalMerkleTree(
      poseidon2,
      SESSION_TREE_DEPTH,
      0n
    )
    sessionTree.insert(poseidon1([sessionToken]))
    const oldRoot = sessionTree.root
    sessionTree.insert(poseidon1([newToken]))
    const merkleProof = sessionTree.createProof(1)
    const { publicSignals, proof } = await prover.genProofAndPublicSignals(
      'addToken',
      {
        s0,
        secret,
        share_count: shareCount,
        session_token: newToken,
        pubkey,
        session_tree_indices: merkleProof.pathIndices,
        session_tree_siblings: merkleProof.siblings,
        old_session_tree_root: oldRoot,
      }
    )
    const addTokenProof = new AddTokenProof(publicSignals, proof, prover)
    assert.equal(await addTokenProof.verify(), true)
    await contract
      .connect(accounts[0])
      .addToken(addTokenProof.publicSignals, addTokenProof.proof)
      .then((t) => t.wait())
  })
})
