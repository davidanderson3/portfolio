const decisionForm = document.getElementById('decisionForm');
const decisionList = document.getElementById('decisionList');
const completedList = document.getElementById('completedList');
const showFormBtn = document.getElementById('showFormBtn');
const formContainer = document.getElementById('formContainer');
const cancelFormBtn = document.getElementById('cancelFormBtn');
const loginBtn = document.getElementById('loginBtn');
const logoutBtn = document.getElementById('logoutBtn');
const userEmail = document.getElementById('userEmail');

let justRevisited = null;
let currentUser = null;

const PLACEHOLDERS = {
  decisionText: "Describe the decision...",
  dependsOn: "Does this depend on another decision?",
  tasks: "Tasks required for this decision"
};

// Auth
loginBtn.onclick = async () => {
  const provider = new firebase.auth.GoogleAuthProvider();
  try {
    const result = await auth.signInWithPopup(provider, undefined, firebase.auth.browserPopupRedirectResolver);
    currentUser = result.user;
    userEmail.textContent = currentUser.email;
    await renderDecisions();
  } catch (err) {
    console.error('Login failed:', err);
  }
};

auth.onAuthStateChanged(user => {
  if (user) {
    currentUser = user;
    userEmail.textContent = user.email;
    loginBtn.style.display = 'none';
    logoutBtn.style.display = 'inline-block';
    renderDecisions();
  } else {
    currentUser = null;
    userEmail.textContent = '';
    loginBtn.style.display = 'inline-block';
    logoutBtn.style.display = 'none';
  }
});

logoutBtn.onclick = async () => {
  await auth.signOut();
  currentUser = null;
  userEmail.textContent = '';
  loginBtn.style.display = 'inline-block';
  logoutBtn.style.display = 'none';
  decisionList.innerHTML = '';
  completedList.innerHTML = '';
};

async function loadDecisions() {
  if (!currentUser) return [];
  const snap = await db.collection('decisions').doc(currentUser.uid).get();
  const data = snap.data();
  return data && Array.isArray(data.list) ? data.list : [];
}

async function saveDecisions(decisions) {
  if (!currentUser || !Array.isArray(decisions)) return;
  await db.collection('decisions').doc(currentUser.uid).set({ list: decisions });
}

function formatDaysUntil(dateStr) {
  if (!dateStr) return '';
  const now = new Date();
  const target = new Date(dateStr);
  const diffMs = target.setHours(0, 0, 0, 0) - now.setHours(0, 0, 0, 0);
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'today';
  if (diffDays > 0) return `in ${diffDays} day${diffDays === 1 ? '' : 's'}`;
  return `overdue by ${Math.abs(diffDays)} day${Math.abs(diffDays) === 1 ? '' : 's'}`;
}

function revisitDecision(text) {
  loadDecisions().then((decisions) => {
    const index = decisions.findIndex(d => d.text === text);
    if (index === -1) return;
    decisions[index].completed = false;
    decisions[index].resolution = '';
    decisions[index].dateCompleted = '';
    saveDecisions(decisions);
    justRevisited = text;
    renderDecisions();
  });
}

function removeDecisionByText(text) {
  loadDecisions().then((decisions) => {
    const filtered = decisions.filter(d => d.text !== text);
    saveDecisions(filtered);
    renderDecisions();
  });
}

function topologicalSort(items) {
  const graph = new Map();
  const inDegree = new Map();

  items.forEach(item => {
    graph.set(item.text, []);
    inDegree.set(item.text, 0);
  });

  items.forEach(item => {
    const allDeps = [
      ...(Array.isArray(item.tasks) ? item.tasks : []),
      ...(item.dependsOn ? [item.dependsOn] : [])
    ];
    allDeps.forEach(dep => {
      if (graph.has(dep)) {
        graph.get(dep).push(item.text);
        inDegree.set(item.text, (inDegree.get(item.text) || 0) + 1);
      }
    });
  });

  const queue = [];
  inDegree.forEach((deg, key) => {
    if (deg === 0) queue.push(key);
  });

  const ordered = [];
  while (queue.length > 0) {
    const current = queue.shift();
    ordered.push(current);
    (graph.get(current) || []).forEach(neighbor => {
      inDegree.set(neighbor, inDegree.get(neighbor) - 1);
      if (inDegree.get(neighbor) === 0) queue.push(neighbor);
    });
  }

  return ordered.map(text => items.find(i => i.text === text)).filter(Boolean);
}

async function renderDecisions() {
  const all = await loadDecisions();
  const seen = new Set();
  const unique = all.filter(d => {
    if (seen.has(d.text)) return false;
    seen.add(d.text);
    return true;
  });

  const ordered = topologicalSort(unique);
  decisionList.innerHTML = '';
  completedList.innerHTML = '';

  ordered.forEach((dec, index) => {
    const wrapper = document.createElement('div');
    wrapper.className = dec.completed ? 'completed-decision' : 'decision';

    if (dec.text === justRevisited) {
      wrapper.classList.add('highlight');
      setTimeout(() => {
        wrapper.classList.remove('highlight');
        justRevisited = null;
      }, 2000);
    }

    const row = document.createElement('div');
    row.className = 'decision-row';
    const due = formatDaysUntil(dec.deadline);
    row.innerHTML = `
      <div class="check-column">
        <input type="checkbox" ${dec.completed ? 'checked disabled' : ''} />
      </div>
      <div class="title-column">${dec.text}</div>
      <div class="due-column">${due}</div>
      <div class="arrow-column">▶</div>
    `;

    row.onclick = (e) => {
      if (e.target.tagName === 'INPUT') return;
      wrapper.classList.toggle('expanded');
      const arrow = row.querySelector('.arrow-column');
      arrow.textContent = wrapper.classList.contains('expanded') ? '▼' : '▶';
    };

    const checkbox = row.querySelector('input[type="checkbox"]');
    if (!dec.completed) {
      checkbox.onchange = async () => {
        const resolution = prompt("What was your decision?");
        if (!resolution) {
          checkbox.checked = false;
          return;
        }

        dec.completed = true;
        dec.resolution = resolution;
        dec.dateCompleted = new Date().toISOString().split('T')[0];
        const updated = await loadDecisions();
        const idx = updated.findIndex(d => d.text === dec.text);
        updated[idx] = dec;
        await saveDecisions(updated);
        renderDecisions();
      };
    }

    const content = document.createElement('div');
    content.className = 'decision-content';
    content.innerHTML = `
      <div class="row">
        <div class="label">Depends on:</div>
        <div>
          <input class="field" data-field="dependsOn" data-index="${index}" 
                 value="${dec.dependsOn || ''}" 
                 placeholder="${PLACEHOLDERS.dependsOn}" />
        </div>
      </div>
      <div class="row">
        <div class="label">Tasks required:</div>
        <div>
          <textarea class="field" data-field="tasks" data-index="${index}" rows="3"
            placeholder="${PLACEHOLDERS.tasks}">${Array.isArray(dec.tasks)
      ? dec.tasks.join('\n')
      : dec.tasks || ''
    }</textarea>
        </div>
      </div>
      <div class="row">
        <div class="label">Deadline:</div>
        <div>
          <input type="date" class="field" data-field="deadline" data-index="${index}" 
                 value="${dec.deadline || ''}" />
        </div>
      </div>
    `;

    if (dec.dependsOn) {
      const dep = document.createElement('div');
      dep.className = 'link-line right-aligned';
      dep.innerHTML = `🔗 Depends on: <strong>${dec.dependsOn}</strong>`;
      wrapper.appendChild(dep);
    }

    if (Array.isArray(dec.tasks) && dec.tasks.length > 0) {
      const taskList = dec.tasks.map(p => `<li>${p}</li>`).join('');
      const taskBlock = document.createElement('div');
      taskBlock.className = 'link-line';
      taskBlock.innerHTML = `🛠️ Tasks:<ul>${taskList}</ul>`;
      wrapper.appendChild(taskBlock);
    }

    wrapper.appendChild(row);
    wrapper.appendChild(content);

    content.querySelectorAll('.field').forEach(input => {
      input.addEventListener('blur', async () => {
        const field = input.dataset.field;
        const idx = parseInt(input.dataset.index);
        const decisions = await loadDecisions();

        if (field === 'tasks') {
          decisions[idx][field] = input.value
            .split(/\n|,/)
            .map(x => x.trim())
            .filter(Boolean);
        } else {
          decisions[idx][field] = input.value.trim();
        }

        await saveDecisions(decisions);
        renderDecisions();
      });
    });

    (dec.completed ? completedList : decisionList).appendChild(wrapper);
  });
}

decisionForm.addEventListener('submit', async function (e) {
  e.preventDefault();

  const decisionText = document.getElementById('decisionText').value.trim();
  const dependsOn = document.getElementById('dependsOn').value.trim();
  const tasksRaw = document.getElementById('tasks').value.trim();
  const tasks = tasksRaw
    .split(/\n|,/)
    .map(s => s.trim())
    .filter(Boolean);
  const deadline = document.getElementById('deadline').value;

  if (!decisionText) return;

  const decisions = await loadDecisions();
  const isNewDependency = dependsOn && !decisions.find(d => d.text === dependsOn);

  decisions.push({
    text: decisionText,
    dependsOn,
    tasks,
    deadline,
    completed: false,
    resolution: '',
    dateCompleted: ''
  });

  tasks.forEach(taskText => {
    const alreadyExists = decisions.some(d => d.text === taskText);
    if (!alreadyExists) {
      decisions.push({
        text: taskText,
        dependsOn: '',
        tasks: [],
        deadline: '',
        completed: false,
        resolution: '',
        dateCompleted: ''
      });
    }
  });

  if (isNewDependency) {
    decisions.push({
      text: dependsOn,
      dependsOn: '',
      tasks: [],
      deadline: '',
      completed: false,
      resolution: '',
      dateCompleted: ''
    });

    await saveDecisions(decisions);
    alert(`Now enter details for the dependency: "${dependsOn}"`);

    document.getElementById('decisionText').value = dependsOn || '';
    document.getElementById('dependsOn').value = '';
    document.getElementById('tasks').value = '';
    document.getElementById('deadline').value = '';
  } else {
    await saveDecisions(decisions);
    decisionForm.reset();
    formContainer.style.display = 'none';
    showFormBtn.style.display = 'inline-block';
    renderDecisions();
  }
});

showFormBtn.onclick = () => {
  formContainer.style.display = 'block';
  showFormBtn.style.display = 'none';
};

cancelFormBtn.onclick = () => {
  formContainer.style.display = 'none';
  showFormBtn.style.display = 'inline-block';
  decisionForm.reset();
};

window.addEventListener('load', () => {
  document.getElementById('decisionText').placeholder = PLACEHOLDERS.decisionText;
  document.getElementById('dependsOn').placeholder = PLACEHOLDERS.dependsOn;
  document.getElementById('tasks').placeholder = PLACEHOLDERS.tasks;
  renderDecisions();
});
