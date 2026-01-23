import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Store } from 'lucide-react';
import { getUserVisitedRestaurants, UserVisitedRestaurant } from '../services/reviewService';
import { getUserByUsername } from '../lib/firebase';

// Simple cache for restaurant data to enable instant "back" navigation
let cachedRestaurantData: {
  username: string;
  userId: string;
  restaurants: UserVisitedRestaurant[];
  timestamp: number;
} | null = null;

const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

const UserRestaurants: React.FC = () => {
  const { username } = useParams<{ username: string }>();
  const navigate = useNavigate();

  const [restaurants, setRestaurants] = useState<UserVisitedRestaurant[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  // Load user ID from username
  useEffect(() => {
    const loadUserId = async () => {
      if (!username) return;
      try {
        const result = await getUserByUsername(username);
        if (result.success && result.profile) {
          setUserId(result.profile.uid);
        } else {
          setLoading(false);
        }
      } catch (error) {
        console.error('Error loading user:', error);
        setLoading(false);
      }
    };
    loadUserId();
  }, [username]);

  // Load restaurants data
  useEffect(() => {
    const loadRestaurants = async () => {
      if (!userId || !username) return;

      // Check if we have valid cached data for this user
      const now = Date.now();
      if (cachedRestaurantData &&
          cachedRestaurantData.username === username &&
          cachedRestaurantData.userId === userId &&
          (now - cachedRestaurantData.timestamp) < CACHE_DURATION) {
        // Use cached data immediately for instant display
        setRestaurants(cachedRestaurantData.restaurants);
        setLoading(false);
        // Still fetch fresh data in background, but don't show loading state
      } else {
        // No cache available, show loading state
        setLoading(true);
      }

      // Fetch fresh data (either as background refresh or initial load)
      try {
        const data = await getUserVisitedRestaurants(userId);
        // Sort by visit count (most visited first)
        data.sort((a, b) => b.visitCount - a.visitCount);
        setRestaurants(data);

        // Update cache
        cachedRestaurantData = {
          username,
          userId,
          restaurants: data,
          timestamp: Date.now()
        };
      } catch (error) {
        console.error('Error loading restaurants:', error);
      } finally {
        setLoading(false);
      }
    };

    loadRestaurants();
  }, [userId, username]);

  // Restaurant list item component
  const RestaurantListItem: React.FC<{ restaurant: UserVisitedRestaurant }> = ({
    restaurant
  }) => {
    return (
      <button
        onClick={() => navigate(`/restaurant/${restaurant.id}`)}
        className="w-full flex items-center p-4 hover:bg-gray-50 transition-colors text-left"
      >
        {/* Restaurant info */}
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-gray-900 truncate">{restaurant.name}</h3>
          <div className="flex items-center text-sm text-gray-500 mt-0.5">
            {restaurant.cuisine && restaurant.cuisine !== 'Restaurant' && (
              <>
                <span className="truncate">{restaurant.cuisine}</span>
                <span className="mx-1">·</span>
              </>
            )}
            <span>
              {restaurant.reviewCount} {restaurant.reviewCount === 1 ? 'review' : 'reviews'}
            </span>
            <span className="mx-1">·</span>
            <span>
              {restaurant.visitCount} {restaurant.visitCount === 1 ? 'visit' : 'visits'}
            </span>
          </div>
        </div>

        {/* Average rating */}
        <div className="ml-2">
          <span className="text-base font-bold text-primary">
            {restaurant.averageRating.toFixed(1)}
          </span>
        </div>
      </button>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white px-4 py-3 sticky top-0 z-10 shadow-sm">
        <div className="flex items-center">
          <button
            onClick={() => navigate(-1)}
            className="p-2 -ml-2 rounded-full hover:bg-gray-100 transition-colors"
          >
            <ArrowLeft size={24} className="text-gray-700" />
          </button>
          <h1 className="ml-2 text-lg font-semibold text-gray-900">
            Restaurants
          </h1>
        </div>
      </header>

      {/* Subheader */}
      <div className="bg-white px-4 py-3 border-b border-gray-100">
        <p className="text-sm text-gray-500">
          {!loading && restaurants.length > 0
            ? `${restaurants.length} ${restaurants.length === 1 ? 'restaurant' : 'restaurants'} reviewed by @${username}`
            : `Restaurants reviewed by @${username}`}
        </p>
      </div>

      {/* Restaurant list */}
      <div className="bg-white mt-2">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : restaurants.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-gray-500">
            <Store size={48} className="mb-2 text-gray-300" />
            <p>No restaurants reviewed yet</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {restaurants.map(restaurant => (
              <RestaurantListItem key={restaurant.id} restaurant={restaurant} />
            ))}
          </div>
        )}
      </div>

    </div>
  );
};

export default UserRestaurants;
