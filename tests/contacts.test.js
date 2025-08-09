import { describe, it, expect, beforeEach, vi } from 'vitest';
import { JSDOM } from 'jsdom';

let initContactsPanel, addContact, logContactEvent;

beforeEach(async () => {
  vi.resetModules();
  const dom = new JSDOM('<ul id="contactsList"></ul>', { url: 'http://localhost' });
  global.window = dom.window;
  global.document = dom.window.document;
  global.localStorage = dom.window.localStorage;
  ({ initContactsPanel, addContact, logContactEvent } = await import('../js/contacts.js'));
});

describe('contacts panel', () => {
  it('renders contacts from localStorage', () => {
    const sample = [{
      name: 'Alice',
      desiredContact: 7,
      desiredConversation: 30,
      desiredMeet: 60,
      lastContact: null,
      lastConversation: null,
      lastMeet: null
    }];
    localStorage.setItem('contacts', JSON.stringify(sample));
    initContactsPanel();
    const list = document.getElementById('contactsList');
    expect(list.children.length).toBe(1);
    expect(list.textContent).toContain('Alice');
    const buttons = list.querySelectorAll('button');
    expect(buttons.length).toBe(3);
  });

  it('adds a contact and saves to localStorage', () => {
    initContactsPanel();
    addContact('Bob', { desiredContact: 1, desiredConversation: 2, desiredMeet: 3 });
    const list = document.getElementById('contactsList');
    expect(list.textContent).toContain('Bob');
    const stored = JSON.parse(localStorage.getItem('contacts'));
    expect(stored[0].name).toBe('Bob');
    expect(stored[0].desiredContact).toBe(1);
    expect(stored[0].desiredConversation).toBe(2);
    expect(stored[0].desiredMeet).toBe(3);
  });

  it('logs interactions for a contact', () => {
    initContactsPanel();
    addContact('Bob', { desiredContact: 1, desiredConversation: 2, desiredMeet: 3 });
    logContactEvent('Bob', 'contact', 'quick hello');
    let stored = JSON.parse(localStorage.getItem('contacts'))[0];
    expect(stored.lastContact).not.toBeNull();
    expect(stored.logs.length).toBe(1);
    expect(stored.logs[0].note).toBe('quick hello');
    logContactEvent('Bob', 'conversation', 'chatted about project');
    stored = JSON.parse(localStorage.getItem('contacts'))[0];
    expect(stored.lastConversation).not.toBeNull();
    expect(stored.logs.length).toBe(2);
    logContactEvent('Bob', 'meet', 'met at cafe');
    stored = JSON.parse(localStorage.getItem('contacts'))[0];
    expect(stored.lastMeet).not.toBeNull();
    expect(stored.logs.length).toBe(3);
  });

  it('stores notes for interactions', () => {
    initContactsPanel();
    addContact('Alice', { desiredContact: 1, desiredConversation: 2, desiredMeet: 3 });
    logContactEvent('Alice', 'contact', 'lunch');
    const stored = JSON.parse(localStorage.getItem('contacts'))[0];
    expect(stored.logs[0].note).toBe('lunch');
    expect(stored.logs[0].type).toBe('contact');
    expect(stored.logs[0].date).toBeTruthy();
  });
});
