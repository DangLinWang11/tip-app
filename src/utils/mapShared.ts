export const getMapVisibility = (zoom: number) => ({
  showCityOverlays: zoom <= 11,
  showPins: zoom >= 12,
  showPinLabels: zoom >= 12,
});

export const GLASS_CARD_STYLES =
  'rounded-2xl bg-white/90 backdrop-blur-xl shadow-[0_12px_28px_rgba(0,0,0,0.18)] border border-white/70';

export const OVERLAY_PILL_STYLES = {
  background: 'rgba(0, 0, 0, 0.78)',
  fontFamily: "'Montserrat', 'Apple Color Emoji'",
  fontWeight: '700',
  fontSize: '13px',
  backdropFilter: 'blur(4px)',
  borderRadius: '8px',
  padding: '8px 12px',
  color: '#ffffff',
  boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
};

export interface Restaurant {
  location: {
    lat: number;
    lng: number;
  };
  city?: string | null;
  state?: string | null;
  stateCode?: string | null;
}

export interface CityRestaurantGroup {
  city: string;
  state: string | null;
  stateCode: string | null;
  count: number;
  lat: number;
  lng: number;
  restaurants: Restaurant[];
}

const normalizePlaceValue = (value?: string | null): string | null => {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

export const groupRestaurantsByCity = (
  restaurants: Restaurant[],
  minCountThreshold: number = 5
): CityRestaurantGroup[] => {
  const groups = new Map<
    string,
    {
      city: string;
      state: string | null;
      stateCode: string | null;
      count: number;
      latSum: number;
      lngSum: number;
      restaurants: Restaurant[];
    }
  >();

  restaurants.forEach((restaurant) => {
    const city = normalizePlaceValue(restaurant.city);
    if (!city) return;

    const lat = restaurant.location?.lat;
    const lng = restaurant.location?.lng;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

    const state = normalizePlaceValue(restaurant.state);
    const stateCode = normalizePlaceValue(restaurant.stateCode);
    const key = `${city.toLowerCase()}|${(stateCode || state || '').toLowerCase()}`;

    const existing = groups.get(key);
    if (!existing) {
      groups.set(key, {
        city,
        state,
        stateCode,
        count: 1,
        latSum: lat,
        lngSum: lng,
        restaurants: [restaurant],
      });
      return;
    }

    existing.count += 1;
    existing.latSum += lat;
    existing.lngSum += lng;
    existing.restaurants.push(restaurant);
    if (!existing.state && state) existing.state = state;
    if (!existing.stateCode && stateCode) existing.stateCode = stateCode;
  });

  const results: CityRestaurantGroup[] = [];
  groups.forEach((group) => {
    if (group.count < minCountThreshold) return;
    results.push({
      city: group.city,
      state: group.state,
      stateCode: group.stateCode,
      count: group.count,
      lat: group.latSum / group.count,
      lng: group.lngSum / group.count,
      restaurants: group.restaurants,
    });
  });

  return results;
};
