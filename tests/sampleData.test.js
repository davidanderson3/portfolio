import { describe, it, expect } from 'vitest';
import { SAMPLE_DECISIONS, SAMPLE_LISTS } from '../js/sampleData.js';
import { getSiteName } from '../js/siteName.js';

describe('sample data immutability', () => {
  it('deeply freezes SAMPLE_DECISIONS', () => {
    expect(Object.isFrozen(SAMPLE_DECISIONS)).toBe(true);
    expect(Object.isFrozen(SAMPLE_DECISIONS[0])).toBe(true);
    expect(() => {
      SAMPLE_DECISIONS[0].text = 'changed';
    }).toThrow();
      expect(SAMPLE_DECISIONS[0].text).toBe(`Welcome to ${getSiteName()}`);
  });

  it('deeply freezes SAMPLE_LISTS', () => {
    expect(Object.isFrozen(SAMPLE_LISTS)).toBe(true);
    expect(Object.isFrozen(SAMPLE_LISTS[0])).toBe(true);
    expect(Object.isFrozen(SAMPLE_LISTS[0].items)).toBe(true);
    expect(Object.isFrozen(SAMPLE_LISTS[0].items[0])).toBe(true);
    expect(() => {
      SAMPLE_LISTS[0].items.push({ Title: 'https://example.com', Title_label: 'Test', Author: 'Tester' });
    }).toThrow();
    expect(SAMPLE_LISTS[0].items).toHaveLength(2);
    expect(() => {
      SAMPLE_LISTS[0].items[0].Title_label = 'Changed';
    }).toThrow();
    expect(SAMPLE_LISTS[0].items[0].Title_label).toBe('Deep Work');
  });
});
