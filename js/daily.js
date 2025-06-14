import { loadDecisions, saveDecisions, generateId } from './helpers.js';

['dragstart', 'dragend', 'dragenter', 'dragleave', 'dragover', 'drop'].forEach(evt =>
  document.addEventListener(evt, e => {
    console.log(`📦 Global ${evt} on`, e.target);
  }, true)
);

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
    .map(task => {
      const isDismissed = todayCompleted.includes(task.id);
      return { task, isDismissed };
    });

  const active = dailyTasks.filter(t => !t.isDismissed);
  const completed = dailyTasks.filter(t => t.isDismissed);

  const taskList = document.createElement('div');
  taskList.id = 'taskList';
  taskList.style.display = 'flex';
  taskList.style.flexDirection = 'column';
  taskList.style.gap = '6px';
  container.appendChild(taskList);

  taskList.addEventListener('dragover', e => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  });

  taskList.addEventListener('drop', e => {
    e.preventDefault();
    console.log('🔽 Drop event on taskList');
  });

  for (const { task, isDismissed } of [...active, ...completed]) {
    const wrapper = document.createElement('div');
    wrapper.className = 'daily-task-wrapper';
    wrapper.dataset.taskId = task.id;
    wrapper.setAttribute('draggable', 'true'); // ✅ DRAGGABLE HERE

    const row = document.createElement('div');
    row.className = 'daily-task';
    row.style.display = 'grid';
    row.style.gridTemplateColumns = '20px 24px 1fr auto';
    row.style.alignItems = 'center';
    row.style.columnGap = '10px';
    row.style.padding = '6px 12px';
    row.style.borderRadius = '8px';
    row.style.background = '#fffaf0';
    row.style.borderLeft = '4px solid #ffbb55';
    row.style.marginBottom = '6px';
    row.style.opacity = isDismissed ? '0.6' : '1';

    const dragHandle = document.createElement('div');
    dragHandle.innerHTML = '⋮⋮';
    dragHandle.style.cursor = 'grab';
    dragHandle.style.color = '#999';
    dragHandle.style.fontSize = '12px';
    dragHandle.style.fontWeight = 'bold';
    dragHandle.style.textAlign = 'center';
    dragHandle.style.userSelect = 'none';
    dragHandle.style.lineHeight = '1';
    dragHandle.title = 'Drag to reorder';

    // ✅ DRAG EVENTS on WRAPPER now
    wrapper.addEventListener('dragstart', e => {
      wrapper.classList.add('dragging');
      dragHandle.style.cursor = 'grabbing';
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', task.id);
      console.log('🎯 dragstart:', task.id);
    });

    wrapper.addEventListener('dragend', async () => {
      wrapper.classList.remove('dragging');
      dragHandle.style.cursor = 'grab';
      document.querySelectorAll('.daily-task-wrapper').forEach(w => {
        w.style.borderTop = '';
      });
      const newOrder = [...taskList.children].map(el => el.dataset.taskId);
      const reordered = newOrder.map(id => all.find(t => t.id === id)).filter(Boolean);
      const others = all.filter(t => !newOrder.includes(t.id));
      await saveDecisions([...others, ...reordered]);
      console.log('💾 dragend: saved new order', newOrder);
    });

    wrapper.addEventListener('dragover', e => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      const dragging = document.querySelector('.dragging');
      if (!dragging || dragging === wrapper) return;

      const rect = wrapper.getBoundingClientRect();
      const midpoint = rect.top + rect.height / 2;

      if (e.clientY < midpoint) {
        taskList.insertBefore(dragging, wrapper);
      } else {
        taskList.insertBefore(dragging, wrapper.nextSibling);
      }

      console.log('➡️ dragover on', task.id);
    });

    wrapper.addEventListener('dragenter', () => {
      const dragging = document.querySelector('.dragging');
      if (dragging && dragging !== wrapper) {
        wrapper.style.borderTop = '2px solid #4CAF50';
      }
    });

    wrapper.addEventListener('dragleave', () => {
      wrapper.style.borderTop = '';
    });

    console.log('Wrapper:', wrapper, 'Parent:', wrapper.parentElement);

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = isDismissed;
    checkbox.style.margin = '0';

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

    const buttonWrap = document.createElement('div');
    buttonWrap.style.display = 'flex';
    buttonWrap.style.gap = '8px';
    buttonWrap.style.justifyContent = 'flex-end';

    const makeIconButton = (emoji, title, color) => {
      const btn = document.createElement('button');
      btn.innerHTML = emoji;
      btn.title = title;
      btn.style.background = 'none';
      btn.style.border = 'none';
      btn.style.cursor = 'pointer';
      btn.style.fontSize = '1.1em';
      btn.style.padding = '0';
      btn.style.color = color;
      btn.style.lineHeight = '1';
      return btn;
    };

    const editBtn = makeIconButton('✏️', 'Edit task', '#444');
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

    const skipBtn = makeIconButton('⏭️', 'Skip today', '#888');
    skipBtn.onclick = async () => {
      const updated = completionMap[todayKey] || [];
      if (!updated.includes(task.id)) updated.push(task.id);
      await db.collection('taskCompletions').doc(currentUser.uid).set({
        ...completionMap,
        [todayKey]: updated
      });
      renderDailyTasks(currentUser, db);
    };

    const deleteBtn = makeIconButton('❌', 'Delete task', '#c44');
    deleteBtn.onclick = async () => {
      if (!confirm(`Delete task: "${task.text.replace(/^\[Daily\]\s*/, '')}"?`)) return;
      const updated = all.filter(t => t.id !== task.id);
      await saveDecisions(updated);
      renderDailyTasks(currentUser, db);
    };

    buttonWrap.append(editBtn, skipBtn, deleteBtn);
    row.append(dragHandle, checkbox, text, buttonWrap);
    wrapper.appendChild(row);
    taskList.appendChild(wrapper);
  }
}
