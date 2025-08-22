const QUESTIONS = [
  {
    question: 'Name a country that shares a land border with Germany.',
    answers: [
      { answer: 'France', score: 19 },
      { answer: 'Poland', score: 18 },
      { answer: 'Netherlands', score: 14 },
      { answer: 'Denmark', score: 11 },
      { answer: 'Austria', score: 10 },
      { answer: 'Belgium', score: 9 },
      { answer: 'Czech Republic', score: 8 },
      { answer: 'Switzerland', score: 6 },
      { answer: 'Luxembourg', score: 5 }
    ]
  },
  {
    question: 'Name a capital city in South America.',
    answers: [
      { answer: 'Buenos Aires', score: 18 },
      { answer: 'Brasília', score: 17 },
      { answer: 'Lima', score: 15 },
      { answer: 'Santiago', score: 13 },
      { answer: 'Bogotá', score: 11 },
      { answer: 'Caracas', score: 9 },
      { answer: 'Quito', score: 7 },
      { answer: 'Montevideo', score: 5 },
      { answer: 'Asunción', score: 5 }
    ]
  },
  {
    question: 'Name a U.S. state that borders the Pacific Ocean.',
    answers: [
      { answer: 'California', score: 35 },
      { answer: 'Washington', score: 25 },
      { answer: 'Oregon', score: 20 },
      { answer: 'Alaska', score: 10 },
      { answer: 'Hawaii', score: 10 }
    ]
  },
  {
    question: 'Name a landlocked African country.',
    answers: [
      { answer: 'Chad', score: 12 },
      { answer: 'Niger', score: 11 },
      { answer: 'Mali', score: 10 },
      { answer: 'Central African Republic', score: 10 },
      { answer: 'Botswana', score: 10 },
      { answer: 'Uganda', score: 9 },
      { answer: 'Zambia', score: 9 },
      { answer: 'Ethiopia', score: 9 },
      { answer: 'Zimbabwe', score: 8 },
      { answer: 'Burkina Faso', score: 12 }
    ]
  },
  {
    question: 'Name a country spanning both Europe and Asia.',
    answers: [
      { answer: 'Russia', score: 45 },
      { answer: 'Turkey', score: 25 },
      { answer: 'Kazakhstan', score: 15 },
      { answer: 'Azerbaijan', score: 8 },
      { answer: 'Georgia', score: 7 }
    ]
  }
];

export function initPointlessPanel() {
  const container = document.getElementById('pointlessGame');
  if (!container) return;
  container.innerHTML = '';

  let totalScore = 0;
  const totalEl = document.createElement('h3');
  totalEl.id = 'pointlessTotal';
  totalEl.textContent = 'Total score: 0';

  QUESTIONS.forEach((q, idx) => {
    const wrapper = document.createElement('div');
    wrapper.className = 'pointless-question';

    const title = document.createElement('h3');
    title.textContent = `Question ${idx + 1}: ${q.question}`;
    wrapper.appendChild(title);

    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = 'Your answer';
    wrapper.appendChild(input);

    const button = document.createElement('button');
    button.textContent = 'Submit';
    wrapper.appendChild(button);

    const result = document.createElement('div');
    result.className = 'pointless-result';
    wrapper.appendChild(result);

    button.addEventListener('click', () => {
      const ans = input.value.trim();
      if (!ans) return;
      const match = q.answers.find(a => a.answer.toLowerCase() === ans.toLowerCase());
      const score = match ? match.score : 100;
      totalScore += score;
      result.textContent = `Score: ${score}`;

      const list = document.createElement('ul');
      q.answers.forEach(a => {
        const li = document.createElement('li');
        li.textContent = `${a.answer}: ${a.score}`;
        list.appendChild(li);
      });
      result.appendChild(list);
      totalEl.textContent = `Total score: ${totalScore}`;
      button.disabled = true;
    });

    container.appendChild(wrapper);
  });

  container.appendChild(totalEl);
}

if (typeof window !== 'undefined') {
  window.initPointlessPanel = initPointlessPanel;
}

