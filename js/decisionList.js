export function renderDecisionList(items, container) {
  if (!container) return;
  container.innerHTML = '';
  const decisions = items.filter(it => Array.isArray(it.outcomes));
  decisions.forEach(dec => {
    const card = document.createElement('div');
    const title = document.createElement('div');
    title.textContent = dec.text;
    card.appendChild(title);
    if (dec.outcomes.length) {
      const ul = document.createElement('ul');
      dec.outcomes.forEach(out => {
        const li = document.createElement('li');
        li.textContent = out;
        ul.appendChild(li);
      });
      card.appendChild(ul);
    }
    container.appendChild(card);
  });
}
