import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  HeartIcon,
  MessageCircleIcon,
  BookmarkIcon,
  ShareIcon,
  CheckCircleIcon,
} from 'lucide-react';
import { MoreHorizontal as DotsIcon } from 'lucide-react';
import LocationPinIcon from './icons/LocationPinIcon';
import RatingBadge from './RatingBadge';
import { useFeature } from '../utils/features';
import SaveToListModal from './SaveToListModal';
import ReceiptUploadModal from './ReceiptUploadModal';
import CommentSheet from './comments/CommentSheet';
import { followUser, unfollowUser } from '../services/followService';
import { getCurrentUser } from '../lib/firebase';
import { deleteReview, reportReview, type FeedMediaItem } from '../services/reviewService';
import { uploadReviewProofs, markReviewPendingProof } from '../services/reviewVerificationService';
import { collection, query, where, limit, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { navigateToDish, navigateToRestaurant } from '../utils/navigationHelpers';

interface FeedPostReview {
  date: string;
  // Raw Firestore timestamp and optimistic ms fallback for accurate relative time
  createdAt?: any;
  createdAtMs?: number;
  caption?: string;
  visitCaption?: string;
  serviceSpeed?: 'fast' | 'normal' | 'slow' | null;
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
  // Precomputed follow status for author, provided by parent (Home).
  isFollowingAuthor?: boolean;
  // Optional callback to inform parent when follow state changes for this author.
  onFollowChange?: (userId: string, isFollowing: boolean) => void;
}

const FeedPostComponent: React.FC<FeedPostProps> = ({
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
  showPendingVerification = false,
  isFollowingAuthor = false,
  onFollowChange,
}) => {
  // SAFE RENDER: Comprehensive defensive validation to prevent crashes during navigation
  // Check all critical props with optional chaining to prevent TypeErrors
  if (!author?.id || !author?.name) {
    console.error('[FeedPost] Invalid author data:', { author, id });
    return null; // Could return <FeedPostSkeleton /> here if needed
  }

  if (!restaurant?.name && !restaurant) {
    console.error('[FeedPost] Missing restaurant data:', { restaurant, id });
    return null;
  }

  if (!dish?.name && !dish) {
    console.error('[FeedPost] Missing dish data:', { dish, id });
    return null;
  }

  if (!review || !engagement) {
    console.error('[FeedPost] Missing review or engagement data:', { review, engagement, id });
    return null;
  }

  const renderStart = performance.now?.() ?? Date.now();
  console.log('[FeedPost][render-start]', {
    ts: new Date().toISOString(),
    renderStart,
    id,
    authorId: author?.id,
  });

  // State for image loading
  const [imageLoaded, setImageLoaded] = useState<{ [key: string]: boolean }>({});
  const containerRef = useRef<HTMLDivElement>(null);
  const [isNearViewport, setIsNearViewport] = useState(false);
  // Log all IDs received by FeedPost component
  console.log('📝 [FeedPost] Component initialized with IDs:', {
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
  const imageRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const isProgrammaticScroll = useRef(false); // Track programmatic scrolls to prevent spazzing
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [isActionSheetOpen, setIsActionSheetOpen] = useState(false);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [isDishNameExpanded, setIsDishNameExpanded] = useState(false);
  const [showCommentSheet, setShowCommentSheet] = useState(false);

  // NEW: Follow state management
  const [isFollowingUser, setIsFollowingUser] = useState(isFollowingAuthor);
  const [followLoading, setFollowLoading] = useState(false);
  const currentUser = getCurrentUser();
  const isOwnPost = currentUser?.uid === author?.id;
  const displayAuthorName = isOwnPost ? 'You' : (author?.name || 'Unknown');

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

    // Newer attribute tags (attr_ prefix)
    attr_umami_rich: 'Umami-rich',
    attr_garlicky: 'Garlicky',
    attr_well_seasoned: 'Well-seasoned',
    attr_under_seasoned: 'Under-seasoned',
    attr_balanced: 'Balanced',
    attr_high_quality_ingredients: 'High-quality ingredients',
    attr_comfort_food: 'Comfort food',
    attr_beautiful_presentation: 'Beautiful presentation',
    attr_consistent: 'Consistent',

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

  function getDisplayRating(
    item: CarouselItem | undefined,
    visitAverageRating?: number,
    isVisitPostFlag?: boolean
  ): number | null {
    // Add defensive null check to prevent crashes when item is undefined
    if (!item) return null;
    if (isVisitPostFlag && typeof visitAverageRating === 'number') return visitAverageRating;
    const dishRating = (item.dish as any)?.rating;
    const reviewRating = (item.review as any)?.rating;
    if (typeof dishRating === 'number') return dishRating;
    if (typeof reviewRating === 'number') return reviewRating;
    return null;
  }

  const getTagLabel = (slugOrLabel: string): string => {
    return TAG_LABELS[slugOrLabel] || slugOrLabel;
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
    if (slug === 'spicy_lovers') return '??? ';
    if (slug === 'too_spicy') return '??? ';
    return '';
  };

  // Keep local follow state in sync with parent-provided value.
  useEffect(() => {
    setIsFollowingUser(isFollowingAuthor);
  }, [isFollowingAuthor]);

  // NEW: Handle follow/unfollow
  const handleFollowToggle = async (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent navigation to profile
    if (followLoading || isOwnPost) return;

    setFollowLoading(true);
    try {
      if (isFollowingUser) {
        const success = await unfollowUser(author.id);
        if (success) {
          setIsFollowingUser(false);
          if (onFollowChange) {
            onFollowChange(author.id, false);
          }
        }
      } else {
        const success = await followUser(author?.id, author?.name || 'Unknown');
        if (success) {
          setIsFollowingUser(true);
          if (onFollowChange && author?.id) {
            onFollowChange(author.id, true);
          }
        }
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
    } else if (author?.name) {
      navigate(`/user/${author.name}`);
    }
  };

  // Get current item to display (carousel or single)
  const currentItem = useMemo(() => {
    if (isCarousel && carouselItems.length > 0) {
      // Add bounds validation to prevent out-of-bounds access
      const safeIndex = Math.min(Math.max(currentIndex, 0), carouselItems.length - 1);
      return carouselItems[safeIndex];
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
  const activeMediaItem =
    hasMediaItems &&
    Array.isArray(mediaItems) &&
    currentIndex >= 0 &&
    currentIndex < mediaItems.length
      ? mediaItems[currentIndex]
      : undefined;

  const resolveDishItemForActiveMedia = (): CarouselItem | undefined => {
    // Guard against missing or incorrect conditions
    if (
      !isVisitPost ||
      !hasMediaItems ||
      !activeMediaItem ||
      activeMediaItem.kind !== 'dish' ||
      !Array.isArray(carouselItems) ||
      carouselItems.length === 0
    ) {
      return undefined;
    }

    // Try to find by reviewId first
    if (activeMediaItem.reviewId) {
      const byId = carouselItems.find(
        (item) => item.id === activeMediaItem.reviewId || item.reviewId === activeMediaItem.reviewId
      );
      if (byId) return byId;
    }

    // Bounds-safe fallback: use currentIndex but cap it to carouselItems length
    const safeIndex = Math.min(Math.max(currentIndex, 0), carouselItems.length - 1);
    return carouselItems[safeIndex] || carouselItems[0];
  };

  const dishContextItem = resolveDishItemForActiveMedia();

  // Memoize expensive rating calculations
  const displayRating = useMemo(
    () => getDisplayRating(currentItem, visitAverageRating, isVisitPost),
    [currentItem, visitAverageRating, isVisitPost]
  );

  const heroRating =
    displayRating ??
    (typeof (currentItem.dish as any)?.rating === 'number'
      ? (currentItem.dish as any).rating
      : 0);

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

  // Memoize quality color calculation
  const qualityColor = useMemo(
    () => restaurant?.qualityScore !== undefined ? getQualityColor(restaurant.qualityScore) : undefined,
    [restaurant?.qualityScore]
  );

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
    if (diffMin < 60) return `${diffMin}m`;            // 1�59m
    if (diffHrs < 24) return `${diffHrs}h`;            // 1�23h
    if (diffDays < 30) return `${diffDays}d`;          // 1�29d

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

  // Intersection Observer for pre-warming images
  useEffect(() => {
    if (!containerRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting || entry.intersectionRatio > 0) {
            setIsNearViewport(true);
          }
        });
      },
      {
        rootMargin: '200px', // Start loading 200px before entering viewport
        threshold: 0
      }
    );

    observer.observe(containerRef.current);

    return () => {
      observer.disconnect();
    };
  }, []);

  // Handle image load event
  const handleImageLoad = (imageUrl: string) => {
    setImageLoaded(prev => ({ ...prev, [imageUrl]: true }));
  };

  // Debug logging: Track index mismatches to help prevent crashes
  useEffect(() => {
    if (currentIndex >= carouselItems.length && isCarousel && !hasMediaItems) {
      console.warn('[FeedPost] Index mismatch detected:', {
        currentIndex,
        carouselLength: carouselItems.length,
        mediaLength: mediaItems?.length,
        hasMediaItems,
        isVisitPost,
        postId: id,
      });
    }
    if (hasMediaItems && currentIndex >= (mediaItems?.length || 0)) {
      console.warn('[FeedPost] Media index out of bounds:', {
        currentIndex,
        mediaLength: mediaItems?.length,
        postId: id,
      });
    }
  }, [currentIndex, carouselItems.length, mediaItems?.length, hasMediaItems, isCarousel, isVisitPost, id]);

  // Handle touch events for swipe
  const getMediaLength = () => {
    // For visit posts with media items, use mediaItems length
    if (hasMediaItems && Array.isArray(mediaItems) && mediaItems.length > 0) {
      return mediaItems.length;
    }
    // For regular carousel posts, use carouselItems length
    if (isCarousel && Array.isArray(carouselItems) && carouselItems.length > 0) {
      return carouselItems.length;
    }
    // Default to 1 for single posts
    return 1;
  };

  // Native scroll-based navigation with scroll snap
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    // Skip updating index during programmatic scrolls to prevent border "spazzing"
    if (isProgrammaticScroll.current) {
      return;
    }

    const container = e.currentTarget;
    const scrollLeft = container.scrollLeft;
    const itemWidth = container.offsetWidth;
    const newIndex = Math.round(scrollLeft / itemWidth);

    if (newIndex !== currentIndex) {
      setCurrentIndex(newIndex);
    }
  };

  const handleDotClick = (index: number) => {
    const mediaLength = getMediaLength();
    const safeIndex = Math.min(Math.max(index, 0), mediaLength - 1);
    setCurrentIndex(safeIndex);

    // Set flag to prevent handleScroll from updating index during animation
    isProgrammaticScroll.current = true;

    // Scroll to the selected index
    if (scrollContainerRef.current) {
      const itemWidth = scrollContainerRef.current.offsetWidth;
      scrollContainerRef.current.scrollTo({
        left: safeIndex * itemWidth,
        behavior: 'smooth'
      });

      // Clear flag after scroll animation completes (~300ms for smooth scroll)
      setTimeout(() => {
        isProgrammaticScroll.current = false;
      }, 350);
    }
  };

  const handleDishClick = () => {
    // Add null check to prevent crashes when currentItem is undefined
    if (!currentItem) {
      console.warn('?? [FeedPost] handleDishClick called but currentItem is undefined');
      return;
    }

    console.log('?? [FeedPost] Dish click:', {
      dishId: currentItem.dishId,
      dishName: currentItem.dish?.name,
      restaurantId: restaurantId,
      willNavigateTo: currentItem.dishId ? `/dish/${currentItem.dishId}` : restaurantId ? `/restaurant/${restaurantId}` : 'nowhere'
    });

    if (currentItem.dishId) {
      navigateToDish(navigate, {
        restaurantId,
        dishId: currentItem.dishId,
        reviewId: currentItem.id,
        visitId
      });
    } else if (restaurantId) {
      navigateToRestaurant(navigate, restaurantId);
    } else {
      console.warn('?? [FeedPost] No dishId or restaurantId available for navigation');
    }
  };

  // Enhanced click handler: if dishId missing, try to lookup by name under restaurant
  const handleDishClickEnhanced = async () => {
    if (currentItem.dishId) {
      navigateToDish(navigate, {
        restaurantId,
        dishId: currentItem.dishId,
        reviewId: currentItem.id,
        visitId
      });
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
          navigateToDish(navigate, {
            restaurantId,
            dishId: docSnap.id,
            reviewId: currentItem.id,
            visitId
          });
          return;
        }
      }
    } catch (e) {
      console.warn('[FeedPost] Fallback dish lookup failed', e);
    }
    if (restaurantId) {
      navigateToRestaurant(navigate, restaurantId);
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

  // NEW: Helper to navigate to dish detail page with full context
  const navigateToDishReview = (reviewId: string, dishId?: string) => {
    navigateToDish(navigate, {
      restaurantId,
      dishId,
      reviewId,
      visitId
    });
  };


  const renderTagChips = (item: CarouselItem, isCarouselFlag: boolean, rootTags?: string[]) => {
    if (
      !item.review.tasteChips &&
      !item.review.audienceTags &&
      !(isCarouselFlag ? (item as any).tags?.length : rootTags?.length)
    ) {
      return null;
    }

    const explicitTagList = Array.isArray((item.review as any).explicitTags)
      ? (item.review as any).explicitTags
      : [];
    const derivedTagList = Array.isArray((item.review as any).derivedTags)
      ? (item.review as any).derivedTags
      : [];
    const legacyTagList =
      !explicitTagList.length && !derivedTagList.length
        ? (isCarouselFlag ? ((item as any).tags || []) : (rootTags || []))
        : [];
    const displayTags = [...explicitTagList, ...derivedTagList, ...legacyTagList];

    return (
      <div className="flex flex-wrap gap-1.5 mb-2">
        {/* Taste attribute chips with color coding */}
        {item.review.tasteChips?.map((chip, i) => {
          const label = getTagLabel(chip);
          let chipClass =
            'inline-flex items-center rounded-full border px-3 py-1.5 text-xs font-medium shadow-sm';

          if (label.includes('Bargain') || label.includes('Fair') || label.includes('Overpriced')) {
            chipClass += label.includes('Bargain')
              ? ' bg-blue-50 text-blue-700 border-blue-200'
              : label.includes('Fair')
              ? ' bg-sky-50 text-sky-700 border-sky-200'
              : ' bg-slate-100 text-slate-700 border-slate-300';
          } else if (label.includes('fresh') || label.includes('Fresh')) {
            chipClass += label.includes('Very')
              ? ' bg-gradient-to-r from-green-50 to-emerald-50 text-green-700 border-green-200'
              : label === 'Fresh'
              ? ' bg-green-50 text-green-700 border-green-200'
              : ' bg-orange-50 text-orange-700 border-orange-200';
          } else if (label.includes('salt') || label.includes('Balanced')) {
            chipClass += label.includes('Balanced')
              ? ' bg-amber-50 text-amber-700 border-amber-200'
              : label.includes('Too')
              ? ' bg-orange-100 text-orange-700 border-orange-300'
              : ' bg-yellow-50 text-yellow-700 border-yellow-200';
          } else {
            chipClass += ' bg-gray-50 text-gray-700 border-gray-200';
          }

          return (
            <span key={`taste-${i}`} className={chipClass}>
              {label}
            </span>
          );
        })}

        {/* Audience tags with enhanced emerald/green styling and emojis */}
        {item.review.audienceTags?.map((tag, i) => {
          const label = getTagLabel(tag);
          const getTagEmoji = (tagText: string): string => {
            if (tagText.includes('Spicy')) return '??? ';
            if (tagText.includes('Date')) return '?? ';
            if (tagText.includes('Family')) return '??????????? ';
            if (tagText.includes('Quick')) return '? ';
            if (tagText.includes('Solo')) return '?? ';
            if (tagText.includes('Group')) return '?? ';
            return '';
          };

          return (
            <span
              key={`audience-${i}`}
              className="inline-flex items-center rounded-full border px-3 py-1.5 text-xs font-semibold bg-gradient-to-r from-emerald-50 to-green-50 text-emerald-700 border-emerald-300 shadow-sm"
            >
              {getTagEmoji(label)}
              {label}
            </span>
          );
        })}

        {/* Tag slugs rendered with color/emoji logic */}
        {displayTags.map((slug, i) => {
          const label = getTagLabel(slug);
          const chipClass = getTagChipClass(slug);
          const emoji = getTagEmojiForSlug(slug);
          return (
            <span
              key={`tag-${slug}-${i}`}
              className={`inline-flex items-center rounded-full border px-3 py-1.5 text-xs font-semibold shadow-sm ${chipClass}`}
            >
              {emoji}
              {label}
            </span>
          );
        })}
      </div>
    );
  };

  const legacyLayout = (
    <div ref={containerRef} className="relative bg-white rounded-2xl overflow-hidden shadow-sm mb-4">
      {/* Absolute rating (bigger, nudged down & left) */}
      <div className="pointer-events-none absolute top-5 right-5 z-0">
        <RatingBadge rating={heroRating} size="xl" />
      </div>

      {/* Header */}
      <div className="p-4 flex items-center gap-4">
        <img
          src={author.image}
          alt={displayAuthorName}
          loading="lazy"
          decoding="async"
          className="w-10 h-10 rounded-full object-cover"
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            {/* NEW: Username area with follow button */}
            <div className="relative flex items-center">
              <span 
                onClick={handleUsernameClick}
                className="font-medium cursor-pointer hover:text-primary"
              >
                {displayAuthorName}
              </span>
              {/* Follow button: gray pill when not following, simple check icon when following */}
              {!isOwnPost && (
                <button
                  onClick={handleFollowToggle}
                  disabled={followLoading}
                  className={`ml-2 -mt-0.5 flex items-center justify-center transition-all duration-200 ${
                    isFollowingUser
                      ? 'text-green-600'
                      : 'px-2.5 py-0.5 rounded-full border text-xs font-medium border-gray-300 text-gray-600 bg-white hover:border-gray-400'
                  } ${followLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                >
                  {isFollowingUser ? (
                    <CheckCircleIcon size={14} />
                  ) : (
                    'Follow'
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
          {/* Restaurant line under header (legacy layout) */}
          {restaurant && (
            <div className="mt-1 text-sm text-dark-gray flex items-center gap-0.5">
              <LocationPinIcon size={14} className="text-red-500" />
              <span
                onClick={() => {
                  if (restaurantId) {
                    navigate(`/restaurant/${restaurantId}`);
                  } else {
                    console.warn('Restaurant ID missing for:', restaurant?.name, 'Review ID:', id);
                  }
                }}
                className={`max-w-32 truncate ${restaurantId ? 'hover:text-primary cursor-pointer' : 'text-gray-500'}`}
              >
                {restaurant.name}
              </span>
              {review.serviceSpeed && (
                <span className="ml-1 text-xs flex-shrink-0">
                  {review.serviceSpeed === 'fast' ? '⚡' : review.serviceSpeed === 'normal' ? '⏱️' : '🐌'}
                </span>
              )}
              {restaurant.qualityScore !== undefined && qualityColor && (
                <div
                  className="ml-1 w-8 h-5 flex items-center justify-center rounded-full flex-shrink-0"
                  style={{ backgroundColor: qualityColor }}
                >
                  <span className="text-[11px] font-medium text-white">
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
        >
          <div
            ref={scrollContainerRef}
            className="flex overflow-x-scroll snap-x snap-mandatory no-scrollbar"
            onScroll={handleScroll}
            style={{
              scrollSnapType: 'x mandatory',
              scrollBehavior: 'smooth',
              WebkitOverflowScrolling: 'touch'
            }}
          >
            {isCarousel && carouselItems.length > 1 ? (
              carouselItems.map((item, index) => (
                // Defensive: ensure image URL exists before rendering
                item.dish.image && typeof item.dish.image === 'string' ? (
                  <div
                    key={item.id}
                    className="w-full aspect-square bg-gray-100 flex-shrink-0 snap-center relative"
                  >
                    <img
                      src={item.dish.image}
                      alt={item.dish.name}
                      loading={isNearViewport || index < 3 ? "eager" : "lazy"}
                      decoding="async"
                      onLoad={() => handleImageLoad(item.dish.image)}
                      className={`w-full h-full object-cover absolute inset-0 transition-opacity duration-300 ${
                        imageLoaded[item.dish.image] ? 'opacity-100' : 'opacity-0'
                      }`}
                    />
                  </div>
                ) : (
                  <div
                    key={item.id}
                    className="w-full aspect-square bg-gray-200 flex-shrink-0 snap-center flex items-center justify-center"
                  >
                    <span className="text-gray-400">Image unavailable</span>
                  </div>
                )
              ))
            ) : (
              currentItem.dish.image && typeof currentItem.dish.image === 'string' ? (
                <div className="w-full aspect-square bg-gray-100 snap-center relative">
                  <img
                    src={currentItem.dish.image}
                    alt={currentItem.dish.name}
                    loading={isNearViewport ? "eager" : "lazy"}
                    decoding="async"
                    onLoad={() => handleImageLoad(currentItem.dish.image)}
                    className={`w-full h-full object-cover absolute inset-0 transition-opacity duration-300 ${
                      imageLoaded[currentItem.dish.image] ? 'opacity-100' : 'opacity-0'
                    }`}
                  />
                </div>
              ) : (
                <div className="w-full aspect-square bg-gray-200 flex items-center justify-center snap-center">
                  <span className="text-gray-400">Image unavailable</span>
                </div>
              )
            )}
          </div>
          {currentItem.dish.visitCount && (
            <button
              type="button"
              onClick={() => setIsDishNameExpanded(!isDishNameExpanded)}
              className={`absolute top-4 right-4 bg-black bg-opacity-50 text-white px-3 py-1 rounded-full text-sm transition-all ${
                isDishNameExpanded ? 'max-w-none' : 'max-w-[120px] truncate'
              }`}
            >
              {hasMediaItems && activeMediaItem?.kind === 'dish' && currentItem.dish.visitCount === 1
                ? (activeMediaItem.dishName || currentItem.dish.name)
                : `Visited ${currentItem.dish.visitCount}x`
              }
            </button>
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
      <div className="px-4 pt-3 pb-4">
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

        {/* Meta line for legacy/single-dish layout */}
        {!isVisitPost && restaurant && (
          <div className="flex items-start justify-between mb-2">
            <div>
              <p className="text-sm font-semibold text-gray-900">
                {displayAuthorName}
              </p>
              <p className="text-xs text-gray-500">
                rated{' '}
                <span className="font-medium text-gray-800">
                  {restaurant.name}
                </span>{' '}
                ·{' '}
                {formatRelativeTime(
                  (currentItem.review as any).createdAt ??
                    (currentItem.review as any).createdAtMs ??
                    currentItem.review.date
                )}
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
        )}

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
              <p className="mt-1 mb-3 text-sm text-gray-900 leading-snug border-l-4 border-gray-600 rounded-l-md pl-3 bg-gray-50 py-2 pr-2">
                {visitText}
              </p>
            );
          }

          // Dish context
          const source = dishContextItem || currentItem;
          if (source.review.caption) {
            return (
              <p className="mt-1 mb-3 text-sm text-gray-900 leading-snug border-l-4 border-gray-600 rounded-l-md pl-3 bg-gray-50 py-2 pr-2">
                {source.review.caption}
              </p>
            );
          }
          return null;
        })()}

        {/* Single-dish category label (solo layout only) */}
        {!isVisitPost && currentItem.dish && (
          (() => {
            const dishCategory =
              (currentItem.dish as any)?.dishCategory ??
              (currentItem.review as any)?.dishCategory ??
              undefined;

            if (!dishCategory) return null;

            return (
              <p className="mt-2 text-[11px] tracking-wide text-gray-500 uppercase pl-4">
                {dishCategory}
              </p>
            );
          })()
        )}

        {/* Single-dish row (name + rating) for solo layout */}
        {!isVisitPost && currentItem.dish && displayRating !== null && (
          <div className="mb-2">
            <button
              type="button"
              onClick={handleDishClickEnhanced}
              className="flex items-center justify-between w-full py-1.5 px-4 text-sm hover:bg-gray-50 rounded"
            >
              <span className="font-medium text-gray-900 truncate text-left">
                {currentItem.dish.name}
              </span>
              <span className="flex-shrink-0 ml-3 mr-6 text-xs font-semibold text-white bg-red-500 rounded-full px-2.5 py-[2px]">
                {displayRating.toFixed(1)}
              </span>
            </button>
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
                <button onClick={() => setShowCommentSheet(true)} className="flex items-center">
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
                  onClick={() => setShowCommentSheet(true)}
                  className="flex items-center text-gray-600 hover:text-primary transition-colors"
                >
                  <MessageCircleIcon size={20} className="mr-1" />
                  <span className="text-sm">{engagement.comments}</span>
                </button>
              </div>
              <div className="flex items-center space-x-3">
                <button 
                  onClick={() => {
                    console.log('💾 [FeedPost] Opening SaveToListModal with IDs:', {
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
        
        console.log('💾 [FeedPost] Rendering SaveToListModal with props:', modalProps);
        
        return (
          <SaveToListModal
            {...modalProps}
            onClose={() => {
              console.log('💾 [FeedPost] Closing SaveToListModal');
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

      <CommentSheet
        isOpen={showCommentSheet}
        onClose={() => setShowCommentSheet(false)}
        reviewId={id}
        reviewAuthorName={author.name}
      />
    </div>
  );

  const visitLayout = (
    <div ref={containerRef} className="relative bg-white rounded-2xl overflow-hidden shadow-sm mb-4">
      {/* Absolute rating (bigger, nudged down & left) */}
      <div className="pointer-events-none absolute top-5 right-5 z-0">
        <RatingBadge rating={heroRating} size="xl" />
      </div>

      {/* Header */}
      <div className="p-4 flex items-center gap-4">
        <img src={author.image} alt={displayAuthorName} loading="lazy" decoding="async" className="w-10 h-10 rounded-full object-cover" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            {/* NEW: Username area with follow button */}
            <div className="relative flex items-center">
              <span 
                onClick={handleUsernameClick}
                className="font-medium cursor-pointer hover:text-primary"
              >
                {displayAuthorName}
              </span>
              {/* Follow button: gray pill when not following, simple check icon when following */}
              {!isOwnPost && (
                <button
                  onClick={handleFollowToggle}
                  disabled={followLoading}
                  className={`ml-2 -mt-0.5 flex items-center justify-center transition-all duration-200 ${
                    isFollowingUser
                      ? 'text-green-600'
                      : 'px-2.5 py-0.5 rounded-full border text-xs font-medium border-gray-300 text-gray-600 bg-white hover:border-gray-400'
                  } ${followLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                >
                  {isFollowingUser ? (
                    <CheckCircleIcon size={14} />
                  ) : (
                    'Follow'
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
          {/* Restaurant line under header (visit layout) */}
          {restaurant && (
            <div className="mt-1 text-sm text-dark-gray flex items-center gap-0.5">
              <LocationPinIcon size={14} className="text-red-500" />
              <span
                onClick={() => {
                  if (restaurantId) {
                    navigate(`/restaurant/${restaurantId}`);
                  } else {
                    console.warn('Restaurant ID missing for:', restaurant?.name, 'Review ID:', id);
                  }
                }}
                className={`max-w-32 truncate ${restaurantId ? 'hover:text-primary cursor-pointer' : 'text-gray-500'}`}
              >
                {restaurant.name}
              </span>
              {review.serviceSpeed && (
                <span className="ml-1 text-xs flex-shrink-0">
                  {review.serviceSpeed === 'fast' ? '⚡' : review.serviceSpeed === 'normal' ? '⏱️' : '🐌'}
                </span>
              )}
              {restaurant.qualityScore !== undefined && qualityColor && (
                <div
                  className="ml-1 w-8 h-5 flex items-center justify-center rounded-full flex-shrink-0"
                  style={{ backgroundColor: qualityColor }}
                >
                  <span className="text-[11px] font-medium text-white">
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
          >
            {hasMediaItems && mediaItems.length > 0 ? (
              <div
                ref={scrollContainerRef}
                className="flex overflow-x-scroll snap-x snap-mandatory no-scrollbar"
                onScroll={handleScroll}
                style={{
                  scrollSnapType: 'x mandatory',
                  scrollBehavior: 'smooth',
                  WebkitOverflowScrolling: 'touch'
                }}
              >
                {mediaItems.map((item, index) => {
                  // Use medium (800x800) for main carousel display, fallback to original
                  const displayUrl = item.mediumUrl || item.imageUrl;
                  // Defensive: ensure imageUrl is valid before rendering
                  return item.imageUrl && typeof item.imageUrl === 'string' ? (
                    <div
                      key={item.id}
                      className="w-full aspect-square bg-gray-100 flex-shrink-0 snap-center relative"
                    >
                      <img
                        src={displayUrl}
                        alt={item.dishName || 'Visit photo'}
                        loading={isNearViewport || index < 3 ? "eager" : "lazy"}
                        decoding="async"
                        onLoad={() => handleImageLoad(displayUrl)}
                        onError={(e) => {
                          // Fallback to original URL if medium/thumbnail fails (404, etc.)
                          if (e.currentTarget.src !== item.imageUrl) {
                            console.warn(`Failed to load ${displayUrl}, falling back to original`);
                            e.currentTarget.src = item.imageUrl;
                          }
                        }}
                        className={`w-full h-full object-cover absolute inset-0 transition-opacity duration-300 ${
                          imageLoaded[displayUrl] ? 'opacity-100' : 'opacity-0'
                        }`}
                      />
                    </div>
                  ) : (
                    <div
                      key={item.id}
                      className="w-full aspect-square bg-gray-200 flex-shrink-0 snap-center flex items-center justify-center"
                    >
                      <span className="text-gray-400">Image unavailable</span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div
                ref={scrollContainerRef}
                className="flex overflow-x-scroll snap-x snap-mandatory no-scrollbar"
                onScroll={handleScroll}
                style={{
                  scrollSnapType: 'x mandatory',
                  scrollBehavior: 'smooth',
                  WebkitOverflowScrolling: 'touch'
                }}
              >
                {isCarousel && carouselItems.length > 1 ? (
                  carouselItems.map((item, index) => (
                    <div
                      key={item.id}
                      className="w-full aspect-square bg-gray-100 flex-shrink-0 snap-center relative"
                    >
                      <img
                        src={item.dish.image}
                        alt={item.dish.name}
                        loading={isNearViewport || index < 3 ? "eager" : "lazy"}
                        decoding="async"
                        onLoad={() => handleImageLoad(item.dish.image)}
                        className={`w-full h-full object-cover absolute inset-0 transition-opacity duration-300 ${
                          imageLoaded[item.dish.image] ? 'opacity-100' : 'opacity-0'
                        }`}
                      />
                    </div>
                  ))
                ) : (
                  <div className="w-full aspect-square bg-gray-100 snap-center relative">
                    <img
                      src={currentItem.dish.image}
                      alt={currentItem.dish.name}
                      loading={isNearViewport ? "eager" : "lazy"}
                      decoding="async"
                      onLoad={() => handleImageLoad(currentItem.dish.image)}
                      className={`w-full h-full object-cover absolute inset-0 transition-opacity duration-300 ${
                        imageLoaded[currentItem.dish.image] ? 'opacity-100' : 'opacity-0'
                      }`}
                    />
                  </div>
                )}
              </div>
            )}
            {currentItem.dish.visitCount && (
              <button
                type="button"
                onClick={() => setIsDishNameExpanded(!isDishNameExpanded)}
                className={`absolute top-4 right-4 bg-black bg-opacity-50 text-white px-3 py-1 rounded-full text-sm transition-all ${
                  isDishNameExpanded ? 'max-w-none' : 'max-w-[120px] truncate'
                }`}
              >
                {hasMediaItems && activeMediaItem?.kind === 'dish' && currentItem.dish.visitCount === 1
                  ? (activeMediaItem.dishName || currentItem.dish.name)
                  : `Visited ${currentItem.dish.visitCount}x`
                }
              </button>
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

                      // Set flag to prevent handleScroll from updating index during animation
                      isProgrammaticScroll.current = true;

                      // Scroll to the selected index
                      if (scrollContainerRef.current) {
                        const itemWidth = scrollContainerRef.current.offsetWidth;
                        scrollContainerRef.current.scrollTo({
                          left: safeIndex * itemWidth,
                          behavior: 'smooth'
                        });

                        // Clear flag after scroll animation completes (~300ms for smooth scroll)
                        setTimeout(() => {
                          isProgrammaticScroll.current = false;
                        }, 350);
                      }
                    }}
                    className={`relative flex-shrink-0 rounded-xl overflow-hidden border ${
                      isActive
                        ? 'border-red-500 ring-2 ring-red-100'
                        : 'border-transparent opacity-80 hover:opacity-100'
                    }`}
                  >
                    <div className="h-12 w-12 md:h-14 md:w-14 bg-gray-100 relative">
                      <img
                        src={item.thumbnailUrl || item.imageUrl}
                        alt={item.dishName || currentItem.dish.name}
                        loading="lazy"
                        decoding="async"
                        onLoad={() => handleImageLoad(`thumb_${item.thumbnailUrl || item.imageUrl}`)}
                        onError={(e) => {
                          // Fallback to original URL if thumbnail fails (404, etc.)
                          if (e.currentTarget.src !== item.imageUrl) {
                            e.currentTarget.src = item.imageUrl;
                          }
                        }}
                        className={`h-full w-full object-cover absolute inset-0 transition-opacity duration-200 ${
                          imageLoaded[`thumb_${item.thumbnailUrl || item.imageUrl}`] ? 'opacity-100' : 'opacity-0'
                        }`}
                      />
                    </div>
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

                          // Set flag to prevent handleScroll from updating index during animation
                          isProgrammaticScroll.current = true;

                          // Scroll to the selected index
                          if (scrollContainerRef.current) {
                            const itemWidth = scrollContainerRef.current.offsetWidth;
                            scrollContainerRef.current.scrollTo({
                              left: safeIndex * itemWidth,
                              behavior: 'smooth'
                            });

                            // Clear flag after scroll animation completes (~300ms for smooth scroll)
                            setTimeout(() => {
                              isProgrammaticScroll.current = false;
                            }, 350);
                          }
                        }}
                        className={`relative flex-shrink-0 rounded-xl overflow-hidden border ${
                          isActive
                            ? 'border-red-500 ring-2 ring-red-100'
                            : 'border-transparent opacity-80 hover:opacity-100'
                        }`}
                      >
                        <div className="h-12 w-12 md:h-14 md:w-14 bg-gray-100 relative">
                          <img
                            src={item.dish.image}
                            alt={item.dish.name}
                            loading="lazy"
                            decoding="async"
                            onLoad={() => handleImageLoad(`thumb_${item.dish.image}`)}
                            className={`h-full w-full object-cover absolute inset-0 transition-opacity duration-200 ${
                              imageLoaded[`thumb_${item.dish.image}`] ? 'opacity-100' : 'opacity-0'
                            }`}
                          />
                        </div>
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
              <p className="text-sm font-semibold text-gray-900">{displayAuthorName}</p>
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
            <p className="mt-1 mb-3 text-sm text-gray-900 leading-snug border-l-4 border-gray-600 rounded-l-md pl-3 bg-gray-50 py-2 pr-2">
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
                    {/* Category label: left-aligned with left padding to match dish column */}
                    <p className="mt-2 text-[11px] tracking-wide text-gray-500 uppercase pl-4">{category}</p>
                    <div className="space-y-1">
                      {visible.map((dish: any) => (
                        <button
                          key={dish.id}
                          onClick={() => navigateToDishReview(dish.id, dish.dishId)}
                          className="flex items-center justify-between w-full py-1.5 px-4 text-sm hover:bg-gray-50 rounded"
                        >
                          <span className="font-medium text-gray-900 truncate text-left">
                            {dish.name}
                          </span>
                          <span className="flex-shrink-0 ml-3 mr-6 text-xs font-semibold text-white bg-red-500 rounded-full px-2.5 py-[2px]">
                            {dish.rating.toFixed(1)}
                          </span>
                        </button>
                      ))}
                      {remaining > 0 && (
                        <button
                          onClick={() => navigateToDishReview(visible[0]?.id || '', visible[0]?.dishId)}
                          className="w-full text-left text-xs text-gray-500 mt-1 hover:text-gray-700 pl-4"
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
          <p className="text-sm text-gray-900 mb-2 leading-snug border-l-4 border-gray-600 rounded-l-md pl-3 bg-gray-50 py-2 pr-2">{currentItem.review.caption}</p>
        )}

        {/* Dish details - Only for legacy/single-dish layout */}
        {!isVisitPost && currentItem.dish && displayRating !== null && (
          <div className="mb-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-900 truncate text-left">
                {currentItem.dish.name}
              </span>
              <span className="flex-shrink-0 ml-3 text-xs font-semibold text-white bg-red-500 rounded-full px-2.5 py-[2px]">
                {displayRating.toFixed(1)}
              </span>
            </div>
          </div>
        )}

        {/* Taste chips and audience tags - Only for legacy/single-dish layout */}
        {!isVisitPost && renderTagChips(currentItem, isCarousel, tags)}

        {/* Engagement */}
        <div className="flex justify-between items-center pt-2 border-t border-light-gray">
          {showLikesComments ? (
            <>
              <div className="flex items-center space-x-4">
                <button className="flex items-center">
                  <HeartIcon size={22} className="text-dark-gray" />
                  <span className="ml-1 text-sm">{engagement.likes}</span>
                </button>
                <button onClick={() => setShowCommentSheet(true)} className="flex items-center">
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
                  onClick={() => setShowCommentSheet(true)}
                  className="flex items-center text-gray-600 hover:text-primary transition-colors"
                >
                  <MessageCircleIcon size={20} className="mr-1" />
                  <span className="text-sm">{engagement.comments}</span>
                </button>
              </div>
              <div className="flex items-center space-x-3">
                <button 
                  onClick={() => {
                    console.log('💾 [FeedPost] Opening SaveToListModal with IDs:', {
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
        
        console.log('💾 [FeedPost] Rendering SaveToListModal with props:', modalProps);
        
        return (
          <SaveToListModal
            {...modalProps}
            onClose={() => {
              console.log('💾 [FeedPost] Closing SaveToListModal');
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

      <CommentSheet
        isOpen={showCommentSheet}
        onClose={() => setShowCommentSheet(false)}
        reviewId={id}
        reviewAuthorName={author.name}
      />
    </div>
  );

  // NEW: Calculate average rating for compact layout (no photos)
  const compactAverageRating = useMemo(() => {
    if (visitDishes && visitDishes.length > 0) {
      const sum = visitDishes.reduce((acc, dish) => acc + dish.rating, 0);
      return sum / visitDishes.length;
    }
    // Fallback: use current item rating or display rating
    return displayRating ?? heroRating ?? 0;
  }, [visitDishes, displayRating, heroRating]);

  // NEW: Compact Layout (for posts without photos - text-only reviews)
  const compactLayout = (
    <div ref={containerRef} className="relative bg-white rounded-2xl overflow-hidden shadow-sm mb-4">
      {/* Top-right average rating */}
      <div className="pointer-events-none absolute top-5 right-5 z-10">
        <RatingBadge rating={compactAverageRating} size="xl" />
      </div>

      {/* Header */}
      <div className="p-4 pb-3">
        <div className="flex items-center gap-3 mb-3">
          <img
            src={author.image}
            alt={displayAuthorName}
            loading="lazy"
            decoding="async"
            className="w-10 h-10 rounded-full object-cover"
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              {/* Username area with follow button */}
              <div className="relative flex items-center">
                <span
                  onClick={handleUsernameClick}
                  className="font-medium cursor-pointer hover:text-primary"
                >
                  {displayAuthorName}
                </span>
                {!isOwnPost && (
                  <button
                    onClick={handleFollowToggle}
                    disabled={followLoading}
                    className={`ml-2 -mt-0.5 flex items-center justify-center transition-all duration-200 ${
                      isFollowingUser
                        ? 'text-green-600'
                        : 'px-2.5 py-0.5 rounded-full border text-xs font-medium border-gray-300 text-gray-600 bg-white hover:border-gray-400'
                    } ${followLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                  >
                    {isFollowingUser ? (
                      <CheckCircleIcon size={14} />
                    ) : (
                      'Follow'
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
            {/* Compact header: "username rated restaurantName" */}
            <p className="text-xs text-gray-500 mt-0.5">
              rated{' '}
              <span
                onClick={() => {
                  if (restaurantId) {
                    navigate(`/restaurant/${restaurantId}`);
                  }
                }}
                className={`font-medium text-gray-800 ${restaurantId ? 'hover:text-primary cursor-pointer' : ''}`}
              >
                {restaurant?.name}
              </span>
              {' · '}
              {formatRelativeTime(
                (review as any).createdAt ??
                (review as any).createdAtMs ??
                review.date
              )}
            </p>
          </div>
          {/* Dots menu */}
          <button
            type="button"
            onClick={() => setIsActionSheetOpen(true)}
            className="p-1 text-gray-400 hover:text-gray-600"
            aria-label="More options"
          >
            <DotsIcon size={20} />
          </button>
        </div>

        {/* Caption */}
        {(visitCaption || currentItem.review.caption) && (
          <p className="text-sm text-gray-900 mb-3 leading-snug border-l-4 border-gray-600 rounded-l-md pl-3 bg-gray-50 py-2 pr-2">
            {visitCaption || currentItem.review.caption}
          </p>
        )}

        {/* Dish list with category grouping */}
        {visitDishes && visitDishes.length > 0 && (
          <div className="space-y-3">
            {groupDishesByCategory(visitDishes).map(([category, dishes]) => (
              <div key={category}>
                {/* Category label */}
                <p className="text-[11px] tracking-wide text-gray-500 uppercase pl-4 mb-1">
                  {category}
                </p>
                {/* Dishes in this category */}
                <div className="space-y-1">
                  {dishes.map((dish: any) => (
                    <button
                      key={dish.id}
                      onClick={() => navigateToDishReview(dish.id, dish.dishId)}
                      className="flex items-center justify-between w-full py-1.5 px-4 text-sm hover:bg-gray-50 rounded"
                    >
                      <span className="font-medium text-gray-900 truncate text-left">
                        {dish.name}
                      </span>
                      <span className="flex-shrink-0 ml-3 mr-6 text-xs font-semibold text-white bg-red-500 rounded-full px-2.5 py-[2px]">
                        {dish.rating.toFixed(1)}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Fallback: single dish if visitDishes not available */}
        {(!visitDishes || visitDishes.length === 0) && currentItem.dish && displayRating !== null && (
          <div className="mb-2">
            {/* Category label for single dish */}
            {(() => {
              const dishCategory =
                (currentItem.dish as any)?.dishCategory ??
                (currentItem.review as any)?.dishCategory ??
                undefined;

              return dishCategory ? (
                <p className="text-[11px] tracking-wide text-gray-500 uppercase pl-4 mb-1">
                  {dishCategory}
                </p>
              ) : null;
            })()}

            <button
              type="button"
              onClick={handleDishClickEnhanced}
              className="flex items-center justify-between w-full py-1.5 px-4 text-sm hover:bg-gray-50 rounded"
            >
              <span className="font-medium text-gray-900 truncate text-left">
                {currentItem.dish.name}
              </span>
              <span className="flex-shrink-0 ml-3 mr-6 text-xs font-semibold text-white bg-red-500 rounded-full px-2.5 py-[2px]">
                {displayRating.toFixed(1)}
              </span>
            </button>
          </div>
        )}

        {/* Engagement buttons */}
        <div className="flex justify-between items-center pt-3 mt-3 border-t border-light-gray">
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
              onClick={() => setShowCommentSheet(true)}
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
              <BookmarkIcon size={18} className={saved ? 'text-primary fill-primary mr-1' : 'text-gray-600 mr-1'} />
              {saved ? 'Saved' : 'Save'}
            </button>
            <button
              onClick={() => {
                if (navigator.share) {
                  navigator.share({
                    title: `${currentItem.dish.name} at ${restaurant?.name}`,
                    text: `Check out this review!`,
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
      </div>

      {/* Modals (reuse from other layouts) */}
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
              <button
                className="w-full px-4 py-3 text-left text-[15px] hover:bg-neutral-50"
                onClick={() => {
                  setIsActionSheetOpen(false);
                  const shareData = {
                    title: `Review at ${restaurant?.name}`,
                    text: `Check out this review!`,
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
            <button
              className="mt-2 w-full rounded-xl bg-neutral-100 px-4 py-3 text-[15px] font-medium hover:bg-neutral-200"
              onClick={() => setIsActionSheetOpen(false)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {showSaveModal && (
        <SaveToListModal
          isOpen={showSaveModal}
          restaurantId={restaurantId}
          restaurantName={restaurant?.name}
          dishId={currentItem.dishId}
          dishName={currentItem.dish.name}
          postId={id}
          onClose={() => setShowSaveModal(false)}
        />
      )}

      <ReceiptUploadModal
        isOpen={showReceiptModal}
        onClose={() => setShowReceiptModal(false)}
        onUpload={async (files) => {
          const urls = await uploadReviewProofs(id, files);
          await markReviewPendingProof(id, urls);
        }}
      />

      <CommentSheet
        isOpen={showCommentSheet}
        onClose={() => setShowCommentSheet(false)}
        reviewId={id}
        reviewAuthorName={author.name}
      />
    </div>
  );

  const renderVisitLayout = () => visitLayout;

  // NEW: Layout selection logic - choose compact for non-photo posts
  const isCompactPost = !hasMediaItems && (visitDishes && visitDishes.length > 0);

  if (isCompactPost) {
    const tEnd = performance.now?.() ?? Date.now();
    console.log('[FeedPost][render-end]', {
      ts: new Date().toISOString(),
      id,
      layout: 'compact',
      durationMs: tEnd - renderStart,
    });
    return compactLayout;
  }

  if (isVisitPost) {
    const tEnd = performance.now?.() ?? Date.now();
    console.log('[FeedPost][render-end]', {
      ts: new Date().toISOString(),
      id,
      layout: 'visit',
      durationMs: tEnd - renderStart,
    });
    return renderVisitLayout();
  }

  const tEnd = performance.now?.() ?? Date.now();
  console.log('[FeedPost][render-end]', {
    ts: new Date().toISOString(),
    id,
    layout: 'legacy',
    durationMs: tEnd - renderStart,
  });
  return legacyLayout;
};

const FeedPost = React.memo(FeedPostComponent);

export default FeedPost;
