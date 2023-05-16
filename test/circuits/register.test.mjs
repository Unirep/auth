import assert from 'assert'
import test from 'ava'
import randomf from 'randomf'
import prover from '../../provers/default.js'
import { poseidon2 } from 'poseidon-lite/poseidon2.js'
import { IncrementalMerkleTree } from '@zk-kit/incremental-merkle-tree'
import CircuitConfig from '../../src/CircuitConfig.js'

const { SESSION_TREE_DEPTH } = new CircuitConfig()

const F = BigInt(
  '21888242871839275222246405745257275088548364400416034343698204186575808495617'
)

test('should generate a register proof', async (t) => {
  const secret = randomf(F)
  const a = randomf(F)
  const s0 = (1n * a + secret) % F
  const sessionToken = (2n * a + secret) % F
  const backupTreeRoot = randomf(F)
  const { proof, publicSignals } = await prover.genProofAndPublicSignals(
    'register',
    {
      s0,
      session_token: sessionToken,
      backup_tree_root: backupTreeRoot,
    }
  )
  const sessionTree = new IncrementalMerkleTree(
    poseidon2,
    SESSION_TREE_DEPTH,
    0n
  )
  sessionTree.insert(sessionToken)

  const identityHash = poseidon2([sessionTree.root, poseidon2([s0, secret])])
  t.is(publicSignals[1], backupTreeRoot.toString())
  t.is(publicSignals[0], identityHash.toString())
})
