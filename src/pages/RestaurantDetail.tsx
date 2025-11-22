import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db, getUserProfile } from '../lib/firebase';
import { useNavigate } from 'react-router-dom';
import { ArrowLeftIcon, StarIcon, MapPinIcon, PhoneIcon, ClockIcon, BookmarkIcon, ShareIcon, ChevronRightIcon, Utensils, Soup, Salad, Coffee, Cake, Fish, Pizza, Sandwich, ChefHat, ChevronDown, Globe, DollarSign } from 'lucide-react';
import BottomNavigation from '../components/BottomNavigation';
import SaveToListModal from '../components/SaveToListModal';
import { calculateRestaurantQualityScore } from '../services/reviewService';
import RatingBadge from '../components/RatingBadge';
import { getAvatarUrl } from '../utils/avatarUtils';

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
    if (categoryLower.includes('dessert') || categoryLower.includes('cake') || categoryLower.includes('sweet')) return Cake;
    if (categoryLower.includes('fish') || categoryLower.includes('seafood')) return Fish;
    if (categoryLower.includes('pizza')) return Pizza;
    if (categoryLower.includes('sandwich') || categoryLower.includes('burger')) return Sandwich;
    if (categoryLower.includes('chef') || categoryLower.includes('special')) return ChefHat;
    return Utensils; // Default icon
  };

  const formatPriceLevelLabel = (level?: number | null) => {
    if (level === null || level === undefined) return null;
    const clamped = Math.min(Math.max(Math.round(level), 1), 4);
    return '$'.repeat(clamped);
  };

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
      await Promise.all(ids.map(async (uid) => {
        try {
          const res = await getUserProfile(uid);
          if (res.success && res.profile) {
            up[uid] = { id: uid, name: res.profile.displayName || res.profile.username, username: res.profile.username, image: getAvatarUrl(res.profile) };
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

  const headerPhoto = restaurant.googlePhotos?.[0];
  const hasReviews = reviews.length > 0;
  const isGoogleOnlyListing = !hasReviews && restaurant.source === 'google_places';
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
        {headerPhoto ? (
          <img src={headerPhoto} alt={restaurant.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-gray-200 to-gray-300" />
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-black/80" />
        <div className="absolute top-0 left-0 right-0 p-4 z-10">
          <Link to="/" className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-md">
            <ArrowLeftIcon size={20} />
          </Link>
        </div>
        <div className="absolute bottom-0 left-0 right-0 p-4 z-10">
          <div className="bg-white/95 px-3 py-1 rounded-full inline-flex items-center gap-2">
            {hasReviews ? (
              <>
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: qualityScore ? getQualityColor(qualityScore) : '#6b7280' }}></div>
                <span className="font-medium text-sm">
                  {qualityScore}% Quality
                </span>
              </>
            ) : isGoogleOnlyListing ? (
              <span className="text-sm font-semibold text-gray-800">New</span>
            ) : (
              <span className="text-sm text-gray-600">No reviews yet</span>
            )}
          </div>
        </div>
      </div>
      <div className="bg-white p-4 shadow-sm">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-semibold">{restaurant.name}</h1>
            <div className="flex items-center text-dark-gray mt-1">
              <span>{restaurant.cuisine}</span>
            </div>
          </div>
          <div className="flex items-center">
            <div className="mr-2 inline-flex items-center gap-2 bg-light-gray px-3 py-1.5 rounded-full">
              <span className="text-sm text-dark-gray">Average Dish</span>
              <span className="inline-flex items-center gap-1">
                <StarIcon size={16} className="text-accent fill-accent" />
                <span className="font-semibold">{avgDishRating !== null ? avgDishRating.toFixed(1) : 'N/A'}</span>
              </span>
            </div>
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
        <h2 className="font-semibold text-2xl mb-6 text-gray-900">Menu</h2>
        {menuItems.length > 0 ? (
          <div className="space-y-4">
            {Object.entries(groupedMenu).map(([category, items]) => {
              const isOpen = openSections.has(category);
              const IconComponent = getCategoryIcon(category);
              return (
                <div key={category} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                  <button
                    onClick={() => toggleSection(category)}
                    className="w-full flex items-center justify-between p-6 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center">
                      <div className="w-10 h-10 bg-gray-50 rounded-full flex items-center justify-center mr-4">
                        <IconComponent size={20} className="text-red-500" style={{ color: '#ff3131' }} />
                      </div>
                      <h3 className="font-semibold text-lg text-gray-900">{category || 'Custom'}</h3>
                    </div>
                    <ChevronDown 
                      size={20} 
                      className={`text-gray-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : 'rotate-0'}`}
                    />
                  </button>
                  {isOpen && (
                    <div className="px-6 pb-6 space-y-4">
                      {items.map(item => (
                        <div 
                          key={item.id} 
                          className="flex cursor-pointer hover:bg-gray-50 p-4 rounded-xl transition-colors group"
                          onClick={() => navigate(`/dish/${item.id}`)}
                        >
                          <img 
                            src={item.coverImage || "https://source.unsplash.com/100x100/food"} 
                            alt={item.name} 
                            className="w-20 h-20 rounded-xl object-cover" 
                          />
                          <div className="ml-4 flex-1">
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
                            <p className="text-gray-600 text-sm line-clamp-2 mt-1">
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
                      ))}
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
        ) : reviews.length > 0 ? (
          <div className="grid grid-cols-3 gap-1">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="aspect-square bg-medium-gray rounded-md overflow-hidden">
                <img 
                  src={`https://source.unsplash.com/collection/1353633/300x300?sig=${index}`} 
                  alt="Food" 
                  className="w-full h-full object-cover" 
                />
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <p className="text-dark-gray">No photos yet. Share the first photo of this restaurant!</p>
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
            return (
              <div key={review.id} className="border-b border-light-gray pb-4 last:border-0">
                <div className="flex items-start">
                  <img
                    src={author?.image || getAvatarUrl({ username: review.userId })}
                    alt={author?.name || 'User'}
                    className="w-10 h-10 rounded-full object-cover cursor-pointer"
                    onClick={() => author?.username && navigate('/user/' + author.username)}
                  />
                  <div className="ml-3 flex-1">
                    <div className="flex justify-between items-start mb-1">
                      <div className="min-w-0">
                        <p
                          className="text-sm font-medium text-gray-900 truncate cursor-pointer hover:text-primary"
                          onClick={() => author?.username && navigate('/user/' + author.username)}
                        >
                          {author?.name || 'Anonymous'}
                        </p>
                        <span className="text-xs text-gray-500">{createdAtText}</span>
                      </div>
                      <RatingBadge rating={review.rating} size="md" />
                    </div>
                    {(review as any).caption && (
                      <p className="text-sm text-gray-700 mb-2">{(review as any).caption}</p>
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
                    {images && images.length > 0 && (
                      <div className="flex mt-3 space-x-2">
                        {images.slice(0, 3).map((src, i) => (
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
