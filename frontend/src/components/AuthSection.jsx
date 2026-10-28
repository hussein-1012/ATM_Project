import React, { useState } from 'react';
import { Card, Field, Btn, ResultBox, useForm, useRequest } from './shared';
import * as api from '../api';

export default function AuthSection({ onLogin }) {
  const [tab, setTab] = useState('login');

  const [loginForm, onLoginChange] = useForm({ email: '', password: '' });
  const [registerForm, onRegisterChange] = useForm({ name: '', email: '', password: '' });
  const [forgotForm, onForgotChange] = useForm({ email: '' });
  const [otpForm, onOtpChange] = useForm({ email: '', otp: '' });
  const [resetForm, onResetChange] = useForm({ resetToken: '', newPassword: '' });
  const [refreshForm, onRefreshChange] = useForm({ refreshToken: '' });
  const [logoutForm, onLogoutChange] = useForm({ refreshToken: '' });

  const [loginR, loginL, runLogin] = useRequest();
  const [registerR, registerL, runRegister] = useRequest();
  const [forgotR, forgotL, runForgot] = useRequest();
  const [otpR, otpL, runOtp] = useRequest();
  const [resetR, resetL, runReset] = useRequest();
  const [refreshR, refreshL, runRefresh] = useRequest();
  const [logoutR, logoutL, runLogout] = useRequest();

  const tabs = [
    { id: 'login', label: '🔑 Login' },
    { id: 'register', label: '📝 Register' },
    { id: 'refresh', label: '🔄 Refresh' },
    { id: 'logout', label: '🚪 Logout' },
    { id: 'forgot', label: '📧 Forgot PW' },
    { id: 'otp', label: '🔢 Verify OTP' },
    { id: 'reset', label: '🔏 Reset PW' },
  ];

  return (
    <div className="section-content">
      <div className="section-header">
        <h2>🔐 Authentication</h2>
        <p>Test all auth endpoints — login, register, OTP flow, token refresh.</p>
      </div>
      <div className="tab-bar">
        {tabs.map(t => (
          <button key={t.id} className={`tab-btn ${tab === t.id ? 'active' : ''}`} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'login' && (
        <Card title="POST /auth/login">
          <Field label="Email" name="email" value={loginForm.email} onChange={onLoginChange} type="email" />
          <Field label="Password" name="password" value={loginForm.password} onChange={onLoginChange} type="password" />
          <Btn loading={loginL} onClick={() => runLogin(async () => {
            const r = await api.login(loginForm);
            if (r.ok && r.data?.accessToken) {
              api.setToken(r.data.accessToken);
              onLogin(r.data.accessToken, r.data.refreshToken);
            }
            return r;
          })}>Login</Btn>
          <ResultBox result={loginR} />
        </Card>
      )}

      {tab === 'register' && (
        <Card title="POST /auth/register">
          <Field label="Name" name="name" value={registerForm.name} onChange={onRegisterChange} />
          <Field label="Email" name="email" value={registerForm.email} onChange={onRegisterChange} type="email" />
          <Field label="Password" name="password" value={registerForm.password} onChange={onRegisterChange} type="password" />
          <Btn loading={registerL} onClick={() => runRegister(() => api.register(registerForm))}>Register</Btn>
          <ResultBox result={registerR} />
        </Card>
      )}

      {tab === 'refresh' && (
        <Card title="POST /auth/refresh">
          <Field label="Refresh Token" name="refreshToken" value={refreshForm.refreshToken} onChange={onRefreshChange} placeholder="Paste refresh token..." />
          <Btn loading={refreshL} onClick={() => runRefresh(async () => {
            const r = await api.refresh(refreshForm);
            if (r.ok && r.data?.accessToken) {
              api.setToken(r.data.accessToken);
              onLogin(r.data.accessToken, r.data.refreshToken);
            }
            return r;
          })}>Refresh Token</Btn>
          <ResultBox result={refreshR} />
        </Card>
      )}

      {tab === 'logout' && (
        <Card title="POST /auth/logout">
          <Field label="Refresh Token" name="refreshToken" value={logoutForm.refreshToken} onChange={onLogoutChange} placeholder="Paste refresh token..." />
          <Btn loading={logoutL} variant="danger" onClick={() => runLogout(() => api.logout(logoutForm))}>Logout</Btn>
          <ResultBox result={logoutR} />
        </Card>
      )}

      {tab === 'forgot' && (
        <Card title="POST /auth/forgot-password">
          <Field label="Email" name="email" value={forgotForm.email} onChange={onForgotChange} type="email" />
          <Btn loading={forgotL} onClick={() => runForgot(() => api.forgotPassword(forgotForm))}>Send OTP</Btn>
          <ResultBox result={forgotR} />
        </Card>
      )}

      {tab === 'otp' && (
        <Card title="POST /auth/verify-otp">
          <Field label="Email" name="email" value={otpForm.email} onChange={onOtpChange} type="email" />
          <Field label="OTP Code" name="otp" value={otpForm.otp} onChange={onOtpChange} placeholder="6-digit code" />
          <Btn loading={otpL} onClick={() => runOtp(() => api.verifyOtp(otpForm))}>Verify OTP</Btn>
          <ResultBox result={otpR} />
        </Card>
      )}

      {tab === 'reset' && (
        <Card title="POST /auth/reset-password">
          <Field label="Reset Token" name="resetToken" value={resetForm.resetToken} onChange={onResetChange} placeholder="JWT from verify-otp" />
          <Field label="New Password" name="newPassword" value={resetForm.newPassword} onChange={onResetChange} type="password" />
          <Btn loading={resetL} onClick={() => runReset(() => api.resetPassword(resetForm))}>Reset Password</Btn>
          <ResultBox result={resetR} />
        </Card>
      )}
    </div>
  );
}
