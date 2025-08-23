export async function initRecipesPanel() {
  const listEl = document.getElementById('recipesList');
  if (!listEl) return;
  const queryInput = document.getElementById('recipesQuery');
  const apiKeyInput = document.getElementById('recipesApiKey');
  const apiKeyContainer = document.getElementById('recipesApiKeyContainer');
  const searchBtn = document.getElementById('recipesSearchBtn');

  const savedQuery = localStorage.getItem('recipesQuery') || '';
  const savedApiKey = localStorage.getItem('recipesApiKey') || '';
  if (queryInput) queryInput.value = savedQuery;
  if (apiKeyInput) apiKeyInput.value = savedApiKey;
  if (savedApiKey && apiKeyContainer) apiKeyContainer.style.display = 'none';

  let currentApiKey = savedApiKey;

  const loadRecipes = async () => {
    const query = queryInput?.value.trim();
    const apiKey = currentApiKey || apiKeyInput?.value.trim();
    if (!query || !apiKey) {
      listEl.textContent = 'Please enter search and API key.';
      return;
    }
    listEl.innerHTML = '<em>Loading...</em>';
    try {
      const res = await fetch(`https://api.api-ninjas.com/v1/recipe?query=${encodeURIComponent(query)}&limit=10`, {
        headers: { 'X-Api-Key': apiKey }
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const recipes = await res.json();
      if (!Array.isArray(recipes) || recipes.length === 0) {
        listEl.textContent = 'No recipes found.';
        return;
      }
      const hidden = JSON.parse(localStorage.getItem('recipesHidden') || '[]');
      const limited = recipes
        .filter(r => !hidden.includes(r.title))
        .slice(0, 10);
      const ul = document.createElement('ul');
      limited.forEach(r => {
        const li = document.createElement('li');
        const title = document.createElement('strong');
        title.textContent = r.title || 'Untitled';
        li.appendChild(title);

        const saveBtn = document.createElement('button');
        saveBtn.textContent = 'Save';
        saveBtn.addEventListener('click', () => {
          const saved = JSON.parse(localStorage.getItem('recipesSaved') || '[]');
          if (!saved.some(s => s.title === r.title)) {
            saved.push(r);
            localStorage.setItem('recipesSaved', JSON.stringify(saved));
          }
          saveBtn.textContent = 'Saved';
          saveBtn.disabled = true;
        });
        li.appendChild(saveBtn);

        const hideBtn = document.createElement('button');
        hideBtn.textContent = 'Hide';
        hideBtn.addEventListener('click', () => {
          const stored = JSON.parse(localStorage.getItem('recipesHidden') || '[]');
          if (!stored.includes(r.title)) {
            stored.push(r.title);
            localStorage.setItem('recipesHidden', JSON.stringify(stored));
          }
          li.remove();
        });
        li.appendChild(hideBtn);

        // Ingredients
        if (r.ingredients) {
          const ingHeader = document.createElement('div');
          ingHeader.textContent = 'Ingredients';
          li.appendChild(ingHeader);
          const ingList = document.createElement('ul');
          const rawIngredients = r.ingredients.includes('|') ? r.ingredients.split('|') : r.ingredients.split(',');
          rawIngredients.map(i => i.trim()).filter(Boolean).forEach(i => {
            const ingItem = document.createElement('li');
            ingItem.textContent = i;
            ingList.appendChild(ingItem);
          });
          li.appendChild(ingList);
        }

        // Servings
        if (r.servings) {
          const servingsEl = document.createElement('p');
          servingsEl.textContent = `Servings: ${r.servings}`;
          li.appendChild(servingsEl);
        }

        // Instructions
        if (r.instructions) {
          const instrHeader = document.createElement('div');
          instrHeader.textContent = 'Instructions';
          li.appendChild(instrHeader);
          const instrList = document.createElement('ol');
          r.instructions.split('.').map(s => s.trim()).filter(Boolean).forEach(step => {
            const stepItem = document.createElement('li');
            stepItem.textContent = step;
            instrList.appendChild(stepItem);
          });
          li.appendChild(instrList);
        }

        // Other metadata
        const metaEntries = Object.entries(r).filter(([key]) => !['title', 'ingredients', 'servings', 'instructions'].includes(key));
        if (metaEntries.length) {
          const metaList = document.createElement('ul');
          metaEntries.forEach(([key, value]) => {
            const metaItem = document.createElement('li');
            metaItem.textContent = `${key}: ${value}`;
            metaList.appendChild(metaItem);
          });
          li.appendChild(metaList);
        }

        ul.appendChild(li);
      });
      listEl.innerHTML = '';
      listEl.appendChild(ul);
      localStorage.setItem('recipesQuery', query);
      if (!currentApiKey) {
        currentApiKey = apiKey;
        localStorage.setItem('recipesApiKey', apiKey);
        if (apiKeyContainer) apiKeyContainer.style.display = 'none';
      }
    } catch (err) {
      console.error('Failed to load recipes', err);
      listEl.textContent = 'Failed to load recipes.';
    }
  };

  searchBtn?.addEventListener('click', loadRecipes);

  if (savedQuery && savedApiKey) {
    loadRecipes();
  }
}

if (typeof window !== 'undefined') {
  window.initRecipesPanel = initRecipesPanel;
}
