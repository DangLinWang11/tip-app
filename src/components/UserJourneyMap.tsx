import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import RestaurantMap from './RestaurantMap';
import UserRestaurantModal from './UserRestaurantModal';
import { getUserVisitedRestaurants, UserVisitedRestaurant } from '../services/reviewService';
interface UserJourneyMapProps {
  className?: string;
  showLegend?: boolean;
  showControls?: boolean; // show fullscreen + my-location controls
  userId?: string; // optional userId to view other users' maps
}

const UserJourneyMap: React.FC<UserJourneyMapProps> = ({ className = '', showLegend = false, showControls = true, userId }) => {
  const navigate = useNavigate();
  const [visitedRestaurants, setVisitedRestaurants] = useState<UserVisitedRestaurant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedRestaurant, setSelectedRestaurant] = useState<UserVisitedRestaurant | null>(null);
  const [showModal, setShowModal] = useState(false);

  // Load user's visited restaurants on component mount
  useEffect(() => {
    const loadVisitedRestaurants = async () => {
      try {
        setLoading(true);
        setError(null);

        const restaurants = await getUserVisitedRestaurants(userId);
        setVisitedRestaurants(restaurants);
        
        console.log(`✅ Loaded ${restaurants.length} visited restaurants for user journey map`);
      } catch (err) {
        console.error('❌ Error loading visited restaurants:', err);
        setError('Failed to load your restaurant visits');
      } finally {
        setLoading(false);
      }
    };

    loadVisitedRestaurants();
  }, [userId]);

  // Handle restaurant pin click
  const handleRestaurantClick = (restaurantId: string) => {
    console.log(`🏪 Restaurant pin clicked: ${restaurantId}`);
    
    // Find the restaurant data
    const restaurant = visitedRestaurants.find(r => r.id === restaurantId);
    if (restaurant) {
      setSelectedRestaurant(restaurant);
      setShowModal(true);
    } else {
      console.warn(`⚠️ Restaurant not found for ID: ${restaurantId}`);
    }
  };

  // Handle modal close
  const handleCloseModal = () => {
    setShowModal(false);
    setSelectedRestaurant(null);
  };

  // Convert UserVisitedRestaurant to format expected by RestaurantMap
  const mapRestaurants = visitedRestaurants.map(restaurant => ({
    id: restaurant.id,
    name: restaurant.name,
    qualityPercentage: 0,
    location: restaurant.location,
    cuisine: restaurant.cuisine,
    rating: restaurant.averageRating,
    priceRange: '$', // Default since we don't track this per user visit
    visitCount: restaurant.visitCount,
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

  // Empty state - user has no restaurant visits
  if (visitedRestaurants.length === 0) {
    return (
      <div className={`${className} flex items-center justify-center bg-gray-50 rounded-lg`}>
        <div className="text-center p-8">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-gray-400 text-2xl">🗺️</span>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No Restaurant Visits Yet</h3>
          <p className="text-gray-600 mb-6 max-w-sm mx-auto">
            Start reviewing restaurants to see your food journey on the map!
          </p>
          <button 
            onClick={() => navigate('/create')} 
            className="px-6 py-3 bg-primary text-white rounded-lg hover:bg-red-600 transition-colors font-medium"
          >
            Add Your First Review
          </button>
        </div>
      </div>
    );
  }

  // Main map display
  return (
    <>
      <div className={`${className} relative`}>
        <RestaurantMap
          mapType="restaurant"
          restaurants={mapRestaurants}
          onRestaurantClick={handleRestaurantClick}
          showQualityPercentages={false}
          className="w-full h-full"
          showMyLocationButton={showControls}
          showGoogleControl={false}
        />
        {showLegend && (() => {
          const count = visitedRestaurants.length;
          let gStart = '#FF6B6B', gEnd = '#EE2D2D';
          if (count >= 51) { gStart = '#E53935'; gEnd = '#B71C1C'; }
          else if (count >= 11) { gStart = '#FF5252'; gEnd = '#E53935'; }
          const displayText = count >= 100 ? '99+' : `${count}`;
          const fSize = displayText.length >= 3 ? 10 : displayText.length === 2 ? 12 : 13;
          return (
            <div className="absolute bottom-4 left-4 z-10">
              <div className="bg-white rounded-lg shadow-lg px-3 py-2.5 flex items-center space-x-2.5">
                <div className="flex items-center justify-center" style={{ width: 32, height: 38 }}>
                  <svg width="32" height="38" viewBox="0 0 24 34" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <defs>
                      <linearGradient id="legend_grad" x1="12" y1="2" x2="12" y2="30" gradientUnits="userSpaceOnUse">
                        <stop offset="0%" stopColor={gStart}/>
                        <stop offset="100%" stopColor={gEnd}/>
                      </linearGradient>
                      <radialGradient id="legend_depth" cx="40%" cy="35%" r="70%">
                        <stop offset="0%" stopColor="white" stopOpacity="0.12" />
                        <stop offset="100%" stopColor="white" stopOpacity="0" />
                      </radialGradient>
                      <radialGradient id="legend_shine" cx="0%" cy="0%" r="100%">
                        <stop offset="0%" stopColor="white" stopOpacity="0.6" />
                        <stop offset="100%" stopColor="white" stopOpacity="0" />
                      </radialGradient>
                      <filter id="legend_shadow" x="-10%" y="-10%" width="120%" height="140%">
                        <feOffset dx="0" dy="3" />
                        <feGaussianBlur stdDeviation="2" />
                        <feColorMatrix type="matrix" values="0 0 0 0 0
                                                             0 0 0 0 0
                                                             0 0 0 0 0
                                                             0 0 0 0.2 0" />
                        <feMerge>
                          <feMergeNode />
                          <feMergeNode in="SourceGraphic" />
                        </feMerge>
                      </filter>
                      <filter id="legend_text_shadow" x="-50%" y="-50%" width="200%" height="200%">
                        <feDropShadow dx="0" dy="1" stdDeviation="1" floodColor="#000000" floodOpacity="0.12" />
                      </filter>
                    </defs>
                    <path
                      d="M 12 2
                         C 6.5 2, 2 6.5, 2 12
                         C 2 17.5, 12 30, 12 30
                         C 12 30, 22 17.5, 22 12
                         C 22 6.5, 17.5 2, 12 2 Z"
                      fill="black"
                      opacity="1"
                      filter="url(#legend_shadow)"
                    />
                    <path
                      d="M 12 2
                         C 6.5 2, 2 6.5, 2 12
                         C 2 17.5, 12 30, 12 30
                         C 12 30, 22 17.5, 22 12
                         C 22 6.5, 17.5 2, 12 2 Z"
                      fill="url(#legend_grad)"
                      stroke="white"
                      strokeWidth="2.25"
                    />
                    <circle cx="12" cy="12" r="10" fill="url(#legend_depth)" />
                    <circle cx="9.2" cy="7.6" r="2.6" fill="url(#legend_shine)" />
                    <text x="12" y="12" fontFamily="'Poppins', sans-serif" fontSize={fSize} fontWeight="800" textAnchor="middle" dominantBaseline="central" fill="#FFFFFF" filter="url(#legend_text_shadow)">{displayText}</text>
                  </svg>
                </div>
                <span className="text-gray-800 font-medium text-sm">Visited Restaurants</span>
              </div>
            </div>
          );
        })()}
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
