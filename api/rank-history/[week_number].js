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

    const { data: historyRecords } = await supabase
      .from('rank_history')
      .select('*')
      .eq('week_id', week.id)
      .order('date', { ascending: true });

    // Group by student
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

  } catch (error) {
    console.error(`Error in /api/rank-history/${week_number}:`, error);
    return res.status(500).json({ error: error.message });
  }
}
