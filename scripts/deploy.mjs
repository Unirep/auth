import { deploy } from '../deploy/deploy.mjs'
import fs from 'fs/promises'
import path from 'path'
import url from 'url'

const __dirname = path.dirname(url.fileURLToPath(import.meta.url))

const [signer] = await ethers.getSigners()
const contract = await deploy(signer)
console.log(`Auth address: ${contract.address}`)

const config = `module.exports = {
  ETH_PROVIDER_URL: 'http://127.0.0.1:8545',
  APP_ADDRESS: '${contract.address}',
}
`

await fs.writeFile(path.join(__dirname, '../config.js'), config)
