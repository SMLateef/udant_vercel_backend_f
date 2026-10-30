import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toPaise, fromPaise, sumPaise, computeOrderTotalPaise } from '../src/utils/money.js';

test('toPaise converts rupees to integer paise without float drift', () => {
  assert.equal(toPaise('22.50'), 2250);
  assert.equal(toPaise(185), 18500);
  assert.equal(toPaise('0.1'), 10);
});

test('fromPaise converts back to a rupee string', () => {
  assert.equal(fromPaise(2250), '22.50');
  assert.equal(fromPaise(10), '0.10');
});

test('toPaise/fromPaise round-trip avoids classic float bugs (0.1 + 0.2)', () => {
  const a = toPaise('0.10');
  const b = toPaise('0.20');
  assert.equal(fromPaise(sumPaise([a, b])), '0.30'); // plain JS floats give 0.30000000000000004
});

test('computeOrderTotalPaise sums subtotal, logistics and fees', () => {
  const total = computeOrderTotalPaise({ subtotalPaise: 220000, logisticsPaise: 5000, feesPaise: 1500 });
  assert.equal(total, 226500);
  assert.equal(fromPaise(total), '2265.00');
});
