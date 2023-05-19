import assert from 'assert'
import test from 'ava'
import randomf from 'randomf'
import prover from '../../provers/default.js'
import { poseidon1 } from 'poseidon-lite/poseidon1.js'
import { poseidon2 } from 'poseidon-lite/poseidon2.js'
import { poseidon3 } from 'poseidon-lite/poseidon3.js'
import { IncrementalMerkleTree } from '@zk-kit/incremental-merkle-tree'
import CircuitConfig from '../../src/CircuitConfig.js'
import { F, calcsecret } from '../../src/math.js'

const { SESSION_TREE_DEPTH } = new CircuitConfig()

test('should generate a register proof', async (t) => {
  const s0 = randomf(F)
  const sessionToken = randomf(F)
  const sessionTokenX = randomf(F)
  const secret = calcsecret(s0, sessionToken, sessionTokenX)

  const backupTreeRoot = randomf(F)
  const { proof, publicSignals } = await prover.genProofAndPublicSignals(
    'register',
    {
      s0,
      session_token: sessionToken,
      session_token_x: sessionTokenX,
      backup_tree_root: backupTreeRoot,
    }
  )
  const sessionTree = new IncrementalMerkleTree(
    poseidon2,
    SESSION_TREE_DEPTH,
    0n
  )
  sessionTree.insert(poseidon1([sessionToken]))

  const identityHash = poseidon2([sessionTree.root, poseidon2([secret, s0])])
  t.is(publicSignals[0], identityHash.toString())
  t.is(publicSignals[1], poseidon1([sessionToken]).toString())
  t.is(publicSignals[2], s0.toString())
  t.is(publicSignals[3], backupTreeRoot.toString())
})
