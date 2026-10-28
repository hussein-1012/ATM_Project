import React, { useState } from 'react';
import * as api from './api';
import HealthSection from './components/HealthSection';
import AuthSection from './components/AuthSection';
import AtmsSection from './components/AtmsSection';
import ReportsSection from './components/ReportsSection';
import FavoritesSection from './components/FavoritesSection';
import NavigationSection from './components/NavigationSection';
import AccountSection from './components/AccountSection';

const NAV = [
  { id: 'health',     label: 'Health',      icon: '🏥' },
  { id: 'auth',       label: 'Auth',         icon: '🔐' },
  { id: 'atms',       label: 'ATMs',         icon: '🏧' },
  { id: 'reports',    label: 'Reports',      icon: '📋' },
  { id: 'favorites',  label: 'Favorites',    icon: '⭐' },
  { id: 'navigation', label: 'Navigation',   icon: '🗺' },
  { id: 'account',    label: 'Account',      icon: '👤' },
];

export default function App() {
  const [active, setActive] = useState('health');
  const [token, setToken] = useState(null);
  const [refreshToken, setRefreshToken] = useState(null);

  const handleLogin = (at, rt) => {
    setToken(at);
    if (rt) setRefreshToken(rt);
    api.setToken(at);
  };

  const handleLogout = () => {
    setToken(null);
    setRefreshToken(null);
    api.setToken(null);
  };

  return (
    <div className="app">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-brand">
          <span className="brand-icon">🏧</span>
          <div>
            <div className="brand-title">ATM API</div>
            <div className="brand-sub">Aqrab Makina Leek</div>
          </div>
        </div>

        {/* Auth Status */}
        <div className={`auth-status ${token ? 'auth-logged-in' : 'auth-logged-out'}`}>
          {token ? (
            <>
              <span className="auth-dot" />
              <div className="auth-info">
                <span className="auth-label">Authenticated</span>
                <span className="auth-token">{token.slice(0, 20)}…</span>
              </div>
              <button className="auth-logout-btn" onClick={handleLogout} title="Logout">✕</button>
            </>
          ) : (
            <>
              <span className="auth-dot-off" />
              <span className="auth-label">Not logged in</span>
            </>
          )}
        </div>

        <nav className="sidebar-nav">
          {NAV.map(item => (
            <button
              key={item.id}
              className={`nav-item ${active === item.id ? 'nav-active' : ''}`}
              onClick={() => setActive(item.id)}
            >
              <span className="nav-icon">{item.icon}</span>
              <span className="nav-label">{item.label}</span>
              {(item.id === 'reports' || item.id === 'favorites' || item.id === 'account') && !token && (
                <span className="nav-badge-lock">🔒</span>
              )}
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="api-url">API: localhost:5155</div>
          <div className="api-ver">v1</div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="main">
        {active === 'health'     && <HealthSection />}
        {active === 'auth'       && <AuthSection onLogin={handleLogin} />}
        {active === 'atms'       && <AtmsSection />}
        {active === 'reports'    && <ReportsSection />}
        {active === 'favorites'  && <FavoritesSection />}
        {active === 'navigation' && <NavigationSection />}
        {active === 'account'    && <AccountSection />}
      </main>
    </div>
  );
}
