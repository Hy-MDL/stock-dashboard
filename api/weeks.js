import { supabase } from './lib/supabase.js';

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    if (req.method === 'GET') {
      // Get all weeks
      const { data, error } = await supabase
        .from('week')
        .select('*')
        .order('week_number', { ascending: true });

      if (error) throw error;

      const weeks = data.map(w => ({
        id: w.id,
        week_number: w.week_number,
        week_start: w.week_start,
        week_end: w.week_end,
        is_confirmed: w.is_confirmed
      }));

      return res.status(200).json(weeks);

    } else if (req.method === 'POST') {
      // Create a new week
      const { week_number, week_start, week_end } = req.body;

      // Check if week already exists
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
        .insert([{
          week_number,
          week_start,
          week_end,
          is_confirmed: false
        }]);

      if (error) throw error;

      return res.status(200).json({ message: 'Week created successfully' });

    } else {
      return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Error in /api/weeks:', error);
    return res.status(500).json({ error: error.message });
  }
}
