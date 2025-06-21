// File: stats.js

import { auth, db, getCurrentUser, FieldValue } from './auth.js';

/** UTILS **/
function todayKey() {
    return new Date().toISOString().slice(0, 10);
}

// File: src/stats.js

async function ensureMoodConfig() {
    const user = getCurrentUser();
    if (!user) return [];

    // 1) Load the raw document (without unconditionally writing it back)
    const docRef = db
        .collection('users').doc(user.uid)
        .collection('settings').doc('metricsConfig');
    const snap = await docRef.get();
    const current = snap.exists ? snap.data().metrics || [] : [];

    // 2) If Mood is missing, insert it into your local copy
    let updated = current;
    if (!current.find(m => m.id === 'mood')) {
        updated = [{ id: 'mood', label: 'Mood Rating', unit: 'rating' }, ...current];
    }

    // 3) If the doc truly didn’t exist, save for the first time *only*
    if (!snap.exists) {
        await docRef.set({ metrics: updated }, { merge: true });
    } else if (updated !== current) {
        // If the user manually deleted Mood later, we *could* re-insert, but
        // you probably don’t want to overwrite their choice—so skip this write.
    }

    // 4) Label it for display
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

async function recordMetric(metricId, value, extra = null) {
    const user = getCurrentUser();
    if (!user) return;
    const ref = db
        .collection('users').doc(user.uid)
        .collection('dailyStats').doc(todayKey());

    const entry = { timestamp: Date.now(), value, extra };

    await ref.set({
        metrics: {
            [metricId]: FieldValue.arrayUnion(entry)   // ← use FieldValue here
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



/** CONFIG & ENTRY FORM RENDERERS **/
function applyUnitLabels(cfg) {
    cfg.unitLabel = {
        pounds: 'pounds',
        rating: 'rating out of 10',
        minutes: 'minutes',
        time_mmss: 'minutes and seconds'
    }[cfg.unit];
}

async function renderConfigForm() {
    // 1) Load current config and ensure Mood exists
    let config = await loadMetricsConfig();
    config = await ensureMoodConfig();
    config.forEach(applyUnitLabels);

    // 2) Inject the config form HTML
    const section = document.getElementById('metricsConfigSection');
    // File: src/stats.js, inside renderConfigForm()

    section.innerHTML = `
  <h4>Add New Metric</h4>
  <form id="configForm">
    <input type="text" id="metricLabel" placeholder="What are you measuring?" required>
    <label for="metricUnit" style="margin-left:8px;">Unit</label>
    <select id="metricUnit" required>
      <option value="pounds">pounds</option>
      <option value="rating">rating out of 10</option>
      <option value="minutes">minutes</option>
      <option value="time_mmss">minutes and seconds</option>
    </select>
    <button type="submit" style="margin-left:8px;">Add Metric</button>
  </form>
`;

    // 4) Handle form submission for adding new metrics
    document.getElementById('configForm').addEventListener('submit', async e => {
        e.preventDefault();
        const label = document.getElementById('metricLabel').value.trim();
        const unit = document.getElementById('metricUnit').value;
        if (!label || !unit) {
            alert('Please enter both label and unit.');
            return;
        }
        const id = label.toLowerCase().replace(/\W+/g, '_');
        const newMetric = { id, label, unit };

        const oldCfg = await loadMetricsConfig();
        await saveMetricsConfig([
            ...oldCfg.filter(m => m.id !== id),
            newMetric
        ]);

        await renderConfigForm();
        await renderStatsSummary();
    });
}

async function renderStatsSummary() {
    try {
        const config = await ensureMoodConfig();
        const allStats = await loadAllStats();

        const container = document.getElementById('genericStatsSummary');
        if (!container) return;
        container.innerHTML = '';

        // build percentile arrays
        const valuesByMetric = {};
        Object.values(allStats).forEach(dayMetrics => {
            Object.entries(dayMetrics).forEach(([metricId, entries]) => {
                const latest = entries.reduce((a, b) => a.timestamp > b.timestamp ? a : b);
                (valuesByMetric[metricId] = valuesByMetric[metricId] || []).push(latest.value);
            });
        });

        // table & headers
        const table = document.createElement('table');
        Object.assign(table.style, { width: '100%', borderCollapse: 'collapse', marginTop: '16px' });
        const thead = document.createElement('thead');
        const headerRow = document.createElement('tr');
        ['Metric', 'Today\'s Value', 'Percentile', 'Actions'].forEach(text => {
            const th = document.createElement('th');
            th.textContent = text;
            Object.assign(th.style, { borderBottom: '2px solid #444', textAlign: 'left', padding: '8px' });
            headerRow.appendChild(th);
        });
        thead.appendChild(headerRow);
        table.appendChild(thead);

        const tbody = document.createElement('tbody');
        const today = todayKey();

        for (const cfg of config) {
            applyUnitLabels(cfg);
            const entries = ((allStats[today] || {})[cfg.id]) || [];
            let displayValue = '—', pctText = '—';
            if (entries.length) {
                const latest = entries.reduce((a, b) => a.timestamp > b.timestamp ? a : b);
                if (cfg.unit === 'time_mmss') {
                    const m = Math.floor(latest.value),
                        s = String(Math.round((latest.value - m) * 60)).padStart(2, '0');
                    displayValue = `${m}:${s}`;
                } else {
                    displayValue = `${latest.value}`;
                }
                const pct = computePercentile(latest.value, valuesByMetric[cfg.id] || []);
                pctText = `${pct}th`;
            }

            const row = document.createElement('tr');
            // metric name
            const tdLabel = document.createElement('td');
            tdLabel.textContent = cfg.label;
            Object.assign(tdLabel.style, { padding: '8px', borderBottom: '1px solid #ddd' });
            row.appendChild(tdLabel);

            // today's value + edit
            const tdVal = document.createElement('td');
            Object.assign(tdVal.style, { padding: '8px', borderBottom: '1px solid #ddd' });
            const displaySpan = document.createElement('span');
            displaySpan.textContent = `${displayValue} ${cfg.unitLabel}`;
            displaySpan.style.marginRight = '8px';
            tdVal.appendChild(displaySpan);

            const pencil = document.createElement('span');
            pencil.textContent = '✏️';
            pencil.style.cursor = 'pointer';
            pencil.title = 'Edit today’s value';
            pencil.addEventListener('click', () => {
                tdVal.innerHTML = '';
                const inp = document.createElement('input');
                inp.type = cfg.unit === 'rating' ? 'number' : 'text';
                inp.value = displayValue;
                inp.style.width = '80px';
                tdVal.appendChild(inp);

                const saveIcon = document.createElement('span');
                saveIcon.textContent = '💾';
                saveIcon.style.cursor = 'pointer';
                saveIcon.style.marginLeft = '8px';
                saveIcon.title = 'Save';
                saveIcon.addEventListener('click', async () => {
                    console.log('💾 Save clicked:', cfg.id, inp.value);
                    let raw = inp.value.trim(), val;
                    if (!raw) return alert('Enter a value');
                    if (cfg.unit === 'time_mmss') {
                        const [m, s] = raw.split(':').map(n => parseInt(n, 10));
                        if (isNaN(m) || isNaN(s)) return alert('Bad MM:SS');
                        val = m + s / 60;
                    } else if (cfg.unit === 'rating') {
                        val = parseInt(raw, 10);
                        if (isNaN(val) || val < 1 || val > 10) return alert('Enter 1–10');
                    } else {
                        val = parseFloat(raw);
                        if (isNaN(val)) return alert('Invalid number');
                    }
                    try {
                        await recordMetric(cfg.id, val, null);
                        console.log('✅ recordMetric succeeded');
                        await renderStatsSummary();
                    } catch (err) {
                        console.error('❌ recordMetric error:', err);
                        alert('Save failed – check console');
                    }
                });
                tdVal.appendChild(saveIcon);

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

            // percentile
            const tdPct = document.createElement('td');
            tdPct.textContent = pctText;
            Object.assign(tdPct.style, { padding: '8px', borderBottom: '1px solid #ddd' });
            row.appendChild(tdPct);

            // metric actions (rename/delete)
            const tdAct = document.createElement('td');
            Object.assign(tdAct.style, { padding: '8px', borderBottom: '1px solid #ddd' });

            // rename
            const editBtn = document.createElement('button');
            editBtn.textContent = '✏️';
            editBtn.title = 'Rename metric';
            editBtn.style.marginRight = '8px';
            editBtn.addEventListener('click', async () => {
                const newLabel = prompt('New label for "' + cfg.label + '":', cfg.label);
                if (newLabel == null) return;
                const newUnit = prompt(
                    'Unit (pounds, rating, minutes, time_mmss):', cfg.unit
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
            tdAct.appendChild(editBtn);

            // delete (skip Mood)
            if (cfg.id !== 'mood') {
                const delBtn = document.createElement('button');
                delBtn.textContent = '❌';
                delBtn.title = 'Delete metric';
                delBtn.addEventListener('click', async () => {
                    if (!confirm(`Delete "${cfg.label}"?`)) return;
                    const filtered = (await loadMetricsConfig()).filter(m => m.id !== cfg.id);
                    await saveMetricsConfig(filtered);
                    await renderConfigForm();
                    await renderStatsSummary();
                });
                tdAct.appendChild(delBtn);
            }

            row.appendChild(tdAct);
            tbody.appendChild(row);
        }

        table.appendChild(tbody);
        container.appendChild(table);
    }
    catch (err) {
        console.error('renderStatsSummary failed:', err);
    }
}

async function initMetricsUI() {

    // 2) Ensure Mood metric exists in config
    await ensureMoodConfig();

    // 3) Render your forms and summary
    await renderConfigForm();
    await renderStatsSummary();
}



auth.onAuthStateChanged(user => {
    if (!user) return;
    if (document.readyState === 'loading')
        document.addEventListener('DOMContentLoaded', initMetricsUI);
    else initMetricsUI();
});
