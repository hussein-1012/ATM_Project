import React from 'react';
import { Card, Field, Btn, ResultBox, useForm, useRequest } from './shared';
import * as api from '../api';

export default function FavoritesSection() {
  const [getFavForm, onGetFavChange] = useForm({ lat: '29.3084', lng: '30.8428' });
  const [atmIdForm, onAtmIdChange] = useForm({ atmId: '' });

  const [getR, getL, runGet] = useRequest();
  const [addR, addL, runAdd] = useRequest();
  const [removeR, removeL, runRemove] = useRequest();

  const cleanParams = (obj) => {
    const clean = {};
    Object.entries(obj).forEach(([k, v]) => { if (v !== '') clean[k] = v; });
    return clean;
  };

  return (
    <div className="section-content">
      <div className="section-header">
        <h2>⭐ Favorites</h2>
        <p>Manage saved ATMs. All endpoints require authentication.</p>
      </div>

      <Card title="GET /me/favorites  [Auth Required]">
        <div className="fields-row">
          <Field label="Latitude (optional)" name="lat" value={getFavForm.lat} onChange={onGetFavChange} />
          <Field label="Longitude (optional)" name="lng" value={getFavForm.lng} onChange={onGetFavChange} />
        </div>
        <Btn loading={getL} onClick={() => runGet(() => api.getFavorites(cleanParams(getFavForm)))}>
          Get My Favorites
        </Btn>
        <ResultBox result={getR} />
      </Card>

      <Card title="PUT /me/favorites/:atmId  [Auth Required]">
        <Field label="ATM ID (UUID)" name="atmId" value={atmIdForm.atmId} onChange={onAtmIdChange} placeholder="paste ATM uuid..." />
        <Btn loading={addL} onClick={() => runAdd(() => api.addFavorite(atmIdForm.atmId))}>
          ⭐ Add to Favorites
        </Btn>
        <ResultBox result={addR} />
      </Card>

      <Card title="DELETE /me/favorites/:atmId  [Auth Required]">
        <Field label="ATM ID (UUID)" name="atmId" value={atmIdForm.atmId} onChange={onAtmIdChange} placeholder="paste ATM uuid..." />
        <Btn variant="danger" loading={removeL} onClick={() => runRemove(() => api.removeFavorite(atmIdForm.atmId))}>
          🗑 Remove Favorite
        </Btn>
        <ResultBox result={removeR} />
      </Card>
    </div>
  );
}
