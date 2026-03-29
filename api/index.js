// Unified API handler to reduce serverless function count
import { supabase } from './lib/supabase.js';
import { updateAllStocks, saveRankHistory } from './lib/fetcher.js';

// CORS headers
const setCorsHeaders = (res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
};

// Helper to parse path and params
const parsePath = (url) => {
  const urlObj = new URL(url, 'http://localhost');
  const pathParts = urlObj.pathname.replace('/api/', '').split('/').filter(Boolean);
  return { pathParts, query: Object.fromEntries(urlObj.searchParams) };
};

export default async function handler(req, res) {
  setCorsHeaders(res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const { pathParts, query } = parsePath(req.url);

    // Check query params first (for /api?resource URLs)
    let resource = pathParts[0];
    let id = pathParts[1];
    let action = pathParts[2];

    // If no path but has query params, use first query key as resource
    if (!resource && Object.keys(query).length > 0) {
      resource = Object.keys(query)[0];
    }

    // Route to appropriate handler
    switch (resource) {
      case 'weeks':
        return await handleWeeks(req, res, id, action);
      case 'leaderboard':
        return await handleLeaderboard(req, res, query);
      case 'students':
        return await handleStudents(req, res, id);
      case 'login':
        return await handleLogin(req, res);
      case 'student-ticker':
        return await handleStudentTicker(req, res);
      case 'rank-history':
        return await handleRankHistory(req, res, id);
      case 'kospi':
        return await handleKospi(req, res, id);
      case 'sync':
        return await handleSync(req, res);
      default:
        return res.status(404).json({ error: 'Not found', resource, url: req.url });
    }
  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({ error: error.message, stack: error.stack });
  }
}

// Weeks handler
async function handleWeeks(req, res, weekNumber, action) {
  if (req.method === 'GET' && !weekNumber) {
    // Get all weeks
    const { data, error } = await supabase
      .from('week')
      .select('*')
      .order('week_number', { ascending: true });

    if (error) throw error;

    return res.status(200).json(data.map(w => ({
      id: w.id,
      week_number: w.week_number,
      week_start: w.week_start,
      week_end: w.week_end,
      is_confirmed: w.is_confirmed
    })));
  }

  if (req.method === 'POST' && !weekNumber) {
    // Create week
    const { week_number, week_start, week_end } = req.body;

    const { data: existing } = await supabase
      .from('week')
      .select('id')
      .eq('week_number', week_number)
      .single();

    if (existing) {
      return res.status(400).json({ detail: 'Week already exists' });
    }

    const { error } = await supabase
      .from('week')
      .insert([{ week_number, week_start, week_end, is_confirmed: false }]);

    if (error) throw error;

    return res.status(200).json({ message: 'Week created successfully' });
  }

  if (req.method === 'PUT' && weekNumber) {
    // Update week
    const { week_start, week_end } = req.body;

    const { error } = await supabase
      .from('week')
      .update({ week_start, week_end })
      .eq('week_number', weekNumber);

    if (error) throw error;

    return res.status(200).json({ message: 'Week updated successfully' });
  }

  if (req.method === 'DELETE' && weekNumber) {
    // Delete week
    const { error } = await supabase
      .from('week')
      .delete()
      .eq('week_number', weekNumber);

    if (error) throw error;

    return res.status(200).json({ message: 'Week deleted successfully' });
  }

  if (req.method === 'POST' && action === 'confirm') {
    // Confirm week
    const { error } = await supabase
      .from('week')
      .update({ is_confirmed: true })
      .eq('week_number', weekNumber);

    if (error) throw error;

    return res.status(200).json({ message: `Week ${weekNumber} confirmed` });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

// Leaderboard handler
async function handleLeaderboard(req, res, query) {
  const { week_number } = query;
  let week;

  if (!week_number) {
    const { data } = await supabase
      .from('week')
      .select('*')
      .order('week_number', { ascending: false })
      .limit(1)
      .single();

    if (!data) return res.status(200).json([]);
    week = data;
  } else {
    const { data } = await supabase
      .from('week')
      .select('*')
      .eq('week_number', week_number)
      .single();

    if (!data) return res.status(200).json([]);
    week = data;
  }

  const { data: firstTradingDay } = await supabase
    .from('daily_price')
    .select('date')
    .eq('ticker', '^KS11')
    .gte('date', week.week_start)
    .lte('date', week.week_end)
    .order('date', { ascending: true })
    .limit(1)
    .single();

  if (!firstTradingDay) return res.status(200).json([]);

  const { data: students } = await supabase.from('student').select('*');
  const results = [];

  for (const student of students) {
    if (student.name.toLowerCase().includes('_admin') || student.student_id === 'KOSPI_INDEX') {
      continue;
    }

    const { data: selection } = await supabase
      .from('stock_selection')
      .select('*')
      .eq('student_id', student.id)
      .eq('week_id', week.id)
      .single();

    if (!selection) continue;

    const { data: buyPriceRecord } = await supabase
      .from('daily_price')
      .select('*')
      .eq('ticker', selection.ticker)
      .eq('date', firstTradingDay.date)
      .limit(1)
      .single();

    if (!buyPriceRecord) continue;

    const { data: sellPriceRecord } = await supabase
      .from('daily_price')
      .select('*')
      .eq('ticker', selection.ticker)
      .gte('date', week.week_start)
      .lte('date', week.week_end)
      .order('date', { ascending: false })
      .limit(1)
      .single();

    if (!sellPriceRecord) continue;

    const yieldPct = ((sellPriceRecord.close - buyPriceRecord.open) / buyPriceRecord.open) * 100;

    results.push({
      id: student.id,
      name: student.name,
      student_id: student.student_id,
      stock: selection.stock_name,
      ticker: selection.ticker,
      week_number: week.week_number,
      buy_price: buyPriceRecord.open,
      current_price: sellPriceRecord.close,
      yield: Math.round(yieldPct * 100) / 100,
      last_updated: sellPriceRecord.date
    });
  }

  // Add KOSPI
  const { data: kospiBuy } = await supabase
    .from('daily_price')
    .select('*')
    .eq('ticker', '^KS11')
    .eq('date', firstTradingDay.date)
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
      last_updated: kospiSell.date
    });
  }

  results.sort((a, b) => b.yield - a.yield);
  results.forEach((r, i) => r.rank = i + 1);

  // Add students without selections
  const studentsWithResults = new Set(results.map(r => r.id));
  const minYield = results.length > 0 ? Math.min(...results.map(r => r.yield)) : 0;

  for (const student of students) {
    if (!student.name.toLowerCase().includes('_admin') &&
        student.student_id !== 'KOSPI_INDEX' &&
        !studentsWithResults.has(student.id)) {
      results.push({
        id: student.id,
        name: student.name,
        student_id: student.student_id,
        stock: '미선택',
        ticker: '-',
        week_number: week.week_number,
        buy_price: 0,
        current_price: 0,
        yield: Math.round((minYield - 1) * 100) / 100,
        last_updated: new Date().toISOString(),
        rank: results.length + 1
      });
    }
  }

  return res.status(200).json(results);
}

// Students handler
async function handleStudents(req, res, studentId) {
  if (req.method === 'GET' && !studentId) {
    const { data: students } = await supabase.from('student').select('*');
    const { data: weeks } = await supabase.from('week').select('*').order('week_number');

    const result = [];
    for (const student of students) {
      const studentData = {
        id: student.id,
        name: student.name,
        student_id: student.student_id,
        weeks: []
      };

      for (const week of weeks) {
        const { data: selection } = await supabase
          .from('stock_selection')
          .select('*')
          .eq('student_id', student.id)
          .eq('week_id', week.id)
          .single();

        studentData.weeks.push({
          week_number: week.week_number,
          week_start: week.week_start,
          week_end: week.week_end,
          ticker: selection?.ticker || null,
          stock_name: selection?.stock_name || null
        });
      }
      result.push(studentData);
    }

    return res.status(200).json(result);
  }

  if (req.method === 'POST' && !studentId) {
    const { name, student_id } = req.body;

    const { data: existing } = await supabase
      .from('student')
      .select('id')
      .eq('student_id', student_id)
      .single();

    if (existing) {
      return res.status(400).json({ detail: 'Student ID already exists' });
    }

    const { data, error } = await supabase
      .from('student')
      .insert([{ name, student_id }])
      .select()
      .single();

    if (error) throw error;

    return res.status(200).json({ message: 'Student added successfully', id: data.id });
  }

  if (req.method === 'DELETE' && studentId) {
    const { error } = await supabase
      .from('student')
      .delete()
      .eq('id', studentId);

    if (error) throw error;

    return res.status(200).json({ message: 'Student deleted successfully' });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

// Login handler
async function handleLogin(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { name } = req.body;

  const { data: student, error } = await supabase
    .from('student')
    .select('*')
    .eq('name', name)
    .single();

  if (error || !student) {
    return res.status(404).json({ detail: 'User not found' });
  }

  return res.status(200).json({
    id: student.id,
    name: student.name,
    student_id: student.student_id,
    is_admin: name === '전현민_admin'
  });
}

// Student ticker handler
async function handleStudentTicker(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { student_id, week_number, ticker, stock_name } = req.body;

  const { data: week } = await supabase
    .from('week')
    .select('id')
    .eq('week_number', week_number)
    .single();

  if (!week) {
    return res.status(404).json({ detail: 'Week not found' });
  }

  const { data: existing } = await supabase
    .from('stock_selection')
    .select('id')
    .eq('student_id', student_id)
    .eq('week_id', week.id)
    .single();

  if (existing) {
    const { error } = await supabase
      .from('stock_selection')
      .update({ ticker, stock_name })
      .eq('student_id', student_id)
      .eq('week_id', week.id);

    if (error) throw error;
  } else {
    const { error } = await supabase
      .from('stock_selection')
      .insert([{ student_id, week_id: week.id, ticker, stock_name }]);

    if (error) throw error;
  }

  return res.status(200).json({ message: 'Ticker updated successfully' });
}

// Rank history handler
async function handleRankHistory(req, res, weekNumber) {
  const { data: week } = await supabase
    .from('week')
    .select('*')
    .eq('week_number', weekNumber)
    .single();

  if (!week) {
    return res.status(404).json({ detail: 'Week not found' });
  }

  const { data: historyRecords } = await supabase
    .from('rank_history')
    .select('*')
    .eq('week_id', week.id)
    .order('date');

  const studentHistory = {};

  for (const record of historyRecords) {
    const { data: student } = await supabase
      .from('student')
      .select('*')
      .eq('id', record.student_id)
      .single();

    if (!studentHistory[student.id]) {
      studentHistory[student.id] = {
        student_id: student.id,
        name: student.name,
        student_number: student.student_id,
        data: []
      };
    }

    studentHistory[student.id].data.push({
      date: record.date,
      rank: record.rank,
      yield: Math.round(record.yield_pct * 100) / 100
    });
  }

  return res.status(200).json(Object.values(studentHistory));
}

// KOSPI handler
async function handleKospi(req, res, weekNumber) {
  const { data: week } = await supabase
    .from('week')
    .select('*')
    .eq('week_number', weekNumber)
    .single();

  if (!week) {
    return res.status(404).json({ detail: 'Week not found' });
  }

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

  const now = new Date();
  let dailyPrices;

  if (now > new Date(week.week_end)) {
    const { data } = await supabase
      .from('daily_price')
      .select('*')
      .eq('ticker', '^KS11')
      .gte('date', week.week_start)
      .lte('date', week.week_end)
      .order('date');
    dailyPrices = data;
  } else {
    const { data } = await supabase
      .from('daily_price')
      .select('*')
      .eq('ticker', '^KS11')
      .gte('date', week.week_start)
      .order('date');
    dailyPrices = data;
  }

  if (!dailyPrices || dailyPrices.length === 0) {
    return res.status(200).json(null);
  }

  const currentPrice = dailyPrices[dailyPrices.length - 1].close;
  const yieldPct = ((currentPrice - buyPriceRecord.open) / buyPriceRecord.open) * 100;

  return res.status(200).json({
    buy_price: Math.round(buyPriceRecord.open * 100) / 100,
    current_price: Math.round(currentPrice * 100) / 100,
    yield: Math.round(yieldPct * 100) / 100,
    daily_data: dailyPrices.map(p => ({
      date: p.date,
      price: Math.round(p.close * 100) / 100
    }))
  });
}

// Sync handler
async function handleSync(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  console.log('Starting data sync...');
  await updateAllStocks();
  await saveRankHistory();

  return res.status(200).json({
    message: 'Data sync completed successfully',
    timestamp: new Date().toISOString()
  });
}
