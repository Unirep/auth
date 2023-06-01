pragma circom 2.0.0;

// Refer to:
// https://github.com/peppersec/tornado-mixer/blob/master/circuits/merkleTree.circom
// https://github.com/appliedzkp/semaphore/blob/master/circuits/circom/semaphore-base.circom

include "./circomlib/circuits/mux1.circom";
include "./circomlib/circuits/poseidon.circom";
include "./circomlib/circuits/comparators.circom";

template MerkleTree(HEIGHT) {
    assert(HEIGHT < 254);
    signal input leaf;
    signal input leaf_index;
    signal input path_elements[HEIGHT];
    signal output roots[HEIGHT];

    component hashers[HEIGHT];
    component mux[HEIGHT];

    signal path_index[HEIGHT];
    for (var i = 0; i < HEIGHT; i++) {
        path_index[i] <-- (leaf_index >> i) % 2;
        // Should be 0 or 1
        path_index[i] * (1 - path_index[i]) === 0;
    }

    for (var i = 0; i < HEIGHT; i++) {
        hashers[i] = Poseidon(2);
        mux[i] = MultiMux1(2);

        mux[i].c[0][1] <== path_elements[i];
        if (i == 0) {
            mux[i].c[0][0] <== leaf;
            mux[i].c[1][1] <== leaf;
        } else {
            mux[i].c[0][0] <== hashers[i-1].out;
            mux[i].c[1][1] <== hashers[i-1].out;
        }
        mux[i].c[1][0] <== path_elements[i];

        mux[i].s <== path_index[i];
        hashers[i].inputs[0]  <== mux[i].out[0];
        hashers[i].inputs[1]  <== mux[i].out[1];
        roots[i] <== hashers[i].out;
    }
}

template MerkleTreeInclusionProof(HEIGHT) {
    signal input leaf;
    signal input leaf_index;
    signal input path_elements[HEIGHT];

    signal output root;

    component tree = MerkleTree(HEIGHT);
    tree.leaf <== leaf;
    tree.leaf_index <== leaf_index;
    for (var i = 0; i < HEIGHT; i++) {
        tree.path_elements[i] <== path_elements[i];
    }
    root <== tree.roots[HEIGHT-1];
}

template DynamicMerkleTreeInclusionProof(HEIGHT) {
    signal input leaf;
    signal input leaf_index;
    signal input path_elements[HEIGHT];
    signal input depth;

    signal output root;

    component tree = MerkleTree(HEIGHT);
    tree.leaf <== leaf;
    tree.leaf_index <== leaf_index;
    for (var i = 0; i < HEIGHT; i++) {
        tree.path_elements[i] <== path_elements[i];
    }

    component depth_eq[HEIGHT];
    signal root_vals[HEIGHT];
    var root_sum = 0;

    for (var i = 0; i < HEIGHT; i++) {
        depth_eq[i] = IsEqual();
        depth_eq[i].in[0] <== depth - 1;
        depth_eq[i].in[1] <== i;
        root_vals[i] <== depth_eq[i].out * tree.roots[i];
        root_sum += root_vals[i];
    }
    root <== root_sum;
}
