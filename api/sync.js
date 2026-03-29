import { updateAllStocks, saveRankHistory } from './lib/fetcher.js';

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('Starting data sync...');

    // Update all stocks
    await updateAllStocks();

    // Save rank history
    await saveRankHistory();

    return res.status(200).json({
      message: 'Data sync completed successfully',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error in /api/sync:', error);
    return res.status(500).json({ error: error.message });
  }
}
