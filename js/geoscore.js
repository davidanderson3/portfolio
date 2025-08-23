const STORAGE_KEY = 'geoscoreQuestions';

function loadQuestions() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return Array.isArray(JSON.parse(raw)) ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveQuestions(qs) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(qs));
  } catch {}
}

export function initGeoScorePanel() {
  const container = document.getElementById('geoscoreAdmin');
  if (!container) return;
  container.innerHTML = '';

  const questions = loadQuestions();

  const form = document.createElement('div');
  form.id = 'geoscoreForm';

  const qInput = document.createElement('input');
  qInput.type = 'text';
  qInput.placeholder = 'Question';
  form.appendChild(qInput);

  const answersDiv = document.createElement('div');
  answersDiv.className = 'geoscore-answers';
  form.appendChild(answersDiv);

  function addAnswerField(ans = '', score = '') {
    const row = document.createElement('div');
    row.className = 'geoscore-answer-row';

    const a = document.createElement('input');
    a.type = 'text';
    a.placeholder = 'Answer';
    a.value = ans;

    const s = document.createElement('input');
    s.type = 'number';
    s.placeholder = 'Score';
    s.value = score;

    const rm = document.createElement('button');
    rm.type = 'button';
    rm.textContent = '✖';
    rm.addEventListener('click', () => row.remove());

    row.append(a, s, rm);
    answersDiv.appendChild(row);
  }

  addAnswerField();

  const addAnswerBtn = document.createElement('button');
  addAnswerBtn.type = 'button';
  addAnswerBtn.textContent = 'Add Answer';
  addAnswerBtn.addEventListener('click', () => addAnswerField());
  form.appendChild(addAnswerBtn);

  const saveBtn = document.createElement('button');
  saveBtn.type = 'button';
  saveBtn.textContent = 'Save Question';
  saveBtn.addEventListener('click', () => {
    const question = qInput.value.trim();
    if (!question) return;
    const answers = Array.from(answersDiv.querySelectorAll('.geoscore-answer-row')).map(row => {
      const [a, s] = row.querySelectorAll('input');
      return { answer: a.value.trim(), score: Number(s.value) || 0 };
    }).filter(a => a.answer);
    questions.push({ question, answers });
    saveQuestions(questions);
    renderList();
    qInput.value = '';
    answersDiv.innerHTML = '';
    addAnswerField();
  });
  form.appendChild(saveBtn);

  container.appendChild(form);

  const list = document.createElement('ul');
  list.id = 'geoscoreList';
  container.appendChild(list);

  function renderList() {
    list.innerHTML = '';
    questions.forEach((q, idx) => {
      const li = document.createElement('li');
      li.textContent = `${q.question} (${q.answers.length} answers)`;
      const del = document.createElement('button');
      del.type = 'button';
      del.textContent = 'Delete';
      del.addEventListener('click', () => {
        questions.splice(idx, 1);
        saveQuestions(questions);
        renderList();
      });
      li.appendChild(del);
      list.appendChild(li);
    });
  }

  renderList();
}

if (typeof window !== 'undefined') {
  window.initGeoScorePanel = initGeoScorePanel;
}

