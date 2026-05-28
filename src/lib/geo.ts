export const GEO_OPTIONS: PositionOptions = {
  enableHighAccuracy: false,
  timeout: 10000,
  maximumAge: 60000,
};

export function getGeoErrorMessage(err: GeolocationPositionError): string {
  switch (err.code) {
    case err.PERMISSION_DENIED:
      return '位置情報の許可が必要です。ブラウザの設定からオンにしてください。';
    case err.TIMEOUT:
      return '位置情報の取得がタイムアウトしました。再試行してください。';
    default:
      return '位置情報の取得に失敗しました。再試行してください。';
  }
}

export const GEO_SUPPORTED =
  typeof navigator !== 'undefined' && 'geolocation' in navigator;
