import assert from 'assert'
import test from 'ava'
import randomf from 'randomf'
import prover from '../../provers/default.js'
import { poseidon1 } from 'poseidon-lite/poseidon1.js'
import { poseidon2 } from 'poseidon-lite/poseidon2.js'
import { poseidon3 } from 'poseidon-lite/poseidon3.js'
import { IncrementalMerkleTree } from '@zk-kit/incremental-merkle-tree'
import CircuitConfig from '../../src/CircuitConfig.js'
import { F } from '../../src/math.js'

const { SESSION_TREE_DEPTH } = new CircuitConfig()

test('should generate a remove token proof', async (t) => {
  const pubkey = randomf(F)
  const secret = randomf(F)
  const a = randomf(F)
  const s0 = (1n * a + secret) % F
  const shareCount = 12n
  const sessionToken = (shareCount * a + secret) % F
  const sessionTree = new IncrementalMerkleTree(
    poseidon2,
    SESSION_TREE_DEPTH,
    0n
  )
  const tokens = []
  for (let x = 0; x < Number(shareCount); x++) {
    const e = randomf(F)
    const leaf = poseidon1([e])
    tokens.push(e)
    sessionTree.insert(leaf)
  }

  // insert a bunch of tokens, then remove one
  const authLeafIndex = 1
  const authMerkleProof = sessionTree.createProof(authLeafIndex)
  const removeIndex = 10
  const removeMerkleProof = sessionTree.createProof(removeIndex)
  const { proof, publicSignals } = await prover.genProofAndPublicSignals(
    'removeToken',
    {
      s0,
      secret,
      share_count: shareCount,
      session_token: tokens[authLeafIndex],
      pubkey,
      session_tree_indices: authMerkleProof.pathIndices,
      session_tree_siblings: authMerkleProof.siblings,
      old_session_tree_root: sessionTree.root,
      session_tree_change_indices: removeMerkleProof.pathIndices,
      session_tree_change_siblings: removeMerkleProof.siblings,
      session_leaf: poseidon1([tokens[removeIndex]]),
    }
  )

  const oldIdentityRoot = poseidon2([
    pubkey,
    poseidon2([sessionTree.root, poseidon3([secret, s0, shareCount])]),
  ])
  sessionTree.update(removeIndex, 0n)
  const newIdentityRoot = poseidon2([
    pubkey,
    poseidon2([sessionTree.root, poseidon3([secret, s0, shareCount])]),
  ])
  t.is(publicSignals[0], oldIdentityRoot.toString())
  t.is(publicSignals[1], newIdentityRoot.toString())
})
