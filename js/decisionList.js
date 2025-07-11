export function renderDecisionList(items, container) {
  if (!container) return;
  container.innerHTML = '';
  const decisions = items.filter(it => Array.isArray(it.outcomes));
  decisions.forEach(dec => {
    const card = document.createElement('div');
    card.className = 'decision-card';

    const title = document.createElement('div');
    title.className = 'decision-title';
    title.textContent = dec.text;
    card.appendChild(title);

    if (dec.considerations) {
      const cons = document.createElement('div');
      cons.className = 'decision-considerations';
      cons.textContent = dec.considerations;
      card.appendChild(cons);
    }

    if (dec.outcomes.length) {
      const outHeader = document.createElement('div');
      outHeader.className = 'decision-section';
      outHeader.textContent = 'Outcomes:';
      card.appendChild(outHeader);
      const ul = document.createElement('ul');
      dec.outcomes.forEach(out => {
        const li = document.createElement('li');
        li.textContent = out;
        ul.appendChild(li);
      });
      card.appendChild(ul);
    }

    if (dec.nextSteps && dec.nextSteps.length) {
      const nsHeader = document.createElement('div');
      nsHeader.className = 'decision-section';
      nsHeader.textContent = 'Next Steps:';
      card.appendChild(nsHeader);
      const ulNs = document.createElement('ul');
      dec.nextSteps.forEach(ns => {
        const liNs = document.createElement('li');
        liNs.textContent = ns;
        ulNs.appendChild(liNs);
      });
      card.appendChild(ulNs);
    }

    container.appendChild(card);
  });
}
