import { describe, it, expect, beforeEach } from 'vitest';
import { loadQuestions, saveQuestions } from '../js/geoscore.js';

describe('geoscore persistence', () => {
  beforeEach(() => {
    const store = {};
    global.localStorage = {
      getItem: key => (key in store ? store[key] : null),
      setItem: (key, val) => { store[key] = String(val); },
      removeItem: key => { delete store[key]; }
    };
  });

  it('saves and loads answer counts', () => {
    const qs = [{
      question: 'Capital of France?',
      answers: [
        { answer: 'Paris', score: 1, count: 2 },
        { answer: 'Lyon', score: 0, count: 1 }
      ]
    }];
    saveQuestions(qs);
    expect(loadQuestions()).toEqual(qs);
  });
});
