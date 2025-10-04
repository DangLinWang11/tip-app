import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  HeartIcon,
  MessageCircleIcon,
  BookmarkIcon,
  ShareIcon,
  CheckCircleIcon,
  MapPinIcon,
  PlusIcon,
} from 'lucide-react';
import { MoreHorizontal as DotsIcon } from 'lucide-react';
import RatingBadge from './RatingBadge';
import { useFeature } from '../utils/features';
import SaveToListModal from './SaveToListModal';
import { isFollowing, followUser, unfollowUser } from '../services/followService';
import { getCurrentUser } from '../lib/firebase';
import { deleteReview, reportReview } from '../services/reviewService';

interface FeedPostReview {
  positive: string;
  negative: string;
  date: string;
  caption?: string;
  coreDetails?: string[];
}

interface CarouselItem {
  id: string;
  reviewId?: string;
  dishId?: string;
  dish: {
    name: string;
    image: string;
    rating: number;
    visitCount?: number;
  };
  review: FeedPostReview;
  tags: string[];
  price?: string;
}

interface FeedPostProps {
  id: string; // This should be the review document ID from Firebase
  visitId?: string;
  restaurantId?: string;
  dishId?: string;
  isCarousel?: boolean;
  carouselItems?: CarouselItem[];
  author: {
    id: string; // NEW: Added authorId
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
  review: FeedPostReview;
  engagement: {
    likes: number;
    comments: number;
  };
  topComment?: {
    author: string;
    text: string;
  };
}

const FeedPost: React.FC<FeedPostProps> = ({
  id, // Review document ID from Firebase
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
  // Log all IDs received by FeedPost component
  console.log('ðŸ“ [FeedPost] Component initialized with IDs:', {
    id: id,
    visitId: visitId,
    restaurantId: restaurantId,
    dishId: dishId,
    isCarousel: isCarousel,
    carouselItemsCount: carouselItems.length,
    dishName: dish.name,
    restaurantName: restaurant?.name
  });

  const navigate = useNavigate();
  const [saved, setSaved] = useState(false);
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(engagement.likes || 0);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [touchStart, setTouchStart] = useState(0);
  const [touchEnd, setTouchEnd] = useState(0);
  const imageRef = useRef<HTMLDivElement>(null);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [isActionSheetOpen, setIsActionSheetOpen] = useState(false);
  
  // NEW: Follow state management
  const [isFollowingUser, setIsFollowingUser] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const currentUser = getCurrentUser();
  const isOwnPost = currentUser?.uid === author.id;

  // Feature flags
  const showLikesComments = useFeature('LIKES_COMMENTS');
  const showSocialSharing = useFeature('SOCIAL_SHARING');

  // NEW: Check follow status on component mount
  useEffect(() => {
    const checkFollowStatus = async () => {
      if (!isOwnPost && author.id) {
        const following = await isFollowing(author.id);
        setIsFollowingUser(following);
      }
    };
    checkFollowStatus();
  }, [author.id, isOwnPost]);

  // NEW: Handle follow/unfollow
  const handleFollowToggle = async (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent navigation to profile
    if (followLoading || isOwnPost) return;

    setFollowLoading(true);
    try {
      if (isFollowingUser) {
        const success = await unfollowUser(author.id);
        if (success) setIsFollowingUser(false);
      } else {
        const success = await followUser(author.id, author.name);
        if (success) setIsFollowingUser(true);
      }
    } catch (error) {
      console.error('Error toggling follow:', error);
    } finally {
      setFollowLoading(false);
    }
  };

  // NEW: Handle username click to navigate to profile
  const handleUsernameClick = () => {
    if (isOwnPost) {
      navigate('/profile');
    } else {
      navigate(`/user/${author.name}`);
    }
  };

  // Get current item to display (carousel or single)
  const currentItem = isCarousel && carouselItems.length > 0 
    ? carouselItems[currentIndex] 
    : { 
        id,
        reviewId: id,
        dishId, 
        dish, 
        review, 
        tags: [], 
        price: undefined 
      };

  // Function to get quality circle color based on percentage
  const getQualityColor = (percentage: number): string => {
    if (percentage >= 95) return '#059669'; // Bright Green (95-100%)
    if (percentage >= 90) return '#10B981'; // Green (90-94%)
    if (percentage >= 85) return '#34D399'; // Light Green (85-89%)
    if (percentage >= 80) return '#6EE7B7'; // Yellow-Green (80-84%)
    if (percentage >= 75) return '#FDE047'; // Yellow (75-79%)
    if (percentage >= 70) return '#FACC15'; // Orange-Yellow (70-74%)
    if (percentage >= 65) return '#F59E0B'; // Orange (65-69%)
    if (percentage >= 60) return '#F97316'; // Red-Orange (60-64%)
    if (percentage >= 55) return '#FB7185'; // Light Red (55-59%)
    return '#EF4444'; // Red (0-54%)
  };

  // Function to format timestamp Instagram-style
  const formatInstagramTimestamp = (dateString: string): string => {
    const reviewDate = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - reviewDate.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffHours < 24) {
      return `${diffHours}h`;
    } else if (diffDays <= 30) {
      return `${diffDays}d`;
    } else {
      // Format as M/D/YY
      const month = reviewDate.getMonth() + 1;
      const day = reviewDate.getDate();
      const year = reviewDate.getFullYear().toString().slice(-2);
      return `${month}/${day}/${year}`;
    }
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

  const handleDotClick = (index: number) => {
    setCurrentIndex(index);
  };

  const handleDishClick = () => {
    if (currentItem.dishId) {
      navigate(`/dish/${currentItem.dishId}`);
    } else if (restaurantId) {
      navigate(`/restaurant/${restaurantId}`);
    }
  };

  const handleDeletePost = async () => {
    const confirmed = window.confirm('Are you sure you want to delete this post? This action cannot be undone.');
    if (!confirmed) return;

    const reviewPayload: { id?: string; reviewId?: string } | undefined = isCarousel
      ? currentItem
      : { id };

    console.log('handleDeletePost id=', reviewPayload?.id, 'typeof', typeof reviewPayload?.id, 'payload', reviewPayload);

    const reviewIdForDeletion = reviewPayload?.id ?? reviewPayload?.reviewId ?? id;

    if (!reviewIdForDeletion) {
      console.error('Unable to determine review ID for deletion', reviewPayload);
      alert('Failed to determine review ID. Please try again.');
      return;
    }

    try {
      await deleteReview(reviewIdForDeletion);
      window.location.reload();
    } catch (error) {
      console.error('Error deleting post:', error);
      alert('Failed to delete post. Please try again.');
    }
  };


  return (
    <div className="relative bg-white rounded-2xl overflow-hidden shadow-sm mb-4">
      {/* Absolute rating (bigger, nudged down & left) */}
      <div className="pointer-events-none absolute top-5 right-5 z-10">
        <RatingBadge rating={currentItem.dish.rating} size="xl" />
      </div>

      {/* Header */}
      <div className="p-4 flex items-center gap-4">
        <img src={author.image} alt={author.name} className="w-10 h-10 rounded-full object-cover" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            {/* NEW: Username area with follow button */}
            <div className="relative flex items-center">
              <span 
                onClick={handleUsernameClick}
                className="font-medium cursor-pointer hover:text-primary"
              >
                {author.name}
              </span>
              {/* NEW: Follow button (+ icon in top-right of username area) */}
              {!isOwnPost && (
                <button
                  onClick={handleFollowToggle}
                  disabled={followLoading}
                  className={`ml-0.5 -mt-1 w-5 h-5 rounded-full border flex items-center justify-center transition-all duration-200 ${
                    isFollowingUser 
                      ? 'bg-green-100 border-green-300 text-green-600 hover:bg-green-200' 
                      : 'border-gray-300 text-gray-500 hover:border-primary hover:text-primary'
                  } ${followLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                >
                  {isFollowingUser ? (
                    <CheckCircleIcon size={12} className="text-green-600" />
                  ) : (
                    <PlusIcon size={12} />
                  )}
                </button>
              )}
            </div>
            {/* NEW: Checkmark that changes color based on follow status */}
            {author.isVerified && (
              <CheckCircleIcon 
                size={16} 
                className={isFollowingUser ? 'text-green-500' : 'text-gray-400'} 
              />
            )}
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
              {restaurant.qualityScore !== undefined && (
                <div 
                  className="w-8 h-5 flex items-center justify-center rounded-full"
                  style={{ backgroundColor: getQualityColor(restaurant.qualityScore) }}
                >
                  <span className="text-xs font-medium text-white">
                    {restaurant.qualityScore}%
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      
      {/* Rest of component remains the same... */}
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
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <h3 className="font-medium text-lg">
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
            <span className="text-xs text-gray-400">
              {formatInstagramTimestamp(currentItem.review.date)}
            </span>
          </div>

          {/* NEW: overflow trigger (always visible) */}
          <button
            onClick={() => setIsActionSheetOpen(true)}
            className="text-gray-500 hover:text-gray-800 p-1 rounded-md"
            aria-label="More options"
          >
            <DotsIcon size={18} />
          </button>
        </div>
        
        {/* New caption (if present) */}
        {currentItem.review.caption && (
          <p className="text-sm text-gray-700 mb-2">{currentItem.review.caption}</p>
        )}

        {/* New core details as chips (if present) */}
        {Array.isArray(currentItem.review.coreDetails) && currentItem.review.coreDetails.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-2">
            {currentItem.review.coreDetails.map((cd, i) => (
              <span key={i} className="inline-flex items-center rounded-full border px-2.5 py-1 text-xs text-neutral-700 border-neutral-200 bg-white">
                {cd}
              </span>
            ))}
          </div>
        )}

        {/* Dual Review System */}
        {!(currentItem.review.caption || (currentItem.review.coreDetails && currentItem.review.coreDetails.length)) && (
          <div className="space-y-1 mb-2">
            <div className="flex items-start">
              <div className="w-5 h-5 rounded-full bg-green-100 flex items-center justify-center mr-2 flex-shrink-0">
                <span className="text-green-600 text-xs">+</span>
              </div>
              <p className="text-xs flex-1 leading-5">{currentItem.review.positive}</p>
            </div>
            <div className="flex items-start">
              <div className="w-5 h-5 rounded-full bg-red-100 flex items-center justify-center mr-2 flex-shrink-0">
                <span className="text-red-600 text-xs">-</span>
              </div>
              <p className="text-xs flex-1 leading-5">{currentItem.review.negative}</p>
            </div>
          </div>
        )}

        {/* Engagement */}
        <div className="flex justify-between items-center pt-2 border-t border-light-gray">
          {showLikesComments ? (
            <>
              <div className="flex items-center space-x-4">
                <button className="flex items-center">
                  <HeartIcon size={22} className="text-dark-gray" />
                  <span className="ml-1 text-sm">{engagement.likes}</span>
                </button>
                <button onClick={() => navigate(`/post/${id}`)} className="flex items-center">
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
                <button
                  onClick={() => navigate(`/post/${id}`)}
                  className="flex items-center text-gray-600 hover:text-primary transition-colors"
                >
                  <MessageCircleIcon size={20} className="mr-1" />
                  <span className="text-sm">{engagement.comments}</span>
                </button>
              </div>
              <div className="flex items-center space-x-3">
                <button 
                  onClick={() => {
                    console.log('ðŸ’¾ [FeedPost] Opening SaveToListModal with IDs:', {
                      id: id,
                      dishId: dishId,
                      currentItemDishId: currentItem.dishId,
                      visitId: visitId,
                      restaurantId: restaurantId,
                      restaurantName: restaurant?.name,
                      dishName: currentItem.dish.name,
                      isCarousel: isCarousel,
                      currentIndex: currentIndex
                    });
                    setShowSaveModal(true);
                  }}
                  className="flex items-center text-sm text-gray-600 hover:text-primary"
                >
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

      {isActionSheetOpen && (
        <div
          className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40"
          onClick={() => setIsActionSheetOpen(false)}
        >
          {/* Sheet */}
          <div
            className="w-full max-w-md rounded-t-2xl bg-white shadow-lg p-2 pb-4 animate-[slideUp_160ms_ease-out] mx-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-2 mt-1 h-1.5 w-10 rounded-full bg-neutral-200" />
            <div className="divide-y divide-neutral-100">
              {/* Share (everyone) */}
              <button
                className="w-full px-4 py-3 text-left text-[15px] hover:bg-neutral-50"
                onClick={() => {
                  setIsActionSheetOpen(false);
                  const shareData = {
                    title: `${currentItem.dish.name} at ${restaurant?.name}`,
                    text: `Check out this ${currentItem.dish.rating}/10 rated dish!`,
                    url: window.location.origin + `/post/${id}`,
                  };
                  if (navigator.share) {
                    navigator.share(shareData).catch(() => {});
                  } else {
                    navigator.clipboard?.writeText(shareData.url).then(() => {
                      alert('Link copied to clipboard');
                    });
                  }
                }}
              >
                Share
              </button>

              {/* Report (everyone) */}
              <button
                className="w-full px-4 py-3 text-left text-[15px] hover:bg-neutral-50"
                onClick={async () => {
                  setIsActionSheetOpen(false);
                  const reason = window.prompt('Report reason (spam, inappropriate, incorrect info):');
                  if (!reason) return;
                  const details = window.prompt('Optional details for our team:') || '';
                  try {
                    await reportReview(id, reason.trim(), details.trim());
                    alert('Thanks! This post has been flagged for review.');
                  } catch {
                    alert('Failed to submit report. Please try again.');
                  }
                }}
              >
                Report
              </button>

              {/* Delete (owner only) */}
              {isOwnPost && (
                <button
                  className="w-full px-4 py-3 text-left text-[15px] text-red-600 hover:bg-red-50"
                  onClick={() => {
                    setIsActionSheetOpen(false);
                    handleDeletePost();
                  }}
                >
                  Delete Post
                </button>
              )}
            </div>

            {/* Cancel */}
            <button
              className="mt-2 w-full rounded-xl bg-neutral-100 px-4 py-3 text-[15px] font-medium hover:bg-neutral-200"
              onClick={() => setIsActionSheetOpen(false)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {showSaveModal && (() => {
        const modalProps = {
          isOpen: showSaveModal,
          restaurantId: restaurantId,
          restaurantName: restaurant?.name,
          dishId: currentItem.dishId,
          dishName: currentItem.dish.name,
          postId: id
        };
        
        console.log('ðŸ’¾ [FeedPost] Rendering SaveToListModal with props:', modalProps);
        
        return (
          <SaveToListModal
            {...modalProps}
            onClose={() => {
              console.log('ðŸ’¾ [FeedPost] Closing SaveToListModal');
              setShowSaveModal(false);
            }}
          />
        );
      })()}
    </div>
  );
};

export default FeedPost;








