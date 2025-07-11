import { loadDecisions, generateId, saveDecisions } from './helpers.js';
import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7?module';
import { renderGoalsAndSubitems } from './goals.js';
import { renderDecisionList } from './decisionList.js';

export async function initDecisionsPanel() {
  const panel = document.getElementById('decisionsPanel');
  if (!panel) return;

  panel.innerHTML = `
    <button id="addDecisionBtn">+ Add Decision</button>
    <div id="decisionList" style="margin:12px 0;"></div>
    <h2>Decision Tree</h2>
    <svg id="decisionSvg" width="100%" height="600"></svg>`;

  const addBtn = panel.querySelector('#addDecisionBtn');
  addBtn.onclick = async () => {
    const text = prompt('Decision:');
    if (!text) return;
    const out = prompt('Outcomes (comma separated):', '') || '';
    const outcomes = out.split(',').map(o => o.trim()).filter(Boolean);
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
      outcomes
    };
    await saveDecisions([...items, newDecision]);
    await renderGoalsAndSubitems();
    initDecisionsPanel();
  };

  const svg = d3.select('#decisionSvg');

  const items = await loadDecisions();
  const listContainer = panel.querySelector('#decisionList');
  renderDecisionList(items, listContainer);

  const nodeMap = new Map();
  items.forEach(it => {
    nodeMap.set(it.id, { id: it.id, name: it.text, children: [] });
  });

  const roots = [];
  items.forEach(it => {
    const node = nodeMap.get(it.id);
    if (it.parentGoalId && nodeMap.has(it.parentGoalId)) {
      nodeMap.get(it.parentGoalId).children.push(node);
    } else {
      roots.push(node);
    }
  });

  const root = { name: 'Decisions', children: roots };
  const hierarchy = d3.hierarchy(root);
  const treeLayout = d3.tree().nodeSize([24, 180]);
  treeLayout(hierarchy);

  let x0 = Infinity;
  let x1 = -Infinity;
  hierarchy.each(d => {
    if (d.x > x1) x1 = d.x;
    if (d.x < x0) x0 = d.x;
  });

  svg.attr('viewBox', [ -40, x0 - 24, 800, x1 - x0 + 48 ]);
  svg.selectAll('*').remove();
  const g = svg.append('g').attr('font-family', 'sans-serif').attr('font-size', 12);

  g.append('g')
    .selectAll('path')
    .data(hierarchy.links())
    .join('path')
    .attr('fill', 'none')
    .attr('stroke', '#555')
    .attr('d', d3.linkHorizontal().x(d => d.y).y(d => d.x));

  const node = g.append('g')
    .selectAll('g')
    .data(hierarchy.descendants())
    .join('g')
    .attr('transform', d => `translate(${d.y},${d.x})`);

  node.append('circle').attr('r', 4).attr('fill', '#999');
  node.append('text')
    .attr('dy', '0.31em')
    .attr('x', d => d.children ? -6 : 6)
    .attr('text-anchor', d => d.children ? 'end' : 'start')
    .text(d => d.data.name);

  const depLinks = [];
  items.forEach(it => {
    if (Array.isArray(it.dependencies)) {
      it.dependencies.forEach(depId => {
        const source = nodeMap.get(depId);
        const target = nodeMap.get(it.id);
        if (source && target) depLinks.push({ source, target });
      });
    }
  });
  g.append('g')
    .selectAll('path')
    .data(depLinks)
    .join('path')
    .attr('fill', 'none')
    .attr('stroke', '#d33')
    .attr('stroke-dasharray', '4 2')
    .attr('d', d => `M${d.source.y},${d.source.x}L${d.target.y},${d.target.x}`);
}

window.initDecisionsPanel = initDecisionsPanel;
