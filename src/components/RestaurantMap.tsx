import React, { useEffect, useRef, useState } from 'react';
import { Wrapper, Status } from '@googlemaps/react-wrapper';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Navigation } from 'lucide-react';

const NYC_FALLBACK = { lat: 40.7060, lng: -74.0086 };

interface UserLocationCoordinates extends google.maps.LatLngLiteral {
  accuracy?: number;
}

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
  if (!cuisine) return '🍽️';
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
  visitCount?: number;
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
  userLocation?: UserLocationCoordinates | null;
  onRestaurantClick?: (id: string) => void;
  onDishClick?: (id: string) => void;
  showQualityPercentages?: boolean;
  disableInfoWindows?: boolean;
  showMyLocationButton?: boolean;
  showGoogleControl?: boolean;
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
  const airyColor = '#ff3131';
  const width = text.length > 3 ? 75 : 52;
  const canvasHeight = 44;
  const horizontalPadding = 2;
  const pillX = horizontalPadding;
  const pillWidth = width - horizontalPadding * 2;
  const pillHeight = 28;
  const pillRadius = 14;
  const pillStrokeColor = showQualityPercentages ? backgroundColor : airyColor;
  const textColor = pillStrokeColor;
  const triangleFill = pillStrokeColor;

  const svg = `
    <svg width="${width}" height="${canvasHeight}" viewBox="0 0 ${width} ${canvasHeight}" xmlns="http://www.w3.org/2000/svg">
      <!-- Faux shadow pill -->
      <rect x="${pillX}" y="4" width="${pillWidth}" height="${pillHeight}" rx="${pillRadius}" fill="black" opacity="0.12" />
      <!-- Main pill -->
      <rect x="${pillX}" y="2" width="${pillWidth}" height="${pillHeight}" rx="${pillRadius}" fill="white" stroke="${pillStrokeColor}" stroke-width="2" />
      ${
        text
          ? `<text x="${width / 2}" y="21" font-family="Arial, sans-serif" font-size="12" font-weight="bold" text-anchor="middle" fill="${textColor}">${text}</text>`
          : ''
      }
      <!-- Pointer shadow -->
      <path d="M ${width / 2 - 4} 32 L ${width / 2} 40 L ${width / 2 + 4} 32 Z" fill="black" opacity="0.12" />
      <!-- Pointer -->
      <path d="M ${width / 2 - 4} 30 L ${width / 2} 38 L ${width / 2 + 4} 30 Z" fill="${triangleFill}" />
    </svg>
  `;

  return 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg);
};

const createDishPinIcon = (rating: string, backgroundColor: string): string => {
  const airyColor = '#ff3131';
  const goldColor = '#FFD700';
  const canvasWidth = 60;
  const canvasHeight = 44;
  const horizontalPadding = 2;
  const pillX = horizontalPadding;
  const pillWidth = canvasWidth - horizontalPadding * 2;

  // Star is drawn using the same path, positioned via transform
  const svg = `
    <svg width="${canvasWidth}" height="${canvasHeight}" viewBox="0 0 ${canvasWidth} ${canvasHeight}" xmlns="http://www.w3.org/2000/svg">
      <!-- Faux shadow pill -->
      <rect x="${pillX}" y="4" width="${pillWidth}" height="32" rx="16" fill="black" opacity="0.12" />
      <!-- Main pill -->
      <rect x="${pillX}" y="2" width="${pillWidth}" height="32" rx="16" fill="white" stroke="${airyColor}" stroke-width="2" />
      <text x="19" y="23" font-family="Arial, sans-serif" font-size="16" font-weight="bold" text-anchor="middle" fill="${airyColor}">${rating}</text>
      <!-- Star icon -->
      <path
        d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
        fill="${goldColor}"
        transform="translate(32 6) scale(0.8333)"
      />
      <!-- Pointer shadow -->
      <path d="M 26 36 L 30 44 L 34 36 Z" fill="black" opacity="0.12" />
      <!-- Pointer -->
      <path d="M 26 34 L 30 42 L 34 34 Z" fill="${airyColor}" />
    </svg>
  `;

  return 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg);
};

const Map: React.FC<MapProps> = ({ center, zoom, mapType, restaurants, dishes, userLocation, onRestaurantClick, onDishClick, showQualityPercentages = true, disableInfoWindows = false, showMyLocationButton = true, showGoogleControl = true }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<google.maps.Map>();
  const [locationError, setLocationError] = useState<string>('');
  const [userLocationMarker, setUserLocationMarker] = useState<google.maps.Marker | null>(null);
  const [userAccuracyCircle, setUserAccuracyCircle] = useState<google.maps.Circle | null>(null);
  // Internal location state when user taps the navigation button
  const [internalUserLocation, setInternalUserLocation] = useState<UserLocationCoordinates | null>(null);


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
            featureType: "water",
            elementType: "geometry",
            stylers: [{ color: "#e3f2fd" }]
          },
          {
            featureType: "landscape",
            elementType: "geometry",
            stylers: [{ color: "#f5f5f5" }]
          },
          {
            featureType: "road",
            elementType: "geometry",
            stylers: [{ color: "#ffffff" }]
          },
          {
            featureType: "road",
            elementType: "labels.text.fill",
            stylers: [{ color: "#9e9e9e" }]
          },
          {
            featureType: "poi",
            elementType: "labels",
            stylers: [{ visibility: "off" }]
          },
          {
            featureType: "transit",
            stylers: [{ visibility: "off" }]
          }
        ]
      });
      setMap(newMap);
    }
  }, [ref, map, center, zoom, showGoogleControl]);


  // Update user location marker and center map
  useEffect(() => {
    const effectiveLocation = internalUserLocation || userLocation;
    if (map && effectiveLocation) {
      if (userLocationMarker) {
        userLocationMarker.setMap(null);
      }
      if (userAccuracyCircle) {
        userAccuracyCircle.setMap(null);
      }

      // Center map on user location
      const target = { lat: effectiveLocation.lat, lng: effectiveLocation.lng };
      map.panTo(target);
      if ((map.getZoom() ?? 0) < 15) {
        map.setZoom(15);
      }

      // Create new user location marker with blue dot
      const marker = new window.google.maps.Marker({
        position: target,
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

      const radius = Math.min(Math.max(effectiveLocation.accuracy ?? 120, 30), 2000);
      const circle = new window.google.maps.Circle({
        strokeColor: '#4285F4',
        strokeOpacity: 0.6,
        strokeWeight: 1,
        fillColor: '#4285F4',
        fillOpacity: 0.15,
        map,
        center: target,
        radius,
        zIndex: 999
      });

      setUserLocationMarker(marker);
      setUserAccuracyCircle(circle);
    } else {
      if (userLocationMarker) {
        userLocationMarker.setMap(null);
        setUserLocationMarker(null);
      }
      if (userAccuracyCircle) {
        userAccuracyCircle.setMap(null);
        setUserAccuracyCircle(null);
      }
    }
  }, [map, userLocation, internalUserLocation]);

  useEffect(() => {
    if (userLocation) {
      setInternalUserLocation(null);
    }
  }, [userLocation?.lat, userLocation?.lng]);

  useEffect(() => {
    return () => {
      if (userLocationMarker) {
        userLocationMarker.setMap(null);
      }
      if (userAccuracyCircle) {
        userAccuracyCircle.setMap(null);
      }
    };
  }, [userLocationMarker, userAccuracyCircle]);

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

          // Determine what text to show in the pin
          let pinText = '';
          let pinWidth = 52;
          if (showQualityPercentages === false && restaurant.visitCount) {
            // Show visit count for user journey maps
            pinText = `${restaurant.visitCount} Visit${restaurant.visitCount !== 1 ? 's' : ''}`;
            pinWidth = 75;
          } else if (showQualityPercentages !== false) {
            // Show quality percentage for regular restaurant maps
            pinText = `${restaurant.qualityPercentage}%`;
          }

          const marker = new window.google.maps.Marker({
            position: restaurant.location,
            map,
            icon: {
              url: createPinIcon(pinText, showQualityPercentages === false ? '#ff3131' : qualityColor, showQualityPercentages),
              scaledSize: new window.google.maps.Size(pinWidth, 44),
              anchor: new window.google.maps.Point(pinWidth / 2, 44)
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
                    ${restaurant.visitCount ? `<span style="background: #ff3131; color: white; padding: 2px 8px; border-radius: 12px; font-size: 12px; font-weight: bold;">
                      ${restaurant.visitCount} Visit${restaurant.visitCount !== 1 ? 's' : ''}
                    </span>` : ''}
                    <span style="color: #666; font-size: 14px;">${restaurant.cuisine || 'Restaurant'} ${getCuisineIcon(restaurant.cuisine || '')}</span>
                  </div>
                  <div style="display: flex; align-items: center; gap: 8px; color: #666; font-size: 14px;">
                    <span style="display: flex; align-items: center; gap: 4px;">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="#FFD700" style="margin-right: 4px;">
                        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                      </svg>
                      ${(() => {
                        const rating = restaurant.averageMenuRating || restaurant.rating;
                        return rating != null && typeof rating === 'number' ? rating.toFixed(1) : 'N/A';
                      })()}
                    </span>
                    <span>${restaurant.priceRange || ''}</span>
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
          const rating = dish.rating != null && typeof dish.rating === 'number' ? dish.rating : 0;
          const ratingColor = getRatingColor(rating);
          const displayRating = rating > 0 ? rating.toFixed(1) : 'N/A';

          const marker = new window.google.maps.Marker({
            position: dish.location,
            map,
            icon: {
              url: createDishPinIcon(displayRating, ratingColor),
              scaledSize: new window.google.maps.Size(60, 44),
              anchor: new window.google.maps.Point(30, 44)
            },
            title: dish.name,
            zIndex: rating * 10
          });

          const infoWindow = new window.google.maps.InfoWindow({
            content: `
              <div style="padding: 8px; min-width: 200px;">
                <h3 style="margin: 0 0 8px 0; font-size: 16px; font-weight: 600; cursor: pointer; color: #0066cc;" onclick="window.onDishClick('${dish.id}')">${dish.name}</h3>
                <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
                  <span style="background: ${ratingColor}; color: white; padding: 2px 8px; border-radius: 12px; font-size: 12px; font-weight: bold;">
                    ${displayRating}
                  </span>
                  <span style="color: #0066cc; font-size: 14px; cursor: pointer;" onclick="window.onRestaurantClick('${dish.restaurantId || ''}')">${dish.restaurantName || 'Unknown'}</span>
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

      // Removed auto-fit bounds to keep map centered on initial user/fallback location
    }
  }, [map, mapType, restaurants, dishes, onRestaurantClick]);

  // Handle location button click
  const centerOnMyLocation = () => {
    setLocationError('');
    if (!navigator.geolocation) {
      setLocationError('Geolocation is not supported by this browser.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (map) {
          const coords = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            accuracy: position.coords.accuracy ?? undefined
          };
          setInternalUserLocation(coords);
          map.panTo({ lat: coords.lat, lng: coords.lng });
          map.setZoom(15);
        }
      },
      (error) => {
        console.error('Location error:', error);
        if (error.code === error.PERMISSION_DENIED) {
          setLocationError('Location permission denied. Enable it in settings to use navigation.');
        } else if (error.code === error.POSITION_UNAVAILABLE) {
          setLocationError('Location information is unavailable.');
        } else if (error.code === error.TIMEOUT) {
          setLocationError('Request to get your location timed out.');
        } else {
          setLocationError('Failed to get your location.');
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <div ref={ref} style={{ width: '100%', height: '100%' }} />

      {/* Hide Google fullscreen control if requested via CSS as fallback */}
      {!showGoogleControl && (
        <style>{`.gm-fullscreen-control{display:none!important}`}</style>
      )}

      {/* Navigation (My Location) Button */}
      {showMyLocationButton && (
        <button
          onClick={centerOnMyLocation}
          className="absolute bottom-24 right-4 w-12 h-12 rounded-full bg-white shadow-lg flex items-center justify-center z-[60] border border-gray-100"
          title="My Location"
          aria-label="Center on my location"
        >
          <Navigation className="w-6 h-6 text-blue-500" />
        </button>
      )}

      {/* Error Message */}
      {locationError && (
        <div style={{ 
          position: 'absolute', 
          top: 16, 
          left: 16, 
          right: 16, 
          zIndex: 10 
        }}>
          <div style={{
            backgroundColor: '#fef2f2',
            border: '1px solid #fca5a5',
            color: '#dc2626',
            padding: '12px 16px',
            borderRadius: 8,
            fontSize: 14
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
  userLocation?: UserLocationCoordinates | null;
  onRestaurantClick?: (id: string) => void;
  onDishClick?: (id: string) => void;
  showQualityPercentages?: boolean;
  disableInfoWindows?: boolean;
  showMyLocationButton?: boolean;
  showGoogleControl?: boolean;
  focusRestaurantId?: string;
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
  disableInfoWindows = false,
  showMyLocationButton = true,
  showGoogleControl = true,
  focusRestaurantId
}) => {
  const [topDishes, setTopDishes] = useState<Dish[]>([]);
  const [initialCenter, setInitialCenter] = useState(NYC_FALLBACK);


  useEffect(() => {
    if (mapType === 'dish' && restaurants.length > 0) {
      getTopDishes(restaurants).then(setTopDishes);
    }
  }, [mapType, restaurants]);

  const focusCenter = (() => {
    if (!focusRestaurantId) return null;
    const r = restaurants.find(r => String(r.id) === String(focusRestaurantId));
    return r?.location || null;
  })();

  const render = (status: Status) => {
    switch (status) {
      case Status.LOADING:
        return <LoadingComponent />;
      case Status.FAILURE:
        return <ErrorComponent status={status} />;
      case Status.SUCCESS:
        return (
          <Map
            center={focusCenter || initialCenter}
            zoom={focusCenter ? 16 : 13}
            mapType={mapType}
            restaurants={restaurants}
            dishes={topDishes}
            userLocation={userLocation}
            onRestaurantClick={onRestaurantClick}
            onDishClick={onDishClick}
            showQualityPercentages={showQualityPercentages}
            disableInfoWindows={disableInfoWindows}
            showMyLocationButton={showMyLocationButton}
            showGoogleControl={showGoogleControl}
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
