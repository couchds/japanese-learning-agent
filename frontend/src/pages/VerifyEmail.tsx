import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import API_URL from '../config';
import './Login.css';

const VerifyEmail: React.FC = () => {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const verifyEmail = async () => {
      const token = searchParams.get('token');
      
      if (!token) {
        setStatus('error');
        setMessage('Invalid verification link');
        return;
      }

      try {
        const response = await fetch(`${API_URL}/api/auth/verify-email?token=${token}`, {
          method: 'GET'
        });

        const data = await response.json();

        if (response.ok) {
          setStatus('success');
          setMessage('Email verified successfully! You can now login.');
          // Redirect to login after 3 seconds
          setTimeout(() => {
            navigate('/login');
          }, 3000);
        } else {
          setStatus('error');
          setMessage(data.error || 'Verification failed');
        }
      } catch (error) {
        setStatus('error');
        setMessage('Failed to verify email. Please try again.');
      }
    };

    verifyEmail();
  }, [searchParams, navigate]);

  return (
    <div className="login-page">
      <div className="login-container">
        <h1>Yomunami</h1>
        <h2>Email Verification</h2>
        
        {status === 'loading' && (
          <div style={{ textAlign: 'center', padding: '20px' }}>
            <p>Verifying your email...</p>
          </div>
        )}

        {status === 'success' && (
          <div className="success-message">
            <p>{message}</p>
            <p>Redirecting to login...</p>
          </div>
        )}

        {status === 'error' && (
          <div className="error-message">
            <p>{message}</p>
          </div>
        )}

        <div className="signup-link">
          <Link to="/login">Go to Login</Link>
        </div>
      </div>
    </div>
  );
};

export default VerifyEmail;

