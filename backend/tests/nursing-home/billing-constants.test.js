/**
 * Config / pricing invariants for nursing-home billing (CJS, no FE imports).
 */
const { NH_CONFIG } = require('../../config/constants');

describe('NH billing constants', () => {
  test('uses NY combined tax 8.875%', () => {
    expect(NH_CONFIG.BILLING.TAX_RATE).toBeCloseTo(0.08875);
  });

  test('deadline is Sunday noon America/New_York', () => {
    expect(NH_CONFIG.DEADLINE.DAY).toBe('Sunday');
    expect(NH_CONFIG.DEADLINE.HOUR).toBe(12);
    expect(NH_CONFIG.DEADLINE.TIMEZONE).toBe('America/New_York');
  });
});
