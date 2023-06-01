pragma circom 2.0.0;

include "./circomlib/circuits/poseidon.circom";
include "./identityRoot.circom";
include "./incrementalMerkleTree.circom";
include "./secret.circom";

template AnonAuth(SESSION_TREE_DEPTH, IDENTITY_TREE_DEPTH) {
  signal input s0;

  signal input session_token;
  signal input session_token_x;

  signal input pubkey;

  signal input session_tree_leaf_index;
  signal input session_tree_siblings[SESSION_TREE_DEPTH];

  signal input identity_tree_leaf_index;
  signal input identity_tree_siblings[IDENTITY_TREE_DEPTH];
  // the target root to output
  signal input identity_tree_depth;

  signal output identity_tree_root;

  component secret_calc = Secret();
  secret_calc.s0 <== s0;
  secret_calc.y <== session_token;
  secret_calc.x <== session_token_x;

  component token_hasher = Poseidon(1);
  token_hasher.inputs[0] <== session_token;

  component session_tree_proof = MerkleTreeInclusionProof(SESSION_TREE_DEPTH);
  session_tree_proof.leaf <== token_hasher.out;
  session_tree_proof.leaf_index <== session_tree_leaf_index;
  for (var x = 0; x < SESSION_TREE_DEPTH; x++) {
    session_tree_proof.path_elements[x] <== session_tree_siblings[x];
  }

  component identity_root = IdentityRoot();
  identity_root.session_tree_root <== session_tree_proof.root;
  identity_root.secret <== secret_calc.out;
  identity_root.s0 <== s0;
  identity_root.pubkey <== pubkey;

  component identity_tree_proof = DynamicMerkleTreeInclusionProof(IDENTITY_TREE_DEPTH);
  identity_tree_proof.leaf <== identity_root.out;
  identity_tree_proof.leaf_index <== identity_tree_leaf_index;
  identity_tree_proof.depth <== identity_tree_depth;
  for (var x = 0; x < IDENTITY_TREE_DEPTH; x++) {
    identity_tree_proof.path_elements[x] <== identity_tree_siblings[x];
  }

  identity_tree_root <== identity_tree_proof.root;
}
