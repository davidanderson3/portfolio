export async function initMoviesPanel() {
  const listEl = document.getElementById('movieList');
  if (!listEl) return;
  listEl.innerHTML = '<em>Loading...</em>';
  try {
    const res = await fetch('https://raw.githubusercontent.com/sundeepblue/movie_rating_prediction/master/movie_metadata.csv');
    if (!res.ok) throw new Error('Network response was not ok');
    const text = await res.text();
    const movies = parseCSV(text)
      .filter(m => m.movie_title)
      .sort((a, b) => (parseInt(b.num_user_for_reviews || '0') - parseInt(a.num_user_for_reviews || '0')))
      .slice(0, 100);
    if (movies.length === 0) {
      listEl.textContent = 'No movies found.';
      return;
    }

    const ul = document.createElement('ul');
    movies.forEach(m => {
      const li = document.createElement('li');
      const title = (m.movie_title || '').trim();
      const year = m.title_year || 'Unknown';
      const titleEl = document.createElement('strong');
      titleEl.textContent = `${title} (${year})`;
      li.appendChild(titleEl);

      const metaList = document.createElement('ul');
      const imdb = m.imdb_score;
      const critic = m.num_critic_for_reviews;
      const user = m.num_user_for_reviews;
      if (imdb) {
        const mi = document.createElement('li');
        mi.textContent = `IMDB score: ${imdb}`;
        metaList.appendChild(mi);
      }
      if (critic) {
        const mi = document.createElement('li');
        mi.textContent = `Critic reviews: ${critic}`;
        metaList.appendChild(mi);
      }
      if (user) {
        const mi = document.createElement('li');
        mi.textContent = `User reviews: ${user}`;
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

function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/);
  const headers = lines[0].split(',');
  return lines.slice(1).map(line => {
    const values = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        values.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current);
    const obj = {};
    headers.forEach((h, idx) => {
      obj[h] = values[idx] || '';
    });
    return obj;
  });
}

if (typeof window !== 'undefined') {
  window.initMoviesPanel = initMoviesPanel;
}
