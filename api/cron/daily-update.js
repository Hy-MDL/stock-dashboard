// Vercel Cron Job - Daily Stock Update
// This will be triggered automatically by Vercel Cron
import { updateAllStocks, saveRankHistory } from '../lib/fetcher.js';

export default async function handler(req, res) {
  // Verify cron secret to ensure only Vercel can trigger this
  const authHeader = req.headers.authorization;
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    console.log('Daily cron job started at', new Date().toISOString());

    // Update all stocks
    const stockResult = await updateAllStocks();
    console.log('Stock update result:', stockResult);

    // Save rank history
    const rankResult = await saveRankHistory();
    console.log('Rank history result:', rankResult);

    return res.status(200).json({
      message: 'Daily update completed successfully',
      timestamp: new Date().toISOString(),
      stocks_updated: stockResult.count
    });

  } catch (error) {
    console.error('Error in daily cron job:', error);
    return res.status(500).json({
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
}
