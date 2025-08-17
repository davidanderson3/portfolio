export async function initRecipesPanel() {
  const listEl = document.getElementById('recipesList');
  if (!listEl) return;
  const queryInput = document.getElementById('recipesQuery');
  const apiKeyInput = document.getElementById('recipesApiKey');
  const apiKeyContainer = document.getElementById('recipesApiKeyContainer');
  const loadBtn = document.getElementById('recipesLoadBtn');

  const savedQuery = localStorage.getItem('recipesQuery') || '';
  let savedApiKey = localStorage.getItem('recipesApiKey') || '';
  if (queryInput) queryInput.value = savedQuery;
  if (apiKeyInput) apiKeyInput.value = savedApiKey;
  if (savedApiKey) {
    apiKeyContainer?.style.setProperty('display', 'none');
  } else {
    apiKeyContainer?.style.removeProperty('display');
  }

  const loadRecipes = async () => {
    const query = queryInput?.value.trim();
    const apiKey = apiKeyInput?.value.trim() || savedApiKey;
    if (!query || !apiKey) {
      listEl.textContent = 'Please enter search and API key.';
      return;
    }
    listEl.innerHTML = '<em>Loading...</em>';
    try {
      const res = await fetch(`https://api.api-ninjas.com/v1/recipe?query=${encodeURIComponent(query)}`, {
        headers: { 'X-Api-Key': apiKey }
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const recipes = await res.json();
      if (!Array.isArray(recipes) || recipes.length === 0) {
        listEl.textContent = 'No recipes found.';
        return;
      }
      const ul = document.createElement('ul');
      recipes.slice(0, 10).forEach(r => {
        const li = document.createElement('li');
        const title = document.createElement('strong');
        title.textContent = r.title || 'Untitled';
        li.appendChild(title);
        if (r.ingredients) {
          const ing = document.createElement('div');
          ing.textContent = `Ingredients: ${r.ingredients}`;
          li.appendChild(ing);
        }
        if (r.instructions) {
          const inst = document.createElement('div');
          inst.textContent = r.instructions;
          li.appendChild(inst);
        }
        ul.appendChild(li);
      });
      listEl.innerHTML = '';
      listEl.appendChild(ul);
      localStorage.setItem('recipesQuery', query);
      localStorage.setItem('recipesApiKey', apiKey);
      savedApiKey = apiKey;
      apiKeyContainer?.style.setProperty('display', 'none');
    } catch (err) {
      console.error('Failed to load recipes', err);
      listEl.textContent = 'Failed to load recipes.';
    }
  };

  loadBtn?.addEventListener('click', loadRecipes);

  if (savedQuery && savedApiKey) {
    loadRecipes();
  }
}

if (typeof window !== 'undefined') {
  window.initRecipesPanel = initRecipesPanel;
}
