import { describe, it, expect, beforeEach, vi } from 'vitest';
import { JSDOM } from 'jsdom';

// simple localStorage mock
const storage = (() => {
  let store = {};
  return {
    getItem: key => (key in store ? store[key] : null),
    setItem: (key, value) => { store[key] = String(value); },
    removeItem: key => { delete store[key]; },
    clear: () => { store = {}; }
  };
})();

global.localStorage = storage;

const flush = () => new Promise(resolve => setTimeout(resolve, 0));

describe('initShowsPanel', () => {
  let initShowsPanel;
  beforeEach(async () => {
    storage.clear();
    const dom = new JSDOM(`
      <input id="spotifyClientId" />
      <input id="spotifyClientSecret" />
      <button id="spotifyTokenBtn"></button>
      <input id="spotifyToken" />
      <input id="ticketmasterApiKey" />
      <button id="ticketmasterLoadBtn"></button>
      <div id="ticketmasterList"></div>
    `);
    global.window = dom.window;
    global.document = dom.window.document;
    global.fetch = vi.fn();
    ({ initShowsPanel } = await import('../js/shows.js'));
  });

  it('fetches Spotify artists and Ticketmaster events', async () => {
    fetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({ items: [{ name: 'The Band' }] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ _embedded: { events: [{ name: 'Concert', dates: { start: { localDate: '2024-01-01' } }, _embedded: { venues: [{ name: 'Venue', city: { name: 'City' }, state: { stateCode: 'ST' } }] }, url: 'http://example.com' }] } }) });

    await initShowsPanel();
    document.getElementById('spotifyToken').value = 'token';
    document.getElementById('ticketmasterApiKey').value = 'key';
    const btn = document.getElementById('ticketmasterLoadBtn');
    btn.dispatchEvent(new window.Event('click'));

    await flush();
    await flush();

    expect(fetch).toHaveBeenCalledTimes(2);
    expect(document.querySelectorAll('#ticketmasterList li').length).toBe(1);
  });

  it('caches credentials and token even when fetch fails', async () => {
    fetch.mockRejectedValue(new Error('fail'));

    await initShowsPanel();
    document.getElementById('spotifyClientId').value = 'cid';
    document.getElementById('spotifyClientSecret').value = 'sec';
    document.getElementById('spotifyTokenBtn').dispatchEvent(new window.Event('click'));

    await flush();

    document.getElementById('spotifyToken').value = 'tok';
    document.getElementById('ticketmasterApiKey').value = 'key';
    document.getElementById('ticketmasterLoadBtn').dispatchEvent(new window.Event('click'));

    await flush();

    expect(localStorage.getItem('spotifyClientId')).toBe('cid');
    expect(localStorage.getItem('spotifyClientSecret')).toBe('sec');
    expect(localStorage.getItem('spotifyToken')).toBe('tok');
    expect(localStorage.getItem('ticketmasterApiKey')).toBe('key');
  });
});

