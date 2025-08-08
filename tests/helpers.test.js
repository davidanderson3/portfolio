import { describe, it, expect, vi } from 'vitest';
import { JSDOM } from 'jsdom';

// Mock auth.js to avoid loading Firebase scripts during tests
var currentUser;
var getMock;
var docMock;
var collectionMock;

vi.mock('../js/auth.js', () => ({
  getCurrentUser: () => currentUser,
  db: {
    collection: (...args) => collectionMock(...args)
  }
}));

// Initialize mocks after vi.mock so they are available when functions run
currentUser = null;
getMock = vi.fn();
docMock = vi.fn(() => ({ get: getMock }));
collectionMock = vi.fn(() => ({ doc: docMock }));

// Simple localStorage mock for Node environment
var storage = (() => {
  let store = {};
  return {
    getItem: key => (key in store ? store[key] : null),
    setItem: (key, value) => {
      store[key] = String(value);
    },
    removeItem: key => {
      delete store[key];
    },
    clear: () => {
      store = {};
    }
  };
})();
global.localStorage = storage;

import { parseNaturalDate, formatDaysUntil, generateId, linkify } from '../js/helpers.js';

describe('parseNaturalDate', () => {
  it('returns today\'s date string for "today" input', () => {
    const result = parseNaturalDate('today');
    const today = new Date().toISOString().split('T')[0];
    expect(result).toBe(today);
  });

  it('returns next Monday when input is "mon"', () => {
    const result = parseNaturalDate('mon');
    const today = new Date();
    const next = new Date(today);
    let delta = 1 - today.getDay();
    if (delta <= 0) delta += 7;
    next.setDate(today.getDate() + delta);
    const monday = next.toISOString().split('T')[0];
    expect(result).toBe(monday);
  });
});

describe('formatDaysUntil', () => {
  it('returns "today" for current date', () => {
    const today = new Date().toISOString().split('T')[0];
    expect(formatDaysUntil(today)).toBe('today');
  });

  it('handles future and past dates', () => {
    const now = new Date();
    const tomorrow = new Date(now); tomorrow.setDate(now.getDate() + 1);
    const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1);
    expect(formatDaysUntil(tomorrow.toISOString().split('T')[0])).toBe('in 1 day');
    expect(formatDaysUntil(yesterday.toISOString().split('T')[0])).toBe('overdue by 1 day');
  });
});

describe('generateId', () => {
  it('generates unique-like ids', () => {
    const a = generateId();
    const b = generateId();
    expect(a).not.toBe(b);
    expect(a).toMatch(/^_[a-z0-9]{9}$/);
  });
});

describe('linkify', () => {
  it('wraps URLs in anchor tags', () => {
    const input = 'see https://example.com for details';
    const out = linkify(input);
    expect(out).toBe('see <a href="https://example.com" target="_blank" rel="noopener noreferrer">https://example.com</a> for details');
  });

  it('escapes HTML to prevent injection', () => {
    const input = "<script>alert('x')</script>";
    const out = linkify(input);
    expect(out).toBe("&lt;script&gt;alert('x')&lt;/script&gt;");
  });

  it('renders escaped output safely in the DOM', () => {
    const input = "<script>alert('x')</script>";
    const dom = new JSDOM('<div id="c"></div>');
    const container = dom.window.document.getElementById('c');
    container.innerHTML = linkify(input);
    expect(container.textContent).toBe("<script>alert('x')</script>");
    expect(container.querySelector('script')).toBeNull();
  });
});

describe('loadDecisions caching behavior', () => {
  it('fetches real data after anonymous call', async () => {
    const { loadDecisions } = await import('../js/helpers.js');
    const { SAMPLE_DECISIONS } = await import('../js/sampleData.js');

    currentUser = null;
    collectionMock.mockClear();
    getMock.mockClear();

    const anon = await loadDecisions();
    expect(anon.length).toBe(SAMPLE_DECISIONS.length);
    anon.filter(i => i.scheduled).forEach(i => {
      expect(new Date(i.scheduled).getTime()).toBeGreaterThan(Date.now());
    });
    expect(collectionMock).not.toHaveBeenCalled();

    currentUser = { uid: 'user1' };
    getMock.mockResolvedValueOnce({ data: () => ({ items: [{ id: '1', text: 't' }] }) });

    const auth = await loadDecisions(true);
    expect(auth).toEqual([{ id: '1', text: 't' }]);
    expect(collectionMock).toHaveBeenCalled();
  });
});
