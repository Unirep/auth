import { ethers } from 'ethers'
import { circuitContents } from '../scripts/circuits.mjs'
import Poseidon from 'poseidon-solidity'
const { PoseidonT3 } = Poseidon
import GlobalFactory from 'global-factory'
import { linkLibrary, tryPath, retryAsNeeded } from './utils.mjs'
import CircuitConfig from '../src/CircuitConfig.js'

function createVerifierName(circuit) {
  return `${circuit.charAt(0).toUpperCase() + circuit.slice(1)}Verifier`
}

export const deploy = async (deployer, config) => {
  const { SESSION_TREE_DEPTH, BACKUP_TREE_DEPTH } = new CircuitConfig(config)

  if ((await deployer.provider.getCode(PoseidonT3.proxyAddress)) === '0x') {
    await retryAsNeeded(() =>
      deployer.sendTransaction({
        to: PoseidonT3.from,
        value: PoseidonT3.gas,
      })
    )
    await retryAsNeeded(() => deployer.provider?.sendTransaction(PoseidonT3.tx))
  }
  if ((await deployer.provider.getCode(PoseidonT3.address)) === '0x') {
    // nothing to do, contract is already deployed
    await retryAsNeeded(() =>
      deployer.sendTransaction({
        to: PoseidonT3.proxyAddress,
        data: PoseidonT3.data,
      })
    )
  }

  const verifiers = {}
  for (const circuit of Object.keys(circuitContents)) {
    const contractName = createVerifierName(circuit)

    console.log(`Deploying ${contractName}`)
    const verifierPath = `contracts/verifiers/${contractName}.sol/${contractName}.json`
    const artifacts = await tryPath(verifierPath)

    const { bytecode, abi } = artifacts
    const _verifierFactory = new ethers.ContractFactory(abi, bytecode, deployer)
    const verifierFactory = await GlobalFactory(_verifierFactory)
    const verifierContract = await retryAsNeeded(() => verifierFactory.deploy())
    await verifierContract.deployed()
    verifiers[circuit] = verifierContract.address
  }

  // Deploy lazy merkle tree
  console.log('Deploying LazyMerkleTree')
  let merkleTreeContract
  {
    const artifacts = await tryPath(
      'contracts/libraries/LazyMerkleTree.sol/LazyMerkleTree.json'
    )
    const { bytecode, abi } = artifacts
    const _merkleTreeFactory = new ethers.ContractFactory(
      abi,
      linkLibrary(bytecode, {
        ['poseidon-solidity/PoseidonT3.sol:PoseidonT3']: PoseidonT3.address,
      }),
      deployer
    )

    const merkleTreeFactory = await GlobalFactory(_merkleTreeFactory)
    merkleTreeContract = await retryAsNeeded(() => merkleTreeFactory.deploy())
    await merkleTreeContract.deployed()
  }

  console.log('Deploying Auth')

  const artifacts = await tryPath('contracts/Auth.sol/Auth.json')

  const { bytecode, abi } = artifacts
  const _authFactory = new ethers.ContractFactory(
    abi,
    linkLibrary(bytecode, {
      ['poseidon-solidity/PoseidonT3.sol:PoseidonT3']: PoseidonT3.address,
      ['contracts/libraries/LazyMerkleTree.sol:LazyMerkleTree']:
        merkleTreeContract.address,
    }),
    deployer
  )
  const authFactory = await GlobalFactory(_authFactory)
  const authContract = await retryAsNeeded(() =>
    authFactory.deploy(
      {
        sessionTreeDepth: SESSION_TREE_DEPTH,
        backupTreeDepth: BACKUP_TREE_DEPTH,
      },
      verifiers['register'],
      verifiers['addToken'],
      verifiers['removeToken'],
      verifiers['recoverIdentity']
    )
  )
  await authContract.deployed()
  console.log(`Deployed Auth.sol to ${authContract.address}`)
  return authContract
}
