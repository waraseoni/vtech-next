/**
 * Attendance GPS geofencing helpers.
 *
 * Geofence config lives in system_info (key-value rows):
 *   geofence_enabled, geofence_lat, geofence_lng, geofence_radius_m
 *
 * When enabled, staff self check-in/out is verified against the office
 * coordinates + radius. Coordinates are saved on the attendance record
 * for audit.
 */
import { supabase } from '@/lib/supabase';

export interface GeofenceConfig {
  enabled: boolean;
  lat: number | null;
  lng: number | null;
  radiusM: number;
}

export interface GeoResult {
  ok: boolean;
  reason: 'ok' | 'disabled' | 'no-config' | 'outside' | 'denied' | 'unavailable' | 'timeout' | 'unsupported';
  distanceM: number | null;
  coords: { lat: number; lng: number } | null;
}

/** Great-circle distance between two lat/lng points, in meters (haversine). */
export const distanceMeters = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
};

/** Promise wrapper around navigator.geolocation.getCurrentPosition. */
export const getCurrentPosition = (
  timeoutMs = 10000
): Promise<GeolocationPosition> =>
  new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      reject(new Error('UNSUPPORTED'));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: timeoutMs,
      maximumAge: 0,
    });
  });

/** Load geofence config from system_info. */
export const loadGeofenceConfig = async (): Promise<GeofenceConfig> => {
  const { data } = await supabase.from('system_info').select('meta_field, meta_value');
  const info: Record<string, string> = {};
  (data || []).forEach((r) => { info[r.meta_field] = r.meta_value; });
  const lat = parseFloat(info.geofence_lat || '');
  const lng = parseFloat(info.geofence_lng || '');
  return {
    enabled: info.geofence_enabled === 'true',
    lat: isFinite(lat) ? lat : null,
    lng: isFinite(lng) ? lng : null,
    radiusM: Math.max(50, parseInt(info.geofence_radius_m || '200', 10) || 200),
  };
};

/**
 * Verify the current device location against the office geofence.
 * Returns ok:true with reason 'disabled' when geofencing is off.
 */
export const verifyAttendanceLocation = async (): Promise<GeoResult> => {
  const cfg = await loadGeofenceConfig();
  if (!cfg.enabled) return { ok: true, reason: 'disabled', distanceM: null, coords: null };
  if (cfg.lat == null || cfg.lng == null) {
    return { ok: false, reason: 'no-config', distanceM: null, coords: null };
  }

  let pos: GeolocationPosition;
  try {
    pos = await getCurrentPosition();
  } catch (err) {
    const msg = err instanceof Error ? err.message : '';
    if (msg === 'UNSUPPORTED') return { ok: false, reason: 'unsupported', distanceM: null, coords: null };
    const code = (err as GeolocationPositionError)?.code;
    return {
      ok: false,
      reason: code === 1 ? 'denied' : code === 2 ? 'unavailable' : 'timeout',
      distanceM: null,
      coords: null,
    };
  }

  const d = distanceMeters(cfg.lat, cfg.lng, pos.coords.latitude, pos.coords.longitude);
  return {
    ok: d <= cfg.radiusM,
    reason: d <= cfg.radiusM ? 'ok' : 'outside',
    distanceM: Math.round(d),
    coords: { lat: pos.coords.latitude, lng: pos.coords.longitude },
  };
};

/** Human-readable Hindi error for a failed GeoResult. */
export const geoErrorMessage = (r: GeoResult): string => {
  switch (r.reason) {
    case 'outside':
      return `Aap office ke bahar hain (${r.distanceM}m door). Attendance sirf office ke andar se hi hogi.`;
    case 'denied':
      return 'Location permission deny hai. Check-in/out ke liye browser location permission allow karein.';
    case 'unavailable':
      return 'Location available nahi hai. GPS/Internet on karke dobara try karein.';
    case 'timeout':
      return 'Location fetch me deri hui. Dobara try karein.';
    case 'unsupported':
      return 'Is browser me location support nahi hai. Chrome/Phone browser use karein.';
    case 'no-config':
      return 'Office geofence configured nahi hai. Admin se Settings me office location set karwayein.';
    default:
      return 'Location verify nahi ho payi. Dobara try karein.';
  }
};
