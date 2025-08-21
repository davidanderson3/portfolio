import { describe, it, expect, beforeEach, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import { initMoviesPanel } from '../js/movies.js';

// Minimal DOM setup for the movies panel
describe('initMoviesPanel', () => {
  beforeEach(() => {
    const dom = new JSDOM('<div id="movieList"></div>');
    global.document = dom.window.document;
    global.window = dom.window;
    window.tmdbApiKey = 'TEST_KEY';
  });

  it('renders movie titles with review info from TMDB', async () => {
    const apiData = {
      results: [
        {
          title: 'Sample Movie',
          release_date: '2024-01-01',
          vote_average: 7.5,
          vote_count: 5
        }
      ]
    };

    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve(apiData)
      })
    );

    await initMoviesPanel();

    const item = document.querySelector('#movieList li');
    expect(item.textContent).toContain('Sample Movie');
    expect(item.textContent).toContain('TMDB score: 7.5');
    expect(fetch).toHaveBeenCalledWith('https://api.themoviedb.org/3/trending/movie/week?api_key=TEST_KEY');
  });

  it('uses entered API key and caches it', async () => {
    const dom = new JSDOM(`
      <div id="movieList"></div>
      <div id="moviesApiKeyContainer"><input id="moviesApiKey" /></div>
      <button id="moviesLoadBtn"></button>
    `);
    global.document = dom.window.document;
    global.window = dom.window;

    let stored = '';
    global.localStorage = {
      getItem: key => (key === 'moviesApiKey' ? stored : ''),
      setItem: (key, value) => {
        if (key === 'moviesApiKey') stored = value;
      }
    };

    const apiData = {
      results: [
        { title: 'Any Movie', release_date: '2024-01-01' }
      ]
    };
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve(apiData)
      })
    );

    await initMoviesPanel();
    document.getElementById('moviesApiKey').value = 'INPUT_KEY';
    document.getElementById('moviesLoadBtn').click();
    await new Promise(r => setTimeout(r, 0));

    expect(fetch).toHaveBeenCalledWith('https://api.themoviedb.org/3/trending/movie/week?api_key=INPUT_KEY');
    expect(stored).toBe('INPUT_KEY');
  });

  it('caches API key even when fetch fails', async () => {
    const dom = new JSDOM(`
      <div id="movieList"></div>
      <div id="moviesApiKeyContainer"><input id="moviesApiKey" /></div>
      <button id="moviesLoadBtn"></button>
    `);
    global.document = dom.window.document;
    global.window = dom.window;

    let stored = '';
    global.localStorage = {
      getItem: key => (key === 'moviesApiKey' ? stored : ''),
      setItem: (key, value) => {
        if (key === 'moviesApiKey') stored = value;
      }
    };

    global.fetch = vi.fn(() => Promise.reject(new Error('fail')));

    await initMoviesPanel();
    document.getElementById('moviesApiKey').value = 'FAIL_KEY';
    document.getElementById('moviesLoadBtn').click();
    await new Promise(r => setTimeout(r, 0));

    expect(fetch).toHaveBeenCalledWith('https://api.themoviedb.org/3/trending/movie/week?api_key=FAIL_KEY');
    expect(stored).toBe('FAIL_KEY');
  });
});

