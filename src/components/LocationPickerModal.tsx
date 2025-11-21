import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Wrapper, Status } from '@googlemaps/react-wrapper';
import { Navigation } from 'lucide-react';

interface LocationCoordinates {
  lat: number;
  lng: number;
}

interface LocationPickerModalProps {
  isOpen: boolean;
  restaurantName: string;
  onConfirm: (coordinates: LocationCoordinates) => void;
  onCancel: () => void;
}

interface MapComponentProps {
  center: LocationCoordinates;
  zoom: number;
  onCenterChanged: (coordinates: LocationCoordinates) => void;
  userLocation?: LocationCoordinates | null;
  focusLocation?: LocationCoordinates | null;
  onUserLocationDetected: (coordinates: LocationCoordinates) => void;
}

const DEFAULT_CENTER: LocationCoordinates = {
  lat: 40.706,
  lng: -74.009
};

const cloneDefaultCenter = () => ({ ...DEFAULT_CENTER });

const MapComponent: React.FC<MapComponentProps> = ({ 
  center, 
  zoom, 
  onCenterChanged, 
  userLocation,
  focusLocation,
  onUserLocationDetected
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<google.maps.Map>();
  const [userLocationMarker, setUserLocationMarker] = useState<google.maps.Marker | null>(null);

  useEffect(() => {
    if (ref.current && !map) {
      const newMap = new window.google.maps.Map(ref.current, {
        center,
        zoom,
        disableDefaultUI: true,
        zoomControl: false,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
        panControl: false,
        rotateControl: false,
        scaleControl: false,
        gestureHandling: 'greedy',
        scrollwheel: true,
        disableDoubleClickZoom: false,
        styles: [
          {
            featureType: 'poi',
            elementType: 'labels',
            stylers: [{ visibility: 'off' }]
          }
        ]
      });

      newMap.addListener('center_changed', () => {
        const newCenter = newMap.getCenter();
        if (newCenter) {
          onCenterChanged({
            lat: newCenter.lat(),
            lng: newCenter.lng()
          });
        }
      });

      setMap(newMap);
    }
  }, [ref, map, center, zoom, onCenterChanged]);

  useEffect(() => {
    if (map && userLocation) {
      if (userLocationMarker) {
        userLocationMarker.setMap(null);
      }

      const marker = new window.google.maps.Marker({
        position: userLocation,
        map,
        icon: {
          path: window.google.maps.SymbolPath.CIRCLE,
          scale: 8,
          fillColor: '#4285F4',
          fillOpacity: 1,
          strokeColor: '#ffffff',
          strokeWeight: 2,
        },
        title: 'Your location',
        zIndex: 1000
      });

      setUserLocationMarker(marker);
    }
  }, [map, userLocation]);

  useEffect(() => {
    if (map && focusLocation) {
      map.panTo(focusLocation);
      map.setZoom(16);
    }
  }, [map, focusLocation]);

  const pendingFocusRef = useRef<LocationCoordinates | null>(null);

  useEffect(() => {
    if (map && pendingFocusRef.current) {
      map.panTo(pendingFocusRef.current);
      map.setZoom(16);
      pendingFocusRef.current = null;
    }
  }, [map]);

  const handleMyLocationClick = useCallback(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      alert('Geolocation is not supported by your browser');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const userPos = {
          lat: position.coords.latitude,
          lng: position.coords.longitude
        };

        onCenterChanged(userPos);
        onUserLocationDetected(userPos);

        if (map) {
          map.panTo(userPos);
          map.setZoom(17);
        } else {
          pendingFocusRef.current = userPos;
        }
      },
      (error) => {
        if (error.code === error.PERMISSION_DENIED) {
          alert('Please enable location permissions in your browser settings');
        } else {
          alert('Unable to retrieve your location');
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 5000,
        maximumAge: 0
      }
    );
  }, [map, onCenterChanged, onUserLocationDetected]);

  return (
    <div className="relative w-full h-full">
      <div ref={ref} className="w-full h-full" />
      
      <button
        onClick={handleMyLocationClick}
        className="fixed bottom-36 right-4 z-20 w-12 h-12 rounded-full bg-white shadow-lg flex items-center justify-center text-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-300"
        title="My Location"
      >
        <Navigation className="w-6 h-6" />
      </button>
    </div>
  );
};

const LoadingComponent = () => (
  <div style={{
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    backgroundColor: '#f3f4f6'
  }}>
    <div style={{ textAlign: 'center' }}>
      <div style={{
        width: '32px',
        height: '32px',
        border: '2px solid #e5e7eb',
        borderTop: '2px solid #dc2626',
        borderRadius: '50%',
        animation: 'spin 1s linear infinite',
        margin: '0 auto 8px auto'
      }}></div>
      <p style={{ color: '#6b7280', margin: 0 }}>Loading map...</p>
    </div>
  </div>
);

const ErrorComponent = ({ status }: { status: Status }) => (
  <div style={{
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    backgroundColor: '#fef2f2'
  }}>
    <div style={{ textAlign: 'center' }}>
      <p style={{ color: '#dc2626', fontWeight: 'bold', margin: '0 0 4px 0' }}>Error loading map</p>
      <p style={{ color: '#ef4444', fontSize: '14px', margin: 0 }}>{status}</p>
    </div>
  </div>
);

const LocationPickerModal: React.FC<LocationPickerModalProps> = ({
  isOpen,
  restaurantName,
  onConfirm,
  onCancel
}) => {
  const [currentCenter, setCurrentCenter] = useState<LocationCoordinates>(cloneDefaultCenter);
  const [userLocation, setUserLocation] = useState<LocationCoordinates | null>(null);
  const [focusLocation, setFocusLocation] = useState<LocationCoordinates | null>(cloneDefaultCenter);
  const [locationError, setLocationError] = useState<string | null>(null);

  const handleUserLocationDetected = useCallback((coords: LocationCoordinates) => {
    setUserLocation(coords);
    setFocusLocation(coords);
    setLocationError(null);
  }, []);

  const requestUserLocation = useCallback(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setLocationError('Location services are not supported in this browser.');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        handleUserLocationDetected({
          lat: position.coords.latitude,
          lng: position.coords.longitude
        });
      },
      (error) => {
        console.error('Error getting location:', error);
        if (error.code === error.PERMISSION_DENIED) {
          setLocationError('Location permission denied. Enable it in your browser settings to use this shortcut.');
        } else {
          setLocationError('Unable to fetch your location. Please try again.');
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0
      }
    );
  }, [handleUserLocationDetected]);

  useEffect(() => {
    if (isOpen) {
      setCurrentCenter(cloneDefaultCenter());
      setFocusLocation(cloneDefaultCenter());
      setUserLocation(null);
      setLocationError(null);

      const tryPrefetch = async () => {
        if (typeof navigator === 'undefined' || !navigator.permissions?.query) {
          return;
        }
        try {
          const permission = await navigator.permissions.query({
            name: 'geolocation' as PermissionName
          });
          if (permission.state === 'granted') {
            requestUserLocation();
          }
        } catch (error) {
          console.warn('Unable to prefetch geolocation permission state', error);
        }
      };

      tryPrefetch();
    } else {
      setFocusLocation(null);
      setUserLocation(null);
    }
  }, [isOpen, requestUserLocation]);

  const handleCenterChanged = useCallback((coordinates: LocationCoordinates) => {
    setCurrentCenter(coordinates);
  }, []);

  const handleConfirm = () => {
    onConfirm(currentCenter);
  };

  const handleCancel = () => {
    onCancel();
  };

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      handleCancel();
    }
  };

  const render = (status: Status) => {
    switch (status) {
      case Status.LOADING:
        return <LoadingComponent />;
      case Status.FAILURE:
        return <ErrorComponent status={status} />;
      case Status.SUCCESS:
        return (
          <MapComponent
            center={currentCenter}
            zoom={15}
            onCenterChanged={handleCenterChanged}
            userLocation={userLocation}
            focusLocation={focusLocation}
            onUserLocationDetected={handleUserLocationDetected}
          />
        );
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <style>
        {`
          @keyframes spin {
            from {
              transform: rotate(0deg);
            }
            to {
              transform: rotate(360deg);
            }
          }
        `}
      </style>
      <div
        className="fixed inset-0 bg-black/50 z-[1000] flex items-center justify-center"
        onClick={handleOverlayClick}
      >
        <div
          className="relative w-screen h-screen bg-white overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={handleCancel}
            className="absolute top-4 left-4 z-40 w-12 h-12 rounded-full bg-white shadow-lg flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-gray-300"
            title="Cancel"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M18 6L6 18" stroke="#666" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M6 6L18 18" stroke="#666" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>

          <div className="absolute inset-0 pointer-events-none flex items-center justify-center z-10">
            <svg width="40" height="50" viewBox="0 0 40 50" xmlns="http://www.w3.org/2000/svg">
              <path
                d="M20 2C11.16 2 4 9.16 4 18c0 13.5 16 28 16 28s16-14.5 16-28c0-8.84-7.16-16-16-16z"
                fill="#dc2626"
                stroke="#ffffff"
                strokeWidth="2"
              />
              <circle cx="20" cy="18" r="6" fill="white" />
            </svg>
          </div>

          <div className="fixed bottom-40 left-4 right-4 z-30 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
            <div className="bg-white rounded-2xl shadow-xl p-4 flex items-center gap-3">
              <div className="flex-1">
                <h3 className="text-base font-semibold text-gray-900 mb-1">
                  Set location for {restaurantName}
                </h3>
                <p className="text-sm text-gray-600">
                  Move the map to position the pin at the restaurant&apos;s exact location
                </p>
              </div>
              <button
                onClick={handleConfirm}
                className="px-5 py-3 rounded-xl bg-primary text-white font-semibold shadow-md hover:bg-red-600 transition-colors"
              >
                Pin Location
              </button>
            </div>
            {locationError ? (
              <p className="mt-2 text-xs text-red-600">
                {locationError}
              </p>
            ) : null}
          </div>

          <div className="relative z-0 w-full h-full">
            <Wrapper
              apiKey="AIzaSyDH-MgeMBC3_yvge3yLz_gaCl_2x8Ra6PY"
              render={render}
              libraries={['places']}
            />
          </div>
        </div>
      </div>
    </>
  );
};

export default LocationPickerModal;
