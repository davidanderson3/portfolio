import { describe, it, expect, beforeEach, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import { initRecipesPanel } from '../js/recipes.js';

describe('initRecipesPanel', () => {
  beforeEach(() => {
    const dom = new JSDOM(`
      <div id="recipesList"></div>
      <input id="recipesQuery" />
      <div id="recipesApiKeyContainer">
        <input id="recipesApiKey" />
      </div>
      <button id="recipesLoadBtn"></button>
    `);
    global.document = dom.window.document;
    global.window = dom.window;
    global.localStorage = {
      getItem: () => '',
      setItem: () => {}
    };
  });

  it('fetches and displays recipes from API Ninjas', async () => {
    const mockRecipes = [
      { title: 'Chicken Soup', ingredients: 'chicken, water', instructions: 'boil chicken' }
    ];
    global.fetch = vi.fn(() => Promise.resolve({
      ok: true,
      json: () => Promise.resolve(mockRecipes)
    }));

    await initRecipesPanel();
    document.getElementById('recipesQuery').value = 'chicken';
    document.getElementById('recipesApiKey').value = 'testkey';
    document.getElementById('recipesLoadBtn').click();
    await new Promise(r => setTimeout(r, 0));

    const textEl = document.querySelector('#recipesList li strong');
    expect(textEl.textContent).toBe('Chicken Soup');
    expect(fetch).toHaveBeenCalledWith(
      'https://api.api-ninjas.com/v1/recipe?query=chicken',
      { headers: { 'X-Api-Key': 'testkey' } }
    );
  });

  it('hides API key input when one is cached', async () => {
    global.localStorage = {
      getItem: (key) => (key === 'recipesApiKey' ? 'cached' : ''),
      setItem: () => {}
    };
    const dom = new JSDOM(`
      <div id="recipesList"></div>
      <input id="recipesQuery" />
      <div id="recipesApiKeyContainer">
        <input id="recipesApiKey" />
      </div>
      <button id="recipesLoadBtn"></button>
    `);
    global.document = dom.window.document;
    global.window = dom.window;
    await initRecipesPanel();
    const container = document.getElementById('recipesApiKeyContainer');
    expect(container.style.display).toBe('none');
  });
});
