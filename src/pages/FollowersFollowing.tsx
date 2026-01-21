import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Search, User } from 'lucide-react';
import {
  getFollowersWithProfiles,
  getFollowingWithProfiles,
  followUser,
  unfollowUser,
  FollowWithProfile
} from '../services/followService';
import { getUserByUsername, getCurrentUser } from '../lib/firebase';
import { getInitials } from '../utils/avatarUtils';

const FollowersFollowing: React.FC = () => {
  const { username } = useParams<{ username: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const initialTab = searchParams.get('tab') === 'following' ? 'following' : 'followers';
  const [activeTab, setActiveTab] = useState<'followers' | 'following'>(initialTab);
  const [searchQuery, setSearchQuery] = useState('');
  const [followers, setFollowers] = useState<FollowWithProfile[]>([]);
  const [following, setFollowing] = useState<FollowWithProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [followingStates, setFollowingStates] = useState<Record<string, boolean>>({});

  const currentUser = getCurrentUser();

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

  // Load followers and following data
  useEffect(() => {
    const loadData = async () => {
      if (!userId) return;

      setLoading(true);
      try {
        const [followersData, followingData] = await Promise.all([
          getFollowersWithProfiles(userId),
          getFollowingWithProfiles(userId)
        ]);

        setFollowers(followersData);
        setFollowing(followingData);

        // Initialize following states
        const states: Record<string, boolean> = {};
        followersData.forEach(f => {
          states[f.userId] = f.isFollowing || false;
        });
        followingData.forEach(f => {
          states[f.userId] = f.isFollowing || false;
        });
        setFollowingStates(states);
      } catch (error) {
        console.error('Error loading data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [userId]);

  // Handle tab change
  const handleTabChange = (tab: 'followers' | 'following') => {
    setActiveTab(tab);
    setSearchParams({ tab });
  };

  // Handle follow/unfollow
  const handleFollowToggle = async (targetUser: FollowWithProfile) => {
    if (!currentUser || currentUser.uid === targetUser.userId) return;

    const isCurrentlyFollowing = followingStates[targetUser.userId];

    // Optimistic update
    setFollowingStates(prev => ({
      ...prev,
      [targetUser.userId]: !isCurrentlyFollowing
    }));

    try {
      if (isCurrentlyFollowing) {
        await unfollowUser(targetUser.userId);
      } else {
        await followUser(targetUser.userId, targetUser.username);
      }
    } catch (error) {
      // Revert on error
      setFollowingStates(prev => ({
        ...prev,
        [targetUser.userId]: isCurrentlyFollowing
      }));
      console.error('Error toggling follow:', error);
    }
  };

  // Filter users based on search query
  const filterUsers = (users: FollowWithProfile[]) => {
    if (!searchQuery.trim()) return users;
    const query = searchQuery.toLowerCase();
    return users.filter(
      user =>
        user.username.toLowerCase().includes(query) ||
        (user.actualName && user.actualName.toLowerCase().includes(query))
    );
  };

  const displayedUsers = activeTab === 'followers'
    ? filterUsers(followers)
    : filterUsers(following);

  // User list item component
  const UserListItem: React.FC<{ user: FollowWithProfile }> = ({ user }) => {
    const [imageError, setImageError] = useState(false);
    const isOwnProfile = currentUser?.uid === user.userId;
    const isFollowingUser = followingStates[user.userId];

    return (
      <div className="flex items-center p-4 hover:bg-gray-50 transition-colors">
        {/* Avatar */}
        <button
          onClick={() => navigate(`/user/${user.username}`)}
          className="flex-shrink-0"
        >
          {user.avatar && !imageError ? (
            <img
              src={user.avatar}
              alt={user.username}
              className="w-12 h-12 rounded-full object-cover"
              onError={() => setImageError(true)}
            />
          ) : (
            <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center">
              <span className="text-white font-semibold text-sm">
                {getInitials(user.username, user.actualName)}
              </span>
            </div>
          )}
        </button>

        {/* User info */}
        <button
          onClick={() => navigate(`/user/${user.username}`)}
          className="ml-3 flex-1 text-left"
        >
          <p className="font-medium text-gray-900">
            {user.actualName || user.username}
          </p>
          <p className="text-sm text-gray-500">@{user.username}</p>
        </button>

        {/* Follow/Unfollow button */}
        {!isOwnProfile && (
          <button
            onClick={() => handleFollowToggle(user)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
              isFollowingUser
                ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                : 'bg-primary text-white hover:bg-red-600'
            }`}
          >
            {isFollowingUser ? 'Following' : 'Follow'}
          </button>
        )}
      </div>
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
            @{username}
          </h1>
        </div>
      </header>

      {/* Tabs */}
      <div className="bg-white border-b border-gray-200">
        <div className="flex">
          <button
            onClick={() => handleTabChange('followers')}
            className={`flex-1 py-3 text-center font-medium transition-colors relative ${
              activeTab === 'followers'
                ? 'text-gray-900'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Followers
            {activeTab === 'followers' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
            )}
          </button>
          <button
            onClick={() => handleTabChange('following')}
            className={`flex-1 py-3 text-center font-medium transition-colors relative ${
              activeTab === 'following'
                ? 'text-gray-900'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Following
            {activeTab === 'following' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
            )}
          </button>
        </div>
      </div>

      {/* Search bar */}
      <div className="bg-white px-4 py-3 border-b border-gray-100">
        <div className="relative">
          <Search
            size={18}
            className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"
          />
          <input
            type="text"
            placeholder="Search users..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-gray-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:bg-white transition-colors"
          />
        </div>
      </div>

      {/* User list */}
      <div className="bg-white">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : displayedUsers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-gray-500">
            <User size={48} className="mb-2 text-gray-300" />
            <p>
              {searchQuery
                ? 'No users found'
                : activeTab === 'followers'
                ? 'No followers yet'
                : 'Not following anyone yet'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {displayedUsers.map(user => (
              <UserListItem key={user.id} user={user} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default FollowersFollowing;
