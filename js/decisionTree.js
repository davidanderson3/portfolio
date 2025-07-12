import { loadDecisions, generateId, saveDecisions } from './helpers.js';
import { renderGoalsAndSubitems } from './goals.js';
import { renderDecisionList } from './decisionList.js';

export async function initDecisionsPanel() {
  const panel = document.getElementById('decisionsPanel');
  if (!panel) return;

  panel.innerHTML = `
    <button id="addDecisionBtn">+ Add Decision</button>
    <div id="decisionList" style="margin:12px 0;"></div>
    <h2>Decision Tree</h2>
    <div id="decisionTree" class="tree"></div>`;

  const addBtn = panel.querySelector('#addDecisionBtn');
  addBtn.onclick = async () => {
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
      parentGoalId: null,
      hiddenUntil: null,
      scheduled: '',
      outcomes,
      considerations: cons.trim()
    };
    await saveDecisions([...items, newDecision]);
    await renderGoalsAndSubitems();
    initDecisionsPanel();
  };

  const allItems = await loadDecisions();
  const items = allItems.filter(it => Array.isArray(it.outcomes));
  const listContainer = panel.querySelector('#decisionList');
  renderDecisionList(items, listContainer);

  const treeContainer = panel.querySelector('#decisionTree');
  treeContainer.innerHTML = '';

  function buildTree(parentId) {
    const ul = document.createElement('ul');
    const children = items.filter(d => d.parentGoalId === parentId);
    children.forEach(dec => {
      const li = document.createElement('li');
      const card = document.createElement('div');
      card.className = 'decision-card';
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
        dec.outcomes.forEach(o => {
          const liOut = document.createElement('li');
          liOut.textContent = o.text;
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
