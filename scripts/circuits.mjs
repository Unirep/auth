const SESSION_TREE_DEPTH = 5

export const ptauName = 'powersOfTau28_hez_final_18.ptau'

export const circuitContents = {
  register: `pragma circom 2.0.0; include "../circuits/register.circom"; \n\ncomponent main { public [ backup_tree_root ] } = Register(${SESSION_TREE_DEPTH});`,
}
