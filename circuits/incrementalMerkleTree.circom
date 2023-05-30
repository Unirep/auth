pragma circom 2.0.0;

// Refer to:
// https://github.com/peppersec/tornado-mixer/blob/master/circuits/merkleTree.circom
// https://github.com/appliedzkp/semaphore/blob/master/circuits/circom/semaphore-base.circom

include "./circomlib/circuits/mux1.circom";
include "./circomlib/circuits/poseidon.circom";
include "./circomlib/circuits/comparators.circom";

template MerkleTreeInclusionProof(n_levels) {
    assert(n_levels < 254);
    signal input leaf;
    signal input path_index[n_levels];
    signal input path_elements[n_levels];
    signal output root;

    component hashers[n_levels];
    component mux[n_levels];

    signal levelHashes[n_levels + 1];
    levelHashes[0] <== leaf;

    for (var i = 0; i < n_levels; i++) {
        // Should be 0 or 1
        path_index[i] * (1 - path_index[i]) === 0;

        hashers[i] = Poseidon(2);
        mux[i] = MultiMux1(2);

        mux[i].c[0][0] <== levelHashes[i];
        mux[i].c[0][1] <== path_elements[i];

        mux[i].c[1][0] <== path_elements[i];
        mux[i].c[1][1] <== levelHashes[i];

        mux[i].s <== path_index[i];
        hashers[i].inputs[0]  <== mux[i].out[0];
        hashers[i].inputs[1]  <== mux[i].out[1];

        levelHashes[i + 1] <== hashers[i].out;
    }

    root <== levelHashes[n_levels];
}

template DynamicMerkleTreeInclusionProof(n_levels) {
    assert(n_levels < 254);
    signal input leaf;
    signal input depth;
    signal input path_index[n_levels];
    signal input path_elements[n_levels];
    signal output root;

    component hashers[n_levels];
    component mux[n_levels];

    signal levelHashes[n_levels + 1];
    levelHashes[0] <== leaf;

    component depth_eq[n_levels];
    signal root_vals[n_levels];
    var root_sum = 0;

    for (var i = 0; i < n_levels; i++) {
        // Should be 0 or 1
        path_index[i] * (1 - path_index[i]) === 0;

        hashers[i] = Poseidon(2);
        mux[i] = MultiMux1(2);

        mux[i].c[0][0] <== levelHashes[i];
        mux[i].c[0][1] <== path_elements[i];

        mux[i].c[1][0] <== path_elements[i];
        mux[i].c[1][1] <== levelHashes[i];

        mux[i].s <== path_index[i];
        hashers[i].inputs[0]  <== mux[i].out[0];
        hashers[i].inputs[1]  <== mux[i].out[1];

        levelHashes[i + 1] <== hashers[i].out;

        depth_eq[i] = IsEqual();
        depth_eq[i].in[0] <== depth;
        depth_eq[i].in[1] <== i + 1;
        root_vals[i] <== depth_eq[i].out * levelHashes[i+1];
        root_sum += root_vals[i];
    }

    root <== root_sum;
}
