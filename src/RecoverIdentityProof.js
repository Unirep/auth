const BaseProof = require('./BaseProof')

module.exports = class RecoverIdentityProof extends BaseProof {
  constructor(publicSignals, proof, prover) {
    super(publicSignals, proof, prover)
    this.circuit = 'recoverIdentity'
    this.backupTreeRoot = publicSignals[0]
    this.identityRoot = publicSignals[1]
    this.backupNullifier = publicSignals[2]
    this.pubkey = publicSignals[3]
  }
}
