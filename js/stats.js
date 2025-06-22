// File: stats.js

import { auth, db, getCurrentUser, FieldValue } from './auth.js';

/**
 * Returns today’s date key in YYYY-MM-DD using local time.
 */
function todayKey() {
    const d = new Date();
    const year  = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day   = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}


// File: src/stats.js

async function ensureMoodConfig() {
    const user = getCurrentUser();
    if (!user) return [];

    const docRef = db
        .collection('users').doc(user.uid)
        .collection('settings').doc('metricsConfig');
    const snap = await docRef.get();
    const current = snap.exists ? snap.data().metrics || [] : [];

    let updated = current;

    // 1) Ensure Mood Rating exists
    if (!updated.find(m => m.id === 'mood')) {
        updated = [{ id: 'mood', label: 'Mood Rating', unit: 'rating' }, ...updated];
    }

    // 2) Ensure a basic Count metric exists
    if (!updated.find(m => m.id === 'count')) {
        updated = [...updated, { id: 'count', label: 'Count', unit: 'count' }];
    }

    // 3) If the doc didn’t exist, write it once
    if (!snap.exists) {
        await docRef.set({ metrics: updated }, { merge: true });
    }

    // 4) Apply display labels and return
    updated.forEach(applyUnitLabels);
    return updated;
}



/** FIRESTORE LOADERS & SAVERS **/
async function loadMetricsConfig() {
    const user = auth.currentUser;
    if (!user) throw new Error('Not signed in');
    const snap = await db
        .collection('users').doc(user.uid)
        .collection('settings').doc('metricsConfig')
        .get();
    return snap.exists ? snap.data().metrics : [];
}

async function saveMetricsConfig(metrics) {
    await safeSaveMetricsConfig(() => metrics);
}

/**
 * Safely saves metricsConfig by merging into the existing doc.
 *
 * @param {(oldCfg: Array) => Array} merger
 *   A function that receives the *existing* metrics array and returns the new one.
 */
async function safeSaveMetricsConfig(merger) {
    const user = getCurrentUser();
    if (!user) return;

    // 1) Load whatever is currently saved
    const docRef = db
        .collection('users').doc(user.uid)
        .collection('settings').doc('metricsConfig');
    const snap = await docRef.get();
    const oldMetrics = snap.exists ? snap.data().metrics || [] : [];

    // 2) Let caller produce the updated array
    const newMetrics = merger(oldMetrics.slice());

    // 3) Only write *if* something actually changed
    const same =
        oldMetrics.length === newMetrics.length &&
        oldMetrics.every((m, i) => JSON.stringify(m) === JSON.stringify(newMetrics[i]));
    if (same) return;

    // 4) Merge-write back your new array
    await docRef.set({ metrics: newMetrics }, { merge: true });
}

/**
 * Save a metric entry (with local-date key) for the current user.
 *
 * @param {string} metricId
 * @param {number|string} value
 * @param {any} extra
 */
async function recordMetric(metricId, value, extra = null) {
    const user = getCurrentUser();
    if (!user) return;

    // Use local-date key for grouping
    const ref = db
        .collection('users').doc(user.uid)
        .collection('dailyStats').doc(todayKey());

    const entry = {
        timestamp: Date.now(),
        value,
        extra
    };

    await ref.set({
        metrics: {
            [metricId]: FieldValue.arrayUnion(entry)
        }
    }, { merge: true });
}


// … rest of your code …


async function loadAllStats() {
    const user = auth.currentUser;
    if (!user) return {};
    const snaps = await db
        .collection('users').doc(user.uid)
        .collection('dailyStats')
        .get();
    const out = {};
    snaps.forEach(doc => out[doc.id] = doc.data().metrics || {});
    return out;
}


/** PERCENTILE & SUMMARY RENDER **/
function computePercentile(val, allValues) {
    const sorted = allValues.slice().sort((a, b) => a - b);
    const below = sorted.filter(v => v < val).length;
    return Math.round((below / sorted.length) * 100);
}

function applyUnitLabels(cfg) {
    cfg.unitLabel = {
        pounds:    'pounds',
        rating:    'rating out of 10',
        minutes:   'minutes',
        time_mmss: 'minutes and seconds',
        list:      'list',
        count:     'count'
    }[cfg.unit] || cfg.unit;
}

// File: src/stats.js

async function renderStatsSummary() {
  try {
    // Inject “all-complete” animation CSS once
    if (!document.getElementById('stats-complete-css')) {
      const style = document.createElement('style');
      style.id = 'stats-complete-css';
      style.textContent = `
        @keyframes pulse {
          0%   { transform: scale(1); }
          50%  { transform: scale(1.05); }
          100% { transform: scale(1); }
        }
        .all-complete {
          animation: pulse 0.8s ease-in-out 3;
        }
      `;
      document.head.appendChild(style);
    }

    // 1) Load exactly the user’s saved metrics (so deletions stick)
    const config = await loadMetricsConfig();
    config.forEach(applyUnitLabels);

    // 2) Load all recorded stats
    const allStats = await loadAllStats();

    // 3) Build a map of metricId → unit
    const unitByMetric = config.reduce((acc, m) => {
      acc[m.id] = m.unit;
      return acc;
    }, {});

    // 4) Gather past values for percentiles
    const valuesByMetric = {};
    Object.values(allStats).forEach(dayMetrics => {
      Object.entries(dayMetrics).forEach(([metricId, entries]) => {
        const latest = entries.reduce((a, b) => a.timestamp > b.timestamp ? a : b);
        let metricValue = latest.value;
        if (unitByMetric[metricId] === 'list' && typeof metricValue === 'string') {
          metricValue = metricValue
            .split('\n')
            .filter(line => line.trim() !== '')
            .length;
        }
        (valuesByMetric[metricId] = valuesByMetric[metricId] || []).push(metricValue);
      });
    });

    // 5) Prepare the container
    const container = document.getElementById('genericStatsSummary');
    if (!container) return;
    container.innerHTML = '';

    // 6) Build table header
    const table = document.createElement('table');
    Object.assign(table.style, {
      width: '100%',
      borderCollapse: 'collapse',
      marginTop: '16px'
    });

    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    ['Metric', 'Today’s Value', 'Percentile', 'Actions'].forEach(text => {
      const th = document.createElement('th');
      th.textContent = text;
      Object.assign(th.style, {
        borderBottom: '2px solid #444',
        textAlign: 'left',
        padding: '8px'
      });
      headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);
    table.appendChild(thead);

    // 7) Populate each metric row
    const tbody = document.createElement('tbody');
    const today = todayKey();
    let visibleCount = 0, filledCount = 0;

    for (const cfg of config) {
      applyUnitLabels(cfg);

      // Today's entries for this metric
      const entries = ((allStats[today] || {})[cfg.id]) || [];

      // If postponed today, skip entirely
      if (entries.some(e => e.extra && e.extra.postponed)) {
        continue;
      }
      visibleCount++;

      let displayValue = '—', pctText = '—';

      if (entries.length) {
        filledCount++;
        const latest = entries.reduce((a, b) => a.timestamp > b.timestamp ? a : b);
        let actualValue;

        if (cfg.unit === 'time_mmss') {
          const m = Math.floor(latest.value),
                s = String(Math.round((latest.value - m) * 60)).padStart(2, '0');
          displayValue = `${m}:${s}`;
          actualValue = latest.value;

        } else if (cfg.unit === 'list' && typeof latest.value === 'string') {
          displayValue = latest.value;
          actualValue = latest.value
            .split('\n')
            .filter(line => line.trim() !== '')
            .length;

        } else {
          displayValue = `${latest.value}`;
          actualValue = latest.value;
        }

        const pct = computePercentile(actualValue, valuesByMetric[cfg.id] || []);
        pctText = `${pct}th`;
      }

      const row = document.createElement('tr');

      // — Metric Name
      const tdLabel = document.createElement('td');
      tdLabel.textContent = cfg.label;
      Object.assign(tdLabel.style, { padding: '8px', borderBottom: '1px solid #ddd' });
      row.appendChild(tdLabel);

      // — Today’s Value + Edit Icon
      const tdVal = document.createElement('td');
      Object.assign(tdVal.style, { padding: '8px', borderBottom: '1px solid #ddd' });

      const displaySpan = document.createElement('span');
      displaySpan.textContent = `${displayValue} ${cfg.unitLabel}`;
      displaySpan.style.marginRight = '8px';
      tdVal.appendChild(displaySpan);

      // Edit pencil
      const pencil = document.createElement('span');
      pencil.textContent = '✏️';
      pencil.style.cursor = 'pointer';
      pencil.title = 'Edit today’s value';
      pencil.addEventListener('click', () => {
        tdVal.innerHTML = '';

        // Choose input type
        let inp;
        if (cfg.unit === 'rating') {
          inp = document.createElement('input');
          inp.type = 'number';
          inp.min = '1'; inp.max = '10'; inp.step = '1';
          inp.placeholder = '1–10';
        } else if (cfg.unit === 'list') {
          inp = document.createElement('textarea');
          inp.rows = 4;
          inp.style.width = '100%';
          inp.placeholder = cfg.unitLabel;
        } else {
          inp = document.createElement('input');
          inp.type = 'text';
          inp.placeholder = cfg.unitLabel;
        }
        inp.value = displayValue;
        tdVal.appendChild(inp);

        // Save icon
        const saveIcon = document.createElement('span');
        saveIcon.textContent = '💾';
        saveIcon.style.cursor = 'pointer';
        saveIcon.style.marginLeft = '8px';
        saveIcon.title = 'Save';
        saveIcon.addEventListener('click', async () => {
          const raw = inp.value.trim();
          let val;
          if (!raw) return alert('Enter a value');
          if (cfg.unit === 'time_mmss') {
            const [m, s] = raw.split(':').map(n => parseInt(n, 10));
            if (isNaN(m) || isNaN(s)) return alert('Bad MM:SS');
            val = m + s / 60;
          } else if (cfg.unit === 'rating') {
            val = parseInt(raw, 10);
            if (isNaN(val) || val < 1 || val > 10) return alert('Enter 1–10');
          } else if (cfg.unit === 'list') {
            val = raw;
          } else {
            val = parseFloat(raw);
            if (isNaN(val)) return alert('Invalid number');
          }
          await recordMetric(cfg.id, val, null);
          await renderStatsSummary();
        });
        tdVal.appendChild(saveIcon);

        // Cancel icon
        const cancel = document.createElement('span');
        cancel.textContent = '❌';
        cancel.style.cursor = 'pointer';
        cancel.style.marginLeft = '4px';
        cancel.title = 'Cancel';
        cancel.addEventListener('click', () => renderStatsSummary());
        tdVal.appendChild(cancel);
      });
      tdVal.appendChild(pencil);
      row.appendChild(tdVal);

      // — Percentile
      const tdPct = document.createElement('td');
      tdPct.textContent = pctText;
      Object.assign(tdPct.style, { padding: '8px', borderBottom: '1px solid #ddd' });
      row.appendChild(tdPct);

      // — Actions: Postpone, Rename & Delete
      const tdAct = document.createElement('td');
      Object.assign(tdAct.style, { padding: '8px', borderBottom: '1px solid #ddd' });

      // Postpone ⏭️
      const postponeIcon = document.createElement('span');
      postponeIcon.textContent = '⏭️';
      postponeIcon.style.cursor = 'pointer';
      postponeIcon.style.marginRight = '8px';
      postponeIcon.title = 'Postpone until tomorrow';
      postponeIcon.addEventListener('click', async () => {
        await recordMetric(cfg.id, null, { postponed: true });
        await renderStatsSummary();
      });
      tdAct.appendChild(postponeIcon);

      // Rename ✏️
      const editIcon = document.createElement('span');
      editIcon.textContent = '✏️';
      editIcon.style.cursor = 'pointer';
      editIcon.style.marginRight = '8px';
      editIcon.title = 'Rename metric';
      editIcon.addEventListener('click', async () => {
        const newLabel = prompt(`New label for "${cfg.label}":`, cfg.label);
        if (newLabel == null) return;
        const newUnit = prompt(
          `New unit for "${cfg.label}"? (pounds, rating, minutes, time_mmss, list, count)`,
          cfg.unit
        );
        if (newUnit == null) return;
        const updated = (await loadMetricsConfig()).map(m =>
          m.id === cfg.id
            ? { id: m.id, label: newLabel.trim(), unit: newUnit.trim() }
            : m
        );
        await saveMetricsConfig(updated);
        await renderConfigForm();
        await renderStatsSummary();
      });
      tdAct.appendChild(editIcon);

      // Delete ❌
      if (cfg.id !== 'mood') {
        const deleteIcon = document.createElement('span');
        deleteIcon.textContent = '❌';
        deleteIcon.style.cursor = 'pointer';
        deleteIcon.title = 'Delete metric';
        deleteIcon.addEventListener('click', async () => {
          if (!confirm(`Delete metric "${cfg.label}"?`)) return;
          const filtered = (await loadMetricsConfig()).filter(m => m.id !== cfg.id);
          await saveMetricsConfig(filtered);
          await renderConfigForm();
          await renderStatsSummary();
        });
        tdAct.appendChild(deleteIcon);
      }

      row.appendChild(tdAct);
      tbody.appendChild(row);
    }

    table.appendChild(tbody);
    container.appendChild(table);

    // 8) If all visible metrics are filled, trigger the animation
    if (visibleCount > 0 && visibleCount === filledCount) {
      table.classList.add('all-complete');
      setTimeout(() => table.classList.remove('all-complete'), 2500);
    }

  } catch (err) {
    console.error('renderStatsSummary failed:', err);
  }
}




async function renderConfigForm() {
    // 1) Load the user’s saved metrics, then re-seed defaults (mood + count)
    let config = await loadMetricsConfig();
    config = await ensureMoodConfig();
    config.forEach(applyUnitLabels);

    // 2) Build the “Add New Metric” form
    const section = document.getElementById('metricsConfigSection');
    section.innerHTML = `
      <h4>Add New Metric</h4>
      <form id="configForm">
        <input
          type="text"
          id="metricLabel"
          placeholder="What are you measuring?"
          required
        >
        <label for="metricUnit" style="margin-left:8px;">
          Unit
        </label>
        <select id="metricUnit" required>
          <option value="pounds">pounds</option>
          <option value="rating">rating out of 10</option>
          <option value="minutes">minutes</option>
          <option value="time_mmss">minutes and seconds MM:SS</option>
          <option value="list">list</option>
          <option value="count">count</option>
        </select>
        <button type="submit" style="margin-left:8px;">
          Add Metric
        </button>
      </form>
    `;

    // 3) Wire up the form submit to save the new metric
    document
      .getElementById('configForm')
      .addEventListener('submit', async e => {
        e.preventDefault();

        const label = document
          .getElementById('metricLabel')
          .value
          .trim();
        const unit = document
          .getElementById('metricUnit')
          .value;

        if (!label || !unit) {
          alert('Please enter both label and unit.');
          return;
        }

        const id = label
          .toLowerCase()
          .replace(/\W+/g, '_');
        const newMetric = { id, label, unit };

        // 4) Merge into existing config
        const oldCfg = await loadMetricsConfig();
        await saveMetricsConfig([
          ...oldCfg.filter(m => m.id !== id),
          newMetric
        ]);

        // 5) Re-draw both the form and the stats table
        await renderConfigForm();
        await renderStatsSummary();
      });
}




async function initMetricsUI() {
    await ensureMoodConfig();
    await renderStatsSummary();   // ← stats table first
    await renderConfigForm();     // ← then “Add New Metric”
}

auth.onAuthStateChanged(user => {
    if (!user) return;
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initMetricsUI);
    } else {
        initMetricsUI();
    }
});




auth.onAuthStateChanged(user => {
    if (!user) return;
    if (document.readyState === 'loading')
        document.addEventListener('DOMContentLoaded', initMetricsUI);
    else initMetricsUI();
});
