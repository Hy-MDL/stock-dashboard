import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { RefreshCw, Trophy, Hash, LogOut, Settings, TrendingUp } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const API_BASE = import.meta.env.VITE_API_BASE || "/api";

const Dashboard = () => {
  const [data, setData] = useState([]);
  const [weeks, setWeeks] = useState([]);
  const [selectedWeek, setSelectedWeek] = useState(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [user, setUser] = useState(null);
  const [kospiData, setKospiData] = useState(null);
  const [rankHistory, setRankHistory] = useState([]);
  const [allWeeksData, setAllWeeksData] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (!storedUser) {
      navigate('/login');
      return;
    }
    setUser(JSON.parse(storedUser));
    fetchWeeks();
  }, [navigate]);

  const fetchWeeks = async () => {
    try {
      const res = await axios.get(`${API_BASE}/weeks`);
      setWeeks(res.data);
      if (res.data && res.data.length > 0) {
        setSelectedWeek(res.data[res.data.length - 1].week_number);
        // Fetch all weeks data for comparison chart
        fetchAllWeeksComparison(res.data);
      } else {
        // No weeks found, stop loading
        setLoading(false);
      }
    } catch (err) {
      console.error("Error fetching weeks", err);
      setLoading(false);
    }
  };

  const fetchAllWeeksComparison = async (weeksData) => {
    try {
      const weeklyResults = await Promise.all(
        weeksData.map(async (week) => {
          const leaderboardRes = await axios.get(`${API_BASE}/leaderboard?week_number=${week.week_number}`);
          const kospiRes = await axios.get(`${API_BASE}/kospi/${week.week_number}`);

          // Get user's result
          let userYield = null;
          if (user) {
            const userResult = leaderboardRes.data.find(s => s.student_id === user.id);
            if (userResult) {
              userYield = userResult.yield;
            }
          }

          return {
            week_number: week.week_number,
            week_label: `${week.week_number}주차`,
            kospi_yield: kospiRes.data?.yield || 0,
            user_yield: userYield
          };
        })
      );
      setAllWeeksData(weeklyResults);
    } catch (err) {
      console.error("Error fetching all weeks data", err);
    }
  };

  useEffect(() => {
    if (selectedWeek !== null) {
      fetchAllData();
    }
  }, [selectedWeek]);

  const fetchAllData = async () => {
    try {
      setLoading(true);
      const [leaderboardRes, kospiRes, rankHistoryRes] = await Promise.all([
        axios.get(`${API_BASE}/leaderboard?week_number=${selectedWeek}`),
        axios.get(`${API_BASE}/kospi/${selectedWeek}`),
        axios.get(`${API_BASE}/rank-history/${selectedWeek}`)
      ]);
      setData(leaderboardRes.data);
      setKospiData(kospiRes.data);

      // Transform rank history to add day index (0일차, 1일차, 2일차...)
      const currentWeek = weeks.find(w => w.week_number === selectedWeek);
      if (currentWeek) {
        const weekStart = new Date(currentWeek.week_start);
        const transformedHistory = rankHistoryRes.data.map(student => ({
          ...student,
          data: student.data.map(d => {
            const date = new Date(d.date);
            const daysDiff = Math.floor((date - weekStart) / (1000 * 60 * 60 * 24));
            return {
              ...d,
              day_index: daysDiff
            };
          })
        }));
        setRankHistory(transformedHistory);
      } else {
        setRankHistory(rankHistoryRes.data);
      }
    } catch (err) {
      console.error("Error fetching data", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchLeaderboard = fetchAllData;

  const handleSync = async () => {
    try {
      setSyncing(true);
      await axios.post(`${API_BASE}/sync`);
      alert("데이터 동기화가 시작되었습니다.");
      setTimeout(() => fetchLeaderboard(), 3000);
    } catch (err) {
      console.error("Sync error", err);
    } finally {
      setSyncing(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('user');
    navigate('/login');
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <p>로딩 중...</p>
      </div>
    );
  }

  const top3 = data.slice(0, 3);
  const currentWeekData = weeks.find(w => w.week_number === selectedWeek);

  return (
    <div className="container">
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px' }}>
        <div>
          <h1>Stock Analytics</h1>
          {user && (
            <p style={{ color: 'var(--apple-text-secondary)', marginTop: '8px' }}>
              환영합니다, {user.name}님
            </p>
          )}
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          {user?.is_admin && (
            <button
              onClick={() => navigate('/admin')}
              style={{
                padding: '12px 24px',
                borderRadius: '20px',
                border: '2px solid var(--apple-blue)',
                background: 'white',
                color: 'var(--apple-blue)',
                fontWeight: '600',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <Settings size={18} />
              관리자
            </button>
          )}
          <button
            onClick={handleLogout}
            style={{
              padding: '12px 24px',
              borderRadius: '20px',
              border: 'none',
              background: 'var(--apple-red)',
              color: 'white',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <LogOut size={18} />
            로그아웃
          </button>
        </div>
      </header>

      {/* Week Selection */}
      <div style={{ marginBottom: '32px', display: 'flex', alignItems: 'center', gap: '16px' }}>
        <label style={{ fontSize: '18px', fontWeight: '600' }}>주차 선택:</label>
        <select
          value={selectedWeek || ''}
          onChange={(e) => setSelectedWeek(parseInt(e.target.value))}
          style={{
            padding: '12px 20px',
            fontSize: '16px',
            border: '2px solid var(--apple-border)',
            borderRadius: '12px',
            fontWeight: '600',
            cursor: 'pointer',
            minWidth: '200px'
          }}
        >
          {weeks.map(w => (
            <option key={w.week_number} value={w.week_number}>
              Week {w.week_number}
            </option>
          ))}
        </select>
        {currentWeekData && (
          <span style={{ color: 'var(--apple-text-secondary)' }}>
            ({new Date(currentWeekData.week_start).toLocaleDateString('ko-KR')} ~ {new Date(currentWeekData.week_end).toLocaleDateString('ko-KR')})
          </span>
        )}
      </div>

      {/* Top 3 Table */}
      <div className="glass-card" style={{ marginBottom: '32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
          <Trophy size={28} color="#FFD700" />
          <h2 style={{ margin: 0 }}>Top 3 리더보드</h2>
        </div>
        <table className="ranking-table">
          <thead>
            <tr>
              <th style={{ width: '60px' }}><Hash size={16} /></th>
              <th>학생</th>
              <th>종목</th>
              <th>매수가</th>
              <th>현재가</th>
              <th style={{ textAlign: 'right' }}>수익률</th>
            </tr>
          </thead>
          <tbody>
            {top3.map((student) => (
              <tr
                key={student.id}
                style={{
                  borderLeft: student.rank === 1 ? '4px solid #FFD700' :
                              student.rank === 2 ? '4px solid #C0C0C0' :
                              '4px solid #CD7F32'
                }}
              >
                <td>
                  <div className={`rank-badge rank-${student.rank}`} style={{
                    background: student.rank === 1 ? 'linear-gradient(135deg, #FFD700, #FFA500)' :
                                student.rank === 2 ? 'linear-gradient(135deg, #C0C0C0, #A8A8A8)' :
                                'linear-gradient(135deg, #CD7F32, #B8860B)'
                  }}>
                    {student.rank}
                  </div>
                </td>
                <td>
                  <div style={{ fontWeight: '600' }}>{student.name}</div>
                  <div style={{ fontSize: '12px', color: 'var(--apple-text-secondary)' }}>{student.student_id}</div>
                </td>
                <td>
                  <div>{student.stock}</div>
                  <div style={{ fontSize: '12px', color: 'var(--apple-text-secondary)' }}>{student.ticker}</div>
                </td>
                <td>
                  <div style={{ fontWeight: '500' }}>{student.buy_price.toLocaleString()}</div>
                </td>
                <td>
                  <div style={{ fontWeight: '500' }}>{student.current_price.toLocaleString()}</div>
                </td>
                <td style={{ textAlign: 'right' }}>
                  <span className={student.yield >= 0 ? 'yield-up' : 'yield-down'} style={{ fontWeight: '700', fontSize: '18px' }}>
                    {student.yield >= 0 ? '+' : ''}{student.yield}%
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Full Leaderboard */}
      <div className="glass-card">
        <h2>전체 순위 (Week {selectedWeek})</h2>
        <table className="ranking-table">
          <thead>
            <tr>
              <th style={{ width: '60px' }}><Hash size={16} /></th>
              <th>학생</th>
              <th>종목</th>
              <th>매수가</th>
              <th>현재가</th>
              <th style={{ textAlign: 'right' }}>수익률</th>
            </tr>
          </thead>
          <tbody>
            {data.map((student) => {
              const isKospi = student.student_id === "KOSPI";
              return (
                <tr key={student.id} style={isKospi ? { background: 'rgba(0,113,227,0.08)', borderLeft: '4px solid var(--apple-blue)' } : {}}>
                  <td>
                    <div className={`rank-badge rank-${student.rank <= 3 ? student.rank : ''}`} style={isKospi ? { background: 'var(--apple-blue)' } : {}}>
                      {isKospi ? '📊' : student.rank}
                    </div>
                  </td>
                  <td>
                    <div style={{ fontWeight: isKospi ? '700' : '600', color: isKospi ? 'var(--apple-blue)' : 'inherit' }}>
                      {student.name}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--apple-text-secondary)' }}>{student.student_id}</div>
                  </td>
                  <td>
                    <div>{student.stock}</div>
                    <div style={{ fontSize: '12px', color: 'var(--apple-text-secondary)' }}>{student.ticker}</div>
                  </td>
                  <td>
                    <div style={{ fontWeight: '500' }}>{student.buy_price.toLocaleString()}</div>
                  </td>
                  <td>
                    <div style={{ fontWeight: '500' }}>{student.current_price.toLocaleString()}</div>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <span className={student.yield >= 0 ? 'yield-up' : 'yield-down'} style={{ fontWeight: '700' }}>
                      {student.yield >= 0 ? '+' : ''}{student.yield}%
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Dashboard;
