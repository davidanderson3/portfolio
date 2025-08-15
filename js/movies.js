export async function initMoviesPanel() {
  const listEl = document.getElementById('movieList');
  if (!listEl) return;
  listEl.innerHTML = '<em>Loading...</em>';
  try {
    const res = await fetch('/api/movies');
    if (!res.ok) throw new Error('Network response was not ok');
    const movies = await res.json();
    if (!Array.isArray(movies) || movies.length === 0) {
      listEl.textContent = 'No movies found.';
      return;
    }
    const ul = document.createElement('ul');
    movies.forEach(m => {
      const li = document.createElement('li');
      const a = document.createElement('a');
      a.textContent = `${m.title} - ${m.score}% (${m.reviews} reviews)`;
      if (m.url) {
        a.href = m.url;
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

window.initMoviesPanel = initMoviesPanel;
