import { Web3Storage, getFilesFromPath } from 'web3.storage'
import path from 'path'
import url from 'url'
import fetch from 'node-fetch'

const __dirname = path.dirname(url.fileURLToPath(import.meta.url))

const client = new Web3Storage({
  token: process.env.WEB3_STORAGE_TOKEN,
})

const files = await getFilesFromPath(
  path.join(__dirname, '../coverage/lcov-report/')
)
const rootCid = await client.put(files, {
  wrapWithDirectory: false,
})

const r = await fetch('https://storage.jchancehud.workers.dev/update', {
  method: 'POST',
  headers: {
    'content-type': 'application/json',
  },
  body: JSON.stringify({
    key: process.env.STORAGE_KEY,
    name: 'unirep-auth',
    target: `https://${rootCid}.ipfs.dweb.link/`,
  }),
})
console.log(await r.text())
