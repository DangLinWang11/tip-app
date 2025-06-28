import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { HeartIcon, MessageCircleIcon, BookmarkIcon, ShareIcon, CheckCircleIcon, MapPinIcon } from 'lucide-react';
import RatingBadge from './RatingBadge';

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
    qualityScore?: number; // Added for restaurant quality percentage
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
  const [liked, setLiked] = useState(false);
  const [saved, setSaved] = useState(false);

  // Function to get quality circle color based on percentage
  const getQualityColor = (score: number): string => {
    if (score >= 95) return 'bg-yellow-400'; // Gold
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
              {restaurantId ? (
                <Link to={`/restaurant/${restaurantId}`} className="hover:text-primary">
                  {restaurant.name}
                </Link>
              ) : (
                <span>{restaurant.name}</span>
              )}
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
          {dishId ? (
            <Link to={`/dish/${dishId}`} className="hover:text-primary">
              {dish.name}
            </Link>
          ) : restaurantId ? (
            <Link to={`/restaurant/${restaurantId}/menu`} className="hover:text-primary">
              {dish.name}
            </Link>
          ) : (
            dish.name
          )}
        </h3>
        <div className="space-y-2 mb-4">
          <div className="flex items-start">
            <div className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center mr-2 mt-1">
              <span className="text-green-600">+</span>
            </div>
            <p className="text-sm flex-1">{review.positive}</p>
          </div>
          <div className="flex items-start">
            <div className="w-6 h-6 rounded-full bg-red-100 flex items-center justify-center mr-2 mt-1">
              <span className="text-red-600">-</span>
            </div>
            <p className="text-sm flex-1">{review.negative}</p>
          </div>
        </div>
        
        {/* Engagement */}
        <div className="flex justify-between items-center pt-3 border-t border-light-gray">
          <div className="flex items-center space-x-4">
            <button onClick={() => setLiked(!liked)} className="flex items-center">
              <HeartIcon size={22} className={liked ? 'text-primary fill-primary' : 'text-dark-gray'} />
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
            <button>
              <ShareIcon size={22} className="text-dark-gray" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FeedPost;