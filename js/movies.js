export async function initMoviesPanel() {
  const listEl = document.getElementById('movieList');
  if (!listEl) return;
  const apiKeyInput = document.getElementById('moviesApiKey');
  const apiKeyContainer = document.getElementById('moviesApiKeyContainer');
  const saveBtn = document.getElementById('moviesSaveBtn');

  const hiddenKey = 'hiddenMovieIds';

  const getHidden = () => {
    if (typeof localStorage === 'undefined') return new Set();
    try {
      const stored = localStorage.getItem(hiddenKey);
      return new Set(
        (stored ? JSON.parse(stored) : []).map(id => String(id))
      );
    } catch (_) {
      return new Set();
    }
  };

  const saveHidden = ids => {
    if (typeof localStorage === 'undefined') return;
    try {
      localStorage.setItem(hiddenKey, JSON.stringify(Array.from(ids)));
    } catch (_) {
      /* ignore */
    }
  };

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

    if (!currentApiKey) {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('moviesApiKey', apiKey);
      }
      if (typeof window !== 'undefined') {
        window.tmdbApiKey = apiKey;
      }
    }

    listEl.innerHTML = '<em>Loading...</em>';
    try {
      const url = `https://api.themoviedb.org/3/trending/movie/week?api_key=${apiKey}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('Network response was not ok');
      const data = await res.json();
      const hidden = getHidden();
      const movies = (data.results || [])
        .slice(0, 100)
        .filter(m => !hidden.has(String(m.id)));
      if (movies.length === 0) {
        listEl.textContent = 'No movies found.';
        return;
      }

      // Fetch cast and crew for each movie
      await Promise.all(
        movies.map(async m => {
          try {
            const creditUrl = `https://api.themoviedb.org/3/movie/${m.id}/credits?api_key=${apiKey}`;
            const creditRes = await fetch(creditUrl);
            if (creditRes.ok) {
              const creditData = await creditRes.json();
              m.actors = (creditData.cast || [])
                .slice(0, 5)
                .map(c => c.name)
                .join(', ');
              const director = (creditData.crew || []).find(c => c.job === 'Director');
              if (director) m.director = director.name;
            }
          } catch (_) {
            /* ignore credit fetch errors */
          }
        })
      );

      // Fetch genre list to map IDs to names
      let genreMap = {};
      try {
        const genreUrl = `https://api.themoviedb.org/3/genre/movie/list?api_key=${apiKey}`;
        const genreRes = await fetch(genreUrl);
        if (genreRes.ok) {
          const genreData = await genreRes.json();
          genreMap = Object.fromEntries(
            (genreData.genres || []).map(g => [g.id, g.name])
          );
        }
      } catch (_) {
        // ignore genre fetch errors
      }

      const exclude = new Set([
        'adult',
        'backdrop_path',
        'id',
        'original_title',
        'poster_path',
        'title',
        'actors',
        'director'
      ]);
      const ul = document.createElement('ul');
      movies.forEach(m => {
        const li = document.createElement('li');
        li.className = 'movie-card';
        const title = (m.title || m.name || '').trim();
        const year = (m.release_date || '').split('-')[0] || 'Unknown';

        if (m.poster_path) {
          const img = document.createElement('img');
          img.src = `https://image.tmdb.org/t/p/w200${m.poster_path}`;
          img.alt = `${title} poster`;
          li.appendChild(img);
        }

        const info = document.createElement('div');
        info.className = 'movie-info';

        const titleEl = document.createElement('h3');
        titleEl.textContent = `${title} (${year})`;
        info.appendChild(titleEl);

        const hideBtn = document.createElement('button');
        hideBtn.textContent = 'Hide';
        hideBtn.addEventListener('click', () => {
          hidden.add(String(m.id));
          saveHidden(hidden);
          li.remove();
        });
        info.appendChild(hideBtn);

        const metaList = document.createElement('ul');
        metaList.className = 'movie-meta';

        if (m.director) {
          const mi = document.createElement('li');
          mi.textContent = `director: ${m.director}`;
          metaList.appendChild(mi);
        }
        if (m.actors) {
          const mi = document.createElement('li');
          mi.textContent = `actors: ${m.actors}`;
          metaList.appendChild(mi);
        }

        Object.entries(m).forEach(([key, value]) => {
          if (value === null || value === undefined) return;
          if (exclude.has(key)) return;
          const mi = document.createElement('li');
          if (key === 'genre_ids') {
            const names = (value || [])
              .map(id => genreMap[id])
              .filter(Boolean);
            const display = names.length ? names.join(', ') : (value || []).join(', ');
            mi.textContent = `genres: ${display}`;
          } else if (key === 'overview') {
            mi.textContent = `${value}`;
          } else {
            mi.textContent = `${key}: ${
              typeof value === 'object' ? JSON.stringify(value) : value
            }`;
          }
          metaList.appendChild(mi);
        });
        if (metaList.childNodes.length) info.appendChild(metaList);

        li.appendChild(info);
        ul.appendChild(li);
      });

      listEl.innerHTML = '';
      listEl.appendChild(ul);
      if (!currentApiKey) {
        currentApiKey = apiKey;
        if (apiKeyContainer) apiKeyContainer.style.display = 'none';
      }
    } catch (err) {
      console.error('Failed to load movies', err);
      listEl.textContent = 'Failed to load movies.';
    }
  };

  apiKeyInput?.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      loadMovies();
    }
  });
  apiKeyInput?.addEventListener('change', loadMovies);
  saveBtn?.addEventListener('click', loadMovies);

  await loadMovies();
}

if (typeof window !== 'undefined') {
  window.initMoviesPanel = initMoviesPanel;
}

