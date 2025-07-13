import React, { useState, useEffect } from 'react';
import { EditIcon, GridIcon, BookmarkIcon, SearchIcon, PlusIcon, Star } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import FeedPost from '../components/FeedPost';
import HamburgerMenu from '../components/HamburgerMenu';
import { useFeature } from '../utils/features';
import { fetchUserReviews, convertUserReviewsToFeedPosts, FirebaseReview } from '../services/reviewService';
import { getUserProfile, UserProfile, getCurrentUser } from '../lib/firebase';
import { getInitials } from '../utils/avatarUtils';

const Profile: React.FC = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'activity' | 'saved'>('activity');
  const [searchTerm, setSearchTerm] = useState('');
  const [firebaseReviews, setFirebaseReviews] = useState<FirebaseReview[]>([]);
  const [feedPosts, setFeedPosts] = useState<any[]>([]);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Feature flags
  const showTierRankings = useFeature('TIER_RANKINGS');
  const showSocialActivity = useFeature('SOCIAL_FEED');
  
  // Fetch user profile on component mount
  useEffect(() => {
    const loadUserProfile = async () => {
      try {
        setProfileLoading(true);
        const currentUser = getCurrentUser();
        
        if (!currentUser) {
          setError('No authenticated user found');
          return;
        }

        const result = await getUserProfile();
        if (result.success && result.profile) {
          setUserProfile(result.profile);
        } else {
          setError(result.error || 'Failed to load user profile');
        }
      } catch (err) {
        console.error('Failed to load user profile:', err);
        setError('Failed to load user profile');
      } finally {
        setProfileLoading(false);
      }
    };

    loadUserProfile();
  }, []);
  
  // Fetch current user's reviews from Firebase on component mount
  useEffect(() => {
    const loadUserReviews = async () => {
      try {
        setLoading(true);
        const currentUser = getCurrentUser();
        
        if (!currentUser) {
          console.log('No authenticated user found for reviews');
          setFirebaseReviews([]);
          setFeedPosts([]);
          return;
        }

        const reviews = await fetchUserReviews(50);
        setFirebaseReviews(reviews);
        
        // Convert current user's reviews to feed post format
        const posts = await convertUserReviewsToFeedPosts(reviews);
        setFeedPosts(posts);
      } catch (err) {
        console.error('Failed to load user reviews:', err);
        setFirebaseReviews([]);
        setFeedPosts([]);
      } finally {
        setLoading(false);
      }
    };
    
    loadUserReviews();
  }, []);

  // Filter posts based on search term
  const filteredPosts = feedPosts.filter(post => 
    searchTerm === '' || 
    post.dish.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    post.restaurant?.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Calculate personal stats from Firebase reviews and user profile
  const personalStats = {
    totalReviews: userProfile?.stats?.totalReviews || firebaseReviews.length,
    restaurantsTried: userProfile?.stats?.totalRestaurants || new Set(firebaseReviews.map(r => r.restaurant).filter(Boolean)).size,
    averageRating: userProfile?.stats?.averageRating || (firebaseReviews.length > 0 
      ? parseFloat((firebaseReviews.reduce((sum, r) => sum + r.rating, 0) / firebaseReviews.length).toFixed(1))
      : 0),
    pointsEarned: userProfile?.stats?.pointsEarned || 0
  };

  // Avatar component with initials fallback
  const UserAvatar: React.FC<{ size?: 'sm' | 'md' | 'lg' }> = ({ size = 'lg' }) => {
    const [imageError, setImageError] = useState(false);
    
    const sizeClasses = {
      sm: 'w-8 h-8 text-sm',
      md: 'w-12 h-12 text-base',
      lg: 'w-20 h-20 text-xl'
    };

    // Reset image error when userProfile.avatar changes
    React.useEffect(() => {
      setImageError(false);
    }, [userProfile?.avatar]);

    // Show real profile photo if it exists, is not empty, and hasn't failed to load
    if (userProfile?.avatar && userProfile.avatar.trim() !== '' && !imageError) {
      return (
        <img 
          src={userProfile.avatar} 
          alt={userProfile.displayName || userProfile.username} 
          className={`${sizeClasses[size]} rounded-full object-cover border-2 border-primary`}
          onError={() => {
            // If image fails to load, show initials fallback
            setImageError(true);
          }}
        />
      );
    }

    // Fallback to initials for users without profile photos or failed image loads
    return (
      <div className={`${sizeClasses[size]} rounded-full bg-primary flex items-center justify-center border-2 border-primary`}>
        <span className="text-white font-semibold">
          {getInitials(userProfile.username, userProfile.displayName)}
        </span>
      </div>
    );
  };

  // Loading state
  if (profileLoading) {
    return (
      <div className="min-h-screen bg-light-gray flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading profile...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !userProfile) {
    return (
      <div className="min-h-screen bg-light-gray flex items-center justify-center">
        <div className="text-center p-4">
          <h2 className="text-xl font-bold text-gray-900 mb-2">Profile Error</h2>
          <p className="text-gray-600 mb-4">{error || 'Unable to load profile'}</p>
          <button 
            onClick={() => window.location.reload()} 
            className="bg-primary text-white px-4 py-2 rounded-lg hover:bg-red-600 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-light-gray pb-16">
      <header className="bg-white p-4 sticky top-0 z-10 shadow-sm">
        <div className="flex justify-between items-center">
          <h1 className="text-xl font-semibold">My Profile</h1>
          <div className="flex items-center">
            <div 
              className="bg-white rounded-2xl shadow-sm border border-gray-100 px-4 py-2 mr-3 cursor-pointer hover:shadow-md transition-shadow flex items-center"
              onClick={() => navigate('/rewards')}
            >
              <span className="font-bold text-sm mr-2" style={{ color: '#FFD700' }}>
                {personalStats.pointsEarned}
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
      </header>

      <div className="bg-white shadow-sm">
        <div className="p-4">
          <div className="flex items-center">
            <UserAvatar size="lg" />
            <div className="ml-4 flex-1">
              <div className="flex items-center">
                <h2 className="font-semibold text-lg">@{userProfile.username}</h2>
                {userProfile.isVerified && (
                  <span className="ml-2 text-blue-500" title="Verified user">✓</span>
                )}
              </div>
              {userProfile.displayName && userProfile.displayName !== userProfile.username && (
                <p className="text-sm text-gray-600">{userProfile.displayName}</p>
              )}
              {userProfile.bio && (
                <p className="text-sm text-gray-600 mt-1">{userProfile.bio}</p>
              )}
              
              {/* Join Date */}
              {userProfile.createdAt && (
                <p className="text-xs text-gray-500 mt-1">
                  Joined {new Date(userProfile.createdAt.seconds * 1000).toLocaleDateString('en-US', { 
                    month: 'long', 
                    year: 'numeric' 
                  })}
                </p>
              )}

              {/* MVP Stats - Personal Only */}
              <div className="flex text-sm text-dark-gray mt-2">
                <span className="mr-4">{personalStats.totalReviews} Reviews</span>
                <span className="mr-4">{personalStats.restaurantsTried} Restaurants</span>
                <span className="mr-4">{personalStats.averageRating.toFixed(1)} Avg Rating</span>
                {personalStats.pointsEarned > 0 && (
                  <span>{personalStats.pointsEarned} Points</span>
                )}
              </div>
              
              <button className="mt-2 px-4 py-1 border border-medium-gray rounded-full text-sm flex items-center">
                <EditIcon size={16} className="mr-1" />
                Edit Profile
              </button>
            </div>
          </div>
        </div>


        {/* Tier Rankings Section - Coming Soon */}
        {showTierRankings && (
          <div className="px-4 py-3 border-t border-light-gray">
            <div className="text-center py-4">
              <div className="text-2xl mb-2">🏆</div>
              <p className="text-sm text-gray-600">Tier Rankings Coming Soon!</p>
              <p className="text-xs text-gray-500">See your top dishes and restaurants</p>
            </div>
          </div>
        )}

        <div className="flex border-t border-light-gray">
          <button 
            className={`flex-1 py-3 flex justify-center items-center ${
              activeTab === 'activity' 
                ? 'border-b-2 border-primary text-primary' 
                : 'text-dark-gray'
            }`} 
            onClick={() => setActiveTab('activity')}
          >
            <GridIcon size={18} className="mr-1" />
            <span>My Reviews</span>
          </button>
          <button 
            className={`flex-1 py-3 flex justify-center items-center ${
              activeTab === 'saved' 
                ? 'border-b-2 border-primary text-primary' 
                : 'text-dark-gray'
            }`} 
            onClick={() => setActiveTab('saved')}
          >
            <BookmarkIcon size={18} className="mr-1" />
            <span>Saved</span>
          </button>
        </div>
      </div>

      {activeTab === 'activity' ? (
        <div className="p-4">
          {/* Search Bar */}
          <div className="relative mb-4">
            <SearchIcon size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-dark-gray" />
            <input
              type="text"
              placeholder="Search your reviews"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-medium-gray rounded-full text-sm focus:outline-none focus:border-primary"
            />
          </div>

          {/* Personal Reviews */}
          {loading ? (
            <div className="text-center py-8">
              <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-gray-600">Loading reviews...</p>
            </div>
          ) : filteredPosts.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <GridIcon size={24} className="text-gray-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                {searchTerm ? 'No matching reviews' : 'No reviews yet'}
              </h3>
              <p className="text-gray-600 mb-6">
                {searchTerm 
                  ? 'Try searching for different dishes or restaurants' 
                  : 'Start reviewing your favorite dishes to build your food journey'
                }
              </p>
              {!searchTerm && (
                <Link 
                  to="/create" 
                  className="inline-flex items-center bg-primary text-white px-6 py-3 rounded-full font-medium hover:bg-red-600 transition-colors"
                >
                  <PlusIcon size={18} className="mr-2" />
                  Add Your First Review
                </Link>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {filteredPosts.map(post => (
                <FeedPost key={post.id} {...post} />
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="p-4">
          <h3 className="font-semibold mb-3">Saved Reviews</h3>
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <BookmarkIcon size={24} className="text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">Saved Lists Coming Soon!</h3>
            <p className="text-gray-600 mb-6">
              Save your favorite restaurants and dishes to custom lists
            </p>
            <div className="grid grid-cols-2 gap-3 max-w-xs mx-auto">
              <button className="py-4 border border-dashed border-gray-300 rounded-xl flex flex-col items-center justify-center">
                <PlusIcon size={20} className="mb-1 text-gray-400" />
                <span className="text-sm text-gray-500">Restaurant List</span>
              </button>
              <button className="py-4 border border-dashed border-gray-300 rounded-xl flex flex-col items-center justify-center">
                <PlusIcon size={20} className="mb-1 text-gray-400" />
                <span className="text-sm text-gray-500">Menu Items</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Profile;