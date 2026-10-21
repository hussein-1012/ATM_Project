import React, { useEffect } from 'react';
import { Card, Btn, ResultBox, useRequest } from './shared';
import * as api from '../api';

export default function HealthSection() {
  const [result, loading, run] = useRequest();

  useEffect(() => { run(() => api.health()); }, []);

  const statusOk = result?.data?.status === 'ok';
  return (
    <div className="section-content">
      <div className="section-header">
        <h2>🏥 Health Check</h2>
        <p>Check if the API, database, and Redis are all healthy.</p>
      </div>
      <Card title="GET /v1/health">
        <div className="health-indicators">
          {result && (
            <>
              <div className={`health-pill ${statusOk ? 'pill-green' : 'pill-red'}`}>
                <span className="pulse-dot" style={{ background: statusOk ? 'var(--green)' : 'var(--red)' }} />
                API {statusOk ? 'Online' : 'Offline'}
              </div>
              <div className={`health-pill ${result.data?.info?.database?.status === 'up' ? 'pill-green' : 'pill-red'}`}>
                <span className="pulse-dot" style={{ background: result.data?.info?.database?.status === 'up' ? 'var(--green)' : 'var(--red)' }} />
                PostgreSQL
              </div>
              <div className={`health-pill ${result.data?.info?.redis?.status === 'up' ? 'pill-green' : 'pill-red'}`}>
                <span className="pulse-dot" style={{ background: result.data?.info?.redis?.status === 'up' ? 'var(--green)' : 'var(--red)' }} />
                Redis
              </div>
            </>
          )}
        </div>
        <Btn onClick={() => run(() => api.health())} loading={loading}>🔄 Refresh</Btn>
        <ResultBox result={result} />
      </Card>
    </div>
  );
}
