const { ethers } = require('hardhat')

describe('Auth', function () {
  it('should deploy auth contract', async () => {
    const { deploy } = await import('../../deploy/deploy.mjs')
    const accounts = await ethers.getSigners()
    await deploy(accounts[0])
  })
})
