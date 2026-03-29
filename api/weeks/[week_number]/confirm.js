import { supabase } from '../../lib/supabase.js';

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

  const { week_number } = req.query;

  try {
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
      .update({ is_confirmed: true })
      .eq('week_number', week_number);

    if (error) throw error;

    return res.status(200).json({ message: `Week ${week_number} confirmed` });

  } catch (error) {
    console.error(`Error confirming week ${week_number}:`, error);
    return res.status(500).json({ error: error.message });
  }
}
