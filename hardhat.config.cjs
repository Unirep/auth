require('hardhat/config')
require('@nomiclabs/hardhat-ethers')

module.exports = {
  defaultNetwork: 'hardhat',
  paths: {
    artifacts: './build/artifacts',
    tests: './test/contracts',
  },
  networks: {
    hardhat: {
      blockGasLimit: 12000000,
    },
    local: {
      url: 'http://localhost:8545',
    },
  },
  solidity: {
    compilers: [
      {
        version: '0.8.17',
        settings: {
          optimizer: { enabled: true, runs: 2 ** 32 - 1 },
        },
      },
    ],
  },
  gasReporter: {
    enabled: process.env.REPORT_GAS ? true : false,
  },
}
