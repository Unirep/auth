const { ethers } = require('hardhat')
const assert = require('assert')
const randomf = require('randomf')
const prover = require('../../provers/default')
const RegisterProof = require('../../src/RegisterProof')

// A dummy F value to test with
const F = 2n ** 250n

describe('Auth', function () {
  it('should deploy auth contract', async () => {
    const { deploy } = await import('../../deploy/deploy.mjs')
    const accounts = await ethers.getSigners()
    await deploy(accounts[0])
  })

  it('should register a new identity', async () => {
    const { deploy } = await import('../../deploy/deploy.mjs')
    const accounts = await ethers.getSigners()
    const contract = await deploy(accounts[0])

    const { publicSignals, proof } = await prover.genProofAndPublicSignals(
      'register',
      {
        s0: randomf(F),
        session_token: randomf(F),
        backup_tree_root: randomf(F),
      }
    )
    const registerProof = new RegisterProof(publicSignals, proof, prover)
    assert.equal(await registerProof.verify(), true)
  })
})
