pragma solidity ^0.8.0;

contract Auth {
  uint idIndex = 1;

  struct Identity {
    uint pubkey;
    uint backupTreeRoot;
    uint identityRoot;
  }

  // pubkey to identity
  mapping(uint => Identity) identities;
  // identityRoot to pubkey
  mapping(uint => uint) identityRoots;

  function register(uint[] calldata publicSignals, uint[8] calldata proof) public {
    // require(verifyProof(publicSignals, proof))

  }

  function authenticate(uint[] calldata publicSignals, uint[8] calldata proof) public {
    // require(verifyProof(publicSignals, proof))

    // authenticate a new identity token for an identity
  }

  function recover(uint[] calldata publicSignals, uint[8] calldata proof) public {
    // require(verifyProof(publicSignals, proof))

    // reset an identity using a backup code
  }

  function deactivate(uint[] calldata publicSignals, uint[8] calldata proof) public {
    // require(verifyProof(publicSignals, proof))

    // deactivate a specific identity token
  }
}
