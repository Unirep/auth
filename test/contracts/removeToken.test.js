const { ethers } = require('hardhat')
const { expect } = require('chai')
const assert = require('assert')
const randomf = require('randomf')
const prover = require('../../provers/default')
const RegisterProof = require('../../src/RegisterProof')
const AddTokenProof = require('../../src/AddTokenProof')
const RemoveTokenProof = require('../../src/RemoveTokenProof')
const { poseidon2 } = require('poseidon-lite/poseidon2')
const { poseidon1 } = require('poseidon-lite/poseidon1')
const { calcsecret, safemod, F } = require('../../src/math')
const { IncrementalMerkleTree } = require('@zk-kit/incremental-merkle-tree')
const CircuitConfig = require('../../src/CircuitConfig')

const { SESSION_TREE_DEPTH } = new CircuitConfig()

describe('removeToken', function () {
  {
    let snapshot
    beforeEach(async () => {
      snapshot = await ethers.provider.send('evm_snapshot', [])
    })

    afterEach(() => ethers.provider.send('evm_revert', [snapshot]))
  }

  it('should remove an auth token', async () => {
    const { deploy } = await import('../../deploy/deploy.mjs')
    const accounts = await ethers.getSigners()
    const contract = await deploy(accounts[0])

    const s0 = randomf(F)
    // the initial session token
    const sessionToken = randomf(F)
    const sessionTokenX = randomf(F)
    const secret = calcsecret(s0, sessionToken, sessionTokenX)

    // first register an identity
    let pubkey
    {
      const { publicSignals, proof } = await prover.genProofAndPublicSignals(
        'register',
        {
          s0,
          session_token: sessionToken,
          session_token_x: sessionTokenX,
          backup_tree_root: randomf(F),
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

    // then add a token
    const a = safemod(s0 - secret)
    const newTokenX = randomf(F)
    const newToken = safemod(newTokenX * a + secret)

    const sessionTree = new IncrementalMerkleTree(
      poseidon2,
      SESSION_TREE_DEPTH,
      0n
    )
    sessionTree.insert(poseidon1([sessionToken]))
    const oldRoot = sessionTree.root
    sessionTree.insert(poseidon1([newToken]))
    {
      const merkleProof = sessionTree.createProof(1)
      const { publicSignals, proof } = await prover.genProofAndPublicSignals(
        'addToken',
        {
          s0,
          session_token: newToken,
          session_token_x: newTokenX,
          pubkey,
          session_tree_leaf_index: 1,
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
    }

    // then remove the initial token

    const authMerkleProof = sessionTree.createProof(1)
    const removeMerkleProof = sessionTree.createProof(0)
    const { publicSignals, proof } = await prover.genProofAndPublicSignals(
      'removeToken',
      {
        s0,
        session_token: newToken,
        session_token_x: newTokenX,
        pubkey,
        session_tree_leaf_index: 1,
        session_tree_siblings: authMerkleProof.siblings,
        old_session_tree_root: sessionTree.root,
        session_tree_change_leaf_index: 0,
        session_tree_change_siblings: removeMerkleProof.siblings,
        session_leaf: poseidon1([sessionToken]),
      }
    )
    const removeTokenProof = new RemoveTokenProof(publicSignals, proof, prover)
    assert.equal(await removeTokenProof.verify(), true)
    const tx = await contract
      .connect(accounts[0])
      .removeToken(removeTokenProof.publicSignals, removeTokenProof.proof)
    await expect(tx)
      .to.emit(contract, 'RemoveToken')
      .withArgs(pubkey, removeTokenProof.tokenHash)

    const identity = await contract.identities(pubkey)
    assert.equal(identity.identityRoot, removeTokenProof.newIdentityRoot)
  })
})
