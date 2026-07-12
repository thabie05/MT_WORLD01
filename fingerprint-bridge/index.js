// Bridges the kiosk browser <-> the local Java/SourceAFIS matcher service
// (Main.java, running on 127.0.0.1:8787). Kept as a separate thin layer
// (rather than having the browser call Java directly) so we have one place
// to add auth, logging, or swap the matching engine later without touching
// the kiosk UI.
//
// Requires Node.js 18+ (uses the built-in global `fetch`).

const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' })); // fingerprint PNGs are small; this just leaves headroom

const MATCHER_URL = process.env.MATCHER_URL || 'http://127.0.0.1:8787';

async function forward(req, res, path) {
  try {
    const response = await fetch(`${MATCHER_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body),
    });
    const data = await response.json();
    res.status(response.status).json(data);
  } catch (err) {
    console.error(`Failed to reach matcher service for ${path}:`, err);
    res.status(502).json({ error: 'Fingerprint matching service is not reachable. Is the Java matcher (Main.java) running?' });
  }
}

app.post('/enroll', (req, res) => forward(req, res, '/enroll'));
app.post('/identify', (req, res) => forward(req, res, '/identify'));

app.get('/health', async (req, res) => {
  try {
    const response = await fetch(`${MATCHER_URL}/health`);
    const data = await response.json();
    res.json({ bridge: 'ok', matcher: data });
  } catch (err) {
    res.status(502).json({ bridge: 'ok', matcher: 'unreachable' });
  }
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, '127.0.0.1', () => {
  console.log(`Fingerprint bridge server running on http://127.0.0.1:${PORT}`);
  console.log(`Forwarding to matcher at ${MATCHER_URL}`);
});