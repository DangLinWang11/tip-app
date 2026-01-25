import React, { useEffect, useRef, useState } from 'react';
import { Wrapper, Status } from '@googlemaps/react-wrapper';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Navigation } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useMapBottomSheet } from '../hooks/useMapBottomSheet';
import MapBottomSheet from './discover/MapBottomSheet';
import { createDishRatingPinIcon } from '../utils/mapIcons';
import { FOOD_JOURNEY_MAP_V2 } from '../config/featureFlags';

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
  restaurantId?: string;
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
  bottomSheetHook?: ReturnType<typeof useMapBottomSheet>;
  navigate?: (path: string) => void;
}

const getQualityColor = (percentage: number): string => {
  const clampedScore = Math.max(0, Math.min(100, percentage));

  if (clampedScore >= 90) return '#2F6F4E'; // Premium / Excellent (forest green)
  if (clampedScore >= 80) return '#4F9B75'; // Very Good
  if (clampedScore >= 70) return '#9FD3B5'; // Good / Reliable
  if (clampedScore >= 60) return '#E4D96F'; // Average / Caution
  if (clampedScore >= 50) return '#F0A43C'; // Declining
  if (clampedScore >= 36) return '#E06B2D'; // Poor
  return '#C92A2A';                          // Hard Red / Avoid
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

type JourneyBadgeTheme = {
  fill: string;
  border: string;
  text: string;
  highlight: string;
  sparkle: string;
};

const getJourneyBadgeTheme = (visitCount: number): JourneyBadgeTheme => {
  if (visitCount >= 4) {
    return {
      fill: '#F1E8FF',
      border: '#B98AF8',
      text: '#6A3FAF',
      highlight: '#FFFFFF',
      sparkle: '#CDB3FF'
    };
  }
  if (visitCount >= 2) {
    return {
      fill: '#FFF1DB',
      border: '#F2B35E',
      text: '#A56318',
      highlight: '#FFFFFF',
      sparkle: '#F6C885'
    };
  }
  return {
    fill: '#FFE8E6',
    border: '#FF8B86',
    text: '#B3413E',
    highlight: '#FFFFFF',
    sparkle: '#FFC6C2'
  };
};

const createJourneyVisitBadgeIcon = (
  visitCount: number,
  opts?: { isSelected?: boolean }
): string => {
  const text = `${visitCount} visit${visitCount !== 1 ? 's' : ''}`;
  const theme = getJourneyBadgeTheme(visitCount);
  const minWidth = 84;
  const charWidth = 6.3;
  const width = Math.max(minWidth, Math.round(text.length * charWidth + 46));
  const canvasHeight = 52;
  const pillHeight = 30;
  const pillRadius = 15;
  const pillY = 6;
  const pillX = 4;
  const pillWidth = width - pillX * 2;
  const baseWidth = Math.max(30, Math.round(pillWidth * 0.42));
  const baseHeight = 8;
  const baseX = (width - baseWidth) / 2;
  const baseY = pillY + pillHeight + 4;
  const pointerWidth = 10;
  const pointerHeight = 6;
  const pointerX = width / 2 - pointerWidth / 2;
  const pointerY = baseY + baseHeight - 1;
  const iconSize = 14;
  const iconX = pillX + 10;
  const iconY = pillY + 8;
  const textX = iconX + iconSize + 7;
  const textY = pillY + 20;
  const ringStroke = opts?.isSelected ? theme.border : 'transparent';
  const shadowOpacity = opts?.isSelected ? 0.2 : 0.16;
  const svg = `
    <svg width="${width}" height="${canvasHeight}" viewBox="0 0 ${width} ${canvasHeight}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="badgeHighlight" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="${theme.highlight}" stop-opacity="0.7"/>
          <stop offset="100%" stop-color="${theme.highlight}" stop-opacity="0"/>
        </linearGradient>
      </defs>
      <rect x="${pillX}" y="${pillY + 4}" width="${pillWidth}" height="${pillHeight}" rx="${pillRadius}" fill="black" opacity="${shadowOpacity}" />
      <rect x="${pillX}" y="${pillY}" width="${pillWidth}" height="${pillHeight}" rx="${pillRadius}" fill="#FFE7E5" stroke="#FF6B6B" stroke-width="1.2" />
      <rect x="${pillX + 2}" y="${pillY + 2}" width="${pillWidth - 4}" height="${pillHeight / 2}" rx="${pillRadius - 2}" fill="url(#badgeHighlight)" />
      <rect x="${pillX - 1}" y="${pillY - 1}" width="${pillWidth + 2}" height="${pillHeight + 2}" rx="${pillRadius + 1}" fill="none" stroke="${ringStroke}" stroke-width="1.4" />
      <rect x="${baseX}" y="${baseY + 2}" width="${baseWidth}" height="${baseHeight}" rx="${baseHeight / 2}" fill="black" opacity="0.1" />
      <rect x="${baseX}" y="${baseY}" width="${baseWidth}" height="${baseHeight}" rx="${baseHeight / 2}" fill="#FFD7D4" stroke="#FF6B6B" stroke-width="1.1" />
      <circle cx="${baseX + baseWidth / 2 - 6}" cy="${baseY + baseHeight / 2}" r="1" fill="#FFB3AC" />
      <circle cx="${baseX + baseWidth / 2}" cy="${baseY + baseHeight / 2}" r="1" fill="#FFB3AC" />
      <circle cx="${baseX + baseWidth / 2 + 6}" cy="${baseY + baseHeight / 2}" r="1" fill="#FFB3AC" />
      <path d="M ${pointerX} ${pointerY} Q ${width / 2} ${pointerY + pointerHeight} ${pointerX + pointerWidth} ${pointerY}" fill="#FF6B6B" />
      <g transform="translate(${iconX},${iconY})" fill="none" stroke="#B3413E" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">
        <path d="M7 1.5l1.8 3.6 4 .6-2.9 2.8.7 4-3.6-1.9-3.6 1.9.7-4-2.9-2.8 4-.6L7 1.5z"/>
      </g>
      <text x="${textX}" y="${textY}" font-family="Nunito, Arial, sans-serif" font-size="12.5" font-weight="600" letter-spacing="0.2" fill="#B3413E">${text}</text>
      <circle cx="${width - 12}" cy="${pillY + 6}" r="1.6" fill="#FFC9C4" />
      <path d="M ${width - 18} ${pillY + 8} l2 1.4 l-2 1.4 l-1.4-2 z" fill="#FFC9C4" opacity="0.7"/>
    </svg>
  `;

  return 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg);
};

const hashString = (value: string): number => {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
};

const applyCollisionJitter = (
  position: { lat: number; lng: number },
  id: string,
  seen: Map<string, number>
) => {
  const key = `${position.lat.toFixed(6)},${position.lng.toFixed(6)}`;
  const count = seen.get(key) ?? 0;
  seen.set(key, count + 1);
  if (count === 0) return position;

  const hash = hashString(id);
  const angle = ((hash % 360) * Math.PI) / 180;
  const magnitude = 0.00003 + (count * 0.000008);
  return {
    lat: position.lat + Math.cos(angle) * magnitude,
    lng: position.lng + Math.sin(angle) * magnitude
  };
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

const DEFAULT_MAP_STYLE: google.maps.MapTypeStyle[] = [
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
];

const Map: React.FC<MapProps> = ({ center, zoom, mapType, restaurants, dishes, userLocation, onRestaurantClick, onDishClick, showQualityPercentages = true, disableInfoWindows = false, showMyLocationButton = true, showGoogleControl = true, bottomSheetHook, navigate }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<google.maps.Map>();
  const styleLoggedRef = useRef(false);
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
        fullscreenControl: showGoogleControl,
        zoomControl: false,
        rotateControl: false,
        scaleControl: false,
        gestureHandling: 'greedy',
        scrollwheel: true,
        disableDoubleClickZoom: false,
        styles: DEFAULT_MAP_STYLE
      });
      if (!styleLoggedRef.current) {
        console.log('Map style: DEFAULT');
        styleLoggedRef.current = true;
      }
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

      if (mapType === 'restaurant') {
        // Show restaurant pins
        const positionCounts = new globalThis.Map<string, number>();
        restaurants.forEach((restaurant) => {
          // Validate location data before creating marker
          let position = restaurant.location;

          // Safety check: ensure position is a valid LatLng object
          if (!position || typeof position !== 'object' || typeof position.lat !== 'number' || typeof position.lng !== 'number') {
            console.warn(`⚠️ Invalid location data for restaurant ${restaurant.name}, skipping marker`, position);
            return; // Skip this restaurant
          }

          const qualityColor = getQualityColor(restaurant.qualityPercentage);

          // Determine what text to show in the pin
          let pinText = '';
          let pinWidth = 52;
          if (showQualityPercentages === false && restaurant.visitCount) {
            // Show review count for user journey maps
            if (FOOD_JOURNEY_MAP_V2) {
              pinText = `${restaurant.visitCount} visit${restaurant.visitCount !== 1 ? 's' : ''}`;
              pinWidth = Math.max(84, Math.round(pinText.length * 6.3 + 46));
            } else {
              pinText = `${restaurant.visitCount} Review${restaurant.visitCount !== 1 ? 's' : ''}`;
              pinWidth = 85;
            }
          } else if (showQualityPercentages !== false) {
            // Show quality percentage for regular restaurant maps
            pinText = `${restaurant.qualityPercentage}%`;
          }

          const markerPosition = applyCollisionJitter(
            position,
            String(restaurant.id),
            positionCounts
          );

          const marker = new window.google.maps.Marker({
            position: markerPosition,
            map,
            icon: {
              url: (showQualityPercentages === false && FOOD_JOURNEY_MAP_V2)
                ? createJourneyVisitBadgeIcon(restaurant.visitCount || 1)
                : createPinIcon(pinText, showQualityPercentages === false ? '#ff3131' : qualityColor, showQualityPercentages),
              scaledSize: new window.google.maps.Size(pinWidth, 44),
              anchor: new window.google.maps.Point(pinWidth / 2, 50)
            },
            title: restaurant.name,
            zIndex: restaurant.qualityPercentage
          });

          marker.addListener('click', () => {
            // Open bottom sheet with nearby restaurants
            if (bottomSheetHook) {
              bottomSheetHook.openRestaurantSheet(
                restaurant.location.lat,
                restaurant.location.lng,
                2000 // 2km radius
              );
            } else if (onRestaurantClick) {
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
          const displayRating = rating > 0 ? rating.toFixed(1) : 'N/A';

          const marker = new window.google.maps.Marker({
            position: dish.location,
            map,
            icon: {
              url: createDishRatingPinIcon(displayRating),
              scaledSize: new window.google.maps.Size(64, 48),
              anchor: new window.google.maps.Point(32, 48)
            },
            title: dish.name,
            zIndex: rating * 10
          });

          marker.addListener('click', () => {
            // Open bottom sheet with all dishes from this restaurant
            if (bottomSheetHook && dish.restaurantId) {
              bottomSheetHook.openDishSheet(dish.restaurantId);
            } else if (onDishClick) {
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

  const navButtonClassName = showGoogleControl
    ? 'absolute bottom-24 right-4 w-16 h-16 rounded-full bg-white shadow-lg flex items-center justify-center z-[40] border border-gray-100'
    : 'absolute bottom-4 right-2 w-16 h-16 rounded-full bg-white shadow-lg flex items-center justify-center z-[40] border border-gray-100';

  const navIconClassName = showGoogleControl ? 'w-8 h-8 text-blue-500' : 'w-8 h-8 text-blue-500';

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
          className={navButtonClassName}
          title="My Location"
          aria-label="Center on my location"
        >
          <Navigation className={navIconClassName} fill="currentColor" />
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
    // Get all menu items from Firebase (filter out deleted items)
    const menuItemsRef = collection(db, 'menuItems');
    const menuItemsQuery = query(menuItemsRef, where('isDeleted', '==', false));
    const menuItemsSnapshot = await getDocs(menuItemsQuery);
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
  const bottomSheet = useMapBottomSheet();
  const navigate = useNavigate();

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
            bottomSheetHook={bottomSheet}
            navigate={navigate}
          />
        );
    }
  };

  return (
    <div className={`w-full h-full ${className}`}>
      <Wrapper
        apiKey={import.meta.env.VITE_GOOGLE_MAPS_API_KEY}
        render={render}
        libraries={['places']}
      />
      <MapBottomSheet
        isOpen={bottomSheet.isOpen}
        onClose={bottomSheet.closeSheet}
        items={bottomSheet.items}
        type={bottomSheet.type}
        onItemClick={(id) => {
          if (bottomSheet.type === 'dish') {
            navigate(`/dish/${id}`);
          } else {
            navigate(`/restaurant/${id}`);
          }
        }}
      />
    </div>
  );
};

export default RestaurantMap;
