const { expect } = require('chai')
const { IncrementalMerkleTree } = require('@zk-kit/incremental-merkle-tree')
const { poseidon2 } = require('poseidon-lite')
const randomf = require('randomf')
const { encodeProof, decodeProof, F } = require('../../src/math')

describe('math', function () {
  it('should encode/decode merkle proofs', async () => {
    for (let x = 1; x < 32; x++) {
      const tree = new IncrementalMerkleTree(poseidon2, x, 0n)
      for (let y = 0; y < Math.min(50, 2 ** x - 1); y++) {
        tree.insert(randomf(F))
      }
      for (let y = 0; y < Math.min(50, 2 ** x - 1); y++) {
        const proof = tree.createProof(y)
        const _proof = decodeProof(encodeProof(proof, y))
        expect(_proof.leafIndex).to.equal(y)
        expect(_proof.siblings.length).to.equal(proof.siblings.length)
        for (let z = 0; z < _proof.siblings.length; z++) {
          expect(_proof.siblings[z][0]).to.equal(proof.siblings[z][0])
        }
        expect(_proof.leaf).to.equal(proof.leaf)
      }
    }
  })
})
