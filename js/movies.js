export async function initMoviesPanel() {
  const listEl = document.getElementById('movieList');
  if (!listEl) return;
  const apiKeyInput = document.getElementById('moviesApiKey');
  const apiKeyContainer = document.getElementById('moviesApiKeyContainer');
  const loadBtn = document.getElementById('moviesLoadBtn');

  const savedApiKey =
    (typeof localStorage !== 'undefined' && localStorage.getItem('moviesApiKey')) || '';
  if (apiKeyInput) apiKeyInput.value = savedApiKey;
  if (savedApiKey && apiKeyContainer) apiKeyContainer.style.display = 'none';

  let currentApiKey =
    (typeof window !== 'undefined' && window.tmdbApiKey) ||
    (typeof process !== 'undefined' && process.env.TMDB_API_KEY) ||
    savedApiKey ||
    '';

  const loadMovies = async () => {
    const apiKey = currentApiKey || apiKeyInput?.value.trim();
    if (!apiKey) {
      listEl.textContent = 'TMDB API key not provided.';
      return;
    }
    listEl.innerHTML = '<em>Loading...</em>';
    try {
      const url = `https://api.themoviedb.org/3/trending/movie/week?api_key=${apiKey}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('Network response was not ok');
      const data = await res.json();
      const movies = (data.results || []).slice(0, 100);
      if (movies.length === 0) {
        listEl.textContent = 'No movies found.';
        return;
      }

      const ul = document.createElement('ul');
      movies.forEach(m => {
        const li = document.createElement('li');
        const title = (m.title || m.name || '').trim();
        const year = (m.release_date || '').split('-')[0] || 'Unknown';
        const titleEl = document.createElement('strong');
        titleEl.textContent = `${title} (${year})`;
        li.appendChild(titleEl);

        const metaList = document.createElement('ul');
        if (m.vote_average) {
          const mi = document.createElement('li');
          mi.textContent = `TMDB score: ${m.vote_average}`;
          metaList.appendChild(mi);
        }
        if (m.vote_count) {
          const mi = document.createElement('li');
          mi.textContent = `Vote count: ${m.vote_count}`;
          metaList.appendChild(mi);
        }
        if (metaList.childNodes.length) li.appendChild(metaList);
        ul.appendChild(li);
      });

      listEl.innerHTML = '';
      listEl.appendChild(ul);
      if (!currentApiKey) {
        currentApiKey = apiKey;
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem('moviesApiKey', apiKey);
        }
        if (apiKeyContainer) apiKeyContainer.style.display = 'none';
      }
    } catch (err) {
      console.error('Failed to load movies', err);
      listEl.textContent = 'Failed to load movies.';
    }
  };

  loadBtn?.addEventListener('click', loadMovies);

  if (currentApiKey) {
    await loadMovies();
  } else {
    listEl.textContent = 'TMDB API key not provided.';
  }
}

if (typeof window !== 'undefined') {
  window.initMoviesPanel = initMoviesPanel;
}

