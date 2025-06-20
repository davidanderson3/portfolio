// dailyLog.js

/**
 * Display a summary of today's mood rating and percentile among all ratings.
 * @param {number} todayRating - The rating given today (1-10).
 * @param {number[]} allRatings - Array of all historical ratings.
 */
export function showRatingSummary(todayRating, allRatings) {
  const sorted = allRatings.slice().sort((a, b) => a - b);
  const belowCount = sorted.filter(r => r < todayRating).length;
  const percentile = Math.round((belowCount / sorted.length) * 100);

  // Find or create summary container
  let container = document.getElementById('dailyMoodSummary');
  if (!container) {
    container = document.createElement('div');
    container.id = 'dailyMoodSummary';
    Object.assign(container.style, {
      margin: '32px 0 0',
      padding: '16px',
      border: '2px solid #ccc',
      borderRadius: '10px',
      background: '#f7faff',
      fontSize: '0.95em',
      color: '#333'
    });

    const target = document.getElementById('hiddenList') || document.getElementById('completedList');
    if (target) target.parentNode.insertBefore(container, target);
    else document.body.appendChild(container);
  }

  // Use local date string for display
  const todayLabel = new Date().toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  container.innerHTML = `
    <h3 style="margin-top: 0;">Mood Summary for ${todayLabel}</h3>
    <p>Rating: <strong>${todayRating}/10</strong></p>
    <p>You're doing better than <strong>${percentile}%</strong> of your days.</p>
  `;
}

/**
 * Prompt the user to log their daily mood if not already done, storing log entries in Firestore.
 * Logs are keyed by local date strings (YYYY-MM-DD).
 * @param {object} currentUser - Firebase Auth user
 * @param {object} db - Firestore database instance
 */
export async function showDailyLogPrompt(currentUser, db) {
  if (!currentUser) return;

  // Use local date for key (YYYY-MM-DD, en-CA format)
  const todayKey = new Date().toLocaleDateString('en-CA');
  const docRef = db.collection('dailyLogs').doc(currentUser.uid);
  const docSnap = await docRef.get();
  const logs = docSnap.exists ? docSnap.data() : {};

  // If already logged today, show summary immediately
  if (logs[todayKey]) {
    const allRatings = Object.values(logs)
      .map(log => log.rating)
      .filter(val => typeof val === 'number');
    showRatingSummary(logs[todayKey].rating, allRatings);
    return;
  }

  // Show modal inputs
  const modal = document.getElementById('dailyLogModal');
  const ratingContainer = document.getElementById('dailyLogRating');
  const textInput = document.getElementById('dailyLogText');
  const submitBtn = document.getElementById('dailyLogSubmit');

  // Populate radio buttons 1-10 if not already
  if (ratingContainer.childElementCount === 0) {
    for (let i = 1; i <= 10; i++) {
      const label = document.createElement('label');
      label.textContent = i;
      const radio = document.createElement('input');
      radio.type = 'radio';
      radio.name = 'dailyRating';
      radio.value = String(i);
      label.appendChild(radio);
      ratingContainer.appendChild(label);
    }
  }

  modal.style.display = 'flex';

  submitBtn.onclick = async () => {
    const selected = document.querySelector('input[name="dailyRating"]:checked');
    const rating = selected ? Number(selected.value) : null;
    const explanation = textInput.value.trim();

    if (!rating) {
      alert('Please select a rating.');
      return;
    }

    // Build updated logs, storing timestamp in local string
    const updatedLogs = {
      ...logs,
      [todayKey]: {
        rating,
        explanation,
        timestamp: new Date().toLocaleString()
      }
    };

    await docRef.set(updatedLogs);

    const allRatings = Object.values(updatedLogs)
      .map(log => log.rating)
      .filter(val => typeof val === 'number');

    showRatingSummary(rating, allRatings);

    // Close modal and reset inputs
    modal.style.display = 'none';
    textInput.value = '';
    if (selected) selected.checked = false;
    submitBtn.disabled = true;
    submitBtn.textContent = 'Submitted';
  };
}
