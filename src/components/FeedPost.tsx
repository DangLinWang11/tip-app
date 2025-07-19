import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { HeartIcon, MessageCircleIcon, BookmarkIcon, ShareIcon, CheckCircleIcon, MapPinIcon } from 'lucide-react';
import RatingBadge from './RatingBadge';
import { useFeature } from '../utils/features';

interface CarouselItem {
  id: string;
  dishId?: string;
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
  tags: string[];
  price?: string;
}

interface FeedPostProps {
  id: string;
  visitId?: string;
  restaurantId?: string;
  dishId?: string;
  isCarousel?: boolean;
  carouselItems?: CarouselItem[];
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
  visitId,
  restaurantId,
  dishId,
  isCarousel = false,
  carouselItems = [],
  author,
  restaurant,
  dish,
  review,
  engagement
}) => {
  const navigate = useNavigate();
  const [saved, setSaved] = useState(false);
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(engagement.likes || 0);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [touchStart, setTouchStart] = useState(0);
  const [touchEnd, setTouchEnd] = useState(0);
  const imageRef = useRef<HTMLDivElement>(null);
  
  // Feature flags
  const showLikesComments = useFeature('LIKES_COMMENTS');
  const showSocialSharing = useFeature('SOCIAL_SHARING');

  // Get current item to display (carousel or single)
  const currentItem = isCarousel && carouselItems.length > 0 
    ? carouselItems[currentIndex] 
    : { 
        id: dishId || '',
        dishId, 
        dish, 
        review, 
        tags: [], 
        price: undefined 
      };

  // Function to get quality circle color based on percentage
  const getQualityColor = (score: number): string => {
    if (score >= 95) return '#10B981'; // Green
    if (score >= 85) return '#34D399'; // Light green
    if (score >= 75) return '#10B981'; // Green
    if (score >= 60) return '#FCD34D'; // Yellow
    if (score >= 45) return '#FB923C'; // Orange
    if (score >= 30) return '#EF4444'; // Red-orange
    return '#EF4444'; // Red
  };

  // Handle touch events for swipe
  const handleTouchStart = (e: React.TouchEvent) => {
    if (!isCarousel || carouselItems.length <= 1) return;
    setTouchStart(e.targetTouches[0].clientX);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isCarousel || carouselItems.length <= 1) return;
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const handleTouchEnd = () => {
    if (!isCarousel || carouselItems.length <= 1) return;
    if (!touchStart || !touchEnd) return;
    
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > 50;
    const isRightSwipe = distance < -50;

    if (isLeftSwipe && currentIndex < carouselItems.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
    if (isRightSwipe && currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  // Handle dot click
  const handleDotClick = (index: number) => {
    setCurrentIndex(index);
  };

  // Handle dish navigation
  const handleDishClick = () => {
    if (currentItem.dishId) {
      navigate(`/dish/${currentItem.dishId}`);
    } else if (restaurantId) {
      navigate(`/restaurant/${restaurantId}`);
    }
  };

  return (
    <div className="bg-white rounded-2xl overflow-hidden shadow-sm mb-4">
      {/* Header */}
      <div className="p-4 flex items-center gap-4">
        <img src={author.image} alt={author.name} className="w-10 h-10 rounded-full object-cover" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="font-medium">{author.name}</span>
            {author.isVerified && <CheckCircleIcon size={16} className="text-secondary" />}
          </div>
          {restaurant && (
            <div className="text-sm text-dark-gray flex items-center gap-1.5 mt-0.5">
              <MapPinIcon size={14} className="text-red-500" />
              <span 
                onClick={() => restaurantId && navigate(`/restaurant/${restaurantId}`)}
                className={`max-w-32 truncate ${restaurantId ? "hover:text-primary cursor-pointer" : ""}`}
              >
                {restaurant.name}
              </span>
              {restaurant.isVerified && <CheckCircleIcon size={14} className="text-secondary" />}
              {restaurant.qualityScore && (
                <div 
                  className="w-8 h-5 flex items-center justify-center rounded-full"
                  style={{ backgroundColor: getQualityColor(restaurant.qualityScore) }}
                >
                  <span className="text-xs font-medium text-white">{restaurant.qualityScore}%</span>
                </div>
              )}
            </div>
          )}
        </div>
        <div className="flex-shrink-0">
          <RatingBadge rating={currentItem.dish.rating} size="md" />
        </div>
      </div>
      
      {/* Image with Carousel Support */}
      <div className="relative">
        <div
          ref={imageRef}
          className="relative overflow-hidden"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <div className="flex transition-transform duration-300 ease-out" style={{ transform: `translateX(-${currentIndex * 100}%)` }}>
            {isCarousel && carouselItems.length > 1 ? (
              carouselItems.map((item, index) => (
                <img 
                  key={item.id}
                  src={item.dish.image} 
                  alt={item.dish.name} 
                  className="w-full aspect-square object-cover flex-shrink-0" 
                />
              ))
            ) : (
              <img 
                src={currentItem.dish.image} 
                alt={currentItem.dish.name} 
                className="w-full aspect-square object-cover flex-shrink-0" 
              />
            )}
          </div>
          {currentItem.dish.visitCount && (
            <div className="absolute top-4 right-4 bg-black bg-opacity-50 text-white px-3 py-1 rounded-full text-sm">
              Visited {currentItem.dish.visitCount}x
            </div>
          )}
        </div>
        
      </div>
      
        {/* Carousel Dots */}
        {isCarousel && carouselItems.length > 1 && (
          <div className="flex justify-center items-center space-x-1 py-2">
            {carouselItems.map((_, index) => (
              <button
                key={index}
                onClick={() => handleDotClick(index)}
                className={`rounded-full transition-all duration-200 ${
                  index === currentIndex 
                    ? 'w-3 h-3 bg-red-500' 
                    : 'w-2 h-2 bg-red-300'
                }`}
              />
            ))}
          </div>
        )}
      
      {/* Content */}
      <div className="p-4">
        <h3 className="font-medium text-lg mb-2">
          <span 
            onClick={handleDishClick}
            className={(currentItem.dishId || restaurantId) ? "hover:text-primary cursor-pointer" : ""}
          >
            {isCarousel && carouselItems.length > 1 
              ? `${currentItem.dish.name} (${currentIndex + 1}/${carouselItems.length})`
              : currentItem.dish.name
            }
          </span>
        </h3>
        
        {/* Dual Review System - Show current item's review */}
        <div className="space-y-2 mb-4">
          <div className="flex items-start">
            <div className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center mr-2 flex-shrink-0">
              <span className="text-green-600">+</span>
            </div>
            <p className="text-sm flex-1 leading-6">{currentItem.review.positive}</p>
          </div>
          <div className="flex items-start">
            <div className="w-6 h-6 rounded-full bg-red-100 flex items-center justify-center mr-2 flex-shrink-0">
              <span className="text-red-600">-</span>
            </div>
            <p className="text-sm flex-1 leading-6">{currentItem.review.negative}</p>
          </div>
        </div>


        {/* Review Date */}
        <div className="text-xs text-gray-500 mb-4">
          Reviewed on {currentItem.review.date}
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
            <div className="flex items-center justify-between w-full">
                <div className="flex items-center space-x-4">
                  <button 
                    onClick={() => {
                      setLiked(!liked);
                      setLikeCount(prev => liked ? prev - 1 : prev + 1);
                    }}
                    className="flex items-center text-gray-600 hover:text-red-500 transition-colors"
                  >
                    <HeartIcon 
                      size={20} 
                      className={`mr-1 ${liked ? 'fill-red-500 text-red-500' : ''}`} 
                    />
                    <span className="text-sm">{likeCount}</span>
                  </button>
                </div>
                <div className="flex items-center space-x-3">
                  <button className="flex items-center text-sm text-gray-600 hover:text-primary">
                    <BookmarkIcon size={18} className={saved ? 'text-primary fill-primary mr-1' : 'text-gray-600 mr-1'} />
                    {saved ? 'Saved' : 'Save'}
                  </button>
                  <button 
                    onClick={() => {
                      if (navigator.share) {
                        navigator.share({
                          title: `${currentItem.dish.name} at ${restaurant?.name}`,
                          text: `Check out this ${currentItem.dish.rating}/10 rated dish!`,
                          url: window.location.href
                        });
                      }
                    }}
                    className="text-gray-600 hover:text-blue-500 transition-colors"
                  >
                    <ShareIcon size={18} />
                  </button>
                </div>
              </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FeedPost;