const BaseProof = require('./BaseProof')

module.exports = class RemoveTokenProof extends BaseProof {
  constructor(publicSignals, proof, prover) {
    super(publicSignals, proof, prover)
    this.circuit = 'removeToken'
    this.oldIdentityRoot = publicSignals[0]
    this.newIdentityRoot = publicSignals[1]
    this.tokenHash = publicSignals[2] // the removed token hash
  }
}
