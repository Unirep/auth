/**
 * Format snark proof for verifier smart contract
 * @param proof The proof of `SnarkProof` type
 * @returns An one dimensional array of stringified proof data
 */
const formatProofForVerifierContract = (proof) => {
  return [
    proof.pi_a[0],
    proof.pi_a[1],
    proof.pi_b[0][1],
    proof.pi_b[0][0],
    proof.pi_b[1][1],
    proof.pi_b[1][0],
    proof.pi_c[0],
    proof.pi_c[1],
  ].map((x) => x.toString())
}

/**
 * Format an one dimensional array for `snarkjs` verification
 * @param proof The string array of the proof
 * @returns The `SnarkProof` type proof data
 */
const formatProofForSnarkjsVerification = (proof) => {
  return {
    pi_a: [BigInt(proof[0]), BigInt(proof[1]), BigInt('1')],
    pi_b: [
      [BigInt(proof[3]), BigInt(proof[2])],
      [BigInt(proof[5]), BigInt(proof[4])],
      [BigInt('1'), BigInt('0')],
    ],
    pi_c: [BigInt(proof[6]), BigInt(proof[7]), BigInt('1')],
  }
}

/**
 * The basic proof structure that is used in unirep protocol
 */
module.exports = class BaseProof {
  /**
   * @param publicSignals The public signals of the proof that can be verified by the prover
   * @param proof The proof that can be verified by the prover
   * @param prover The prover that can verify the public signals and the proof
   */
  constructor(publicSignals, proof, prover) {
    if (Array.isArray(proof)) {
      // assume it's formatted for verifier contract
      this.proof = proof.map((v) => BigInt(v))
      this._snarkProof = formatProofForSnarkjsVerification(
        proof.map((p) => p.toString())
      )
    } else if (typeof proof === 'object') {
      // assume it's a SnarkProof
      const formattedProof = formatProofForVerifierContract(proof)
      this._snarkProof = proof
      this.proof = formattedProof
    } else {
      throw new Error('Invalid proof supplied')
    }
    this.publicSignals = publicSignals.map((v) => BigInt(v))
    this.prover = prover
  }

  /**
   * Call the `verifyProof` function in the prover that verifies the proof.
   * @returns True if the proof is valid, false otherwise
   */
  async verify() {
    if (!this.prover) {
      throw new Error('No prover set')
    }
    if (!this.circuit) {
      throw new Error('No circuit specified')
    }
    return this.prover.verifyProof(
      this.circuit,
      this.publicSignals.map((n) => BigInt(n.toString())),
      this._snarkProof
    )
  }
}
