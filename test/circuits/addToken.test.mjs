import assert from 'assert'
import test from 'ava'
import randomf from 'randomf'
import prover from '../../provers/default.js'
import { poseidon1, poseidon2, poseidon3 } from 'poseidon-lite'
import { IncrementalMerkleTree } from '@zk-kit/incremental-merkle-tree'
import CircuitConfig from '../../src/CircuitConfig.js'
import { F } from '../../src/math.js'

const { SESSION_TREE_DEPTH } = new CircuitConfig()

test('should generate an add token proof', async (t) => {
  const pubkey = randomf(F)
  const secret = randomf(F)
  const a = randomf(F)
  const s0 = (1n * a + secret) % F
  const shareCount = 12n
  const sessionToken = (shareCount * a + secret) % F
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
  oldSessionTree.insert(0)
  newSessionTree.insert(poseidon1([sessionToken]))
  const merkleProof = oldSessionTree.createProof(index)
  const { proof, publicSignals } = await prover.genProofAndPublicSignals(
    'addToken',
    {
      s0,
      secret,
      share_count: shareCount,
      session_token: sessionToken,
      pubkey,
      session_tree_indices: merkleProof.pathIndices,
      session_tree_siblings: merkleProof.siblings,
      old_session_tree_root: oldSessionTree.root,
    }
  )
  const oldIdentityRoot = poseidon2([
    pubkey,
    poseidon2([oldSessionTree.root, poseidon3([secret, s0, shareCount])]),
  ])
  const newIdentityRoot = poseidon2([
    pubkey,
    poseidon2([newSessionTree.root, poseidon3([secret, s0, shareCount + 1n])]),
  ])
  t.is(publicSignals[0], oldIdentityRoot.toString())
  t.is(publicSignals[1], newIdentityRoot.toString())
})
