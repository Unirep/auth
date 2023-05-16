pragma circom 2.0.0;

include "./circomlib/circuits/poseidon.circom";

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
