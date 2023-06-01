const F = BigInt(
  '21888242871839275222246405745257275088548364400416034343698204186575808495617'
)

// safely take the modulus of a negative value
const safemod = (v, _F = F) => {
  if (v >= 0n) return v % _F
  // if we have v = -12 in _F = 9
  // we need to do 18 + v = 6
  // 18 = floor(abs(-12) / 9) + 1
  return (_F * ((-1n * v) / _F + 1n) + v) % _F
}

// modular inverse
const modinv = (d, _F = F) => {
  d = safemod(d, _F)
  if (d === 0n) throw new Error('divide by zero')
  let y = 0n
  let x = 1n
  let f = _F
  while (d > 1n) {
    // q is quotient
    const q = d / f
    let t = f
    // f is remainder now,
    // process same as
    // Euclid's algo
    f = d % f
    d = t
    t = y
    // Update y and x
    y = x - q * y
    x = t
  }
  return safemod(x, _F)
}

const calcsecret = (s0, token, tokenX, _F = F) => {
  return safemod(safemod(tokenX * s0 - token, _F) * modinv(tokenX - 1n, _F), _F)
}

const encodeProof = (proof, leafIndex) => {
  // encode the leaf and each sibling as 32 byte values
  // encode each sibling index as a single character at the end
  const { leaf, siblings } = proof
  const toPadded = (v) => BigInt(v).toString(16).padStart(64, '0')
  return [
    ...siblings.map(([s]) => toPadded(s)),
    toPadded(leafIndex),
    toPadded(leaf),
  ].join('')
}

const decodeProof = (recoveryCode) => {
  if (recoveryCode.length % 64 !== 0)
    throw new Error('Invalid recovery code length')
  const siblingsCount = recoveryCode.length / 64 - 2
  const siblings = []
  for (let x = 0; x < siblingsCount; x++) {
    const s = recoveryCode.slice(64 * x, 64 * (x + 1))
    siblings.push([BigInt(`0x${s}`)])
  }
  const leafIndex = BigInt(`0x${recoveryCode.slice(-128, -64)}`)
  const leaf = BigInt(`0x${recoveryCode.slice(-64)}`)
  return { leaf, leafIndex, siblings }
}

module.exports = {
  calcsecret,
  safemod,
  modinv,
  F,
  encodeProof,
  decodeProof,
}
