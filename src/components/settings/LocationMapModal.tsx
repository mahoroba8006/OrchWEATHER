import { useEffect, useRef, useState, useCallback } from 'react';
import type { CSSProperties } from 'react';
import L from 'leaflet';
import { X, MapPin, Loader2 } from 'lucide-react';
import { resolveJmaAreaCode, getAreaName } from '../../lib/jmaAreaResolver';
import { GEO_OPTIONS } from '../../lib/geo';

// Vite + Leaflet のデフォルトアイコン修正
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
});

export interface LocationMapModalProps {
  initialLat: number;
  initialLon: number;
  onConfirm: (lat: number, lon: number, suggestedName?: string) => void;
  onClose: () => void;
}

export function LocationMapModal({
  initialLat,
  initialLon,
  onConfirm,
  onClose,
}: LocationMapModalProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);

  const [markerPos, setMarkerPos] = useState<[number, number]>([initialLat, initialLon]);
  const [resolving, setResolving] = useState(false);

  const handleConfirm = useCallback(async () => {
    setResolving(true);
    const [lat, lon] = markerPos;
    let suggestedName: string | undefined;
    try {
      const code = await resolveJmaAreaCode(lat, lon);
      if (code) suggestedName = getAreaName(code) ?? undefined;
    } catch {
      // 地名解決失敗は無視（lat/lon の確定は続行）
    }
    setResolving(false);
    onConfirm(lat, lon, suggestedName);
  }, [markerPos, onConfirm]);

  // マップ初期化（マウント時1回のみ）
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [initialLat, initialLon],
      zoom: 13,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution:
        '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 18,
    }).addTo(map);

    const marker = L.marker([initialLat, initialLon], { draggable: true }).addTo(map);
    markerRef.current = marker;
    mapRef.current = map;

    marker.on('dragend', () => {
      const pos = marker.getLatLng();
      setMarkerPos([
        parseFloat(pos.lat.toFixed(6)),
        parseFloat(pos.lng.toFixed(6)),
      ]);
    });

    map.on('click', (e: L.LeafletMouseEvent) => {
      const lat = parseFloat(e.latlng.lat.toFixed(6));
      const lon = parseFloat(e.latlng.lng.toFixed(6));
      marker.setLatLng([lat, lon]);
      setMarkerPos([lat, lon]);
    });

    // GPS で現在地に移動（成功したらビューとマーカーも移動）
    navigator.geolocation?.getCurrentPosition(
      (pos) => {
        const lat = parseFloat(pos.coords.latitude.toFixed(6));
        const lon = parseFloat(pos.coords.longitude.toFixed(6));
        map.setView([lat, lon], 13);
        marker.setLatLng([lat, lon]);
        setMarkerPos([lat, lon]);
      },
      () => {
        // GPS 失敗時は日本全体ビュー
        map.setView([36.5, 138.0], 5);
      },
      GEO_OPTIONS,
    );

    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const overlayStyle: CSSProperties = {
    position: 'fixed',
    inset: 0,
    zIndex: 1100,
    background: 'rgba(0,0,0,0.65)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '1rem',
  };

  const panelStyle: CSSProperties = {
    width: '100%',
    maxWidth: '600px',
    background: 'var(--glass-bg, rgba(240,248,252,0.97))',
    borderRadius: 'var(--radius-lg, 12px)',
    boxShadow: '0 8px 40px rgba(0,0,0,0.35)',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    maxHeight: 'calc(100vh - 2rem)',
  };

  return (
    <div
      style={overlayStyle}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div style={panelStyle}>
        {/* ヘッダー */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '0.8rem 1rem',
            borderBottom: '1px solid rgba(13,148,136,0.2)',
            flexShrink: 0,
          }}
        >
          <span
            style={{
              fontWeight: 600,
              fontSize: '1rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
            }}
          >
            <MapPin size={18} style={{ color: 'var(--accent-color)' }} />
            マップから地点を選択
          </span>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '0.2rem',
              color: 'var(--text-secondary)',
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* 地図エリア */}
        <div
          ref={mapContainerRef}
          style={{ flex: 1, minHeight: '300px', height: '55vh' }}
        />

        {/* フッター（座標 + ボタン） */}
        <div
          style={{
            padding: '0.8rem 1rem',
            borderTop: '1px solid rgba(13,148,136,0.2)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexShrink: 0,
            gap: '0.5rem',
            flexWrap: 'wrap',
          }}
        >
          <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
            緯度: {markerPos[0]} / 経度: {markerPos[1]}
          </span>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className="secondary" onClick={onClose}>
              キャンセル
            </button>
            <button
              onClick={handleConfirm}
              disabled={resolving}
              style={{
                padding: '0.5rem 1rem',
                fontSize: '0.88rem',
                background: resolving
                  ? 'rgba(13,148,136,0.3)'
                  : 'rgba(13,148,136,0.85)',
                color: '#fff',
                border: 'none',
                borderRadius: 'var(--radius-md, 6px)',
                cursor: resolving ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
              }}
            >
              {resolving ? (
                <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
              ) : (
                <MapPin size={16} />
              )}
              {resolving ? '確認中…' : 'この場所を使用'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
