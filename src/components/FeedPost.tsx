import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  HeartIcon,
  MessageCircleIcon,
  BookmarkIcon,
  ShareIcon,
  CheckCircleIcon,
  MapPinIcon,
  PlusIcon,
  MoreHorizontal as DotsIcon,
} from 'lucide-react';
import SaveToListModal from './SaveToListModal';
import { getCurrentUser } from '../lib/firebase';
import { isFollowing, followUser, unfollowUser } from '../services/followService';

// Types
interface FeedPostAuthor {
  id: string;
  name: string;
  username: string;
  image: string;
  isVerified?: boolean;
}

interface FeedPostReview {
  date: string;
  createdAt?: any;
  createdAtMs?: number;
  caption?: string;
  visitCaption?: string;
  tasteChips?: string[];
  audienceTags?: string[];
}

interface VisitDish {
  id: string;
  name: string;
  rating: number;
  dishCategory?: string;
  wizardOrder: number;
  dishId?: string;
  restaurantId?: string;
}

interface FeedMediaItem {
  id: string;
  imageUrl: string;
  kind: 'visit' | 'dish';
  reviewId?: string;
  dishName?: string;
  rating?: number;
}

interface CarouselItem {
  id: string;
  dishId?: string;
  dish: {
    name: string;
    image: string;
    rating: number;
    visitCount?: number;
  };
  review: FeedPostReview;
  tags?: string[];
  price?: string;
}

interface FeedPostProps {
  id: string;
  visitId?: string;
  restaurantId?: string;
  dishId?: string;
  isCarousel?: boolean;
  carouselItems?: CarouselItem[];
  visitDishes: VisitDish[]; // ALWAYS present (1+ items)
  visitAverageRating?: number;
  mediaItems?: FeedMediaItem[];
  author: FeedPostAuthor;
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
  tags?: string[];
}

const FeedPost: React.FC<FeedPostProps> = ({
  id,
  restaurantId,
  dishId,
  isCarousel = false,
  visitDishes,
  mediaItems = [],
  author,
  restaurant,
  dish,
  review,
  engagement,
  tags,
}) => {
  const navigate = useNavigate();
  const [saved] = useState(false);
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(engagement.likes || 0);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [touchStart, setTouchStart] = useState(0);
  const [touchEnd, setTouchEnd] = useState(0);
  const imageRef = useRef<HTMLDivElement>(null);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [isActionSheetOpen, setIsActionSheetOpen] = useState(false);

  // Follow state management
  const [isFollowingUser, setIsFollowingUser] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const currentUser = getCurrentUser();
  const isOwnPost = currentUser?.uid === author.id;

  // Check follow status on mount
  React.useEffect(() => {
    const checkFollowStatus = async () => {
      if (!isOwnPost && author.id) {
        const following = await isFollowing(author.id);
        setIsFollowingUser(following);
      }
    };
    checkFollowStatus();
  }, [author.id, isOwnPost]);

  // Handle follow/unfollow
  const handleFollowToggle = async (e: React.MouseEvent) => {
    e.stopPropagation();
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

  // Get quality circle color
  const getQualityColor = (percentage: number): string => {
    if (percentage >= 95) return '#059669';
    if (percentage >= 90) return '#10B981';
    if (percentage >= 85) return '#34D399';
    if (percentage >= 80) return '#6EE7B7';
    if (percentage >= 75) return '#FDE047';
    if (percentage >= 70) return '#FACC15';
    if (percentage >= 65) return '#F59E0B';
    if (percentage >= 60) return '#F97316';
    if (percentage >= 55) return '#FB7185';
    return '#EF4444';
  };

  // Format relative time
  function formatRelativeTime(input: Date | number | string | any): string {
    const toMillis = (v: any) =>
      v && typeof v.seconds === 'number' && typeof v.nanoseconds === 'number'
        ? v.seconds * 1000 + Math.floor(v.nanoseconds / 1e6)
        : typeof v === 'string'
        ? Date.parse(v)
        : typeof v === 'number'
        ? v
        : (v as Date)?.getTime?.() ?? Date.now();

    const now = Date.now();
    const then = toMillis(input);
    const diffMs = Math.max(0, now - then);
    const diffMin = Math.floor(diffMs / 60000);
    const diffHrs = Math.floor(diffMin / 60);

    if (diffHrs < 1) return `${Math.max(1, diffMin)}m`;
    if (diffHrs < 24) return `${diffHrs}h`;

    const d = new Date(then);
    const mm = d.getMonth() + 1;
    const dd = d.getDate();
    const yy = String(d.getFullYear()).slice(-2);
    return `${mm}/${dd}/${yy}`;
  }

  // Touch handlers for carousel swipe
  const handleTouchStart = (e: React.TouchEvent) => {
    if (!isCarousel || mediaItems.length <= 1) return;
    setTouchStart(e.targetTouches[0].clientX);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isCarousel || mediaItems.length <= 1) return;
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const handleTouchEnd = () => {
    if (!isCarousel || mediaItems.length <= 1) return;
    if (!touchStart || !touchEnd) return;

    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > 50;
    const isRightSwipe = distance < -50;

    if (isLeftSwipe && currentIndex < mediaItems.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
    if (isRightSwipe && currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  // Handle dish click
  const handleDishClick = (clickedDishId?: string) => {
    if (clickedDishId) {
      navigate(`/dish/${clickedDishId}`);
    } else if (restaurantId) {
      navigate(`/restaurant/${restaurantId}`);
    }
  };

  // Group dishes by category
  const groupedDishes = React.useMemo(() => {
    const groups: Record<string, VisitDish[]> = {};
    visitDishes.forEach((dish) => {
      const category = dish.dishCategory || 'Other';
      if (!groups[category]) {
        groups[category] = [];
      }
      groups[category].push(dish);
    });
    return groups;
  }, [visitDishes]);

  // Category order
  const categoryOrder = ['Appetizer', 'Entree', 'Handheld', 'Side', 'Dessert', 'Drink', 'Other'];

  return (
    <div className="relative bg-white rounded-2xl overflow-hidden shadow-sm mb-4">
      {/* Header */}
      <div className="p-4 flex items-center gap-4">
        <img
          src={author.image}
          alt={author.name}
          className="w-10 h-10 rounded-full object-cover cursor-pointer"
          onClick={() => navigate(isOwnPost ? '/profile' : `/user/${author.username}`)}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <div className="relative flex items-center">
              <span
                onClick={() => navigate(isOwnPost ? '/profile' : `/user/${author.username}`)}
                className="font-medium cursor-pointer hover:text-primary"
              >
                {author.name}
              </span>
              {/* Follow button */}
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
                className={`max-w-32 truncate ${
                  restaurantId ? 'hover:text-primary cursor-pointer' : 'text-gray-500'
                }`}
              >
                {restaurant.name}
              </span>
              {restaurant.isVerified && <CheckCircleIcon size={14} className="text-secondary" />}
              {restaurant.qualityScore !== undefined && (
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
      </div>

      {/* Image / Media Carousel */}
      {mediaItems && mediaItems.length > 0 && (
        <div className="relative">
          <div
            ref={imageRef}
            className="relative overflow-hidden"
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            <div
              className="flex transition-transform duration-300 ease-out"
              style={{ transform: `translateX(-${currentIndex * 100}%)` }}
            >
              {isCarousel && mediaItems.length > 1 ? (
                mediaItems.map((item) => (
                  <img
                    key={item.id}
                    src={item.imageUrl}
                    alt={item.dishName || 'Dish'}
                    className="w-full aspect-square object-cover flex-shrink-0"
                  />
                ))
              ) : (
                <img
                  src={mediaItems[0]?.imageUrl || dish.image}
                  alt={dish.name}
                  className="w-full aspect-square object-cover flex-shrink-0"
                />
              )}
            </div>
          </div>
        </div>
      )}

      {/* Carousel Dots */}
      {isCarousel && mediaItems.length > 1 && (
        <div className="flex justify-center items-center space-x-1 py-2">
          {mediaItems.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentIndex(index)}
              className={`rounded-full transition-all duration-200 ${
                index === currentIndex ? 'w-3 h-3 bg-red-500' : 'w-2 h-2 bg-red-300'
              }`}
            />
          ))}
        </div>
      )}

      {/* Caption / Title Row */}
      <div className="px-4 pt-3 pb-2">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-xl flex-1">
            {review.visitCaption || review.caption || (isCarousel ? `${visitDishes.length} dishes` : dish.name)}
          </h3>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-400">
              {formatRelativeTime(review.createdAt ?? review.createdAtMs ?? review.date)}
            </span>
            <button
              onClick={() => setIsActionSheetOpen(true)}
              className="text-gray-500 hover:text-gray-800 p-1 rounded-md"
              aria-label="More options"
            >
              <DotsIcon size={18} />
            </button>
          </div>
        </div>
      </div>

      {/* Dish List (Grouped by Category) */}
      <div className="px-4 pb-2">
        {categoryOrder.map((category) => {
          const dishesInCategory = groupedDishes[category];
          if (!dishesInCategory || dishesInCategory.length === 0) return null;

          return (
            <div key={category} className="mb-2">
              {/* Category Label */}
              <p className="text-[11px] tracking-wide text-gray-500 uppercase pl-4 mb-1">
                {category}
              </p>
              {/* Dish Rows */}
              {dishesInCategory.map((visitDish) => (
                <div
                  key={visitDish.id}
                  onClick={() => handleDishClick(visitDish.dishId)}
                  className={`flex items-center justify-between w-full py-1.5 px-4 text-sm rounded ${
                    visitDish.dishId ? 'hover:bg-gray-50 cursor-pointer' : ''
                  }`}
                >
                  <span className="font-medium text-gray-900 truncate text-left">
                    {visitDish.name}
                  </span>
                  <span className="flex-shrink-0 ml-3 text-xs font-semibold text-white bg-red-500 rounded-full px-2.5 py-[2px]">
                    {visitDish.rating.toFixed(1)}
                  </span>
                </div>
              ))}
            </div>
          );
        })}
      </div>

      {/* Tags */}
      {(review.tasteChips || review.audienceTags || tags) && (
        <div className="px-4 pb-2">
          <div className="flex flex-wrap gap-1.5">
            {/* Taste chips */}
            {review.tasteChips?.map((chip, i) => (
              <span
                key={`taste-${i}`}
                className="inline-flex items-center rounded-full border px-3 py-1.5 text-xs font-medium shadow-sm bg-gray-50 text-gray-700 border-gray-200"
              >
                {chip}
              </span>
            ))}

            {/* Audience tags */}
            {review.audienceTags?.map((tag, i) => (
              <span
                key={`audience-${i}`}
                className="inline-flex items-center rounded-full border px-3 py-1.5 text-xs font-semibold bg-gradient-to-r from-emerald-50 to-green-50 text-emerald-700 border-emerald-300 shadow-sm"
              >
                {tag}
              </span>
            ))}

            {/* Other tags */}
            {tags?.map((tag, i) => (
              <span
                key={`tag-${i}`}
                className="inline-flex items-center rounded-full border px-3 py-1.5 text-xs font-medium shadow-sm bg-blue-50 text-blue-700 border-blue-200"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Engagement */}
      <div className="px-4 pb-4">
        <div className="flex justify-between items-center pt-2 border-t border-light-gray">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => {
                setLiked(!liked);
                setLikeCount((prev) => (liked ? prev - 1 : prev + 1));
              }}
              className="flex items-center text-gray-600 hover:text-red-500 transition-colors"
            >
              <HeartIcon size={20} className={`mr-1 ${liked ? 'fill-red-500 text-red-500' : ''}`} />
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
              onClick={() => setShowSaveModal(true)}
              className="flex items-center text-sm text-gray-600 hover:text-primary"
            >
              <BookmarkIcon
                size={18}
                className={saved ? 'text-primary fill-primary mr-1' : 'text-gray-600 mr-1'}
              />
              {saved ? 'Saved' : 'Save'}
            </button>
            <button
              onClick={() => {
                if (navigator.share) {
                  navigator.share({
                    title: `${dish.name} at ${restaurant?.name}`,
                    text: `Check out this ${dish.rating}/10 rated dish!`,
                    url: window.location.href,
                  });
                }
              }}
              className="text-gray-600 hover:text-blue-500 transition-colors"
            >
              <ShareIcon size={18} />
            </button>
          </div>
        </div>
      </div>

      {/* Action Sheet */}
      {isActionSheetOpen && (
        <div
          className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40"
          onClick={() => setIsActionSheetOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-t-2xl bg-white shadow-lg p-2 pb-4 animate-[slideUp_160ms_ease-out] mx-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-2 mt-1 h-1.5 w-10 rounded-full bg-neutral-200" />
            <div className="divide-y divide-neutral-100">
              {/* Share */}
              <button
                className="w-full px-4 py-3 text-left text-[15px] hover:bg-neutral-50"
                onClick={() => {
                  setIsActionSheetOpen(false);
                  const shareData = {
                    title: `${dish.name} at ${restaurant?.name}`,
                    text: `Check out this ${dish.rating}/10 rated dish!`,
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

              {/* Report */}
              <button className="w-full px-4 py-3 text-left text-[15px] hover:bg-neutral-50">
                Report
              </button>
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

      {/* Save Modal */}
      {showSaveModal && (
        <SaveToListModal
          isOpen={showSaveModal}
          restaurantId={restaurantId}
          restaurantName={restaurant?.name}
          dishId={dishId}
          dishName={dish.name}
          postId={id}
          onClose={() => setShowSaveModal(false)}
        />
      )}
    </div>
  );
};

export default FeedPost;
