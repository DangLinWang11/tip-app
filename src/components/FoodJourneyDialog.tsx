import React, { useEffect, useMemo, useRef, useState } from 'react';
import { X, MapIcon } from 'lucide-react';
import { GoogleMap, Marker, useLoadScript } from '@react-google-maps/api';

type MarkerData = {
  id: string;
  lat: number;
  lng: number;
  title?: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  markers: MarkerData[];
  apiKey?: string;
};

export function FoodJourneyDialog({ open, onClose, markers, apiKey }: Props) {
  const backdropRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  // Lock body scroll while open
  useEffect(() => {
    const originalBodyOverflow = document.body.style.overflow;
    const originalHtmlOverflow = document.documentElement.style.overflow;
    if (open) {
      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';
    }
    return () => {
      document.body.style.overflow = originalBodyOverflow || '';
      document.documentElement.style.overflow = originalHtmlOverflow || '';
    };
  }, [open]);

  // Close on backdrop click only
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === backdropRef.current) onClose();
  };

  // Focus the dialog card on open for basic focus trapping
  useEffect(() => {
    if (open) {
      setTimeout(() => cardRef.current?.focus(), 0);
    }
  }, [open]);

  // Compute a reasonable center
  const center = useMemo(() => {
    if (markers && markers.length > 0) {
      const avg = markers.reduce(
        (acc, m) => ({ lat: acc.lat + m.lat / markers.length, lng: acc.lng + m.lng / markers.length }),
        { lat: 0, lng: 0 }
      );
      return avg;
    }
    return { lat: 27.3364, lng: -82.5307 }; // Sarasota fallback
  }, [markers]);

  // Map options per requirements
  const mapOptions = useMemo<google.maps.MapOptions>(() => ({
    gestureHandling: 'greedy',
    zoomControl: true,
    fullscreenControl: false,
    streetViewControl: false,
    mapTypeControl: false,
  }), []);

  // Load Google Maps script
  const { isLoaded, loadError } = useLoadScript({
    googleMapsApiKey: apiKey || import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
    libraries: ['places'],
  });

  // Prevent wheel/touch events bubbling to the page
  const stopProp = (e: React.UIEvent) => {
    e.stopPropagation();
  };

  if (!open) return null;

  return (
    <div
      ref={backdropRef}
      onClick={handleBackdropClick}
      className="fixed inset-0 z-[9999] bg-black/45 pointer-events-auto overscroll-contain"
      aria-modal="true"
      role="dialog"
    >
      <div
        ref={cardRef}
        tabIndex={-1}
        className="fixed left-4 right-4 top-6 bottom-4 bg-white rounded-2xl shadow-2xl pointer-events-auto flex flex-col overflow-hidden focus:outline-none"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <div className="flex items-center gap-2">
            <MapIcon className="h-5 w-5 text-primary" />
            <h3 className="text-base font-semibold">Your Food Journey</h3>
          </div>
          <button
            aria-label="Close"
            onClick={onClose}
            className="p-2 rounded-full hover:bg-black/5 active:scale-95 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div
          className="relative flex-1 min-h-[360px]"
          onWheelCapture={stopProp}
          onTouchMoveCapture={stopProp}
        >
          {!isLoaded && !loadError && (
            <div className="absolute inset-0 grid place-items-center">
              <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          )}
          {loadError && (
            <div className="absolute inset-0 flex items-center justify-center text-sm text-red-600">
              Failed to load map
            </div>
          )}
          {isLoaded && (
            <GoogleMap
              options={mapOptions}
              center={center}
              zoom={markers && markers.length ? 11 : 12}
              mapContainerStyle={{ width: '100%', height: '100%' }}
            >
              {markers?.map((m) => (
                <Marker key={m.id} position={{ lat: m.lat, lng: m.lng }} title={m.title} />
              ))}
            </GoogleMap>
          )}
        </div>
      </div>
    </div>
  );
}

export default FoodJourneyDialog;
