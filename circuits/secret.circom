pragma circom 2.0.0;

template Secret() {
  signal input s0;
  // the token x/y values
  signal input x;
  signal input y;

  signal output out;

  signal i1 <== x * s0 - y;
  signal _i2 <== x - 1;
  signal i2 <-- 1 / _i2;
  1 === i2 * _i2;
  out <== i1 * i2;
}
