import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { HeartIcon, MessageCircleIcon, BookmarkIcon, ShareIcon, CheckCircleIcon, MapPinIcon } from 'lucide-react';
import RatingBadge from './RatingBadge';
import { useFeature } from '../utils/features';

interface FeedPostProps {
  id: string;
  restaurantId?: string;
  dishId?: string;
  author: {
    name: string;
    image: string;
    isVerified?: boolean;
    isRestaurant?: boolean;
  };
  restaurant?: {
    name: string;
    isVerified?: boolean;
    qualityScore?: number;
  };
  dish: {
    name: string;
    image: string;
    rating: number;
    visitCount?: number;
  };
  review: {
    positive: string;
    negative: string;
    date: string;
  };
  engagement: {
    likes: number;
    comments: number;
  };
}

const FeedPost: React.FC<FeedPostProps> = ({
  restaurantId,
  dishId,
  author,
  restaurant,
  dish,
  review,
  engagement
}) => {
  const navigate = useNavigate();
  const [saved, setSaved] = useState(false);
  
  // Feature flags
  const showLikesComments = useFeature('LIKES_COMMENTS');
  const showSocialSharing = useFeature('SOCIAL_SHARING');

  // Function to get quality circle color based on percentage
  const getQualityColor = (score: number): string => {
    if (score >= 95) return 'bg-green-500'; // Green
    if (score >= 85) return 'bg-lime-400';   // Yellow-Green
    if (score >= 75) return 'bg-green-400';  // Green
    if (score >= 60) return 'bg-yellow-500'; // Yellow
    if (score >= 45) return 'bg-orange-400'; // Orange
    if (score >= 30) return 'bg-red-400';    // Orange-Red
    return 'bg-red-600';                     // Red
  };

  return (
    <div className="bg-white rounded-2xl overflow-hidden shadow-sm mb-4">
      {/* Header */}
      <div className="p-4 flex items-center">
        <img src={author.image} alt={author.name} className="w-10 h-10 rounded-full object-cover" />
        <div className="ml-3 flex-1">
          <div className="flex items-center">
            <span className="font-medium">{author.name}</span>
            {author.isVerified && <CheckCircleIcon size={16} className="ml-1 text-secondary" />}
          </div>
          {restaurant && (
            <div className="text-sm text-dark-gray flex items-center">
              <MapPinIcon size={14} className="text-red-500 mr-1" />
              <span 
                onClick={() => restaurantId && navigate(`/restaurant/${restaurantId}`)}
                className={restaurantId ? "hover:text-primary cursor-pointer" : ""}
              >
                {restaurant.name}
              </span>
              {restaurant.isVerified && <CheckCircleIcon size={14} className="ml-1 text-secondary" />}
              {restaurant.qualityScore && (
                <>
                  <span className="ml-2">{restaurant.qualityScore}%</span>
                  <div 
                    className={`w-3 h-3 rounded-full ml-1 ${getQualityColor(restaurant.qualityScore)}`}
                    title={`Restaurant Quality: ${restaurant.qualityScore}%`}
                  />
                </>
              )}
            </div>
          )}
        </div>
        <RatingBadge rating={dish.rating} size="md" />
      </div>
      
      {/* Image */}
      <div className="relative">
        <img src={dish.image} alt={dish.name} className="w-full aspect-square object-cover" />
        {dish.visitCount && (
          <div className="absolute top-4 right-4 bg-black bg-opacity-50 text-white px-3 py-1 rounded-full text-sm">
            Visited {dish.visitCount}x
          </div>
        )}
      </div>
      
      {/* Content */}
      <div className="p-4">
        <h3 className="font-medium text-lg mb-2">
          <span 
            onClick={() => {
              if (dishId) {
                navigate(`/dish/${dishId}`);
              } else if (restaurantId) {
                navigate(`/restaurant/${restaurantId}`);
              }
            }}
            className={(dishId || restaurantId) ? "hover:text-primary cursor-pointer" : ""}
          >
            {dish.name}
          </span>
        </h3>
        
        {/* Dual Review System */}
        <div className="space-y-2 mb-4">
          <div className="flex items-start">
            <div className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center mr-2 flex-shrink-0">
              <span className="text-green-600">+</span>
            </div>
            <p className="text-sm flex-1 leading-6">{review.positive}</p>
          </div>
          <div className="flex items-start">
            <div className="w-6 h-6 rounded-full bg-red-100 flex items-center justify-center mr-2 flex-shrink-0">
              <span className="text-red-600">-</span>
            </div>
            <p className="text-sm flex-1 leading-6">{review.negative}</p>
          </div>
        </div>

        {/* Review Date */}
        <div className="text-xs text-gray-500 mb-4">
          Reviewed on {review.date}
        </div>
        
        {/* Engagement - Conditional based on features */}
        <div className="flex justify-between items-center pt-3 border-t border-light-gray">
          {showLikesComments ? (
            <>
              <div className="flex items-center space-x-4">
                <button className="flex items-center">
                  <HeartIcon size={22} className="text-dark-gray" />
                  <span className="ml-1 text-sm">{engagement.likes}</span>
                </button>
                <button className="flex items-center">
                  <MessageCircleIcon size={22} className="text-dark-gray" />
                  <span className="ml-1 text-sm">{engagement.comments}</span>
                </button>
              </div>
              <div className="flex items-center space-x-4">
                <button onClick={() => setSaved(!saved)}>
                  <BookmarkIcon size={22} className={saved ? 'text-secondary fill-secondary' : 'text-dark-gray'} />
                </button>
                {showSocialSharing && (
                  <button>
                    <ShareIcon size={22} className="text-dark-gray" />
                  </button>
                )}
              </div>
            </>
          ) : (
            /* MVP: Show only save functionality */
            <div className="flex justify-between items-center w-full">
              <div className="text-sm text-gray-600">
                Rating: <span className="font-medium text-primary">{dish.rating}/10</span>
              </div>
              <button onClick={() => setSaved(!saved)} className="flex items-center text-sm text-gray-600 hover:text-primary">
                <BookmarkIcon size={18} className={saved ? 'text-primary fill-primary mr-1' : 'text-gray-600 mr-1'} />
                {saved ? 'Saved' : 'Save'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FeedPost;