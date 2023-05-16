import CircuitConfig from '../src/CircuitConfig.js'

const { SESSION_TREE_DEPTH } = new CircuitConfig()

export const ptauName = 'powersOfTau28_hez_final_18.ptau'

export const circuitContents = {
  register: `pragma circom 2.0.0; include "../circuits/register.circom"; \n\ncomponent main { public [ backup_tree_root ] } = Register(${SESSION_TREE_DEPTH});`,
  addToken: `pragma circom 2.0.0; include "../circuits/addToken.circom"; \n\ncomponent main { public [ share_count ] } = AddToken(${SESSION_TREE_DEPTH});`,
}
