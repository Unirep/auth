import CircuitConfig from '../src/CircuitConfig.js'

const { SESSION_TREE_DEPTH, BACKUP_TREE_DEPTH } = new CircuitConfig()

export const ptauName = 'powersOfTau28_hez_final_18.ptau'

export const circuitContents = {
  register: `pragma circom 2.0.0; include "../circuits/register.circom"; \n\ncomponent main { public [ s0, backup_tree_root ] } = Register(${SESSION_TREE_DEPTH});`,
  addToken: `pragma circom 2.0.0; include "../circuits/addToken.circom"; \n\ncomponent main = AddToken(${SESSION_TREE_DEPTH});`,
  removeToken: `pragma circom 2.0.0; include "../circuits/removeToken.circom"; \n\ncomponent main { public [ session_leaf ] } = RemoveToken(${SESSION_TREE_DEPTH});`,
  recoverIdentity: `pragma circom 2.0.0; include "../circuits/recoverIdentity.circom"; \n\ncomponent main { public [ new_s0, pubkey ] } = RecoverIdentity(${SESSION_TREE_DEPTH}, ${BACKUP_TREE_DEPTH});`,
}
