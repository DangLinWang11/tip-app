import React, { useEffect, useRef, useState } from 'react';
import { Wrapper, Status } from '@googlemaps/react-wrapper';

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
  location: {
    lat: number;
    lng: number;
  };
  price?: string;
}

interface MapProps {
  center: google.maps.LatLngLiteral;
  zoom: number;
  mapType: 'restaurant' | 'dish';
  restaurants: Restaurant[];
  dishes: Dish[];
  userLocation?: {lat: number, lng: number} | null;
  onItemClick?: (item: Restaurant | Dish) => void;
}

const getQualityColor = (percentage: number): string => {
  if (percentage >= 90) return '#10B981'; // Green for high ratings (90%+)
  if (percentage >= 80) return '#34D399'; // Light green (80-89%)
  if (percentage >= 70) return '#FCD34D'; // Yellow (70-79%)
  if (percentage >= 60) return '#FBBF24'; // Orange-yellow (60-69%)
  if (percentage >= 50) return '#FB923C'; // Orange (50-59%)
  return '#EF4444'; // Red for low ratings (<50%)
};

const getRatingColor = (rating: number): string => {
  // Convert 0-10 rating to percentage for color consistency
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


  // Update user location marker and center map
  useEffect(() => {
    if (map && userLocation) {
      // Remove existing user location marker
      if (userLocationMarker) {
        userLocationMarker.setMap(null);
      }

      // Center map on user location
      map.panTo(userLocation);
      map.setZoom(15); // Zoom in to show local area

      // Create new user location marker with blue dot and direction arrow
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
        zIndex: 1000 // Ensure it appears above other markers
      });

      setUserLocationMarker(marker);
    }
  }, [map, userLocation]);

  useEffect(() => {
    if (map) {
      // Clear existing markers
      const existingMarkers = (map as any).markers || [];
      existingMarkers.forEach((marker: google.maps.Marker) => marker.setMap(null));

      const markers: google.maps.Marker[] = [];

      if (mapType === 'restaurant') {
        // Show restaurant pins
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
                    <span style="color: #666; font-size: 14px;">${restaurant.cuisine}</span>
                  </div>
                  <div style="display: flex; align-items: center; gap: 8px; color: #666; font-size: 14px;">
                    <span style="display: flex; align-items: center; gap: 4px;">
                      <span style='color: #FFD700; font-size: 16px; text-shadow: 1px 1px 2px rgba(0,0,0,0.3);'>★</span>
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
            if (onItemClick) {
              onItemClick(restaurant);
            }
          });

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
          markers.push(marker);
        });
      } else {
        // Show dish pins
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

          const infoWindow = new window.google.maps.InfoWindow({
            content: `
              <div style="padding: 8px; min-width: 200px;">
                <h3 style="margin: 0 0 8px 0; font-size: 16px; font-weight: 600;">${dish.name}</h3>
                <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
                  <span style="background: ${ratingColor}; color: white; padding: 2px 8px; border-radius: 12px; font-size: 12px; font-weight: bold;">
                    ${dish.rating.toFixed(1)}
                  </span>
                  <span style="color: #666; font-size: 14px;">${dish.restaurantName}</span>
                </div>
                ${dish.price ? `<div style="color: #666; font-size: 14px;">${dish.price}</div>` : ''}
              </div>
            `
          });

          marker.addListener('click', () => {
            infoWindow.open(map, marker);
            if (onItemClick) {
              onItemClick(dish);
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

      // Store markers on map for cleanup
      (map as any).markers = markers;
    }
  }, [map, mapType, restaurants, dishes, onItemClick]);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <div ref={ref} style={{ width: '100%', height: '100%' }} />
      


      {/* Error Message */}
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
  onItemClick?: (item: Restaurant | Dish) => void;
}

// Extract top dishes from restaurants data
const getTopDishes = (restaurants: Restaurant[]): Dish[] => {
  const dishes: Dish[] = [];
  
  restaurants.forEach(restaurant => {
    // Get top 2 dishes from each restaurant
    const restaurantPosts = (restaurant as any).posts || [];
    const topDishes = restaurantPosts
      .sort((a: any, b: any) => b.rating - a.rating)
      .slice(0, 2);
    
    topDishes.forEach((post: any, index: number) => {
      dishes.push({
        id: `${restaurant.id}-${post.id || index}`,
        name: post.dish || post.title || 'Special Dish',
        rating: post.rating || 8.5,
        restaurantName: restaurant.name,
        location: {
          lat: restaurant.location.lat + (Math.random() - 0.5) * 0.001, // Slight offset
          lng: restaurant.location.lng + (Math.random() - 0.5) * 0.001
        },
        price: post.price || undefined
      });
    });
  });
  
  return dishes;
};

const RestaurantMap: React.FC<RestaurantMapProps> = ({ 
  className = '',
  mapType,
  restaurants = [],
  userLocation,
  onItemClick 
}) => {
  const sarasotaCenter = {
    lat: 27.3364,
    lng: -82.5307
  };

  const topDishes = getTopDishes(restaurants);

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
            dishes={topDishes}
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