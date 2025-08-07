import React, { useState, useEffect } from 'react';
import { MapIcon, PlusIcon, MapPinIcon, Star } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import HamburgerMenu from '../components/HamburgerMenu';
import FeedPost from '../components/FeedPost';
import { fetchReviews, convertReviewsToFeedPosts, fetchUserReviews, FirebaseReview } from '../services/reviewService';
import { getUserProfile, getCurrentUser } from '../lib/firebase';

const Home: React.FC = () => {
  const navigate = useNavigate();
  const [firebaseReviews, setFirebaseReviews] = useState<FirebaseReview[]>([]);
  const [userReviews, setUserReviews] = useState<FirebaseReview[]>([]);
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
        const currentUser = getCurrentUser();
        
        // Load global reviews for community feed
        const reviews = await fetchReviews(20);
        setFirebaseReviews(reviews);
        
        // Load user-specific reviews for stats calculation
        if (currentUser) {
          const userReviewsData = await fetchUserReviews(50);
          setUserReviews(userReviewsData);
        } else {
          setUserReviews([]);
        }
        
        // Convert Firebase reviews to feed post format with real user data
        const posts = await convertReviewsToFeedPosts(reviews);
        setFeedPosts(posts);
        
        setError(null);
      } catch (err) {
        console.error('Failed to load reviews:', err);
        setError('Failed to load reviews');
        setFeedPosts([]); // Fallback to empty array
        setUserReviews([]); // Fallback to empty array
      } finally {
        setLoading(false);
      }
    };
    
    loadReviews();
  }, []);

  // Calculate user stats from their own reviews and profile data
  const currentUser = getCurrentUser();
  const userStats = currentUser ? {
    averageRating: userProfile?.stats?.averageRating 
      ? userProfile.stats.averageRating.toFixed(1) 
      : userReviews.length > 0 
        ? (userReviews.reduce((sum, review) => sum + review.rating, 0) / userReviews.length).toFixed(1)
        : "0.0",
    totalRestaurants: userProfile?.stats?.totalRestaurants || new Set(userReviews.map(r => r.restaurant).filter(Boolean)).size,
    totalDishes: userReviews.length, // Use user's actual review count for dishes
    pointsEarned: userProfile?.stats?.pointsEarned || 0
  } : {
    // Default stats for unauthenticated users
    averageRating: "0.0",
    totalRestaurants: 0,
    totalDishes: 0,
    pointsEarned: 0
  };

  // Get user's recent reviews for personal section (use actual user reviews)
  const userRecentReviews = userReviews.slice(0, 3);

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

  // Always show the full Home dashboard (stats, map, community feed)
  return (
    <div className="min-h-screen bg-gray-50 pb-16">
      {/* Header */}
      <div className="bg-white px-4 py-3 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <img 
              src="/images/tip-logo.png" 
              alt="Tip" 
              className="w-32 h-18 object-contain"
            />
          </div>
          <div className="flex items-center">
            <div 
              className="bg-white rounded-2xl shadow-sm border border-gray-100 px-4 py-2 mr-3 cursor-pointer hover:shadow-md transition-shadow flex items-center"
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
            <HamburgerMenu />
          </div>
        </div>
      </div>

      <div className="px-4 py-6">

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
            <div 
              className="inline-flex items-center bg-white rounded-2xl shadow-sm border border-gray-100 px-6 py-3 cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => navigate('/list-view')}
            >
              <MapPinIcon size={20} className="text-secondary mr-3" />
              <span className="text-primary font-medium">Recent Visits</span>
            </div>
          </div>
        </div>

        {/* Recent Activity from Friends Button */}
        <div 
          className="bg-white rounded-xl shadow-sm p-4 mb-6 cursor-pointer hover:shadow-md transition-shadow flex items-center justify-between"
          onClick={() => navigate('/recent-activity')}
        >
          <div className="flex items-center">
            <div className="text-lg font-bold text-black">Recent Activity from Friends</div>
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
      </div>
    </div>
  );
};

export default Home;