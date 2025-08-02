import React, { useEffect, useRef, useState } from 'react';
import { Wrapper, Status } from '@googlemaps/react-wrapper';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase';

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

const createPinIcon = (text: string, backgroundColor: string): string => {
  const svg = `
    <svg width="40" height="50" viewBox="0 0 40 50" xmlns="http://www.w3.org/2000/svg">
      <path d="M20 2C11.16 2 4 9.16 4 18c0 13.5 16 28 16 28s16-14.5 16-28c0-8.84-7.16-16-16-16z" 
            fill="${backgroundColor}"/>
      <text x="20" y="22" font-family="Arial, sans-serif" font-size="12" font-weight="bold" 
            text-anchor="middle" fill="white">${text}</text>
    </svg>
  `;
  return 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg);
};

const createDishPinIcon = (rating: string, backgroundColor: string): string => {
  const svg = `
    <svg width="40" height="50" viewBox="0 0 40 50" xmlns="http://www.w3.org/2000/svg">
      <path d="M20 2C11.16 2 4 9.16 4 18c0 13.5 16 28 16 28s16-14.5 16-28c0-8.84-7.16-16-16-16z" 
            fill="${backgroundColor}"/>
      <text x="20" y="22" font-family="Arial, sans-serif" font-size="12" font-weight="bold" 
            text-anchor="middle" fill="white">${rating}</text>
    </svg>
  `;
  return 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg);
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
              url: createPinIcon(`${restaurant.qualityPercentage}%`, qualityColor),
              scaledSize: new window.google.maps.Size(40, 50),
              anchor: new window.google.maps.Point(20, 50)
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
            if (onItemClick) {
              onItemClick(restaurant);
            }
          });

          // Percentage text is now embedded in the pin icon
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
              url: createDishPinIcon(dish.rating.toFixed(1), ratingColor),
              scaledSize: new window.google.maps.Size(40, 50),
              anchor: new window.google.maps.Point(20, 50)
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

          // Rating text is now embedded in the pin icon
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

// Fetch top dish from each restaurant from Firebase menuItems collection
const getTopDishes = async (restaurants: Restaurant[]): Promise<Dish[]> => {
  const dishes: Dish[] = [];
  
  try {
    // Get all menu items from Firebase
    const menuItemsRef = collection(db, 'menuItems');
    const menuItemsSnapshot = await getDocs(menuItemsRef);
    const allMenuItems = menuItemsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    // Group menu items by restaurant and get highest rated dish per restaurant
    restaurants.forEach(restaurant => {
      const restaurantMenuItems = allMenuItems.filter(
        (item: any) => item.restaurantId === restaurant.id.toString() || 
                      item.restaurantName === restaurant.name
      );
      
      if (restaurantMenuItems.length > 0) {
        // Get the highest rated dish for this restaurant
        const topDish = restaurantMenuItems.reduce((prev: any, current: any) => 
          (current.rating || 0) > (prev.rating || 0) ? current : prev
        );
        
        dishes.push({
          id: topDish.id,
          name: topDish.name || topDish.dish || 'Special Dish',
          rating: topDish.rating || 8.5,
          restaurantName: restaurant.name,
          location: restaurant.location,
          price: topDish.price || undefined
        });
      }
    });
  } catch (error) {
    console.error('Error fetching menu items:', error);
    // Fallback to mock data if Firebase fails
    restaurants.forEach(restaurant => {
      dishes.push({
        id: `${restaurant.id}-fallback`,
        name: 'Signature Dish',
        rating: 8.5,
        restaurantName: restaurant.name,
        location: restaurant.location,
        price: '$25'
      });
    });
  }
  
  return dishes;
};

const RestaurantMap: React.FC<RestaurantMapProps> = ({ 
  className = '',
  mapType,
  restaurants = [],
  userLocation,
  onItemClick 
}) => {
  const [topDishes, setTopDishes] = useState<Dish[]>([]);
  const sarasotaCenter = {
    lat: 27.3364,
    lng: -82.5307
  };

  useEffect(() => {
    if (mapType === 'dish' && restaurants.length > 0) {
      getTopDishes(restaurants).then(setTopDishes);
    }
  }, [mapType, restaurants]);

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