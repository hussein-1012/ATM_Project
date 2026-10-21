import React, { useState } from 'react';
import { Card, Field, Btn, ResultBox, useForm, useRequest } from './shared';
import * as api from '../api';

export default function AccountSection() {
  const [tab, setTab] = useState('me');

  const [patchForm, onPatchChange] = useForm({ name: '', preferredTravelMode: '', voiceGuidance: '', language: '' });
  const [pwForm, onPwChange] = useForm({ currentPassword: '', newPassword: '' });
  const [searchForm, onSearchChange] = useForm({ query: '' });

  const [meR, meL, runMe] = useRequest();
  const [patchR, patchL, runPatch] = useRequest();
  const [pwR, pwL, runPw] = useRequest();
  const [deleteR, deleteL, runDelete] = useRequest();
  const [searchesR, searchesL, runSearches] = useRequest();
  const [addSearchR, addSearchL, runAddSearch] = useRequest();
  const [clearR, clearL, runClear] = useRequest();

  const cleanPatch = (obj) => {
    const clean = {};
    Object.entries(obj).forEach(([k, v]) => { if (v !== '') clean[k] = v; });
    return clean;
  };

  const tabs = [
    { id: 'me', label: '👤 My Profile' },
    { id: 'patch', label: '✏️ Update' },
    { id: 'pw', label: '🔑 Change PW' },
    { id: 'delete', label: '🗑 Delete Acc' },
    { id: 'searches', label: '🕒 Searches' },
  ];

  return (
    <div className="section-content">
      <div className="section-header">
        <h2>👤 Account & Settings</h2>
        <p>Manage your profile, password, and recent searches. All endpoints require authentication.</p>
      </div>
      <div className="tab-bar">
        {tabs.map(t => (
          <button key={t.id} className={`tab-btn ${tab === t.id ? 'active' : ''}`} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'me' && (
        <Card title="GET /me  [Auth Required]">
          <Btn loading={meL} onClick={() => runMe(() => api.getMe())}>Get My Profile</Btn>
          <ResultBox result={meR} />
        </Card>
      )}

      {tab === 'patch' && (
        <Card title="PATCH /me  [Auth Required]">
          <p className="hint">Fill only the fields you want to update.</p>
          <Field label="Name" name="name" value={patchForm.name} onChange={onPatchChange} />
          <div className="field">
            <label>Preferred Travel Mode</label>
            <select name="preferredTravelMode" value={patchForm.preferredTravelMode} onChange={onPatchChange}>
              <option value="">— no change —</option>
              <option value="walk">Walk</option>
              <option value="drive">Drive</option>
            </select>
          </div>
          <div className="field">
            <label>Voice Guidance</label>
            <select name="voiceGuidance" value={patchForm.voiceGuidance} onChange={onPatchChange}>
              <option value="">— no change —</option>
              <option value="true">Enabled</option>
              <option value="false">Disabled</option>
            </select>
          </div>
          <div className="field">
            <label>Language</label>
            <select name="language" value={patchForm.language} onChange={onPatchChange}>
              <option value="">— no change —</option>
              <option value="ar">Arabic</option>
              <option value="en">English</option>
            </select>
          </div>
          <Btn loading={patchL} onClick={() => {
            const body = cleanPatch(patchForm);
            if (body.voiceGuidance) body.voiceGuidance = body.voiceGuidance === 'true';
            runPatch(() => api.updateMe(body));
          }}>Update Profile</Btn>
          <ResultBox result={patchR} />
        </Card>
      )}

      {tab === 'pw' && (
        <Card title="POST /me/change-password  [Auth Required]">
          <Field label="Current Password" name="currentPassword" value={pwForm.currentPassword} onChange={onPwChange} type="password" />
          <Field label="New Password" name="newPassword" value={pwForm.newPassword} onChange={onPwChange} type="password" />
          <Btn loading={pwL} onClick={() => runPw(() => api.changePassword(pwForm))}>Change Password</Btn>
          <ResultBox result={pwR} />
        </Card>
      )}

      {tab === 'delete' && (
        <Card title="DELETE /me  [Auth Required]">
          <div className="danger-banner">
            ⚠️ <strong>Destructive action!</strong> This soft-deletes your account and anonymizes all PII. Cannot be undone.
          </div>
          <Btn variant="danger" loading={deleteL} onClick={() => runDelete(() => api.deleteMe())}>
            🗑 Delete My Account
          </Btn>
          <ResultBox result={deleteR} />
        </Card>
      )}

      {tab === 'searches' && (
        <>
          <Card title="GET /me/recent-searches  [Auth Required]">
            <Btn loading={searchesL} onClick={() => runSearches(() => api.getRecentSearches())}>Get Recent Searches</Btn>
            <ResultBox result={searchesR} />
          </Card>
          <Card title="POST /me/recent-searches  [Auth Required]">
            <Field label="Search Query" name="query" value={searchForm.query} onChange={onSearchChange} placeholder="e.g. NBE Fayoum" />
            <Btn loading={addSearchL} onClick={() => runAddSearch(() => api.addRecentSearch({ query: searchForm.query }))}>
              Save Search
            </Btn>
            <ResultBox result={addSearchR} />
          </Card>
          <Card title="DELETE /me/recent-searches  [Auth Required]">
            <Btn variant="danger" loading={clearL} onClick={() => runClear(() => api.clearRecentSearches())}>
              🗑 Clear All Searches
            </Btn>
            <ResultBox result={clearR} />
          </Card>
        </>
      )}
    </div>
  );
}
