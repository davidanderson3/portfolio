import { loadLists, saveLists } from './helpers.js';
import { auth } from './auth.js';

let isScaffolded = false;
let listsArray = [];
let selectedListIndex = 0;
let persist;
// Track sort state for each list { [idx]: { colIdx:number, dir:1|-1 } }
const listSortStates = {};

auth.onAuthStateChanged(async () => {
  listsArray = await loadLists();
  persist = debounce(async () => saveLists(listsArray), 250);
  initListsPanel();
});

// 1️⃣ One-time scaffold build
function setupScaffolding(panel) {
  panel.innerHTML = '';
  panel.style.display = 'flex';
  panel.style.flexDirection = 'column';
  panel.style.width = '100%';
  panel.style.boxSizing = 'border-box';
  panel.style.padding = '0 1rem';

  const tabsContainer = document.createElement('div');
  tabsContainer.id = 'listTabs';
  tabsContainer.style.margin = '1rem 0';

  const addColumnBtn = document.createElement('button');
  addColumnBtn.type = 'button';
  addColumnBtn.id = 'addColumnToListBtn';
  addColumnBtn.textContent = '+ Add Column';
  addColumnBtn.style.alignSelf = 'flex-start';
  addColumnBtn.style.marginBottom = '1rem';
  addColumnBtn.addEventListener('click', onAddColumn);

  const listsContainer = document.createElement('div');
  listsContainer.id = 'listsContainer';

  const itemForm = document.createElement('div');
  itemForm.id = 'itemForm';
  itemForm.style.margin = '1rem 0';

  const createForm = document.createElement('div');
  createForm.id = 'listForm';
  createForm.innerHTML = `
    <h3>Create New List</h3>
    <label for="listName">List Name:</label>
    <input type="text" id="listName" placeholder="My List" style="margin-left:.5rem">
    <div id="columnsContainer" style="margin:.5rem 0"><label>Columns:</label></div>
    <button type="button" id="addColumnBtn">+ Column</button>
    <button type="button" id="createListBtn">Create List</button>
    <hr/>
  `;

  panel.append(tabsContainer, addColumnBtn, listsContainer, itemForm, createForm);
}

function addColumnInput() {
  const container = document.querySelector('#columnsContainer');

  const row = document.createElement('div');
  row.style.display = 'flex';
  row.style.alignItems = 'center';
  row.style.marginBottom = '0.5rem';

  const nameInp = document.createElement('input');
  nameInp.type = 'text';
  nameInp.placeholder = 'Column name';
  Object.assign(nameInp.style, { marginRight: '0.5rem', flex: '1' });
  row.append(nameInp);

  const typeSel = document.createElement('select');
  ['text', 'number', 'date', 'checkbox', 'link', 'list'].forEach(type => {
    const opt = document.createElement('option');
    opt.value = type;
    opt.textContent = type;
    typeSel.append(opt);
  });
  Object.assign(typeSel.style, { marginRight: '0.5rem' });
  row.append(typeSel);

  const rem = document.createElement('button');
  rem.type = 'button';
  rem.textContent = '❌';
  Object.assign(rem.style, { background: 'none', border: 'none', cursor: 'pointer' });
  rem.addEventListener('click', () => row.remove());
  row.append(rem);

  container.append(row);
}

// 3️⃣ Simple debounce helper to batch saves
function debounce(fn, delay) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

function getSortValue(item, col, colIdx) {
  if (colIdx === 0) {
    return (item[col.name + '_label'] || item[col.name] || '').toString().toLowerCase();
  }
  const val = item[col.name];
  switch (col.type) {
    case 'number':
      return Number(val) || 0;
    case 'date':
      return new Date(val || 0).getTime();
    case 'checkbox':
      return val ? 1 : 0;
    default:
      return (val || '').toString().toLowerCase();
  }
}


function initListTabs() {
  const buttons = document.querySelectorAll('.tab-button');
  const panels = document.querySelectorAll('.main-layout');
  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
      panels.forEach(p => p.style.display = 'none');
      const target = document.getElementById(btn.dataset.target);
      if (target) target.style.display = 'flex';
      buttons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });
  panels.forEach(p => p.style.display = 'none');
  if (buttons.length) {
    buttons[0].classList.add('active');
    const defaultPanel = document.getElementById(buttons[0].dataset.target);
    if (defaultPanel) defaultPanel.style.display = 'flex';
  }
}

/* 3️⃣  LISTS PANEL – only the top section changes */
async function initListsPanel() {
  if (document.querySelector('.tab-button.active')?.dataset.target !== 'listsPanel') {
    return;
  }
  const panel = document.getElementById('listsPanel');
  if (!panel) return;

  // ─── 1) Clear & style the panel ─────────────────────────────
  panel.innerHTML = '';
  panel.style.display = 'flex';
  panel.style.flexDirection = 'column';
  panel.style.width = '100%';
  panel.style.boxSizing = 'border-box';
  panel.style.padding = '0 1rem';

  // ─── 2) Create static scaffolding ──────────────────────────
  const tabsContainer = document.createElement('div');
  tabsContainer.id = 'listTabs';
  tabsContainer.style.margin = '1rem 0';

  const listsContainer = document.createElement('div');
  listsContainer.id = 'listsContainer';

  const itemForm = document.createElement('div');
  itemForm.id = 'itemForm';
  itemForm.style.margin = '1rem 0';

  const createForm = document.createElement('div');
  createForm.id = 'listForm';
  createForm.innerHTML = `
    <h3>Create New List</h3>
    <label for="listName">List Name:</label>
    <input type="text" id="listName" placeholder="My List" style="margin-left:.5rem">
    <div id="columnsContainer" style="margin:.5rem 0">
      <label>Columns:</label>
    </div>
    <button type="button" id="addColumnBtn">+ Column</button>
    <button type="button" id="createListBtn">Create List</button>
    <hr/>
  `;

  // ─── 3) Create the Add-Column button but don’t append yet ───
  const addColumnBtnForList = document.createElement('button');
  addColumnBtnForList.type = 'button';
  addColumnBtnForList.id = 'addColumnToListBtn';
  addColumnBtnForList.textContent = '+ Add Column';
  addColumnBtnForList.style.alignSelf = 'flex-start';
  addColumnBtnForList.style.margin = '0.5rem 0';

  // ─── 4) Append scaffolding (button will go just after listsContainer) ───
  panel.append(
    tabsContainer,
    listsContainer,
    itemForm,
    createForm
  );


  // ─── 5) Load data & wire persistence ─────────────────────────
  let listsArray = await loadLists();
  const persist = debounce(() => saveLists(listsArray), 250);

  // ─── 6) Helper: render the tab buttons ──────────────────────
  let dragTabEl = null;

  function renderTabs() {
    tabsContainer.innerHTML = '';
    listsArray.forEach((list, idx) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'list-tab';
      btn.draggable = true;
      btn.dataset.idx = idx;
      btn.textContent = list.name;
      btn.addEventListener('click', () => selectList(idx));

      btn.addEventListener('dragstart', e => {
        dragTabEl = btn;
        btn.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
      });

      btn.addEventListener('dragend', () => {
        btn.classList.remove('dragging');
        dragTabEl = null;
      });

      btn.addEventListener('dragover', e => {
        e.preventDefault();
        btn.classList.add('drag-over');
      });

      btn.addEventListener('dragleave', () => {
        btn.classList.remove('drag-over');
      });

      btn.addEventListener('drop', async e => {
        e.preventDefault();
        btn.classList.remove('drag-over');
        if (dragTabEl && dragTabEl !== btn) {
          const from = Number(dragTabEl.dataset.idx);
          const to   = Number(btn.dataset.idx);
          const [moved] = listsArray.splice(from, 1);
          listsArray.splice(to, 0, moved);
          await persist();
          renderTabs();
          selectList(to);
        }
      });

      tabsContainer.append(btn);
    });
  }

  // ─── 7) Helper: when a tab is selected ──────────────────────
  let selectedListIndex = 0;
  function selectList(idx) {
    selectedListIndex = idx;
    Array.from(tabsContainer.children).forEach((b, i) =>
      b.classList.toggle('active', i === idx)
    );
    renderSelectedList();
    renderItemForm();
  }

  async function onCreateList() {
    // 1) Read and validate the list name
    const name = document.querySelector('#listName').value.trim();
    if (!name) {
      alert('List needs a name.');
      return;
    }

    // 2) Gather column definitions (name+type) from the create form
    const rows = Array.from(document.querySelectorAll('#columnsContainer > div'));
    const cols = rows.map(row => {
      const nameInp = row.querySelector('input[type="text"]');
      const typeSel = row.querySelector('select');
      return { name: nameInp.value.trim(), type: typeSel.value };
    }).filter(col => col.name);

    if (!cols.length) {
      alert('Add at least one column.');
      return;
    }

    // 3) Build the newList object before using it
    const newList = { name, columns: cols, items: [] };

    // 4) Push, persist, re-render, and select the new tab
    listsArray.push(newList);
    await persist();
    renderTabs();
    selectList(listsArray.length - 1);
  }

  // Then immediately bind it (and column-input) in the same scope:
  document.getElementById('addColumnBtn')
    .addEventListener('click', addColumnInput);
  document.getElementById('createListBtn')
    .addEventListener('click', onCreateList);

  // 4️⃣ Finally, do the initial render
  renderTabs();
  if (listsArray.length) selectList(0);


  function renderSelectedList() {
    const list = listsArray[selectedListIndex] || { columns: [], items: [] };
    const { columns, items } = list;

    listsContainer.innerHTML = '';
    const table = document.createElement('table');
    table.style.width = '100%';
    table.style.borderCollapse = 'collapse';

    // Header
    const thead = table.createTHead();
    const headerRow = thead.insertRow();
    columns.forEach((col, colIdx) => {
      const th = document.createElement('th');
      th.textContent = col.name;
      th.style.border = '1px solid #ccc';
      th.style.padding = '8px';
      th.style.cursor = 'pointer';

      const sortState = listSortStates[selectedListIndex];
      if (sortState && sortState.colIdx === colIdx) {
        th.textContent += sortState.dir === 1 ? ' \u25B2' : ' \u25BC';
      }

      th.addEventListener('click', async () => {
        const current = listSortStates[selectedListIndex] || {};
        const dir = current.colIdx === colIdx ? -current.dir : 1;
        listSortStates[selectedListIndex] = { colIdx, dir };

        const cmp = (a, b) => {
          const vA = getSortValue(a, col, colIdx);
          const vB = getSortValue(b, col, colIdx);
          if (vA > vB) return dir;
          if (vA < vB) return -dir;
          return 0;
        };

        listsArray[selectedListIndex].items.sort(cmp);
        await persist();
        renderSelectedList();
      });

      headerRow.append(th);
    });
    const actionsTh = document.createElement('th');
    actionsTh.textContent = 'Actions';
    actionsTh.style.border = '1px solid #ccc';
    actionsTh.style.padding = '8px';
    headerRow.append(actionsTh);

    // Body
    const tbody = document.createElement('tbody');
    items.forEach((item, rowIdx) => {
      const tr = tbody.insertRow();

      // Data cells
      columns.forEach((col, colIdx) => {
        const td = tr.insertCell();
        td.style.border = '1px solid #ccc';
        td.style.padding = '8px';
        td.dataset.label = col.name;

        if (colIdx === 0) {
          const url = item[col.name] || '';
          const label = item[col.name + '_label'] || item[col.name] || '';
          if (url) {
            const a = document.createElement('a');
            a.href = url;
            a.target = '_blank';
            a.textContent = label;
            td.append(a);
          } else {
            td.textContent = label;
          }
        }
        else if (col.type === 'checkbox') {
          td.textContent = item[col.name] ? '✔️' : '';
        }
        else if (col.type === 'list') {
          const lines = (item[col.name] || '').split('\n').filter(l => l.trim());
          if (lines.length) {
            const ul = document.createElement('ul');
            lines.forEach(line => {
              const li = document.createElement('li');
              li.textContent = line;
              ul.append(li);
            });
            td.append(ul);
          }
        }
        else {
          td.textContent = item[col.name] || '';
        }
      });

      // Actions cell
      const actionCell = tr.insertCell();
      actionCell.style.border = '1px solid #ccc';
      actionCell.style.padding = '8px';
      actionCell.dataset.label = 'Actions';
      actionCell.style.whiteSpace = 'nowrap';

      // Up button
      const upBtn = document.createElement('button');
      upBtn.textContent = '⬆️';
      upBtn.title = 'Move up';
      Object.assign(upBtn.style, { background: 'none', border: 'none', cursor: 'pointer' });
      upBtn.addEventListener('click', async () => {
        if (rowIdx === 0) return; // already at top
        const itemsArr = listsArray[selectedListIndex].items;
        [itemsArr[rowIdx - 1], itemsArr[rowIdx]] = [itemsArr[rowIdx], itemsArr[rowIdx - 1]];
        await persist();
        renderSelectedList();
        selectList(selectedListIndex);
      });
      actionCell.append(upBtn);

      // Edit button
      const edit = document.createElement('button');
      edit.textContent = '✏️';
      edit.title = 'Edit';
      Object.assign(edit.style, { background: 'none', border: 'none', cursor: 'pointer' });
      edit.addEventListener('click', () => openRowEditor(rowIdx));
      actionCell.append(edit);

      // Delete button
      const del = document.createElement('button');
      del.textContent = '❌';
      del.title = 'Delete';
      Object.assign(del.style, { background: 'none', border: 'none', cursor: 'pointer' });
      del.addEventListener('click', async () => {
        if (!confirm('Delete this row?')) return;
        listsArray[selectedListIndex].items.splice(rowIdx, 1);
        await persist();
        renderSelectedList();
        selectList(selectedListIndex);
      });
      actionCell.append(del);
    });

    table.append(tbody);
    listsContainer.append(table);
  }



  function openRowEditor(rowIdx) {
    const list = listsArray[selectedListIndex];
    const columns = list.columns;
    const values = list.items[rowIdx];

    let editor = document.getElementById('rowEditorForm');
    if (editor) editor.remove();

    editor = document.createElement('div');
    editor.id = 'rowEditorForm';
    Object.assign(editor.style, {
      position: 'fixed',
      top: '10%',
      left: '50%',
      transform: 'translateX(-50%)',
      background: '#fff',
      padding: '1rem',
      boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
      zIndex: '1000',
      maxHeight: '80%',
      overflowY: 'auto',
      minWidth: '320px'
    });
    editor.innerHTML = '<h3>Edit Row & Schema</h3>';

    const colsDiv = document.createElement('div');
    editor.append(colsDiv);

    function redraw() {
      colsDiv.innerHTML = '';
      columns.forEach((col, i) => {
        const row = document.createElement('div');
        Object.assign(row.style, { display: 'flex', alignItems: 'center', marginBottom: '0.5rem' });

        // 1) column name
        const nameInp = document.createElement('input');
        nameInp.value = col.name;
        nameInp.style.flex = '1.2';
        row.append(nameInp);

        // 2) type selector
        const typeSel = document.createElement('select');
        ['text', 'number', 'date', 'checkbox', 'link', 'list'].forEach(t => {
          const opt = document.createElement('option');
          opt.value = t; opt.textContent = t;
          if (t === col.type) opt.selected = true;
          typeSel.append(opt);
        });
        Object.assign(typeSel.style, { flex: '0.8', margin: '0 0.5rem' });
        row.append(typeSel);

        // 3) value inputs
        let urlInp, lblInp, valInp;
        if (i === 0) {
          // URL field
          urlInp = document.createElement('input');
          urlInp.type = 'url';
          urlInp.value = values[col.name] || '';
          urlInp.placeholder = 'URL';
          Object.assign(urlInp.style, { flex: '1.5', marginRight: '0.5rem' });
          row.append(urlInp);

          // Label field
          lblInp = document.createElement('input');
          lblInp.type = 'text';
          lblInp.value = values[col.name + '_label'] || '';
          lblInp.placeholder = 'Link text';
          lblInp.style.flex = '1.5';
          row.append(lblInp);
        }
        else if (col.type === 'list') {
          valInp = document.createElement('textarea');
          valInp.rows = 5;
          valInp.value = values[col.name] || '';
          valInp.placeholder = 'One item per line';
          Object.assign(valInp.style, { flex: '3', width: '100%' });
          row.append(valInp);
        }
        else {
          valInp = document.createElement('input');
          valInp.type = col.type === 'link' ? 'url' : col.type;
          valInp.value = values[col.name] || '';
          valInp.placeholder = 'Value';
          valInp.style.flex = '3';
          row.append(valInp);
        }

        // 4) remove column
        const rem = document.createElement('button');
        rem.textContent = '❌';
        rem.style.marginLeft = '0.5rem';
        rem.addEventListener('click', () => {
          if (!confirm(`Remove column "${col.name}"?`)) return;
          columns.splice(i, 1);
          delete values[col.name];
          delete values[col.name + '_label'];
          redraw();
        });
        row.append(rem);

        // 5) wire updates
        nameInp.addEventListener('blur', () => {
          const nm = nameInp.value.trim();
          if (nm && nm !== col.name) {
            values[nm] = values[col.name];
            values[nm + '_label'] = values[col.name + '_label'];
            delete values[col.name];
            delete values[col.name + '_label'];
            col.name = nm;
            redraw();
          }
        });
        typeSel.addEventListener('change', () => col.type = typeSel.value);
        if (urlInp) urlInp.addEventListener('blur', () => { values[col.name] = urlInp.value.trim(); });
        if (lblInp) lblInp.addEventListener('blur', () => { values[col.name + '_label'] = lblInp.value.trim(); });
        if (valInp) valInp.addEventListener('blur', () => { values[col.name] = valInp.value.trim(); });

        colsDiv.append(row);
      });
    }

    // add‐column
    const addColBtn = document.createElement('button');
    addColBtn.textContent = '+ Add Column';
    Object.assign(addColBtn.style, { display: 'block', margin: '0.5rem 0' });
    addColBtn.addEventListener('click', () => {
      const nm = prompt('New column name:');
      if (!nm) return;
      columns.push({ name: nm.trim(), type: 'text' });
      values[nm.trim()] = '';
      redraw();
    });
    editor.append(addColBtn);

    // save & cancel
    const btns = document.createElement('div');
    btns.style.textAlign = 'right';

    const save = document.createElement('button');
    save.textContent = 'Save';
    save.style.marginRight = '0.5rem';
    save.addEventListener('click', async () => {
      await persist();
      renderTabs();
      renderSelectedList();
      renderItemForm();
      editor.remove();
    });

    const cancel = document.createElement('button');
    cancel.textContent = 'Cancel';
    cancel.addEventListener('click', () => editor.remove());

    btns.append(cancel, save);
    editor.append(btns);

    document.body.append(editor);
    redraw();
  }


  // ─── 9) Helper: render the “Add Item” form ────────────────
  // File: js/lists.js

  function renderItemForm() {
    const list = listsArray[selectedListIndex] || { name: '', columns: [] };

    itemForm.innerHTML = `
    <h4 style="margin:0 0 .5rem;">Add to “${list.name}”</h4>
    <div id="itemInputs" style="display:flex;gap:.5rem;flex-wrap:wrap"></div>
  `;
    const inputsContainer = itemForm.querySelector('#itemInputs');

    list.columns.forEach((col, colIdx) => {
      if (colIdx === 0) {
        const urlInp = document.createElement('input');
        urlInp.type = 'url';
        urlInp.name = col.name;
        urlInp.placeholder = `${col.name} URL (optional)`;
        Object.assign(urlInp.style, {
          flex: '1 1 auto', minWidth: '6rem', padding: '.25rem', fontSize: '.9rem'
        });
        inputsContainer.append(urlInp);

        const lblInp = document.createElement('input');
        lblInp.type = 'text';
        lblInp.name = `${col.name}_label`;
        lblInp.placeholder = `${col.name} text`;
        Object.assign(lblInp.style, {
          flex: '1 1 auto', minWidth: '6rem', padding: '.25rem', fontSize: '.9rem'
        });
        inputsContainer.append(lblInp);
      } else if (col.type === 'list') {
        const txt = document.createElement('textarea');
        txt.name = col.name;
        txt.rows = 2;
        txt.placeholder = col.name;
        Object.assign(txt.style, {
          flex: '1 1 100%', padding: '.25rem', fontSize: '.9rem'
        });
        inputsContainer.append(txt);
      } else {
        const inp = document.createElement('input');
        inp.type = col.type === 'link' ? 'url' : col.type;
        inp.name = col.name;
        inp.placeholder = col.name;
        Object.assign(inp.style, {
          flex: '1 1 auto', minWidth: '6rem', padding: '.25rem', fontSize: '.9rem'
        });
        inputsContainer.append(inp);
      }
    });

    const addBtn = document.createElement('button');
    addBtn.type = 'button';
    addBtn.className = 'add-item-btn';
    addBtn.innerHTML = '<span class="plus-icon">+</span> Add';
    Object.assign(addBtn.style, {
      padding: '.25rem .75rem', fontSize: '.9rem', cursor: 'pointer', marginTop: '.5rem'
    });
    addBtn.addEventListener('click', async () => {
      const newItem = {};
      inputsContainer.querySelectorAll('input,textarea').forEach(i => {
        newItem[i.name] = i.value.trim();
        i.value = '';
      });
      listsArray[selectedListIndex].items.push(newItem);
      await persist();
      renderSelectedList();
    });
    itemForm.append(addBtn);

    const deleteListBtn = document.createElement('button');
    deleteListBtn.type = 'button';
    deleteListBtn.textContent = 'Delete This List';
    Object.assign(deleteListBtn.style, {
      display: 'block',
      marginTop: '0.5rem',
      background: 'none',
      border: '1px solid #f00',
      color: '#f00',
      cursor: 'pointer',
      padding: '.25rem .75rem'
    });
    deleteListBtn.addEventListener('click', async () => {
      if (!confirm(`Delete the entire list “${list.name}”? This cannot be undone.`)) return;
      listsArray.splice(selectedListIndex, 1);
      await persist();
      renderTabs();
      if (listsArray.length) {
        selectedListIndex = Math.max(0, selectedListIndex - 1);
        selectList(selectedListIndex);
      } else {
        listsContainer.innerHTML = '';
        itemForm.innerHTML = '';
      }
    });
    itemForm.append(deleteListBtn);
  }


  // ───10) Hook up the Add-Column button ─────────────────────
  addColumnBtnForList.addEventListener('click', async () => {
    const colName = (prompt('Enter new column name:') || '').trim();
    if (!colName) return;
    const colType = (prompt('Enter column type (text,number,date,checkbox,link,list):', 'text') || '')
      .trim().toLowerCase();
    if (!['text', 'number', 'date', 'checkbox', 'link', 'list'].includes(colType)) {
      return alert('Invalid column type.');
    }
    const list = listsArray[selectedListIndex];
    if (list.columns.find(c => c.name === colName)) {
      return alert('Column exists.');
    }
    list.columns.push({ name: colName, type: colType });
    list.items.forEach(i => i[colName] = colType === 'checkbox' ? false : '');
    await persist();
    renderSelectedList();
    renderItemForm();
  });

  // ───11) Initial render ────────────────────────────────────
  renderTabs();
  if (listsArray.length) {
    selectList(0);
    addColumnBtnForList.style.display = 'block';
  } else {
    addColumnBtnForList.style.display = 'none';
  }
}

window.initListsPanel = initListsPanel;