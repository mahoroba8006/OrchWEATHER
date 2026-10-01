import { useState, lazy, Suspense } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, m } from 'motion/react';
import { MapPin, Plus, Trash2, Loader2 } from 'lucide-react';
import { useAppStore, type LocationInfo } from '../../store';
import { GEO_OPTIONS, getGeoErrorMessage, GEO_SUPPORTED } from '../../lib/geo';
import { ErrorBoundary } from '../ui/ErrorBoundary';
import { Skeleton } from '../ui/Skeleton';
import { Button } from '../ui/Button';
import { SaveButton } from '../ui/SaveButton';
import { springs } from '../../lib/motion';
import './settings.css';
import { resolveJmaAreaCode, getAreaName } from '../../lib/jmaAreaResolver';

// 地図（Leaflet 約40KB gzip）は地図を開いた時だけ読み込む
const makeLazyMapModal = () => lazy(() =>
  import('./LocationMapModal').then(m => ({ default: m.LocationMapModal })),
);
// React.lazy は失敗（reject）を保持し続けるため、失敗時に作り直して再試行できるようにする
let LocationMapModal = makeLazyMapModal();

type GeoStatus = 'idle' | 'loading' | 'error';

const MAP_LOAD_ERROR = '地図を読み込めませんでした。通信状況を確認して、もう一度お試しください。';

/** 地図チャンク読み込み中の即時フィードバック（モーダルと同じ暗幕に骨組みカード） */
function MapModalFallback() {
  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1100, background: 'rgba(0,0,0,0.65)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <Skeleton width={320} height={240} radius="var(--radius-lg)" />
    </div>
  );
}

/** 遅延読み込みの失敗時はモーダルを閉じ、設定画面にエラーを出す */
function LazyMapBoundary({ onFail, children }: { onFail: () => void; children: React.ReactNode }) {
  return (
    <ErrorBoundary onError={() => { LocationMapModal = makeLazyMapModal(); onFail(); }} fallback={() => null}>
      <Suspense fallback={<MapModalFallback />}>{children}</Suspense>
    </ErrorBoundary>
  );
}

export function LocationSettings() {
  const { locations, addLocation, updateLocation, deleteLocation, userSettings, updateDefaultLocationId } =
    useAppStore();
  const defaultLocationId = userSettings?.defaultLocationId ?? null;

  const [mapLoadError, setMapLoadError] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<LocationInfo>>({});
  // 編集開始時点の lat/lon を記憶して、変化した場合のみエリアコードを再解決する
  const [originalLatLon, setOriginalLatLon] = useState<{ lat: number; lon: number } | null>(null);

  const [geoStatus, setGeoStatus] = useState<GeoStatus>('idle');
  const [geoError, setGeoError] = useState<string>('');

  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'error'>('idle');
  const [saveError, setSaveError] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [showMapModal, setShowMapModal] = useState(false);
  const [showHeaderMapModal, setShowHeaderMapModal] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const handleEdit = (loc: LocationInfo) => {
    setEditingId(loc.id);
    setFormData(loc);
    setOriginalLatLon({ lat: loc.lat, lon: loc.lon });
    setGeoError('');
    setGeoStatus('idle');
    setSaveStatus('idle');
    setSaveError('');
    setShowMapModal(false);
    setShowHeaderMapModal(false);
  };

  const handleAddNew = () => {
    setEditingId('new');
    setFormData({ name: '新規地点', lat: 35.0, lon: 135.0 });
    setOriginalLatLon(null);
    setGeoError('');
    setSaveStatus('idle');
    setSaveError('');
    setShowMapModal(false);
    setShowHeaderMapModal(false);
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
        setOriginalLatLon(null); // 新規なので常にエリアコードを解決させる
        setSaveStatus('idle');
        setSaveError('');
        setShowMapModal(false);
        setShowHeaderMapModal(false);
      },
      (err) => {
        setGeoStatus('error');
        setGeoError(getGeoErrorMessage(err));
      },
      GEO_OPTIONS,
    );
  };

  // ヘッダーの「マップから選ぶ」ボタン用：確定後に新規フォームを展開
  const handleHeaderMapConfirm = (lat: number, lon: number, suggestedName?: string) => {
    setEditingId('new');
    setFormData({ name: suggestedName ?? '新規地点', lat, lon });
    setOriginalLatLon(null);
    setGeoError('');
    setSaveStatus('idle');
    setSaveError('');
    setShowHeaderMapModal(false);
  };

  const handleMapConfirm = (lat: number, lon: number, suggestedName?: string) => {
    setFormData((prev) => ({
      ...prev,
      lat,
      lon,
      // 名称が未入力または初期値の場合のみ候補名で上書き
      name:
        prev.name && prev.name !== '新規地点'
          ? prev.name
          : (suggestedName ?? prev.name),
    }));
    setOriginalLatLon(null); // マップ確定後は常に JMA エリアコードを再解決する
    setShowMapModal(false);
  };

  const handleSave = async () => {
    setSaveStatus('saving');
    setSaveError('');
    try {
      let dataToSave: Partial<LocationInfo> = { ...formData };

      // lat/lon が変化した場合（または新規登録時）は JMA エリアコードを解決する
      const latLonChanged =
        editingId === 'new' ||
        !originalLatLon ||
        formData.lat !== originalLatLon.lat ||
        formData.lon !== originalLatLon.lon;

      // lat/lon が変わった場合、または jmaAreaCode がまだ未設定の場合は解決する
      if ((latLonChanged || !formData.jmaAreaCode) && typeof formData.lat === 'number' && typeof formData.lon === 'number') {
        try {
          const jmaAreaCode = await resolveJmaAreaCode(formData.lat, formData.lon);
          dataToSave = { ...dataToSave, jmaAreaCode: jmaAreaCode ?? undefined };
        } catch {
          // エリアコード解決失敗は致命的ではない。警報表示がされないだけ
          console.warn('[LocationSettings] jmaAreaCode resolution failed');
        }
      }

      if (editingId === 'new') {
        await addLocation(dataToSave as Omit<LocationInfo, 'id'>);
      } else if (editingId) {
        await updateLocation(editingId, dataToSave);
      }
      setSaveStatus('idle');
      setShowMapModal(false);
      setEditingId(null);
    } catch (err: unknown) {
      console.error('[LocationSettings] save failed', err);
      setSaveError(err instanceof Error ? err.message : '保存に失敗しました');
      setSaveStatus('error');
    }
  };

  const handleDelete = (id: string) => {
    setConfirmDeleteId(id);
  };

  const handleConfirmDelete = async () => {
    if (!confirmDeleteId || deleting) return;
    setDeleting(true);
    setDeleteError('');
    try {
      await deleteLocation(confirmDeleteId);
      if (editingId === confirmDeleteId) setEditingId(null);
      setConfirmDeleteId(null);
    } catch (err: unknown) {
      console.error('[LocationSettings] delete failed', err);
      setDeleteError(err instanceof Error ? err.message : '削除に失敗しました');
    } finally {
      setDeleting(false);
    }
  };

  const closeDeleteDialog = () => {
    if (deleting) return;
    setConfirmDeleteId(null);
    setDeleteError('');
  };

  // 編集フォームの中身（既存地点の編集・新規追加で共用）
  const renderEditForm = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div className="form-group">
        <label>地点名</label>
        <input
          type="text"
          value={formData.name || ''}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
        />
      </div>
      <div style={{ display: 'flex', gap: '0.75rem' }}>
        <div className="form-group" style={{ flex: 1, minWidth: 0 }}>
          <label>緯度 (Latitude)</label>
          <input
            type="number"
            step="0.000001"
            value={formData.lat ?? ''}
            onChange={(e) => setFormData({ ...formData, lat: parseFloat(e.target.value) })}
            style={{ width: '100%', boxSizing: 'border-box' }}
          />
        </div>
        <div className="form-group" style={{ flex: 1, minWidth: 0 }}>
          <label>経度 (Longitude)</label>
          <input
            type="number"
            step="0.000001"
            value={formData.lon ?? ''}
            onChange={(e) => setFormData({ ...formData, lon: parseFloat(e.target.value) })}
            style={{ width: '100%', boxSizing: 'border-box' }}
          />
        </div>
      </div>
      <Button
        variant="secondary"
        className="set-btn-xs"
        style={{ alignSelf: 'flex-start' }}
        onClick={() => { setMapLoadError(false); setShowMapModal(true); }}
      >
        <MapPin size={13} />
        地図で修正
      </Button>
      <div className="set-actions">
        {saveStatus === 'error' && (
          <span className="set-error">⚠ {saveError}</span>
        )}
        <Button variant="secondary" className="set-btn-sm" onClick={() => setEditingId(null)}>
          キャンセル
        </Button>
        <SaveButton onClick={handleSave} saving={saveStatus === 'saving'} saved={false} />
      </div>
    </div>
  );

  return (
    <div className="set-stack">
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
        <h3 className="set-title">登録地点</h3>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {/* 現在地で登録 */}
          <Button
            variant="secondary"
            className="set-btn-sm"
            onClick={handleGetCurrentLocation}
            disabled={!GEO_SUPPORTED || geoStatus === 'loading'}
          >
            {geoStatus === 'loading' ? (
              <>
                <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
                取得中…
              </>
            ) : (
              <>
                <MapPin size={16} />
                現在地で登録
              </>
            )}
          </Button>

          {/* マップから選ぶ */}
          <Button
            variant="secondary"
            className="set-btn-sm"
            onClick={() => { setEditingId(null); setMapLoadError(false); setShowHeaderMapModal(true); }}
          >
            <MapPin size={16} />
            マップから選ぶ
          </Button>

          {/* 手動で追加 */}
          <Button variant="primary" className="set-btn-sm" onClick={handleAddNew}>
            <Plus size={16} />
            手動で追加
          </Button>
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

      {/* 地点リスト（追加・削除・並び替えで行が滑らかに動く） */}
      <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        <AnimatePresence initial={false}>
          {locations.map((loc) => {
            const isEditing = editingId === loc.id;
            return (
              <m.li
                key={loc.id}
                layout="position"
                transition={springs.move}
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, height: 0, overflow: 'hidden', pointerEvents: 'none' }}
                style={{ paddingBottom: '1rem' }}
              >
                {isEditing ? (
                  // 編集モード：カード自体が編集フォームに変化
                  <div className="set-card set-card--editing">
                    <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--ink-2)' }}>
                      📍 {loc.name} を編集中
                    </p>
                    {renderEditForm()}
                  </div>
                ) : (
                  // 通常表示
                  <div className="loc-row">
                    <div className="loc-row__main">
                      <div className="loc-row__name">{loc.name}</div>
                      <div className="loc-row__meta">
                        緯度: {loc.lat} / 経度: {loc.lon}
                      </div>
                      <div className={loc.jmaAreaCode ? 'loc-row__area' : 'loc-row__area loc-row__area--none'}>
                        {loc.jmaAreaCode
                          ? `🏛 気象庁エリア: ${getAreaName(loc.jmaAreaCode) ?? loc.jmaAreaCode}`
                          : '🏛 気象庁エリア: 未連携（地点を再保存してください）'}
                      </div>
                    </div>
                    <div className="loc-row__actions">
                      {defaultLocationId === loc.id ? (
                        <>
                          <span className="loc-default-badge">★ デフォルト</span>
                          <Button variant="secondary" className="set-btn-xs" onClick={() => updateDefaultLocationId(null)}>
                            解除
                          </Button>
                        </>
                      ) : (
                        <Button variant="secondary" className="set-btn-xs" onClick={() => updateDefaultLocationId(loc.id)}>
                          デフォルトに設定
                        </Button>
                      )}
                      <Button variant="secondary" className="set-btn-xs" onClick={() => handleEdit(loc)}>
                        編集
                      </Button>
                      <Button
                        variant="ghost"
                        className="set-btn-xs set-btn-danger"
                        aria-label="削除"
                        onClick={() => handleDelete(loc.id)}
                      >
                        <Trash2 size={16} />
                      </Button>
                    </div>
                  </div>
                )}
              </m.li>
            );
          })}
        </AnimatePresence>
      </ul>

      {/* 新規追加フォーム（editingId === 'new' のときのみ・既存カードとは無関係） */}
      {editingId === 'new' && (
        <m.div
          className="set-card set-card--editing"
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={springs.enter}
        >
          <h3 className="set-title">新規地点の追加</h3>
          {renderEditForm()}
        </m.div>
      )}

      {showMapModal && editingId && (
        <LazyMapBoundary onFail={() => { setShowMapModal(false); setMapLoadError(true); }}>
        <LocationMapModal
          initialLat={typeof formData.lat === 'number' && !Number.isNaN(formData.lat) ? formData.lat : 35.0}
          initialLon={typeof formData.lon === 'number' && !Number.isNaN(formData.lon) ? formData.lon : 135.0}
          // 既存地点の編集時は現在地へ飛ばさず登録座標を表示。新規追加時のみ現在地起点。
          autoLocate={editingId === 'new'}
          onConfirm={handleMapConfirm}
          onClose={() => setShowMapModal(false)}
        />
        </LazyMapBoundary>
      )}
      {showHeaderMapModal && (
        <LazyMapBoundary onFail={() => { setShowHeaderMapModal(false); setMapLoadError(true); }}>
        <LocationMapModal
          initialLat={35.0}
          initialLon={135.0}
          onConfirm={handleHeaderMapConfirm}
          onClose={() => setShowHeaderMapModal(false)}
        />
        </LazyMapBoundary>
      )}
      {mapLoadError && (
        <div
          role="alert"
          style={{
            padding: '0.85rem 1rem', color: 'var(--ink-1)', fontSize: '0.85rem',
            background: 'var(--surface-card)', border: '1px solid var(--line)',
            borderLeft: '4px solid #c0392b', borderRadius: 'var(--radius-md)',
          }}
        >
          {MAP_LOAD_ERROR}
        </div>
      )}

      {/* 削除確認ダイアログ */}
      {confirmDeleteId && createPortal(
        <div className="modal-overlay" onClick={closeDeleteDialog}>
          <div
            className="modal-content set-confirm"
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="set-confirm__title">登録地点の削除</p>
            <p className="set-confirm__text">本当に削除しますか？</p>
            {deleteError && <p className="set-error" role="alert">⚠ 削除失敗: {deleteError}</p>}
            <div className="set-actions">
              <Button variant="secondary" className="set-btn-sm" onClick={closeDeleteDialog} disabled={deleting}>キャンセル</Button>
              <Button variant="primary" className="set-btn-sm set-btn-danger-solid" onClick={handleConfirmDelete} disabled={deleting}>
                {deleting ? '削除中…' : '削除'}
              </Button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
