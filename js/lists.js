import { loadLists, saveLists } from './helpers.js';
import { auth } from './auth.js';

/* 1️⃣  DOM ready: wait for Firebase auth before loading lists */
window.addEventListener('DOMContentLoaded', () => {
  initTabs();
  auth.onAuthStateChanged(() => {
    initListsPanel();             // runs once auth is settled
  });
});

/* 2️⃣  TABS HEADER (unchanged) */
function initTabs() {
  const buttons = document.querySelectorAll('.tab-button');
  const panels = document.querySelectorAll('.main-layout');
  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
      panels.forEach(p => (p.style.display = 'none'));
      const panel = document.getElementById(btn.dataset.target);
      if (panel) panel.style.display = 'flex';
    });
  });
}

/* 3️⃣  LISTS PANEL – only the top section changes */
async function initListsPanel() {
  const panel = document.getElementById('listsPanel');
  if (!panel) return;

  /* 1️⃣  panel scaffolding */
  panel.innerHTML = '';
  panel.style.display = 'flex';
  panel.style.flexDirection = 'column';
  panel.style.width = '100%';
  panel.style.boxSizing = 'border-box';
  panel.style.padding = '0 1rem';

  const tabsContainer = Object.assign(document.createElement('div'), {
    id: 'listTabs',
    style: 'margin:1rem 0'
  });
  const addColumnBtnForList = Object.assign(document.createElement('button'), {
    type: 'button',
    id: 'addColumnToListBtn',
    textContent: '+ Add Column',
    style: 'align-self:flex-start;margin-bottom:1rem'
  });
  const listsContainer = Object.assign(document.createElement('div'), { id: 'listsContainer' });
  const itemForm = Object.assign(document.createElement('div'), { id: 'itemForm', style: 'margin:1rem 0' });

  panel.append(tabsContainer, addColumnBtnForList, listsContainer, itemForm);

  /* 2️⃣  create-list form (keeps your original markup) */
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
  panel.appendChild(createForm);

  const columnsContainer = createForm.querySelector('#columnsContainer');
  const addColumnBtn = createForm.querySelector('#addColumnBtn');
  const createListBtn = createForm.querySelector('#createListBtn');

  /* 🔑 LOAD & PERSIST setup */
  let listsArray = await loadLists();       // from Firestore or fallback
  const persist = async () => {            // replaces old saveLists()
    await saveLists(listsArray);
  };

  function renderTabs() {
    tabsContainer.innerHTML = '';
    listsArray.forEach((list, idx) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'list-tab';
      btn.textContent = list.name;
      btn.dataset.index = idx;
      btn.style.marginRight = '0.5rem';
      btn.addEventListener('click', () => selectList(idx));
      tabsContainer.appendChild(btn);
    });
  }

  let selectedListIndex = 0;
  function selectList(idx) {
    selectedListIndex = idx;
    Array.from(tabsContainer.children).forEach((btn, i) =>
      btn.classList.toggle('active', i === idx)
    );
    renderSelectedList();
    renderItemForm();
  }

  addColumnBtnForList.addEventListener('click', async () => {
    const colName = (prompt('Enter new column name:') || '').trim();
    if (!colName) return;
    const colType = (prompt('Enter column type (text, number, date, checkbox):', 'text') || '')
      .trim()
      .toLowerCase();
    // where you check colType
    if (!['text', 'number', 'date', 'checkbox', 'link', 'list'].includes(colType)) {
      return alert('Invalid column type.');
    }


    const list = listsArray[selectedListIndex];
    if (list.columns.find(c => c.name === colName)) {
      return alert('Column already exists.');
    }
    list.columns.push({ name: colName, type: colType });
    list.items.forEach(item => {
      item[colName] = colType === 'checkbox' ? false : '';
    });
    await persist();
    renderSelectedList();
    renderItemForm();
  });

  function renderSelectedList() {
    const list = listsArray[selectedListIndex] || { columns: [], items: [] };
    const columns = list.columns;
    const items = list.items;

    listsContainer.innerHTML = '';
    const table = document.createElement('table');
    table.style.width = '100%';
    table.style.borderCollapse = 'collapse';

    const thead = table.createTHead();
    const hdrRow = thead.insertRow();
    columns.forEach((col, i) => {
      const th = document.createElement('th');
      th.textContent = col.name;
      th.style.border = '1px solid #ccc';
      th.style.padding = '8px';
      th.style.position = 'relative';

th.addEventListener('dblclick', async () => {
  const oldName = col.name;
  // 1) rename
  const newName = (prompt('Rename column:', oldName) || '').trim();
  if (!newName) return;

  // 2) change type
  const newType = (prompt(
    'Enter new column type (text, number, date, checkbox, link, list):',
    col.type
  ) || '').trim().toLowerCase();
  if (!['text','number','date','checkbox','link','list'].includes(newType)) {
    return alert('Invalid column type.');
  }

  // 3) migrate data
  items.forEach(item => {
    item[newName] = item[oldName];
    delete item[oldName];
  });

  // 4) apply to schema
  col.name = newName;
  col.type = newType;

  // 5) persist & rerender
  await persist();
  renderSelectedList();
  renderItemForm();
});


      const rm = document.createElement('button');
      rm.textContent = '❌';
      rm.title = 'Remove column';
      Object.assign(rm.style, {
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        fontSize: '1.2em',
        padding: '0',
        marginLeft: '4px'
      });
      rm.addEventListener('click', async e => {
        e.stopPropagation();
        if (!confirm(`Delete column "${col.name}"?`)) return;
        list.columns.splice(i, 1);
        items.forEach(item => delete item[col.name]);
        await persist();
        renderSelectedList();
        renderItemForm();
      });
      th.appendChild(rm);
      hdrRow.appendChild(th);
    });

    const actTh = document.createElement('th');
    actTh.textContent = 'Actions';
    actTh.style.border = '1px solid #ccc';
    actTh.style.padding = '8px';
    hdrRow.appendChild(actTh);

    const tbody = document.createElement('tbody');
    items.forEach((item, idx) => {
      const row = tbody.insertRow();
      columns.forEach(col => {
        const cell = row.insertCell();
        cell.textContent = col.type === 'checkbox'
          ? (item[col.name] ? '✔️' : '')
          : (item[col.name] || '');
        cell.style.border = '1px solid #ccc';
        cell.style.padding = '8px';
        cell.addEventListener('dblclick', () => {
          let inp;
          if (col.type === 'checkbox') {
            inp = document.createElement('input');
            inp.type = 'checkbox';
            inp.checked = !!item[col.name];
          } else {
            inp = document.createElement('input');
            inp.type = col.type;
            inp.value = item[col.name] || '';
          }
          cell.innerHTML = '';
          cell.appendChild(inp);
          inp.focus();
          inp.addEventListener('blur', async () => {
            if (col.type === 'checkbox') {
              item[col.name] = inp.checked;
              cell.textContent = inp.checked ? '✔️' : '';
            } else if (col.type === 'link') {
              const url = item[col.name] || '';
              cell.innerHTML = url
                ? `<a href="${url}" target="_blank">${url}</a>`
                : '';
            } else if (col.type === 'list') {
              const raw = item[col.name] || '';
              const lines = raw.split('\n').filter(l => l.trim());
              cell.innerHTML = lines.length
                ? '<ul>' + lines.map(l => `<li>${l}</li>`).join('') + '</ul>'
                : '';
            } else {
              cell.textContent = item[col.name] || '';
            }
            await persist();
          });
          inp.addEventListener('keydown', e => {
            if (e.key === 'Enter') inp.blur();
          });
        });
      });

      const actionCell = row.insertCell();
      actionCell.style.border = '1px solid #ccc';
      actionCell.style.padding = '8px';

      const editBtn = document.createElement('button');
      editBtn.textContent = '✏️';
      editBtn.title = 'Edit row';
      Object.assign(editBtn.style, {
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        fontSize: '1.2em',
        padding: '0',
        marginRight: '0.5rem'
      });
      editBtn.addEventListener('click', async () => {
        columns.forEach(col => {
          if (col.type === 'checkbox') {
            item[col.name] = confirm(`Check "${col.name}"?`);
          } else {
            const val = prompt(`New value for "${col.name}":`, item[col.name] || '');
            if (val !== null) item[col.name] = val.trim();
          }
        });
        await persist();
        renderSelectedList();
      });
      actionCell.appendChild(editBtn);

      const deleteBtn = document.createElement('button');
      deleteBtn.textContent = '❌';
      deleteBtn.title = 'Delete row';
      Object.assign(deleteBtn.style, {
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        fontSize: '1.2em',
        padding: '0'
      });
      deleteBtn.addEventListener('click', async () => {
        if (!confirm('Delete this row?')) return;
        listsArray[selectedListIndex].items.splice(idx, 1);
        await persist();
        renderSelectedList();
      });
      actionCell.appendChild(deleteBtn);
    });

    table.appendChild(tbody);
    listsContainer.appendChild(table);
  }

  function renderItemForm() {
    const list = listsArray[selectedListIndex] || { name: '', columns: [] };
    const { name, columns } = list;

    itemForm.innerHTML = `<h3>Add to "${name}"</h3>`;
    const inputs = columns.map(col => {
      const label = document.createElement('label');
      label.textContent = col.name;
let input;
if (col.type === 'list') {
  input = document.createElement('textarea');
  input.rows = 3;
} else {
  input = document.createElement('input');
  input.type = col.type === 'link' ? 'url' : col.type;
}
      input.name = col.name;
      if (col.type === 'checkbox') input.checked = false;
      else input.value = '';
      input.placeholder = col.name;
      itemForm.appendChild(label);
      itemForm.appendChild(input);
      return input;
    });

    const addBtn = document.createElement('button');
    addBtn.type = 'button';
    addBtn.textContent = 'Add Item';
    addBtn.style.marginTop = '0.5rem';
    addBtn.addEventListener('click', async () => {
      const newItem = {};
      inputs.forEach(input => {
        newItem[input.name] =
          input.type === 'checkbox' ? input.checked : input.value.trim();
        if (input.type === 'checkbox') input.checked = false;
        else input.value = '';
      });
      listsArray[selectedListIndex].items.push(newItem);
      await persist();
      appendItemRow(newItem);
    });
    itemForm.appendChild(addBtn);
  }

  function appendItemRow(item) {
    const tbl = listsContainer.querySelector('table');
    const tb = tbl.tBodies[0];
    const cols = listsArray[selectedListIndex].columns;
    const idx = listsArray[selectedListIndex].items.length - 1;
    const row = tb.insertRow();

    cols.forEach(col => {
      const cell = row.insertCell();
      cell.textContent =
        col.type === 'checkbox' ? (item[col.name] ? '✔️' : '') : item[col.name] || '';
      cell.style.border = '1px solid #ccc';
      cell.style.padding = '8px';
      cell.addEventListener('dblclick', () => {
        let inp;
        if (col.type === 'checkbox') {
          inp = document.createElement('input');
          inp.type = 'checkbox';
          inp.checked = !!item[col.name];
        } else {
          inp = document.createElement('input');
          inp.type = col.type;
          inp.value = item[col.name] || '';
        }
        cell.innerHTML = '';
        cell.appendChild(inp);
        inp.focus();
        inp.addEventListener('blur', async () => {
          if (col.type === 'checkbox') {
            item[col.name] = inp.checked;
            cell.textContent = inp.checked ? '✔️' : '';
          } else {
            item[col.name] = inp.value.trim();
            cell.textContent = item[col.name];
          }
          await persist();
        });
        inp.addEventListener('keydown', e => {
          if (e.key === 'Enter') inp.blur();
        });
      });
    });

    const ac = row.insertCell();
    ac.style.border = '1px solid #ccc';
    ac.style.padding = '8px';

    const eb = document.createElement('button');
    eb.textContent = '✏️';
    eb.title = 'Edit row';
    Object.assign(eb.style, {
      background: 'none',
      border: 'none',
      cursor: 'pointer',
      fontSize: '1.2em',
      padding: '0',
      marginRight: '0.5rem'
    });
    eb.addEventListener('click', async () => {
      cols.forEach(col => {
        if (col.type === 'checkbox') {
          item[col.name] = confirm(`Check "${col.name}"?`);
        } else {
          const val = prompt(`Value for "${col.name}":`, item[col.name] || '');
          if (val !== null) item[col.name] = val.trim();
        }
      });
      await persist();
      renderSelectedList();
    });
    ac.appendChild(eb);

    const dbBtn = document.createElement('button');
    dbBtn.textContent = '❌';
    dbBtn.title = 'Delete row';
    Object.assign(dbBtn.style, {
      background: 'none',
      border: 'none',
      cursor: 'pointer',
      fontSize: '1.2em',
      padding: '0'
    });
    dbBtn.addEventListener('click', async () => {
      if (!confirm('Delete this row?')) return;
      listsArray[selectedListIndex].items.splice(idx, 1);
      await persist();
      renderSelectedList();
    });
    ac.appendChild(dbBtn);
  }

  function addColumnInput() {
    const row = document.createElement('div');
    row.className = 'column-row';
    row.style.margin = '0.25rem 0';
    row.innerHTML = `
      <input type="text" class="columnName" placeholder="Column Name" style="margin-right:.5rem">
    <select class="columnType">
      <option value="text">Text</option>
      <option value="number">Number</option>
      <option value="date">Date</option>
      <option value="checkbox">Checkbox</option>
     <option value="list">List</option>
    </select>
      <button type="button" class="removeColumnBtn">❌</button>
    `;
    const removeBtn = row.querySelector('.removeColumnBtn');
    Object.assign(removeBtn.style, {
      background: 'none',
      border: 'none',
      cursor: 'pointer',
      fontSize: '1.2em',
      padding: '0'
    });
    removeBtn.addEventListener('click', () => row.remove());
    columnsContainer.appendChild(row);
  }

  addColumnInput();
  addColumnBtn.addEventListener('click', addColumnInput);
  createListBtn.addEventListener('click', async () => {
    const name = createForm.querySelector('#listName').value.trim();
    const rows = Array.from(columnsContainer.querySelectorAll('.column-row'));
    const cols = rows.map(r => {
      const nm = r.querySelector('.columnName').value.trim();
      const tp = r.querySelector('.columnType').value;
      return { name: nm, type: tp };
    }).filter(c => c.name);

    if (!name) return alert('Enter a list name.');
    if (!cols.length) return alert('Add at least one column.');

    listsArray.push({ name, columns: cols, items: [] });
    await persist();
    renderTabs();
    selectList(listsArray.length - 1);

    createForm.querySelector('#listName').value = '';
    columnsContainer.innerHTML = '<label>Columns:</label>';
    addColumnInput();
  });

  renderTabs();
  if (listsArray.length) selectList(0);
}
