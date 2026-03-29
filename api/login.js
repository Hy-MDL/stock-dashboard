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
    const { name } = req.body;

    const { data: student, error } = await supabase
      .from('student')
      .select('*')
      .eq('name', name)
      .single();

    if (error || !student) {
      return res.status(404).json({ detail: 'User not found' });
    }

    const isAdmin = name === '전현민_admin';

    return res.status(200).json({
      id: student.id,
      name: student.name,
      student_id: student.student_id,
      is_admin: isAdmin
    });

  } catch (error) {
    console.error('Error in /api/login:', error);
    return res.status(500).json({ error: error.message });
  }
}
