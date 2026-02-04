const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

export interface ReverseGeocodeResult {
  city: string | null;
  state: string | null;
  stateCode: string | null;
  country: string | null;
  countryCode: string | null;
}

const EMPTY_RESULT: ReverseGeocodeResult = {
  city: null,
  state: null,
  stateCode: null,
  country: null,
  countryCode: null,
};

export async function reverseGeocode(lat: number, lng: number): Promise<ReverseGeocodeResult> {
  if (!GOOGLE_MAPS_API_KEY) {
    console.warn('reverseGeocode: VITE_GOOGLE_MAPS_API_KEY not set');
    return { ...EMPTY_RESULT };
  }

  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${GOOGLE_MAPS_API_KEY}`;
    const response = await fetch(url);

    if (!response.ok) {
      console.error('reverseGeocode: HTTP error', response.status);
      return { ...EMPTY_RESULT };
    }

    const data = await response.json();
    if (data.status !== 'OK' || !data.results?.length) {
      return { ...EMPTY_RESULT };
    }

    const components = data.results[0].address_components as Array<{
      long_name: string;
      short_name: string;
      types: string[];
    }> | undefined;

    if (!components) return { ...EMPTY_RESULT };

    const cityComp = components.find((c) => c.types.includes('locality'));
    const stateComp = components.find((c) => c.types.includes('administrative_area_level_1'));
    const countryComp = components.find((c) => c.types.includes('country'));

    return {
      city: cityComp?.long_name || null,
      state: stateComp?.long_name || null,
      stateCode: stateComp?.short_name || null,
      country: countryComp?.long_name || null,
      countryCode: countryComp?.short_name || null,
    };
  } catch (err) {
    console.error('reverseGeocode: failed', err);
    return { ...EMPTY_RESULT };
  }
}
