import { supabase } from '../lib/supabase.js';

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { week_number } = req.query;

  try {
    const { data: week, error: weekError } = await supabase
      .from('week')
      .select('*')
      .eq('week_number', week_number)
      .single();

    if (weekError || !week) {
      return res.status(404).json({ detail: 'Week not found' });
    }

    // Buy price: week start open
    const { data: buyPriceRecord } = await supabase
      .from('daily_price')
      .select('*')
      .eq('ticker', '^KS11')
      .gte('date', week.week_start)
      .order('date', { ascending: true })
      .limit(1)
      .single();

    if (!buyPriceRecord) {
      return res.status(200).json(null);
    }

    const buyPrice = buyPriceRecord.open;

    // Get all daily prices for this week for chart
    const now = new Date();
    let dailyPrices;

    if (now > new Date(week.week_end)) {
      const { data } = await supabase
        .from('daily_price')
        .select('*')
        .eq('ticker', '^KS11')
        .gte('date', week.week_start)
        .lte('date', week.week_end)
        .order('date', { ascending: true });
      dailyPrices = data;
    } else {
      const { data } = await supabase
        .from('daily_price')
        .select('*')
        .eq('ticker', '^KS11')
        .gte('date', week.week_start)
        .order('date', { ascending: true });
      dailyPrices = data;
    }

    if (!dailyPrices || dailyPrices.length === 0) {
      return res.status(200).json(null);
    }

    const currentPrice = dailyPrices[dailyPrices.length - 1].close;
    const yieldPct = ((currentPrice - buyPrice) / buyPrice) * 100;

    return res.status(200).json({
      buy_price: Math.round(buyPrice * 100) / 100,
      current_price: Math.round(currentPrice * 100) / 100,
      yield: Math.round(yieldPct * 100) / 100,
      daily_data: dailyPrices.map(p => ({
        date: p.date,
        price: Math.round(p.close * 100) / 100
      }))
    });

  } catch (error) {
    console.error(`Error in /api/kospi/${week_number}:`, error);
    return res.status(500).json({ error: error.message });
  }
}
