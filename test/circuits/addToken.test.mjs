import assert from 'assert'
import test from 'ava'
import randomf from 'randomf'
import prover from '../../provers/default.js'
import { poseidon1, poseidon2, poseidon3 } from 'poseidon-lite'
import { IncrementalMerkleTree } from '@zk-kit/incremental-merkle-tree'
import CircuitConfig from '../../src/CircuitConfig.js'
import { F, modinv, safemod, calcsecret } from '../../src/math.js'

const { SESSION_TREE_DEPTH } = new CircuitConfig()

test('should generate an add token proof', async (t) => {
  const pubkey = randomf(F)
  const s0 = randomf(F)
  const token = randomf(F)
  const tokenX = randomf(F)

  const secret = calcsecret(s0, token, tokenX)

  const oldSessionTree = new IncrementalMerkleTree(
    poseidon2,
    SESSION_TREE_DEPTH,
    0n
  )
  const newSessionTree = new IncrementalMerkleTree(
    poseidon2,
    SESSION_TREE_DEPTH,
    0n
  )
  const index = 5
  for (let x = 0; x < index; x++) {
    const e = randomf(F)
    oldSessionTree.insert(e)
    newSessionTree.insert(e)
  }
  oldSessionTree.insert(0n)
  newSessionTree.insert(poseidon1([token]))
  const merkleProof = oldSessionTree.createProof(index)
  const { proof, publicSignals } = await prover.genProofAndPublicSignals(
    'addToken',
    {
      s0,
      session_token: token,
      session_token_x: tokenX,
      pubkey,
      session_tree_leaf_index: index,
      session_tree_siblings: merkleProof.siblings,
      old_session_tree_root: oldSessionTree.root,
    }
  )
  const oldIdentityRoot = poseidon2([
    pubkey,
    poseidon2([oldSessionTree.root, poseidon2([secret, s0])]),
  ])
  const newIdentityRoot = poseidon2([
    pubkey,
    poseidon2([newSessionTree.root, poseidon2([secret, s0])]),
  ])
  t.is(publicSignals[0], oldIdentityRoot.toString())
  t.is(publicSignals[1], newIdentityRoot.toString())
  t.is(publicSignals[2], poseidon1([token]).toString())
})
