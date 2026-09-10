const path = require('path');
const express = require('express');
const cors = require('cors');
const { nanoid } = require('nanoid');
const QRCode = require('qrcode');

const app = express();
const PORT = process.env.PORT || 3000;

function publicOrigin(req) {
  const configured = process.env.PUBLIC_BASE_URL || 'https://caplinking.vercel.app';
  return configured.replace(/\/$/, '') || `${req.protocol}://${req.get('host')}`;
}

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Explicitly serve the SPA entry page. This is required when Vercel routes
// the root request through the Node function instead of its static builder.
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// In-memory storage (replace with DB for production)
let links = [];
let clickCounts = {};

// Helper: generate short code
function generateShortCode(customSlug) {
  if (customSlug && customSlug.trim() !== '') {
    const exists = links.some(l => l.shortCode === customSlug);
    if (exists) throw new Error('Custom alias already taken');
    return customSlug;
  }
  return nanoid(6);
}

// Helper: check expiry
function isExpired(link) {
  if (!link.expiryDate) return false;
  return new Date() > new Date(link.expiryDate);
}

// API: create short link
app.post('/api/shorten', (req, res) => {
  try {
    const { originalUrl, customSlug, expiryDays } = req.body;
    if (!originalUrl) return res.status(400).json({ error: 'Original URL required' });

    // Validate URL
    try { new URL(originalUrl); } catch { return res.status(400).json({ error: 'Invalid URL' }); }

    const shortCode = generateShortCode(customSlug);
    const expiryDate = expiryDays && expiryDays > 0 ? new Date(Date.now() + expiryDays * 86400000) : null;

    const newLink = {
      id: nanoid(),
      shortCode,
      originalUrl,
      expiryDate,
      createdAt: new Date().toISOString(),
    };
    links.push(newLink);
    clickCounts[shortCode] = 0;

    res.json({
      shortCode,
      shortUrl: `${publicOrigin(req)}/${shortCode}`,
      originalUrl,
      expiryDate: expiryDate ? expiryDate.toISOString() : null,
      createdAt: newLink.createdAt,
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Redirect route
app.get('/:shortCode', (req, res) => {
  const { shortCode } = req.params;
  const link = links.find(l => l.shortCode === shortCode);
  if (!link) return res.status(404).send('Link not found');
  if (isExpired(link)) return res.status(410).send('Link expired');

  clickCounts[shortCode] = (clickCounts[shortCode] || 0) + 1;
  res.redirect(link.originalUrl);
});

// API: get all links
app.get('/api/links', (req, res) => {
  const result = links.map(l => ({
    ...l,
    clicks: clickCounts[l.shortCode] || 0,
    expired: isExpired(l),
  }));
  res.json(result);
});

// API: delete all links
app.delete('/api/links', (req, res) => {
  links = [];
  clickCounts = {};
  res.json({ success: true });
});

// API: get QR code for a shortCode
app.get('/api/qr/:shortCode', async (req, res) => {
  const { shortCode } = req.params;
  const link = links.find(l => l.shortCode === shortCode);
  if (!link) return res.status(404).json({ error: 'Link not found' });

  const url = `${publicOrigin(req)}/${shortCode}`;
  try {
    const qrBuffer = await QRCode.toBuffer(url, { type: 'png', margin: 1 });
    res.set('Content-Type', 'image/png');
    res.send(qrBuffer);
  } catch (err) {
    res.status(500).json({ error: 'QR generation failed' });
  }
});

// Start a local server only when running outside Vercel.
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`CapLink server running on port ${PORT}`);
  });
}

module.exports = app;
