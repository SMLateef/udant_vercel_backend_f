// Decimal-safe money helpers.
// RULE: never use JS floating point for currency math (see spec §10, §26).
// We store money as NUMERIC in Postgres and, in JS, operate on integer
// paise (1 INR = 100 paise) to avoid floating point rounding errors.

/** Convert a rupee amount (string or number, e.g. from a form field) to integer paise. */
export function toPaise(rupees) {
  const [whole, frac = ''] = String(rupees).split('.');
  const paddedFrac = (frac + '00').slice(0, 2);
  const sign = whole.startsWith('-') ? -1 : 1;
  const wholeAbs = whole.replace('-', '') || '0';
  return sign * (parseInt(wholeAbs, 10) * 100 + parseInt(paddedFrac, 10));
}

/** Convert integer paise back to a rupee string with 2 decimals. */
export function fromPaise(paise) {
  const sign = paise < 0 ? '-' : '';
  const abs = Math.abs(paise);
  const rupees = Math.floor(abs / 100);
  const remainder = String(abs % 100).padStart(2, '0');
  return `${sign}${rupees}.${remainder}`;
}

/** Sum an array of paise-integers safely. */
export function sumPaise(values) {
  return values.reduce((acc, v) => acc + v, 0);
}

/** Compute total = subtotal + logistics + fees, all in paise. */
export function computeOrderTotalPaise({ subtotalPaise, logisticsPaise = 0, feesPaise = 0 }) {
  return sumPaise([subtotalPaise, logisticsPaise, feesPaise]);
}
