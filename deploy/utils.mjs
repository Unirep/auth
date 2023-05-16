import { utils } from 'ethers'
import path from 'path'
import url from 'url'
import fs from 'fs/promises'
import solc from 'solc'

const __dirname = path.dirname(url.fileURLToPath(import.meta.url))

export function linkLibrary(bytecode, libraries = {}) {
  let linkedBytecode = bytecode
  for (const [name, address] of Object.entries(libraries)) {
    const placeholder = `__\$${utils
      .solidityKeccak256(['string'], [name])
      .slice(2, 36)}\$__`
    const formattedAddress = utils
      .getAddress(address)
      .toLowerCase()
      .replace('0x', '')
    if (linkedBytecode.indexOf(placeholder) === -1) {
      throw new Error(`Unable to find placeholder for library ${name}`)
    }
    while (linkedBytecode.indexOf(placeholder) !== -1) {
      linkedBytecode = linkedBytecode.replace(placeholder, formattedAddress)
    }
  }
  return linkedBytecode
}

export const retryAsNeeded = async (fn, maxRetry = 10) => {
  let retryCount = 0
  let backoff = 1000
  for (;;) {
    try {
      return await fn()
    } catch (err) {
      if (++retryCount > maxRetry) throw err
      backoff *= 2
      console.log(`Failed, waiting ${backoff}ms`)
      await new Promise((r) => setTimeout(r, backoff))
    }
  }
}

export async function tryPath(file) {
  try {
    const f = path.join(__dirname, '../build/artifacts', file)
    await fs.stat(f)
    const artifacts = await fs.readFile(f)
    return JSON.parse(artifacts.toString())
  } catch (_) {
    const f = path.join(__dirname, '../artifacts', file)
    const artifacts = await fs.readFile(f)
    return JSON.parse(artifacts.toString())
  }
}
