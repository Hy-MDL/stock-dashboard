import { supabase } from '../lib/supabase.js';

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'DELETE') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { student_id } = req.query;

  try {
    const { data: student, error: fetchError } = await supabase
      .from('student')
      .select('id')
      .eq('id', student_id)
      .single();

    if (fetchError || !student) {
      return res.status(404).json({ detail: 'Student not found' });
    }

    const { error } = await supabase
      .from('student')
      .delete()
      .eq('id', student_id);

    if (error) throw error;

    return res.status(200).json({ message: 'Student deleted successfully' });

  } catch (error) {
    console.error(`Error deleting student ${student_id}:`, error);
    return res.status(500).json({ error: error.message });
  }
}
