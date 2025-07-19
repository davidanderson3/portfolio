import { describe, it, expect } from 'vitest';
import { calculateFinanceProjection, calculateHappinessScore } from '../js/planning.js';

describe('planning calculations', () => {
  it('projects finances over years', () => {
    const res = calculateFinanceProjection({
      currentAge: 30,
      retirementAge: 32,
      savings: 1000,
      income: 100,
      expenses: 50,
      returnRate: 0
    });
    expect(res).toEqual([
      { age: 30, balance: 1000 },
      { age: 31, balance: 1050 },
      { age: 32, balance: 1100 }
    ]);
  });

  it('calculates happiness score', () => {
    const score = calculateHappinessScore({ hobbyHours: 10, workHours: 40 });
    expect(score).toBe(-20);
  });
});
