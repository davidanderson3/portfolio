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
        <div id="recipesApiInstructions"></div>
      </div>
      <button id="recipesLoadBtn"></button>
    `);
    global.document = dom.window.document;
    global.window = dom.window;
    global.localStorage = {
      getItem: vi.fn(() => ''),
      setItem: vi.fn()
    };
  });

  it('fetches and displays recipes from API Ninjas and caches API key', async () => {
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
    expect(localStorage.setItem).toHaveBeenCalledWith('recipesApiKey', 'testkey');
    expect(document.getElementById('recipesApiKeyContainer').style.display).toBe('none');
  });

  it('hides API key input when cached', async () => {
    global.localStorage.getItem = vi.fn((key) => key === 'recipesApiKey' ? 'cached' : '');
    const mockRecipes = [
      { title: 'Chicken Soup', ingredients: 'chicken, water', instructions: 'boil chicken' }
    ];
    global.fetch = vi.fn(() => Promise.resolve({
      ok: true,
      json: () => Promise.resolve(mockRecipes)
    }));

    await initRecipesPanel();
    expect(document.getElementById('recipesApiKeyContainer').style.display).toBe('none');
    document.getElementById('recipesQuery').value = 'chicken';
    document.getElementById('recipesLoadBtn').click();
    await new Promise(r => setTimeout(r, 0));
    expect(fetch).toHaveBeenCalledWith(
      'https://api.api-ninjas.com/v1/recipe?query=chicken',
      { headers: { 'X-Api-Key': 'cached' } }
    );
  });
});
