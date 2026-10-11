export const RADIX = Math.E;
export const DIGIT_SET = 3;          // {0, 1, 2}
export const FRACTIONAL_PLACES = 3;  // where a non-terminating expansion is cut

export function baseEDigits(value) {
  if (!(value > 0)) return { digits: [0], highest: 0 };
  let highest = Math.floor(Math.log(value) / Math.log(RADIX));
  if (Math.pow(RADIX, highest + 1) <= value) highest += 1;
  const digits = [];
  let rem = value;
  for (let k = highest; k >= -FRACTIONAL_PLACES; k--) {
    const place = Math.pow(RADIX, k);
    let d = Math.floor(rem / place);
    if (d > DIGIT_SET - 1) d = DIGIT_SET - 1;
    if (d < 0) d = 0;
    digits.push(d);
    rem -= d * place;
  }
  return { digits, highest };
}

export function decodeBaseE(digits, highest) {
  let v = 0;
  for (let i = 0; i < digits.length; i++) v += digits[i] * Math.pow(RADIX, highest - i);
  return v;
}
