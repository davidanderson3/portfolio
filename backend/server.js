const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();
const PORT = 3001;

const DATA_FILE = path.join(__dirname, '../decisions.json');
app.use(express.static(path.join(__dirname, '../frontend')));

// Enable CORS for local frontend
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*'); // Change to your frontend origin if needed
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  next();
});

// GET /decisions → return saved decisions
app.get('/decisions', (req, res) => {
  fs.readFile(DATA_FILE, 'utf8', (err, data) => {
    if (err || !data) return res.json([]);
    try {
      res.json(JSON.parse(data));
    } catch (e) {
      res.status(500).json({ error: 'Corrupted data file' });
    }
  });
});

// POST /decisions → overwrite decisions.json with new data
app.post('/decisions', (req, res) => {
  const decisions = req.body;
  if (!Array.isArray(decisions)) {
    return res.status(400).json({ error: 'Expected an array of decisions' });
  }

  fs.writeFile(DATA_FILE, JSON.stringify(decisions, null, 2), 'utf8', (err) => {
    if (err) {
      console.error('❌ Failed to save:', err);
      return res.status(500).json({ error: 'Failed to save decisions' });
    }
    res.json({ success: true });
  });
});

app.listen(PORT, () => {
  console.log(`✅ Decision backend running at http://localhost:${PORT}`);
});
