export type CoordinatesInput = {
  lat?: number;
  lng?: number;
  latitude?: number;
  longitude?: number;
};

export const validateCoordinates = (coords?: CoordinatesInput | null) => {
  const lat = coords?.lat ?? coords?.latitude;
  const lng = coords?.lng ?? coords?.longitude;

  if (typeof lat !== 'number' || typeof lng !== 'number') {
    return { valid: false, reason: 'missing' as const };
  }
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return { valid: false, reason: 'invalid' as const };
  }
  if (lat === 0 && lng === 0) {
    return { valid: false, reason: 'zero' as const };
  }
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return { valid: false, reason: 'range' as const };
  }

  return { valid: true as const };
};
