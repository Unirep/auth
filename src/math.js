const F = BigInt(
  '21888242871839275222246405745257275088548364400416034343698204186575808495617'
)

// safely take the modulus of a negative value
module.exports.safemod = (v, _F = F) => {
  if (v >= 0n) return v % _F
  // if we have v = -12 in _F = 9
  // we need to do 18 + v = 6
  // 18 = floor(abs(-12) / 9) + 1
  return (_F * ((-1n * v) / _F + 1n) + v) % _F
}
module.exports.F = F
