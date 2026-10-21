import React from 'react';
import { Card, Field, Btn, ResultBox, useForm, useRequest } from './shared';
import * as api from '../api';

export default function NavigationSection() {
  const [form, onChange] = useForm({
    fromLat: '29.3084',
    fromLng: '30.8428',
    atmId: '',
    mode: 'walk',
  });
  const [result, loading, run] = useRequest();

  return (
    <div className="section-content">
      <div className="section-header">
        <h2>🗺 Navigation</h2>
        <p>Get turn-by-turn routing from a location to an ATM. Uses fallback (straight-line) by default — works without external APIs.</p>
      </div>

      <Card title="POST /navigation/route">
        <div className="info-banner">
          💡 Provider = <strong>fallback</strong> (straight-line, always works). Set <code>ROUTING_PROVIDER=osrm</code> or <code>ors</code> in .env for real routing.
        </div>
        <div className="fields-row">
          <Field label="From Latitude" name="fromLat" value={form.fromLat} onChange={onChange} />
          <Field label="From Longitude" name="fromLng" value={form.fromLng} onChange={onChange} />
        </div>
        <Field label="ATM ID (UUID)" name="atmId" value={form.atmId} onChange={onChange} placeholder="paste ATM uuid..." />
        <div className="field">
          <label>Travel Mode</label>
          <select name="mode" value={form.mode} onChange={onChange}>
            <option value="walk">🚶 Walk</option>
            <option value="drive">🚗 Drive</option>
          </select>
        </div>
        <Btn loading={loading} onClick={() => run(() => api.getRoute({
          from: { lat: parseFloat(form.fromLat), lng: parseFloat(form.fromLng) },
          atmId: form.atmId,
          mode: form.mode,
        }))}>
          Get Route
        </Btn>
        <ResultBox result={result} />
      </Card>
    </div>
  );
}
