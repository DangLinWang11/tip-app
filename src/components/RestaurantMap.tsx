import React, { useEffect, useRef, useState } from 'react';
import { Wrapper, Status } from '@googlemaps/react-wrapper';

const getCuisineIcon = (cuisine: string): string => {
  const cuisineMap: { [key: string]: string } = {
    'mediterranean': '🫒',
    'middle eastern': '🫒',
    'american': '🍽️',
    'bistro': '🍽️',
    'seafood': '🦐',
    'italian': '🍝',
    'asian': '🥢',
    'mexican': '🌮',
    'pizza': '🍕',
    'steakhouse': '🥩',
    'bbq': '🥩',
    'sushi': '🍣',
    'coffee': '☕',
    'breakfast': '🥐',
    'brunch': '🥐',
    'fast food': '🍔',
    'casual': '🍽️'
  };
  return cuisineMap[cuisine.toLowerCase()] || '🍽️';
};

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

interface Dish {
  id: string;
  name: string;
  rating: number;
  restaurantName: string;
  restaurantId: string;
  category: string;
  price?: string;
  location: {
    lat: number;
    lng: number;
  };
  coverImage: string;
}

interface MapProps {
  center: google.maps.LatLngLiteral;
  zoom: number;
  mapType: 'restaurant' | 'dish';
  restaurants: Restaurant[];
  dishes: Dish[];
  userLocation?: {lat: number, lng: number} | null;
  onItemClick?: (item: Restaurant | any) => void;
}

const getQualityColor = (percentage: number): string => {
  if (percentage >= 90) return '#10B981';
  if (percentage >= 80) return '#34D399';
  if (percentage >= 70) return '#FCD34D';
  if (percentage >= 60) return '#FBBF24';
  if (percentage >= 50) return '#FB923C';
  return '#EF4444';
};

const getRatingColor = (rating: number): string => {
  const percentage = (rating / 10) * 100;
  return getQualityColor(percentage);
};

const Map: React.FC<MapProps> = ({ center, zoom, mapType, restaurants, dishes, userLocation, onItemClick }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<google.maps.Map>();
  const [locationError, setLocationError] = useState<string>('');
  const [userLocationMarker, setUserLocationMarker] = useState<google.maps.Marker | null>(null);

  useEffect(() => {
    if (ref.current && !map) {
      const newMap = new window.google.maps.Map(ref.current, {
        center,
        zoom,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
        zoomControl: false,
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
      setMap(newMap);
    }
  }, [ref, map, center, zoom]);

  useEffect(() => {
    if (map && userLocation) {
      if (userLocationMarker) {
        userLocationMarker.setMap(null);
      }

      map.panTo(userLocation);
      map.setZoom(15);

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
    if (map) {
      const existingMarkers = (map as any).markers || [];
      existingMarkers.forEach((marker: google.maps.Marker) => marker.setMap(null));

      const markers: google.maps.Marker[] = [];

      if (mapType === 'restaurant') {
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
              <div style="padding: 0; min-width: 200px; border-radius: 8px; overflow: hidden;">
                ${restaurant.headerImage ? `<img src="${restaurant.headerImage}" style="width: 100%; height: 80px; object-fit: cover;" onerror="this.style.display='none'">` : ''}
                <div style="padding: 8px;">
                  <h3 style="margin: 0 0 8px 0; font-size: 16px; font-weight: 600;">${restaurant.name}</h3>
                  <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
                    <span style="background: ${qualityColor}; color: white; padding: 2px 8px; border-radius: 12px; font-size: 12px; font-weight: bold;">
                      ${restaurant.qualityPercentage}%
                    </span>
                    <span style="color: #666; font-size: 14px;">${restaurant.cuisine} ${getCuisineIcon(restaurant.cuisine)}</span>
                  </div>
                  <div style="display: flex; align-items: center; gap: 8px; color: #666; font-size: 14px;">
                    <span style="display: flex; align-items: center; gap: 4px;">
                      <span style='color: #FFD700; font-size: 16px;'>✦</span>
                      ${(restaurant.averageMenuRating || restaurant.rating).toFixed(1)}
                    </span>
                    <span>${restaurant.priceRange}</span>
                  </div>
                </div>
              </div>
            `
          });

          marker.addListener('click', () => {
            infoWindow.open(map, marker);
          });

          if (mapType === 'restaurant') {
            // Add percentage overlay
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
          }
          markers.push(marker);
        });
      } else {
        dishes.forEach((dish) => {
          const ratingColor = getRatingColor(dish.rating);
          
          const marker = new window.google.maps.Marker({
            position: dish.location,
            map,
            icon: {
              path: window.google.maps.SymbolPath.CIRCLE,
              scale: 18,
              fillColor: ratingColor,
              fillOpacity: 0.9,
              strokeColor: '#FFFFFF',
              strokeWeight: 3,
            },
            title: dish.name,
            zIndex: dish.rating * 10
          });

          marker.addListener('click', () => {
            if (onItemClick) {
              const dishForModal = {
                id: dish.id,
                name: dish.name,
                rating: dish.rating,
                hasReviews: dish.rating > 0,
                price: dish.price,
                category: dish.category || 'Dish',
                restaurantId: dish.restaurantId,
                restaurantName: dish.restaurantName,
                image: dish.coverImage || `https://source.unsplash.com/400x300/?${encodeURIComponent(dish.name)},food`
              };
              onItemClick(dishForModal);
            }
          });

          // Add rating overlay
          const overlayDiv = document.createElement('div');
          overlayDiv.style.position = 'absolute';
          overlayDiv.style.background = 'white';
          overlayDiv.style.padding = '2px 6px';
          overlayDiv.style.borderRadius = '8px';
          overlayDiv.style.fontSize = '11px';
          overlayDiv.style.fontWeight = 'bold';
          overlayDiv.style.color = ratingColor;
          overlayDiv.style.border = `2px solid ${ratingColor}`;
          overlayDiv.style.pointerEvents = 'none';
          overlayDiv.style.transform = 'translate(-50%, -50%)';
          overlayDiv.textContent = dish.rating.toFixed(1);

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
              const position = projection.fromLatLngToDivPixel(dish.location);
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

          markers.push(marker);
        });
      }

      (map as any).markers = markers;
    }
  }, [map, mapType, restaurants, dishes, onItemClick]);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <div ref={ref} style={{ width: '100%', height: '100%' }} />
      {locationError && (
        <div style={{ 
          position: 'absolute', 
          top: '16px', 
          left: '16px', 
          right: '16px', 
          zIndex: 10 
        }}>
          <div style={{
            backgroundColor: '#fef2f2',
            border: '1px solid #fca5a5',
            color: '#dc2626',
            padding: '12px 16px',
            borderRadius: '8px',
            fontSize: '14px'
          }}>
            {locationError}
          </div>
        </div>
      )}
    </div>
  );
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
  mapType: 'restaurant' | 'dish';
  restaurants?: Restaurant[];
  userLocation?: {lat: number, lng: number} | null;
  onItemClick?: (item: Restaurant | any) => void;
  dishes?: Dish[];
}

const RestaurantMap: React.FC<RestaurantMapProps> = ({ 
  className = '',
  mapType,
  restaurants = [],
  userLocation,
  onItemClick,
  dishes = []
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
            mapType={mapType}
            restaurants={restaurants}
            dishes={dishes}
            userLocation={userLocation}
            onItemClick={onItemClick}
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