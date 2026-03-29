import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { Settings, LogOut, Plus, Edit, Trash2, Save, RefreshCw, Check } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_BASE || "/api";

const Admin = () => {
  const [weeks, setWeeks] = useState([]);
  const [students, setStudents] = useState([]);
  const [selectedWeek, setSelectedWeek] = useState(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [editingWeek, setEditingWeek] = useState(null);
  const [editWeekData, setEditWeekData] = useState({ week_number: '', week_start: '', week_end: '' });
  const [newWeek, setNewWeek] = useState({ week_number: '', week_start: '', week_end: '' });
  const [showAddStudent, setShowAddStudent] = useState(false);
  const [newStudent, setNewStudent] = useState({ name: '', student_id: '' });
  const navigate = useNavigate();

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem('user'));
    if (!user || !user.is_admin) {
      navigate('/login');
      return;
    }
    fetchData();
  }, [navigate]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [weeksRes, studentsRes] = await Promise.all([
        axios.get(`${API_BASE}/weeks`),
        axios.get(`${API_BASE}/students`)
      ]);
      setWeeks(weeksRes.data);
      setStudents(studentsRes.data);
      if (weeksRes.data.length > 0 && !selectedWeek) {
        setSelectedWeek(weeksRes.data[0].week_number);
      }
    } catch (err) {
      console.error("Error fetching data", err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateWeek = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API_BASE}/weeks`, newWeek);
      alert("주차가 생성되었습니다!");
      setNewWeek({ week_number: '', week_start: '', week_end: '' });
      fetchData();
    } catch (err) {
      alert(err.response?.data?.detail || "주차 생성 실패");
    }
  };

  const handleUpdateWeek = async (e) => {
    e.preventDefault();
    try {
      await axios.put(`${API_BASE}/weeks/${editWeekData.week_number}`, editWeekData);
      alert("주차가 업데이트되었습니다!");
      setEditingWeek(null);
      setEditWeekData({ week_number: '', week_start: '', week_end: '' });
      fetchData();
    } catch (err) {
      alert("주차 업데이트 실패");
    }
  };

  const startEditWeek = (week) => {
    setEditingWeek(week.week_number);
    setEditWeekData({
      week_number: week.week_number,
      week_start: week.week_start.split('T')[0],
      week_end: week.week_end.split('T')[0]
    });
  };

  const cancelEditWeek = () => {
    setEditingWeek(null);
    setEditWeekData({ week_number: '', week_start: '', week_end: '' });
  };

  const handleDeleteWeek = async (weekNumber) => {
    if (!confirm(`주차 ${weekNumber}를 삭제하시겠습니까?`)) return;
    try {
      await axios.delete(`${API_BASE}/weeks/${weekNumber}`);
      alert("주차가 삭제되었습니다!");
      fetchData();
    } catch (err) {
      alert("주차 삭제 실패");
    }
  };

  const handleAddStudent = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API_BASE}/students`, newStudent);
      alert("학생이 추가되었습니다!");
      setNewStudent({ name: '', student_id: '' });
      setShowAddStudent(false);
      fetchData();
    } catch (err) {
      alert(err.response?.data?.detail || "학생 추가 실패");
    }
  };

  const handleDeleteStudent = async (studentId, studentName) => {
    if (!confirm(`${studentName} 학생을 삭제하시겠습니까?`)) return;
    try {
      await axios.delete(`${API_BASE}/students/${studentId}`);
      alert("학생이 삭제되었습니다!");
      fetchData();
    } catch (err) {
      alert("학생 삭제 실패");
    }
  };

  const handleSync = async () => {
    if (!confirm("모든 미확정 주차의 데이터를 다시 다운로드하시겠습니까?")) return;
    try {
      setSyncing(true);
      await axios.post(`${API_BASE}/sync`);
      alert("데이터 업데이트가 시작되었습니다. 1-2분 후 새로고침해주세요.");
    } catch (err) {
      console.error("Sync error", err);
      alert("업데이트 실패");
    } finally {
      setSyncing(false);
    }
  };

  const handleConfirmWeek = async (weekNumber) => {
    if (!confirm(`주차 ${weekNumber}를 확정하시겠습니까? 확정 후에는 해당 주차의 가격 데이터가 다시 다운로드되지 않습니다.`)) return;
    try {
      await axios.post(`${API_BASE}/weeks/${weekNumber}/confirm`);
      alert(`주차 ${weekNumber}가 확정되었습니다!`);
      fetchData();
    } catch (err) {
      alert("주차 확정 실패");
    }
  };

  const handleSetTicker = async (studentId, ticker, stockName) => {
    if (!selectedWeek) {
      alert("주차를 선택하세요");
      return;
    }
    try {
      await axios.post(`${API_BASE}/student-ticker`, {
        student_id: studentId,
        week_number: selectedWeek,
        ticker,
        stock_name: stockName
      });
      alert("티커가 설정되었습니다!");
      fetchData();
    } catch (err) {
      alert("티커 설정 실패");
    }
  };

  if (loading) return <div style={{display:'flex',justifyContent:'center',alignItems:'center',minHeight:'100vh'}}>로딩중...</div>;

  const currentWeekData = weeks.find(w => w.week_number === selectedWeek);

  return (
    <div className="container" style={{ maxWidth: '1400px' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Settings size={32} color="var(--apple-blue)" />
          <h1>관리자 페이지</h1>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button onClick={handleSync} disabled={syncing} style={{padding:'12px 24px',borderRadius:'20px',border:'none',background:'var(--apple-blue)',color:'white',fontWeight:'600',cursor:syncing?'not-allowed':'pointer',display:'flex',alignItems:'center',gap:'8px'}}>
            <RefreshCw className={syncing ? 'animate-spin' : ''} size={18} />{syncing ? 'Updating...' : 'Update'}
          </button>
          <button onClick={() => navigate('/dashboard')} style={{padding:'12px 24px',borderRadius:'20px',border:'2px solid var(--apple-blue)',background:'white',color:'var(--apple-blue)',fontWeight:'600',cursor:'pointer'}}>
            대시보드
          </button>
          <button onClick={() => { localStorage.removeItem('user'); navigate('/login'); }} style={{padding:'12px 24px',borderRadius:'20px',border:'none',background:'var(--apple-red)',color:'white',fontWeight:'600',cursor:'pointer',display:'flex',alignItems:'center',gap:'8px'}}>
            <LogOut size={18} />로그아웃
          </button>
        </div>
      </header>

      {/* Week Management */}
      <div className="glass-card" style={{ marginBottom: '32px' }}>
        <h2>주차 관리</h2>
        <form onSubmit={handleCreateWeek} style={{ display: 'flex', gap: '12px', marginBottom: '24px' }}>
          <input type="number" placeholder="주차 번호" value={newWeek.week_number} onChange={e => setNewWeek({...newWeek, week_number: e.target.value})} required style={{padding:'10px',border:'1px solid var(--apple-border)',borderRadius:'8px',flex:1}} />
          <input type="date" value={newWeek.week_start} onChange={e => setNewWeek({...newWeek, week_start: e.target.value})} required style={{padding:'10px',border:'1px solid var(--apple-border)',borderRadius:'8px',flex:1}} />
          <input type="date" value={newWeek.week_end} onChange={e => setNewWeek({...newWeek, week_end: e.target.value})} required style={{padding:'10px',border:'1px solid var(--apple-border)',borderRadius:'8px',flex:1}} />
          <button type="submit" style={{padding:'10px 20px',borderRadius:'10px',border:'none',background:'var(--apple-green)',color:'white',fontWeight:'600',cursor:'pointer',display:'flex',alignItems:'center',gap:'8px'}}>
            <Plus size={16} />추가
          </button>
        </form>

        <table className="ranking-table">
          <thead>
            <tr><th>주차</th><th>시작일</th><th>종료일</th><th>상태</th><th style={{width:'260px'}}>작업</th></tr>
          </thead>
          <tbody>
            {weeks.map(week => (
              <React.Fragment key={week.week_number}>
                {editingWeek === week.week_number ? (
                  <tr>
                    <td colSpan="5" style={{padding:'16px',background:'rgba(0,113,227,0.05)'}}>
                      <form onSubmit={handleUpdateWeek} style={{display:'flex',gap:'12px',alignItems:'flex-end'}}>
                        <div style={{flex:1}}>
                          <label style={{display:'block',marginBottom:'4px',fontSize:'12px',fontWeight:'600'}}>주차 번호</label>
                          <input type="number" value={editWeekData.week_number} readOnly style={{width:'100%',padding:'10px',border:'1px solid var(--apple-border)',borderRadius:'8px',background:'#f0f0f0',boxSizing:'border-box'}} />
                        </div>
                        <div style={{flex:1}}>
                          <label style={{display:'block',marginBottom:'4px',fontSize:'12px',fontWeight:'600'}}>시작일</label>
                          <input type="date" value={editWeekData.week_start} onChange={e => setEditWeekData({...editWeekData, week_start: e.target.value})} required style={{width:'100%',padding:'10px',border:'1px solid var(--apple-border)',borderRadius:'8px',boxSizing:'border-box'}} />
                        </div>
                        <div style={{flex:1}}>
                          <label style={{display:'block',marginBottom:'4px',fontSize:'12px',fontWeight:'600'}}>종료일</label>
                          <input type="date" value={editWeekData.week_end} onChange={e => setEditWeekData({...editWeekData, week_end: e.target.value})} required style={{width:'100%',padding:'10px',border:'1px solid var(--apple-border)',borderRadius:'8px',boxSizing:'border-box'}} />
                        </div>
                        <button type="submit" style={{padding:'10px 16px',borderRadius:'8px',border:'none',background:'var(--apple-blue)',color:'white',fontSize:'13px',cursor:'pointer',whiteSpace:'nowrap'}}>
                          <Save size={14} /> 저장
                        </button>
                        <button type="button" onClick={cancelEditWeek} style={{padding:'10px 16px',borderRadius:'8px',border:'2px solid var(--apple-border)',background:'white',color:'var(--apple-text)',fontSize:'13px',cursor:'pointer',whiteSpace:'nowrap'}}>
                          취소
                        </button>
                      </form>
                    </td>
                  </tr>
                ) : (
                  <tr style={week.is_confirmed ? {background:'rgba(52,199,89,0.05)'} : {}}>
                    <td style={{fontWeight:'700',color:'var(--apple-blue)'}}>Week {week.week_number}</td>
                    <td>{new Date(week.week_start).toLocaleDateString('ko-KR')}</td>
                    <td>{new Date(week.week_end).toLocaleDateString('ko-KR')}</td>
                    <td>
                      {week.is_confirmed ? (
                        <span style={{padding:'4px 12px',borderRadius:'12px',background:'var(--apple-green)',color:'white',fontSize:'12px',fontWeight:'600',display:'inline-flex',alignItems:'center',gap:'4px'}}>
                          <Check size={14} />확정됨
                        </span>
                      ) : (
                        <span style={{color:'var(--apple-text-secondary)',fontSize:'13px'}}>미확정</span>
                      )}
                    </td>
                    <td>
                      <div style={{display:'flex',gap:'8px'}}>
                        {!week.is_confirmed && (
                          <button onClick={() => handleConfirmWeek(week.week_number)} style={{padding:'6px 12px',borderRadius:'8px',border:'none',background:'var(--apple-green)',color:'white',fontSize:'13px',cursor:'pointer',display:'flex',alignItems:'center',gap:'4px'}}>
                            <Check size={14} />확정
                          </button>
                        )}
                        <button onClick={() => startEditWeek(week)} style={{padding:'6px 12px',borderRadius:'8px',border:'none',background:'var(--apple-blue)',color:'white',fontSize:'13px',cursor:'pointer',display:'flex',alignItems:'center',gap:'4px'}}>
                          <Edit size={14} />수정
                        </button>
                        <button onClick={() => handleDeleteWeek(week.week_number)} style={{padding:'6px 12px',borderRadius:'8px',border:'none',background:'var(--apple-red)',color:'white',fontSize:'13px',cursor:'pointer',display:'flex',alignItems:'center',gap:'4px'}}>
                          <Trash2 size={14} />삭제
                        </button>
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {/* Student Management */}
      <div className="glass-card" style={{ marginBottom: '32px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <h2>학생 관리</h2>
          <button onClick={() => setShowAddStudent(!showAddStudent)} style={{padding:'10px 20px',borderRadius:'10px',border:'none',background:'var(--apple-green)',color:'white',fontWeight:'600',cursor:'pointer',display:'flex',alignItems:'center',gap:'8px'}}>
            <Plus size={16} />{showAddStudent ? '취소' : '학생 추가'}
          </button>
        </div>

        {showAddStudent && (
          <form onSubmit={handleAddStudent} style={{ display: 'flex', gap: '12px', marginBottom: '24px', padding: '16px', background: 'rgba(52,199,89,0.05)', borderRadius: '12px' }}>
            <input type="text" placeholder="이름" value={newStudent.name} onChange={e => setNewStudent({...newStudent, name: e.target.value})} required style={{padding:'10px',border:'1px solid var(--apple-border)',borderRadius:'8px',flex:1}} />
            <input type="text" placeholder="학번" value={newStudent.student_id} onChange={e => setNewStudent({...newStudent, student_id: e.target.value})} required style={{padding:'10px',border:'1px solid var(--apple-border)',borderRadius:'8px',flex:1}} />
            <button type="submit" style={{padding:'10px 20px',borderRadius:'10px',border:'none',background:'var(--apple-green)',color:'white',fontWeight:'600',cursor:'pointer',whiteSpace:'nowrap'}}>
              추가
            </button>
          </form>
        )}

        <table className="ranking-table">
          <thead>
            <tr><th>이름</th><th>학번</th><th style={{width:'100px'}}>작업</th></tr>
          </thead>
          <tbody>
            {students.map(student => (
              <tr key={student.id}>
                <td style={{fontWeight:'600'}}>{student.name}</td>
                <td>{student.student_id}</td>
                <td>
                  <button onClick={() => handleDeleteStudent(student.id, student.name)} style={{padding:'6px 12px',borderRadius:'8px',border:'none',background:'var(--apple-red)',color:'white',fontSize:'13px',cursor:'pointer',display:'flex',alignItems:'center',gap:'4px'}}>
                    <Trash2 size={14} />삭제
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Student Ticker Management */}
      <div className="glass-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <h2>학생별 티커 입력</h2>
          <select value={selectedWeek || ''} onChange={e => setSelectedWeek(parseInt(e.target.value))} style={{padding:'10px',border:'1px solid var(--apple-border)',borderRadius:'8px',fontSize:'14px'}}>
            {weeks.map(w => <option key={w.week_number} value={w.week_number}>Week {w.week_number}</option>)}
          </select>
        </div>

        {currentWeekData && (
          <p style={{marginBottom:'20px',color:'var(--apple-text-secondary)'}}>
            기간: {new Date(currentWeekData.week_start).toLocaleDateString('ko-KR')} ~ {new Date(currentWeekData.week_end).toLocaleDateString('ko-KR')}
          </p>
        )}

        <table className="ranking-table">
          <thead>
            <tr><th>학생</th><th>티커</th><th>종목명</th><th>작업</th></tr>
          </thead>
          <tbody>
            {students.map(student => {
              const weekData = student.weeks.find(w => w.week_number === selectedWeek);
              return (
                <tr key={student.id}>
                  <td><div style={{fontWeight:'600'}}>{student.name}</div><div style={{fontSize:'12px',color:'var(--apple-text-secondary)'}}>{student.student_id}</div></td>
                  <td><input type="text" defaultValue={weekData?.ticker || ''} id={`ticker-${student.id}`} placeholder="AAPL" style={{width:'100%',padding:'8px',border:'1px solid var(--apple-border)',borderRadius:'6px'}} /></td>
                  <td><input type="text" defaultValue={weekData?.stock_name || ''} id={`stock-${student.id}`} placeholder="Apple Inc." style={{width:'100%',padding:'8px',border:'1px solid var(--apple-border)',borderRadius:'6px'}} /></td>
                  <td>
                    <button onClick={() => {
                      const ticker = document.getElementById(`ticker-${student.id}`).value;
                      const stockName = document.getElementById(`stock-${student.id}`).value;
                      if (!ticker || !stockName) { alert('티커와 종목명을 입력하세요'); return; }
                      handleSetTicker(student.id, ticker, stockName);
                    }} style={{padding:'8px 16px',borderRadius:'8px',border:'none',background:'var(--apple-blue)',color:'white',fontSize:'13px',cursor:'pointer',display:'flex',alignItems:'center',gap:'6px'}}>
                      <Save size={14} />저장
                    </button>
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

export default Admin;
