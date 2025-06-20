import { loadDecisions, saveDecisions, generateId } from './helpers.js';

export async function renderDailyTasks(currentUser, db) {
  const container = document.getElementById('dailyTasksList');
  if (!container || !currentUser) return;

  // Inject CSS once to remove any green focus/active backgrounds on buttons
  if (!document.getElementById('dailyTasks-btn-reset-css')) {
    const style = document.createElement('style');
    style.id = 'dailyTasks-btn-reset-css';
    style.textContent = `
      /* remove green focus/highlight */
      .daily-task-wrapper button:focus,
      .daily-task-wrapper button:active {
        background: none !important;
        outline: none !important;
      }
      /* flash animation */
      @keyframes flash {
        0%   { background-color: #ffff99; }
        100% { background-color: #eef; }
      }
      .flash {
        animation: flash 1s ease-out;
      }
    `;
    document.head.appendChild(style);
  }

  container.innerHTML = '';
  const all = await loadDecisions();

  // Migrate legacy daily flags
  let migrated = false;
  for (const t of all) {
    if (t.type === 'task' && t.text.startsWith('[Daily]') && !t.recurs) {
      t.recurs = 'daily';
      migrated = true;
    }
  }
  if (migrated) {
    try { await saveDecisions(all); }
    catch (err) { console.error(err); alert('⚠️ Failed to migrate old tasks.'); }
  }

  // Add-new form
  const addForm = document.createElement('div');
  addForm.style = 'display:flex;gap:8px;margin-bottom:12px';
  const input = document.createElement('input');
  Object.assign(input, { type: 'text', placeholder: 'New daily task…' });
  Object.assign(input.style, { flex: '1', padding: '6px', borderRadius: '6px', border: '1px solid #ccc' });
  const addBtn = document.createElement('button');
  addBtn.textContent = '+';
  Object.assign(addBtn.style, { padding: '0 14px', borderRadius: '6px', fontWeight: 'bold', background: 'none', border: 'none' });
  input.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); addBtn.click(); } });
  addBtn.onclick = async () => {
    const text = input.value.trim();
    if (!text) return;
    const newTask = {
      id: generateId(),
      type: 'task',
      text: `[Daily] ${text}`,
      recurs: 'daily',
      parentGoalId: null,
      completed: false,
      dateCompleted: '',
      resolution: '',
      dependencies: [],
      skipUntil: null
    };
    try {
      const updated = [...await loadDecisions(), newTask];
      await saveDecisions(updated);
      input.value = '';
      const wrapper = makeTaskElement(newTask);
      wrapper.classList.add('flash');
      wrapper.addEventListener('animationend', () => wrapper.classList.remove('flash'), { once: true });
      container.insertBefore(wrapper, addForm.nextSibling);
    } catch (err) {
      console.error(err);
      alert('⚠️ Could not add task.');
    }
  };
  addForm.append(input, addBtn);
  container.appendChild(addForm);

  // Load completions
  const todayKey = new Date().toLocaleDateString('en-CA');
  const snap = await db.collection('taskCompletions').doc(currentUser.uid).get();
  const completionMap = snap.exists ? snap.data() : {};
  const doneSet = new Set(completionMap[todayKey] || []);

  // Prepare lists: hide postponed tasks until tomorrow
  const nowMs = Date.now();
  const dailyAll = all.filter(t =>
    t.type === 'task' &&
    t.recurs === 'daily' &&
    (!t.skipUntil || nowMs >= new Date(t.skipUntil).getTime())
  );
  const activeList = dailyAll.filter(t => !doneSet.has(t.id));
  const doneList   = dailyAll.filter(t =>  doneSet.has(t.id));

  // Render actives then done
  for (const t of activeList) container.appendChild(makeTaskElement(t));
  for (const t of doneList)   container.appendChild(makeTaskElement(t));

  // ——— Helpers —————————————————————————
  function makeTaskElement(task) {
    const isDone = doneSet.has(task.id);
    const wrapper = document.createElement('div');
    wrapper.className = 'daily-task-wrapper';
    wrapper.draggable = true;
    wrapper.dataset.taskId = task.id;
    Object.assign(wrapper.style, { pointerEvents: 'auto', userSelect: 'none', touchAction: 'auto', minHeight: '40px', background: '#eef', position: 'relative', zIndex: '1' });

    const row = document.createElement('div');
    row.className = 'daily-task';
    Object.assign(row.style, { display: 'grid', gridTemplateColumns: '24px 1fr auto', alignItems: 'center', columnGap: '10px', padding: '6px 12px', borderRadius: '8px', background: '#fffaf0', borderLeft: '4px solid #ffbb55', marginBottom: '6px', opacity: isDone ? '0.6' : '1' });

    // Checkbox
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = isDone;
    cb.addEventListener('change', async () => {
      try {
        const copy = { ...completionMap };
        copy[todayKey] = copy[todayKey] || [];
        if (cb.checked) { copy[todayKey].push(task.id); doneSet.add(task.id); }
        else { copy[todayKey] = copy[todayKey].filter(id => id !== task.id); doneSet.delete(task.id); }
        await db.collection('taskCompletions').doc(currentUser.uid).set(copy);
        wrapper.remove();
        // reposition logic…
      } catch (err) {
        console.error(err);
        alert('⚠️ Could not update completion. Reverting.');
        cb.checked = !cb.checked;
      }
    });

    // Label
    const label = document.createElement('div');
    label.textContent = task.text.replace(/^\[Daily\]\s*/, '');
    if (isDone) Object.assign(label.style, { textDecoration: 'line-through', color: '#777' });
    Object.assign(label.style, { whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' });

    // Buttons
    const btns = document.createElement('div'); btns.style.display = 'flex'; btns.style.gap = '8px';
    const up   = makeIconBtn('⬆️','Move up',async()=>{/*…*/});
    const edit = makeIconBtn('✏️','Edit',async()=>{/*…*/});
    const skip = makeIconBtn('⏭️','Skip today',async()=>{
      try {
        const updated = await loadDecisions();
        const idx = updated.findIndex(t => t.id === task.id);
        if (idx === -1) return;
        const skipDate = new Date(); skipDate.setDate(skipDate.getDate() + 1);
        updated[idx].skipUntil = skipDate.toISOString();
        await saveDecisions(updated);
        wrapper.remove();
      } catch { alert('⚠️ Could not skip task.'); }
    });
    const del  = makeIconBtn('❌','Delete',async()=>{/*…*/});
    btns.append(up, edit, skip, del);

    row.append(cb, label, btns);
    wrapper.appendChild(row);
    return wrapper;
  }

  function makeIconBtn(symbol, title, fn) {
    const b = document.createElement('button'); b.type='button'; b.textContent=symbol; b.title=title;
    Object.assign(b.style,{background:'none',border:'none',cursor:'pointer',fontSize:'1.1em',padding:'0'});
    b.onclick = fn; return b;
  }

  async function persistReorder() {
    const wrappers = Array.from(container.querySelectorAll('.daily-task-wrapper')).slice(1);
    const ids = wrappers.map(w => w.dataset.taskId);
    const others = all.filter(t => !ids.includes(t.id));
    const reordered = ids.map(id => all.find(t=>t.id===id)).filter(Boolean);
    try { await saveDecisions([...others, ...reordered]); }
    catch { alert('⚠️ Could not save new order.'); }
  }
}
