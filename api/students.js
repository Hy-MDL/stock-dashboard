import { supabase } from './lib/supabase.js';

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    if (req.method === 'GET') {
      // Get all students with their selections by week
      const { data: students } = await supabase
        .from('student')
        .select('*');

      const { data: weeks } = await supabase
        .from('week')
        .select('*')
        .order('week_number', { ascending: true });

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

    } else if (req.method === 'POST') {
      // Add a new student
      const { name, student_id } = req.body;

      // Check if student_id already exists
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

    } else {
      return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Error in /api/students:', error);
    return res.status(500).json({ error: error.message });
  }
}
