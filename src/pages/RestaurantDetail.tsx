import React, { useState, useEffect, useRef, useMemo, startTransition } from 'react';
import { useParams, Link } from 'react-router-dom';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useNavigate } from 'react-router-dom';
import { ArrowLeftIcon, StarIcon, MapPinIcon, PhoneIcon, ClockIcon, BookmarkIcon, ShareIcon, ChevronRightIcon, ChevronLeftIcon, Utensils, Soup, Salad, Coffee, Cake, Fish, Pizza, Sandwich, ChefHat, ChevronDown, Globe, DollarSign, X, Trophy } from 'lucide-react';
import BottomNavigation from '../components/BottomNavigation';
import SaveToListModal from '../components/SaveToListModal';
import { calculateRestaurantQualityScore } from '../services/reviewService';
import RatingBadge from '../components/RatingBadge';
import { getAvatarUrl } from '../utils/avatarUtils';
import { useUserStore } from '../stores/userStore';
import { getTopDishes } from '../utils/topDishes';

interface Restaurant {
  id: string;
  name: string;
  address: string;
  phone: string;
  cuisine: string;
  coordinates?: { latitude?: number; longitude?: number; lat?: number; lng?: number };
  qualityScore?: number;
  googlePhotos?: string[];
  hours?: Record<string, string>;
  website?: string;
  priceLevel?: number;
  avgServiceSpeed?: number | null;
  source?: string;
}

interface MenuItem {
  id: string;
  name: string;
  category: string;
  price?: number;
  description?: string;
  coverImage?: string | null;
}

interface Review {
  id: string;
  userId: string;
  restaurantId?: string;
  menuItemId?: string;
  dish: string;
  rating: number;
  personalNote: string;
  negativeNote: string;
  images?: string[];
  media?: { photos?: string[] };
  createdAt: any;
}

interface ReviewAuthor {
  id: string;
  name: string;
  username: string;
  image: string;
}
const RestaurantDetail: React.FC = () => {
  const {
    id
  } = useParams<{
    id: string;
  }>();
  const navigate = useNavigate();
  const getProfileCached = useUserStore(state => state.getProfileCached);
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [menuItemRatings, setMenuItemRatings] = useState<{[key: string]: {rating: number, count: number}}>({});
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [openSections, setOpenSections] = useState<Set<string>>(new Set());
  const initializedRef = useRef(false);
  const [authors, setAuthors] = useState<Record<string, ReviewAuthor>>({});
  const [showAllHours, setShowAllHours] = useState(false);
  const [heroImageIndex, setHeroImageIndex] = useState(0);
  const heroScrollRef = useRef<HTMLDivElement>(null);
  const heroModalScrollRef = useRef<HTMLDivElement>(null);
  const isProgrammaticScroll = useRef(false);
  const isProgrammaticModalScroll = useRef(false);
  const [isHeroModalOpen, setIsHeroModalOpen] = useState(false);
  const [failedHeroImages, setFailedHeroImages] = useState<Set<string>>(new Set());
  const [showAllTopDishes, setShowAllTopDishes] = useState(false);

  // Helper to collect visit photos from all reviews (both legacy and new structures)
  const getVisitPhotosFromReviews = (reviewsList: Review[] | undefined | null): string[] => {
    if (!reviewsList || reviewsList.length === 0) return [];

    const photoUrls = new Set<string>();

    reviewsList.forEach(review => {
      // Collect from legacy structure
      if (review.images && Array.isArray(review.images)) {
        review.images.forEach(url => {
          if (url) photoUrls.add(url);
        });
      }

      // Collect from newer structure
      if (review.media?.photos && Array.isArray(review.media.photos)) {
        review.media.photos.forEach(url => {
          if (url) photoUrls.add(url);
        });
      }
    });

    return Array.from(photoUrls);
  };

  // Helper function to group menu items by category
  const groupMenuByCategory = (items: MenuItem[]) => {
    return items.reduce((acc, item) => {
      const key = item.category || 'Custom';
      if (!acc[key]) acc[key] = [];
      acc[key].push(item);
      return acc;
    }, {} as Record<string, MenuItem[]>);
  };


  // Helper function to get all images from reviews
  const getAllReviewImages = (reviewsArray: Review[]) => {
    const out: string[] = [];
    for (const r of reviewsArray) {
      const mediaPhotos = Array.isArray(r?.media?.photos) ? r.media.photos : [];
      const legacyImages = Array.isArray(r?.images) ? r.images : [];
      if (mediaPhotos.length) out.push(...mediaPhotos);
      else if (legacyImages.length) out.push(...legacyImages);
    }
    return out;
  };

  const isValidHeroImage = (url?: string | null): boolean => {
    if (!url || typeof url !== 'string' || url.trim() === '') return false;
    const urlLower = url.toLowerCase();

    if (urlLower.includes('tip-logo') ||
        urlLower.includes('/images/tip-logo') ||
        urlLower.includes('tip_logo') ||
        urlLower.includes('/tip-logo') ||
        urlLower.includes('tiplogo') ||
        urlLower.includes('placeholder')) {
      return false;
    }

    if (urlLower.includes('maps.googleapis.com/maps/api/staticmap') ||
        urlLower.includes('googleapis.com/maps/api/staticmap') ||
        urlLower.includes('maps.gstatic') ||
        urlLower.includes('gstatic.com/mapfiles') ||
        urlLower.includes('googleusercontent.com/maps') ||
        urlLower.includes('streetview') ||
        urlLower.includes('maptile')) {
      return false;
    }

    if (urlLower.includes('photo_not_available') ||
        urlLower.includes('no_image') ||
        urlLower.includes('notfound')) {
      return false;
    }

    return true;
  };

  const registerFailedHeroImage = (url?: string | null) => {
    if (!url) return;
    setFailedHeroImages((prev) => {
      if (prev.has(url)) return prev;
      const next = new Set(prev);
      next.add(url);
      return next;
    });
  };

  const extractReviewTags = (review: any): { tasteChips: string[]; audienceTags: string[] } => {
    const tasteChips: string[] = [];
    const audienceTags: string[] = [];
    if (review.taste) {
      if (review.taste.value?.level) {
        const map: any = { overpriced: 'Overpriced', fair: 'Fair value', bargain: 'Bargain' };
        const label = map[review.taste.value.level]; if (label) tasteChips.push(label);
      }
      if (review.taste.freshness?.level) {
        const map: any = { not_fresh: 'Not fresh', just_right: 'Fresh', very_fresh: 'Very fresh' };
        const label = map[review.taste.freshness.level]; if (label) tasteChips.push(label);
      }
      if (review.taste.saltiness?.level) {
        const map: any = { needs_more_salt: 'Needs more salt', balanced: 'Balanced', too_salty: 'Too salty' };
        const label = map[review.taste.saltiness.level]; if (label) tasteChips.push(label);
      }
    }
    if (review.outcome?.audience && Array.isArray(review.outcome.audience)) {
      const map: any = { spicy_lovers: 'Spicy lovers', date_night: 'Date night', family: 'Family meal', quick_bite: 'Quick bite', solo: 'Solo treat', group: 'Group hang' };
      review.outcome.audience.forEach((t: string) => { const label = map[t]; if (label) audienceTags.push(label); });
    }
    return { tasteChips, audienceTags };
  };

  // Helper function to get category icon
  const getCategoryIcon = (category: string) => {
    const categoryLower = category.toLowerCase();
    if (categoryLower.includes('soup') || categoryLower.includes('bowl')) return Soup;
    if (categoryLower.includes('salad') || categoryLower.includes('green') || categoryLower.includes('vegetable')) return Salad;
    if (categoryLower.includes('coffee') || categoryLower.includes('tea') || categoryLower.includes('drink') || categoryLower.includes('beverage')) return Coffee;
    if (categoryLower.includes('dessert') || categoryLower.includes('cake') || categoryLower.includes('sweet') || categoryLower.includes('pastry')) return Cake;
    if (categoryLower.includes('fish') || categoryLower.includes('seafood')) return Fish;
    if (categoryLower.includes('pizza')) return Pizza;
    if (categoryLower.includes('sandwich') || categoryLower.includes('burger') || categoryLower.includes('handheld') || categoryLower.includes('wrap')) return Sandwich;
    if (categoryLower.includes('appetizer') || categoryLower.includes('starter') || categoryLower.includes('small plate')) return ChefHat;
    if (categoryLower.includes('entree') || categoryLower.includes('entrée') || categoryLower.includes('main') || categoryLower.includes('plato fuerte')) return Utensils;
    if (categoryLower.includes('chef') || categoryLower.includes('special')) return ChefHat;
    return Utensils; // Default icon
  };

  const formatPriceLevelLabel = (level?: number | null) => {
    if (level === null || level === undefined) return null;
    const clamped = Math.min(Math.max(Math.round(level), 1), 4);
    return '$'.repeat(clamped);
  };

const getQualityColor = (percentage: number): string => {
  const clampedScore = Math.max(0, Math.min(100, percentage));

  if (clampedScore >= 90) return '#2F6F4E'; // Premium / Excellent (forest green)
  if (clampedScore >= 80) return '#4F9B75'; // Very Good
  if (clampedScore >= 70) return '#9FD3B5'; // Good / Reliable
  if (clampedScore >= 60) return '#E4D96F'; // Average / Caution
  if (clampedScore >= 50) return '#F0A43C'; // Declining
  if (clampedScore >= 36) return '#E06B2D'; // Poor
  return '#C92A2A';                          // Hard Red / Avoid
};

const getCurrentDayHours = (hours: Record<string, string>) => {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const today = days[new Date().getDay()].toLowerCase();
  const normalizedEntry = Object.entries(hours).find(([key]) => key.toLowerCase() === today);
  return normalizedEntry?.[1] || hours[today] || 'Hours not available';
};

  const qualityScore = calculateRestaurantQualityScore(reviews.map(review => ({ ...review, category: 'custom' })));
  const reviewImages = getAllReviewImages(reviews);
  const groupedMenu = groupMenuByCategory(menuItems);
  const avgDishRating = reviews.length > 0 ? (reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length) : null;
  const topDishesAll = useMemo(() => {
    if (!reviews.length) return [];
    return getTopDishes(reviews as any, Math.max(reviews.length, 3));
  }, [reviews]);
  const topDishesVisible = showAllTopDishes ? topDishesAll : topDishesAll.slice(0, 3);
  
  // Initialize first section as open when menu items are loaded
  useEffect(() => {
    if (menuItems.length > 0 && !initializedRef.current) {
      const categories = Object.keys(groupedMenu);
      if (categories.length > 0) {
        setOpenSections(new Set([categories[0]]));
        initializedRef.current = true;
      }
    }
  }, [menuItems, groupedMenu]);
  
  // Toggle section open/closed
  const toggleSection = (category: string) => {
    const newOpenSections = new Set(openSections);
    if (newOpenSections.has(category)) {
      newOpenSections.delete(category);
    } else {
      newOpenSections.add(category);
    }
    setOpenSections(newOpenSections);
  };

  useEffect(() => {
    const fetchRestaurantData = async () => {
      if (!id) return;
      
      try {
        setLoading(true);
        
        // Fetch restaurant
        const restaurantDoc = await getDoc(doc(db, 'restaurants', id));
        if (restaurantDoc.exists()) {
          setRestaurant({ id: restaurantDoc.id, ...(restaurantDoc.data() as any) } as Restaurant);
        }
        
        // Fetch menu items
        const menuQuery = query(collection(db, 'menuItems'), where('restaurantId', '==', id));
        const menuSnapshot = await getDocs(menuQuery);
        const menuData = menuSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as MenuItem));
        setMenuItems(menuData);
        
        // Fetch reviews
        const reviewsQuery = query(collection(db, 'reviews'), where('restaurantId', '==', id));
        const reviewsSnapshot = await getDocs(reviewsQuery);
        const reviewsData = reviewsSnapshot.docs
          .map(doc => ({ id: doc.id, ...(doc.data() as any) } as Review))
          .filter((r: any) => r?.isDeleted !== true);
        setReviews(reviewsData);

        // Calculate per-dish ratings and derive category fallback from reviews
        const ratingsMap: {[key: string]: {rating: number, count: number}} = {};
        const categoryFromReview: {[key: string]: string} = {};
        const addToMap = (key: string, review: Review) => {
          if (!ratingsMap[key]) ratingsMap[key] = { rating: 0, count: 0 };
          ratingsMap[key].rating += review.rating;
          ratingsMap[key].count += 1;
          const dc = (review as any).dishCategory as string | undefined;
          if (dc && !categoryFromReview[key]) categoryFromReview[key] = dc;
        };
        reviewsData.forEach((review) => {
          if ((review as any).menuItemId) addToMap((review as any).menuItemId as string, review);
          if ((review as any).dishId) addToMap((review as any).dishId as string, review);
        });
        Object.keys(ratingsMap).forEach((id) => {
          ratingsMap[id].rating = ratingsMap[id].rating / ratingsMap[id].count;
        });
        setMenuItemRatings(ratingsMap);

        // If menu items have null/Custom category, set from review dishCategory
        setMenuItems((prev) => prev.map((it) => {
          const dc = categoryFromReview[it.id];
          if (dc && (!it.category || it.category.toLowerCase() === 'custom')) {
            return { ...it, category: dc } as any;
          }
          return it;
        }));
        
      } catch (error) {
        console.error('Error fetching restaurant data:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchRestaurantData();
  }, [id]);

  useEffect(() => {
    setShowAllHours(false);
  }, [restaurant?.id]);

  // Load author profiles for condensed reviews
  useEffect(() => {
    const load = async () => {
      const ids = Array.from(new Set(reviews.map(r => r.userId).filter(Boolean)));
      if (!ids.length) return;
      const up: Record<string, ReviewAuthor> = {};
      // Use cached profiles to avoid N+1 waterfall
      await Promise.all(ids.map(async (uid) => {
        try {
          const profile = await getProfileCached(uid);
          if (profile) {
            up[uid] = { id: uid, name: profile.displayName || profile.username, username: profile.username, image: getAvatarUrl(profile) };
          } else {
            up[uid] = { id: uid, name: 'Anonymous', username: 'anonymous', image: getAvatarUrl({ username: uid }) } as any;
          }
        } catch {
          up[uid] = { id: uid, name: 'Anonymous', username: 'anonymous', image: getAvatarUrl({ username: uid }) } as any;
        }
      }));
      setAuthors(prev => ({ ...prev, ...up }));
    };
    load();
  }, [reviews]);

  // Build hero images slideshow
  const visitPhotos = getVisitPhotosFromReviews(reviews);
  const limitedVisitPhotos = visitPhotos.filter(isValidHeroImage).slice(0, 10);
  const googlePhotos = Array.isArray(restaurant?.googlePhotos)
    ? restaurant.googlePhotos.filter(isValidHeroImage)
    : [];

  const heroImages: string[] = [];
  if (googlePhotos.length > 0) {
    heroImages.push(googlePhotos[0]);
  }
  heroImages.push(...limitedVisitPhotos);

  const displayHeroImages = heroImages.filter((url) => !failedHeroImages.has(url));
  const hasHeroImages = displayHeroImages.length > 0;
  const hasMultipleImages = displayHeroImages.length > 1;

  useEffect(() => {
    if (!hasHeroImages) {
      if (heroImageIndex !== 0) setHeroImageIndex(0);
      return;
    }
    if (heroImageIndex >= displayHeroImages.length) {
      setHeroImageIndex(Math.max(0, displayHeroImages.length - 1));
    }
  }, [displayHeroImages.length, hasHeroImages, heroImageIndex]);

  useEffect(() => {
    if (!isHeroModalOpen) return;
    const originalBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalBodyOverflow;
    };
  }, [isHeroModalOpen]);

  // Handle scroll-based navigation for hero images
  const handleHeroScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (isProgrammaticScroll.current) {
      return;
    }

    const container = e.currentTarget;
    const scrollLeft = container.scrollLeft;
    const itemWidth = container.offsetWidth;
    const newIndex = Math.round(scrollLeft / itemWidth);

    if (newIndex !== heroImageIndex && newIndex >= 0 && newIndex < displayHeroImages.length) {
      setHeroImageIndex(newIndex);
    }
  };

  const goPrevImage = () => {
    if (!hasHeroImages) return;
    const newIndex = heroImageIndex === 0 ? displayHeroImages.length - 1 : heroImageIndex - 1;
    setHeroImageIndex(newIndex);

    isProgrammaticScroll.current = true;
    if (heroScrollRef.current) {
      const itemWidth = heroScrollRef.current.offsetWidth;
      heroScrollRef.current.scrollTo({
        left: newIndex * itemWidth,
        behavior: 'smooth'
      });
      setTimeout(() => {
        isProgrammaticScroll.current = false;
      }, 350);
    }

    if (isHeroModalOpen) {
      isProgrammaticModalScroll.current = true;
      if (heroModalScrollRef.current) {
        const itemWidth = heroModalScrollRef.current.offsetWidth;
        heroModalScrollRef.current.scrollTo({
          left: newIndex * itemWidth,
          behavior: 'smooth'
        });
      }
      setTimeout(() => {
        isProgrammaticModalScroll.current = false;
      }, 350);
    }
  };

  const goNextImage = () => {
    if (!hasHeroImages) return;
    const newIndex = heroImageIndex === displayHeroImages.length - 1 ? 0 : heroImageIndex + 1;
    setHeroImageIndex(newIndex);

    isProgrammaticScroll.current = true;
    if (heroScrollRef.current) {
      const itemWidth = heroScrollRef.current.offsetWidth;
      heroScrollRef.current.scrollTo({
        left: newIndex * itemWidth,
        behavior: 'smooth'
      });
      setTimeout(() => {
        isProgrammaticScroll.current = false;
      }, 350);
    }

    if (isHeroModalOpen) {
      isProgrammaticModalScroll.current = true;
      if (heroModalScrollRef.current) {
        const itemWidth = heroModalScrollRef.current.offsetWidth;
        heroModalScrollRef.current.scrollTo({
          left: newIndex * itemWidth,
          behavior: 'smooth'
        });
      }
      setTimeout(() => {
        isProgrammaticModalScroll.current = false;
      }, 350);
    }
  };

  const handleDotClick = (index: number) => {
    setHeroImageIndex(index);

    isProgrammaticScroll.current = true;
    if (heroScrollRef.current) {
      const itemWidth = heroScrollRef.current.offsetWidth;
      heroScrollRef.current.scrollTo({
        left: index * itemWidth,
        behavior: 'smooth'
      });
      setTimeout(() => {
        isProgrammaticScroll.current = false;
      }, 350);
    }

    if (isHeroModalOpen) {
      isProgrammaticModalScroll.current = true;
      if (heroModalScrollRef.current) {
        const itemWidth = heroModalScrollRef.current.offsetWidth;
        heroModalScrollRef.current.scrollTo({
          left: index * itemWidth,
          behavior: 'smooth'
        });
      }
      setTimeout(() => {
        isProgrammaticModalScroll.current = false;
      }, 350);
    }
  };

  const openHeroModal = (index: number) => {
    if (!hasHeroImages) return;
    setHeroImageIndex(index);
    setIsHeroModalOpen(true);
    isProgrammaticModalScroll.current = true;
    setTimeout(() => {
      if (heroModalScrollRef.current) {
        const itemWidth = heroModalScrollRef.current.offsetWidth;
        heroModalScrollRef.current.scrollTo({ left: index * itemWidth, behavior: 'auto' });
      }
      isProgrammaticModalScroll.current = false;
    }, 0);
  };

  const handleHeroModalScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (isProgrammaticModalScroll.current) return;
    const container = e.currentTarget;
    const scrollLeft = container.scrollLeft;
    const itemWidth = container.offsetWidth;
    const newIndex = Math.round(scrollLeft / itemWidth);
    if (newIndex !== heroImageIndex && newIndex >= 0 && newIndex < displayHeroImages.length) {
      setHeroImageIndex(newIndex);
    }
  };

  const closeHeroModal = () => setIsHeroModalOpen(false);

  if (loading) {
    return (
      <div className="min-h-screen bg-light-gray flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-dark-gray">Loading restaurant...</p>
        </div>
      </div>
    );
  }

  if (!restaurant) {
    return (
      <div className="min-h-screen bg-light-gray flex items-center justify-center">
        <div className="text-center">
          <p className="text-lg font-medium text-dark-gray mb-4">Restaurant not found</p>
          <Link to="/" className="text-primary hover:underline">Back to Home</Link>
        </div>
      </div>
    );
  }

  const hasReviews = reviews.length > 0;
  const hoursRecord = restaurant.hours || {};
  const hoursAvailable = Object.keys(hoursRecord).length > 0;
  const hoursOrder = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const orderedHours = hoursAvailable
    ? hoursOrder
        .map((day) => {
          const matchKey = Object.keys(hoursRecord).find((key) => key.toLowerCase() === day.toLowerCase());
          if (!matchKey) return null;
          return { day, value: hoursRecord[matchKey] };
        })
        .filter((entry): entry is { day: string; value: string } => Boolean(entry))
    : [];
  const currentDayHours = hoursAvailable ? getCurrentDayHours(hoursRecord) : 'Hours not available';
  const priceLevelLabel = formatPriceLevelLabel(restaurant.priceLevel);
  const phoneLink = restaurant.phone ? restaurant.phone.replace(/[^\d+]/g, '') : null;
  let websiteHost: string | null = null;
  if (restaurant.website) {
    try {
      websiteHost = new URL(restaurant.website).hostname.replace(/^www\./, '');
    } catch {
      websiteHost = restaurant.website;
    }
  }
  return <div className="min-h-screen bg-light-gray pb-16">
      <div className="relative h-64 overflow-hidden">
        {/* Hero image carousel with swipe support */}
        {hasHeroImages ? (
          <div
            ref={heroScrollRef}
            className="flex overflow-x-scroll snap-x snap-mandatory no-scrollbar h-full"
            onScroll={handleHeroScroll}
            style={{
              scrollSnapType: 'x mandatory',
              scrollBehavior: 'smooth',
              WebkitOverflowScrolling: 'touch'
            }}
          >
            {displayHeroImages.map((imageUrl, index) => (
              <div
                key={index}
                className="w-full h-full flex-shrink-0 snap-center"
              >
                <img
                  src={imageUrl}
                  alt={`${restaurant?.name ?? 'Restaurant'} - Image ${index + 1}`}
                  className="w-full h-full object-cover"
                  onClick={() => openHeroModal(index)}
                  onError={() => registerFailedHeroImage(imageUrl)}
                />
              </div>
            ))}
          </div>
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-gray-200 to-gray-300" />
        )}

        {/* Gradient overlay on top of image */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-black/80 pointer-events-none" />

        {/* Left arrow control (shown if multiple images) - Smaller size */}
        {hasMultipleImages && (
          <button
            onClick={goPrevImage}
            className="absolute left-2 top-1/2 -translate-y-1/2 z-20 bg-white/60 hover:bg-white/80 rounded-full p-1.5 transition-colors"
            aria-label="Previous image"
          >
            <ChevronLeftIcon size={16} className="text-gray-900" />
          </button>
        )}

        {/* Right arrow control (shown if multiple images) - Smaller size */}
        {hasMultipleImages && (
          <button
            onClick={goNextImage}
            className="absolute right-2 top-1/2 -translate-y-1/2 z-20 bg-white/60 hover:bg-white/80 rounded-full p-1.5 transition-colors"
            aria-label="Next image"
          >
            <ChevronRightIcon size={16} className="text-gray-900" />
          </button>
        )}

        {/* Dot indicators (shown if multiple images) */}
        {hasMultipleImages && (
          <div className="absolute bottom-16 left-1/2 -translate-x-1/2 z-20 flex gap-1.5">
            {displayHeroImages.map((_, idx) => (
              <button
                key={idx}
                onClick={() => handleDotClick(idx)}
                className={`w-2 h-2 rounded-full transition-all ${
                  idx === heroImageIndex ? 'bg-white w-4' : 'bg-white/60 hover:bg-white/80'
                }`}
                aria-label={`Go to image ${idx + 1}`}
              />
            ))}
          </div>
        )}

        {/* Back button */}
        <div className="absolute top-0 left-0 right-0 p-4 z-10">
          <button
            onClick={() => navigate(-1)}
            className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-md"
          >
            <ArrowLeftIcon size={20} />
          </button>
        </div>
      </div>
      {isHeroModalOpen && hasHeroImages && (
        <div
          className="fixed inset-0 z-[80] bg-black/90 flex items-center justify-center"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeHeroModal();
          }}
        >
          <button
            onClick={closeHeroModal}
            className="absolute top-4 right-4 z-[90] bg-white/90 hover:bg-white rounded-full p-2"
            aria-label="Close image viewer"
          >
            <X size={18} className="text-gray-900" />
          </button>
          {hasMultipleImages && (
            <button
              onClick={(e) => { e.stopPropagation(); goPrevImage(); }}
              className="absolute left-3 top-1/2 -translate-y-1/2 z-[90] bg-white/70 hover:bg-white rounded-full p-2"
              aria-label="Previous image"
            >
              <ChevronLeftIcon size={18} className="text-gray-900" />
            </button>
          )}
          {hasMultipleImages && (
            <button
              onClick={(e) => { e.stopPropagation(); goNextImage(); }}
              className="absolute right-3 top-1/2 -translate-y-1/2 z-[90] bg-white/70 hover:bg-white rounded-full p-2"
              aria-label="Next image"
            >
              <ChevronRightIcon size={18} className="text-gray-900" />
            </button>
          )}
          <div
            ref={heroModalScrollRef}
            className="flex overflow-x-scroll snap-x snap-mandatory w-full h-full"
            onScroll={handleHeroModalScroll}
            style={{
              scrollSnapType: 'x mandatory',
              scrollBehavior: 'smooth',
              WebkitOverflowScrolling: 'touch'
            }}
          >
            {displayHeroImages.map((imageUrl, index) => (
              <div key={index} className="w-full h-full flex-shrink-0 snap-center flex items-center justify-center">
                <img
                  src={imageUrl}
                  alt={`${restaurant?.name ?? 'Restaurant'} - Image ${index + 1}`}
                  className="w-full h-full object-contain"
                  onError={() => registerFailedHeroImage(imageUrl)}
                />
              </div>
            ))}
          </div>
          {hasMultipleImages && (
            <div className="absolute bottom-5 left-1/2 -translate-x-1/2 flex space-x-1.5 z-[90]">
              {displayHeroImages.map((_, idx) => (
                <button
                  key={idx}
                  onClick={(e) => { e.stopPropagation(); handleDotClick(idx); }}
                  className={`w-2 h-2 rounded-full transition-all ${idx === heroImageIndex ? 'bg-white w-4' : 'bg-white/50'}`}
                  aria-label={`Go to image ${idx + 1}`}
                />
              ))}
            </div>
          )}
        </div>
      )}
      <div className="bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold leading-snug text-gray-900">
            {restaurant.name}
            {hasReviews && qualityScore !== null && (
              <span
                className="ml-2 inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold text-white align-middle"
                style={{ backgroundColor: getQualityColor(qualityScore) }}
              >
                {qualityScore}%
              </span>
            )}
          </h1>
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-gray-700">Average Dish Rating</span>
            <span className="text-sm font-bold text-primary">
              {avgDishRating !== null ? avgDishRating.toFixed(1) : 'N/A'}
            </span>
          </div>
        </div>
        <div className="flex mt-4 space-x-3">
          <button 
            onClick={() => navigate('/create', { state: { selectedRestaurant: restaurant } })}
            className="flex-1 bg-primary text-white py-2 rounded-full font-medium"
          >
            Write Review
          </button>
          <button onClick={() => setShowSaveModal(true)} className="w-10 h-10 rounded-full border border-medium-gray flex items-center justify-center">
            <BookmarkIcon size={18} className={saved ? 'text-secondary fill-secondary' : ''} />
          </button>
          <button
            onClick={() => {
              const shareData = {
                title: restaurant?.name || 'Restaurant',
                text: restaurant?.name || 'Restaurant',
                url: window.location.href
              };
              if (navigator.share) {
                navigator.share(shareData).catch(() => {/* ignore */});
              } else {
                navigator.clipboard?.writeText(window.location.href);
                alert('Link copied to clipboard');
              }
            }}
            className="w-10 h-10 rounded-full border border-medium-gray flex items-center justify-center"
          >
            <ShareIcon size={18} />
          </button>
        </div>
      </div>
      <div className="bg-white mt-2 p-4 shadow-sm">
        <div className="flex justify-between items-center">
          <h2 className="font-semibold text-lg">Info</h2>
        </div>
        <div className="mt-3 space-y-3">
          <div className="flex items-center">
            <MapPinIcon size={18} className="text-dark-gray mr-3" />
            <div>
              {(() => {
                const c: any = (restaurant as any)?.coordinates || {};
                const lat = typeof c.lat === 'number' ? c.lat : (typeof c.latitude === 'number' ? c.latitude : undefined);
                const lng = typeof c.lng === 'number' ? c.lng : (typeof c.longitude === 'number' ? c.longitude : undefined);
                const label = (lat != null && lng != null) ? `${lat.toFixed(5)}, ${lng.toFixed(5)}` : (restaurant.address || 'Location not available');
                const href = lat != null && lng != null
                  ? `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`
                  : (restaurant.address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(restaurant.address)}` : undefined);
                return (
                  <>
                    <p>
                      {lat != null && lng != null ? (
                        <span 
                          className="cursor-pointer hover:text-primary"
                          onClick={() => navigate(`/discover?focusRestaurantId=${restaurant.id}`)}
                        >
                          {label}
                        </span>
                      ) : (
                        label
                      )}
                    </p>
                    {href ? (
                      <a className="text-sm text-secondary hover:underline" href={href} target="_blank" rel="noreferrer">Get Directions</a>
                    ) : null}
                  </>
                );
              })()}
            </div>
          </div>
          <div className="flex items-center">
            <PhoneIcon size={18} className="text-dark-gray mr-3" />
            {restaurant.phone ? (
              <a href={`tel:${phoneLink || restaurant.phone}`} className="text-primary hover:underline">
                {restaurant.phone}
              </a>
            ) : (
              <p className="text-gray-600">Phone not available</p>
            )}
          </div>
          {restaurant.website ? (
            <div className="flex items-center">
              <Globe size={18} className="text-dark-gray mr-3" />
              <a href={restaurant.website} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                {websiteHost || 'Visit website'}
              </a>
            </div>
          ) : null}
          {priceLevelLabel ? (
            <div className="flex items-center">
              <DollarSign size={18} className="text-dark-gray mr-3" />
              <p className="text-gray-700">{priceLevelLabel}</p>
            </div>
          ) : null}
          {restaurant.avgServiceSpeed && (
            <div className="flex items-center">
              <ClockIcon size={18} className="text-dark-gray mr-3" />
              <div className="flex items-center gap-2">
                <p className="text-gray-700">
                  {restaurant.avgServiceSpeed >= 2.5 ? '⚡ Fast Service' :
                   restaurant.avgServiceSpeed >= 1.5 ? '⏱️ Average Service' :
                   '🐌 Slow Service'}
                </p>
                <span className="text-xs text-gray-500">
                  ({restaurant.avgServiceSpeed.toFixed(1)}/3)
                </span>
              </div>
            </div>
          )}
          <div className="flex items-start">
            <ClockIcon size={18} className="text-dark-gray mr-3 mt-1" />
            <div>
              <p>{currentDayHours}</p>
              {hoursAvailable ? (
                <>
                  <button
                    onClick={() => setShowAllHours((prev) => !prev)}
                    className="mt-1 text-sm text-secondary hover:underline"
                  >
                    {showAllHours ? 'Hide hours' : 'See all hours'}
                  </button>
                  {showAllHours && orderedHours.length > 0 && (
                    <div className="mt-2 space-y-1 text-sm text-gray-700">
                      {orderedHours.map(({ day, value }) => (
                        <div key={day} className="flex justify-between gap-6">
                          <span className="font-medium">{day}</span>
                          <span>{value}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <p className="text-sm text-dark-gray">Contact restaurant for hours</p>
              )}
            </div>
          </div>
        </div>
      </div>
      <div className="mt-6 px-4">
        <h2 className="font-semibold text-2xl mb-4 text-gray-900">Menu</h2>
        <div className="mb-4 rounded-3xl bg-white/92 backdrop-blur-xl shadow-[0_20px_40px_rgba(15,23,42,0.12)] border border-white/70 p-5">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <span className="w-5 flex items-center justify-center text-primary" aria-hidden="true">
                <Trophy size={16} />
              </span>
              <h3 className="text-sm font-semibold text-gray-800">Top Dishes</h3>
            </div>
            {topDishesAll.length > 3 && (
              <button
                type="button"
                onClick={() => setShowAllTopDishes((prev) => !prev)}
                className="text-xs font-medium text-secondary hover:underline"
              >
                {showAllTopDishes ? 'Show top 3' : 'See all items'}
              </button>
            )}
          </div>
          {topDishesAll.length === 0 ? (
            <div className="mt-3 rounded-2xl bg-white/80 border border-white/70 px-4 py-2.5 text-sm text-gray-600">
              Rate a dish to see the Top 3.
            </div>
          ) : (
            <div className="mt-3 space-y-2">
              {topDishesVisible.map((dish, index) => (
                <button
                  key={`${dish.dishId || dish.representativeReviewId}-${index}`}
                  type="button"
                  onClick={() => {
                    if (dish.dishId) {
                      navigate(`/dish/${dish.dishId}`, { state: { originReviewId: dish.representativeReviewId } });
                      return;
                    }
                    navigate(`/post/${dish.representativeReviewId}`);
                  }}
                  className="w-full flex items-center gap-3 rounded-2xl px-1 py-1.5 hover:bg-white/80 transition-colors text-left"
                >
                  <span className="w-5 text-center text-sm font-semibold text-primary">{index + 1}</span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-gray-900 leading-tight">
                      {dish.dishName}
                    </div>
                  </div>
                  <span className="rounded-full bg-accent text-white px-2 py-0.5 text-xs font-semibold">
                    {dish.averageRating.toFixed(1)}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
        {menuItems.length > 0 ? (
          <div className="space-y-3">
            {Object.entries(groupedMenu).map(([category, items]) => {
              const isOpen = openSections.has(category);
              const IconComponent = getCategoryIcon(category);
              return (
                <div key={category} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                  <button
                    onClick={() => toggleSection(category)}
                    className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center">
                      <div className="w-9 h-9 bg-gray-50 rounded-full flex items-center justify-center mr-3">
                        <IconComponent size={18} className="text-red-500" style={{ color: '#ff3131' }} />
                      </div>
                      <h3 className="font-semibold text-base text-gray-900">{category || 'Custom'}</h3>
                    </div>
                    <ChevronDown 
                      size={20} 
                      className={`text-gray-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : 'rotate-0'}`}
                    />
                  </button>
                  {isOpen && (
                    <div className="px-5 pb-4 space-y-2">
                      {items.map(item => {
                        const ItemIcon = getCategoryIcon(item.category || category);
                        return (
                        <div
                          key={item.id}
                          className="flex cursor-pointer hover:bg-gray-50 px-3 py-2 rounded-xl transition-colors group"
                          onClick={() => navigate(`/dish/${item.id}`)}
                        >
                          {item.coverImage ? (
                            <img
                              src={item.coverImage}
                              alt={item.name}
                              className="w-14 h-14 rounded-xl object-cover flex-shrink-0"
                            />
                          ) : (
                            <div className="w-14 h-14 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0">
                              <ItemIcon size={20} className="text-gray-400" />
                            </div>
                          )}
                          <div className="ml-3 flex-1 min-w-0">
                            <div className="flex justify-between items-start">
                              <h4 className="font-semibold text-gray-900 flex-1 mr-2 group-hover:text-red-500 transition-colors" style={{ color: isOpen ? undefined : '#ff3131' }}>{item.name}</h4>
                              <div className="text-right">
                                <div className="text-sm text-gray-500 mb-1">
                                  {menuItemRatings[item.id] ? `${menuItemRatings[item.id].rating.toFixed(1)}/10` : 'No reviews yet'}
                                </div>
                                {item.price && (
                                  <span className="font-semibold text-gray-900">${item.price}</span>
                                )}
                              </div>
                            </div>
                            <p className="text-gray-600 text-sm line-clamp-2 mt-0.5">
                              {item.description || 'Delicious dish'}
                            </p>
                            {/* Users often say chips (aggregated top tags) */}
                            {(() => {
                              const related = reviews.filter((r) => (r as any).menuItemId === item.id || (r as any).dishId === item.id);
                              if (related.length === 0) return null;
                              const counts: Record<string, number> = {};
                              related.forEach((r) => {
                                const { tasteChips, audienceTags } = extractReviewTags(r as any);
                                [...tasteChips, ...audienceTags].forEach((chip) => {
                                  counts[chip] = (counts[chip] || 0) + 1;
                                });
                              });
                              const top = Object.entries(counts).sort((a,b)=>b[1]-a[1]).slice(0,3).map(([k])=>k);
                              if (top.length === 0) return null;
                              return (
                                <div className="mt-2">
                                  <span className="text-xs text-gray-500 mr-2">Users often say:</span>
                                  <span className="inline-flex flex-wrap gap-1 align-middle">
                                    {top.map((chip, i) => (
                                      <span key={i} className="inline-flex items-center rounded-full border px-2 py-1 text-[11px] font-medium bg-gray-50 text-gray-700 border-gray-200">
                                        {chip}
                                      </span>
                                    ))}
                                  </span>
                                </div>
                              );
                            })()}
                          </div>
                        </div>
                      );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 text-center py-12">
            <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <Utensils size={24} className="text-gray-400" />
            </div>
            <p className="text-gray-600 mb-6">No menu items yet. Be the first to review a dish from this restaurant!</p>
            <button 
              onClick={() => navigate('/create', { state: { selectedRestaurant: restaurant } })}
              className="bg-red-500 text-white px-8 py-3 rounded-full font-medium hover:bg-red-600 transition-colors"
              style={{ backgroundColor: '#ff3131' }}
            >
              Add New Dish
            </button>
          </div>
        )}
      </div>
      <div className="bg-white mt-2 p-4 shadow-sm">
        <h2 className="font-semibold text-lg mb-4">Popular Photos</h2>
        {reviewImages.length > 0 ? (
          <div className="grid grid-cols-3 gap-1">
            {reviewImages.slice(0, 6).map((image, index) => (
              <div key={index} className="aspect-square bg-medium-gray rounded-md overflow-hidden">
                <img
                  src={image}
                  alt="Food"
                  className="w-full h-full object-cover"
                />
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <p className="text-dark-gray">No photos yet. Add photos now to see them here!</p>
          </div>
        )}
        {reviewImages.length > 0 && (
          <button className="w-full mt-3 py-2 border border-medium-gray rounded-full text-center font-medium">
            View All Photos ({reviewImages.length})
          </button>
        )}
      </div>
      <div className="bg-white mt-2 p-4 shadow-sm mb-8">
        <h2 className="font-semibold text-lg mb-4">Reviews</h2>
        <div className="space-y-4">
          {reviews.length > 0 ? reviews.slice(0, 5).map((review) => {
            const author = authors[review.userId];
            const { tasteChips, audienceTags } = extractReviewTags(review as any);
            const createdAtText = (() => {
              const v: any = (review as any).createdAt;
              const ms = v && typeof v.seconds === 'number' && typeof v.nanoseconds === 'number'
                ? v.seconds * 1000 + Math.floor(v.nanoseconds / 1e6)
                : typeof v === 'string' ? Date.parse(v) : typeof v === 'number' ? v : Date.now();
              return new Date(ms).toLocaleDateString();
            })();
            const images = Array.isArray((review as any)?.media?.photos) ? (review as any).media.photos : (review.images || []);
            const primaryImage = images && images.length > 0 ? images[0] : null;
            const extraImages = primaryImage ? images.slice(1, 4) : images.slice(0, 3);
            const authorLabel = author?.username || author?.name || 'Anonymous';
            return (
              <div key={review.id} className="border-b border-light-gray pb-4 last:border-0">
                <div className="flex items-start gap-3">
                  <div className="w-14 h-14 rounded-xl bg-gray-100 overflow-hidden flex-shrink-0">
                    {primaryImage ? (
                      <img
                        src={primaryImage}
                        alt={review.dish || 'Dish'}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Utensils size={18} className="text-gray-400" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start mb-1">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold uppercase tracking-wide text-red-500 truncate">
                          {review.dish || 'Dish'}{' '}
                          <span className="text-red-500">RATED BY</span>{' '}
                          <span
                            className="text-red-500 hover:underline cursor-pointer"
                            onClick={() => author?.username && navigate('/user/' + author.username)}
                          >
                            {authorLabel}
                          </span>
                        </p>
                        <p className="text-xs text-gray-500">{createdAtText}</p>
                      </div>
                      <RatingBadge rating={review.rating} size="md" />
                    </div>
                    {(review as any).caption && (
                      <p className="text-sm text-gray-700 mt-2">{(review as any).caption}</p>
                    )}
                    {(tasteChips.length > 0 || audienceTags.length > 0) && (
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        {tasteChips.map((chip, i) => {
                          let cls = 'inline-flex items-center rounded-full border px-3 py-1.5 text-xs font-medium shadow-sm';
                          if (chip.includes('Bargain') || chip.includes('Fair') || chip.includes('Overpriced')) {
                            cls += chip.includes('Bargain') ? ' bg-blue-50 text-blue-700 border-blue-200'
                              : chip.includes('Fair') ? ' bg-sky-50 text-sky-700 border-sky-200'
                              : ' bg-slate-100 text-slate-700 border-slate-300';
                          } else if (chip.includes('fresh') || chip.includes('Fresh')) {
                            cls += chip.includes('Very') ? ' bg-gradient-to-r from-green-50 to-emerald-50 text-green-700 border-green-200'
                              : chip === 'Fresh' ? ' bg-green-50 text-green-700 border-green-200'
                              : ' bg-orange-50 text-orange-700 border-orange-200';
                          } else if (chip.includes('salt') || chip.includes('Balanced')) {
                            cls += chip.includes('Balanced') ? ' bg-amber-50 text-amber-700 border-amber-200'
                              : chip.includes('Too') ? ' bg-orange-100 text-orange-700 border-orange-300'
                              : ' bg-yellow-50 text-yellow-700 border-yellow-200';
                          } else {
                            cls += ' bg-gray-50 text-gray-700 border-gray-200';
                          }
                          return <span key={'taste-' + i} className={cls}>{chip}</span>;
                        })}
                        {audienceTags.map((tag, i) => (
                          <span key={'audience-' + i} className="inline-flex items-center rounded-full border px-3 py-1.5 text-xs font-semibold bg-gradient-to-r from-emerald-50 to-green-50 text-emerald-700 border-emerald-300 shadow-sm">{tag}</span>
                        ))}
                      </div>
                    )}
                    {extraImages && extraImages.length > 0 && (
                      <div className="flex mt-3 space-x-2">
                        {extraImages.map((src, i) => (
                          <img key={i} src={src} alt="Review" className="w-16 h-16 rounded-md object-cover" />
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          }) : (
            <div className="text-center py-8">
              <p className="text-dark-gray mb-4">No reviews yet. Be the first to share your experience!</p>
              <button 
                onClick={() => navigate('/create', { state: { selectedRestaurant: restaurant } })}
                className="bg-primary text-white px-6 py-2 rounded-full font-medium hover:bg-primary/90 transition-colors"
              >
                Write First Review
              </button>
            </div>
          )}
        </div>
        {reviews.length > 5 && (
          <button className="w-full mt-3 py-2 border border-medium-gray rounded-full text-center font-medium">
            View All Reviews ({reviews.length})
          </button>
        )}
      </div>
      <BottomNavigation />

      {/* Save Modal */}
      {showSaveModal && restaurant && (
        <SaveToListModal
          isOpen={showSaveModal}
          onClose={() => setShowSaveModal(false)}
          restaurantId={restaurant.id}
          restaurantName={restaurant.name}
          onSaved={({ listName }) => {
            setSaved(true);
            const msg = listName ? `Saved to list ✅ — “${listName}”` : 'Saved to list ✅';
            setToastMsg(msg);
            setTimeout(() => setToastMsg(null), 1800);
          }}
        />
      )}

      {/* Toast */}
      {toastMsg && (
        <div className="fixed bottom-20 inset-x-0 flex justify-center z-[60]">
          <div className="px-4 py-2 bg-black text-white text-sm rounded-full shadow-lg">
            {toastMsg}
          </div>
        </div>
      )}
    </div>;
};
export default RestaurantDetail;
