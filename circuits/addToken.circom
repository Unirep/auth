pragma circom 2.0.0;

include "./circomlib/circuits/poseidon.circom";
include "./identityRoot.circom";
include "./incrementalMerkleTree.circom";
include "./secret.circom";

template AddToken(SESSION_TREE_DEPTH) {
  signal input s0;

  signal input session_token;
  signal input session_token_x;

  signal input pubkey;

  signal input session_tree_indices[SESSION_TREE_DEPTH];
  signal input session_tree_siblings[SESSION_TREE_DEPTH];
  signal input old_session_tree_root;

  signal output old_identity_root;
  signal output identity_root;
  signal output token_hash;

  component secret_calc = Secret();
  secret_calc.s0 <== s0;
  secret_calc.y <== session_token;
  secret_calc.x <== session_token_x;

  signal secret <== secret_calc.out;

  // then check that 0 is in at the current merkle path
  component old_tree_proof = MerkleTreeInclusionProof(SESSION_TREE_DEPTH);
  old_tree_proof.leaf <== 0;
  for (var x = 0; x < SESSION_TREE_DEPTH; x++) {
    old_tree_proof.path_index[x] <== session_tree_indices[x];
    old_tree_proof.path_elements[x] <== session_tree_siblings[x];
  }
  old_tree_proof.root === old_session_tree_root;

  component old_root = IdentityRoot();
  old_root.session_tree_root <== old_session_tree_root;
  old_root.secret <== secret;
  old_root.s0 <== s0;
  old_root.pubkey <== pubkey;

  old_identity_root <== old_root.out;

  component token_hasher = Poseidon(1);
  token_hasher.inputs[0] <== session_token;

  token_hash <== token_hasher.out;

  // then calculate the new session tree root and identity root
  component new_tree_proof = MerkleTreeInclusionProof(SESSION_TREE_DEPTH);
  new_tree_proof.leaf <== token_hasher.out;
  for (var x = 0; x < SESSION_TREE_DEPTH; x++) {
    new_tree_proof.path_index[x] <== session_tree_indices[x];
    new_tree_proof.path_elements[x] <== session_tree_siblings[x];
  }

  component new_root = IdentityRoot();
  new_root.session_tree_root <== new_tree_proof.root;
  new_root.secret <== secret;
  new_root.s0 <== s0;
  new_root.pubkey <== pubkey;

  identity_root <== new_root.out;
}

