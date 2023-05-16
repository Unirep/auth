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

  // used backup code nullifiers
  mapping(uint => bool) public backupCodeNullifiers;

  event Register(uint indexed pubkey, uint tokenHash, uint s0);
  event AddToken(uint indexed pubkey, uint tokenHash);
  event RemoveToken(uint indexed pubkey, uint tokenHash);
  event RecoverIdentity(uint indexed pubkey, uint tokenHash, uint s0);

  IVerifier registerVerifier;
  IVerifier addTokenVerifier;
  IVerifier removeTokenVerifier;
  IVerifier recoverIdentityVerifier;

  constructor(
    IVerifier _registerVerifier,
    IVerifier _addTokenVerifier,
    IVerifier _removeTokenVerifier,
    IVerifier _recoverIdentityVerifier
  ) {
    registerVerifier = _registerVerifier;
    addTokenVerifier = _addTokenVerifier;
    removeTokenVerifier = _removeTokenVerifier;
    recoverIdentityVerifier = _recoverIdentityVerifier;
  }

  function register(
    uint[] calldata publicSignals,
    uint[8] calldata proof
  ) public {
    require(registerVerifier.verifyProof(publicSignals, proof), 'badproof');

    uint pubkey = idIndex++;
    uint identityRoot = PoseidonT3.hash([pubkey, publicSignals[0]]);
    uint backupTreeRoot = publicSignals[3];

    identities[pubkey].pubkey = pubkey;
    identities[pubkey].backupTreeRoot = backupTreeRoot;
    identities[pubkey].identityRoot = identityRoot;

    identityRoots[identityRoot] = pubkey;

    uint tokenHash = publicSignals[1];
    uint s0 = publicSignals[2];
    emit Register(pubkey, tokenHash, s0);
  }

  // authenticate a new identity token for an identity
  function addToken(
    uint[] calldata publicSignals,
    uint[8] calldata proof
  ) public {
    require(addTokenVerifier.verifyProof(publicSignals, proof), 'badproof');

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

    uint tokenHash = publicSignals[2];
    emit AddToken(pubkey, tokenHash);
  }

  // deactivate a specific identity token
  function removeToken(
    uint[] calldata publicSignals,
    uint[8] calldata proof
  ) public {
    require(removeTokenVerifier.verifyProof(publicSignals, proof), 'badproof');

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

    uint tokenHash = publicSignals[2];
    emit RemoveToken(pubkey, tokenHash);
  }

  // reset an identity using a backup code
  function recoverIdentity(
    uint[] calldata publicSignals,
    uint[8] calldata proof
  ) public {
    require(
      recoverIdentityVerifier.verifyProof(publicSignals, proof),
      'badproof'
    );

    uint backupTreeRoot = publicSignals[0];
    uint identityRoot = publicSignals[1];
    uint nullifier = publicSignals[2];
    uint pubkey = publicSignals[4];

    require(backupCodeNullifiers[nullifier] == false, 'backupcodeused');
    backupCodeNullifiers[nullifier] = true;

    require(
      identities[pubkey].backupTreeRoot == backupTreeRoot,
      'badbackuproot'
    );

    identityRoots[identities[pubkey].identityRoot] = 0;
    identityRoots[identityRoot] = pubkey;
    identities[pubkey].identityRoot = identityRoot;

    uint tokenHash = publicSignals[3];
    uint s0 = publicSignals[5];
    emit RecoverIdentity(pubkey, tokenHash, s0);
  }
}
