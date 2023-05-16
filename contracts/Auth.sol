/// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import 'poseidon-solidity/PoseidonT3.sol';
import {IVerifier} from './interfaces/IVerifier.sol';

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

  IVerifier registerVerifier;

  constructor(IVerifier _registerVerifier) {
    registerVerifier = _registerVerifier;
  }

  function register(
    uint[] calldata publicSignals,
    uint[8] calldata proof
  ) public {
    require(registerVerifier.verifyProof(publicSignals, proof), 'badproof');

    uint pubkey = idIndex++;
    uint identityRoot = PoseidonT3.hash([pubkey, publicSignals[0]]);

    identities[pubkey].pubkey = pubkey;
    identities[pubkey].backupTreeRoot = publicSignals[1];
    identities[pubkey].identityRoot = identityRoot;
  }

  function authenticate(
    uint[] calldata publicSignals,
    uint[8] calldata proof
  ) public {
    // require(verifyProof(publicSignals, proof))
    // authenticate a new identity token for an identity
  }

  function recover(
    uint[] calldata publicSignals,
    uint[8] calldata proof
  ) public {
    // require(verifyProof(publicSignals, proof))
    // reset an identity using a backup code
  }

  function deactivate(
    uint[] calldata publicSignals,
    uint[8] calldata proof
  ) public {
    // require(verifyProof(publicSignals, proof))
    // deactivate a specific identity token
  }
}
