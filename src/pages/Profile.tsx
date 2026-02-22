import React, { useState, useEffect, useRef, useMemo, startTransition } from 'react';
import { EditIcon, GridIcon, BookmarkIcon, SearchIcon, PlusIcon, Star, Users, TrendingUp, Share, User, MapIcon } from 'lucide-react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Store as StoreIcon } from 'lucide-react';
import { useOwnedRestaurants } from '../hooks/useOwnedRestaurants';
import FeedPost from '../components/FeedPost';
import HamburgerMenu from '../components/HamburgerMenu';
import { useFeature } from '../utils/features';
import { fetchUserReviews, convertUserReviewsToFeedPosts, FirebaseReview } from '../services/reviewService';
import { getUserProfile, UserProfile, getCurrentUser } from '../lib/firebase';
import { getInitials } from '../utils/avatarUtils';
import ListCard from '../components/ListCard';
import {
  getUserSavedLists,
  createDefaultTemplates,
  deleteSavedList,
  makeListPublic,
  createCustomList,
  updateListName,
  SavedList
} from '../services/savedListsService';
import EditListNameModal from '../components/EditListNameModal';
import { getFollowCounts } from '../services/followService';
import ProfileHeader from '../components/ProfileHeader';
import ExpandedMapModal from '../components/ExpandedMapModal';
import ProfileStats from '../components/ProfileStats';
import AvatarBadge from '../components/badges/AvatarBadge';
import BadgeLadderModal from '../components/badges/BadgeLadderModal';
import { getTierFromPoints } from '../badges/badgeTiers';
import HighlightsSection from '../components/profile/HighlightsSection';
import { getTopDishes } from '../utils/topDishes';
import { useI18n } from '../lib/i18n/useI18n';

// Simple cache for profile data to enable instant "back" navigation
let cachedProfileData: {
  profile: UserProfile | null;
  followerCount: number;
  followingCount: number;
  timestamp: number;
} | null = null;

const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes


// Skeleton UI Component for loading state
const ProfileSkeleton: React.FC = () => {
  const { t } = useI18n();
  return (
    <div className="min-h-screen bg-light-gray pb-16 animate-pulse">
      <header className="bg-white p-4 sticky top-0 z-10 shadow-sm">
        <div className="flex justify-between items-center">
          <div className="h-6 w-32 bg-gray-200 rounded"></div>
          <div className="flex items-center">
            <div className="w-20 h-8 bg-gray-200 rounded-2xl mr-3"></div>
            <div className="w-8 h-8 bg-gray-200 rounded-lg"></div>
          </div>
        </div>
      </header>

      <div className="bg-white shadow-sm">
        {/* Profile Header Skeleton */}
        <div className="p-6">
          <div className="flex items-start mb-6">
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
          <div className="flex justify-between items-center mb-4">
            <div className="h-3 w-24 bg-gray-200 rounded"></div>
            <div className="flex space-x-2">
              <div className="h-7 w-16 bg-gray-200 rounded-full"></div>
              <div className="h-7 w-16 bg-gray-200 rounded-full"></div>
            </div>
          </div>

          {/* Stats Cards Skeleton - 2x2 Grid */}
          <div className="grid grid-cols-2 gap-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
                <div className="flex items-center">
                  <div className="w-10 h-10 bg-gray-200 rounded-full mr-3"></div>
                  <div>
                    <div className="h-6 w-12 bg-gray-200 rounded mb-1"></div>
                    <div className="h-3 w-16 bg-gray-200 rounded"></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Food Map Button Skeleton */}
        <div className="px-6 mt-4 mb-4">
          <div className="w-full h-12 bg-gray-200 rounded-xl"></div>
        </div>

        {/* Tabs Skeleton */}
        <div className="flex border-t border-light-gray">
          <div className="flex-1 py-3 flex justify-center items-center">
            <div className="h-4 w-24 bg-gray-200 rounded"></div>
          </div>
          <div className="flex-1 py-3 flex justify-center items-center">
            <div className="h-4 w-16 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>

      {/* Content skeleton */}
      <div className="p-4">
        {/* Search bar skeleton */}
        <div className="h-10 w-full bg-gray-200 rounded-full mb-4"></div>

        {/* Post skeletons */}
        <div className="space-y-3">
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

const SavedListsTab: React.FC<{ isNewUser?: boolean }> = ({ isNewUser = false }) => {
  const navigate = useNavigate();
  const { t } = useI18n();
  const [lists, setLists] = useState<SavedList[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [creating, setCreating] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingList, setEditingList] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    loadLists();
  }, []);

  const loadLists = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Ensure user has default templates
      await createDefaultTemplates();
      
      // Load all lists
      const result = await getUserSavedLists();
      if (result.success && result.lists) {
        setLists(result.lists);
      } else {
        setError(result.error || t('lists.errors.load'));
      }
    } catch (err: any) {
      setError(err.message || t('lists.errors.load'));
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteList = async (listId: string, listName: string) => {
    if (!confirm(t('lists.confirmDelete', { name: listName }))) {
      return;
    }

    try {
      const result = await deleteSavedList(listId);
      if (result.success) {
        await loadLists(); // Refresh the list
      } else {
        setError(result.error || t('lists.errors.delete'));
      }
    } catch (err: any) {
      setError(err.message || t('lists.errors.delete'));
    }
  };

  const handleShareList = async (listId: string) => {
    try {
      const result = await makeListPublic(listId);
      if (result.success && result.shareCode) {
        const shareUrl = `${window.location.origin}/list/${result.shareCode}`;
        
        if (navigator.share) {
          await navigator.share({
            title: t('lists.share.title'),
            url: shareUrl
          });
        } else {
          // Fallback: copy to clipboard
          await navigator.clipboard.writeText(shareUrl);
          alert(t('lists.share.copied'));
        }
      } else {
        setError(result.error || t('lists.errors.share'));
      }
    } catch (err: any) {
      setError(err.message || t('lists.errors.share'));
    }
  };

  const handleCreateList = async () => {
    if (!newListName.trim()) {
      setError(t('lists.errors.nameRequired'));
      return;
    }

    setCreating(true);
    setError(null);

    try {
      const result = await createCustomList(newListName.trim());
      if (result.success && result.listId) {
        // Refresh lists
        await loadLists();
        setShowCreateForm(false);
        setNewListName('');
      } else {
        setError(result.error || t('lists.errors.create'));
      }
    } catch (err: any) {
      setError(err.message || t('lists.errors.create'));
    } finally {
      setCreating(false);
    }
  };

  const handleEditList = (listId: string, currentName: string) => {
    setEditingList({ id: listId, name: currentName });
    setEditModalOpen(true);
  };

  const handleSaveListName = async (listId: string, newName: string) => {
    const result = await updateListName(listId, newName);
    if (result.success) {
      await loadLists(); // Refresh the lists
    } else {
      throw new Error(result.error || t('lists.errors.updateName'));
    }
  };

  if (loading) {
    return (
      <div className="p-4">
        <div className="text-center py-8">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">{t('lists.loading')}</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4">
        <div className="text-center py-8">
          <p className="text-red-600 mb-4">{error}</p>
          <button 
            onClick={loadLists}
            className="bg-primary text-white px-4 py-2 rounded-lg hover:bg-red-600 transition-colors"
          >
            {t('common.actions.tryAgain')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold">{t('lists.title')}</h3>
        <span className="text-sm text-gray-500">{t('lists.count', { count: lists.length })}</span>
      </div>

      {lists.length === 0 ? (
        /* Empty State */
        <div className="text-center py-12">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <PlusIcon size={24} className="text-gray-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">{t('lists.empty.title')}</h3>
          <p className="text-gray-600 mb-6">
            {t('lists.empty.subtitle')}
          </p>
          <button
            onClick={() => {
              startTransition(() => {
                navigate(isNewUser ? '/create' : '/discover');
              });
            }}
            className="bg-primary text-white px-6 py-3 rounded-full font-medium hover:bg-red-600 transition-colors"
          >
            {isNewUser ? t('common.actions.addFirstReview') : t('common.actions.discoverRestaurants')}
          </button>
        </div>
      ) : (
        /* Lists Grid */
        <div className="space-y-3">
          {lists.map((list) => (
            <ListCard
              key={list.id}
              list={list}
              onDelete={handleDeleteList}
              onShare={handleShareList}
              onEdit={handleEditList}
              previewImages={[]}
            />
          ))}
          
          {/* Create New List */}
          {!showCreateForm ? (
            <button
              onClick={() => setShowCreateForm(true)}
              className="w-full p-4 border-2 border-dashed border-gray-300 rounded-xl hover:border-primary hover:bg-red-50 transition-colors flex items-center justify-center text-gray-600 hover:text-primary"
            >
              <PlusIcon size={20} className="mr-2" />
              {t('lists.actions.createNew')}
            </button>
          ) : (
            <div className="border border-gray-200 rounded-xl p-4">
              <input
                type="text"
                placeholder={t('lists.placeholders.name')}
                value={newListName}
                onChange={(e) => setNewListName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleCreateList();
                  } else if (e.key === 'Escape') {
                    setShowCreateForm(false);
                    setNewListName('');
                  }
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-primary mb-3"
                autoFocus
              />
              <div className="flex space-x-2">
                <button
                  onClick={handleCreateList}
                  disabled={creating || !newListName.trim()}
                  className="flex-1 bg-primary text-white py-2 px-4 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-red-600 transition-colors"
                >
                  {creating ? t('lists.status.creating') : t('lists.actions.create')}
                </button>
                <button
                  onClick={() => {
                    setShowCreateForm(false);
                    setNewListName('');
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  {t('common.actions.cancel')}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Edit List Name Modal */}
      {editModalOpen && editingList && (
        <EditListNameModal
          isOpen={editModalOpen}
          onClose={() => {
            setEditModalOpen(false);
            setEditingList(null);
          }}
          listId={editingList.id}
          currentName={editingList.name}
          onSave={handleSaveListName}
        />
      )}
    </div>
  );
};

const Profile: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState<'activity' | 'saved'>('activity');
  const [searchTerm, setSearchTerm] = useState('');
  const [firebaseReviews, setFirebaseReviews] = useState<FirebaseReview[]>([]);
  const [feedPosts, setFeedPosts] = useState<any[]>([]);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [followerCount, setFollowerCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [showFoodMapModal, setShowFoodMapModal] = useState(false);
  const [showBadgeModal, setShowBadgeModal] = useState(false);
  const isFirstLoad = useRef(true);
  const reviewsSectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);
  
  useEffect(() => {
    isFirstLoad.current = false;
  }, []);

  // Feature flags
  const showTierRankings = useFeature('TIER_RANKINGS');
  const showSocialActivity = useFeature('SOCIAL_FEED');

  // Owners are normal users; owner permissions come from restaurants.ownerIds
  const { ownsAny } = useOwnedRestaurants();
  
  // Fetch user profile on component mount
  useEffect(() => {
    const loadUserProfile = async () => {
      try {
        const currentUser = getCurrentUser();

        if (!currentUser) {
          setError(t('profile.errors.noAuth'));
          setProfileLoading(false);
          return;
        }

        // Check if we have valid cached data
        const now = Date.now();
        if (cachedProfileData &&
            cachedProfileData.profile &&
            (now - cachedProfileData.timestamp) < CACHE_DURATION) {
          // Use cached data immediately for instant display
          setUserProfile(cachedProfileData.profile);
          setFollowerCount(cachedProfileData.followerCount);
          setFollowingCount(cachedProfileData.followingCount);
          setProfileLoading(false);

          // Still fetch fresh data in the background to keep it updated
          // but don't show loading state
        } else {
          // No cache available, show loading state
          setProfileLoading(true);
        }

        // Fetch fresh data (either as background refresh or initial load)
        const result = await getUserProfile();
        if (result.success && result.profile) {
          setUserProfile(result.profile);

          // Get follow counts
          const counts = await getFollowCounts(currentUser.uid);
          setFollowerCount(counts.followers);
          setFollowingCount(counts.following);

          // Update cache
          cachedProfileData = {
            profile: result.profile,
            followerCount: counts.followers,
            followingCount: counts.following,
            timestamp: Date.now()
          };
        } else {
          setError(result.error || t('profile.errors.loadProfile'));
        }
      } catch (err) {
        console.error('Failed to load user profile:', err);
        setError(t('profile.errors.loadProfile'));
      } finally {
        setProfileLoading(false);
      }
    };

    loadUserProfile();
  }, [refreshTrigger]);
  
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

        const reviews = await fetchUserReviews(200);
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
  }, [refreshTrigger]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        setRefreshTrigger(prev => prev + 1);
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // Share profile handler
  const handleShareProfile = async () => {
    try {
      const shareUrl = `${window.location.origin}/profile/${userProfile.username}`;
      const shareData = {
        title: t('profile.share.title', { username: userProfile.username }),
        text: t('profile.share.text', { username: userProfile.username }),
        url: shareUrl
      };

      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        // Fallback: copy to clipboard
        await navigator.clipboard.writeText(shareUrl);
        alert(t('profile.share.copied'));
      }
    } catch (err) {
      console.error('Failed to share profile:', err);
      // Fallback for clipboard failures
      try {
        const shareUrl = `${window.location.origin}/profile/${userProfile.username}`;
        await navigator.clipboard.writeText(shareUrl);
        alert(t('profile.share.copied'));
      } catch {
        alert(t('profile.share.failed'));
      }
    }
  };

  // Filter posts based on search term - now searches across carousel items
  const filteredPosts = feedPosts.filter(post => {
    if (searchTerm === '') return true;
    
    const searchLower = searchTerm.toLowerCase();
    
    // Search restaurant name
    if (post.restaurant?.name.toLowerCase().includes(searchLower)) {
      return true;
    }
    
    // Search main dish name
    if (post.dish.name.toLowerCase().includes(searchLower)) {
      return true;
    }
    
    // Search carousel items (for multi-dish posts)
    if (post.isCarousel && post.carouselItems) {
      return post.carouselItems.some(item => 
        item.dish.name.toLowerCase().includes(searchLower) ||
        item.review.positive.toLowerCase().includes(searchLower) ||
        item.review.negative.toLowerCase().includes(searchLower)
      );
    }
    
    // Search single post reviews
    if (post.review.positive.toLowerCase().includes(searchLower) ||
        post.review.negative.toLowerCase().includes(searchLower)) {
      return true;
    }
    
    return false;
  });

  // Calculate personal stats from Firebase reviews and user profile
  const personalStats = {
    totalReviews: userProfile?.stats?.totalReviews || firebaseReviews.length,
    restaurantsTried: userProfile?.stats?.totalRestaurants || new Set(firebaseReviews.map(r => r.restaurant).filter(Boolean)).size,
    averageRating: userProfile?.stats?.averageRating || (firebaseReviews.length > 0 
      ? parseFloat((firebaseReviews.reduce((sum, r) => sum + r.rating, 0) / firebaseReviews.length).toFixed(1))
      : 0),
    pointsEarned: Math.max(userProfile?.stats?.pointsEarned || 0, firebaseReviews.length * 20)
  };

  const topDishes = useMemo(() => getTopDishes(firebaseReviews, 3), [firebaseReviews]);

  const tierProgress = getTierFromPoints(personalStats.pointsEarned);
  const isNewUser = personalStats.totalReviews === 0;

  const isProfileRoute = location.pathname === '/profile';

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
          className={`${sizeClasses[size]} rounded-full object-cover border-2 border-gray-200`}
          onError={() => {
            // If image fails to load, show initials fallback
            setImageError(true);
          }}
        />
      );
    }

    // Fallback to initials for users without profile photos or failed image loads
    return (
      <div className={`${sizeClasses[size]} rounded-full bg-primary flex items-center justify-center border-2 border-gray-200`}>
        <span className="text-white font-semibold">
          {getInitials(userProfile.username, userProfile.displayName)}
        </span>
      </div>
    );
  };

  // Loading state - show skeleton UI instead of blank screen
  if (!userProfile && profileLoading) {
    return <ProfileSkeleton />;
  }

  // Error state
  if (error || !userProfile) {
    return (
      <div className="min-h-screen bg-light-gray flex items-center justify-center">
        <div className="text-center p-4">
          <h2 className="text-xl font-bold text-gray-900 mb-2">{t('profile.errors.title')}</h2>
          <p className="text-gray-600 mb-4">{error || t('profile.errors.unable')}</p>
          <button 
            onClick={() => window.location.reload()} 
            className="bg-primary text-white px-4 py-2 rounded-lg hover:bg-red-600 transition-colors"
          >
            {t('common.actions.retry')}
          </button>
        </div>
      </div>
    );
  }

  // Scroll to reviews section handler
  const handleScrollToReviews = () => {
    setActiveTab('activity');
    setTimeout(() => {
      reviewsSectionRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  return (
    <div className="min-h-screen bg-light-gray pb-16" style={{ animation: 'fadeIn 0.2s ease-in' }}>
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
        username={userProfile.username}
        showMenu={true}
        onBack={() => navigate('/')}
      />

      <div className="bg-white shadow-sm">
        {/* Profile Info Section - Instagram Style */}
        <div className="p-4">
          <div className="flex items-start">
            {/* Avatar + Edit */}
            <div className="flex flex-col items-center">
              <UserAvatar size="lg" />
              <button
                onClick={() => {
                  startTransition(() => {
                    navigate('/profile/edit');
                  });
                }}
                className="mt-2 inline-flex items-center justify-center gap-1.5 rounded-full border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <EditIcon size={12} className="text-gray-600" />
                {t('common.actions.edit')}
              </button>
            </div>

            {/* Name, Stats, Bio */}
            <div className="ml-4 flex-1 min-w-0">
              {/* Actual Name */}
              <h2 className="font-semibold text-lg text-gray-900 flex items-center">
                {userProfile.actualName || userProfile.displayName || userProfile.username}
                {!isNewUser && (
                  <button
                    type="button"
                    onClick={() => setShowBadgeModal(true)}
                    className="inline-flex items-center badge-heartbeat ml-1.5"
                    aria-label={t('profile.actions.viewBadges')}
                    data-tour="profile-rank-badge"
                  >
                    <AvatarBadge tierIndex={tierProgress.tierIndex} size="inline" />
                  </button>
                )}
                {userProfile.isVerified && (
                  <span className="ml-1 text-blue-500" title={t('profile.labels.verified')}>✓</span>
                )}
                <button
                  onClick={handleShareProfile}
                  className="ml-auto p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors"
                  aria-label={t('common.actions.share')}
                >
                  <Share size={18} />
                </button>
              </h2>

              {/* Stats Row */}
              <ProfileStats
                reviewCount={personalStats.totalReviews}
                followersCount={followerCount}
                followingCount={followingCount}
                onReviewsClick={handleScrollToReviews}
                onFollowersClick={() => navigate(`/user/${userProfile.username}/connections?tab=followers`)}
                onFollowingClick={() => navigate(`/user/${userProfile.username}/connections?tab=following`)}
              />

              {/* Bio */}
              {userProfile.bio ? (
                <p
                  className="mt-2 text-sm text-gray-600 whitespace-pre-line min-w-0 overflow-hidden"
                  style={{
                    display: '-webkit-box',
                    WebkitLineClamp: 3,
                    WebkitBoxOrient: 'vertical'
                  }}
                >
                  {userProfile.bio}
                </p>
              ) : null}
            </div>
          </div>

          {isNewUser && (
            <div className="mt-4 rounded-xl border border-gray-200 bg-white px-4 py-3">
              <p className="text-sm font-semibold text-gray-900">
                {t('profile.newUser.message')}
              </p>
              <Link
                to="/create"
                className="mt-3 inline-flex items-center bg-primary text-white px-4 py-2 rounded-full text-sm font-medium hover:bg-red-600 transition-colors"
              >
                {t('common.actions.addFirstReview')}
              </Link>
            </div>
          )}

          {/* Owner Action */}
          {ownsAny && (
            <div className="flex mt-3">
              <button
                onClick={() => {
                  startTransition(() => {
                    navigate('/owner');
                  });
                }}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium flex items-center hover:bg-gray-50 transition-colors"
                aria-label={t('profile.actions.yourRestaurant')}
              >
                <StoreIcon size={14} className="mr-1.5" />
                {t('profile.actions.yourRestaurant')}
              </button>
            </div>
          )}

          {/* Highlights */}
          <div data-tour="profile-rank-progress">
            <HighlightsSection
              topDishes={topDishes}
            />
          </div>
        </div>

        {/* Food Map Button */}
          <div className="px-4 pb-4">
            <button
              data-tour="profile-view-map"
              onClick={() => {
                setShowFoodMapModal(true);
              }}
              className="w-full bg-gradient-to-r from-primary to-red-500 text-white py-3 px-6 rounded-xl font-medium shadow-sm hover:shadow-md transition-all duration-200 flex items-center justify-center"
            >
              <MapIcon size={18} className="mr-2" />
              {t('profile.actions.viewMap')}
            </button>
          </div>

        {/* Tier Rankings Section - Coming Soon */}
        {showTierRankings && (
          <div className="px-4 py-3 border-t border-light-gray">
            <div className="text-center py-4">
              <div className="text-2xl mb-2">🏆</div>
              <p className="text-sm text-gray-600">{t('profile.tiers.comingSoon')}</p>
              <p className="text-xs text-gray-500">{t('profile.tiers.subtitle')}</p>
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
            <span>{t('profile.tabs.reviews')}</span>
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
            <span>{t('profile.tabs.saved')}</span>
          </button>
        </div>
      </div>

      {activeTab === 'activity' ? (
        <div ref={reviewsSectionRef} className="p-4">
          {/* Search Bar */}
          <div className="relative mb-4">
            <SearchIcon size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-dark-gray" />
            <input
              type="text"
              placeholder={t('profile.search.placeholder')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-medium-gray rounded-full text-sm focus:outline-none focus:border-primary"
            />
          </div>

          {/* Personal Reviews */}
          {loading ? (
            <div className="text-center py-8">
              <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-gray-600">{t('profile.loading.reviews')}</p>
            </div>
          ) : filteredPosts.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <GridIcon size={24} className="text-gray-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                {searchTerm ? t('profile.empty.noMatchTitle') : t('profile.empty.noReviewsTitle')}
              </h3>
              <p className="text-gray-600 mb-6">
                {searchTerm 
                  ? t('profile.empty.noMatchSubtitle')
                  : (isNewUser
                    ? t('profile.newUser.message')
                    : t('profile.empty.noReviewsSubtitle'))
                }
              </p>
              {!searchTerm && (
                <Link 
                  to="/create" 
                  className="inline-flex items-center bg-primary text-white px-6 py-3 rounded-full font-medium hover:bg-red-600 transition-colors"
                >
                  <PlusIcon size={18} className="mr-2" />
                  {t('common.actions.addFirstReview')}
                </Link>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {filteredPosts.map(post => (
                <FeedPost key={post.id} {...post} showPendingVerification />
              ))}
            </div>
          )}
        </div>
      ) : (
        <SavedListsTab isNewUser={isNewUser} />
      )}

      {showFoodMapModal && userProfile && (
        <ExpandedMapModal
          isOpen={showFoodMapModal}
          onClose={() => setShowFoodMapModal(false)}
          userId={userProfile.uid}
          userName={userProfile.username || userProfile.displayName}
          userTierIndex={tierProgress.tierIndex}
          userAvatar={userProfile.avatar || userProfile.photoURL}
          reviewCountOverride={personalStats.totalReviews}
          homeCountry={userProfile.homeCountry}
          allowHomeCountryOverride={true}
        />
      )}

      {showBadgeModal && (
        <BadgeLadderModal
          isOpen={showBadgeModal}
          onClose={() => setShowBadgeModal(false)}
          points={personalStats.pointsEarned}
          title={t('profile.rank.title')}
        />
      )}
    </div>
  );
};

export default Profile;
