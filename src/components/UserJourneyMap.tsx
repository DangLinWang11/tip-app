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
  }, []);

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
          showGoogleControl={showControls}
        />
        {showLegend && (
          <div className="absolute bottom-4 left-4 z-10">
            <div className="bg-white rounded-lg shadow-lg px-4 py-3 flex items-center space-x-3">
              <div className="flex items-center justify-center">
                <svg width="40" height="28" viewBox="0 0 60 40" xmlns="http://www.w3.org/2000/svg">
                  <defs>
                    <filter id="shadow-legend">
                      <feDropShadow dx="0" dy="2" stdDeviation="3" flood-opacity="0.15"/>
                    </filter>
                  </defs>
                  <rect x="0" y="0" width="60" height="32" rx="16" fill="white" stroke="#ff3131" stroke-width="2" filter="url(#shadow-legend)"/>
                  <path d="M 26 32 L 30 40 L 34 32 Z" fill="#ff3131"/>
                </svg>
              </div>
              <span className="text-gray-800 font-medium text-sm">Visited Restaurants</span>
            </div>
          </div>
        )}
      </div>

      {/* Restaurant Details Modal */}
      {showModal && selectedRestaurant && (
        <UserRestaurantModal
          restaurant={selectedRestaurant}
          isOpen={showModal}
          onClose={handleCloseModal}
        />
      )}
    </>
  );
};

export default UserJourneyMap;
