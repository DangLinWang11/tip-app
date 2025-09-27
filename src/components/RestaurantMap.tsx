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
  onRestaurantClick?: (id: string) => void;
  onDishClick?: (id: string) => void;
  showQualityPercentages?: boolean;
  disableInfoWindows?: boolean;
}

const getQualityColor = (percentage: number): string => {
  if (percentage >= 95) return '#059669'; // Bright Green (95-100%)
  if (percentage >= 90) return '#10B981'; // Green (90-94%)
  if (percentage >= 85) return '#34D399'; // Light Green (85-89%)
  if (percentage >= 80) return '#6EE7B7'; // Yellow-Green (80-84%)
  if (percentage >= 75) return '#FDE047'; // Yellow (75-79%)
  if (percentage >= 70) return '#FACC15'; // Orange-Yellow (70-74%)
  if (percentage >= 65) return '#F59E0B'; // Orange (65-69%)
  if (percentage >= 60) return '#F97316'; // Red-Orange (60-64%)
  if (percentage >= 55) return '#FB7185'; // Light Red (55-59%)
  return '#EF4444'; // Red (0-54%)
};

const getRatingColor = (rating: number): string => {
  // Convert 0-10 rating to percentage for color consistency
  const percentage = (rating / 10) * 100;
  return getQualityColor(percentage);
};

const createPinIcon = (text: string, backgroundColor: string, showQualityPercentages: boolean = true): string => {
  const svg = showQualityPercentages 
    ? `
      <svg width="40" height="50" viewBox="0 0 40 50" xmlns="http://www.w3.org/2000/svg">
        <path d="M20 2C11.16 2 4 9.16 4 18c0 13.5 16 28 16 28s16-14.5 16-28c0-8.84-7.16-16-16-16z" 
              fill="${backgroundColor}"/>
        ${text ? `<text x="20" y="22" font-family="Arial, sans-serif" font-size="10" font-weight="bold" 
              text-anchor="middle" fill="white">${text}</text>` : ''}
      </svg>
    `
    : `
      <svg width="40" height="50" viewBox="0 0 40 50" xmlns="http://www.w3.org/2000/svg">
        <path d="M20 2C11.16 2 4 9.16 4 18c0 13.5 16 28 16 28s16-14.5 16-28c0-8.84-7.16-16-16-16z" 
              fill="${backgroundColor}"/>
        <circle cx="20" cy="18" r="8" fill="white"/>
        ${text ? `<text x="20" y="22" font-family="Arial, sans-serif" font-size="10" font-weight="bold" 
              text-anchor="middle" fill="${backgroundColor}">${text}</text>` : ''}
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

const Map: React.FC<MapProps> = ({ center, zoom, mapType, restaurants, dishes, userLocation, onRestaurantClick, onDishClick, showQualityPercentages = true, disableInfoWindows = false }) => {
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

      // Make onRestaurantClick and onDishClick available globally for info window clicks
      (window as any).onRestaurantClick = onRestaurantClick;
      (window as any).onDishClick = onDishClick;

      if (mapType === 'restaurant') {
        // Show restaurant pins
        restaurants.forEach((restaurant) => {
          const qualityColor = getQualityColor(restaurant.qualityPercentage);
          
          const marker = new window.google.maps.Marker({
            position: restaurant.location,
            map,
            icon: {
              url: showQualityPercentages === false 
                ? createPinIcon('', '#ff3131', false)
                : createPinIcon(`${restaurant.qualityPercentage}%`, qualityColor, true),
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
                  <h3 style="margin: 0 0 8px 0; font-size: 16px; font-weight: 600; cursor: pointer; color: #0066cc;" onclick="window.onRestaurantClick('${restaurant.id}')">${restaurant.name}</h3>
                  <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
                    ${showQualityPercentages !== false ? `<span style="background: ${qualityColor}; color: white; padding: 2px 8px; border-radius: 12px; font-size: 12px; font-weight: bold;">
                      ${restaurant.qualityPercentage}%
                    </span>` : ''}
                    <span style="color: #666; font-size: 14px;">${restaurant.cuisine} ${getCuisineIcon(restaurant.cuisine)}</span>
                  </div>
                  <div style="display: flex; align-items: center; gap: 8px; color: #666; font-size: 14px;">
                    <span style="display: flex; align-items: center; gap: 4px;">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="#FFD700" style="margin-right: 4px;">
                        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                      </svg>
                      ${(restaurant.averageMenuRating || restaurant.rating).toFixed(1)}
                    </span>
                    <span>${restaurant.priceRange}</span>
                  </div>
                </div>
              </div>
            `
          });

          marker.addListener('click', () => {
            if (!disableInfoWindows) {
              infoWindow.open(map, marker);
            }
            if (onRestaurantClick) {
              onRestaurantClick(restaurant.id.toString());
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
                <h3 style="margin: 0 0 8px 0; font-size: 16px; font-weight: 600; cursor: pointer; color: #0066cc;" onclick="window.onDishClick('${dish.id}')">${dish.name}</h3>
                <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
                  <span style="background: ${ratingColor}; color: white; padding: 2px 8px; border-radius: 12px; font-size: 12px; font-weight: bold;">
                    ${dish.rating.toFixed(1)}
                  </span>
                  <span style="color: #0066cc; font-size: 14px; cursor: pointer;" onclick="window.onRestaurantClick('${dish.restaurantId}')">${dish.restaurantName}</span>
                </div>
                ${dish.price ? `<div style="color: #666; font-size: 14px;">${dish.price}</div>` : ''}
              </div>
            `
          });

          marker.addListener('click', () => {
            if (!disableInfoWindows) {
              infoWindow.open(map, marker);
            }
            if (onDishClick) {
              onDishClick(dish.id);
            }
          });

          // Rating text is now embedded in the pin icon
          markers.push(marker);
        });
      }

      // Store markers on map for cleanup
      (map as any).markers = markers;

      // Auto-fit bounds to show all pins when we have restaurants/dishes
      if (mapType === 'restaurant' && restaurants.length > 0) {
        const bounds = new window.google.maps.LatLngBounds();
        restaurants.forEach((restaurant) => {
          bounds.extend(restaurant.location);
        });
        map.fitBounds(bounds);
      } else if (mapType === 'dish' && dishes.length > 0) {
        const bounds = new window.google.maps.LatLngBounds();
        dishes.forEach((dish) => {
          bounds.extend(dish.location);
        });
        map.fitBounds(bounds);
      }
    }
  }, [map, mapType, restaurants, dishes, onRestaurantClick]);

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
  onRestaurantClick?: (id: string) => void;
  onDishClick?: (id: string) => void;
  showQualityPercentages?: boolean;
  disableInfoWindows?: boolean;
}

// Fetch top dish from each restaurant from Firebase menuItems collection
const getTopDishes = async (restaurants: Restaurant[]): Promise<Dish[]> => {
  const dishes: Dish[] = [];
  
  console.log(`🔍 getTopDishes: Starting to fetch dishes for ${restaurants.length} restaurants`);
  
  try {
    console.log('📡 getTopDishes: Fetching menuItems from Firebase...');
    // Get all menu items from Firebase
    const menuItemsRef = collection(db, 'menuItems');
    const menuItemsSnapshot = await getDocs(menuItemsRef);
    const allMenuItems = menuItemsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    console.log(`📊 getTopDishes: Found ${allMenuItems.length} total menu items in Firebase`);
    console.log('📋 getTopDishes: Sample menu items:', allMenuItems.slice(0, 3));
    
    // Group menu items by restaurant and get highest rated dish per restaurant
    
    restaurants.forEach(restaurant => {
      console.log(`🏪 getTopDishes: Processing restaurant "${restaurant.name}" (ID: ${restaurant.id})`);
      
      const restaurantMenuItems = allMenuItems.filter(
        (item: any) => {
          const matchesId = item.restaurantId === restaurant.id.toString();
          const matchesName = item.restaurantName === restaurant.name;
          return matchesId || matchesName;
        }
      );
      
      console.log(`🍽️ getTopDishes: Found ${restaurantMenuItems.length} menu items for "${restaurant.name}"`);
      
      if (restaurantMenuItems.length > 0) {
        // Get the highest rated dish for this restaurant
        const topDish = restaurantMenuItems.reduce((prev: any, current: any) => 
          (current.rating || 0) > (prev.rating || 0) ? current : prev
        );
        
        console.log(`⭐ getTopDishes: Top dish for "${restaurant.name}": "${topDish.name || topDish.dish}" (rating: ${topDish.rating})`);
        
        dishes.push({
          id: topDish.id,
          name: topDish.name || topDish.dish || 'Special Dish',
          rating: topDish.rating || 8.5,
          restaurantName: restaurant.name,
          restaurantId: restaurant.id.toString(),
          location: restaurant.location,
          price: topDish.price || undefined
        });
      }
    });
    
    console.log(`✅ getTopDishes: Successfully processed ${dishes.length} dishes`);
    
  } catch (error) {
    console.error('❌ getTopDishes: Error fetching menu items from Firebase:', error);
    console.log('🔄 getTopDishes: Creating fallback dishes for all restaurants due to Firebase error');
    
    // Fallback to mock data if Firebase fails completely
    restaurants.forEach((restaurant, index) => {
      // Create varied fallback dishes with random ratings between 8.0-9.5
      const fallbackRating = 8.0 + Math.random() * 1.5;
      const dishNames = [
        'Signature Dish', 'Chef\'s Special', 'House Favorite', 
        'Recommended Dish', 'Popular Choice', 'Featured Item'
      ];
      const dishName = dishNames[index % dishNames.length];
      
      const fallbackDish = {
        id: `error-fallback-${restaurant.id}`,
        name: dishName,
        rating: Number(fallbackRating.toFixed(1)),
        restaurantName: restaurant.name,
        restaurantId: restaurant.id.toString(),
        location: restaurant.location,
        price: '$25'
      };
      
      dishes.push(fallbackDish);
      console.log(`🆘 getTopDishes: Created error fallback dish for "${restaurant.name}":`, fallbackDish);
    });
    
    console.log(`🔄 getTopDishes: Created ${dishes.length} fallback dishes due to Firebase error`);
  }
  
  console.log(`🎯 getTopDishes: Returning ${dishes.length} total dishes for dish map`);
  return dishes;
};

const RestaurantMap: React.FC<RestaurantMapProps> = ({ 
  className = '',
  mapType,
  restaurants = [],
  userLocation,
  onRestaurantClick,
  onDishClick,
  showQualityPercentages = true,
  disableInfoWindows = false
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
            onRestaurantClick={onRestaurantClick}
            onDishClick={onDishClick}
            showQualityPercentages={showQualityPercentages}
            disableInfoWindows={disableInfoWindows}
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