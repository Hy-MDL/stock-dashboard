import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

const API_BASE = import.meta.env.VITE_API_BASE || "/api";

const Login = () => {
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await axios.post(`${API_BASE}/login`, { name });
      const userData = res.data;

      // Store user data in localStorage
      localStorage.setItem('user', JSON.stringify(userData));

      // Navigate based on admin status
      if (userData.is_admin) {
        navigate('/admin');
      } else {
        navigate('/dashboard');
      }
    } catch (err) {
      setError(err.response?.data?.detail || '로그인에 실패했습니다. 이름을 확인해주세요.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
    }}>
      <div className="glass-card" style={{
        maxWidth: '400px',
        width: '90%',
        padding: '48px 32px',
        textAlign: 'center'
      }}>
        <h1 style={{
          fontSize: '32px',
          marginBottom: '8px',
          background: 'linear-gradient(135deg, var(--apple-blue) 0%, var(--apple-purple) 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent'
        }}>
          Stock Analytics
        </h1>
        <p style={{
          color: 'var(--apple-text-secondary)',
          marginBottom: '32px'
        }}>
          금융공학 종목 추천 대시보드
        </p>

        <form onSubmit={handleLogin}>
          <input
            type="text"
            placeholder="이름을 입력하세요"
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={{
              width: '100%',
              padding: '16px',
              fontSize: '16px',
              border: '2px solid var(--apple-border)',
              borderRadius: '12px',
              marginBottom: '16px',
              outline: 'none',
              transition: 'border-color 0.3s',
              boxSizing: 'border-box'
            }}
            onFocus={(e) => e.target.style.borderColor = 'var(--apple-blue)'}
            onBlur={(e) => e.target.style.borderColor = 'var(--apple-border)'}
            required
          />

          {error && (
            <p style={{
              color: 'var(--apple-red)',
              fontSize: '14px',
              marginBottom: '16px'
            }}>
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '16px',
              fontSize: '16px',
              fontWeight: '600',
              color: 'white',
              background: loading
                ? 'var(--apple-text-secondary)'
                : 'linear-gradient(135deg, var(--apple-blue) 0%, var(--apple-purple) 100%)',
              border: 'none',
              borderRadius: '12px',
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'transform 0.2s, opacity 0.2s',
              opacity: loading ? 0.7 : 1
            }}
            onMouseEnter={(e) => !loading && (e.target.style.transform = 'scale(1.02)')}
            onMouseLeave={(e) => e.target.style.transform = 'scale(1)'}
          >
            {loading ? '로그인 중...' : '로그인'}
          </button>
        </form>

        <p style={{
          marginTop: '24px',
          fontSize: '14px',
          color: 'var(--apple-text-secondary)'
        }}>
          등록된 이름으로만 로그인할 수 있습니다
        </p>
      </div>
    </div>
  );
};

export default Login;
