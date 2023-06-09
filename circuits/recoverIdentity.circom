pragma circom 2.0.0;

include "./circomlib/circuits/poseidon.circom";
include "./identityRoot.circom";
include "./buildInitialTree.circom";
include "./incrementalMerkleTree.circom";
include "./secret.circom";

template RecoverIdentity(SESSION_TREE_DEPTH, BACKUP_TREE_DEPTH) {
  signal input backup_code;

  signal input backup_tree_leaf_index;
  signal input backup_tree_siblings[BACKUP_TREE_DEPTH];

  // must be a public signal to verify it isn't changed
  signal input pubkey;

  signal input new_s0;
  signal input new_session_token;
  signal input new_session_token_x;

  signal output backup_tree_root;
  signal output identity_root;
  signal output recovery_nullifier;
  signal output token_hash;

  component secret_calc = Secret();
  secret_calc.s0 <== new_s0;
  secret_calc.x <== new_session_token_x;
  secret_calc.y <== new_session_token;

  signal secret <== secret_calc.out;

  token_hash <== Poseidon(1)([new_session_token]);

  component session_tree = BuildInitialTree(SESSION_TREE_DEPTH);
  session_tree.in <== token_hash;

  component identity_root_hasher = IdentityRoot();
  identity_root_hasher.s0 <== new_s0;
  identity_root_hasher.secret <== secret;
  identity_root_hasher.session_tree_root <== session_tree.out;
  identity_root_hasher.pubkey <== pubkey;

  identity_root <== identity_root_hasher.out;

  recovery_nullifier <== Poseidon(1)([backup_code]);

  component backup_tree_proof = MerkleTreeInclusionProof(BACKUP_TREE_DEPTH);
  backup_tree_proof.leaf <== backup_code;
  backup_tree_proof.leaf_index <== backup_tree_leaf_index;
  for (var x = 0; x < BACKUP_TREE_DEPTH; x++) {
    backup_tree_proof.path_elements[x] <== backup_tree_siblings[x];
  }
  backup_tree_root <== backup_tree_proof.root;
}
