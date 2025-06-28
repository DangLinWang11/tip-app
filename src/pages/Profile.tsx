import React, { useState } from 'react';
import { EditIcon, GridIcon, BookmarkIcon, SearchIcon, PlusIcon, HeartIcon, MessageCircleIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
import { userProfile, profilePosts } from '../utils/mockData';
import FeedPost from '../components/FeedPost';
import HamburgerMenu from '../components/HamburgerMenu';

const LikedPostCard: React.FC<any> = ({ post }) => (
  <Link 
    to={`/post/${post.id}`}
    className="block bg-white rounded-2xl shadow-sm p-4 hover:shadow-md transition-all duration-200 cursor-pointer border border-gray-50"
  >
    <div className="flex items-start space-x-4">
      <img 
        src={post.dish.image} 
        alt={post.dish.name}
        className="w-14 h-14 rounded-xl object-cover flex-shrink-0"
      />
      
      <div className="flex-1 min-w-0">
        <div className="flex items-center mb-2">
          <HeartIcon size={14} className="text-red-500 mr-2 flex-shrink-0" />
          <p className="text-sm text-gray-600 leading-relaxed">
            <span className="font-semibold text-gray-900">You</span>
            <span className="text-gray-500 mx-1">liked</span>
            <span className="font-medium text-gray-900">{post.author.name}</span>'s post
          </p>
        </div>
        
        <div className="flex items-center space-x-2 mb-1">
          <h4 className="text-base font-semibold text-gray-900 truncate">{post.dish.name}</h4>
          <div className="w-6 h-6 bg-primary rounded-full flex items-center justify-center flex-shrink-0">
            <span className="text-white text-xs font-bold">{post.dish.rating}</span>
          </div>
        </div>
        
        <p className="text-sm text-gray-500 flex items-center">
          <span className="mr-1">📍</span>
          <span className="truncate">{post.restaurant.name}</span>
          <span className="mx-2 text-gray-300">•</span>
          <span className="text-green-600 font-medium">{post.restaurant.qualityScore}%</span>
        </p>
      </div>
      
      <div className="text-right flex-shrink-0">
        <div className="text-xs text-gray-400 space-y-1">
          <p className="font-medium">{post.engagement.likes}</p>
          <p className="text-gray-300">likes</p>
        </div>
      </div>
    </div>
  </Link>
);

const CommentedPostCard: React.FC<any> = ({ post }) => (
  <Link 
    to={`/post/${post.id}`}
    className="block bg-white rounded-2xl shadow-sm p-4 hover:shadow-md transition-all duration-200 cursor-pointer border border-gray-50"
  >
    <div className="flex items-start space-x-4">
      <img 
        src={post.dish.image} 
        alt={post.dish.name}
        className="w-14 h-14 rounded-xl object-cover flex-shrink-0"
      />
      
      <div className="flex-1 min-w-0">
        <div className="flex items-center mb-2">
          <MessageCircleIcon size={14} className="text-blue-500 mr-2 flex-shrink-0" />
          <p className="text-sm text-gray-600 leading-relaxed">
            <span className="font-semibold text-gray-900">You</span>
            <span className="text-gray-500 mx-1">commented on</span>
            <span className="font-medium text-gray-900">{post.author.name}</span>'s post
          </p>
        </div>
        
        <div className="flex items-center space-x-2 mb-1">
          <h4 className="text-base font-semibold text-gray-900 truncate">{post.dish.name}</h4>
          <div className="w-6 h-6 bg-primary rounded-full flex items-center justify-center flex-shrink-0">
            <span className="text-white text-xs font-bold">{post.dish.rating}</span>
          </div>
        </div>
        
        <p className="text-sm text-gray-500 flex items-center mb-2">
          <span className="mr-1">📍</span>
          <span className="truncate">{post.restaurant.name}</span>
          <span className="mx-2 text-gray-300">•</span>
          <span className="text-green-600 font-medium">{post.restaurant.qualityScore}%</span>
        </p>
        
        {post.userComment && (
          <div className="mt-2 bg-gray-50 rounded-lg p-3 border-l-3 border-blue-200">
            <p className="text-sm text-gray-700 italic leading-relaxed">
              "{post.userComment.substring(0, 80)}{post.userComment.length > 80 ? '...' : ''}"
            </p>
          </div>
        )}
      </div>
      
      <div className="text-right flex-shrink-0">
        <div className="text-xs text-gray-400 space-y-1">
          <p className="font-medium">{post.engagement.comments}</p>
          <p className="text-gray-300">replies</p>
        </div>
      </div>
    </div>
  </Link>
);

const Profile: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'activity' | 'saved'>('activity');
  const [searchTerm, setSearchTerm] = useState('');

  // Filter posts based on search term
  const filteredPosts = profilePosts.filter(post => 
    searchTerm === '' || 
    post.dish.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    post.restaurant.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    post.author.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-light-gray pb-16">
      <header className="bg-white p-4 sticky top-0 z-10 shadow-sm">
        <div className="flex justify-between items-center">
          <h1 className="text-xl font-semibold">Profile</h1>
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
              <div className="flex text-sm text-dark-gray mt-1">
                <span className="mr-4">{userProfile.stats.followers} Followers</span>
                <span className="mr-4">{userProfile.stats.restaurantsTried} Restaurants</span>
                <span>{userProfile.stats.dishesTried} Dishes</span>
              </div>
              <button className="mt-2 px-4 py-1 border border-medium-gray rounded-full text-sm flex items-center">
                <EditIcon size={16} className="mr-1" />
                Edit Profile
              </button>
            </div>
          </div>
        </div>

        {/* Tier Rankings Section */}
        <div className="px-4 py-3 border-t border-light-gray">
          <div className="space-y-2">
            {/* Top Dish */}
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

            {/* Top Restaurant */}
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
            <span>Recent Activity</span>
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
            <span>Wishlists</span>
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
              placeholder="Search this user's activity"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-medium-gray rounded-full text-sm focus:outline-none focus:border-primary"
            />
          </div>

          <div className="space-y-3">
            {filteredPosts.map(post => {
              if (post.activityType === 'own_post') {
                return <FeedPost key={post.id} {...post} />;
              } else if (post.activityType === 'liked_post') {
                return <LikedPostCard key={post.id} post={post} />;
              } else if (post.activityType === 'commented_post') {
                return <CommentedPostCard key={post.id} post={post} />;
              }
              return null;
            })}
          </div>
        </div>
      ) : (
        <div className="p-4">
          <h3 className="font-semibold mb-3">Your Wishlists</h3>
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