import { useEffect, useMemo, useState } from 'react';

export type MapTheme = 'pastel' | 'mono';

const MAP_THEME_STORAGE_KEY = 'tip.mapTheme';
const DEFAULT_THEME: MapTheme = 'pastel';

const PASTEL_STYLE: google.maps.MapTypeStyle[] = [
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#6fb7e6' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#4f7fa3' }] },
  { featureType: 'water', elementType: 'labels.text.stroke', stylers: [{ color: '#cfe4f2' }] },
  { featureType: 'landscape', elementType: 'geometry', stylers: [{ color: '#cfe3b2' }] },
  { featureType: 'landscape.natural', elementType: 'geometry', stylers: [{ color: '#c3dba2' }] },
  { featureType: 'landscape.man_made', elementType: 'geometry', stylers: [{ color: '#d7e8bf' }] },
  { featureType: 'administrative', elementType: 'geometry', stylers: [{ color: '#c0cbb2' }, { weight: 0.8 }] },
  { featureType: 'administrative.country', elementType: 'geometry.stroke', stylers: [{ color: '#9fb089' }, { weight: 1.2 }] },
  { featureType: 'administrative.province', elementType: 'geometry.stroke', stylers: [{ color: '#b2c39e' }, { weight: 0.8 }] },
  { featureType: 'administrative.country', elementType: 'labels.text.fill', stylers: [{ color: '#5e6a55' }] },
  { featureType: 'administrative.country', elementType: 'labels.text.stroke', stylers: [{ color: '#dfe9d2' }] },
  { featureType: 'administrative.locality', elementType: 'labels', stylers: [{ visibility: 'off' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#f4f6f1' }, { weight: 0.6 }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#8f9b90' }] },
  { featureType: 'road', elementType: 'labels.text.stroke', stylers: [{ color: '#e6eddc' }] },
  { featureType: 'road', elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi', elementType: 'all', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', elementType: 'all', stylers: [{ visibility: 'off' }] },
];

const MONO_STYLE: google.maps.MapTypeStyle[] = [
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#cfd6dd' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#7b8896' }] },
  { featureType: 'water', elementType: 'labels.text.stroke', stylers: [{ color: '#e3e7eb' }] },
  { featureType: 'landscape', elementType: 'geometry', stylers: [{ color: '#e6e8e3' }] },
  { featureType: 'landscape.natural', elementType: 'geometry', stylers: [{ color: '#dde0db' }] },
  { featureType: 'landscape.man_made', elementType: 'geometry', stylers: [{ color: '#eceeea' }] },
  { featureType: 'administrative', elementType: 'geometry', stylers: [{ color: '#c7cccf' }, { weight: 0.8 }] },
  { featureType: 'administrative.country', elementType: 'geometry.stroke', stylers: [{ color: '#aeb4b9' }, { weight: 1.2 }] },
  { featureType: 'administrative.province', elementType: 'geometry.stroke', stylers: [{ color: '#bbc1c6' }, { weight: 0.8 }] },
  { featureType: 'administrative.country', elementType: 'labels.text.fill', stylers: [{ color: '#636a70' }] },
  { featureType: 'administrative.country', elementType: 'labels.text.stroke', stylers: [{ color: '#eef1f3' }] },
  { featureType: 'administrative.locality', elementType: 'labels', stylers: [{ visibility: 'off' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#f5f6f4' }, { weight: 0.6 }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#868c91' }] },
  { featureType: 'road', elementType: 'labels.text.stroke', stylers: [{ color: '#ecefed' }] },
  { featureType: 'road', elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi', elementType: 'all', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', elementType: 'all', stylers: [{ visibility: 'off' }] },
];

export const MAP_STYLE_PRESETS: Record<MapTheme, google.maps.MapTypeStyle[]> = {
  pastel: PASTEL_STYLE,
  mono: MONO_STYLE,
};

const coerceTheme = (value: string | null): MapTheme => {
  if (value === 'mono') return 'mono';
  return 'pastel';
};

export const getStoredMapTheme = (): MapTheme => {
  if (typeof window === 'undefined') return DEFAULT_THEME;
  return coerceTheme(window.localStorage.getItem(MAP_THEME_STORAGE_KEY));
};

export const setStoredMapTheme = (theme: MapTheme) => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(MAP_THEME_STORAGE_KEY, theme);
  window.dispatchEvent(new CustomEvent('tip:map-theme'));
};

const resolveMapId = (theme: MapTheme): string | undefined => {
  const themed =
    theme === 'mono'
      ? import.meta.env.VITE_GOOGLE_MAPS_MAP_ID_MONO
      : import.meta.env.VITE_GOOGLE_MAPS_MAP_ID_PASTEL;
  const fallback = import.meta.env.VITE_GOOGLE_MAPS_MAP_ID;
  const value = themed || fallback;
  return value && value.length > 0 ? value : undefined;
};

export const getBaseMapOptions = (theme: MapTheme): google.maps.MapOptions => {
  const mapId = resolveMapId(theme);
  const styles = mapId ? undefined : MAP_STYLE_PRESETS[theme];

  return {
    mapId,
    styles,
    clickableIcons: false,
  };
};

export const useMapTheme = (): [MapTheme, (theme: MapTheme) => void] => {
  const [theme, setTheme] = useState<MapTheme>(() => getStoredMapTheme());

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key === MAP_THEME_STORAGE_KEY) {
        setTheme(coerceTheme(event.newValue));
      }
    };
    const handleCustom = () => setTheme(getStoredMapTheme());

    window.addEventListener('storage', handleStorage);
    window.addEventListener('tip:map-theme', handleCustom as EventListener);
    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('tip:map-theme', handleCustom as EventListener);
    };
  }, []);

  const setThemeAndPersist = (next: MapTheme) => {
    setTheme(next);
    setStoredMapTheme(next);
  };

  return useMemo(() => [theme, setThemeAndPersist], [theme]);
};
