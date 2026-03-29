import { supabase } from '../lib/supabase.js';

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { week_number } = req.query;

  try {
    if (req.method === 'PUT') {
      // Update week dates
      const { week_start, week_end } = req.body;

      const { data: week, error: fetchError } = await supabase
        .from('week')
        .select('id')
        .eq('week_number', week_number)
        .single();

      if (fetchError || !week) {
        return res.status(404).json({ detail: 'Week not found' });
      }

      const { error } = await supabase
        .from('week')
        .update({
          week_start,
          week_end
        })
        .eq('week_number', week_number);

      if (error) throw error;

      return res.status(200).json({ message: 'Week updated successfully' });

    } else if (req.method === 'DELETE') {
      // Delete a week
      const { data: week, error: fetchError } = await supabase
        .from('week')
        .select('id')
        .eq('week_number', week_number)
        .single();

      if (fetchError || !week) {
        return res.status(404).json({ detail: 'Week not found' });
      }

      const { error } = await supabase
        .from('week')
        .delete()
        .eq('week_number', week_number);

      if (error) throw error;

      return res.status(200).json({ message: 'Week deleted successfully' });

    } else {
      return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error(`Error in /api/weeks/${week_number}:`, error);
    return res.status(500).json({ error: error.message });
  }
}
