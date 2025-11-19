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
}

const MapComponent: React.FC<MapComponentProps> = ({ 
  center, 
  zoom, 
  onCenterChanged, 
  userLocation 
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

  const handleMyLocationClick = useCallback(() => {
    if (!map) return;

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const userPos = {
            lat: position.coords.latitude,
            lng: position.coords.longitude
          };
          map.panTo(userPos);
          map.setZoom(16);
        },
        (error) => {
          console.error('Error getting location:', error);
        }
      );
    }
  }, [map]);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <div ref={ref} style={{ width: '100%', height: '100%' }} />
      
      <button
        onClick={handleMyLocationClick}
        style={{
          position: 'absolute',
          bottom: 'calc(68px + env(safe-area-inset-bottom) + 80px)',
          right: '16px',
          width: '48px',
          height: '48px',
          backgroundColor: 'white',
          border: 'none',
          borderRadius: '24px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 60
        }}
        title="My Location"
      >
        <Navigation size={28} color="#4285F4" />
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
  const [currentCenter, setCurrentCenter] = useState<LocationCoordinates>({
    lat: 0,
    lng: 0
  });
  const [userLocation, setUserLocation] = useState<LocationCoordinates | null>(null);

  useEffect(() => {
    if (isOpen) {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const userPos = {
              lat: position.coords.latitude,
              lng: position.coords.longitude
            };
            setUserLocation(userPos);
            setCurrentCenter(userPos);
          },
          (error) => {
            console.error('Error getting location:', error);
            setCurrentCenter({
              lat: 27.3364,
              lng: -82.5307
            });
          }
        );
      } else {
        setCurrentCenter({
          lat: 27.3364,
          lng: -82.5307
        });
      }
    }
  }, [isOpen]);

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
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
        onClick={handleOverlayClick}
      >
        <div
          style={{
            position: 'relative',
            width: '100vw',
            height: '100vh',
            backgroundColor: 'white',
            overflow: 'visible'
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={handleCancel}
            style={{
              position: 'absolute',
              top: '16px',
              left: '16px',
              width: '48px',
              height: '48px',
              backgroundColor: 'white',
              border: 'none',
              borderRadius: '24px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 20
            }}
            title="Cancel"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M18 6L6 18" stroke="#666" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M6 6L18 18" stroke="#666" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>

          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            zIndex: 15,
            pointerEvents: 'none'
          }}>
            <svg width="40" height="50" viewBox="0 0 40 50" xmlns="http://www.w3.org/2000/svg">
              <path 
                d="M20 2C11.16 2 4 9.16 4 18c0 13.5 16 28 16 28s16-14.5 16-28c0-8.84-7.16-16-16-16z" 
                fill="#dc2626"
                stroke="#ffffff"
                strokeWidth="2"
              />
              <circle cx="20" cy="18" r="6" fill="white"/>
            </svg>
          </div>

          <div style={{
            position: 'absolute',
            bottom: 'calc(68px + env(safe-area-inset-bottom) + 16px)',
            left: '16px',
            right: '16px',
            zIndex: 60
          }}>
            <div style={{
              backgroundColor: 'white',
              padding: '16px',
              borderRadius: '16px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
              display: 'flex',
              alignItems: 'center',
              gap: '12px'
            }}>
              <div style={{ flex: 1 }}>
                <h3 style={{
                  margin: '0 0 4px 0',
                  fontSize: '16px',
                  fontWeight: '600',
                  color: '#1f2937'
                }}>
                  Set location for {restaurantName}
                </h3>
                <p style={{
                  margin: 0,
                  fontSize: '13px',
                  color: '#6b7280',
                  lineHeight: '1.4'
                }}>
                  Move the map to position the pin at the restaurant's exact location
                </p>
              </div>
              <button
                onClick={handleConfirm}
                style={{
                  padding: '12px 20px',
                  backgroundColor: '#ef4444',
                  color: 'white',
                  border: 'none',
                  borderRadius: '12px',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  boxShadow: '0 4px 6px rgba(239, 68, 68, 0.3)',
                  transition: 'background-color 0.2s',
                  whiteSpace: 'nowrap',
                  flexShrink: 0
                }}
                onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#dc2626'}
                onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#ef4444'}
              >
                Pin Location
              </button>
            </div>
          </div>

          <div style={{ width: '100%', height: '100%' }}>
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