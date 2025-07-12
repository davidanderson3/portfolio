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
        li.textContent = out.text;
        if (Array.isArray(out.nextSteps) && out.nextSteps.length) {
          const stepsUl = document.createElement('ul');
          out.nextSteps.forEach(step => {
            const stepLi = document.createElement('li');
            stepLi.textContent = step;
            stepsUl.appendChild(stepLi);
          });
          li.appendChild(stepsUl);
        }
        ul.appendChild(li);
      });
      card.appendChild(ul);
    }


    container.appendChild(card);
  });
}
