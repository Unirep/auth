const BaseProof = require('./BaseProof')

module.exports = class RegisterProof extends BaseProof {
  constructor(publicSignals, proof, prover) {
    super(publicSignals, proof, prover)
    this.circuit = 'register'
    this.identityHash = publicSignals[0]
    this.backupTreeRoot = publicSignals[1]
  }
}
