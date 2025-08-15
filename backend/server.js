const express = require('express');
const path = require('path');
const fs = require('fs');
const { Configuration, PlaidApi, PlaidEnvironments } = require('plaid');
const { XMLParser } = require('fast-xml-parser');
const app = express();
const PORT = 3002;

app.use(express.json());

const plaidClient = (() => {
  const clientID = process.env.PLAID_CLIENT_ID;
  const secret = process.env.PLAID_SECRET;
  const env = process.env.PLAID_ENV || 'sandbox';
  if (!clientID || !secret) return null;
  const config = new Configuration({
    basePath: PlaidEnvironments[env],
    baseOptions: {
      headers: {
        'PLAID-CLIENT-ID': clientID,
        'PLAID-SECRET': secret
      }
    }
  });
  return new PlaidApi(config);
})();

// Serve static files (like index.html, style.css, script.js)
app.use(express.static(path.resolve(__dirname, '../')));

// Enable CORS (optional for Firebase, useful for local testing)
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  next();
});

// --- GeoLayers game endpoints ---
const layerOrder = ['rivers','lakes','elevation','roads','outline','cities','label'];
const locations = ['USA','CAN','MEX'];
const leaderboard = [];
const countryNames = { USA:'United States', CAN:'Canada', MEX:'Mexico' };

function dailySeed() {
  const today = new Date().toISOString().slice(0,10);
  let seed = 0;
  for (const c of today) {
    seed = (seed * 31 + c.charCodeAt(0)) >>> 0;
  }
  return seed;
}

function pickLocation() {
  const seed = dailySeed();
  return locations[seed % locations.length];
}

app.get('/daily', (req, res) => {
  const loc = pickLocation();
  res.json({
    locationId: loc,
    layers: layerOrder.map(l => `/layer/${loc}/${l}`)
  });
});

app.get('/countries', (req, res) => {
  const list = Object.entries(countryNames).map(([code, name]) => ({ code, name }));
  res.json(list);
});

app.get('/layer/:loc/:name', (req, res) => {
  const file = path.join(__dirname, '../geolayers-game/data', req.params.loc, `${req.params.name}.geojson`);
  fs.readFile(file, 'utf8', (err, data) => {
    if (err) return res.status(404).send('Layer not found');
    res.type('application/json').send(data);
  });
});

app.post('/score', (req, res) => {
  const { playerName, score } = req.body || {};
  if (typeof playerName === 'string' && typeof score === 'number') {
    leaderboard.push({ playerName, score });
    leaderboard.sort((a, b) => b.score - a.score);
    res.json({ status: 'ok' });
  } else {
    res.status(400).json({ error: 'invalid' });
  }
});

app.get('/leaderboard', (req, res) => {
  res.json(leaderboard.slice(0, 10));
});

app.get('/api/movies', async (req, res) => {
  try {
    const rssUrl = 'https://www.fandango.com/rss/moviesnearme_20190.rss';
    const rssText = await fetch(rssUrl).then(r => r.text());
    const parser = new XMLParser();
    const rss = parser.parse(rssText);
    const items = rss?.rss?.channel?.item || [];
    const results = [];

    for (const item of items) {
      const title = item.title;
      try {
        const searchUrl = `https://www.rottentomatoes.com/api/private/v2.0/search?q=${encodeURIComponent(title)}`;
        const searchData = await fetch(searchUrl).then(r => r.json());
        const movie = searchData?.movies?.find(m => m.name?.toLowerCase() === title.toLowerCase());
        if (!movie) continue;
        const score = Number(movie.meterScore || movie.rottenTomatoesScore);
        const reviews = Number(movie.reviewCount || movie.rottenTomatoesScoreReviews);
        if (score >= 88 && reviews >= 20) {
          results.push({
            title: movie.name,
            score,
            reviews,
            url: `https://www.rottentomatoes.com${movie.url || movie.urlPath || ''}`
          });
        }
      } catch (err) {
        console.error('Failed to fetch movie from Rotten Tomatoes', err);
      }
    }

    res.json(results);
  } catch (err) {
    console.error('Failed to fetch movies', err);
    res.status(500).json({ error: 'Failed to fetch movies' });
  }
});

app.get('/api/transactions', async (req, res) => {
  if (!plaidClient || !process.env.PLAID_ACCESS_TOKEN) {
    res.status(500).json({ error: 'Plaid not configured' });
    return;
  }
  try {
    const start = new Date();
    start.setMonth(start.getMonth() - 1);
    const end = new Date();
    const response = await plaidClient.transactionsGet({
      access_token: process.env.PLAID_ACCESS_TOKEN,
      start_date: start.toISOString().slice(0, 10),
      end_date: end.toISOString().slice(0, 10)
    });
    res.json(response.data);
  } catch (err) {
    console.error('Plaid error', err);
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
});

const server = app.listen(PORT, () => {
  console.log(`✅ Serving static files at http://localhost:${PORT}`);
});

module.exports = server;

