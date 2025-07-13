import { loadDecisions, generateId, saveDecisions, makeIconBtn } from './helpers.js';
import { renderGoalsAndSubitems } from './goals.js';

async function editDecision(decId) {
  const items = await loadDecisions();
  const idx = items.findIndex(d => d.id === decId);
  if (idx === -1) return;
  const dec = items[idx];
  const newText = prompt('Decision:', dec.text);
  if (newText === null) return;
  const newCons = prompt('Considerations (optional):', dec.considerations || '');
  if (newCons === null) return;
  items[idx].text = newText.trim();
  items[idx].considerations = newCons.trim();
  await saveDecisions(items);
  await renderGoalsAndSubitems();
  initDecisionsPanel();
}

async function deleteDecision(decId) {
  if (!confirm('Delete this decision and all sub-decisions?')) return;
  let items = await loadDecisions();
  const idsToRemove = new Set();
  const gather = id => {
    idsToRemove.add(id);
    items.forEach(it => {
      if (it.parentGoalId === id) gather(it.id);
    });
  };
  gather(decId);
  items = items.filter(it => !idsToRemove.has(it.id));
  await saveDecisions(items);
  await renderGoalsAndSubitems();
  initDecisionsPanel();
}

async function editOutcome(decId, index) {
  const items = await loadDecisions();
  const dec = items.find(d => d.id === decId);
  if (!dec || !dec.outcomes[index]) return;
  const out = dec.outcomes[index];
  const newText = prompt('Outcome:', out.text);
  if (newText === null) return;
  const steps = prompt('Next steps (comma separated):', (out.nextSteps || []).join(', '));
  if (steps === null) return;
  dec.outcomes[index] = {
    text: newText.trim(),
    nextSteps: steps.split(',').map(s => s.trim()).filter(Boolean)
  };
  await saveDecisions(items);
  initDecisionsPanel();
}

async function deleteOutcome(decId, index) {
  if (!confirm('Delete this outcome?')) return;
  const items = await loadDecisions();
  const dec = items.find(d => d.id === decId);
  if (!dec) return;
  dec.outcomes.splice(index, 1);
  await saveDecisions(items);
  initDecisionsPanel();
}

export async function addDecision(parentId = null) {
  if (parentId === null) {
    parentId = prompt('Parent decision ID (optional):', '') || null;
    if (parentId) parentId = parentId.trim();
  }
  const text = prompt('Decision:');
  if (!text) return;
  const out = prompt('Outcomes (comma separated):', '') || '';
  const outcomeTexts = out.split(',').map(o => o.trim()).filter(Boolean);
  const cons = prompt('Considerations (optional):', '') || '';
  const outcomes = [];
  for (const oText of outcomeTexts) {
    const stepInput = prompt(`Next steps for "${oText}" (comma separated):`, '') || '';
    const steps = stepInput.split(',').map(s => s.trim()).filter(Boolean);
    outcomes.push({ text: oText, nextSteps: steps });
  }
  const items = await loadDecisions();
  const newDecision = {
    id: generateId(),
    type: 'goal',
    text: text.trim(),
    notes: '',
    completed: false,
    resolution: '',
    dateCompleted: '',
    parentGoalId: parentId,
    hiddenUntil: null,
    scheduled: '',
    outcomes,
    considerations: cons.trim()
  };
  await saveDecisions([...items, newDecision]);
  await renderGoalsAndSubitems();
  initDecisionsPanel();
}

export async function initDecisionsPanel() {
  const panel = document.getElementById('decisionsPanel');
  if (!panel) return;

  const treeContainer = panel.querySelector('#decisionTree');
  treeContainer.innerHTML = '';

  const allItems = await loadDecisions();
  const items = allItems.filter(it => Array.isArray(it.outcomes));

  function buildTree(parentId) {
    const ul = document.createElement('ul');
    const children = items.filter(d => d.parentGoalId === parentId);
    children.forEach(dec => {
      const li = document.createElement('li');
      const card = document.createElement('div');
      card.className = 'decision-card';

      const btnRow = document.createElement('div');
      btnRow.className = 'button-row';
      const editBtn = makeIconBtn('✏️', 'Edit decision', () => editDecision(dec.id));
      const delBtn = makeIconBtn('❌', 'Delete decision', () => deleteDecision(dec.id));
      btnRow.append(editBtn, delBtn);
      card.appendChild(btnRow);
      const title = document.createElement('div');
      title.className = 'decision-title';
      title.textContent = dec.text;
      card.appendChild(title);

      if (dec.considerations) {
        const conDiv = document.createElement('div');
        conDiv.className = 'decision-considerations';
        conDiv.textContent = dec.considerations;
        card.appendChild(conDiv);
      }

      if (dec.outcomes.length) {
        const outHeader = document.createElement('div');
        outHeader.className = 'decision-section';
        outHeader.textContent = 'Outcomes:';
        card.appendChild(outHeader);
        const ulOut = document.createElement('ul');
        dec.outcomes.forEach((o, idx) => {
          const liOut = document.createElement('li');
          const spanText = document.createElement('span');
          spanText.textContent = o.text;
          liOut.appendChild(spanText);

          const btns = document.createElement('span');
          btns.className = 'button-row';
          btns.style.marginLeft = '6px';
          btns.append(
            makeIconBtn('✏️', 'Edit outcome', () => editOutcome(dec.id, idx)),
            makeIconBtn('❌', 'Delete outcome', () => deleteOutcome(dec.id, idx))
          );
          liOut.appendChild(btns);

          if (Array.isArray(o.nextSteps) && o.nextSteps.length) {
            const stepsUl = document.createElement('ul');
            o.nextSteps.forEach(step => {
              const stepLi = document.createElement('li');
              stepLi.textContent = step;
              stepsUl.appendChild(stepLi);
            });
            liOut.appendChild(stepsUl);
          }
          ulOut.appendChild(liOut);
        });
        card.appendChild(ulOut);
      }

      li.appendChild(card);
      const childUl = buildTree(dec.id);
      if (childUl.children.length) li.appendChild(childUl);
      ul.appendChild(li);
    });
    return ul;
  }

  const tree = buildTree(null);
  treeContainer.appendChild(tree);
}

window.initDecisionsPanel = initDecisionsPanel;
window.addDecision = addDecision;
