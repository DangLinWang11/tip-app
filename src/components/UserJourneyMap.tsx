import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Globe2, X, ChevronDown } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import RestaurantMap from './RestaurantMap';
import UserRestaurantModal from './UserRestaurantModal';
import DemoRestaurantModal from './DemoRestaurantModal';
import { getUserVisitedRestaurants, UserVisitedRestaurant } from '../services/reviewService';
import { CountryData, getCountryByCode, getCountryCentroid } from '../data/countries';
import { getCountryFromCoordinates } from '../utils/reverseGeocode';
import { getCurrentUser, getUserProfile } from '../lib/firebase';
import { getTierFromPoints } from '../badges/badgeTiers';
import CountrySelector from './CountrySelector';
import AvatarBadge from './badges/AvatarBadge';
import { demoJourneyCenter, demoJourneyRestaurants, demoJourneyZoom, type DemoRestaurant } from '../data/demoJourney';

interface FocusRestaurant {
  lat: number;
  lng: number;
  id: string;
  name: string;
}

interface UserJourneyMapProps {
  className?: string;
  showLegend?: boolean;
  showControls?: boolean; // show fullscreen + my-location controls
  userId?: string; // optional userId to view other users' maps
  userName?: string;
  userAvatar?: string; // avatar URL from user profile
  userTierIndex?: number;
  allowHomeCountryOverride?: boolean;
  onClose?: () => void;
  onBack?: () => void;
  homeCountry?: string; // ISO country code from user profile
  focusRestaurant?: FocusRestaurant; // restaurant to focus on after review creation
  fullBleed?: boolean; // Remove rounded corners for edge-to-edge map
}

const HOME_COUNTRY_STORAGE_KEY = 'tip.homeCountry';

const UserJourneyMap: React.FC<UserJourneyMapProps> = ({
  className = '',
  showLegend = false,
  showControls = true,
  userId,
  userName,
  userAvatar,
  userTierIndex,
  allowHomeCountryOverride = true,
  onClose,
  onBack,
  homeCountry,
  focusRestaurant,
  fullBleed = false
}) => {
  const navigate = useNavigate();
  const isOwnMap = !userId;

  // Self-load current user's profile for own map to fill in missing avatar/tier
  const [selfProfile, setSelfProfile] = useState<any>(null);
  useEffect(() => {
    if (!isOwnMap) return;
    const loadSelf = async () => {
      try {
        const result = await getUserProfile();
        if (result.success && result.profile) {
          setSelfProfile(result.profile);
        }
      } catch {
        // Non-blocking
      }
    };
    loadSelf();
  }, [isOwnMap]);

  // Resolve avatar and tier: use props first, fall back to self-loaded profile
  const effectiveAvatar = userAvatar || (isOwnMap ? (selfProfile?.avatar || selfProfile?.photoURL || getCurrentUser()?.photoURL) : undefined) || undefined;
  const effectiveTierIndex = userTierIndex ?? (isOwnMap && selfProfile ? getTierFromPoints(selfProfile.stats?.pointsEarned ?? 0).tierIndex : undefined);

  const [avatarError, setAvatarError] = useState(false);
  // Reset avatar error when the URL changes (e.g. self-profile loaded a new URL)
  useEffect(() => { setAvatarError(false); }, [effectiveAvatar]);
  const resolvedAvatar = effectiveAvatar && !avatarError ? effectiveAvatar : null;
  const [visitedRestaurants, setVisitedRestaurants] = useState<UserVisitedRestaurant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedRestaurant, setSelectedRestaurant] = useState<UserVisitedRestaurant | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [selectedDemoRestaurant, setSelectedDemoRestaurant] = useState<DemoRestaurant | null>(null);
  const [showDemoModal, setShowDemoModal] = useState(false);
  const [deviceCountry, setDeviceCountry] = useState<string | null>(null);
  const [homeCountryOverride, setHomeCountryOverride] = useState<string | null>(null);
  const [countryPickerOpen, setCountryPickerOpen] = useState(false);
  const [mapZoom, setMapZoom] = useState<number>(2);
  const prevMapZoomRef = React.useRef<number>(2);
  const [resetTrigger, setResetTrigger] = useState(0);
  const [activeCountryCode, setActiveCountryCode] = useState<string | null>(null);

  const handleResetView = () => {
    setActiveCountryCode(null);
    setResetTrigger(prev => prev + 1);
  };

  useEffect(() => {
    if (!allowHomeCountryOverride || typeof window === 'undefined') return;
    const stored = window.localStorage.getItem(HOME_COUNTRY_STORAGE_KEY);
    if (stored) setHomeCountryOverride(stored);
  }, [allowHomeCountryOverride]);

  const effectiveHomeCountry = homeCountryOverride || homeCountry || null;
  const homeCountryData = useMemo<CountryData | null>(() => {
    if (!effectiveHomeCountry) return null;
    return getCountryByCode(effectiveHomeCountry) || null;
  }, [effectiveHomeCountry, visitedRestaurants.length]);

  // Detect device country as fallback (only if no homeCountry and no reviews)
  useEffect(() => {
    if (effectiveHomeCountry) return;
    if (visitedRestaurants.length === 0) return;
    if (!navigator.geolocation) return;

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const result = await getCountryFromCoordinates(
            position.coords.latitude,
            position.coords.longitude
          );
          if (result) setDeviceCountry(result.code);
        } catch {
          // Silently fail
        }
      },
      () => { /* denied or failed */ },
      { timeout: 8000, maximumAge: 300000 }
    );
  }, [effectiveHomeCountry]);

  // Load user's visited restaurants on component mount
  useEffect(() => {
    const loadVisitedRestaurants = async () => {
      try {
        setLoading(true);
        setError(null);

        const restaurants = await getUserVisitedRestaurants(userId);
        setVisitedRestaurants(restaurants);

        console.log(`Loaded ${restaurants.length} visited restaurants for user journey map`);
      } catch (err) {
        console.error('Error loading visited restaurants:', err);
        setError('Failed to load your restaurant visits');
      } finally {
        setLoading(false);
      }
    };

    loadVisitedRestaurants();
  }, [userId]);

  // Compute country stats from visited restaurants
  const countryStats = useMemo(() => {
    const countryMap = new Map<string, { count: number; lats: number[]; lngs: number[] }>();

    visitedRestaurants.forEach((r) => {
      if (!r.countryCode) return;
      const existing = countryMap.get(r.countryCode);
      if (existing) {
        existing.count++;
        existing.lats.push(r.location.lat);
        existing.lngs.push(r.location.lng);
      } else {
        countryMap.set(r.countryCode, {
          count: 1,
          lats: [r.location.lat],
          lngs: [r.location.lng],
        });
      }
    });

    const stats: Array<{
      code: string;
      name: string;
      flag: string;
      count: number;
      lat: number;
      lng: number;
      bounds?: google.maps.LatLngBounds;
    }> = [];

    countryMap.forEach((data, code) => {
      const countryInfo = getCountryByCode(code);
      if (!countryInfo) return;
      const centroid = getCountryCentroid(code);
      if (!centroid) return;

      // Compute LatLngBounds for fitBounds on click
      // Note: LatLngBounds is constructed lazily since google.maps may not be loaded yet
      // We store the raw coords and build bounds in RestaurantMap where google.maps is available
      stats.push({
        code,
        name: countryInfo.name,
        flag: countryInfo.flag,
        count: data.count,
        lat: centroid.lat,
        lng: centroid.lng,
      });
    });

    return stats;
  }, [visitedRestaurants]);

  // Compute raw bounds data per country (lat/lng arrays) for constructing google.maps.LatLngBounds
  const countryBoundsData = useMemo(() => {
    const boundsMap = new Map<string, { lats: number[]; lngs: number[] }>();
    visitedRestaurants.forEach((r) => {
      if (!r.countryCode) return;
      const existing = boundsMap.get(r.countryCode);
      if (existing) {
        existing.lats.push(r.location.lat);
        existing.lngs.push(r.location.lng);
      } else {
        boundsMap.set(r.countryCode, { lats: [r.location.lat], lngs: [r.location.lng] });
      }
    });
    return boundsMap;
  }, [visitedRestaurants]);

  // Build countryStats with bounds (needs google.maps.LatLngBounds which is only available after map loads)
  // We'll pass the raw data and let RestaurantMap construct the bounds
  const countryStatsWithBoundsData = useMemo(() => {
    return countryStats.map((stat) => {
      const boundsData = countryBoundsData.get(stat.code);
      return {
        ...stat,
        _boundsLats: boundsData?.lats || [],
        _boundsLngs: boundsData?.lngs || [],
      };
    });
  }, [countryStats, countryBoundsData]);

  const isNewUser = visitedRestaurants.length === 0;

  // Compute map center using fallback chain:
  // 0. focusRestaurant → 1. homeCountry → 2. most-visited country → 3. device location country → 4. world view
  const { mapCenter, mapZoom: initialZoom } = useMemo(() => {
    if (isNewUser) {
      return { mapCenter: demoJourneyCenter, mapZoom: demoJourneyZoom };
    }
    // 0. Focus on specific restaurant (post-review)
    if (focusRestaurant) {
      return { mapCenter: { lat: focusRestaurant.lat, lng: focusRestaurant.lng }, mapZoom: 13 };
    }

    // 1. homeCountry
    if (effectiveHomeCountry) {
      const centroid = getCountryCentroid(effectiveHomeCountry);
      if (centroid) return { mapCenter: centroid, mapZoom: 4 };
    }

    // 2. Most-visited country from restaurants
    if (countryStats.length > 0) {
      const mostVisited = countryStats.reduce((prev, curr) =>
        curr.count > prev.count ? curr : prev
      );
      return { mapCenter: { lat: mostVisited.lat, lng: mostVisited.lng }, mapZoom: 4 };
    }

    // 3. Device location country
    if (deviceCountry) {
      const centroid = getCountryCentroid(deviceCountry);
      if (centroid) return { mapCenter: centroid, mapZoom: 4 };
    }

    // 4. World view fallback
    return { mapCenter: { lat: 20, lng: 0 }, mapZoom: 2 };
  }, [focusRestaurant, effectiveHomeCountry, countryStats, deviceCountry, isNewUser]);

  useEffect(() => {
    setMapZoom(initialZoom);
  }, [initialZoom]);

  const isCollapsedHeader = mapZoom >= 6;
  const selectedCountryLabel = homeCountryData ? `${homeCountryData.flag} ${homeCountryData.name}` : (allowHomeCountryOverride ? 'Set home country' : 'No home country set');
  const mapRestriction = useMemo<google.maps.MapRestriction>(() => ({
    latLngBounds: { north: 85, south: -85, west: -180, east: 180 },
    strictBounds: false
  }), []);

  const stats = useMemo(() => {
    const places = visitedRestaurants.length;
    const countries = countryStats.length;
    const dates = visitedRestaurants
      .map(r => Date.parse(r.lastVisit))
      .filter((value) => Number.isFinite(value));
    const since = dates.length > 0 ? new Date(Math.min(...dates)).getFullYear() : null;
    return { places, countries, since };
  }, [visitedRestaurants, countryStats]);

  const handleCountrySelect = (country: CountryData) => {
    if (!allowHomeCountryOverride || typeof window === 'undefined') return;
    setHomeCountryOverride(country.code);
    window.localStorage.setItem(HOME_COUNTRY_STORAGE_KEY, country.code);
    setCountryPickerOpen(false);
  };

  const handleZoomChanged = useCallback((zoom: number) => {
    const prevZoom = prevMapZoomRef.current;
    prevMapZoomRef.current = zoom;
    setMapZoom(zoom);
    // Only clear active country when zooming DOWN from 6+ to <=5 (not when already at <=5)
    if (zoom <= 5 && prevZoom > 5) {
      setActiveCountryCode(null);
    }
  }, []);

  const handleCountryToggle = (countryCode: string) => {
    setActiveCountryCode(prev => prev === countryCode ? null : countryCode);
  };

  // Handle restaurant pin click
  const handleRestaurantClick = (restaurantId: string) => {
    const restaurant = visitedRestaurants.find(r => r.id === restaurantId);
    if (restaurant) {
      setSelectedRestaurant(restaurant);
      setShowModal(true);
    }
  };

  // Handle modal close
  const handleCloseModal = () => {
    setShowModal(false);
    setSelectedRestaurant(null);
  };

  const handleDemoRestaurantClick = (restaurantId: string) => {
    const demoRestaurant = demoJourneyRestaurants.find(r => r.id === restaurantId);
    if (demoRestaurant) {
      setSelectedDemoRestaurant(demoRestaurant);
      setShowDemoModal(true);
    }
  };

  // Convert UserVisitedRestaurant to format expected by RestaurantMap
  const mapRestaurants = visitedRestaurants.map(restaurant => ({
    id: restaurant.id,
    name: restaurant.name,
    qualityPercentage: 0,
    location: restaurant.location,
    cuisine: restaurant.cuisine,
    rating: restaurant.averageRating,
    priceRange: '$',
    visitCount: restaurant.visitCount,
    countryCode: restaurant.countryCode,
  }));

  // Loading state
  if (loading) {
    return (
      <div className={`${className} flex items-center justify-center bg-gray-100 rounded-lg`}>
        <div className="text-center p-8">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600 font-medium">Loading your food journey...</p>
          <p className="text-gray-500 text-sm">Mapping your restaurant visits</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className={`${className} flex items-center justify-center bg-red-50 rounded-lg`}>
        <div className="text-center p-8">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-red-600 text-2xl">⚠️</span>
          </div>
          <h3 className="text-lg font-semibold text-red-900 mb-2">Unable to Load Map</h3>
          <p className="text-red-600 mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (isNewUser) {
    return (
      <>
        <div className={`${className} relative overflow-hidden ${fullBleed ? '' : 'rounded-2xl'} bg-white`}>
          <RestaurantMap
            mapType="restaurant"
            restaurants={[]}
            demoRestaurants={demoJourneyRestaurants.map(r => ({
              id: r.id,
              name: r.name,
              qualityPercentage: Math.round((r.rating / 10) * 100),
              location: r.location,
              cuisine: r.cuisine,
              rating: r.rating,
              priceRange: '$',
              visitCount: r.visitCount,
              countryCode: r.countryCode,
            }))}
            demoMode
            onDemoRestaurantClick={handleDemoRestaurantClick}
            showQualityPercentages={false}
            className="w-full h-full"
            showMyLocationButton={false}
            showGoogleControl={false}
            initialCenter={demoJourneyCenter}
            initialZoom={demoJourneyZoom}
            mapRestriction={mapRestriction}
            minZoom={2}
            maxZoom={18}
            searchActive={false}
          />

          {/* Demo label keeps example pins explicit to avoid confusion */}
          <div className="pointer-events-none absolute top-4 left-4 z-30">
            <div className="rounded-full bg-white/90 backdrop-blur border border-gray-200 px-3 py-1 text-xs font-semibold text-gray-700">
              Demo journey · Example pins
            </div>
          </div>

          {/* Demo onboarding card: explain map + CTA */}
          <div
            className="absolute inset-x-0 z-30 px-4"
            style={{ bottom: '76px' }}
          >
            <div className="bg-white/95 backdrop-blur border border-gray-200 rounded-2xl p-4 shadow-lg">
              <h3 className="text-base font-semibold text-gray-900 mb-1">
                Welcome to your Food Journey Map!
              </h3>
              <p className="text-sm text-gray-600 mb-4">
                Every food you review becomes a pin here.
                Tap a pin to see what it will look like.
              </p>
              <div className="flex flex-col gap-2">
                <button
                  onClick={() => navigate('/create')}
                  className="w-full bg-primary text-white py-2.5 rounded-xl font-semibold hover:bg-red-600 transition-colors"
                >
                  Add your first review
                </button>
                <button
                  onClick={() => navigate('/create', { state: { focusRestaurantSearch: true } })}
                  className="w-full border border-gray-300 text-gray-700 py-2.5 rounded-xl font-semibold hover:bg-gray-50 transition-colors"
                >
                  Search a place
                </button>
              </div>
            </div>
          </div>
        </div>

        <DemoRestaurantModal
          restaurant={selectedDemoRestaurant}
          isOpen={showDemoModal}
          onClose={() => setShowDemoModal(false)}
        />
      </>
    );
  }

  // Main map display
  return (
    <>
      <div className={`${className} relative overflow-hidden ${fullBleed ? '' : 'rounded-2xl'} bg-white`}>
        <div
          className="absolute inset-x-0 bottom-0"
          style={{ top: 'calc(-1 * env(safe-area-inset-top))' }}
        >
          <RestaurantMap
            mapType="restaurant"
            restaurants={mapRestaurants}
            onRestaurantClick={handleRestaurantClick}
            onZoomChanged={handleZoomChanged}
            showQualityPercentages={false}
            className="w-full h-full"
            showMyLocationButton={showControls}
            showGoogleControl={false}
            myLocationButtonOffset={80}
            initialCenter={mapCenter}
            initialZoom={initialZoom}
            countryStats={countryStatsWithBoundsData}
            focusRestaurantId={focusRestaurant?.id}
            mapRestriction={mapRestriction}
            minZoom={2}
            maxZoom={18}
            resetTrigger={resetTrigger}
            activeCountryCode={activeCountryCode}
            onCountryToggle={handleCountryToggle}
          />
        </div>

        <div className="pointer-events-none absolute inset-x-0 top-0 h-14 bg-gradient-to-b from-white/70 via-white/30 to-transparent" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-white/90 via-white/40 to-transparent" />

        <AnimatePresence>
          {showLegend && stats.places > 0 && (
            <motion.button
              key={`journey-stats-${stats.places}-${stats.countries}`}
              type="button"
              initial={{ opacity: 0, y: 12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.98 }}
              transition={{ type: 'spring', stiffness: 260, damping: 26 }}
              className="absolute bottom-4 left-4 z-20 pointer-events-auto"
            >
              <div className="rounded-2xl bg-white/90 backdrop-blur-xl shadow-[0_12px_28px_rgba(0,0,0,0.18)] border border-white/70 px-3 py-1.5 flex items-center gap-2.5">
                <div className="flex items-center justify-center w-6 flex-shrink-0">
                  <svg width="24" height="30" viewBox="0 0 24 34" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <defs>
                      <linearGradient id="journey_grad" x1="12" y1="2" x2="12" y2="30" gradientUnits="userSpaceOnUse">
                        <stop offset="0%" stopColor="#FF6B6B"/>
                        <stop offset="100%" stopColor="#EE2D2D"/>
                      </linearGradient>
                      <radialGradient id="journey_depth" cx="40%" cy="35%" r="70%">
                        <stop offset="0%" stopColor="white" stopOpacity="0.12" />
                        <stop offset="100%" stopColor="white" stopOpacity="0" />
                      </radialGradient>
                      <radialGradient id="journey_shine" cx="0%" cy="0%" r="100%">
                        <stop offset="0%" stopColor="white" stopOpacity="0.6" />
                        <stop offset="100%" stopColor="white" stopOpacity="0" />
                      </radialGradient>
                    </defs>
                    <path
                      d="M 12 2
                         C 6.5 2, 2 6.5, 2 12
                         C 2 17.5, 12 30, 12 30
                         C 12 30, 22 17.5, 22 12
                         C 22 6.5, 17.5 2, 12 2 Z"
                      fill="url(#journey_grad)"
                      stroke="white"
                      strokeWidth="2.25"
                    />
                    <circle cx="12" cy="12" r="10" fill="url(#journey_depth)" />
                    <circle cx="9.2" cy="7.6" r="2.6" fill="url(#journey_shine)" />
                    <text x="12" y="12" fontFamily="'Poppins', sans-serif" fontSize="12" fontWeight="800" textAnchor="middle" dominantBaseline="central" fill="#FFFFFF">{stats.places >= 100 ? '99+' : stats.places}</text>
                  </svg>
                </div>
                <div className="flex flex-col items-start text-left leading-tight">
                  <span className="text-[11px] uppercase tracking-[0.16em] text-gray-400">Journey Stats</span>
                  <span className="text-[13px] font-semibold text-gray-800">
                    🍽 {stats.places} places · 🌍 {stats.countries} countries
                  </span>
                  {stats.since && <span className="text-[11px] font-normal text-gray-500">since {stats.since}</span>}
                </div>
              </div>
            </motion.button>
          )}
        </AnimatePresence>

        <div
          className="absolute left-4 right-4 z-30 pointer-events-none"
          style={{ top: 'calc(env(safe-area-inset-top) + 16px)' }}
        >
          <AnimatePresence mode="wait">
            {!isCollapsedHeader && (
              <motion.div
                key="journey-header-expanded"
                initial={{ opacity: 0, y: -12, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.98 }}
                transition={{ type: 'spring', stiffness: 260, damping: 26 }}
                className="pointer-events-auto"
              >
                <div className="relative rounded-3xl bg-white/92 backdrop-blur-xl shadow-[0_20px_40px_rgba(15,23,42,0.2)] border border-white/70 px-4 py-3">
                  {onClose && (
                    <button
                      onClick={onClose}
                      className="absolute top-2 right-2 h-7 w-7 rounded-full bg-gray-100 flex items-center justify-center z-10"
                      aria-label="Close map"
                    >
                      <X className="w-3.5 h-3.5 text-gray-500" />
                    </button>
                  )}
                  <div className="flex items-center gap-3">
                    {onBack && (
                      <button
                        onClick={onBack}
                        className="h-9 w-9 rounded-full bg-white shadow-sm border border-gray-100 flex items-center justify-center"
                        aria-label="Go back"
                      >
                        <span className="text-lg">←</span>
                      </button>
                    )}
                    <div className="relative flex-shrink-0" style={{ width: 40, height: 40 }}>
                      {resolvedAvatar ? (
                        <img
                          src={resolvedAvatar}
                          alt={userName || 'You'}
                          onError={() => setAvatarError(true)}
                          className="h-10 w-10 rounded-full object-cover shadow-md border border-white/50"
                        />
                      ) : (
                        <div className="h-10 w-10 rounded-full bg-gradient-to-br from-rose-500 to-red-600 text-white flex items-center justify-center font-semibold text-base shadow-md">
                          {(userName || 'You').slice(0, 1).toUpperCase()}
                        </div>
                      )}
                      {typeof effectiveTierIndex === 'number' && (
                        <div className="absolute -top-1 -left-1 z-10">
                          <AvatarBadge tierIndex={effectiveTierIndex} size="feed" className="!static" />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-[10px] uppercase tracking-[0.22em] text-gray-400">Food Journey</p>
                        {typeof effectiveTierIndex === 'number' && (
                          <span className="text-[9px] uppercase tracking-[0.14em] text-rose-500 bg-rose-50 border border-rose-100 px-1.5 py-px rounded-full whitespace-nowrap">
                            Tier {effectiveTierIndex}
                          </span>
                        )}
                      </div>
                      <h2 className="text-base font-semibold text-gray-900 leading-tight truncate">
                        {userName ? `${userName}'s passport` : 'Your passport'}
                      </h2>
                      {allowHomeCountryOverride ? (
                        <button
                          type="button"
                          onClick={() => setCountryPickerOpen(true)}
                          className="inline-flex items-center gap-1 text-xs text-gray-600 hover:text-gray-900"
                        >
                          <span>{selectedCountryLabel}</span>
                          <ChevronDown className="w-3.5 h-3.5" />
                        </button>
                      ) : (
                        <span className="inline-flex items-center text-xs text-gray-600">
                          {homeCountryData
                            ? `Home country: ${homeCountryData.flag} ${homeCountryData.name}`
                            : 'No home country set'}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
            {isCollapsedHeader && (
              <motion.div
                key="journey-header-collapsed"
                initial={{ opacity: 0, y: -8, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -6, scale: 0.98 }}
                transition={{ type: 'spring', stiffness: 260, damping: 26 }}
                className="pointer-events-auto flex items-center justify-between"
              >
                <button
                  type="button"
                  onClick={handleResetView}
                  className="inline-flex items-center gap-2 rounded-full bg-white/95 backdrop-blur-xl shadow-[0_16px_30px_rgba(15,23,42,0.18)] border border-white/70 px-3 py-2 active:scale-95 transition-transform"
                >
                  <div className="relative" style={{ width: 32, height: 32 }}>
                    {resolvedAvatar ? (
                      <img
                        src={resolvedAvatar}
                        alt={userName || 'You'}
                        onError={() => setAvatarError(true)}
                        className="h-8 w-8 rounded-full object-cover border border-white/50"
                      />
                    ) : (
                      <div className="h-8 w-8 rounded-full bg-gradient-to-br from-rose-500 to-red-600 text-white flex items-center justify-center text-sm font-semibold">
                        {(userName || 'You').slice(0, 1).toUpperCase()}
                      </div>
                    )}
                    {typeof effectiveTierIndex === 'number' && (
                      <div className="absolute -top-0.5 -left-0.5 z-10">
                        <AvatarBadge tierIndex={effectiveTierIndex} size="small" className="!static" />
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col leading-tight text-left">
                    <span className="text-xs text-gray-400 uppercase tracking-[0.18em]">Journey</span>
                    <span className="text-sm font-semibold text-gray-800">{homeCountryData?.name || 'Food map'}</span>
                  </div>
                  <span className="ml-1 text-sm text-gray-600">
                    {homeCountryData?.flag || '🌍'}
                  </span>
                </button>
                {onClose && (
                  <button
                    onClick={onClose}
                    className="h-9 w-9 rounded-full bg-white/90 shadow-sm border border-white/70 flex items-center justify-center"
                    aria-label="Close map"
                  >
                    <X className="w-4 h-4 text-gray-600" />
                  </button>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <AnimatePresence>
          {countryPickerOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-40 flex items-center justify-center bg-black/40 backdrop-blur-sm"
            >
              <motion.div
                initial={{ y: 24, opacity: 0, scale: 0.98 }}
                animate={{ y: 0, opacity: 1, scale: 1 }}
                exit={{ y: 16, opacity: 0, scale: 0.98 }}
                transition={{ type: 'spring', stiffness: 260, damping: 26 }}
                className="w-[90%] max-w-md max-h-[80vh] bg-white rounded-3xl shadow-2xl p-5"
              >
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-gray-400">Home Country</p>
                    <h3 className="text-lg font-semibold text-red-500">Where do you eat most?</h3>
                  </div>
                  <button
                    onClick={() => setCountryPickerOpen(false)}
                    className="h-9 w-9 rounded-full bg-gray-100 flex items-center justify-center"
                    aria-label="Close selector"
                  >
                    <X className="w-4 h-4 text-gray-600" />
                  </button>
                </div>
                <CountrySelector
                  selectedCountry={homeCountryData}
                  onSelect={handleCountrySelect}
                  autoDetect={!homeCountryData}
                />
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Restaurant Details Modal */}
      {showModal && selectedRestaurant && (
        <UserRestaurantModal
          restaurant={selectedRestaurant}
          isOpen={showModal}
          onClose={handleCloseModal}
          userId={userId}
        />
      )}
    </>
  );
};

export default UserJourneyMap;
