import React, { useState, useRef, useEffect, useMemo } from 'react';
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
import ReceiptUploadModal from './ReceiptUploadModal';
import { isFollowing, followUser, unfollowUser } from '../services/followService';
import { getCurrentUser } from '../lib/firebase';
import { deleteReview, reportReview, type FeedMediaItem } from '../services/reviewService';
import { uploadReviewProofs, markReviewPendingProof } from '../services/reviewVerificationService';
import { collection, query, where, limit, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';

interface FeedPostReview {
  date: string;
  // Raw Firestore timestamp and optimistic ms fallback for accurate relative time
  createdAt?: any;
  createdAtMs?: number;
  caption?: string;
  visitCaption?: string;
  tasteChips?: string[];
  audienceTags?: string[];
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
  // Optional visit-level metadata for multi-dish posts
  visitCaption?: string;
  visitTags?: string[];
  visitAverageRating?: number; // NEW: Average rating for the entire visit
  visitDishes?: Array<{ // NEW: Structured list of dishes with ratings
    id: string;
    name: string;
    rating: number;
    dishCategory?: string;
    wizardOrder: number;
  }>;
  // Flattened media items for visit and dish imagery
  mediaItems?: FeedMediaItem[];
  topComment?: {
    author: string;
    text: string;
  };
  // Optional tag slugs array associated with the review
  tags?: string[];
  // When true, show the "Pending verification" badge.
  // Used for a user's own profile page only.
  showPendingVerification?: boolean;
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
  engagement,
  tags,
  visitCaption,
  visitTags,
  visitAverageRating,
  visitDishes,
  mediaItems,
  showPendingVerification = false
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
  const [showReceiptModal, setShowReceiptModal] = useState(false);

  // NEW: Follow state management
  const [isFollowingUser, setIsFollowingUser] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const currentUser = getCurrentUser();
  const isOwnPost = currentUser?.uid === author.id;

  // Feature flags
  const showLikesComments = useFeature('LIKES_COMMENTS');
  const showSocialSharing = useFeature('SOCIAL_SHARING');

  // Tag labels and chip styling for slug-based tags
  const TAG_LABELS: Record<string, string> = {
    // Legacy taste tags
    good_value: 'Good value',
    overpriced: 'Overpriced',
    very_fresh: 'Very fresh',
    not_fresh: 'Not fresh',
    spicy_lovers: 'Spicy lovers',
    too_spicy: 'Too spicy',
    mild: 'Mild',
    served_hot: 'Served hot',
    served_cold: 'Served cold',
    lukewarm: 'Lukewarm',

    // Attribute tags
    attr_crispy: 'Crispy',
    attr_fresh: 'Fresh',
    attr_scratch_made: 'Scratch-made',
    attr_juicy: 'Juicy',
    attr_rich: 'Rich',
    attr_light: 'Light',
    attr_spicy: 'Spicy',
    attr_saucy: 'Saucy',
    attr_creamy: 'Creamy',
    attr_tender: 'Tender',
    attr_crunchy: 'Crunchy',
    attr_sweet: 'Sweet',
    attr_zesty: 'Zesty',
    attr__zesty: 'Zesty',

    // Occasions
    occasion_date_night: 'Date Night',
    occasion_family: 'Family-Friendly',
    occasion_takeout: 'Takeout',
    occasion_quick_lunch: 'Quick Lunch',
    occasion_special_occasion: 'Special Occasion',
    occasion_late_night: 'Late Night',
    occasion_business: 'Business Meal',
    occasion_group: 'Good for Groups',

    // Dietary
    dietary_vegetarian: 'Vegetarian',
    dietary_vegan: 'Vegan',
    dietary_gluten_free: 'Gluten-Free Friendly',
    dietary_dairy_free: 'Dairy-Free',
    dietary_nut_free: 'Nut-Free',

    // Cuisines
    cuisine_italian: 'Italian',
    cuisine_japanese: 'Japanese',
    cuisine_chinese: 'Chinese',
    cuisine_mexican: 'Mexican',
    cuisine_thai: 'Thai',
    cuisine_american: 'American',
    cuisine_french: 'French',
    cuisine_indian: 'Indian',
    cuisine_mediterranean: 'Mediterranean',
    cuisine_latin: 'Latin American',
    cuisine_german: 'German',

    // Dish types
    type_pizza: 'Pizza',
    type_taco: 'Taco',
    type_burger: 'Burger',
    type_sandwich: 'Sandwich',
    type_pasta: 'Pasta',
    type_sushi: 'Sushi',
    type_bbq: 'BBQ/Grill',
    type_soup: 'Soup',
    type_steak: 'Steak',
    type_dessert: 'Dessert',

    // Dish styles
    style_tavern_pizza: 'Tavern-Style Pizza',
    style_ny_pizza: 'New York Pizza',
    style_neapolitan_pizza: 'Neapolitan Pizza',
    style_detroit_pizza: 'Detroit-Style Pizza',
    style_chicago_pizza: 'Chicago Deep Dish',
    style_basque_cheesecake: 'Basque Cheesecake',
    style_smashburger: 'Smashburger',
    style_birria_taco: 'Birria Taco',

    // Sentiment-derived tags
    val_good_value: 'Good value',
    val_overpriced: 'Overpriced',
    val_fair: 'Fair price',
    price_overpriced: 'Overpriced',
    price_fair: 'Fair price',
    price_bargain: 'Bargain',
    would_order_again: 'Would order again',
    would_recommend: 'Would recommend',
    meal_breakfast: 'Breakfast',
    meal_brunch: 'Brunch',
    meal_lunch: 'Lunch',
    meal_dinner: 'Dinner',
    service_fast: 'Fast service',
    service_slow: 'Slow service',
    vibe_cozy: 'Cozy',
    vibe_lively: 'Lively',
  };

  const getTagChipClass = (slug: string): string => {
    const positive = new Set([
      'good_value',
      'very_fresh',
      'spicy_lovers',
      'served_hot',
      'val_good_value',
      'val_fair',
      'attr_crispy',
      'attr_fresh',
      'attr_scratch_made',
      'attr_juicy',
      'attr_tender',
      'attr_light'
    ]);
    const negativeRed = new Set(['overpriced', 'too_spicy', 'val_overpriced']);
    const negativeAmber = new Set(['lukewarm', 'not_fresh']);
    const occasions = new Set([
      'occasion_date_night',
      'occasion_family',
      'occasion_takeout',
      'occasion_quick_lunch',
      'occasion_special_occasion',
      'occasion_late_night',
      'occasion_business',
      'occasion_group'
    ]);
    const dietary = new Set([
      'dietary_vegetarian',
      'dietary_vegan',
      'dietary_gluten_free',
      'dietary_dairy_free',
      'dietary_nut_free'
    ]);

    if (positive.has(slug)) {
      return 'bg-gradient-to-r from-green-50 to-emerald-50 text-emerald-700 border border-emerald-200';
    }
    if (negativeRed.has(slug)) {
      return 'bg-rose-50 text-rose-700 border border-rose-200';
    }
    if (negativeAmber.has(slug)) {
      return 'bg-amber-50 text-amber-700 border border-amber-200';
    }
    if (occasions.has(slug)) {
      return 'bg-purple-50 text-purple-700 border border-purple-200';
    }
    if (dietary.has(slug)) {
      return 'bg-blue-50 text-blue-700 border border-blue-200';
    }
    if (slug === 'served_cold') {
      return 'bg-sky-50 text-sky-700 border border-sky-200';
    }
    return 'bg-gray-50 text-gray-700 border border-gray-200';
  };

  const getTagEmojiForSlug = (slug: string): string => {
    if (slug === 'spicy_lovers') return '🌶️ ';
    if (slug === 'too_spicy') return '🌶️ ';
    return '';
  };

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
  const currentItem = useMemo(() => {
    if (isCarousel && carouselItems.length > 0) {
      return carouselItems[currentIndex];
    }
    return {
      id,
      reviewId: id,
      dishId,
      dish,
      review,
      tags: [],
      price: undefined,
    };
  }, [isCarousel, carouselItems, currentIndex, id, dishId, dish, review]);
  const isVisitPost = Boolean(visitId) && isCarousel && (carouselItems?.length ?? 0) > 1;
  const hasMediaItems = Array.isArray(mediaItems) && mediaItems.length > 0;
  const activeMediaItem = (hasMediaItems && currentIndex < mediaItems.length)
    ? mediaItems[currentIndex]
    : undefined;

  const resolveDishItemForActiveMedia = (): CarouselItem | undefined => {
    if (!isVisitPost || !hasMediaItems || !activeMediaItem || activeMediaItem.kind !== 'dish') {
      return undefined;
    }
    if (activeMediaItem.reviewId) {
      const byId = carouselItems.find(
        (item) => item.id === activeMediaItem.reviewId || item.reviewId === activeMediaItem.reviewId
      );
      if (byId) return byId;
    }
    // FIXED: Bounds-safe fallback to prevent undefined access
    return carouselItems[Math.min(currentIndex, carouselItems.length - 1)] || carouselItems[0];
  };

  const dishContextItem = resolveDishItemForActiveMedia();

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

  function formatRelativeTime(input: Date | number | string | any): string {
    const toMillis = (v: any) =>
      v && typeof v.seconds === "number" && typeof v.nanoseconds === "number"
        ? v.seconds * 1000 + Math.floor(v.nanoseconds / 1e6)
        : typeof v === "string"
        ? Date.parse(v)
        : typeof v === "number"
        ? v
        : (v as Date)?.getTime?.() ?? Date.now();

    const now = Date.now();
    const then = toMillis(input);
    const diffMs = Math.max(0, now - then);
    const diffMin = Math.floor(diffMs / 60000);
    const diffHrs = Math.floor(diffMin / 60);
    const diffDays = Math.floor(diffHrs / 24);

    if (diffMin < 1) return '0m';                       // 0m
    if (diffMin < 60) return `${diffMin}m`;            // 1–59m
    if (diffHrs < 24) return `${diffHrs}h`;            // 1–23h
    if (diffDays < 30) return `${diffDays}d`;          // 1–29d

    const d = new Date(then);
    const mm = d.getMonth() + 1;
    const dd = d.getDate();
    const yy = String(d.getFullYear()).slice(-2);
    return `${mm}/${dd}/${yy}`; // e.g., 8/9/26
  }

  // Minute tick to auto-refresh relative label
  const [__tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  // Handle touch events for swipe
  const getMediaLength = () => {
    if (isVisitPost && hasMediaItems) return mediaItems!.length;
    if (isCarousel) return carouselItems.length;
    return 1;
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    const mediaLength = getMediaLength();
    if (!isCarousel || mediaLength <= 1) return;
    setTouchStart(e.targetTouches[0].clientX);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    const mediaLength = getMediaLength();
    if (!isCarousel || mediaLength <= 1) return;
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const handleTouchEnd = () => {
    const mediaLength = getMediaLength();
    if (!isCarousel || mediaLength <= 1) return;
    if (!touchStart || !touchEnd) return;

    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > 50;
    const isRightSwipe = distance < -50;

    if (isLeftSwipe && currentIndex < mediaLength - 1) {
      setCurrentIndex(Math.min(currentIndex + 1, mediaLength - 1));
    } else if (isRightSwipe && currentIndex > 0) {
      setCurrentIndex(Math.max(currentIndex - 1, 0));
    }
  };

  const handleDotClick = (index: number) => {
    const mediaLength = getMediaLength();
    setCurrentIndex(Math.min(Math.max(index, 0), mediaLength - 1));
  };

  const handleDishClick = () => {
    console.log('🔍 [FeedPost] Dish click:', {
      dishId: currentItem.dishId,
      dishName: currentItem.dish.name,
      restaurantId: restaurantId,
      willNavigateTo: currentItem.dishId ? `/dish/${currentItem.dishId}` : restaurantId ? `/restaurant/${restaurantId}` : 'nowhere'
    });

    if (currentItem.dishId) {
      navigate(`/dish/${currentItem.dishId}`);
    } else if (restaurantId) {
      navigate(`/restaurant/${restaurantId}`);
    } else {
      console.warn('⚠️ [FeedPost] No dishId or restaurantId available for navigation');
    }
  };

  // Enhanced click handler: if dishId missing, try to lookup by name under restaurant
  const handleDishClickEnhanced = async () => {
    if (currentItem.dishId) {
      navigate(`/dish/${currentItem.dishId}`);
      return;
    }
    try {
      if (restaurantId && currentItem.dish?.name) {
        const q = query(
          collection(db, 'menuItems'),
          where('restaurantId', '==', restaurantId),
          where('name', '==', currentItem.dish.name),
          limit(1)
        );
        const snap = await getDocs(q);
        if (!snap.empty) {
          const docSnap = snap.docs[0];
          navigate(`/dish/${docSnap.id}`);
          return;
        }
      }
    } catch (e) {
      console.warn('[FeedPost] Fallback dish lookup failed', e);
    }
    if (restaurantId) navigate(`/restaurant/${restaurantId}`);
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

  // NEW: Helper to group dishes by category for visit posts
  const groupDishesByCategory = (dishes: Array<any>) => {
    const map = new Map<string, typeof dishes>();
    dishes.forEach(d => {
      const cat = d.dishCategory || "Other";
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(d);
    });
    return Array.from(map.entries());
  };

  // NEW: Helper to navigate to dish detail page
  const navigateToDishReview = (dishId: string) => {
    if (dishId) {
      navigate(`/dish/${dishId}`);
    } else if (restaurantId) {
      navigate(`/restaurant/${restaurantId}`);
    }
  };


  const legacyLayout = (
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
                onClick={() => {
                  if (restaurantId) {
                    navigate(`/restaurant/${restaurantId}`);
                  } else {
                    console.warn('Restaurant ID missing for:', restaurant.name, 'Review ID:', id);
                  }
                }}
                className={`max-w-32 truncate ${restaurantId ? "hover:text-primary cursor-pointer" : "text-gray-500"}`}
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

      {/* Dish / Visit Title Below Image */}
      <div className="px-4 pt-3 pb-2">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-xl">
            <span
              onClick={handleDishClickEnhanced}
              className={(currentItem.dishId || restaurantId) ? "hover:text-primary cursor-pointer" : ""}
            >
              {hasMediaItems && activeMediaItem?.kind === 'visit'
                ? (restaurant?.name || currentItem.dish.name)
                : isCarousel && carouselItems.length > 1
                  ? `${(dishContextItem || currentItem).dish.name} (${currentIndex + 1}/${carouselItems.length})`
                  : (dishContextItem || currentItem).dish.name}
            </span>
          </h3>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-400">
              {(() => {
                const when = formatRelativeTime(
                  (currentItem.review as any).createdAt ??
                  (currentItem.review as any).createdAtMs ??
                  currentItem.review.date
                );
                return when;
              })()}
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

      {/* Content */}
      <div className="px-4 pb-4">
        {/* Verification badge (if present)
            Only show "Pending verification" on a user's own profile view.
        */}
        {(() => {
          const state = (currentItem.review as any)?.verification?.state as string | undefined;
          if (!state) return null;
          const map: Record<string, { label: string; cls: string }> = {
            verified: { label: 'Verified', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
            pending_proof: { label: 'Pending verification', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
            pending_review: { label: 'Pending verification', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
            unverified: { label: 'Unverified', cls: 'bg-slate-50 text-slate-600 border-slate-200' },
            rejected: { label: 'Rejected', cls: 'bg-rose-50 text-rose-700 border-rose-200' },
          };
          const isPending = state === 'pending_proof' || state === 'pending_review';
          // Hide pending badges unless the caller (Profile page) opts in
          if (isPending && !showPendingVerification) return null;
          const meta = map[state] || map['unverified'];
          return (
            <div className="flex items-center gap-2 mb-2">
              <div className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${meta.cls}`}>
                {meta.label}
              </div>
              {isOwnPost && (state === 'unverified' || state === 'rejected') && (
                <button
                  onClick={() => setShowReceiptModal(true)}
                  className="text-xs text-primary hover:underline cursor-pointer font-medium"
                >
                  Add receipt
                </button>
              )}
            </div>
          );
        })()}
        {/* Caption (visit-level or dish-level, if present) */}
        {(() => {
          // Visit context: prefer visitCaption
          if (hasMediaItems && activeMediaItem?.kind === 'visit') {
            const visitText =
              typeof visitCaption === 'string' && visitCaption.trim().length
                ? visitCaption.trim()
                : (currentItem.review.visitCaption ||
                   currentItem.review.caption ||
                   '');
            if (!visitText) return null;
            return (
              <p className="text-sm text-gray-700 mb-2">
                {visitText}
              </p>
            );
          }

          // Dish context
          const source = dishContextItem || currentItem;
          if (source.review.caption) {
            return (
              <p className="text-sm text-gray-700 mb-2">
                {source.review.caption}
              </p>
            );
          }
          return null;
        })()}

        {/* Taste chips and audience tags */}
        {(currentItem.review.tasteChips || currentItem.review.audienceTags || (isCarousel ? (currentItem as any).tags?.length : tags?.length)) && (
          <div className="flex flex-wrap gap-1.5 mb-2">
            {/* Taste attribute chips with color coding */}
            {currentItem.review.tasteChips?.map((chip, i) => {
              // Determine chip color based on content
              let chipClass = "inline-flex items-center rounded-full border px-3 py-1.5 text-xs font-medium shadow-sm";

              // Value-related chips (blue)
              if (chip.includes('Bargain') || chip.includes('Fair') || chip.includes('Overpriced')) {
                chipClass += chip.includes('Bargain')
                  ? " bg-blue-50 text-blue-700 border-blue-200"
                  : chip.includes('Fair')
                  ? " bg-sky-50 text-sky-700 border-sky-200"
                  : " bg-slate-100 text-slate-700 border-slate-300";
              }
              // Freshness-related chips (green gradient)
              else if (chip.includes('fresh') || chip.includes('Fresh')) {
                chipClass += chip.includes('Very')
                  ? " bg-gradient-to-r from-green-50 to-emerald-50 text-green-700 border-green-200"
                  : chip === 'Fresh'
                  ? " bg-green-50 text-green-700 border-green-200"
                  : " bg-orange-50 text-orange-700 border-orange-200";
              }
              // Saltiness-related chips (yellow/orange)
              else if (chip.includes('salt') || chip.includes('Balanced')) {
                chipClass += chip.includes('Balanced')
                  ? " bg-amber-50 text-amber-700 border-amber-200"
                  : chip.includes('Too')
                  ? " bg-orange-100 text-orange-700 border-orange-300"
                  : " bg-yellow-50 text-yellow-700 border-yellow-200";
              }
              // Default neutral
              else {
                chipClass += " bg-gray-50 text-gray-700 border-gray-200";
              }

              return (
                <span key={`taste-${i}`} className={chipClass}>
                  {chip}
                </span>
              );
            })}

            {/* Audience tags with enhanced emerald/green styling and emojis */}
            {currentItem.review.audienceTags?.map((tag, i) => {
              // Add emoji prefix based on tag type
              const getTagEmoji = (tagText: string): string => {
                if (tagText.includes('Spicy')) return '🌶️ ';
                if (tagText.includes('Date')) return '❤️ ';
                if (tagText.includes('Family')) return '👨‍👩‍👧‍👦 ';
                if (tagText.includes('Quick')) return '⚡ ';
                if (tagText.includes('Solo')) return '🧘 ';
                if (tagText.includes('Group')) return '👥 ';
                return '';
              };

              return (
                <span
                  key={`audience-${i}`}
                  className="inline-flex items-center rounded-full border px-3 py-1.5 text-xs font-semibold bg-gradient-to-r from-emerald-50 to-green-50 text-emerald-700 border-emerald-300 shadow-sm"
                >
                  {getTagEmoji(tag)}{tag}
                </span>
              );
            })}

            {/* Tag slugs rendered with color/emoji logic */}
            {(() => {
              const explicitTagList = Array.isArray(currentItem.review.explicitTags) ? currentItem.review.explicitTags : [];
              const derivedTagList = Array.isArray(currentItem.review.derivedTags) ? currentItem.review.derivedTags : [];
              const legacyTagList =
                !explicitTagList.length && !derivedTagList.length
                  ? (isCarousel ? ((currentItem as any).tags || []) : (tags || []))
                  : [];
              const displayTags = [...explicitTagList, ...derivedTagList, ...legacyTagList];

              return displayTags.map((slug, i) => {
                const label = TAG_LABELS[slug] || slug;
                const chipClass = getTagChipClass(slug);
                const emoji = getTagEmojiForSlug(slug);
                return (
                  <span
                    key={`tag-${slug}-${i}`}
                    className={`inline-flex items-center rounded-full border px-3 py-1.5 text-xs font-semibold shadow-sm ${chipClass}`}
                  >
                    {emoji}{label}
                  </span>
                );
              });
            })()}
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

      <ReceiptUploadModal
        isOpen={showReceiptModal}
        onClose={() => setShowReceiptModal(false)}
        onUpload={async (files) => {
          const urls = await uploadReviewProofs(id, files);
          await markReviewPendingProof(id, urls);
        }}
      />
    </div>
  );

  const visitLayout = (
    <div className="relative bg-white rounded-2xl overflow-hidden shadow-sm mb-4">
      {/* Absolute rating (bigger, nudged down & left) */}
      <div className="pointer-events-none absolute top-5 right-5 z-10">
        <RatingBadge rating={isVisitPost && visitAverageRating !== undefined ? visitAverageRating : currentItem.dish.rating} size="xl" />
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
                onClick={() => {
                  if (restaurantId) {
                    navigate(`/restaurant/${restaurantId}`);
                  } else {
                    console.warn('Restaurant ID missing for:', restaurant.name, 'Review ID:', id);
                  }
                }}
                className={`max-w-32 truncate ${restaurantId ? "hover:text-primary cursor-pointer" : "text-gray-500"}`}
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

      {/* Media section - hero + right column (visit posts only) */}
      <div className="flex flex-col md:flex-row">
        {/* Left: hero image driven by mediaItems when available */}
        <div className="relative flex-1">
          <div
            ref={imageRef}
            className="relative overflow-hidden"
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            {hasMediaItems && mediaItems.length > 0 ? (
              <div className="flex transition-transform duration-300 ease-out" style={{ transform: `translateX(-${currentIndex * 100}%)` }}>
                {mediaItems.map((item) => (
                  <img
                    key={item.id}
                    src={item.imageUrl}
                    alt={item.dishName || 'Visit photo'}
                    className="w-full aspect-square object-cover flex-shrink-0"
                  />
                ))}
              </div>
            ) : (
              <div className="flex transition-transform duration-300 ease-out" style={{ transform: `translateX(-${currentIndex * 100}%)` }}>
                {isCarousel && carouselItems.length > 1 ? (
                  carouselItems.map((item) => (
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
            )}
            {currentItem.dish.visitCount && (
              <div className="absolute top-4 right-4 bg-black bg-opacity-50 text-white px-3 py-1 rounded-full text-sm">
                Visited {currentItem.dish.visitCount}x
              </div>
            )}
          </div>
        </div>

        {/* Right: thumbnails column for visit media */}
        <div className="mt-2 md:mt-0 md:ml-2 md:w-24 lg:w-28 flex-shrink-0 border-t md:border-t-0 md:border-l border-gray-100 bg-gray-50">
          <div className="flex md:flex-col gap-1.5 p-1.5 overflow-x-auto md:overflow-y-auto">
            {hasMediaItems ? (
              mediaItems!.map((item, index) => {
                const isActive = index === currentIndex;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      const safeIndex = Math.min(Math.max(index, 0), mediaItems!.length - 1);
                      setCurrentIndex(safeIndex);
                    }}
                    className={`relative flex-shrink-0 rounded-xl overflow-hidden border ${
                      isActive
                        ? 'border-red-500 ring-2 ring-red-100'
                        : 'border-transparent opacity-80 hover:opacity-100'
                    }`}
                  >
                    <img
                      src={item.imageUrl}
                      alt={item.dishName || currentItem.dish.name}
                      className="h-12 w-12 md:h-14 md:w-14 object-cover"
                    />
                  </button>
                );
              })
            ) : (
              <>
                {isCarousel && carouselItems.length > 1 ? (
                  carouselItems.map((item, index) => {
                    if (!item?.dish?.image) return null;
                    const isActive = index === currentIndex;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          const safeIndex = Math.min(Math.max(index, 0), carouselItems.length - 1);
                          setCurrentIndex(safeIndex);
                        }}
                        className={`relative flex-shrink-0 rounded-xl overflow-hidden border ${
                          isActive
                            ? 'border-red-500 ring-2 ring-red-100'
                            : 'border-transparent opacity-80 hover:opacity-100'
                        }`}
                      >
                        <img
                          src={item.dish.image}
                          alt={item.dish.name}
                          className="h-12 w-12 md:h-14 md:w-14 object-cover"
                        />
                      </button>
                    );
                  })
                ) : (
                  <div className="flex h-full items-center justify-center w-full">
                    <span className="text-[11px] text-gray-400 md:-rotate-90 md:whitespace-nowrap">
                      More dishes coming soon
                    </span>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* NEW: Visit meta, caption, and dishes section */}
      {isVisitPost && (visitCaption || (visitDishes && visitDishes.length > 0)) && (
        <div className="px-4 pt-3 pb-3 border-b border-light-gray">
          {/* 2-line header with hierarchy + dots button */}
          <div className="flex items-start justify-between mb-2">
            <div>
              <p className="text-sm font-semibold text-gray-900">{author.name}</p>
              <p className="text-xs text-gray-500">
                rated <span className="font-medium text-gray-800">{restaurant?.name}</span> · {(() => {
                  const when = formatRelativeTime(
                    (review as any).createdAt ??
                    (review as any).createdAtMs ??
                    review.date
                  );
                  return when;
                })()}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsActionSheetOpen(true)}
              className="p-1 text-gray-400 hover:text-gray-600"
              aria-label="More options"
            >
              <DotsIcon size={20} />
            </button>
          </div>

          {visitCaption && (
            <p className="mt-1 mb-3 text-sm text-gray-900 leading-snug border-l-2 border-gray-100 pl-3">
              {visitCaption}
            </p>
          )}

          {visitDishes && visitDishes.length > 0 && (
            <div className="space-y-3">
              {groupDishesByCategory(visitDishes).map(([category, dishes]) => {
                const MAX_DISHES_PER_CATEGORY = 3;
                const visible = dishes.slice(0, MAX_DISHES_PER_CATEGORY);
                const remaining = dishes.length - visible.length;

                return (
                  <div key={category}>
                    <p className="mt-2 text-[11px] tracking-wide text-gray-500 uppercase">{category}</p>
                    <div className="space-y-1">
                      {visible.map((dish: any) => (
                        <button
                          key={dish.id}
                          onClick={() => navigateToDishReview(dish.id)}
                          className="flex items-center justify-between w-full py-1.5 px-0 text-sm hover:bg-gray-50 rounded"
                        >
                          <span className="font-medium text-gray-900 truncate">{dish.name}</span>
                          <span className="ml-2 text-xs font-semibold text-white bg-red-500 rounded-full px-2.5 py-[2px]">
                            {dish.rating.toFixed(1)}
                          </span>
                        </button>
                      ))}
                      {remaining > 0 && (
                        <button
                          onClick={() => navigateToDishReview(visible[0]?.id || '')}
                          className="w-full text-left text-xs text-gray-500 mt-1 hover:text-gray-700"
                        >
                          + {remaining} more {remaining === 1 ? 'dish' : 'dishes'}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Content */}
      <div className="px-4 pb-4">
        {/* Verification badge (if present)
            Only show "Pending verification" on a user's own profile view.
        */}
        {(() => {
          const state = (currentItem.review as any)?.verification?.state as string | undefined;
          if (!state) return null;
          const map: Record<string, { label: string; cls: string }> = {
            verified: { label: 'Verified', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
            pending_proof: { label: 'Pending verification', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
            pending_review: { label: 'Pending verification', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
            unverified: { label: 'Unverified', cls: 'bg-slate-50 text-slate-600 border-slate-200' },
            rejected: { label: 'Rejected', cls: 'bg-rose-50 text-rose-700 border-rose-200' },
          };
          const isPending = state === 'pending_proof' || state === 'pending_review';
          // Hide pending badges unless the caller (Profile page) opts in
          if (isPending && !showPendingVerification) return null;
          const meta = map[state] || map['unverified'];
          return (
            <div className="flex items-center gap-2 mb-2">
              <div className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${meta.cls}`}>
                {meta.label}
              </div>
              {isOwnPost && (state === 'unverified' || state === 'rejected') && (
                <button
                  onClick={() => setShowReceiptModal(true)}
                  className="text-xs text-primary hover:underline cursor-pointer font-medium"
                >
                  Add receipt
                </button>
              )}
            </div>
          );
        })()}
        {/* Caption - Only for legacy/single-dish layout */}
        {!isVisitPost && currentItem.review.caption && (
          <p className="text-sm text-gray-700 mb-2">{currentItem.review.caption}</p>
        )}

        {/* Taste chips and audience tags - Only for legacy/single-dish layout */}
        {!isVisitPost && (currentItem.review.tasteChips || currentItem.review.audienceTags || (isCarousel ? (currentItem as any).tags?.length : tags?.length)) && (
          <div className="flex flex-wrap gap-1.5 mb-2">
            {/* Taste attribute chips with color coding */}
            {currentItem.review.tasteChips?.map((chip, i) => {
              // Determine chip color based on content
              let chipClass = "inline-flex items-center rounded-full border px-3 py-1.5 text-xs font-medium shadow-sm";

              // Value-related chips (blue)
              if (chip.includes('Bargain') || chip.includes('Fair') || chip.includes('Overpriced')) {
                chipClass += chip.includes('Bargain')
                  ? " bg-blue-50 text-blue-700 border-blue-200"
                  : chip.includes('Fair')
                  ? " bg-sky-50 text-sky-700 border-sky-200"
                  : " bg-slate-100 text-slate-700 border-slate-300";
              }
              // Freshness-related chips (green gradient)
              else if (chip.includes('fresh') || chip.includes('Fresh')) {
                chipClass += chip.includes('Very')
                  ? " bg-gradient-to-r from-green-50 to-emerald-50 text-green-700 border-green-200"
                  : chip === 'Fresh'
                  ? " bg-green-50 text-green-700 border-green-200"
                  : " bg-orange-50 text-orange-700 border-orange-200";
              }
              // Saltiness-related chips (yellow/orange)
              else if (chip.includes('salt') || chip.includes('Balanced')) {
                chipClass += chip.includes('Balanced')
                  ? " bg-amber-50 text-amber-700 border-amber-200"
                  : chip.includes('Too')
                  ? " bg-orange-100 text-orange-700 border-orange-300"
                  : " bg-yellow-50 text-yellow-700 border-yellow-200";
              }
              // Default neutral
              else {
                chipClass += " bg-gray-50 text-gray-700 border-gray-200";
              }

              return (
                <span key={`taste-${i}`} className={chipClass}>
                  {chip}
                </span>
              );
            })}

            {/* Audience tags with enhanced emerald/green styling and emojis */}
            {currentItem.review.audienceTags?.map((tag, i) => {
              // Add emoji prefix based on tag type
              const getTagEmoji = (tagText: string): string => {
                if (tagText.includes('Spicy')) return '🌶️ ';
                if (tagText.includes('Date')) return '❤️ ';
                if (tagText.includes('Family')) return '👨‍👩‍👧‍👦 ';
                if (tagText.includes('Quick')) return '⚡ ';
                if (tagText.includes('Solo')) return '🧘 ';
                if (tagText.includes('Group')) return '👥 ';
                return '';
              };

              return (
                <span
                  key={`audience-${i}`}
                  className="inline-flex items-center rounded-full border px-3 py-1.5 text-xs font-semibold bg-gradient-to-r from-emerald-50 to-green-50 text-emerald-700 border-emerald-300 shadow-sm"
                >
                  {getTagEmoji(tag)}{tag}
                </span>
              );
            })}

            {/* Tag slugs rendered with color/emoji logic */}
            {(() => {
              const explicitTagList = Array.isArray(currentItem.review.explicitTags) ? currentItem.review.explicitTags : [];
              const derivedTagList = Array.isArray(currentItem.review.derivedTags) ? currentItem.review.derivedTags : [];
              const legacyTagList =
                !explicitTagList.length && !derivedTagList.length
                  ? (isCarousel ? ((currentItem as any).tags || []) : (tags || []))
                  : [];
              const displayTags = [...explicitTagList, ...derivedTagList, ...legacyTagList];

              return displayTags.map((slug, i) => {
                const label = TAG_LABELS[slug] || slug;
                const chipClass = getTagChipClass(slug);
                const emoji = getTagEmojiForSlug(slug);
                return (
                  <span
                    key={`tag-${slug}-${i}`}
                    className={`inline-flex items-center rounded-full border px-3 py-1.5 text-xs font-semibold shadow-sm ${chipClass}`}
                  >
                    {emoji}{label}
                  </span>
                );
              });
            })()}
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

      <ReceiptUploadModal
        isOpen={showReceiptModal}
        onClose={() => setShowReceiptModal(false)}
        onUpload={async (files) => {
          const urls = await uploadReviewProofs(id, files);
          await markReviewPendingProof(id, urls);
        }}
      />
    </div>
  );

  const renderVisitLayout = () => visitLayout;

  if (isVisitPost) {
    return renderVisitLayout();
  }

  return legacyLayout;
};

export default FeedPost;
