import { describe, it, expect, beforeEach, vi } from 'vitest';
import { JSDOM } from 'jsdom';

let initContactsPanel, addContact;

beforeEach(async () => {
  vi.resetModules();
  const dom = new JSDOM('<ul id="contactsList"></ul>', { url: 'http://localhost' });
  global.window = dom.window;
  global.document = dom.window.document;
  global.localStorage = dom.window.localStorage;
  ({ initContactsPanel, addContact } = await import('../js/contacts.js'));
});

describe('contacts panel', () => {
  it('renders contacts from localStorage', () => {
    localStorage.setItem('contacts', JSON.stringify(['Alice']));
    initContactsPanel();
    const list = document.getElementById('contactsList');
    expect(list.children.length).toBe(1);
    expect(list.textContent).toContain('Alice');
  });

  it('adds a contact and saves to localStorage', () => {
    initContactsPanel();
    addContact('Bob');
    const list = document.getElementById('contactsList');
    expect(list.children.length).toBe(1);
    expect(list.textContent).toContain('Bob');
    const stored = JSON.parse(localStorage.getItem('contacts'));
    expect(stored).toEqual(['Bob']);
  });
});
