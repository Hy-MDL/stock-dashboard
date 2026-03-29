import { supabase } from './lib/supabase.js';

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

  try {
    const { week_number } = req.query;
    let week;

    if (!week_number) {
      // Get latest week
      const { data, error } = await supabase
        .from('week')
        .select('*')
        .order('week_number', { ascending: false })
        .limit(1)
        .single();

      if (error || !data) {
        return res.status(200).json([]);
      }
      week = data;
    } else {
      // Get specific week
      const { data, error } = await supabase
        .from('week')
        .select('*')
        .eq('week_number', week_number)
        .single();

      if (error || !data) {
        return res.status(200).json([]);
      }
      week = data;
    }

    // Get first trading day for this week (0일차)
    const { data: firstTradingDay } = await supabase
      .from('daily_price')
      .select('date')
      .eq('ticker', '^KS11')
      .gte('date', week.week_start)
      .lte('date', week.week_end)
      .order('date', { ascending: true })
      .limit(1)
      .single();

    if (!firstTradingDay) {
      return res.status(200).json([]);
    }

    // Get all students
    const { data: students } = await supabase
      .from('student')
      .select('*');

    const results = [];

    for (const student of students) {
      // Skip admin accounts and KOSPI index from leaderboard
      if (student.name.toLowerCase().includes('_admin') || student.student_id === 'KOSPI_INDEX') {
        continue;
      }

      // Get stock selection for this student and week
      const { data: selection } = await supabase
        .from('stock_selection')
        .select('*')
        .eq('student_id', student.id)
        .eq('week_id', week.id)
        .single();

      if (!selection) {
        continue;
      }

      // Get buy price (first trading day open)
      const { data: buyPriceRecord } = await supabase
        .from('daily_price')
        .select('*')
        .eq('ticker', selection.ticker)
        .eq('date', firstTradingDay.date)
        .order('date', { ascending: true })
        .limit(1)
        .single();

      if (!buyPriceRecord) {
        continue;
      }

      const buyPrice = buyPriceRecord.open;

      // Get sell price (latest close price within the week period)
      const { data: sellPriceRecord } = await supabase
        .from('daily_price')
        .select('*')
        .eq('ticker', selection.ticker)
        .gte('date', week.week_start)
        .lte('date', week.week_end)
        .order('date', { ascending: false })
        .limit(1)
        .single();

      if (!sellPriceRecord) {
        continue;
      }

      const currentPrice = sellPriceRecord.close;
      const yieldPct = ((currentPrice - buyPrice) / buyPrice) * 100;

      results.push({
        id: student.id,
        name: student.name,
        student_id: student.student_id,
        stock: selection.stock_name,
        ticker: selection.ticker,
        week_number: week.week_number,
        buy_price: buyPrice,
        current_price: currentPrice,
        yield: Math.round(yieldPct * 100) / 100,
        last_updated: sellPriceRecord.date
      });
    }

    // Calculate KOSPI baseline
    const { data: kospiBuy } = await supabase
      .from('daily_price')
      .select('*')
      .eq('ticker', '^KS11')
      .eq('date', firstTradingDay.date)
      .order('date', { ascending: true })
      .limit(1)
      .single();

    const { data: kospiSell } = await supabase
      .from('daily_price')
      .select('*')
      .eq('ticker', '^KS11')
      .gte('date', week.week_start)
      .lte('date', week.week_end)
      .order('date', { ascending: false })
      .limit(1)
      .single();

    if (kospiBuy && kospiSell) {
      const kospiYield = ((kospiSell.close - kospiBuy.open) / kospiBuy.open) * 100;
      results.push({
        id: -1,
        name: 'KOSPI (기준선)',
        student_id: 'KOSPI',
        stock: 'KOSPI 지수',
        ticker: '^KS11',
        week_number: week.week_number,
        buy_price: kospiBuy.open,
        current_price: kospiSell.close,
        yield: Math.round(kospiYield * 100) / 100,
        last_updated: kospiSell.date,
        rank: 0
      });
    }

    // Sort by yield
    results.sort((a, b) => b.yield - a.yield);

    // Assign ranks
    for (let i = 0; i < results.length; i++) {
      results[i].rank = i + 1;
    }

    // Find students without stock selections
    const studentsWithResults = new Set(results.map(r => r.id));
    const minYield = results.length > 0 ? Math.min(...results.map(r => r.yield)) : 0;
    const penaltyYield = minYield - 1.0;

    for (const student of students) {
      if (student.name.toLowerCase().includes('_admin') ||
          student.student_id === 'KOSPI_INDEX' ||
          studentsWithResults.has(student.id)) {
        continue;
      }

      results.push({
        id: student.id,
        name: student.name,
        student_id: student.student_id,
        stock: '미선택',
        ticker: '-',
        week_number: week.week_number,
        buy_price: 0,
        current_price: 0,
        yield: Math.round(penaltyYield * 100) / 100,
        last_updated: new Date().toISOString(),
        rank: results.length + 1
      });
    }

    return res.status(200).json(results);

  } catch (error) {
    console.error('Error in /api/leaderboard:', error);
    return res.status(500).json({ error: error.message });
  }
}
