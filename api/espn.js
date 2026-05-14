// /api/espn.js — Vercel serverless function
// Proxies ESPN golf API server-side, completely bypassing browser CORS restrictions.
// Called by the frontend as: /api/espn?event=401580356
// Or for scoreboard discovery: /api/espn?scoreboard=1

export default async function handler(req, res) {
  // Allow GET only
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { event, scoreboard } = req.query;

  let espnUrl;
  if (scoreboard) {
    // Used to auto-discover current tournament ESPN ID
    espnUrl = 'https://site.api.espn.com/apis/site/v2/sports/golf/pga/scoreboard';
  } else if (event) {
    // Main leaderboard fetch
    espnUrl = `https://site.api.espn.com/apis/site/v2/sports/golf/leaderboard?event=${event}`;
  } else {
    return res.status(400).json({ error: 'Missing event or scoreboard param' });
  }

  try {
    const response = await fetch(espnUrl, {
      headers: {
        // Mimic a browser request so ESPN doesn't block us
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': 'https://www.espn.com/',
        'Origin': 'https://www.espn.com'
      },
      signal: AbortSignal.timeout(12000)
    });

    if (!response.ok) {
      return res.status(response.status).json({
        error: `ESPN returned ${response.status}`,
        url: espnUrl
      });
    }

    const data = await response.json();

    // Cache response briefly — ESPN updates every few minutes anyway
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=120');
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(200).json(data);

  } catch (err) {
    console.error('ESPN proxy error:', err.message);
    return res.status(500).json({ error: err.message || 'Failed to fetch ESPN data' });
  }
}
