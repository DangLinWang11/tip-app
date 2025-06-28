import React, { useEffect, useRef, useState } from 'react';
import { Wrapper, Status } from '@googlemaps/react-wrapper';
import { restaurants } from '../utils/mockData';

interface Restaurant {
  id: number;
  name: string;
  qualityPercentage: number;
  location: {
    lat: number;
    lng: number;
  };
  cuisine: string;
  rating: number;
  priceRange: string;
}

interface MapProps {
  center: google.maps.LatLngLiteral;
  zoom: number;
  restaurants: Restaurant[];
  onRestaurantClick?: (restaurant: Restaurant) => void;
}

const getQualityColor = (percentage: number): string => {
  if (percentage >= 90) return '#10B981'; // Green for high ratings (90%+)
  if (percentage >= 80) return '#34D399'; // Light green (80-89%)
  if (percentage >= 70) return '#FCD34D'; // Yellow (70-79%)
  if (percentage >= 60) return '#FBBF24'; // Orange-yellow (60-69%)
  if (percentage >= 50) return '#FB923C'; // Orange (50-59%)
  return '#EF4444'; // Red for low ratings (<50%)
};

const Map: React.FC<MapProps> = ({ center, zoom, restaurants, onRestaurantClick }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<google.maps.Map>();

  useEffect(() => {
    if (ref.current && !map) {
      const newMap = new window.google.maps.Map(ref.current, {
        center,
        zoom,
        styles: [
          {
            featureType: 'poi',
            elementType: 'labels',
            stylers: [{ visibility: 'off' }]
          }
        ]
      });
      setMap(newMap);
    }
  }, [ref, map, center, zoom]);

  useEffect(() => {
    if (map) {
      restaurants.forEach((restaurant) => {
        const qualityColor = getQualityColor(restaurant.qualityPercentage);
        
        const marker = new window.google.maps.Marker({
          position: restaurant.location,
          map,
          icon: {
            path: window.google.maps.SymbolPath.CIRCLE,
            scale: 20,
            fillColor: qualityColor,
            fillOpacity: 0.9,
            strokeColor: '#FFFFFF',
            strokeWeight: 3,
          },
          title: restaurant.name,
          zIndex: restaurant.qualityPercentage
        });

        const infoWindow = new window.google.maps.InfoWindow({
          content: `
            <div style="padding: 8px; min-width: 200px;">
              <h3 style="margin: 0 0 8px 0; font-size: 16px; font-weight: 600;">${restaurant.name}</h3>
              <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
                <span style="background: ${qualityColor}; color: white; padding: 2px 8px; border-radius: 12px; font-size: 12px; font-weight: bold;">
                  ${restaurant.qualityPercentage}%
                </span>
                <span style="color: #666; font-size: 14px;">${restaurant.cuisine}</span>
              </div>
              <div style="display: flex; align-items: center; gap: 8px; color: #666; font-size: 14px;">
                <span>⭐ ${restaurant.rating}</span>
                <span>${restaurant.priceRange}</span>
              </div>
            </div>
          `
        });

        marker.addListener('click', () => {
          infoWindow.open(map, marker);
          if (onRestaurantClick) {
            onRestaurantClick(restaurant);
          }
        });

        const overlayDiv = document.createElement('div');
        overlayDiv.style.position = 'absolute';
        overlayDiv.style.background = 'white';
        overlayDiv.style.padding = '2px 6px';
        overlayDiv.style.borderRadius = '8px';
        overlayDiv.style.fontSize = '11px';
        overlayDiv.style.fontWeight = 'bold';
        overlayDiv.style.color = qualityColor;
        overlayDiv.style.border = `2px solid ${qualityColor}`;
        overlayDiv.style.pointerEvents = 'none';
        overlayDiv.style.transform = 'translate(-50%, -50%)';
        overlayDiv.textContent = `${restaurant.qualityPercentage}%`;

        const overlay = new window.google.maps.OverlayView();
        overlay.onAdd = function() {
          const panes = this.getPanes();
          if (panes) {
            panes.overlayMouseTarget.appendChild(overlayDiv);
          }
        };

        overlay.draw = function() {
          const projection = this.getProjection();
          if (projection) {
            const position = projection.fromLatLngToDivPixel(restaurant.location);
            if (position) {
              overlayDiv.style.left = position.x + 'px';
              overlayDiv.style.top = (position.y - 35) + 'px';
            }
          }
        };

        overlay.onRemove = function() {
          if (overlayDiv.parentNode) {
            overlayDiv.parentNode.removeChild(overlayDiv);
          }
        };

        overlay.setMap(map);
      });
    }
  }, [map, restaurants, onRestaurantClick]);

  return <div ref={ref} style={{ width: '100%', height: '100%' }} />;
};

const LoadingComponent = () => (
  <div className="flex items-center justify-center h-full bg-gray-100">
    <div className="text-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
      <p className="text-gray-600">Loading map...</p>
    </div>
  </div>
);

const ErrorComponent = ({ status }: { status: Status }) => (
  <div className="flex items-center justify-center h-full bg-red-50">
    <div className="text-center">
      <p className="text-red-600 font-medium">Error loading map</p>
      <p className="text-red-500 text-sm">{status}</p>
    </div>
  </div>
);

interface RestaurantMapProps {
  className?: string;
  onRestaurantClick?: (restaurant: Restaurant) => void;
}

const RestaurantMap: React.FC<RestaurantMapProps> = ({ 
  className = '',
  onRestaurantClick 
}) => {
  const sarasotaCenter = {
    lat: 27.3364,
    lng: -82.5307
  };

  const render = (status: Status) => {
    switch (status) {
      case Status.LOADING:
        return <LoadingComponent />;
      case Status.FAILURE:
        return <ErrorComponent status={status} />;
      case Status.SUCCESS:
        return (
          <Map
            center={sarasotaCenter}
            zoom={13}
            restaurants={restaurants}
            onRestaurantClick={onRestaurantClick}
          />
        );
    }
  };

  return (
    <div className={`w-full h-full ${className}`}>
      <Wrapper
        apiKey="AIzaSyDH-MgeMBC3_yvge3yLz_gaCl_2x8Ra6PY"
        render={render}
        libraries={['places']}
      />
    </div>
  );
};

export default RestaurantMap;