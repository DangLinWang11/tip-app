import React, { useState, useEffect } from 'react';
import { EditIcon, GridIcon, BookmarkIcon, SearchIcon, PlusIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
import { userProfile } from '../utils/mockData';
import FeedPost from '../components/FeedPost';
import HamburgerMenu from '../components/HamburgerMenu';
import { useFeature } from '../utils/features';
import { fetchReviews, convertReviewToFeedPost, FirebaseReview } from '../services/reviewService';

const Profile: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'activity' | 'saved'>('activity');
  const [searchTerm, setSearchTerm] = useState('');
  const [firebaseReviews, setFirebaseReviews] = useState<FirebaseReview[]>([]);
  const [feedPosts, setFeedPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Feature flags
  const showTierRankings = useFeature('TIER_RANKINGS');
  const showSocialActivity = useFeature('SOCIAL_FEED');
  
  // Fetch reviews from Firebase on component mount
  useEffect(() => {
    const loadReviews = async () => {
      try {
        setLoading(true);
        const reviews = await fetchReviews(50);
        setFirebaseReviews(reviews);
        
        // Convert Firebase reviews to feed post format
        const posts = reviews.map(convertReviewToFeedPost);
        setFeedPosts(posts);
      } catch (err) {
        console.error('Failed to load reviews:', err);
        setFeedPosts([]);
      } finally {
        setLoading(false);
      }
    };
    
    loadReviews();
  }, []);

  // Filter posts based on search term
  const filteredPosts = feedPosts.filter(post => 
    searchTerm === '' || 
    post.dish.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    post.restaurant?.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Calculate personal stats from Firebase reviews
  const personalStats = {
    totalReviews: firebaseReviews.length,
    restaurantsTried: new Set(firebaseReviews.map(r => r.restaurant).filter(Boolean)).size,
    averageRating: firebaseReviews.length > 0 
      ? (firebaseReviews.reduce((sum, r) => sum + r.rating, 0) / firebaseReviews.length).toFixed(1)
      : '0.0'
  };

  return (
    <div className="min-h-screen bg-light-gray pb-16">
      <header className="bg-white p-4 sticky top-0 z-10 shadow-sm">
        <div className="flex justify-between items-center">
          <h1 className="text-xl font-semibold">My Profile</h1>
          <HamburgerMenu />
        </div>
      </header>

      <div className="bg-white shadow-sm">
        <div className="p-4">
          <div className="flex items-center">
            <img 
              src={userProfile.avatar} 
              alt={userProfile.name} 
              className="w-20 h-20 rounded-full object-cover border-2 border-primary" 
            />
            <div className="ml-4 flex-1">
              <h2 className="font-semibold text-lg">@{userProfile.username}</h2>
              
              {/* MVP Stats - Personal Only */}
              <div className="flex text-sm text-dark-gray mt-1">
                <span className="mr-4">{personalStats.totalReviews} Reviews</span>
                <span className="mr-4">{personalStats.restaurantsTried} Restaurants</span>
                <span>{personalStats.averageRating} Avg Rating</span>
              </div>
              
              <button className="mt-2 px-4 py-1 border border-medium-gray rounded-full text-sm flex items-center">
                <EditIcon size={16} className="mr-1" />
                Edit Profile
              </button>
            </div>
          </div>
        </div>

        {/* Tier Rankings Section - Only if feature enabled */}
        {showTierRankings && (
          <div className="px-4 py-3 border-t border-light-gray">
            <div className="space-y-2">
              <div className="flex items-center">
                <span className="text-lg mr-2">🏆</span>
                <span className="text-sm font-medium mr-2">Top Dish:</span>
                <Link 
                  to={`/dish/${userProfile.tierRankings.topDish.dishId}`}
                  className="text-black hover:text-primary transition-colors"
                >
                  <span className="font-medium">{userProfile.tierRankings.topDish.name}</span>
                </Link>
                <span className="ml-1 text-primary font-medium">({userProfile.tierRankings.topDish.rating})</span>
                <span className="ml-2 bg-gray-100 px-2 py-1 rounded-full text-xs text-dark-gray">
                  Tried {userProfile.tierRankings.topDish.visitCount}x
                </span>
              </div>

              <div className="flex items-center">
                <span className="text-lg mr-2">🥇</span>
                <span className="text-sm font-medium mr-2">Top Restaurant:</span>
                <Link 
                  to={`/restaurant/${userProfile.tierRankings.topRestaurant.restaurantId}`}
                  className="text-black hover:text-primary transition-colors"
                >
                  <span className="font-medium">{userProfile.tierRankings.topRestaurant.name}</span>
                </Link>
                <span className="ml-1 text-primary font-medium">({userProfile.tierRankings.topRestaurant.qualityPercentage}%)</span>
                <span className="ml-2 bg-gray-100 px-2 py-1 rounded-full text-xs text-dark-gray">
                  Been {userProfile.tierRankings.topRestaurant.visitCount}x
                </span>
              </div>
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
          {filteredPosts.length === 0 ? (
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
              {loading ? (
                <div className="text-center py-8">
                  <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                  <p className="text-gray-600">Loading reviews...</p>
                </div>
              ) : filteredPosts.length > 0 ? (
                filteredPosts.map(post => (
                  <FeedPost key={post.id} {...post} />
                ))
              ) : (
                <div className="text-center py-8">
                  <p className="text-gray-600">No reviews found</p>
                  <Link 
                    to="/create" 
                    className="mt-4 inline-block bg-primary text-white py-2 px-6 rounded-full font-medium hover:bg-red-600 transition-colors"
                  >
                    Create Your First Review
                  </Link>
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="p-4">
          <h3 className="font-semibold mb-3">Saved Reviews</h3>
          <div className="space-y-4">
            {userProfile.wishlists.map((wishlist) => (
              <div key={wishlist.id} className="bg-white rounded-xl shadow-sm overflow-hidden">
                <div className="relative">
                  <img 
                    src={wishlist.coverImage} 
                    alt={wishlist.name} 
                    className="w-full h-32 object-cover" 
                  />
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-3">
                    <h4 className="text-white font-medium">{wishlist.name}</h4>
                    <p className="text-white text-sm">
                      {wishlist.count} {wishlist.type}
                    </p>
                  </div>
                  <div className="absolute top-2 right-2 bg-white/90 px-2 py-1 rounded-full text-xs font-medium">
                    {wishlist.type === 'restaurants' ? '🏪' : '🍽️'} {wishlist.type}
                  </div>
                </div>
              </div>
            ))}
            
            <div className="grid grid-cols-2 gap-3">
              <button className="py-4 border border-dashed border-dark-gray rounded-xl flex flex-col items-center justify-center">
                <PlusIcon size={20} className="mb-1" />
                <span className="text-sm">Restaurant List</span>
              </button>
              <button className="py-4 border border-dashed border-dark-gray rounded-xl flex flex-col items-center justify-center">
                <PlusIcon size={20} className="mb-1" />
                <span className="text-sm">Menu Items</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Profile;