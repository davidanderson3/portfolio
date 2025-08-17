export async function initMoviesPanel() {
  const listEl = document.getElementById('movieList');
  if (!listEl) return;
  listEl.innerHTML = '<em>Loading...</em>';

  const apiKey =
    (typeof window !== 'undefined' && window.tmdbApiKey) ||
    (typeof process !== 'undefined' && process.env.TMDB_API_KEY) ||
    '';
  if (!apiKey) {
    listEl.textContent = 'TMDB API key not provided.';
    return;
  }

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
  } catch (err) {
    console.error('Failed to load movies', err);
    listEl.textContent = 'Failed to load movies.';
  }
}

if (typeof window !== 'undefined') {
  window.initMoviesPanel = initMoviesPanel;
}

