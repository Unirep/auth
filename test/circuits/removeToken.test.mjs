import assert from 'assert'
import test from 'ava'
import randomf from 'randomf'
import prover from '../../provers/default.js'
import { poseidon1 } from 'poseidon-lite/poseidon1.js'
import { poseidon2 } from 'poseidon-lite/poseidon2.js'
import { poseidon3 } from 'poseidon-lite/poseidon3.js'
import { IncrementalMerkleTree } from '@zk-kit/incremental-merkle-tree'
import CircuitConfig from '../../src/CircuitConfig.js'
import { F, safemod, modinv, calcsecret } from '../../src/math.js'

const { SESSION_TREE_DEPTH } = new CircuitConfig()

test('should generate a remove token proof', async (t) => {
  const pubkey = randomf(F)
  const s0 = randomf(F)
  const sessionToken = randomf(F)
  const sessionTokenX = randomf(F)

  const secret = calcsecret(s0, sessionToken, sessionTokenX)
  const a = safemod(s0 - secret)

  const sessionTree = new IncrementalMerkleTree(
    poseidon2,
    SESSION_TREE_DEPTH,
    0n
  )
  const tokens = []
  for (let x = 0; x < 2 ** SESSION_TREE_DEPTH; x++) {
    const tokenX = randomf(F)
    const token = safemod(a * tokenX + secret)
    tokens.push({ token, tokenX })
    const leaf = poseidon1([token])
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
      session_token: tokens[authLeafIndex].token,
      session_token_x: tokens[authLeafIndex].tokenX,
      pubkey,
      session_tree_leaf_index: authLeafIndex,
      session_tree_siblings: authMerkleProof.siblings,
      old_session_tree_root: sessionTree.root,
      session_tree_change_leaf_index: removeIndex,
      session_tree_change_siblings: removeMerkleProof.siblings,
      session_leaf: poseidon1([tokens[removeIndex].token]),
    }
  )

  const oldIdentityRoot = poseidon2([
    pubkey,
    poseidon2([sessionTree.root, poseidon2([secret, s0])]),
  ])
  sessionTree.update(removeIndex, 0n)
  const newIdentityRoot = poseidon2([
    pubkey,
    poseidon2([sessionTree.root, poseidon2([secret, s0])]),
  ])
  t.is(publicSignals[0], oldIdentityRoot.toString())
  t.is(publicSignals[1], newIdentityRoot.toString())
  t.is(publicSignals[2], poseidon1([tokens[removeIndex].token]).toString())
  t.is(await prover.verifyProof('removeToken', publicSignals, proof), true)
})
