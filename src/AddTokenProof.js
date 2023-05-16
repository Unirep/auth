const BaseProof = require('./BaseProof')

module.exports = class AddTokenProof extends BaseProof {
  constructor(publicSignals, proof, prover) {
    super(publicSignals, proof, prover)
    this.circuit = 'addToken'
    this.oldIdentityRoot = publicSignals[0]
    this.newIdentityRoot = publicSignals[1]
  }
}
