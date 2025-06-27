window.addEventListener('DOMContentLoaded', () => {
  initTabs();
  initListsPanel();
});

function initTabs() {
  const buttons = document.querySelectorAll('.tab-button');
  const panels  = document.querySelectorAll('.main-layout');
  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
      panels.forEach(p => p.style.display = 'none');
      const panel = document.getElementById(btn.dataset.target);
      if (panel) panel.style.display = 'flex';
    });
  });
}

function initListsPanel() {
  const panel = document.getElementById('listsPanel');
  if (!panel) return;

  panel.innerHTML = '';
  panel.style.display       = 'flex';
  panel.style.flexDirection = 'column';
  panel.style.width         = '100%';
  panel.style.boxSizing     = 'border-box';
  panel.style.padding       = '0 1rem';

  const tabsContainer = document.createElement('div');
  tabsContainer.id = 'listTabs';
  tabsContainer.style.margin = '1rem 0';
  panel.appendChild(tabsContainer);

  const addColumnBtnForList = document.createElement('button');
  addColumnBtnForList.type        = 'button';
  addColumnBtnForList.id          = 'addColumnToListBtn';
  addColumnBtnForList.textContent = '+ Add Column';
  addColumnBtnForList.style.alignSelf   = 'flex-start';
  addColumnBtnForList.style.marginBottom = '1rem';
  panel.appendChild(addColumnBtnForList);

  const listsContainer = document.createElement('div');
  listsContainer.id = 'listsContainer';
  panel.appendChild(listsContainer);

  const itemForm = document.createElement('div');
  itemForm.id = 'itemForm';
  itemForm.style.margin = '1rem 0';
  panel.appendChild(itemForm);

  const createForm = document.createElement('div');
  createForm.id = 'listForm';
  createForm.innerHTML = `
    <h3>Create New List</h3>
    <label for="listName">List Name:</label>
    <input type="text" id="listName" placeholder="My List" style="margin-left:.5rem">
    <div id="columnsContainer" style="margin: .5rem 0"><label>Columns:</label></div>
    <button type="button" id="addColumnBtn">+ Column</button>
    <button type="button" id="createListBtn">Create List</button>
    <hr/>
  `;
  panel.appendChild(createForm);

  const columnsContainer = createForm.querySelector('#columnsContainer');
  const addColumnBtn     = createForm.querySelector('#addColumnBtn');
  const createListBtn    = createForm.querySelector('#createListBtn');

  const STORAGE_KEY = 'myLists';
  let listsArray = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]').map(l => ({
    name: l.name,
    columns: Array.isArray(l.columns)
      ? l.columns.map(c =>
          typeof c === 'string'
            ? { name: c, type: 'text' }
            : { name: c.name, type: c.type || 'text' }
        )
      : [],
    items: Array.isArray(l.items) ? l.items : []
  }));

  function saveLists() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(listsArray));
  }

  function renderTabs() {
    tabsContainer.innerHTML = '';
    listsArray.forEach((list, idx) => {
      const btn = document.createElement('button');
      btn.type        = 'button';
      btn.className   = 'list-tab';
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

  addColumnBtnForList.addEventListener('click', () => {
    const colName = prompt('Enter new column name:').trim();
    if (!colName) return;
    const colType = prompt('Enter column type (text, number, date, checkbox):', 'text')
      .trim()
      .toLowerCase();
    if (!['text', 'number', 'date', 'checkbox'].includes(colType)) {
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
    saveLists();
    renderSelectedList();
    renderItemForm();
  });

  function renderSelectedList() {
    const list    = listsArray[selectedListIndex] || { columns: [], items: [] };
    const columns = list.columns;
    const items   = list.items;

    listsContainer.innerHTML = '';
    const table = document.createElement('table');
    table.style.width         = '100%';
    table.style.borderCollapse = 'collapse';

    const thead = table.createTHead();
    const hdrRow = thead.insertRow();
    columns.forEach((col, i) => {
      const th = document.createElement('th');
      th.textContent = col.name;
      th.style.border  = '1px solid #ccc';
      th.style.padding = '8px';
      th.style.position = 'relative';
      th.addEventListener('dblclick', () => {
        const oldName = col.name;
        const newName = prompt('Rename column:', oldName);
        if (!newName) return;
        col.name = newName.trim();
        items.forEach(item => {
          item[newName] = item[oldName];
          delete item[oldName];
        });
        saveLists();
        renderSelectedList();
        renderItemForm();
      });

      const rm = document.createElement('button');
      rm.textContent    = '❌';
      rm.title          = 'Remove column';
      rm.style.background = 'none';
      rm.style.border     = 'none';
      rm.style.cursor     = 'pointer';
      rm.style.fontSize   = '1.2em';
      rm.style.padding    = '0';
      rm.style.marginLeft = '4px';
      rm.addEventListener('click', e => {
        e.stopPropagation();
        if (!confirm(`Delete column "${col.name}"?`)) return;
        list.columns.splice(i, 1);
        items.forEach(item => delete item[col.name]);
        saveLists();
        renderSelectedList();
        renderItemForm();
      });
      th.appendChild(rm);
      hdrRow.appendChild(th);
    });

    const actTh = document.createElement('th');
    actTh.textContent  = 'Actions';
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
        cell.style.border  = '1px solid #ccc';
        cell.style.padding = '8px';
        cell.addEventListener('dblclick', () => {
          let inp;
          if (col.type === 'checkbox') {
            inp = document.createElement('input');
            inp.type    = 'checkbox';
            inp.checked = !!item[col.name];
          } else {
            inp = document.createElement('input');
            inp.type    = col.type;
            inp.value   = item[col.name] || '';
          }
          cell.innerHTML = '';
          cell.appendChild(inp);
          inp.focus();
          inp.addEventListener('blur', () => {
            if (col.type === 'checkbox') {
              item[col.name] = inp.checked;
              cell.textContent = inp.checked ? '✔️' : '';
            } else {
              item[col.name] = inp.value.trim();
              cell.textContent = item[col.name];
            }
            saveLists();
          });
          inp.addEventListener('keydown', e => {
            if (e.key === 'Enter') inp.blur();
          });
        });
      });

      const actionCell = row.insertCell();
      actionCell.style.border  = '1px solid #ccc';
      actionCell.style.padding = '8px';

      const editBtn = document.createElement('button');
      editBtn.textContent    = '✏️';
      editBtn.title          = 'Edit row';
      editBtn.style.background = 'none';
      editBtn.style.border     = 'none';
      editBtn.style.cursor     = 'pointer';
      editBtn.style.fontSize   = '1.2em';
      editBtn.style.padding    = '0';
      editBtn.style.marginRight= '0.5rem';
      editBtn.addEventListener('click', () => {
        columns.forEach(col => {
          if (col.type === 'checkbox') {
            item[col.name] = confirm(`Check "${col.name}"?`);
          } else {
            const val = prompt(`New value for "${col.name}":`, item[col.name] || '');
            if (val !== null) item[col.name] = val.trim();
          }
        });
        saveLists();
        renderSelectedList();
      });
      actionCell.appendChild(editBtn);

      const deleteBtn = document.createElement('button');
      deleteBtn.textContent    = '❌';
      deleteBtn.title          = 'Delete row';
      deleteBtn.style.background = 'none';
      deleteBtn.style.border     = 'none';
      deleteBtn.style.cursor     = 'pointer';
      deleteBtn.style.fontSize   = '1.2em';
      deleteBtn.style.padding    = '0';
      deleteBtn.addEventListener('click', () => {
        if (!confirm('Delete this row?')) return;
        listsArray[selectedListIndex].items.splice(idx, 1);
        saveLists();
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
      const input = document.createElement('input');
      input.type = col.type;
      input.name = col.name;
      if (col.type === 'checkbox') input.checked = false;
      else input.value = '';
      input.placeholder = col.name;
      itemForm.appendChild(label);
      itemForm.appendChild(input);
      return input;
    });

    const addBtn = document.createElement('button');
    addBtn.type        = 'button';
    addBtn.textContent = 'Add Item';
    addBtn.style.marginTop = '0.5rem';
    // default styling (no background/border overrides)
    addBtn.addEventListener('click', () => {
      const newItem = {};
      inputs.forEach(input => {
        newItem[input.name] =
          input.type === 'checkbox' ? input.checked : input.value.trim();
        if (input.type === 'checkbox') input.checked = false;
        else input.value = '';
      });
      listsArray[selectedListIndex].items.push(newItem);
      saveLists();
      appendItemRow(newItem);
    });
    itemForm.appendChild(addBtn);
  }

  function appendItemRow(item) {
    const tbl = listsContainer.querySelector('table');
    const tb  = tbl.tBodies[0];
    const cols= listsArray[selectedListIndex].columns;
    const idx = listsArray[selectedListIndex].items.length - 1;
    const row = tb.insertRow();

    cols.forEach(col => {
      const cell = row.insertCell();
      cell.textContent =
        col.type === 'checkbox' ? (item[col.name] ? '✔️' : '') : item[col.name] || '';
      cell.style.border  = '1px solid #ccc';
      cell.style.padding = '8px';
      cell.addEventListener('dblclick', () => {
        let inp;
        if (col.type === 'checkbox') {
          inp = document.createElement('input');
          inp.type    = 'checkbox';
          inp.checked = !!item[col.name];
        } else {
          inp = document.createElement('input');
          inp.type    = col.type;
          inp.value   = item[col.name] || '';
        }
        cell.innerHTML = '';
        cell.appendChild(inp);
        inp.focus();
        inp.addEventListener('blur', () => {
          if (col.type === 'checkbox') {
            item[col.name] = inp.checked;
            cell.textContent = inp.checked ? '✔️' : '';
          } else {
            item[col.name] = inp.value.trim();
            cell.textContent = item[col.name];
          }
          saveLists();
        });
        inp.addEventListener('keydown', e => {
          if (e.key === 'Enter') inp.blur();
        });
      });
    });

    const ac = row.insertCell();
    ac.style.border  = '1px solid #ccc';
    ac.style.padding = '8px';

    const eb = document.createElement('button');
    eb.textContent    = '✏️';
    eb.title          = 'Edit row';
    eb.style.background = 'none';
    eb.style.border     = 'none';
    eb.style.cursor     = 'pointer';
    eb.style.fontSize   = '1.2em';
    eb.style.padding    = '0';
    eb.style.marginRight= '0.5rem';
    eb.addEventListener('click', () => {
      cols.forEach(col => {
        if (col.type === 'checkbox') {
          item[col.name] = confirm(`Check "${col.name}"?`);
        } else {
          const val = prompt(`Value for "${col.name}":`, item[col.name] || '');
          if (val !== null) item[col.name] = val.trim();
        }
      });
      saveLists();
      renderSelectedList();
    });
    ac.appendChild(eb);

    const db = document.createElement('button');
    db.textContent    = '❌';
    db.title          = 'Delete row';
    db.style.background = 'none';
    db.style.border     = 'none';
    db.style.cursor     = 'pointer';
    db.style.fontSize   = '1.2em';
    db.style.padding    = '0';
    db.addEventListener('click', () => {
      if (!confirm('Delete this row?')) return;
      listsArray[selectedListIndex].items.splice(idx, 1);
      saveLists();
      renderSelectedList();
    });
    ac.appendChild(db);
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
      </select>
      <button type="button" class="removeColumnBtn">❌</button>
    `;
    const removeBtn = row.querySelector('.removeColumnBtn');
    removeBtn.style.background = 'none';
    removeBtn.style.border     = 'none';
    removeBtn.style.cursor     = 'pointer';
    removeBtn.style.fontSize   = '1.2em';
    removeBtn.style.padding    = '0';
    removeBtn.addEventListener('click', () => row.remove());
    columnsContainer.appendChild(row);
  }

  addColumnInput();
  addColumnBtn.addEventListener('click', addColumnInput);
  createListBtn.addEventListener('click', () => {
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
    saveLists();
    renderTabs();
    selectList(listsArray.length - 1);

    createForm.querySelector('#listName').value = '';
    columnsContainer.innerHTML = '<label>Columns:</label>';
    addColumnInput();
  });

  renderTabs();
  if (listsArray.length) selectList(0);
}
