export async function initMoviesPanel() {
  const listEl = document.getElementById('movieList');
  if (!listEl) return;
  listEl.innerHTML = '<em>Loading...</em>';
  try {
    const res = await fetch('https://raw.githubusercontent.com/prust/wikipedia-movie-data/master/movies.json');
    if (!res.ok) throw new Error('Network response was not ok');
    const movies = await res.json();
    if (!Array.isArray(movies) || movies.length === 0) {
      listEl.textContent = 'No movies found.';
      return;
    }

    // Sort movies by year (most recent first) and take the first 100
    const recent = movies
      .filter(m => typeof m.year === 'number')
      .sort((a, b) => b.year - a.year)
      .slice(0, 100);

    const ul = document.createElement('ul');
    recent.forEach(m => {
      const li = document.createElement('li');

      // Title with optional link
      if (m.title) {
        const titleEl = document.createElement('strong');
        if (m.href) {
          const a = document.createElement('a');
          a.textContent = `${m.title} (${m.year})`;
          a.href = m.href;
          a.target = '_blank';
          titleEl.appendChild(a);
        } else {
          titleEl.textContent = `${m.title} (${m.year})`;
        }
        li.appendChild(titleEl);
      }

      // Display all metadata fields
      const metaList = document.createElement('ul');
      for (const [key, value] of Object.entries(m)) {
        if (key === 'title') continue; // title already shown
        const metaItem = document.createElement('li');
        if (key === 'href' && value) {
          const a = document.createElement('a');
          a.href = value;
          a.target = '_blank';
          a.textContent = value;
          metaItem.append(`${key}: `);
          metaItem.appendChild(a);
        } else {
          const text = Array.isArray(value) ? value.join(', ') : value;
          metaItem.textContent = `${key}: ${text}`;
        }
        metaList.appendChild(metaItem);
      }
      li.appendChild(metaList);

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
