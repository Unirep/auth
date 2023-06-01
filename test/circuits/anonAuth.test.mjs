import assert from 'assert'
import test from 'ava'
import randomf from 'randomf'
import prover from '../../provers/default.js'
import { poseidon1, poseidon2, poseidon3 } from 'poseidon-lite'
import { IncrementalMerkleTree } from '@zk-kit/incremental-merkle-tree'
import CircuitConfig from '../../src/CircuitConfig.js'
import { F, modinv, safemod, calcsecret } from '../../src/math.js'

const { SESSION_TREE_DEPTH, IDENTITY_TREE_DEPTH } = new CircuitConfig()

test('should generate an anonymous proof', async (t) => {
  const pubkey = randomf(F)
  const s0 = randomf(F)
  const token = randomf(F)
  const tokenX = randomf(F)

  const secret = calcsecret(s0, token, tokenX)

  const sessionTree = new IncrementalMerkleTree(
    poseidon2,
    SESSION_TREE_DEPTH,
    0n
  )
  const index = 5
  for (let x = 0; x < index; x++) {
    const e = randomf(F)
    sessionTree.insert(e)
  }
  sessionTree.insert(poseidon1([token]))
  const merkleProof = sessionTree.createProof(index)

  // test with a depth < IDENTITY_TREE_DEPTH
  const depth = 9
  const identityTreeIndex = 20
  const identityTree = new IncrementalMerkleTree(poseidon2, depth, 0n)
  for (let x = 0; x < identityTreeIndex; x++) {
    identityTree.insert(randomf(F))
  }
  const identityRoot = poseidon2([
    pubkey,
    poseidon2([sessionTree.root, poseidon2([secret, s0])]),
  ])
  identityTree.insert(identityRoot)
  const identityTreeProof = identityTree.createProof(identityTreeIndex)

  const { proof, publicSignals } = await prover.genProofAndPublicSignals(
    'anonAuth',
    {
      s0,
      session_token: token,
      session_token_x: tokenX,
      pubkey,
      session_tree_leaf_index: index,
      session_tree_siblings: merkleProof.siblings,
      identity_tree_leaf_index: identityTreeIndex,
      identity_tree_siblings: Array(IDENTITY_TREE_DEPTH)
        .fill()
        .map((_, i) => identityTreeProof.siblings[i] ?? 0),
      identity_tree_depth: depth,
    }
  )
  t.is(publicSignals[0].toString(), identityTree.root.toString())
})
