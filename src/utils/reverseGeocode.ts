const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

export interface CountryResult {
  code: string;  // ISO 3166-1 alpha-2
  name: string;  // Full country name
}

/**
 * Reverse geocode coordinates to determine the country.
 * Uses Google Geocoding API with result_type=country for efficiency.
 */
export async function getCountryFromCoordinates(
  lat: number,
  lng: number
): Promise<CountryResult | null> {
  if (!GOOGLE_MAPS_API_KEY) {
    console.warn('reverseGeocode: VITE_GOOGLE_MAPS_API_KEY not set');
    return null;
  }

  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&result_type=country&key=${GOOGLE_MAPS_API_KEY}`;
    const response = await fetch(url);

    if (!response.ok) {
      console.error('reverseGeocode: HTTP error', response.status);
      return null;
    }

    const data = await response.json();

    if (data.status !== 'OK' || !data.results?.length) {
      return null;
    }

    const countryResult = data.results[0];
    const countryComponent = countryResult.address_components?.find(
      (c: { types: string[] }) => c.types.includes('country')
    );

    if (!countryComponent) return null;

    return {
      code: countryComponent.short_name,
      name: countryComponent.long_name,
    };
  } catch (err) {
    console.error('reverseGeocode: failed', err);
    return null;
  }
}
