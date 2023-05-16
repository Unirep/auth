pragma circom 2.0.0;

include "./circomlib/circuits/poseidon.circom";

template Register(SESSION_TREE_DEPTH) {
  // s0 is the y point at x=1
  signal input s0;

  // sessionToken is the y point at x=2
  // the first token on the line
  signal input session_token;

  // TODO: maybe build this in ZK?
  signal input backup_tree_root;
  signal backup_tree_root_square <== backup_tree_root *  backup_tree_root;

  signal output identity_hash;

  // calculate the b value of y = ax + b where s0
  // when sessionToken is x=2 we can always calculate b
  // as b = s0 - ax
  // where x = 1 and a = sessionToken - s0
  // reduced to b = s0 - (sessionToken - s0)
  // b = 2*s0 - sessionToken
  signal secret <== 2*s0 - session_token;

  component secret_hash = Poseidon(3);
  secret_hash.inputs[0] <== secret;
  secret_hash.inputs[1] <== s0;
  secret_hash.inputs[2] <== 3; // initialize the share count to 3 so future shares are calculated appropriately

  component token_hasher = Poseidon(1);
  token_hasher.inputs[0] <== session_token;

  component tree_builder = BuildInitialTree(SESSION_TREE_DEPTH);
  tree_builder.in <== token_hasher.out;

  component out_hash = Poseidon(2);
  out_hash.inputs[0] <== tree_builder.out;
  out_hash.inputs[1] <== secret_hash.out;

  identity_hash <== out_hash.out;
}

template BuildInitialTree(DEPTH) {
  signal input in;
  signal output out;

  component hashers[DEPTH];
  component zero_hashers[DEPTH];

  for (var x = 0; x < DEPTH; x++) {
    hashers[x] = Poseidon(2);
    if (x == 0) {
      hashers[x].inputs[0] <== in;
    } else {
      hashers[x].inputs[0] <== hashers[x-1].out;
    }
    if (x == 0) {
      hashers[x].inputs[1] <== 0;
    } else if (x == 1) {
      zero_hashers[0] = Poseidon(2);
      zero_hashers[0].inputs[0] <== 0;
      zero_hashers[0].inputs[1] <== 0;
      hashers[x].inputs[1] <== zero_hashers[0].out;
    } else {
      zero_hashers[x-1] = Poseidon(2);
      zero_hashers[x-1].inputs[0] <== zero_hashers[x-2].out;
      zero_hashers[x-1].inputs[1] <== zero_hashers[x-2].out;
      hashers[x].inputs[1] <== zero_hashers[x-1].out;
    }
  }
  out <== hashers[DEPTH-1].out;
}
