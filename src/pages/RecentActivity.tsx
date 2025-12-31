import React, { useState, useEffect } from 'react';
import { ArrowLeftIcon, UserIcon, ClockIcon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { getFollowingActivity } from '../services/followService';

interface ActivityItem {
  id: string;
  authorId: string;
  authorName: string;
  authorImage: string;
  restaurantName: string;
  restaurantId: string;
  dishName?: string;
  dishId?: string;
  rating?: number;
  timestamp: any; // Firebase Timestamp
  isCarousel: boolean;
  visitId?: string;
}

const RecentActivity: React.FC = () => {
  const navigate = useNavigate();
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadRecentActivity();
  }, []);

  // Helper to convert various timestamp formats to Date
  const toDate = (timestamp: any): Date => {
    if (!timestamp) return new Date();

    // Already a Date object
    if (timestamp instanceof Date) {
      return timestamp;
    }

    // Firestore Timestamp with toDate method
    if (timestamp.toDate && typeof timestamp.toDate === 'function') {
      return timestamp.toDate();
    }

    // Plain object with seconds (Firestore Timestamp serialized)
    if (timestamp.seconds) {
      return new Date(timestamp.seconds * 1000);
    }

    // String or number
    return new Date(timestamp);
  };

  const loadRecentActivity = async () => {
    try {
      setLoading(true);
      const activityData = await getFollowingActivity(50); // Get more to filter to 30 days

      // Filter to last 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const recentActivities = activityData.filter((activity: any) => {
        const activityDate = toDate(activity.timestamp);
        return activityDate >= thirtyDaysAgo;
      });

      setActivities(recentActivities);
      setError(null);
    } catch (err) {
      console.error('Failed to load recent activity:', err);
      setError('Failed to load recent activity');
    } finally {
      setLoading(false);
    }
  };

  const formatTimestamp = (timestamp: any): string => {
    const now = new Date();
    const activityTime = toDate(timestamp);
    const diffInMs = now.getTime() - activityTime.getTime();
    const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
    const diffInDays = Math.floor(diffInHours / 24);

    if (diffInHours < 1) {
      const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
      return diffInMinutes <= 1 ? 'Just now' : `${diffInMinutes}m ago`;
    } else if (diffInHours < 24) {
      return `${diffInHours}h ago`;
    } else if (diffInDays === 1) {
      return 'Yesterday';
    } else if (diffInDays < 7) {
      return `${diffInDays} days ago`;
    } else {
      return activityTime.toLocaleDateString();
    }
  };

  const handleActivityClick = (activity: ActivityItem) => {
    // Navigate to the specific post
    if (activity.visitId) {
      // For carousel posts, we'd need to implement a way to navigate to specific visit
      // For now, navigate to restaurant page
      navigate(`/restaurant/${activity.restaurantId}`);
    } else if (activity.dishId) {
      navigate(`/dish/${activity.dishId}`);
    } else {
      navigate(`/restaurant/${activity.restaurantId}`);
    }
  };

  const handleUserClick = (authorName: string) => {
    navigate(`/user/${authorName}`);
  };

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
            <h1 className="text-xl font-bold text-black">Recent Activity</h1>
          </div>
        </div>

        {/* Loading State */}
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-600">Loading recent activity...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-16">
      {/* Header */}
      <div className="bg-white px-4 py-6 shadow-sm">
        <div className="flex items-center">
          <button 
            onClick={() => navigate(-1)}
            className="mr-4 p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <ArrowLeftIcon size={20} className="text-gray-600" />
          </button>
          <h1 className="text-xl font-bold text-black">Recent Activity</h1>
        </div>
        <p className="text-sm text-gray-600 mt-1 ml-12">Last 30 days from people you follow</p>
      </div>

      {/* Content */}
      <div className="px-4 py-6">
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center mb-6">
            <p className="text-red-600">{error}</p>
            <button 
              onClick={loadRecentActivity} 
              className="mt-2 text-red-600 underline text-sm"
            >
              Try Again
            </button>
          </div>
        )}

        {activities.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <UserIcon size={24} className="text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No Recent Activity</h3>
            <p className="text-gray-600 mb-4 max-w-sm mx-auto">
              Follow some users to see their restaurant visits and reviews here!
            </p>
            <button
              onClick={() => navigate('/discover')}
              className="bg-primary text-white py-2 px-6 rounded-full font-medium hover:bg-red-600 transition-colors"
            >
              Discover Restaurants
            </button>
          </div>
        ) : (
          <div className="space-y-1">
            {activities.map((activity) => (
              <div
                key={activity.id}
                onClick={() => handleActivityClick(activity)}
                className="bg-white rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow cursor-pointer border border-gray-100"
              >
                <div className="flex items-start space-x-3">
                  {/* User Avatar */}
                  <img 
                    src={activity.authorImage} 
                    alt={activity.authorName}
                    className="w-10 h-10 rounded-full object-cover flex-shrink-0"
                  />
                  
                  {/* Activity Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-900 leading-5">
                          <span 
                            onClick={(e) => {
                              e.stopPropagation();
                              handleUserClick(activity.authorName);
                            }}
                            className="font-medium hover:text-primary cursor-pointer"
                          >
                            {activity.authorName}
                          </span>
                          {activity.isCarousel ? (
                            <span> visited </span>
                          ) : (
                            <span> reviewed </span>
                          )}
                          {!activity.isCarousel && activity.dishName && (
                            <span className="font-medium">{activity.dishName} at </span>
                          )}
                          <span className="font-medium text-primary">{activity.restaurantName}</span>
                          {!activity.isCarousel && activity.rating && (
                            <span className="text-gray-600"> - {activity.rating}/10</span>
                          )}
                        </p>
                      </div>
                      
                      {/* Timestamp */}
                      <div className="flex items-center text-xs text-gray-500 ml-2 flex-shrink-0">
                        <ClockIcon size={12} className="mr-1" />
                        {formatTimestamp(activity.timestamp)}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default RecentActivity;
