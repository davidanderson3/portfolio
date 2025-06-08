import { loadDecisions, saveDecisions, generateId } from './helpers.js';

export async function renderDailyTasks() {
  const container = document.getElementById('dailyTasksList');
  if (!container) return;
  container.innerHTML = '';

  // Add task input
  const addForm = document.createElement('div');
  addForm.style.display = 'flex';
  addForm.style.marginBottom = '12px';
  addForm.style.gap = '8px';

  const input = document.createElement('input');
  input.type = 'text';
  input.placeholder = 'New daily task...';
  input.style.flex = '1';
  input.style.padding = '6px';
  input.style.borderRadius = '6px';
  input.style.border = '1px solid #ccc';

  const button = document.createElement('button');
  button.textContent = '+';
  button.style.padding = '0px 14px';
  button.style.margin = '8px 0px 12px';
  button.style.borderRadius = '6px';
  button.style.fontWeight = 'bold';

  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      e.preventDefault();
      button.click();
    }
  });

  button.onclick = async () => {
    const text = input.value.trim();
    if (!text) return;

    const all = await loadDecisions();
    all.push({
      id: generateId(),
      type: 'task',
      text: `[Daily] ${text}`,
      parentGoalId: null,
      completed: false,
      dateCompleted: '',
      resolution: '',
      dependencies: [],
    });
    await saveDecisions(all);
    input.value = '';
    renderDailyTasks();
  };

  addForm.appendChild(input);
  addForm.appendChild(button);
  container.appendChild(addForm);

  // Load and sort tasks
  const all = await loadDecisions();

  const now = new Date();
  const todayReset = new Date();
  todayReset.setHours(6, 0, 0, 0);
  if (now < todayReset) todayReset.setDate(todayReset.getDate() - 1);
  const todayKey = todayReset.toISOString().split('T')[0];

  const dismissed = JSON.parse(localStorage.getItem('dismissedDailyTasks') || '{}');
  const todayDismissed = dismissed[todayKey] || [];

  const dailyTasks = all
    .filter(t => t.type === 'task' && t.text.startsWith('[Daily]'))
    .map(task => {
      const isDismissed = todayDismissed.includes(task.id);
      return { task, isDismissed };
    });

  const active = dailyTasks.filter(t => !t.isDismissed);
  const completed = dailyTasks.filter(t => t.isDismissed);

[...active, ...completed].forEach(({ task, isDismissed }) => {
  const row = document.createElement('div');
  row.className = 'daily-task';
  row.style.display = 'grid';
  row.style.gridTemplateColumns = '24px 1fr auto';
  row.style.alignItems = 'center';
  row.style.columnGap = '10px';
  row.style.padding = '6px 12px';
  row.style.borderRadius = '8px';
  row.style.background = '#fffaf0';
  row.style.borderLeft = '4px solid #ffbb55';
  row.style.marginBottom = '6px';
  row.style.opacity = isDismissed ? '0.6' : '1';

  // Checkbox
  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.checked = isDismissed;
  checkbox.style.margin = '0';

  // Text
  const text = document.createElement('div');
  text.textContent = task.text.replace(/^\[Daily\]\s*/, '');
  text.style.textAlign = 'left';
  text.style.lineHeight = '1.4';
  text.style.whiteSpace = 'nowrap';
  text.style.overflow = 'hidden';
  text.style.textOverflow = 'ellipsis';

  if (isDismissed) {
    text.style.textDecoration = 'line-through';
    text.style.color = '#777';
  }

  // Button container
  const buttonWrap = document.createElement('div');
  buttonWrap.style.display = 'flex';
  buttonWrap.style.gap = '8px';
  buttonWrap.style.justifyContent = 'flex-end';

  // Skip button
  const skipBtn = document.createElement('button');
  skipBtn.innerHTML = '⏭️';
  skipBtn.title = 'Skip today';
  skipBtn.style.background = 'none';
  skipBtn.style.border = 'none';
  skipBtn.style.cursor = 'pointer';
  skipBtn.style.fontSize = '1.1em';
  skipBtn.style.padding = '0';
  skipBtn.style.color = '#888';
  skipBtn.style.lineHeight = '1';

  skipBtn.onclick = () => {
    const updatedDismissed = JSON.parse(localStorage.getItem('dismissedDailyTasks') || '{}');
    const current = updatedDismissed[todayKey] || [];
    if (!current.includes(task.id)) current.push(task.id);
    updatedDismissed[todayKey] = current;
    localStorage.setItem('dismissedDailyTasks', JSON.stringify(updatedDismissed));
    renderDailyTasks();
  };

  // Delete button
  const deleteBtn = document.createElement('button');
  deleteBtn.innerHTML = '❌';
  deleteBtn.title = 'Delete task';
  deleteBtn.style.background = 'none';
  deleteBtn.style.border = 'none';
  deleteBtn.style.cursor = 'pointer';
  deleteBtn.style.fontSize = '1.1em';
  deleteBtn.style.padding = '0';
  deleteBtn.style.color = '#c44';
  deleteBtn.style.lineHeight = '1';

  deleteBtn.onclick = async () => {
    if (!confirm(`Delete task: "${task.text.replace(/^\[Daily\]\s*/, '')}"?`)) return;
    const updated = all.filter(t => t.id !== task.id);
    await saveDecisions(updated);
    renderDailyTasks();
  };

  // Checkbox handler
  checkbox.onchange = () => {
    const updatedDismissed = JSON.parse(localStorage.getItem('dismissedDailyTasks') || '{}');
    let current = updatedDismissed[todayKey] || [];

    if (checkbox.checked && !current.includes(task.id)) {
      current.push(task.id);
    } else if (!checkbox.checked) {
      current = current.filter(id => id !== task.id);
    }

    updatedDismissed[todayKey] = current;
    localStorage.setItem('dismissedDailyTasks', JSON.stringify(updatedDismissed));
    renderDailyTasks();
  };

  buttonWrap.appendChild(skipBtn);
  buttonWrap.appendChild(deleteBtn);

  row.appendChild(checkbox);
  row.appendChild(text);
  row.appendChild(buttonWrap);
  container.appendChild(row);
});



}
