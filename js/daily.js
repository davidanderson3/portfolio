import { loadDecisions, saveDecisions, generateId } from './helpers.js';

export async function renderDailyTasks(currentUser, db) {
  const container = document.getElementById('dailyTasksList');
  if (!container || !currentUser) return;

  container.innerHTML = '';

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
    renderDailyTasks(currentUser, db);
  };

  addForm.appendChild(input);
  addForm.appendChild(button);
  container.appendChild(addForm);

  const all = await loadDecisions();
  const todayKey = new Date().toLocaleDateString('en-CA');

  const completionSnap = await db.collection('taskCompletions').doc(currentUser.uid).get();
  const completionMap = completionSnap.exists ? completionSnap.data() : {};
  const todayCompleted = completionMap[todayKey] || [];

  const dailyTasks = all
    .filter(t => t.type === 'task' && t.text.startsWith('[Daily]'))
    .map(task => ({
      task,
      isDismissed: todayCompleted.includes(task.id)
    }));

  const dailyIds = dailyTasks.map(d => d.task.id);
  const others = all.filter(t => !dailyIds.includes(t.id));

  const active = dailyTasks.filter(t => !t.isDismissed);
  const completed = dailyTasks.filter(t => t.isDismissed);

  for (const { task, isDismissed } of [...active, ...completed]) {
    const wrapper = document.createElement('div');
    wrapper.className = 'daily-task-wrapper';
    wrapper.setAttribute('draggable', 'true');
    wrapper.dataset.taskId = task.id;
    wrapper.style.pointerEvents = 'auto';
    wrapper.style.userSelect = 'none';
    wrapper.style.touchAction = 'auto';
    wrapper.style.minHeight = '40px';
    wrapper.style.background = '#eef';
    wrapper.style.zIndex = '9999';
    wrapper.style.position = 'relative';

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
    row.style.pointerEvents = 'auto';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = isDismissed;
    checkbox.style.margin = '0';

    const text = document.createElement('div');
    text.textContent = task.text.replace(/^\[Daily\]\s*/, '');
    text.style.whiteSpace = 'nowrap';
    text.style.overflow = 'hidden';
    text.style.textOverflow = 'ellipsis';
    text.contentEditable = false;
    if (isDismissed) {
      text.style.textDecoration = 'line-through';
      text.style.color = '#777';
    }

    const buttonWrap = document.createElement('div');
    buttonWrap.style.display = 'flex';
    buttonWrap.style.gap = '8px';
    buttonWrap.style.justifyContent = 'flex-end';

    const editBtn = document.createElement('button');
    editBtn.innerHTML = '✏️';
    editBtn.title = 'Edit task';
    editBtn.style.cssText = 'background:none;border:none;cursor:pointer;font-size:1.1em;padding:0;color:#444;';
    editBtn.onclick = async () => {
      const originalText = task.text.replace(/^\[Daily\]\s*/, '');
      const newText = prompt('Edit task:', originalText);
      if (newText && newText.trim() !== originalText) {
        const updated = all.map(t =>
          t.id === task.id ? { ...t, text: `[Daily] ${newText.trim()}` } : t
        );
        await saveDecisions(updated);
        renderDailyTasks(currentUser, db);
      }
    };

    const skipBtn = document.createElement('button');
    skipBtn.innerHTML = '⏭️';
    skipBtn.title = 'Skip today';
    skipBtn.style.cssText = 'background:none;border:none;cursor:pointer;font-size:1.1em;padding:0;color:#888;';
    skipBtn.onclick = async () => {
      const updated = completionMap[todayKey] || [];
      if (!updated.includes(task.id)) updated.push(task.id);
      await db.collection('taskCompletions').doc(currentUser.uid).set({
        ...completionMap,
        [todayKey]: updated
      });
      renderDailyTasks(currentUser, db);
    };

    const deleteBtn = document.createElement('button');
    deleteBtn.innerHTML = '❌';
    deleteBtn.title = 'Delete task';
    deleteBtn.style.cssText = 'background:none;border:none;cursor:pointer;font-size:1.1em;padding:0;color:#c44;';
    deleteBtn.onclick = async () => {
      if (!confirm(`Delete task: "${task.text.replace(/^\[Daily\]\s*/, '')}"?`)) return;
      const updated = all.filter(t => t.id !== task.id);
      await saveDecisions(updated);
      renderDailyTasks(currentUser, db);
    };

    checkbox.onchange = async () => {
      let updated = completionMap[todayKey] || [];
      if (checkbox.checked && !updated.includes(task.id)) {
        updated.push(task.id);
      } else if (!checkbox.checked) {
        updated = updated.filter(id => id !== task.id);
      }
      await db.collection('taskCompletions').doc(currentUser.uid).set({
        ...completionMap,
        [todayKey]: updated
      });
      renderDailyTasks(currentUser, db);
    };

    buttonWrap.appendChild(editBtn);
    buttonWrap.appendChild(skipBtn);
    buttonWrap.appendChild(deleteBtn);

    row.appendChild(checkbox);
    row.appendChild(text);
    row.appendChild(buttonWrap);
    wrapper.appendChild(row);
    container.appendChild(wrapper);

    // DRAG-AND-DROP HANDLERS

    wrapper.addEventListener('dragstart', e => {
      e.dataTransfer.setData('text/plain', task.id);
      const ghost = document.createElement('img');
      ghost.src = 'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=';
      ghost.style.width = '1px';
      ghost.style.height = '1px';
      e.dataTransfer.setDragImage(ghost, 0, 0);
    });

    wrapper.addEventListener('dragover', e => {
      e.preventDefault();
      wrapper.classList.add('daily-drag-over');
    });

    wrapper.addEventListener('dragleave', () => {
      wrapper.classList.remove('daily-drag-over');
    });

    wrapper.addEventListener('dragend', () => {
      wrapper.classList.remove('daily-drag-over');
    });

    wrapper.addEventListener('drop', async e => {
      e.preventDefault();
      wrapper.classList.remove('daily-drag-over');

      const droppedId = e.dataTransfer.getData('text/plain');
      if (!droppedId || droppedId === task.id) return;

      const wrappers = [...container.querySelectorAll('.daily-task-wrapper')];
      const draggedEl = wrappers.find(el => el.dataset.taskId === droppedId);
      if (!draggedEl || draggedEl === wrapper) return;

      const fromIdx = wrappers.indexOf(draggedEl);
      const toIdx = wrappers.indexOf(wrapper);
      if (fromIdx < toIdx) {
        container.insertBefore(draggedEl, wrapper.nextSibling);
      } else {
        container.insertBefore(draggedEl, wrapper);
      }

      const newOrder = [...container.querySelectorAll('.daily-task-wrapper')]
        .map(el => el.dataset.taskId);
      const reordered = newOrder
        .map(id => dailyTasks.find(d => d.task.id === id)?.task)
        .filter(Boolean);

      await saveDecisions([...others, ...reordered]);
    });
  }
}
