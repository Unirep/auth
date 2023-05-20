require('hardhat/config')
require('@nomiclabs/hardhat-ethers')
require('@nomicfoundation/hardhat-chai-matchers')

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
      url: 'http://127.0.0.1:8545',
    },
    sepolia: {
      url: 'https://sepolia.unirep.io',
      chainId: 11155111,
      accounts: [
        '0x2a9c0fd15737bf6842757a8a32d8114b7fb801bfbc91e73f4cc2309c9e3e8456',
      ],
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
