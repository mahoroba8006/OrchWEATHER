import { useState } from 'react';
import { useAppStore, type LocationInfo } from './store';
import { X, Save, Trash2, Plus } from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const { locations, addLocation, updateLocation, deleteLocation } = useAppStore();
  
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<LocationInfo>>({});

  if (!isOpen) return null;

  const handleEdit = (loc: LocationInfo) => {
    setEditingId(loc.id);
    setFormData(loc);
  };

  const handleAddNew = () => {
    setEditingId('new');
    setFormData({ name: '新規地点', lat: 35.0, lon: 135.0, baseTemp: 10 });
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

  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="glass-panel modal-content" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0, fontSize: '1.5rem' }}>地点の管理と設定</h2>
          <button className="secondary" onClick={onClose} style={{ padding: '0.4rem' }}>
            <X size={20} />
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0, fontSize: '1.1rem' }}>登録済み地点リスト</h3>
            <button onClick={handleAddNew} style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}>
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
                  緯度: {loc.lat} / 経度: {loc.lon} / 基準温度: {loc.baseTemp}℃
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
              <div style={{ display: 'flex', gap: '1rem' }}>
                <div className="form-group" style={{ flex: 1 }}>
                  <label>緯度 (Latitude)</label>
                  <input 
                    type="number" step="0.000001" 
                    value={formData.lat || ''} 
                    onChange={e => setFormData({...formData, lat: parseFloat(e.target.value)})}
                  />
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label>経度 (Longitude)</label>
                  <input 
                    type="number" step="0.000001" 
                    value={formData.lon || ''} 
                    onChange={e => setFormData({...formData, lon: parseFloat(e.target.value)})}
                  />
                </div>
              </div>
              <div className="form-group">
                <label>有効積算温度 基準温度 (℃) ※作物の発育限界温度</label>
                <input 
                  type="number" step="0.1" 
                  value={formData.baseTemp || ''} 
                  onChange={e => setFormData({...formData, baseTemp: parseFloat(e.target.value)})}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
                <button className="secondary" onClick={() => setEditingId(null)}>キャンセル</button>
                <button onClick={handleSave}><Save size={16} /> 保存</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
