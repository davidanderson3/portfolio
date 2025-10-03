const express = require('express');
const path = require('path');

const app = express();
const port = Number(process.env.PORT) || 5500;
const host = process.env.HOST || 'localhost';
const publicDir = path.join(__dirname);

app.use(express.static(publicDir));

app.get('*', (req, res) => {
  res.sendFile(path.join(publicDir, 'index.html'));
});

app.listen(port, host, () => {
  console.log(`Portfolio running at http://${host}:${port}`);
});
