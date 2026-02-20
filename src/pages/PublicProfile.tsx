import React, { useState, useEffect, useRef, startTransition } from 'react';
import { ArrowLeftIcon, MapIcon, MapPinIcon, SearchIcon, PlusIcon, CheckIcon, EditIcon, Share, User, Star, Users, TrendingUp, Store } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import FeedPost from '../components/FeedPost';
import { fetchUserReviews, convertReviewsToFeedPosts, FirebaseReview } from '../services/reviewService';
import { getFollowCounts, isFollowing, followUser, unfollowUser } from '../services/followService';
import { getUserProfile, getCurrentUser, getUserByUsername } from '../lib/firebase';
import ExpandedMapModal from '../components/ExpandedMapModal';
import ProfileHeader from '../components/ProfileHeader';
import ProfileStats from '../components/ProfileStats';
import StatPills from '../components/StatPills';
import { getInitials } from '../utils/avatarUtils';
import AvatarBadge from '../components/badges/AvatarBadge';
import BadgeLadderModal from '../components/badges/BadgeLadderModal';
import { getTierFromPoints } from '../badges/badgeTiers';

// Cache for visited public profiles (username-keyed with LRU eviction)
interface CachedPublicProfile {
  profile: any;
  reviews: FirebaseReview[];
  feedPosts: any[];
  followerCount: number;
  followingCount: number;
  isFollowing: boolean;
  timestamp: number;
}

const profileCache = new Map<string, CachedPublicProfile>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
const MAX_CACHE_SIZE = 10; // LRU limit

// LRU cache eviction helper
const evictOldestCache = () => {
  if (profileCache.size >= MAX_CACHE_SIZE) {
    const firstKey = profileCache.keys().next().value;
    if (firstKey) profileCache.delete(firstKey);
  }
};

// Skeleton UI Component for loading state
const PublicProfileSkeleton: React.FC<{ username?: string }> = ({ username }) => {
  return (
    <div className="min-h-screen bg-gray-50 pb-16 animate-pulse">
      {/* Header with Back Button */}
      <div className="bg-white px-4 py-4 shadow-sm">
        <div className="flex items-center">
          <div className="w-8 h-8 bg-gray-200 rounded-full mr-2"></div>
          <div className="h-5 w-24 bg-gray-200 rounded"></div>
        </div>
      </div>

      <div className="px-4 py-6">
        {/* Profile Info Card */}
        <div className="bg-white rounded-xl shadow-sm p-5 mb-6">
          <div className="flex items-start mb-3">
            {/* Avatar skeleton */}
            <div className="w-20 h-20 bg-gray-200 rounded-full"></div>
            <div className="ml-4 flex-1">
              {/* Username skeleton */}
              <div className="h-5 w-32 bg-gray-200 rounded mb-2"></div>
              {/* Bio skeleton */}
              <div className="h-4 w-48 bg-gray-200 rounded"></div>
            </div>
          </div>

          {/* Action buttons skeleton */}
          <div className="flex justify-center items-center mb-4">
            <div className="flex space-x-2">
              <div className="h-9 w-24 bg-gray-200 rounded-full"></div>
              <div className="h-9 w-20 bg-gray-200 rounded-full"></div>
            </div>
          </div>

          {/* Stats Cards Skeleton - 2x2 Grid (More Compact) */}
          <div className="grid grid-cols-2 gap-2.5">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="bg-white rounded-xl shadow-sm border border-gray-100 p-3">
                <div className="flex items-center">
                  <div className="w-9 h-9 bg-gray-200 rounded-full mr-2.5"></div>
                  <div>
                    <div className="h-5 w-10 bg-gray-200 rounded mb-1"></div>
                    <div className="h-3 w-16 bg-gray-200 rounded"></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Food Map Button Skeleton */}
        <div className="mb-6">
          <div className="w-full h-14 bg-gray-200 rounded-xl"></div>
        </div>

        {/* Tabs Skeleton */}
        <div className="bg-white rounded-xl shadow-sm mb-4">
          <div className="flex border-b border-gray-200">
            <div className="flex-1 py-3 px-4 flex justify-center">
              <div className="h-4 w-24 bg-gray-200 rounded"></div>
            </div>
            <div className="flex-1 py-3 px-4 flex justify-center">
              <div className="h-4 w-20 bg-gray-200 rounded"></div>
            </div>
          </div>
        </div>

        {/* Search bar skeleton */}
        <div className="bg-white rounded-xl shadow-sm p-4 mb-4">
          <div className="h-10 w-full bg-gray-200 rounded-lg"></div>
        </div>

        {/* Post skeletons */}
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white rounded-xl p-4">
              <div className="h-48 bg-gray-200 rounded-lg mb-3"></div>
              <div className="h-4 w-3/4 bg-gray-200 rounded mb-2"></div>
              <div className="h-4 w-1/2 bg-gray-200 rounded"></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

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
  const [followingCount, setFollowingCount] = useState(0);

  // Food map modal state
  const [showFoodMapModal, setShowFoodMapModal] = useState(false);
  const [showBadgeModal, setShowBadgeModal] = useState(false);

  // Ref for scrolling to reviews
  const reviewsSectionRef = useRef<HTMLDivElement>(null);

  const currentUser = getCurrentUser();
  const isOwnProfile = currentUser?.displayName === username || currentUser?.email?.split('@')[0] === username;

  useEffect(() => {
    if (username) {
      loadUserProfile();
    }
  }, [username]);

  const loadUserProfile = async () => {
    try {
      if (!username) {
        setError('Username is required');
        return;
      }

      // Check cache first
      const now = Date.now();
      const cached = profileCache.get(username);

      if (cached && (now - cached.timestamp) < CACHE_DURATION) {
        // Use cached data immediately - instant display!
        setUserProfile(cached.profile);
        setUserReviews(cached.reviews);
        setFeedPosts(cached.feedPosts);
        setFollowerCount(cached.followerCount);
        setFollowingCount(cached.followingCount);
        if (!isOwnProfile) {
          setIsFollowingUser(cached.isFollowing);
        }
        setLoading(false);

        // Still fetch fresh data in background, but don't show loading state
      } else {
        // No valid cache, show loading skeleton
        setLoading(true);
      }

      // Fetch fresh data (either initial load or background refresh)
      const profileResult = await getUserByUsername(username);

      if (profileResult.success && profileResult.profile) {
        setUserProfile(profileResult.profile);

        // Load reviews
        const reviews = await fetchUserReviews(50, profileResult.profile.uid);
        setUserReviews(reviews);

        // Convert to feed posts
        const posts = await convertReviewsToFeedPosts(reviews);
        setFeedPosts(posts);

        // Get follow counts and status
        const counts = await getFollowCounts(profileResult.profile.uid);
        setFollowerCount(counts.followers);
        setFollowingCount(counts.following);

        let followingStatus = false;
        if (!isOwnProfile) {
          followingStatus = await isFollowing(profileResult.profile.uid);
          setIsFollowingUser(followingStatus);
        }

        // Update cache
        evictOldestCache(); // LRU eviction
        profileCache.set(username, {
          profile: profileResult.profile,
          reviews,
          feedPosts: posts,
          followerCount: counts.followers,
          followingCount: counts.following,
          isFollowing: followingStatus,
          timestamp: Date.now()
        });
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
    if (followLoading || isOwnProfile || !userProfile?.uid || !username) return;

    setFollowLoading(true);
    try {
      if (isFollowingUser) {
        const success = await unfollowUser(userProfile.uid);
        if (success) {
          setIsFollowingUser(false);
          setFollowerCount(prev => prev - 1);

          // Update cache to reflect new follow state
          const cached = profileCache.get(username);
          if (cached) {
            profileCache.set(username, {
              ...cached,
              isFollowing: false,
              followerCount: cached.followerCount - 1,
              timestamp: Date.now() // Refresh timestamp
            });
          }
        }
      } else {
        const success = await followUser(userProfile.uid, userProfile.username || userProfile.displayName);
        if (success) {
          setIsFollowingUser(true);
          setFollowerCount(prev => prev + 1);

          // Update cache to reflect new follow state
          const cached = profileCache.get(username);
          if (cached) {
            profileCache.set(username, {
              ...cached,
              isFollowing: true,
              followerCount: cached.followerCount + 1,
              timestamp: Date.now() // Refresh timestamp
            });
          }
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
    return <PublicProfileSkeleton username={username} />;
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <div className="bg-white px-4 py-6 shadow-sm">
          <div className="flex items-center">
            <button
              onClick={() => {
                startTransition(() => {
                  navigate('/');
                });
              }}
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
            onClick={() => {
              startTransition(() => {
                navigate('/');
              });
            }}
            className="bg-primary text-white py-2 px-6 rounded-full font-medium hover:bg-red-600 transition-colors"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  // Calculate stats
  const restaurantsCount = new Set(userReviews.map(r => r.restaurant).filter(Boolean)).size;
  const averageRating = userReviews.length > 0
    ? userReviews.reduce((sum, review) => sum + review.rating, 0) / userReviews.length
    : 0;
  const pointsEarned = userProfile?.stats?.pointsEarned ?? 0;
  const tierProgress = getTierFromPoints(pointsEarned);

  // Scroll to reviews section handler
  const handleScrollToReviews = () => {
    setActiveTab('reviews');
    setTimeout(() => {
      reviewsSectionRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  // Avatar component with fallback
  const UserAvatar: React.FC = () => {
    const [imageError, setImageError] = useState(false);

    if (userProfile?.avatar && !imageError) {
      return (
        <img
          src={userProfile.avatar}
          alt={username}
          className="w-20 h-20 rounded-full object-cover border-2 border-gray-200"
          onError={() => setImageError(true)}
        />
      );
    }

    return (
      <div className="w-20 h-20 rounded-full bg-primary flex items-center justify-center border-2 border-gray-200">
        <span className="text-white font-semibold text-xl">
          {getInitials(username || '', userProfile?.actualName || userProfile?.displayName)}
        </span>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-16" style={{ animation: 'fadeIn 0.2s ease-in' }}>
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes badgeHeartbeat {
          0%, 100% { transform: scale(1); }
          45% { transform: scale(1.04); }
          65% { transform: scale(1); }
        }
        .badge-heartbeat {
          animation: badgeHeartbeat 2.8s ease-in-out infinite;
          transform-origin: center;
        }
      `}</style>

      {/* New Instagram-style Header */}
      <ProfileHeader
        username={username || ''}
        showMenu={false}
        onBack={() => navigate(-1)}
      />

      <div className="bg-white shadow-sm">
        {/* Profile Info Section - Instagram Style */}
        <div className="p-4">
          <div className="flex items-start">
            {/* Avatar + Follow Button */}
            <div className="relative flex flex-col items-center">
              <UserAvatar />
              {!isOwnProfile && (
                <button
                  onClick={handleFollowToggle}
                  disabled={followLoading}
                  className={`mt-2 px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-1.5 border transition-colors ${
                    isFollowingUser
                      ? 'border-gray-300 text-gray-700 hover:bg-gray-50'
                      : 'border-primary text-primary hover:bg-red-50'
                  } ${followLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {followLoading ? (
                    <div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  ) : isFollowingUser ? (
                    <CheckIcon size={14} />
                  ) : (
                    <PlusIcon size={14} />
                  )}
                  {isFollowingUser ? 'Following' : 'Follow'}
                </button>
              )}
            </div>

            {/* Name and Stats */}
            <div className="ml-4 flex-1 min-w-0">
              {/* Actual Name */}
              <h2 className="font-semibold text-lg text-gray-900 flex items-center">
                {userProfile?.actualName || userProfile?.displayName || username}
                <button
                  type="button"
                  onClick={() => setShowBadgeModal(true)}
                  className="inline-flex items-center badge-heartbeat ml-1.5"
                  aria-label="View badges"
                >
                  <AvatarBadge tierIndex={tierProgress.tierIndex} size="inline" />
                </button>
                {userProfile?.isVerified && (
                  <span className="ml-1 text-blue-500" title="Verified user">✓</span>
                )}
                <button
                  onClick={handleShareProfile}
                  className="ml-auto p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors"
                  aria-label="Share profile"
                >
                  <Share size={18} />
                </button>
              </h2>

              {/* Stats Row */}
              <ProfileStats
                reviewCount={userReviews.length}
                followersCount={followerCount}
                followingCount={followingCount}
                onReviewsClick={handleScrollToReviews}
                onFollowersClick={() => navigate(`/user/${username}/connections?tab=followers`)}
                onFollowingClick={() => navigate(`/user/${username}/connections?tab=following`)}
              />
            </div>
          </div>

          {/* Bio - Below avatar */}
          {userProfile?.bio && (
            <p className="text-sm text-gray-600 mt-3 whitespace-pre-line">{userProfile.bio}</p>
          )}

          {/* Action button for own profile */}
          {isOwnProfile && (
            <div className="flex space-x-2 mt-4">
              <button
                onClick={() => {
                  startTransition(() => {
                    navigate('/profile/edit');
                  });
                }}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium flex items-center hover:bg-gray-50 transition-colors"
              >
                <EditIcon size={14} className="mr-1.5" />
                Edit Profile
              </button>
            </div>
          )}

          {/* Stat Pills */}
          <StatPills
            restaurantsCount={restaurantsCount}
            averageRating={averageRating}
            username={username || ''}
          />
        </div>

        {/* Food Map Button */}
        {!isOwnProfile && (
          <div className="px-4 pb-4">
            <button
              onClick={() => setShowFoodMapModal(true)}
              className="w-full bg-gradient-to-r from-primary to-red-500 text-white py-3 px-6 rounded-xl font-medium shadow-sm hover:shadow-md transition-all duration-200 flex items-center justify-center"
            >
              <MapIcon size={18} className="mr-2" />
              View their Food Map
            </button>
          </div>
        )}

        {/* Tabs */}
        <div className="flex border-t border-gray-200">
          <button
            onClick={() => setActiveTab('reviews')}
            className={`flex-1 py-3 text-center font-medium transition-colors relative ${
              activeTab === 'reviews'
                ? 'text-primary'
                : 'text-gray-600'
            }`}
          >
            Reviews ({userReviews.length})
            {activeTab === 'reviews' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
            )}
          </button>
          <button
            onClick={() => setActiveTab('saved')}
            className={`flex-1 py-3 text-center font-medium transition-colors relative ${
              activeTab === 'saved'
                ? 'text-primary'
                : 'text-gray-600'
            }`}
          >
            Saved Lists
            {activeTab === 'saved' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
            )}
          </button>
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'reviews' && (
        <div ref={reviewsSectionRef} className="p-4 space-y-4">
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
        <div className="p-4">
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <MapPinIcon size={24} className="text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Private Content</h3>
            <p className="text-gray-600">Saved lists are private and not visible to other users.</p>
          </div>
        </div>
      )}

      {/* Food Map Modal */}
      {showFoodMapModal && (
        <ExpandedMapModal
          isOpen={showFoodMapModal}
          onClose={() => setShowFoodMapModal(false)}
          userId={userProfile.uid}
          userName={userProfile.username || userProfile.displayName}
          userTierIndex={tierProgress.tierIndex}
          userAvatar={userProfile.avatar}
          allowHomeCountryOverride={false}
        />
      )}

      {showBadgeModal && (
        <BadgeLadderModal
          isOpen={showBadgeModal}
          onClose={() => setShowBadgeModal(false)}
          points={pointsEarned}
          title={isOwnProfile ? 'Your Rank' : 'Rank'}
          subtitle={isOwnProfile ? undefined : `${userProfile?.displayName || userProfile?.username || username || 'User'}'s badge ladder`}
        />
      )}
    </div>
  );
};

export default PublicProfile;
