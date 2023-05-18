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

module.exports = {
  safemod,
  modinv,
  F,
}
