import React, { useState, useEffect } from 'react';
import { MapIcon, PlusIcon, MapPinIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
import HamburgerMenu from '../components/HamburgerMenu';
import FeedPost from '../components/FeedPost';
import { fetchReviews, convertReviewsToFeedPosts, FirebaseReview } from '../services/reviewService';
import { getUserProfile, getCurrentUser } from '../lib/firebase';

const Home: React.FC = () => {
  const [firebaseReviews, setFirebaseReviews] = useState<FirebaseReview[]>([]);
  const [feedPosts, setFeedPosts] = useState<any[]>([]);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Fetch user profile on component mount
  useEffect(() => {
    const loadUserProfile = async () => {
      try {
        setProfileLoading(true);
        const currentUser = getCurrentUser();
        
        if (currentUser) {
          const result = await getUserProfile();
          if (result.success && result.profile) {
            setUserProfile(result.profile);
          }
        }
      } catch (err) {
        console.error('Failed to load user profile:', err);
      } finally {
        setProfileLoading(false);
      }
    };

    loadUserProfile();
  }, []);
  
  // Fetch reviews from Firebase on component mount
  useEffect(() => {
    const loadReviews = async () => {
      try {
        setLoading(true);
        const reviews = await fetchReviews(20);
        setFirebaseReviews(reviews);
        
        // Convert Firebase reviews to feed post format with real user data
        const posts = await convertReviewsToFeedPosts(reviews);
        setFeedPosts(posts);
        
        setError(null);
      } catch (err) {
        console.error('Failed to load reviews:', err);
        setError('Failed to load reviews');
        setFeedPosts([]); // Fallback to empty array
      } finally {
        setLoading(false);
      }
    };
    
    loadReviews();
  }, []);

  // Default profile picture and stats calculation
  const defaultAvatar = "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face";
  
  const userStats = userProfile?.stats ? {
    averageRating: userProfile.stats.averageRating.toFixed(1),
    totalRestaurants: userProfile.stats.totalRestaurants,
    totalDishes: firebaseReviews.length, // Use actual review count for dishes
    pointsEarned: userProfile.stats.pointsEarned
  } : {
    averageRating: "0.0",
    totalRestaurants: 0,
    totalDishes: 0,
    pointsEarned: 0
  };

  // Get user's recent reviews for personal section
  const userRecentReviews = feedPosts
    .filter(post => post.userId === getCurrentUser()?.uid)
    .slice(0, 3);

  const handleVisitClick = (visitId: number) => {
    console.log(`Navigate to post ${visitId}`);
  };

  const handleAddNote = (visitId: number) => {
    console.log(`Add note for visit ${visitId}`);
  };

  // Empty state for new users
  const EmptyState = () => (
    <div className="text-center py-12 px-4">
      <div className="mb-6">
        <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <PlusIcon size={32} className="text-gray-400" />
        </div>
        <h3 className="text-xl font-semibold text-gray-900 mb-2">Start Your Food Journey!</h3>
        <p className="text-gray-600 mb-6 max-w-sm mx-auto">
          Create your first review to start tracking your favorite dishes and restaurants.
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
  if (loading || profileLoading) {
    return (
      <div className="min-h-screen bg-light-gray flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your food journey...</p>
        </div>
      </div>
    );
  }
  
  // If no Firebase reviews and no user reviews, show empty state
  if (firebaseReviews.length === 0 && userRecentReviews.length === 0 && !loading) {
    return (
      <div className="min-h-screen bg-light-gray">
        <header className="bg-white sticky top-0 z-10 shadow-sm">
          <div className="flex justify-between items-center px-4 py-1">
            <img 
              src="/images/tip-logo.png" 
              alt="Tip Logo" 
              className="h-[80px] w-auto object-contain"
            />      
            <HamburgerMenu />
          </div>
        </header>
        <EmptyState />
      </div>
    );
  }

  // Food Map content for users with reviews
  return (
    <div className="min-h-screen bg-gray-50 pb-16">
      {/* Header */}
      <div className="bg-white px-4 py-6 shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center">
            <MapIcon size={28} className="text-secondary mr-3" />
            <div>
              <h1 className="text-2xl font-bold text-black">My Food Map</h1>
              <p className="text-gray-600"></p>
            </div>
          </div>
          <div className="flex items-center">
            <div className="bg-primary text-white px-3 py-1 rounded-full text-sm font-semibold mr-3">
              {userStats.pointsEarned} 🪙
            </div>
            <img 
              src={userProfile?.avatar || defaultAvatar} 
              alt="Profile" 
              className="w-12 h-12 rounded-full border-2 border-gray-200"
            />
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

        {/* Your Food Journey Section */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
          <h2 className="text-lg font-bold text-black mb-4">Your Food Journey</h2>
          <div className="h-64 bg-gray-100 rounded-lg flex items-center justify-center mb-4">
            <div className="text-center">
              <MapIcon size={48} className="text-gray-400 mx-auto mb-2" />
              <p className="text-gray-600 font-medium">Interactive map coming soon!</p>
              <p className="text-sm text-gray-500">See all your visited restaurants on a map</p>
            </div>
          </div>

          {/* List View Button */}
          <div className="text-center">
            <Link 
              to="/list-view"
              className="inline-block bg-gray-100 text-red-500 px-6 py-2 rounded-lg font-medium hover:bg-gray-200 transition-colors"
            >
              List View
            </Link>
          </div>
        </div>

        {/* Community Feed Section */}
        <div className="space-y-4">
          {/* Section Header */}
          <h2 className="text-lg font-bold text-black">Community Feed</h2>
          
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
              <p className="text-red-600">{error}</p>
              <button 
                onClick={() => window.location.reload()} 
                className="mt-2 text-red-600 underline"
              >
                Retry
              </button>
            </div>
          )}
          
          {/* Feed Posts */}
          {feedPosts.length > 0 ? (
            <div className="space-y-4">
              {feedPosts.map(post => (
                <FeedPost key={post.id} {...post} />
              ))}
            </div>
          ) : !loading && !error && (
            <div className="text-center py-12 px-4">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <PlusIcon size={24} className="text-gray-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No Reviews Yet</h3>
              <p className="text-gray-600 mb-6">Be the first to share a review!</p>
              <Link 
                to="/create" 
                className="inline-block bg-primary text-white py-2 px-6 rounded-full font-medium hover:bg-red-600 transition-colors"
              >
                Create First Review
              </Link>
            </div>
          )}
        </div>
        
        {/* Personal Reviews Section */}
        {userRecentReviews.length > 0 && (
          <div className="space-y-4 mt-8">
            <h2 className="text-lg font-bold text-black">Your Recent Reviews</h2>
            {userRecentReviews.map((post) => (
              <div 
                key={post.id}
                className="bg-white rounded-xl shadow-sm p-4"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center mb-1">
                      <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center mr-3">
                        <span className="text-white font-bold text-sm">{post.dish.rating}</span>
                      </div>
                      <div>
                        <h3 className="font-bold text-black">{post.restaurant.name}</h3>
                        <p className="text-sm text-gray-600 flex items-center">
                          <MapPinIcon size={14} className="text-red-500 mr-1" />
                          {post.location} ✓
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="text-right flex flex-col items-end">
                    <p className="text-sm text-gray-500">{post.review.date}</p>
                    <div className="bg-primary text-white px-2 py-1 rounded-full text-xs font-semibold mt-1">
                      +200🪙
                    </div>
                  </div>
                </div>
                <div className="ml-11">
                  <h4 className="font-medium text-black mb-1">{post.dish.name}</h4>
                  <div className="bg-green-100 text-green-800 p-3 rounded-lg text-sm italic">
                    {post.review.positive}
                  </div>
                </div>
              </div>
            ))}
            <div className="text-center">
              <Link 
                to="/profile"
                className="text-primary font-medium hover:underline"
              >
                View all your reviews →
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Home;