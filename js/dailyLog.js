export function showRatingSummary(todayRating, allRatings) {
  const sorted = allRatings.slice().sort((a, b) => a - b);
  const belowCount = sorted.filter(r => r < todayRating).length;
  const percentile = Math.round((belowCount / sorted.length) * 100);

  let container = document.getElementById('dailyMoodSummary');
  if (!container) {
    container = document.createElement('div');
    container.id = 'dailyMoodSummary';
    container.style.margin = '32px 0 0';
    container.style.padding = '16px';
    container.style.border = '2px solid #ccc';
    container.style.borderRadius = '10px';
    container.style.background = '#f7faff';
    container.style.fontSize = '0.95em';
    container.style.color = '#333';

    const target = document.getElementById('hiddenList') || document.getElementById('completedList');
    if (target) {
      target.parentNode.insertBefore(container, target);
    } else {
      document.body.appendChild(container);
    }
  }

  container.innerHTML = `
    <h3 style="margin-top: 0;">Today's Rating</h3>
    <p>Rating: <strong>${todayRating}/10</strong></p>
    <p>You're doing better than <strong>${percentile}%</strong> of your days.</p>
  `;
}

export async function showDailyLogPrompt(currentUser, db) {
  if (!currentUser) return;

  const todayKey = new Date().toISOString().split('T')[0];
  const docRef = db.collection('dailyLogs').doc(currentUser.uid);
  const docSnap = await docRef.get();
  const logs = docSnap.exists ? docSnap.data() : {};

  // Always show summary if already logged
  if (logs[todayKey]) {
    const allRatings = Object.values(logs)
      .map(log => log.rating)
      .filter(val => typeof val === 'number');
    showRatingSummary(logs[todayKey].rating, allRatings);
    return;
  }

  // Show modal
  const modal = document.getElementById('dailyLogModal');
  const ratingContainer = document.getElementById('dailyLogRating');
  const textInput = document.getElementById('dailyLogText');
  const submitBtn = document.getElementById('dailyLogSubmit');

  // Populate radio buttons if not already
  if (ratingContainer.childElementCount === 0) {
    for (let i = 1; i <= 10; i++) {
      const label = document.createElement('label');
      label.innerHTML = `${i}<input type="radio" name="dailyRating" value="${i}" />`;
      ratingContainer.appendChild(label);
    }
  }

  modal.style.display = 'flex';

  submitBtn.onclick = async () => {
    const selected = document.querySelector('input[name="dailyRating"]:checked');
    const rating = selected ? parseInt(selected.value) : null;
    const explanation = textInput.value.trim();

    if (!rating) {
      alert("Please select a rating.");
      return;
    }

    const updatedLogs = {
      ...logs,
      [todayKey]: {
        rating,
        explanation,
        timestamp: new Date().toISOString()
      }
    };

    await docRef.set(updatedLogs);

    const allRatings = Object.values(updatedLogs)
      .map(log => log.rating)
      .filter(val => typeof val === 'number');

    showRatingSummary(rating, allRatings);

    modal.style.display = 'none';
    textInput.value = '';
    selected.checked = false;

    submitBtn.disabled = true;
    submitBtn.textContent = 'Submitted';
  };
}
