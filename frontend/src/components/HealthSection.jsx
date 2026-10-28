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
        <p>Check if the .NET API is running and healthy.</p>
      </div>
      <Card title="GET /v1/health">
        <div className="health-indicators">
          {result && (
            <>
              <div className={`health-pill ${statusOk ? 'pill-green' : 'pill-red'}`}>
                <span className="pulse-dot" style={{ background: statusOk ? 'var(--green)' : 'var(--red)' }} />
                API {statusOk ? 'Online' : 'Offline'}
              </div>
              {result.data?.timestamp && (
                <div className="health-pill pill-green">
                  <span className="pulse-dot" style={{ background: 'var(--green)' }} />
                  Timestamp: {new Date(result.data.timestamp).toLocaleTimeString()}
                </div>
              )}
            </>
          )}
        </div>
        <Btn onClick={() => run(() => api.health())} loading={loading}>🔄 Refresh</Btn>
        <ResultBox result={result} />
      </Card>
    </div>
  );
}
