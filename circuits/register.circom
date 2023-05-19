pragma circom 2.0.0;

include "./circomlib/circuits/poseidon.circom";
include "./buildInitialTree.circom";
include "./secret.circom";

template Register(SESSION_TREE_DEPTH) {
  // s0 is the y point at x=1
  signal input s0;

  // session_token/session_token_x is a y/x point on the line
  signal input session_token;
  signal input session_token_x;

  // TODO: maybe build this in ZK?
  signal input backup_tree_root;
  signal backup_tree_root_square <== backup_tree_root *  backup_tree_root;

  signal output identity_hash;
  signal output token_hash;

  component secret_calc = Secret();
  secret_calc.s0 <== s0;
  secret_calc.y <== session_token;
  secret_calc.x <== session_token_x;
  signal secret <== secret_calc.out;

  component secret_hash = Poseidon(2);
  secret_hash.inputs[0] <== secret;
  secret_hash.inputs[1] <== s0;

  component token_hasher = Poseidon(1);
  token_hasher.inputs[0] <== session_token;

  token_hash <== token_hasher.out;

  component tree_builder = BuildInitialTree(SESSION_TREE_DEPTH);
  tree_builder.in <== token_hasher.out;

  component out_hash = Poseidon(2);
  out_hash.inputs[0] <== tree_builder.out;
  out_hash.inputs[1] <== secret_hash.out;

  identity_hash <== out_hash.out;
}
