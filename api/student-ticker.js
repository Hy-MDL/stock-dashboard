import { supabase } from './lib/supabase.js';

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
    const { student_id, week_number, ticker, stock_name } = req.body;

    // Get student
    const { data: student, error: studentError } = await supabase
      .from('student')
      .select('id')
      .eq('id', student_id)
      .single();

    if (studentError || !student) {
      return res.status(404).json({ detail: 'Student not found' });
    }

    // Get week
    const { data: week, error: weekError } = await supabase
      .from('week')
      .select('id')
      .eq('week_number', week_number)
      .single();

    if (weekError || !week) {
      return res.status(404).json({ detail: 'Week not found' });
    }

    // Check if selection already exists
    const { data: existing } = await supabase
      .from('stock_selection')
      .select('id')
      .eq('student_id', student_id)
      .eq('week_id', week.id)
      .single();

    if (existing) {
      // Update existing selection
      const { error } = await supabase
        .from('stock_selection')
        .update({ ticker, stock_name })
        .eq('student_id', student_id)
        .eq('week_id', week.id);

      if (error) throw error;
    } else {
      // Create new selection
      const { error } = await supabase
        .from('stock_selection')
        .insert([{
          student_id,
          week_id: week.id,
          ticker,
          stock_name
        }]);

      if (error) throw error;
    }

    return res.status(200).json({ message: 'Ticker updated successfully' });

  } catch (error) {
    console.error('Error in /api/student-ticker:', error);
    return res.status(500).json({ error: error.message });
  }
}
