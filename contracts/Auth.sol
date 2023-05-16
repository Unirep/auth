/// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import 'poseidon-solidity/PoseidonT3.sol';
import {IVerifier} from './interfaces/IVerifier.sol';

contract Auth {
  uint public idIndex = 1;

  struct Identity {
    uint pubkey;
    uint backupTreeRoot;
    uint identityRoot;
  }

  // pubkey to identity
  mapping(uint => Identity) public identities;
  // identityRoot to pubkey
  mapping(uint => uint) public identityRoots;

  IVerifier registerVerifier;
  IVerifier addTokenVerifier;

  constructor(IVerifier _registerVerifier, IVerifier _addTokenVerifier) {
    registerVerifier = _registerVerifier;
    addTokenVerifier = _addTokenVerifier;
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

    identityRoots[identityRoot] = pubkey;
  }

  function addToken(
    uint[] calldata publicSignals,
    uint[8] calldata proof
  ) public {
    require(addTokenVerifier.verifyProof(publicSignals, proof), 'badproof');
    // authenticate a new identity token for an identity
    uint fromIdentityRoot = publicSignals[0];
    uint toIdentityRoot = publicSignals[1];
    uint pubkey = identityRoots[fromIdentityRoot];

    require(pubkey != 0, 'badfromroot');
    require(identityRoots[toIdentityRoot] == 0, 'badtoroot');

    identityRoots[fromIdentityRoot] = 0;
    identityRoots[toIdentityRoot] = pubkey;
    require(
      identities[pubkey].identityRoot == fromIdentityRoot,
      'mismatchfrom'
    );
    identities[pubkey].identityRoot = toIdentityRoot;
  }

  function recoverIdentity(
    uint[] calldata publicSignals,
    uint[8] calldata proof
  ) public {
    // require(verifyProof(publicSignals, proof))
    // reset an identity using a backup code
  }

  function removeToken(
    uint[] calldata publicSignals,
    uint[8] calldata proof
  ) public {
    // require(verifyProof(publicSignals, proof))
    // deactivate a specific identity token
  }
}
