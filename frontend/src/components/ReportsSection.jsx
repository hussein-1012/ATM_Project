import React, { useState } from 'react';
import { Card, Field, Btn, ResultBox, useForm, useRequest } from './shared';
import * as api from '../api';

export default function ReportsSection() {
  const [tab, setTab] = useState('create');
  const [createForm, onCreateChange] = useForm({ atmId: '', status: 'WORKING' });
  const [getForm, onGetChange] = useForm({ atmId: '', limit: '10' });

  const [createR, createL, runCreate] = useRequest();
  const [getR, getL, runGet] = useRequest();

  return (
    <div className="section-content">
      <div className="section-header">
        <h2>📋 Community Reports</h2>
        <p>Submit or view ATM status reports. Requires authentication.</p>
      </div>
      <div className="tab-bar">
        <button className={`tab-btn ${tab === 'create' ? 'active' : ''}`} onClick={() => setTab('create')}>📝 Submit Report</button>
        <button className={`tab-btn ${tab === 'get' ? 'active' : ''}`} onClick={() => setTab('get')}>📄 Get Reports</button>
      </div>

      {tab === 'create' && (
        <Card title="POST /atms/:id/reports  [Auth Required]">
          <Field label="ATM ID (UUID)" name="atmId" value={createForm.atmId} onChange={onCreateChange} placeholder="paste ATM uuid..." />
          <div className="field">
            <label>Status</label>
            <select name="status" value={createForm.status} onChange={onCreateChange}>
              <option value="WORKING">✅ WORKING</option>
              <option value="OUT_OF_CASH">💸 OUT_OF_CASH</option>
              <option value="OUT_OF_SERVICE">🔴 OUT_OF_SERVICE</option>
            </select>
          </div>
          <Btn loading={createL} onClick={() => runCreate(() => api.createReport(createForm.atmId, { status: createForm.status }))}>
            Submit Report
          </Btn>
          <ResultBox result={createR} />
        </Card>
      )}

      {tab === 'get' && (
        <Card title="GET /atms/:id/reports">
          <Field label="ATM ID (UUID)" name="atmId" value={getForm.atmId} onChange={onGetChange} placeholder="paste ATM uuid..." />
          <Field label="Limit" name="limit" value={getForm.limit} onChange={onGetChange} />
          <Btn loading={getL} onClick={() => runGet(() => api.getReports(getForm.atmId, { limit: getForm.limit }))}>
            Get Reports
          </Btn>
          <ResultBox result={getR} />
        </Card>
      )}
    </div>
  );
}
