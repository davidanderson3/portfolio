const express = require('express');
const path = require('path');
const app = express();
const PORT = 3001;

// Serve static files (like index.html, style.css, script.js)
app.use(express.static(path.resolve(__dirname, '../')));

// Enable CORS (optional for Firebase, useful for local testing)
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  next();
});

app.listen(PORT, () => {
  console.log(`✅ Serving static files at http://localhost:${PORT}`);
});

// 👇 Prevent Node from exiting
setInterval(() => { }, 1000);
