import React, { useState } from 'react';
import { useRequest } from './shared';
import AtmMapModal from './AtmMapModal';
import * as api from '../api';

// ── Haversine (same formula, for card display) ─────────────────────────────
function haversine(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const φ1 = (lat1 * Math.PI) / 180, φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function fmtDist(m) {
  if (m < 1000) return `${Math.round(m)} م`;
  return `${(m / 1000).toFixed(1)} كم`;
}

// ── Geolocation hook ───────────────────────────────────────────────────────
function useGeo() {
  const [state, setState] = useState({ status: 'idle', lat: null, lng: null, accuracy: null, error: null });

  const locate = (onSuccess) => {
    if (!navigator.geolocation) {
      setState(s => ({ ...s, status: 'error', error: 'المتصفح لا يدعم تحديد الموقع.' }));
      return;
    }
    setState(s => ({ ...s, status: 'locating', error: null }));
    navigator.geolocation.getCurrentPosition(
      ({ coords: { latitude, longitude, accuracy } }) => {
        setState({ status: 'success', lat: latitude, lng: longitude, accuracy: Math.round(accuracy), error: null });
        onSuccess && onSuccess(latitude, longitude);
      },
      (err) => {
        const msgs = {
          1: 'تم رفض الوصول للموقع. يُرجى السماح بالإذن من المتصفح.',
          2: 'تعذّر تحديد موقعك. تأكد من تفعيل GPS.',
          3: 'انتهت مهلة تحديد الموقع. حاول مرة أخرى.',
        };
        setState(s => ({ ...s, status: 'error', error: msgs[err.code] || err.message }));
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 }
    );
  };

  return [state, locate];
}

// ── Status badge ───────────────────────────────────────────────────────────
function OpenBadge({ status }) {
  if (status === 'OPEN')   return <span className="atm-open-badge open">✅ مفتوح</span>;
  if (status === 'CLOSED') return <span className="atm-open-badge closed">🔴 مغلق</span>;
  return <span className="atm-open-badge unknown">❓ غير معروف</span>;
}

// ── Bank display names ─────────────────────────────────────────────────────
const BANK_NAMES = {
  NBE: 'البنك الأهلي', BANQUE_MISR: 'بنك مصر', BANQUE_DU_CAIRE: 'بنك القاهرة',
  QNB: 'QNB', CIB: 'CIB', ALEXANDRIA_BANK: 'بنك الإسكندرية',
  AGRICULTURAL_BANK: 'البنك الزراعي', EGBANK: 'إيجي بنك',
  HOUSING_DEVELOPMENT: 'التعمير والإسكان', FAISAL_ISLAMIC: 'فيصل الإسلامي',
  AL_BARAKA: 'البركة', AAIB: 'AAIB', BANK_NXT: 'NXT',
  ADCB: 'ADCB', POSTAL: 'البريد المصري', OTHER: 'أخرى',
};

// ── Main Component ─────────────────────────────────────────────────────────
export default function AtmsSection() {
  const [geoState, locate]   = useGeo();
  const [radius, setRadius]  = useState('3000');
  const [limit, setLimit]    = useState('20');
  const [result, loading, run] = useRequest();
  const [selected, setSelected] = useState(null);   // ATM selected for map

  const items = result?.data?.items ?? [];

  const search = () => {
    locate((lat, lng) => {
      run(() => api.nearbyAtms({ lat, lng, radius, limit }));
    });
  };

  const handleCardClick = (atm) => {
    setSelected({ atm, userLat: geoState.lat, userLng: geoState.lng });
  };

  return (
    <>
      <div className="section-content">

        {/* ── Header ── */}
        <div className="section-header">
          <h2>🏧 أقرب ماكينة ليك</h2>
          <p>اضغط الزرار واحنا هنعمل الباقي — هيحدد موقعك ويجيبلك أقرب الماكينات فوراً.</p>
        </div>

        {/* ── Hero Card ── */}
        <div className="nearbyme-hero-card">
          <div className="nhc-top">
            <div className={`nhc-icon ${geoState.status === 'locating' ? 'locating' : geoState.status === 'success' ? 'success' : ''}`}>
              📍
            </div>
            <div className="nhc-options">
              <div className="nhc-option-group">
                <label>نطاق البحث</label>
                <select value={radius} onChange={e => setRadius(e.target.value)}>
                  <option value="500">500م — مشي قريب</option>
                  <option value="1000">1 كم</option>
                  <option value="2000">2 كم</option>
                  <option value="3000">3 كم</option>
                  <option value="5000">5 كم</option>
                  <option value="10000">10 كم</option>
                  <option value="20000">20 كم — الحد الأقصى</option>
                </select>
              </div>
              <div className="nhc-option-group">
                <label>عدد النتائج</label>
                <select value={limit} onChange={e => setLimit(e.target.value)}>
                  <option value="5">5 ماكينات</option>
                  <option value="10">10 ماكينات</option>
                  <option value="20">20 ماكينة</option>
                  <option value="50">50 ماكينة</option>
                </select>
              </div>
            </div>
          </div>

          {/* GPS status */}
          {geoState.status === 'locating' && (
            <div className="geo-status geo-locating">
              <span className="spinner" /> جاري تحديد موقعك…
            </div>
          )}
          {geoState.status === 'success' && (
            <div className="geo-status geo-success">
              ✅ تم تحديد موقعك بدقة ±{geoState.accuracy}م
            </div>
          )}
          {geoState.status === 'error' && (
            <div className="geo-status geo-error">❌ {geoState.error}</div>
          )}

          <button
            className="nearbyme-btn"
            onClick={search}
            disabled={loading || geoState.status === 'locating'}
          >
            {loading || geoState.status === 'locating'
              ? <><span className="spinner" /> جاري البحث…</>
              : <>📍 ابحث عن أقرب ماكينة ليا</>
            }
          </button>
        </div>

        {/* ── Error ── */}
        {result && !result.ok && (
          <div className="geo-status geo-error" style={{ marginTop: 12 }}>
            ❌ {result.data?.message || 'حدث خطأ في البحث'}
          </div>
        )}

        {/* ── Results ── */}
        {items.length > 0 && (
          <div className="atm-results-section">
            <div className="atm-results-header">
              <span>وُجد <strong>{items.length}</strong> ماكينة قريبة منك</span>
              <span className="atm-results-hint">اضغط على أي ماكينة لعرضها على الخريطة 👇</span>
            </div>

            <div className="atm-list">
              {items.map((atm, i) => {
                const atmLat = atm.location?.lat ?? atm.location?.latitude;
                const atmLng = atm.location?.lng ?? atm.location?.longitude;
                const dist   = geoState.lat ? haversine(geoState.lat, geoState.lng, atmLat, atmLng) : atm.distanceMeters;
                const walkM  = Math.ceil(dist / 78);
                const driveM = Math.ceil((dist / 25000) * 60);

                return (
                  <button key={atm.id} className="atm-list-card" onClick={() => handleCardClick(atm)}>
                    <div className="alc-rank">#{i + 1}</div>
                    <div className="alc-body">
                      <div className="alc-name">{atm.name}</div>
                      <div className="alc-meta">
                        <span className="atm-bank-badge">{BANK_NAMES[atm.bank] || atm.bank}</span>
                        <OpenBadge status={atm.openNow} />
                        {atm.isBranch && <span className="atm-branch-badge">🏦 فرع</span>}
                      </div>
                      {atm.address && <div className="alc-addr">📌 {atm.address}</div>}
                    </div>
                    <div className="alc-dist">
                      <div className="alc-dist-num">{fmtDist(dist)}</div>
                      <div className="alc-times">
                        <span>🚶 {walkM} د</span>
                        <span>🚗 {driveM} د</span>
                      </div>
                      <div className="alc-arrow">›</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Empty state ── */}
        {result?.ok && items.length === 0 && (
          <div className="empty-state">
            <div className="empty-icon">😞</div>
            <div className="empty-title">لا توجد ماكينات قريبة</div>
            <div className="empty-sub">جرّب توسيع نطاق البحث</div>
          </div>
        )}

      </div>

      {/* ── Map Modal ── */}
      {selected && (
        <AtmMapModal
          atm={selected.atm}
          userLat={selected.userLat}
          userLng={selected.userLng}
          onClose={() => setSelected(null)}
        />
      )}
    </>
  );
}
