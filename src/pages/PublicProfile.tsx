import React, { useState, useEffect } from 'react';
import { ArrowLeftIcon, MapPinIcon, SearchIcon, PlusIcon, CheckIcon, EditIcon, Share, User, Star, Users, TrendingUp } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import FeedPost from '../components/FeedPost';
import { fetchUserReviews, convertReviewsToFeedPosts, FirebaseReview } from '../services/reviewService';
import { getFollowCounts, isFollowing, followUser, unfollowUser } from '../services/followService';
import { getUserProfile, getCurrentUser, getUserByUsername } from '../lib/firebase';

const PublicProfile: React.FC = () => {
  const navigate = useNavigate();
  const { username } = useParams<{ username: string }>();
  const [userProfile, setUserProfile] = useState<any>(null);
  const [userReviews, setUserReviews] = useState<FirebaseReview[]>([]);
  const [feedPosts, setFeedPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'reviews' | 'saved'>('reviews');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Follow state
  const [isFollowingUser, setIsFollowingUser] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [followerCount, setFollowerCount] = useState(0);
  
  const currentUser = getCurrentUser();
  const isOwnProfile = currentUser?.displayName === username || currentUser?.email?.split('@')[0] === username;

  useEffect(() => {
    if (username) {
      loadUserProfile();
    }
  }, [username]);

  const loadUserProfile = async () => {
    try {
      setLoading(true);
      
      if (!username) {
        setError('Username is required');
        return;
      }
      
      // Get user profile by username
      const profileResult = await getUserByUsername(username);
      
      if (profileResult.success && profileResult.profile) {
        setUserProfile(profileResult.profile);
        
        // Load user's reviews using the profile's uid
        const reviews = await fetchUserReviews(50, profileResult.profile.uid);
        setUserReviews(reviews);
        
        // Convert to feed posts
        const posts = await convertReviewsToFeedPosts(reviews);
        setFeedPosts(posts);
        
        // Get follow counts and status using the profile's uid
        const counts = await getFollowCounts(profileResult.profile.uid);
        setFollowerCount(counts.followers);
        
        if (!isOwnProfile) {
          const following = await isFollowing(profileResult.profile.uid);
          setIsFollowingUser(following);
        }
      } else {
        setError(profileResult.error || 'User not found');
      }
    } catch (err) {
      console.error('Failed to load user profile:', err);
      setError('Failed to load user profile');
    } finally {
      setLoading(false);
    }
  };

  const handleFollowToggle = async () => {
    if (followLoading || isOwnProfile || !userProfile?.uid) return;

    setFollowLoading(true);
    try {
      if (isFollowingUser) {
        const success = await unfollowUser(userProfile.uid);
        if (success) {
          setIsFollowingUser(false);
          setFollowerCount(prev => prev - 1);
        }
      } else {
        const success = await followUser(userProfile.uid, userProfile.username || userProfile.displayName);
        if (success) {
          setIsFollowingUser(true);
          setFollowerCount(prev => prev + 1);
        }
      }
    } catch (error) {
      console.error('Error toggling follow:', error);
    } finally {
      setFollowLoading(false);
    }
  };

  const handleShareProfile = async () => {
    try {
      const shareUrl = `${window.location.origin}/profile/${username}`;
      const shareData = {
        title: `Check out @${username} on Tip!`,
        text: `Check out @${username}'s food reviews and recommendations on Tip!`,
        url: shareUrl
      };

      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        // Fallback: copy to clipboard
        await navigator.clipboard.writeText(shareUrl);
        alert('Profile link copied to clipboard!');
      }
    } catch (err) {
      console.error('Failed to share profile:', err);
      // Fallback for clipboard failures
      try {
        const shareUrl = `${window.location.origin}/profile/${username}`;
        await navigator.clipboard.writeText(shareUrl);
        alert('Profile link copied to clipboard!');
      } catch {
        alert('Unable to share profile. Please try again.');
      }
    }
  };

  // Filter posts based on search query
  const filteredPosts = feedPosts.filter(post => {
    if (!searchQuery) return true;
    const searchLower = searchQuery.toLowerCase();
    
    // Search in dish name, restaurant name, and review content
    const matchesDish = post.dish?.name?.toLowerCase().includes(searchLower);
    const matchesRestaurant = post.restaurant?.name?.toLowerCase().includes(searchLower);
    const matchesReview = post.review?.positive?.toLowerCase().includes(searchLower) ||
                         post.review?.negative?.toLowerCase().includes(searchLower);
    
    // For carousel posts, search in all items
    if (post.isCarousel && post.carouselItems) {
      const matchesCarousel = post.carouselItems.some((item: any) => 
        item.dish?.name?.toLowerCase().includes(searchLower) ||
        item.review?.positive?.toLowerCase().includes(searchLower) ||
        item.review?.negative?.toLowerCase().includes(searchLower)
      );
      return matchesCarousel;
    }
    
    return matchesDish || matchesRestaurant || matchesReview;
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <div className="bg-white px-4 py-6 shadow-sm">
          <div className="flex items-center">
            <button 
              onClick={() => navigate(-1)}
              className="mr-4 p-2 hover:bg-gray-100 rounded-full transition-colors"
            >
              <ArrowLeftIcon size={20} className="text-gray-600" />
            </button>
            <h1 className="text-xl font-bold text-black">{username}</h1>
          </div>
        </div>

        {/* Loading State */}
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-600">Loading profile...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <div className="bg-white px-4 py-6 shadow-sm">
          <div className="flex items-center">
            <button 
              onClick={() => navigate(-1)}
              className="mr-4 p-2 hover:bg-gray-100 rounded-full transition-colors"
            >
              <ArrowLeftIcon size={20} className="text-gray-600" />
            </button>
            <h1 className="text-xl font-bold text-black">Profile</h1>
          </div>
        </div>

        {/* Error State */}
        <div className="text-center py-12">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">User Not Found</h3>
          <p className="text-gray-600 mb-4">This user doesn't exist or their profile is private.</p>
          <button
            onClick={() => navigate(-1)}
            className="bg-primary text-white py-2 px-6 rounded-full font-medium hover:bg-red-600 transition-colors"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-16">
      {/* Header */}
      <div className="bg-white px-4 py-4 shadow-sm">
        <div className="flex items-center">
          <button 
            onClick={() => navigate(-1)}
            className="mr-2 p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <ArrowLeftIcon size={20} className="text-gray-600" />
          </button>
          <h1 className="text-lg font-semibold text-black">Profile</h1>
        </div>
      </div>

      <div className="px-4 py-6">
        {/* Profile Info */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
          <div className="flex items-start mb-6">
            <img 
              src={userProfile?.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${username}`}
              alt={username} 
              className="w-20 h-20 rounded-full object-cover"
            />
            <div className="ml-4 flex-1 min-w-0">
              <div className="flex items-center">
                <User size={18} className="text-primary mr-2" />
                <h2 className="text-xl font-bold text-black">@{username}</h2>
              </div>
              <p className="text-gray-600 text-sm mt-1 ml-7 whitespace-pre-line">
                {userProfile?.bio || "Food enthusiast exploring local cuisine"}
              </p>
            </div>
          </div>
          
          {/* Action Buttons - Positioned above stats */}
          <div className="flex justify-end items-center mb-4">
            <div className="flex space-x-2">
              {isOwnProfile ? (
                <>
                  <button 
                    onClick={() => navigate('/profile/edit')}
                    className="px-3 py-1.5 border border-gray-200 rounded-full text-xs flex items-center hover:bg-gray-50 transition-colors"
                  >
                    <EditIcon size={12} className="mr-1" />
                    Edit
                  </button>
                  
                  <button 
                    onClick={handleShareProfile}
                    className="px-3 py-1.5 border border-gray-200 rounded-full text-xs flex items-center hover:bg-gray-50 transition-colors"
                  >
                    <Share size={12} className="mr-1" />
                    Share
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={handleFollowToggle}
                    disabled={followLoading}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors flex items-center ${
                      isFollowingUser 
                        ? 'bg-green-100 text-green-700 hover:bg-green-200 border border-green-200' 
                        : 'bg-primary text-white hover:bg-red-600'
                    } ${followLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    {followLoading ? (
                      <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin mr-1" />
                    ) : isFollowingUser ? (
                      <CheckIcon size={12} className="mr-1" />
                    ) : (
                      <PlusIcon size={12} className="mr-1" />
                    )}
                    {isFollowingUser ? 'Following' : 'Follow'}
                  </button>
                  
                  <button 
                    onClick={handleShareProfile}
                    className="px-3 py-1.5 border border-gray-200 rounded-full text-xs flex items-center hover:bg-gray-50 transition-colors"
                  >
                    <Share size={12} className="mr-1" />
                    Share
                  </button>
                </>
              )}
            </div>
          </div>
          
          {/* Stats Cards - 2x2 Grid */}
          <div className="grid grid-cols-2 gap-3 pt-4 border-t border-gray-100">
            {/* Reviews Card */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
              <div className="flex items-center">
                <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center mr-3">
                  <Star size={20} className="text-red-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-primary">{userReviews.length}</p>
                  <p className="text-sm text-gray-500">Reviews</p>
                </div>
              </div>
            </div>

            {/* Followers Card */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
              <div className="flex items-center">
                <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center mr-3">
                  <Users size={20} className="text-purple-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-primary">{followerCount}</p>
                  <p className="text-sm text-gray-500">Followers</p>
                </div>
              </div>
            </div>

            {/* Average Rating Card */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
              <div className="flex items-center">
                <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center mr-3">
                  <TrendingUp size={20} className="text-green-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-primary">
                    {userReviews.length > 0 
                      ? (userReviews.reduce((sum, review) => sum + review.rating, 0) / userReviews.length).toFixed(1)
                      : "0.0"
                    }
                  </p>
                  <p className="text-sm text-gray-500">Avg Rating</p>
                </div>
              </div>
            </div>

            {/* Restaurants Card */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
              <div className="flex items-center">
                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center mr-3">
                  <Users size={20} className="text-blue-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-primary">
                    {new Set(userReviews.map(r => r.restaurant).filter(Boolean)).size}
                  </p>
                  <p className="text-sm text-gray-500">Restaurants</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-xl shadow-sm mb-4">
          <div className="flex border-b border-gray-200">
            <button
              onClick={() => setActiveTab('reviews')}
              className={`flex-1 py-3 px-4 text-center font-medium ${
                activeTab === 'reviews'
                  ? 'text-primary border-b-2 border-primary'
                  : 'text-gray-600'
              }`}
            >
              Reviews ({userReviews.length})
            </button>
            <button
              onClick={() => setActiveTab('saved')}
              className={`flex-1 py-3 px-4 text-center font-medium ${
                activeTab === 'saved'
                  ? 'text-primary border-b-2 border-primary'
                  : 'text-gray-600'
              }`}
            >
              Saved Lists
            </button>
          </div>
        </div>

        {/* Tab Content */}
        {activeTab === 'reviews' && (
          <div className="space-y-4">
            {/* Search */}
            <div className="bg-white rounded-xl shadow-sm p-4">
              <div className="relative">
                <SearchIcon size={20} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search reviews..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>
            </div>

            {/* Reviews */}
            {filteredPosts.length > 0 ? (
              <div className="space-y-4">
                {filteredPosts.map(post => (
                  <FeedPost key={post.id} {...post} />
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <MapPinIcon size={24} className="text-gray-400" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  {searchQuery ? 'No matching reviews' : 'No reviews yet'}
                </h3>
                <p className="text-gray-600">
                  {searchQuery 
                    ? 'Try adjusting your search terms'
                    : `${username} hasn't shared any reviews yet.`
                  }
                </p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'saved' && (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <MapPinIcon size={24} className="text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Private Content</h3>
            <p className="text-gray-600">Saved lists are private and not visible to other users.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default PublicProfile;
