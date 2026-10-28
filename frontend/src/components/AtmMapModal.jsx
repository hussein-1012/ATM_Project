import React, { useEffect, useRef, useState, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import * as api from '../api';

// ─── Geo Math ──────────────────────────────────────────────────────────────
function haversine(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const toRad = d => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1), dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Shortest distance (meters) from point P to line segment AB */
function distToSegment(pLat, pLng, aLat, aLng, bLat, bLng) {
  const dx = bLat - aLat, dy = bLng - aLng;
  if (dx === 0 && dy === 0) return haversine(pLat, pLng, aLat, aLng);
  const t = Math.max(0, Math.min(1, ((pLat - aLat) * dx + (pLng - aLng) * dy) / (dx * dx + dy * dy)));
  return haversine(pLat, pLng, aLat + t * dx, aLng + t * dy);
}

/** Min distance from point to any segment of a polyline [[lat,lng],...] */
function distToPolyline(lat, lng, coords) {
  let min = Infinity;
  for (let i = 0; i < coords.length - 1; i++) {
    const d = distToSegment(lat, lng, coords[i][0], coords[i][1], coords[i + 1][0], coords[i + 1][1]);
    if (d < min) min = d;
  }
  return min;
}

function fmtDist(m) {
  if (m < 100)  return `${Math.round(m)} م`;
  if (m < 1000) return `${Math.round(m / 10) * 10} م`;
  return `${(m / 1000).toFixed(1)} كم`;
}

function fmtETA(secs) {
  if (secs < 60)  return `${Math.round(secs)} ث`;
  if (secs < 3600) return `${Math.round(secs / 60)} د`;
  const h = Math.floor(secs / 3600), m = Math.round((secs % 3600) / 60);
  return `${h} س ${m} د`;
}

function fmtSpeed(mps) {
  return `${Math.round(mps * 3.6)} كم/س`;
}

// ─── Maneuver icons & labels ───────────────────────────────────────────────
const MANEUVER = {
  DEPART:       { icon: '🚀', svg: '↑',  label: 'ابدأ' },
  STRAIGHT:     { icon: '⬆️', svg: '↑',  label: 'استمر للأمام' },
  TURN_LEFT:    { icon: '↰',  svg: '←',  label: 'انعطف يساراً' },
  TURN_RIGHT:   { icon: '↱',  svg: '→',  label: 'انعطف يميناً' },
  SLIGHT_LEFT:  { icon: '↖️', svg: '↖',  label: 'انحرف يساراً' },
  SLIGHT_RIGHT: { icon: '↗️', svg: '↗',  label: 'انحرف يميناً' },
  UTURN:        { icon: '↩️', svg: '↩',  label: 'استدر' },
  ARRIVE:       { icon: '🏁', svg: '⬛', label: 'وصلت للهدف' },
};

// ─── Custom Leaflet markers ────────────────────────────────────────────────
const makeATMIcon = () => L.divIcon({
  html: `<div class="map-atm-marker"><span>🏧</span></div>`,
  className: '', iconSize: [44, 44], iconAnchor: [22, 44],
});

const makeUserIcon = () => L.divIcon({
  html: `<div class="map-user-marker"><div class="map-user-pulse"></div></div>`,
  className: '', iconSize: [22, 22], iconAnchor: [11, 11],
});

const DEVIATION_THRESHOLD = 75;   // meters — triggers recalculation
const ARRIVED_THRESHOLD   = 25;   // meters — "you have arrived"
const STEP_ADVANCE_DIST   = 30;   // meters — auto-advance to next step

// ─── Main Modal ────────────────────────────────────────────────────────────
export default function AtmMapModal({ atm, userLat, userLng, onClose }) {
  const mapRef       = useRef(null);
  const mapObj       = useRef(null);
  const userMarker   = useRef(null);
  const atmMarker    = useRef(null);
  const routeLayer   = useRef(null);
  const passedLayer  = useRef(null);
  const watchId      = useRef(null);

  const atmLat = atm.location?.lat ?? atm.location?.latitude;
  const atmLng = atm.location?.lng ?? atm.location?.longitude;

  // Position state
  const [pos, setPos]           = useState({ lat: userLat, lng: userLng, accuracy: null, speed: null, heading: null });
  const posRef                  = useRef({ lat: userLat, lng: userLng });

  // Route state
  const [route, setRoute]       = useState(null);    // RouteResult from backend
  const [routeCoords, setRC]    = useState(null);    // [[lat,lng],...] from polyline
  const routeRef                = useRef(null);
  const routeCoordsRef          = useRef(null);      // always-current coords for closure

  // Navigation state
  const [navMode, setNavMode]   = useState(false);
  const navModeRef              = useRef(false);     // always-current navMode for closure
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);
  const [travelMode, setTMode]  = useState('walk');
  const [currentStep, setStep]  = useState(0);
  const [distLeft, setDistLeft] = useState(null);
  const [etaLeft, setEtaLeft]   = useState(null);
  const [deviated, setDeviated] = useState(false);
  const [recalcing, setRecalc]  = useState(false);
  const [arrived, setArrived]   = useState(false);
  const [geoErr, setGeoErr]     = useState(null);

  // ── Init Leaflet map ───────────────────────────────────────────────────
  useEffect(() => {
    if (mapObj.current) return;

    mapObj.current = L.map(mapRef.current, {
      center: [(userLat + atmLat) / 2, (userLng + atmLng) / 2],
      zoom: 15, zoomControl: true, attributionControl: true,
    });

    // Dark CartoDB tiles (free, no key)
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '© <a href="https://openstreetmap.org">OSM</a> © <a href="https://carto.com">CARTO</a>',
      subdomains: 'abcd', maxZoom: 20,
    }).addTo(mapObj.current);

    // Placeholder layers
    passedLayer.current = L.polyline([], { color: '#4b5563', weight: 4, opacity: 0.5 }).addTo(mapObj.current);
    routeLayer.current  = L.polyline([], { color: '#6366f1', weight: 5, opacity: 0.9 }).addTo(mapObj.current);

    userMarker.current = L.marker([userLat, userLng], { icon: makeUserIcon(), zIndexOffset: 1000 })
      .addTo(mapObj.current)
      .bindPopup('<b>📍 موقعك</b>');

    atmMarker.current = L.marker([atmLat, atmLng], { icon: makeATMIcon() })
      .addTo(mapObj.current)
      .bindPopup(`<b>🏧 ${atm.name}</b><br>${atm.bank}${atm.address ? '<br>' + atm.address : ''}`);

    // Initial fit
    mapObj.current.fitBounds(
      L.latLngBounds([[userLat, userLng], [atmLat, atmLng]]),
      { padding: [60, 60] }
    );
  }, []);

  // ── Fetch route ────────────────────────────────────────────────────────
  const fetchRoute = useCallback(async (fromLat, fromLng, mode) => {
    setLoading(true); setError(null); setRecalc(false);
    try {
      const r = await api.getRoute({ from: { lat: fromLat, lng: fromLng }, atmId: atm.id, mode });
      if (!r.ok) throw new Error(r.data?.message || 'فشل في جلب المسار');

      const data = r.data;
      setRoute(data);
      routeRef.current = data;

      // Convert GeoJSON [lng,lat] → Leaflet [lat,lng]
      const coords = (data.polyline?.coordinates ?? []).map(([lng, lat]) => [lat, lng]);
      setRC(coords);
      routeCoordsRef.current = coords;   // keep ref in sync
      setDistLeft(data.distanceMeters);
      setEtaLeft(data.durationSeconds);
      setStep(0);
      setDeviated(false);

      // Draw on map
      if (mapObj.current) {
        routeLayer.current.setLatLngs(coords);
        passedLayer.current.setLatLngs([]);
        if (coords.length > 1) {
          mapObj.current.fitBounds(L.latLngBounds(coords), { padding: [60, 60] });
        }
      }
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  }, [atm.id]);

  // Initial fetch
  useEffect(() => { fetchRoute(userLat, userLng, travelMode); }, [travelMode]);

  // ── Sync navMode ref ───────────────────────────────────────────────────
  useEffect(() => { navModeRef.current = navMode; }, [navMode]);

  // ── Cleanup map on unmount ─────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (watchId.current) navigator.geolocation.clearWatch(watchId.current);
      if (mapObj.current) { mapObj.current.remove(); mapObj.current = null; }
    };
  }, []);

  // ── Live GPS watch ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!navigator.geolocation) {
      setGeoErr('المتصفح لا يدعم GPS');
      return;
    }

    watchId.current = navigator.geolocation.watchPosition(
      (p) => {
        const { latitude: lat, longitude: lng, accuracy, speed, heading } = p.coords;
        setPos({ lat, lng, accuracy: Math.round(accuracy), speed, heading });
        posRef.current = { lat, lng };

        // Update user marker
        if (userMarker.current) userMarker.current.setLatLng([lat, lng]);

        // Check arrived
        const dToATM = haversine(lat, lng, atmLat, atmLng);
        if (dToATM < ARRIVED_THRESHOLD) { setArrived(true); return; }

        // If navigating: update remaining route, check deviation, advance steps
        if (routeRef.current && routeRef.current.polyline?.coordinates) {
          // Use ref for always-current coords (not stale closure)
          const coords = routeCoordsRef.current ||
            routeRef.current.polyline.coordinates.map(([lo, la]) => [la, lo]);

          // Deviation check
          if (coords.length > 1) {
            const distFromRoute = distToPolyline(lat, lng, coords);
            if (distFromRoute > DEVIATION_THRESHOLD) {
              setDeviated(true);
            }
          }

          // Remaining distance estimate (haversine to destination)
          setDistLeft(dToATM);
          // ETA: rough estimate based on speed or mode average
          const speedMps = p.coords.speed && p.coords.speed > 0 ? p.coords.speed : null;
          if (speedMps) {
            setEtaLeft(Math.round(dToATM / speedMps));
          }

          // Advance step: if close to next step location
          const steps = routeRef.current.steps ?? [];
          setStep(prev => {
            const next = prev + 1;
            if (next < steps.length) {
              const sl = steps[next].location;
              if (haversine(lat, lng, sl.lat, sl.lng) < STEP_ADVANCE_DIST) return next;
            }
            return prev;
          });

          // Auto-center in nav mode — use ref to avoid stale closure
          if (navModeRef.current) {
            mapObj.current?.setView([lat, lng], 17, { animate: true });
          }
        }
      },
      (err) => setGeoErr(`تعذّر تتبع موقعك (${err.code})`),
      { enableHighAccuracy: true, maximumAge: 3000, timeout: 20000 }
    );

    return () => {
      if (watchId.current !== null) {
        navigator.geolocation.clearWatch(watchId.current);
        watchId.current = null;
      }
    };
  }, [atmLat, atmLng]);  // navMode excluded — handled via navModeRef

  // ── Auto-recalculate on deviation ──────────────────────────────────────
  useEffect(() => {
    if (!deviated || recalcing) return;
    const { lat, lng } = posRef.current;
    setRecalc(true);
    fetchRoute(lat, lng, travelMode).finally(() => setRecalc(false));
  }, [deviated]);

  // ── Start navigation ───────────────────────────────────────────────────
  const startNav = () => {
    setNavMode(true);
    setStep(0);
    if (mapObj.current) {
      const { lat, lng } = posRef.current;
      mapObj.current.setView([lat, lng], 17, { animate: true });
    }
  };

  const stopNav = () => {
    setNavMode(false);
    if (mapObj.current && routeCoords?.length) {
      mapObj.current.fitBounds(L.latLngBounds(routeCoords), { padding: [60, 60] });
    }
  };

  // ── Map controls ───────────────────────────────────────────────────────
  const centerOnMe = () => {
    const { lat, lng } = posRef.current;
    mapObj.current?.setView([lat, lng], 17, { animate: true });
  };

  const fitAll = () => {
    if (routeCoords?.length) {
      mapObj.current?.fitBounds(L.latLngBounds(routeCoords), { padding: [60, 60] });
    } else {
      mapObj.current?.fitBounds(
        L.latLngBounds([[pos.lat, pos.lng], [atmLat, atmLng]]),
        { padding: [60, 60] }
      );
    }
  };

  // ── Current step data ──────────────────────────────────────────────────
  const steps        = route?.steps ?? [];
  const step         = steps[currentStep] ?? null;
  const nextStep     = steps[currentStep + 1] ?? null;
  const maneuverInfo = MANEUVER[step?.maneuver] ?? MANEUVER.STRAIGHT;
  const isApprox     = route?.approximate ?? true;

  // Distance to next turn
  const distToNextTurn = step?.distanceMeters ? fmtDist(step.distanceMeters) : null;

  // ── Status bar color ───────────────────────────────────────────────────
  const openColor = atm.openNow === 'OPEN' ? '#10b981' : atm.openNow === 'CLOSED' ? '#ef4444' : '#64748b';
  const openLabel = atm.openNow === 'OPEN' ? '✅ مفتوح' : atm.openNow === 'CLOSED' ? '🔴 مغلق' : '❓ غير معروف';

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && !navMode && onClose()}>
      <div className={`modal-sheet ${navMode ? 'modal-nav-mode' : ''}`}>

        {/* ── ATM Header ────────────────────────────────────── */}
        {!navMode && (
          <div className="modal-header">
            <div className="modal-atm-info">
              <div className="modal-atm-name">{atm.name}</div>
              <div className="modal-atm-meta">
                <span className="modal-bank">{atm.bank}</span>
                <span className="modal-open" style={{ color: openColor }}>{openLabel}</span>
                {atm.address && <span className="modal-addr">📌 {atm.address}</span>}
              </div>
            </div>
            <button className="modal-close" onClick={onClose}>✕</button>
          </div>
        )}

        {/* ── Recalculating Banner ───────────────────────────── */}
        {recalcing && (
          <div className="recalc-banner">
            <span className="spinner" /> جاري إعادة حساب المسار…
          </div>
        )}

        {/* ── Arrived Banner ────────────────────────────────── */}
        {arrived && (
          <div className="arrived-banner">
            🎉 وصلت! أنت الآن بجوار <strong>{atm.name}</strong>
            <button className="arrived-close" onClick={onClose}>إغلاق</button>
          </div>
        )}

        {/* ── Navigation HUD (nav mode only) ────────────────── */}
        {navMode && !arrived && step && (
          <div className="nav-hud">
            {/* Next maneuver */}
            <div className="hud-maneuver">
              <div className="hud-arrow">{maneuverInfo.svg}</div>
              <div className="hud-info">
                <div className="hud-dist">{distToNextTurn}</div>
                <div className="hud-label">{maneuverInfo.label}</div>
                {step.streetName && <div className="hud-street">{step.streetName}</div>}
              </div>
            </div>

            {/* Summary */}
            <div className="hud-summary">
              <div className="hud-remain">
                <span className="hud-remain-dist">{distLeft !== null ? fmtDist(distLeft) : '—'}</span>
                <span className="hud-remain-label">متبقي</span>
              </div>
              {etaLeft !== null && (
                <div className="hud-eta">
                  <span className="hud-eta-val">{fmtETA(etaLeft)}</span>
                  <span className="hud-eta-label">ETA</span>
                </div>
              )}
              {pos.speed !== null && pos.speed > 0 && (
                <div className="hud-speed">
                  <span className="hud-speed-val">{fmtSpeed(pos.speed)}</span>
                  <span className="hud-speed-label">السرعة</span>
                </div>
              )}
            </div>

            {/* Next turn preview */}
            {nextStep && (
              <div className="hud-next">
                ثم: {MANEUVER[nextStep.maneuver]?.icon} {MANEUVER[nextStep.maneuver]?.label}
                {nextStep.streetName ? ` على ${nextStep.streetName}` : ''}
              </div>
            )}

            <button className="hud-stop-btn" onClick={stopNav}>⏹ إيقاف الملاحة</button>
          </div>
        )}

        {/* ── Map ───────────────────────────────────────────── */}
        <div className="modal-map-wrap">
          <div ref={mapRef} className="modal-map" />

          {/* Loading overlay */}
          {loading && (
            <div className="map-loading">
              <span className="spinner" />
              <span>جاري تحميل المسار…</span>
            </div>
          )}

          {/* Error overlay */}
          {error && !loading && (
            <div className="map-error-bar">
              ⚠️ {error} — يتم عرض خط مستقيم
            </div>
          )}

          {/* GPS accuracy */}
          {pos.accuracy && !navMode && (
            <div className="map-accuracy-chip">📡 دقة GPS: ±{pos.accuracy}م</div>
          )}

          {/* Route type badge */}
          {route && !loading && (
            <div className={`map-route-badge ${isApprox ? 'badge-approx' : 'badge-real'}`}>
              {isApprox ? '📏 تقريبي' : '🛣 مسار حقيقي (OSRM)'}
            </div>
          )}

          {/* Map controls */}
          <div className="map-controls">
            <button className="map-ctrl-btn" onClick={centerOnMe} title="موقعي">📍</button>
            <button className="map-ctrl-btn" onClick={fitAll}     title="عرض الكل">⊕</button>
            <button
              className="map-ctrl-btn"
              onClick={() => fetchRoute(posRef.current.lat, posRef.current.lng, travelMode)}
              disabled={loading}
              title="تحديث المسار"
            >
              {loading ? <span className="spinner" style={{ width: 12, height: 12, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff' }} /> : '🔄'}
            </button>
          </div>

          {geoErr && <div className="map-geo-err">⚠️ {geoErr}</div>}
        </div>

        {/* ── Bottom Panel (preview mode) ────────────────────── */}
        {!navMode && (
          <div className="modal-bottom-panel">
            {/* Travel mode selector */}
            <div className="travel-mode-row">
              <button
                className={`mode-pill ${travelMode === 'walk' ? 'mode-active' : ''}`}
                onClick={() => setTMode('walk')}
              >🚶 مشي</button>
              <button
                className={`mode-pill ${travelMode === 'drive' ? 'mode-active' : ''}`}
                onClick={() => setTMode('drive')}
              >🚗 سيارة</button>
            </div>

            {/* Distance & Time summary */}
            {route && !loading && (
              <div className="route-summary">
                <div className="rs-item">
                  <span className="rs-val">{fmtDist(distLeft ?? route.distanceMeters)}</span>
                  <span className="rs-label">المسافة</span>
                </div>
                <div className="rs-divider" />
                <div className="rs-item">
                  <span className="rs-val">{fmtETA(etaLeft ?? route.durationSeconds)}</span>
                  <span className="rs-label">الوقت المتوقع</span>
                </div>
                <div className="rs-divider" />
                <div className="rs-item">
                  <span className="rs-val" style={{ fontSize: 12, color: isApprox ? 'var(--text3)' : 'var(--green)' }}>
                    {isApprox ? 'تقريبي' : 'OSRM ✓'}
                  </span>
                  <span className="rs-label">نوع المسار</span>
                </div>
              </div>
            )}

            {/* Start Navigation button */}
            <button
              className="start-nav-btn"
              onClick={startNav}
              disabled={loading || !route}
            >
              {loading
                ? <><span className="spinner" /> جاري تحميل المسار…</>
                : <>🧭 ابدأ الملاحة</>
              }
            </button>

            {/* Turn-by-turn steps */}
            {steps.length > 0 && !isApprox && (
              <div className="steps-panel">
                <div className="steps-title">الاتجاهات التفصيلية</div>
                <div className="steps-list">
                  {steps.map((s, i) => {
                    const m = MANEUVER[s.maneuver] ?? MANEUVER.STRAIGHT;
                    const isCurrent = i === currentStep && navMode;
                    return (
                      <div key={i} className={`step-row ${isCurrent ? 'step-current' : ''}`}>
                        <div className="step-icon-wrap">
                          <span className="step-svg">{m.svg}</span>
                        </div>
                        <div className="step-body">
                          <div className="step-action">{m.label}</div>
                          {s.streetName && <div className="step-street">{s.streetName}</div>}
                        </div>
                        <div className="step-dist">{fmtDist(s.distanceMeters)}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
