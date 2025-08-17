import { describe, it, expect, beforeEach, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import { initMoviesPanel } from '../js/movies.js';

// Minimal DOM setup for the movies panel
describe('initMoviesPanel', () => {
  beforeEach(() => {
    const dom = new JSDOM('<div id="movieList"></div>');
    global.document = dom.window.document;
    global.window = dom.window;
  });

  it('renders movie titles from external API', async () => {
    const mockMovies = [
      { title: 'Sample Movie', year: 2024, href: 'https://example.com/sample' }
    ];

    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockMovies)
      })
    );

    await initMoviesPanel();

    const link = document.querySelector('#movieList li a');
    expect(link.textContent).toContain('Sample Movie');
    expect(fetch).toHaveBeenCalledWith('https://raw.githubusercontent.com/prust/wikipedia-movie-data/master/movies.json');
  });
});
