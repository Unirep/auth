import { ethers } from 'ethers'
import { circuitContents } from '../scripts/circuits.mjs'
import Poseidon from 'poseidon-solidity'
const { PoseidonT3 } = Poseidon
import GlobalFactory from 'global-factory'
import { linkLibrary, tryPath, retryAsNeeded } from './utils.mjs'

function createVerifierName(circuit) {
  return `${circuit.charAt(0).toUpperCase() + circuit.slice(1)}Verifier`
}

export const deploy = async (deployer) => {
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

  console.log('Deploying Auth')

  const artifacts = await tryPath('contracts/Auth.sol/Auth.json')

  const { bytecode, abi } = artifacts
  const _authFactory = new ethers.ContractFactory(
    abi,
    linkLibrary(bytecode, {
      ['poseidon-solidity/PoseidonT3.sol:PoseidonT3']: PoseidonT3.address,
    }),
    deployer
  )
  const authFactory = await GlobalFactory(_authFactory)
  const authContract = await retryAsNeeded(() =>
    authFactory.deploy(verifiers['register'], verifiers['addToken'])
  )
  await authContract.deployed()
  console.log(`Deployed Auth.sol to ${authContract.address}`)
  return authContract
}
