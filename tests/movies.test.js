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

  it('renders movie titles with review info from external API', async () => {
    const csv = 'movie_title,title_year,imdb_score,num_critic_for_reviews,num_user_for_reviews\n' +
                'Sample Movie,2024,7.5,10,5';

    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        text: () => Promise.resolve(csv)
      })
    );

    await initMoviesPanel();

    const item = document.querySelector('#movieList li');
    expect(item.textContent).toContain('Sample Movie');
    expect(item.textContent).toContain('IMDB score: 7.5');
    expect(fetch).toHaveBeenCalledWith('https://raw.githubusercontent.com/sundeepblue/movie_rating_prediction/master/movie_metadata.csv');
  });
});
