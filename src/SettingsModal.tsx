import { useState } from 'react';
import { useAppStore, type LocationInfo } from './store';
import { X, Save, Trash2, Plus } from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const { locations, addLocation, updateLocation, deleteLocation, userSettings, updateBaseTempSettings } = useAppStore();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<LocationInfo>>({});

  const currentBaseTempSettings = userSettings?.baseTempSettings ?? [10, 3.5];
  const [baseTempForm, setBaseTempForm] = useState<[number, number]>(currentBaseTempSettings);

  if (!isOpen) return null;

  const handleEdit = (loc: LocationInfo) => {
    setEditingId(loc.id);
    setFormData(loc);
  };

  const handleAddNew = () => {
    setEditingId('new');
    setFormData({ name: '新規地点', lat: 35.0, lon: 135.0 });
  };

  const handleSave = () => {
    if (editingId === 'new') {
      addLocation(formData as Omit<LocationInfo, 'id'>);
    } else if (editingId) {
      updateLocation(editingId, formData);
    }
    setEditingId(null);
  };

  const handleDelete = (id: string) => {
    if (window.confirm('本当に削除しますか？')) {
      deleteLocation(id);
      if (editingId === id) setEditingId(null);
    }
  };

  const handleSaveBaseTempSettings = () => {
    updateBaseTempSettings(baseTempForm);
  };

  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="glass-panel modal-content" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 700 }}>アプリ設定</h2>
          <button className="secondary" onClick={onClose} style={{ padding: '0.4rem' }}>
            <X size={20} />
          </button>
        </div>

        {/* 地点リスト */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0, fontSize: '1.1rem' }}>登録地点</h3>
            <button
              onClick={handleAddNew}
              style={{
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
              }}
            >
              <Plus size={16} /> 新規追加
            </button>
          </div>

          {locations.map(loc => (
            <div key={loc.id} className="glass-card" style={{ padding: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: '1.1rem' }}>
                  {loc.name}
                </div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.3rem' }}>
                  緯度: {loc.lat} / 経度: {loc.lon}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button className="secondary" onClick={() => handleEdit(loc)}>編集</button>
                <button className="secondary" onClick={() => handleDelete(loc.id)} style={{ color: 'var(--chart-temp)' }}><Trash2 size={16} /></button>
              </div>
            </div>
          ))}
        </div>

        {editingId && (
          <div className="glass-panel" style={{ padding: '1.5rem', marginTop: '1rem', border: '1px solid var(--accent-light)' }}>
            <h3 style={{ margin: '0 0 1rem 0' }}>{editingId === 'new' ? '新規地点の追加' : '地点の編集'}</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="form-group">
                <label>地点名</label>
                <input
                  type="text"
                  value={formData.name || ''}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                />
              </div>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <div className="form-group" style={{ flex: 1, minWidth: 0 }}>
                  <label>緯度 (Latitude)</label>
                  <input
                    type="number" step="0.000001"
                    value={formData.lat || ''}
                    onChange={e => setFormData({...formData, lat: parseFloat(e.target.value)})}
                    style={{ width: '100%', boxSizing: 'border-box' }}
                  />
                </div>
                <div className="form-group" style={{ flex: 1, minWidth: 0 }}>
                  <label>経度 (Longitude)</label>
                  <input
                    type="number" step="0.000001"
                    value={formData.lon || ''}
                    onChange={e => setFormData({...formData, lon: parseFloat(e.target.value)})}
                    style={{ width: '100%', boxSizing: 'border-box' }}
                  />
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
                <button className="secondary" onClick={() => setEditingId(null)}>キャンセル</button>
                <button
                  onClick={handleSave}
                  style={{
                    background: 'rgba(244,167,185,0.35)',
                    color: '#7a2840',
                    border: '1px solid rgba(244,167,185,0.6)',
                    borderRadius: 'var(--radius-md, 6px)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.3rem',
                    padding: '0.5rem 1rem',
                  }}
                >
                  <Save size={16} /> 保存
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 有効積算温度の設定 */}
        <div className="glass-panel" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <h3 style={{ margin: 0, fontSize: '1.1rem' }}>有効積算温度の設定</h3>
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            {([0, 1] as const).map((i) => (
              <div className="form-group" key={i} style={{ flex: 1, minWidth: '120px' }}>
                <label>基準温度{i + 1} (℃)</label>
                <input
                  type="number"
                  step="0.1"
                  value={baseTempForm[i]}
                  onChange={(e) => {
                    const next: [number, number] = [...baseTempForm] as [number, number];
                    next[i] = parseFloat(e.target.value);
                    setBaseTempForm(next);
                  }}
                />
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button
              onClick={handleSaveBaseTempSettings}
              style={{
                background: 'rgba(244,167,185,0.35)',
                color: '#7a2840',
                border: '1px solid rgba(244,167,185,0.6)',
                borderRadius: 'var(--radius-md, 6px)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.3rem',
                padding: '0.4rem 0.9rem',
                fontSize: '0.85rem',
              }}
            >
              <Save size={14} /> 保存
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
