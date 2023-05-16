pragma circom 2.0.0;

include "./circomlib/circuits/poseidon.circom";

template IdentityRoot() {
  signal input session_tree_root;
  signal input secret;
  signal input s0;
  signal input share_count;
  signal input pubkey;

  signal output out;

  component secret_hasher = Poseidon(3);
  secret_hasher.inputs[0] <== secret;
  secret_hasher.inputs[1] <== s0;
  secret_hasher.inputs[2] <== share_count;

  component root_hasher = Poseidon(2);
  root_hasher.inputs[0] <== session_tree_root;
  root_hasher.inputs[1] <== secret_hasher.out;

  component final_hasher = Poseidon(2);
  final_hasher.inputs[0] <== pubkey;
  final_hasher.inputs[1] <== root_hasher.out;

  out <== final_hasher.out;
}
