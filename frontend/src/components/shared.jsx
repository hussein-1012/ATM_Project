import React, { useState } from 'react';
import * as api from '../api';

const statusColor = (ok) => ok ? 'var(--green)' : 'var(--red)';

export function ResultBox({ result }) {
  if (!result) return null;
  const ok = result.ok;
  return (
    <div className={`result-box ${ok ? 'result-ok' : 'result-err'}`}>
      <div className="result-status">
        <span className="badge" style={{ background: statusColor(ok) }}>
          {result.status}
        </span>
        <span>{ok ? '✓ Success' : '✗ Error'}</span>
      </div>
      <pre>{JSON.stringify(result.data, null, 2)}</pre>
    </div>
  );
}

export function Field({ label, name, value, onChange, type = 'text', placeholder }) {
  return (
    <div className="field">
      <label>{label}</label>
      <input
        type={type}
        name={name}
        value={value}
        onChange={onChange}
        placeholder={placeholder || label}
        autoComplete="off"
      />
    </div>
  );
}

export function Btn({ onClick, children, variant = 'primary', loading }) {
  return (
    <button className={`btn btn-${variant}`} onClick={onClick} disabled={loading}>
      {loading ? <span className="spinner" /> : children}
    </button>
  );
}

export function Card({ title, children }) {
  return (
    <div className="card">
      <h3 className="card-title">{title}</h3>
      {children}
    </div>
  );
}

export function useForm(initial) {
  const [form, setForm] = useState(initial);
  const onChange = (e) => setForm(f => ({ ...f, [e.target.name]: e.target.value }));
  const reset = () => setForm(initial);
  return [form, onChange, reset, setForm];
}

export function useRequest() {
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const run = async (fn) => {
    setLoading(true);
    try {
      const r = await fn();
      setResult(r);
    } catch (e) {
      setResult({ ok: false, status: 0, data: { message: e.message } });
    } finally {
      setLoading(false);
    }
  };
  return [result, loading, run];
}
