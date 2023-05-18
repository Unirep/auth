import fs from 'fs/promises'
import path from 'path'
import url from 'url'

const __dirname = path.dirname(url.fileURLToPath(import.meta.url))

const abiData = await fs.readFile(
  path.join(__dirname, '../build/artifacts/contracts/Auth.sol/Auth.json')
)
const { abi } = JSON.parse(abiData.toString())

await fs.writeFile(
  path.join(__dirname, '../abi/Auth.json'),
  JSON.stringify(abi)
)
