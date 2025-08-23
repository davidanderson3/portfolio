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
          vote_count: 5,
          genre_ids: [28],
          adult: false,
          backdrop_path: '/path.jpg',
          id: 123,
          original_title: 'Original Title'
        }
      ]
    };
    const genreData = { genres: [{ id: 28, name: 'Action' }] };

    global.fetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(apiData)
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(genreData)
      });

    await initMoviesPanel();

    const item = document.querySelector('#movieList li');
    expect(item.textContent).toContain('Sample Movie');
    expect(item.textContent).toContain('vote_average: 7.5');
    expect(item.textContent).toContain('vote_count: 5');
    expect(item.textContent).toContain('genres: Action');
    expect(item.textContent).not.toContain('adult:');
    expect(item.textContent).not.toContain('backdrop_path:');
    expect(item.textContent).not.toContain('id:');
    expect(item.textContent).not.toContain('original_title:');
    expect(fetch).toHaveBeenNthCalledWith(
      1,
      'https://api.themoviedb.org/3/trending/movie/week?api_key=TEST_KEY'
    );
    expect(fetch).toHaveBeenNthCalledWith(
      2,
      'https://api.themoviedb.org/3/genre/movie/list?api_key=TEST_KEY'
    );
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
        { title: 'Any Movie', release_date: '2024-01-01', genre_ids: [] }
      ]
    };
    const genreData = { genres: [] };
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(apiData)
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(genreData)
      });

    await initMoviesPanel();
    document.getElementById('moviesApiKey').value = 'INPUT_KEY';
    document.getElementById('moviesLoadBtn').click();
    await new Promise(r => setTimeout(r, 0));

    expect(fetch).toHaveBeenNthCalledWith(
      1,
      'https://api.themoviedb.org/3/trending/movie/week?api_key=INPUT_KEY'
    );
    expect(fetch).toHaveBeenNthCalledWith(
      2,
      'https://api.themoviedb.org/3/genre/movie/list?api_key=INPUT_KEY'
    );
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

