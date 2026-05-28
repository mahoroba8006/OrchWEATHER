import { useState } from 'react';
import type { CSSProperties } from 'react';
import { MapPin, Plus, Save, Trash2, Loader2 } from 'lucide-react';
import { useAppStore, type LocationInfo } from '../../store';
import { GEO_OPTIONS, getGeoErrorMessage, GEO_SUPPORTED } from '../../lib/geo';

type GeoStatus = 'idle' | 'loading' | 'error';

const greenButtonStyle: CSSProperties = {
  padding: '0.4rem 0.8rem',
  fontSize: '0.8rem',
  background: 'rgba(13,148,136,0.12)',
  color: 'var(--accent-color)',
  border: '1px solid rgba(13,148,136,0.3)',
  borderRadius: 'var(--radius-md, 6px)',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  gap: '0.3rem',
};

const pinkButtonStyle: CSSProperties = {
  padding: '0.4rem 0.8rem',
  fontSize: '0.8rem',
  background: 'rgba(244,167,185,0.35)',
  color: '#7a2840',
  border: '1px solid rgba(244,167,185,0.6)',
  borderRadius: 'var(--radius-md, 6px)',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  gap: '0.3rem',
};

export function LocationSettings() {
  const { locations, addLocation, updateLocation, deleteLocation, userSettings, updateDefaultLocationId } =
    useAppStore();
  const defaultLocationId = userSettings?.defaultLocationId ?? null;

  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<LocationInfo>>({});

  const [geoStatus, setGeoStatus] = useState<GeoStatus>('idle');
  const [geoError, setGeoError] = useState<string>('');

  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'error'>('idle');
  const [saveError, setSaveError] = useState('');

  const handleEdit = (loc: LocationInfo) => {
    setEditingId(loc.id);
    setFormData(loc);
    setGeoError('');
    setGeoStatus('idle');
    setSaveStatus('idle');
    setSaveError('');
  };

  const handleAddNew = () => {
    setEditingId('new');
    setFormData({ name: '新規地点', lat: 35.0, lon: 135.0 });
    setGeoError('');
    setSaveStatus('idle');
    setSaveError('');
  };

  const handleGetCurrentLocation = () => {
    if (!GEO_SUPPORTED) return;
    setGeoStatus('loading');
    setGeoError('');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = parseFloat(position.coords.latitude.toFixed(6));
        const lon = parseFloat(position.coords.longitude.toFixed(6));
        setGeoStatus('idle');
        setEditingId('new');
        setFormData({ name: '現在地', lat, lon });
        setSaveStatus('idle');
        setSaveError('');
      },
      (err) => {
        setGeoStatus('error');
        setGeoError(getGeoErrorMessage(err));
      },
      GEO_OPTIONS,
    );
  };

  const handleSave = async () => {
    setSaveStatus('saving');
    setSaveError('');
    try {
      if (editingId === 'new') {
        await addLocation(formData as Omit<LocationInfo, 'id'>);
      } else if (editingId) {
        await updateLocation(editingId, formData);
      }
      setSaveStatus('idle');
      setEditingId(null);
    } catch (err: unknown) {
      console.error('[LocationSettings] save failed', err);
      setSaveError(err instanceof Error ? err.message : '保存に失敗しました');
      setSaveStatus('error');
    }
  };

  const handleDelete = (id: string) => {
    if (window.confirm('本当に削除しますか？')) {
      deleteLocation(id);
      if (editingId === id) setEditingId(null);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* ヘッダー */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '0.5rem',
        }}
      >
        <h3 style={{ margin: 0, fontSize: '1.1rem' }}>登録地点</h3>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {/* 現在地で登録 */}
          <button
            onClick={handleGetCurrentLocation}
            disabled={!GEO_SUPPORTED || geoStatus === 'loading'}
            style={{
              ...greenButtonStyle,
              opacity: !GEO_SUPPORTED ? 0.5 : 1,
              cursor:
                !GEO_SUPPORTED || geoStatus === 'loading'
                  ? 'not-allowed'
                  : 'pointer',
            }}
          >
            {geoStatus === 'loading' ? (
              <>
                <Loader2
                  size={16}
                  style={{ animation: 'spin 1s linear infinite' }}
                />
                取得中…
              </>
            ) : (
              <>
                <MapPin size={16} />
                現在地で登録
              </>
            )}
          </button>

          {/* 手動で追加 */}
          <button onClick={handleAddNew} style={pinkButtonStyle}>
            <Plus size={16} />
            手動で追加
          </button>
        </div>
      </div>

      {/* エラーメッセージ */}
      {geoStatus === 'error' && geoError && (
        <div
          style={{
            padding: '0.6rem 0.9rem',
            background: 'rgba(239,68,68,0.12)',
            border: '1px solid rgba(239,68,68,0.35)',
            borderRadius: 'var(--radius-md, 6px)',
            color: '#c62828',
            fontSize: '0.82rem',
          }}
        >
          ⚠ {geoError}
        </div>
      )}

      {/* 地点リスト */}
      {locations.map((loc) => (
        <div
          key={loc.id}
          className="glass-card"
          style={{
            padding: '1rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div>
            <div style={{ fontWeight: 600, fontSize: '1.1rem' }}>
              {loc.name}
            </div>
            <div
              style={{
                fontSize: '0.85rem',
                color: 'var(--text-secondary)',
                marginTop: '0.3rem',
              }}
            >
              緯度: {loc.lat} / 経度: {loc.lon}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            {defaultLocationId === loc.id ? (
              <>
                <span style={{
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  color: 'var(--accent-color)',
                  background: 'rgba(13,148,136,0.12)',
                  border: '1px solid rgba(13,148,136,0.3)',
                  borderRadius: '999px',
                  padding: '0.2rem 0.6rem',
                  whiteSpace: 'nowrap',
                }}>
                  ★ デフォルト
                </span>
                <button
                  className="secondary"
                  onClick={() => updateDefaultLocationId(null)}
                  style={{ fontSize: '0.75rem' }}
                >
                  解除
                </button>
              </>
            ) : (
              <button
                className="secondary"
                onClick={() => updateDefaultLocationId(loc.id)}
                style={{ fontSize: '0.75rem' }}
              >
                デフォルトに設定
              </button>
            )}
            <button className="secondary" onClick={() => handleEdit(loc)}>
              編集
            </button>
            <button
              className="secondary"
              onClick={() => handleDelete(loc.id)}
              style={{ color: 'var(--chart-temp)' }}
            >
              <Trash2 size={16} />
            </button>
          </div>
        </div>
      ))}

      {/* インライン編集フォーム */}
      {editingId && (
        <div
          className="glass-panel"
          style={{
            padding: '1.5rem',
            marginTop: '0.5rem',
            border: '1px solid var(--accent-light)',
          }}
        >
          <h3 style={{ margin: '0 0 1rem 0' }}>
            {editingId === 'new' ? '新規地点の追加' : '地点の編集'}
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className="form-group">
              <label>地点名</label>
              <input
                type="text"
                value={formData.name || ''}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
              />
            </div>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <div
                className="form-group"
                style={{ flex: 1, minWidth: 0 }}
              >
                <label>緯度 (Latitude)</label>
                <input
                  type="number"
                  step="0.000001"
                  value={formData.lat ?? ''}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      lat: parseFloat(e.target.value),
                    })
                  }
                  style={{ width: '100%', boxSizing: 'border-box' }}
                />
              </div>
              <div
                className="form-group"
                style={{ flex: 1, minWidth: 0 }}
              >
                <label>経度 (Longitude)</label>
                <input
                  type="number"
                  step="0.000001"
                  value={formData.lon ?? ''}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      lon: parseFloat(e.target.value),
                    })
                  }
                  style={{ width: '100%', boxSizing: 'border-box' }}
                />
              </div>
            </div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                alignItems: 'center',
                gap: '0.5rem',
                marginTop: '0.5rem',
              }}
            >
              {saveStatus === 'saving' && (
                <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', alignSelf: 'center' }}>保存中…</span>
              )}
              {saveStatus === 'error' && (
                <span style={{ fontSize: '0.78rem', color: '#c62828', alignSelf: 'center' }}>⚠ {saveError}</span>
              )}
              <button
                className="secondary"
                onClick={() => setEditingId(null)}
              >
                キャンセル
              </button>
              <button
                onClick={handleSave}
                disabled={saveStatus === 'saving'}
                style={{
                  ...pinkButtonStyle,
                  padding: '0.5rem 1rem',
                  opacity: saveStatus === 'saving' ? 0.6 : 1,
                  cursor: saveStatus === 'saving' ? 'not-allowed' : 'pointer',
                }}
              >
                <Save size={16} />
                {saveStatus === 'saving' ? '保存中…' : '保存'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
