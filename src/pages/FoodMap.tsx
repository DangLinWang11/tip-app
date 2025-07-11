import React, { useState, useEffect } from 'react';
import { MapIcon, TrendingUpIcon, StarIcon, ClockIcon, MessageCircleIcon, PlusIcon, MapPinIcon, ArrowLeft, Star } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { fetchReviews, convertReviewsToFeedPosts, FirebaseReview } from '../services/reviewService';
import { getUserProfile, getCurrentUser } from '../lib/firebase';

const FoodMap: React.FC = () => {
  const navigate = useNavigate();
  const [userReviews, setUserReviews] = useState<any[]>([]);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  // Load user data on component mount
  useEffect(() => {
    const loadUserData = async () => {
      try {
        setLoading(true);
        const currentUser = getCurrentUser();
        
        if (currentUser) {
          // Get user profile
          const profileResult = await getUserProfile();
          if (profileResult.success && profileResult.profile) {
            setUserProfile(profileResult.profile);
          }
          
          // Get all reviews and filter for current user
          const allReviews = await fetchReviews(100);
          const posts = await convertReviewsToFeedPosts(allReviews);
          const userPosts = posts.filter(post => post.userId === currentUser.uid);
          setUserReviews(userPosts);
        }
      } catch (err) {
        console.error('Failed to load user data:', err);
      } finally {
        setLoading(false);
      }
    };

    loadUserData();
  }, []);
  
  // Default profile picture and stats calculation
  const defaultAvatar = "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face";
  
  const userStats = userProfile?.stats ? {
    averageRating: userProfile.stats.averageRating.toFixed(1),
    totalRestaurants: userProfile.stats.totalRestaurants,
    totalDishes: userReviews.length,
    pointsEarned: userProfile.stats.pointsEarned
  } : {
    averageRating: "0.0",
    totalRestaurants: 0,
    totalDishes: 0,
    pointsEarned: 0
  };

  const handleVisitClick = (visitId: number) => {
    console.log(`Navigate to post ${visitId}`);
  };

  const handleAddNote = (visitId: number) => {
    console.log(`Add note for visit ${visitId}`);
  };

  // Empty state for users with no reviews
  const EmptyState = () => (
    <div className="text-center py-12 px-4">
      <div className="mb-6">
        <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <PlusIcon size={32} className="text-gray-400" />
        </div>
        <h3 className="text-xl font-semibold text-gray-900 mb-2">You haven't posted anything yet</h3>
        <p className="text-gray-600 mb-6 max-w-sm mx-auto">
          Start your food journey by creating your first review!
        </p>
      </div>
      
      <div className="space-y-3 max-w-xs mx-auto">
        <Link 
          to="/create" 
          className="block w-full bg-primary text-white py-3 px-6 rounded-full font-medium hover:bg-red-600 transition-colors"
        >
          Add Your First Review
        </Link>
        <Link 
          to="/discover" 
          className="block w-full border border-gray-300 text-gray-700 py-3 px-6 rounded-full font-medium hover:bg-gray-50 transition-colors flex items-center justify-center"
        >
          <MapIcon size={18} className="mr-2" />
          Discover Restaurants
        </Link>
      </div>
    </div>
  );

  // Show loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your food journey...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="bg-white px-4 py-6 shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center">
            <button 
              onClick={() => navigate('/')}
              className="mr-3 p-2 hover:bg-gray-100 rounded-full transition-colors"
            >
              <ArrowLeft size={24} className="text-gray-600" />
            </button>
            <MapPinIcon size={28} className="text-secondary mr-3" />
            <div>
              <h1 className="text-2xl font-bold text-primary">Recent Visits</h1>
            </div>
          </div>
          <div className="flex items-center">
            <div 
              className="bg-white rounded-2xl shadow-sm border border-gray-100 px-4 py-2 cursor-pointer hover:shadow-md transition-shadow flex items-center"
              onClick={() => navigate('/rewards')}
            >
              <span className="font-bold text-sm mr-2" style={{ color: '#FFD700' }}>
                {userStats.pointsEarned}
              </span>
              <div 
                className="w-5 h-5 rounded-full flex items-center justify-center"
                style={{ backgroundColor: '#FFD700' }}
              >
                <div 
                  className="w-3.5 h-3.5 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: '#F59E0B' }}
                >
                  <Star 
                    size={8} 
                    style={{ 
                      color: '#FFD700', 
                      fill: '#FFD700'
                    }} 
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="px-4 py-6">
        <div className="grid grid-cols-4 gap-3 mb-6">
          <div className="bg-white rounded-xl p-3 shadow-sm text-center">
            <p className="text-2xl font-bold text-primary">{userStats.averageRating}</p>
            <p className="text-xs text-gray-500 font-medium">Average Rating</p>
          </div>
          <div className="bg-white rounded-xl p-3 shadow-sm text-center">
            <p className="text-2xl font-bold text-primary">{userStats.totalRestaurants}</p>
            <p className="text-xs text-gray-500 font-medium">Restaurants</p>
          </div>
          <div className="bg-white rounded-xl p-3 shadow-sm text-center">
            <p className="text-2xl font-bold text-primary">{userStats.totalDishes}</p>
            <p className="text-xs text-gray-500 font-medium">Dishes</p>
          </div>
          <div className="bg-white rounded-xl p-3 shadow-sm text-center">
            <p className="text-2xl font-bold text-primary">{userStats.pointsEarned}</p>
            <p className="text-xs text-gray-500 font-medium">Points Earned</p>
          </div>
        </div>

        {/* If user has no reviews, show empty state */}
        {userReviews.length === 0 ? (
          <EmptyState />
        ) : (
          <>
            {/* Recent Visits Content */}
              <div className="space-y-4">
                {/* Search Bar */}
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Search places or items..."
                    className="w-full bg-gray-100 rounded-full py-3 px-4 pl-10 text-gray-700"
                  />
                  <div className="absolute left-3 top-1/2 transform -translate-y-1/2">
                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                </div>

                {/* Recent Visits List */}
                {userReviews.map((visit, index) => (
                  <div 
                    key={visit.id || index}
                    onClick={() => handleVisitClick(index)}
                    className="bg-white rounded-xl shadow-sm p-4 cursor-pointer hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <div className="flex items-center mb-1">
                          <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center mr-3">
                            <span className="text-white font-bold text-sm">{visit.dish?.rating || 0}</span>
                          </div>
                          <div>
                            <h3 className="font-bold text-black">{visit.restaurant?.name || 'Unknown Restaurant'}</h3>
                            <p className="text-sm text-gray-600 flex items-center">
                              <MapPinIcon size={14} className="text-red-500 mr-1" />
                              {visit.location || 'Unknown Location'} ✓
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 mb-2 ml-11">
                          <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded-full text-xs">
                            Tried 1x
                          </span>
                          <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded-full text-xs">
                            Visited 1x
                          </span>
                        </div>
                      </div>
                      <div className="text-right flex flex-col items-end">
                        <p className="text-sm text-gray-500">{visit.review?.date || 'Recently'}</p>
                        <div className="bg-primary text-white px-2 py-1 rounded-full text-xs font-semibold mt-1">
                          +200🪙
                        </div>
                        <p className="text-xs text-gray-400 mt-1">Review bonus</p>
                      </div>
                    </div>

                    {/* Personal Note */}
                    <div className="ml-11">
                      {visit.review?.positive ? (
                        <div className="space-y-2">
                          <p className="text-xs text-gray-500">Personal Comment:</p>
                          <div className="bg-green-100 text-green-800 p-3 rounded-lg text-sm italic">
                            {visit.review.positive}
                          </div>
                          <div className="flex items-center bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                            <input
                              type="text"
                              placeholder="Add another personal note..."
                              className="flex-1 bg-transparent text-sm text-gray-600 placeholder-gray-400 border-none outline-none"
                            />
                            <PlusIcon size={16} className="text-gray-400" />
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <p className="text-xs text-gray-500">Personal Comment:</p>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleAddNote(index);
                            }}
                            className="flex items-center bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 w-full text-left hover:bg-gray-100"
                          >
                            <span className="text-sm text-gray-500 mr-2">Add personal note...</span>
                            <PlusIcon size={16} className="text-gray-400" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
          </>
        )}
      </div>
    </div>
  );
};

export default FoodMap;