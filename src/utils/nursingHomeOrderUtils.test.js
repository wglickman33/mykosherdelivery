/**
 * Frontend NH order util invariants (Node built-in test runner).
 * Run: node --test src/utils/nursingHomeOrderUtils.test.js
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  isNoneMeal,
  isMealSlotComplete,
  isDayComplete,
  getDayProgress,
  copyDayToDays,
  getNextMealNavLabel,
  isLastMealSlot,
  getNhOrderDeadline,
  formatNhDeadline,
  getMealSelectionHints,
  calculateNhOrderTotals
} from './nursingHomeOrderUtils.js';

describe('isNoneMeal / slot complete', () => {
  test('empty or missing meal is not none and not complete', () => {
    assert.equal(isNoneMeal(undefined), false);
    assert.equal(isNoneMeal(null), false);
    assert.equal(isMealSlotComplete(undefined), false);
  });

  test('explicit none is complete', () => {
    assert.equal(isNoneMeal({ none: true }), true);
    assert.equal(isMealSlotComplete({ none: true }), true);
  });
});

describe('day progress', () => {
  test('tracks partial and complete days', () => {
    const meals = {
      'Monday-breakfast': { none: true, day: 'Monday', mealType: 'breakfast' },
      'Monday-lunch': {
        day: 'Monday',
        mealType: 'lunch',
        items: [{ id: 1, name: 'Soup', category: 'entree' }]
      }
    };
    assert.deepEqual(getDayProgress(meals, 'Monday'), { filled: 2, total: 3, complete: false });
    assert.equal(isDayComplete(meals, 'Monday'), false);

    meals['Monday-dinner'] = { none: true, day: 'Monday', mealType: 'dinner' };
    assert.equal(isDayComplete(meals, 'Monday'), true);
  });
});

describe('copyDayToDays', () => {
  test('copies confirmed slots onto targets only', () => {
    const source = {
      'Monday-breakfast': {
        day: 'Monday',
        mealType: 'breakfast',
        none: true,
        items: []
      },
      'Monday-lunch': {
        day: 'Monday',
        mealType: 'lunch',
        items: [{ id: 'a', name: 'Salad', category: 'entree' }],
        bagelType: null,
        none: false
      },
      'Monday-dinner': {
        day: 'Monday',
        mealType: 'dinner',
        none: true,
        items: []
      }
    };

    const next = copyDayToDays(source, 'Monday', ['Tuesday', 'Wednesday']);
    assert.equal(next['Tuesday-lunch'].items[0].name, 'Salad');
    assert.equal(next['Tuesday-lunch'].day, 'Tuesday');
    assert.equal(next['Wednesday-breakfast'].none, true);
    assert.equal(next['Monday-lunch'].day, 'Monday');
  });
});

describe('next nav labels', () => {
  test('sequences meals then days then review', () => {
    assert.equal(getNextMealNavLabel('Monday', 'breakfast'), 'Next: Lunch');
    assert.equal(getNextMealNavLabel('Monday', 'lunch'), 'Next: Dinner');
    assert.equal(getNextMealNavLabel('Monday', 'dinner'), 'Next Day: Tuesday');
    assert.equal(getNextMealNavLabel('Sunday', 'dinner'), 'Review order');
    assert.equal(isLastMealSlot('Sunday', 'dinner'), true);
    assert.equal(isLastMealSlot('Monday', 'dinner'), false);
  });
});

describe('deadline', () => {
  test('formats as noon America/New_York', () => {
    const deadline = getNhOrderDeadline();
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    }).formatToParts(deadline);
    const hour = parts.find((p) => p.type === 'hour')?.value;
    const minute = parts.find((p) => p.type === 'minute')?.value;
    const dayPeriod = parts.find((p) => p.type === 'dayPeriod')?.value;
    assert.equal(hour, '12');
    assert.equal(minute, '00');
    assert.equal(dayPeriod, 'PM');
    assert.match(formatNhDeadline(deadline), /12:00\sPM/);
  });
});

describe('selection hints', () => {
  test('asks for side and bagel when needed', () => {
    const hints = getMealSelectionHints('breakfast', {
      items: [{ id: 1, name: 'Bagel', category: 'main', requiresBagelType: true }]
    });
    assert.ok(hints.some((h) => h.category === 'side'));
    assert.ok(hints.some((h) => h.category === 'bagel'));
  });
});

describe('totals', () => {
  test('ignores none meals in pricing', () => {
    const totals = calculateNhOrderTotals({
      'Monday-breakfast': { mealType: 'breakfast', none: true, items: [] },
      'Monday-lunch': {
        mealType: 'lunch',
        items: [{ id: 1, name: 'Entree', category: 'entree' }]
      }
    });
    assert.equal(totals.mealCount, 1);
    assert.equal(totals.subtotal, 21);
  });
});
