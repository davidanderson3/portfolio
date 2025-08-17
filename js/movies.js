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

    const ul = document.createElement('ul');
    movies.slice(0, 10).forEach(m => {
      const li = document.createElement('li');
      const a = document.createElement('a');
      a.textContent = `${m.title}${m.year ? ` (${m.year})` : ''}`;
      if (m.href) {
        a.href = m.href;
        a.target = '_blank';
      }
      li.appendChild(a);
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
