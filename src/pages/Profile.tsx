import React, { useState, useEffect } from 'react';
import { EditIcon, GridIcon, BookmarkIcon, SearchIcon, PlusIcon, Star, Users, TrendingUp, Award, Share, User } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
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

const SavedListsTab: React.FC = () => {
  const navigate = useNavigate();
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
        setError(result.error || 'Failed to load lists');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load lists');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteList = async (listId: string, listName: string) => {
    if (!confirm(`Delete "${listName}"? This action cannot be undone.`)) {
      return;
    }

    try {
      const result = await deleteSavedList(listId);
      if (result.success) {
        await loadLists(); // Refresh the list
      } else {
        setError(result.error || 'Failed to delete list');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to delete list');
    }
  };

  const handleShareList = async (listId: string) => {
    try {
      const result = await makeListPublic(listId);
      if (result.success && result.shareCode) {
        const shareUrl = `${window.location.origin}/list/${result.shareCode}`;
        
        if (navigator.share) {
          await navigator.share({
            title: 'Check out my food list!',
            url: shareUrl
          });
        } else {
          // Fallback: copy to clipboard
          await navigator.clipboard.writeText(shareUrl);
          alert('Share link copied to clipboard!');
        }
      } else {
        setError(result.error || 'Failed to share list');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to share list');
    }
  };

  const handleCreateList = async () => {
    if (!newListName.trim()) {
      setError('List name is required');
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
        setError(result.error || 'Failed to create list');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to create list');
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
      throw new Error(result.error || 'Failed to update list name');
    }
  };

  if (loading) {
    return (
      <div className="p-4">
        <div className="text-center py-8">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your lists...</p>
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
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold">Saved Lists</h3>
        <span className="text-sm text-gray-500">{lists.length} lists</span>
      </div>

      {lists.length === 0 ? (
        /* Empty State */
        <div className="text-center py-12">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <PlusIcon size={24} className="text-gray-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No lists yet</h3>
          <p className="text-gray-600 mb-6">
            Start saving restaurants and dishes to create your first list
          </p>
          <button 
            onClick={() => navigate('/discover')}
            className="bg-primary text-white px-6 py-3 rounded-full font-medium hover:bg-red-600 transition-colors"
          >
            Discover Restaurants
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
              Create New List
            </button>
          ) : (
            <div className="border border-gray-200 rounded-xl p-4">
              <input
                type="text"
                placeholder="Enter list name..."
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
                  {creating ? 'Creating...' : 'Create List'}
                </button>
                <button
                  onClick={() => {
                    setShowCreateForm(false);
                    setNewListName('');
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
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
          
          // Get follow counts
          if (currentUser) {
            const counts = await getFollowCounts(currentUser.uid);
            setFollowerCount(counts.followers);
          }
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
        title: `Check out @${userProfile.username} on Tip!`,
        text: `Check out @${userProfile.username}'s food reviews and recommendations on Tip!`,
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
        const shareUrl = `${window.location.origin}/profile/${userProfile.username}`;
        await navigator.clipboard.writeText(shareUrl);
        alert('Profile link copied to clipboard!');
      } catch {
        alert('Unable to share profile. Please try again.');
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
        {/* Profile Header */}
        <div className="p-6">
          <div className="flex items-start mb-6">
            <UserAvatar size="lg" />
            <div className="ml-4 flex-1 min-w-0">
              <div className="flex items-center">
                <User size={18} className="text-primary mr-2" />
                <h2 className="font-semibold text-lg">@{userProfile.username}</h2>
                {userProfile.isVerified && (
                  <span className="ml-2 text-blue-500" title="Verified user">✓</span>
                )}
              </div>
              {userProfile.displayName && userProfile.displayName !== userProfile.username && (
                <p className="text-sm text-gray-600 ml-7">{userProfile.displayName}</p>
              )}
              {userProfile.bio && (
                <p className="text-sm text-gray-600 mt-1 ml-7 whitespace-pre-line">{userProfile.bio}</p>
              )}
            </div>
          </div>

          {/* Action Buttons with Join Date - Positioned above stats */}
          <div className="flex justify-between items-center mb-4">
            {/* Join Date */}
            {userProfile.createdAt && (
              <p className="text-xs text-gray-500">
                Joined {new Date(userProfile.createdAt.seconds * 1000).toLocaleDateString('en-US', { 
                  month: 'long', 
                  year: 'numeric' 
                })}
              </p>
            )}
            
            {/* Action Buttons */}
            <div className="flex space-x-2">
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
            </div>
          </div>

          {/* Stats Cards - 2x2 Grid */}
          <div className="grid grid-cols-2 gap-3">
            {/* Reviews Card */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
              <div className="flex items-center">
                <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center mr-3">
                  <Star size={20} className="text-red-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-primary">{personalStats.totalReviews}</p>
                  <p className="text-sm text-gray-500">Reviews</p>
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
                  <p className="text-2xl font-bold text-primary">{personalStats.restaurantsTried}</p>
                  <p className="text-sm text-gray-500">Restaurants</p>
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
                  <p className="text-2xl font-bold text-primary">{personalStats.averageRating.toFixed(1)}</p>
                  <p className="text-sm text-gray-500">Avg Rating</p>
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
  <SavedListsTab />
)}
    </div>
  );
};

export default Profile;