pragma circom 2.0.0;

include "./circomlib/circuits/poseidon.circom";
include "./identityRoot.circom";
include "./incrementalMerkleTree.circom";
include "./secret.circom";

template RemoveToken(SESSION_TREE_DEPTH) {
  signal input s0;

  signal input session_token;
  signal input session_token_x;
  signal input pubkey;

  // for proving session_token membership
  signal input session_tree_leaf_index;
  signal input session_tree_siblings[SESSION_TREE_DEPTH];

  // the leaf to remove
  signal input session_leaf;

  signal input session_tree_change_leaf_index;
  signal input session_tree_change_siblings[SESSION_TREE_DEPTH];
  signal input old_session_tree_root;

  signal output old_identity_root;
  signal output identity_root;

  component secret_calc = Secret();
  secret_calc.s0 <== s0;
  secret_calc.y <== session_token;
  secret_calc.x <== session_token_x;

  signal secret <== secret_calc.out;

  // prove that session_token exists in the tree
  component auth_proof = MerkleTreeInclusionProof(SESSION_TREE_DEPTH);
  auth_proof.leaf <== Poseidon(1)([session_token]);
  auth_proof.leaf_index <== session_tree_leaf_index;
  for (var x = 0; x < SESSION_TREE_DEPTH; x++) {
    auth_proof.path_elements[x] <== session_tree_siblings[x];
  }
  auth_proof.root === old_session_tree_root;

  // prove that session_leaf exists where we expect it to
  component old_tree_proof = MerkleTreeInclusionProof(SESSION_TREE_DEPTH);
  old_tree_proof.leaf <== session_leaf;
  old_tree_proof.leaf_index <== session_tree_change_leaf_index;
  for (var x = 0; x < SESSION_TREE_DEPTH; x++) {
    old_tree_proof.path_elements[x] <== session_tree_change_siblings[x];
  }
  old_tree_proof.root === old_session_tree_root;

  component old_root = IdentityRoot();
  old_root.session_tree_root <== old_session_tree_root;
  old_root.secret <== secret;
  old_root.s0 <== s0;
  old_root.pubkey <== pubkey;

  old_identity_root <== old_root.out;

  // put a 0 where session_leaf was
  component new_tree_proof = MerkleTreeInclusionProof(SESSION_TREE_DEPTH);
  new_tree_proof.leaf <== 0;
  new_tree_proof.leaf_index <== session_tree_change_leaf_index;
  for (var x = 0; x < SESSION_TREE_DEPTH; x++) {
    new_tree_proof.path_elements[x] <== session_tree_change_siblings[x];
  }

  component new_root = IdentityRoot();
  new_root.session_tree_root <== new_tree_proof.root;
  new_root.secret <== secret;
  new_root.s0 <== s0;
  new_root.pubkey <== pubkey;

  identity_root <== new_root.out;
}
