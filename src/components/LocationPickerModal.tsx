import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Wrapper, Status } from '@googlemaps/react-wrapper';

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
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
        zoomControl: true,
        rotateControl: false,
        scaleControl: false,
        gestureHandling: 'greedy',
        scrollwheel: true,
        disableDoubleClickZoom: false,
        zoomControlOptions: {
          position: window.google.maps.ControlPosition.RIGHT_BOTTOM,
          style: window.google.maps.ZoomControlStyle.SMALL
        },
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
          bottom: '140px',
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
          zIndex: 10
        }}
        title="My Location"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 2C13.1046 2 14 2.89543 14 4C14 5.10457 13.1046 6 12 6C10.8954 6 10 5.10457 10 4C10 2.89543 10.8954 2 12 2Z" fill="#666"/>
          <path d="M12 18C13.1046 18 14 18.8954 14 20C14 21.1046 13.1046 22 12 22C10.8954 22 10 21.1046 10 20C10 18.8954 10.8954 18 12 18Z" fill="#666"/>
          <path d="M22 12C22 13.1046 21.1046 14 20 14C18.8954 14 18 13.1046 18 12C18 10.8954 18.8954 10 20 10C21.1046 10 22 10.8954 22 12Z" fill="#666"/>
          <path d="M6 12C6 13.1046 5.10457 14 4 14C2.89543 14 2 13.1046 2 12C2 10.8954 2.89543 10 4 10C5.10457 10 6 10.8954 6 12Z" fill="#666"/>
          <circle cx="12" cy="12" r="2" fill="#666"/>
        </svg>
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
    lat: 27.3364,
    lng: -82.5307
  });
  const [userLocation, setUserLocation] = useState<LocationCoordinates | null>(null);
  const [isGettingLocation, setIsGettingLocation] = useState(false);

  useEffect(() => {
    if (isOpen && !userLocation) {
      setIsGettingLocation(true);
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const userPos = {
              lat: position.coords.latitude,
              lng: position.coords.longitude
            };
            setUserLocation(userPos);
            setCurrentCenter(userPos);
            setIsGettingLocation(false);
          },
          (error) => {
            console.error('Error getting location:', error);
            setIsGettingLocation(false);
          }
        );
      } else {
        setIsGettingLocation(false);
      }
    }
  }, [isOpen, userLocation]);

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
            overflow: 'hidden'
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
            bottom: '32px',
            left: '16px',
            right: '16px',
            zIndex: 20
          }}>
            <div style={{
              backgroundColor: 'white',
              padding: '16px',
              borderRadius: '12px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
              marginBottom: '16px'
            }}>
              <h3 style={{
                margin: '0 0 8px 0',
                fontSize: '18px',
                fontWeight: 'bold',
                color: '#1f2937'
              }}>
                Set location for {restaurantName}
              </h3>
              <p style={{
                margin: 0,
                fontSize: '14px',
                color: '#6b7280'
              }}>
                Move the map to position the pin at the restaurant's exact location
              </p>
            </div>

            <button
              onClick={handleConfirm}
              disabled={isGettingLocation}
              style={{
                width: '100%',
                padding: '16px',
                backgroundColor: isGettingLocation ? '#9ca3af' : '#dc2626',
                color: 'white',
                border: 'none',
                borderRadius: '12px',
                fontSize: '16px',
                fontWeight: 'bold',
                cursor: isGettingLocation ? 'not-allowed' : 'pointer',
                boxShadow: '0 2px 8px rgba(220, 38, 38, 0.2)',
                transition: 'background-color 0.2s'
              }}
            >
              {isGettingLocation ? 'Getting location...' : 'Confirm Location'}
            </button>
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