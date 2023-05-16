import assert from 'assert'
import test from 'ava'
import randomf from 'randomf'
import prover from '../../provers/default.js'
import { poseidon1, poseidon2, poseidon3 } from 'poseidon-lite'
import { IncrementalMerkleTree } from '@zk-kit/incremental-merkle-tree'
import CircuitConfig from '../../src/CircuitConfig.js'
import { F } from '../../src/math.js'

const { SESSION_TREE_DEPTH, BACKUP_TREE_DEPTH } = new CircuitConfig()

test('should generate a recover identity proof', async (t) => {
  const backupTree = new IncrementalMerkleTree(poseidon2, BACKUP_TREE_DEPTH, 0n)
  const backupCodes = []
  for (let x = 0; x < 2 ** BACKUP_TREE_DEPTH; x++) {
    const code = randomf(F)
    backupCodes.push(code)
    backupTree.insert(code)
  }
  const pubkey = randomf(F)
  const secret = randomf(F)
  const a = randomf(F)
  const s0 = (1n * a + secret) % F
  const shareCount = 3n // the initial value
  const sessionToken = (2n * a + secret) % F

  const backupCodeIndex = 8
  const backupTreeProof = backupTree.createProof(backupCodeIndex)
  const backupCode = backupCodes[backupCodeIndex]
  const { proof, publicSignals } = await prover.genProofAndPublicSignals(
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

  const sessionTree = new IncrementalMerkleTree(
    poseidon2,
    SESSION_TREE_DEPTH,
    0n
  )
  sessionTree.insert(poseidon1([sessionToken]))

  const identityRoot = poseidon2([
    pubkey,
    poseidon2([sessionTree.root, poseidon3([secret, s0, shareCount])]),
  ])
  t.is(publicSignals[0], backupTree.root.toString()) // backup tree root
  t.is(publicSignals[1], identityRoot.toString()) // new identity root
  t.is(publicSignals[2], poseidon1([backupCode]).toString()) // recovery code nullifier
  t.is(publicSignals[3], poseidon1([sessionToken]).toString()) // new token hash
  t.is(publicSignals[4], pubkey.toString())
  t.is(publicSignals[5], s0.toString())
})
