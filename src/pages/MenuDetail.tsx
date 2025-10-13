import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db, getUserProfile } from '../lib/firebase';
import { ArrowLeftIcon, MapPinIcon, BookmarkIcon, ShareIcon, ChefHatIcon } from 'lucide-react';
import BottomNavigation from '../components/BottomNavigation';
import SaveToListModal from '../components/SaveToListModal';
import RatingBadge from '../components/RatingBadge';
import { getAvatarUrl } from '../utils/avatarUtils';

interface MenuItem {
  id: string;
  name: string;
  category: string;
  price?: number;
  description?: string;
  restaurantId: string;
  coverImage?: string | null;
}

interface Restaurant {
  id: string;
  name: string;
  address: string;
  cuisine: string;
  phone: string;
  coordinates: { latitude: number; longitude: number };
}

interface Review {
  id: string;
  userId: string;
  restaurantId: string;
  menuItemId: string;
  dish: string;
  rating: number;
  personalNote: string;
  negativeNote: string;
  images: string[];
  createdAt: any;
  location: string;
}

interface ReviewAuthor {
  id: string;
  name: string;
  username: string;
  image: string;
}

const MenuDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [menuItem, setMenuItem] = useState<MenuItem | null>(null);
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [otherDishes, setOtherDishes] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [authors, setAuthors] = useState<Record<string, ReviewAuthor>>({});

  // Calculate average rating from reviews
  const calculateAverageRating = (reviewsArray: Review[]) => {
    if (reviewsArray.length === 0) return 0;
    const sum = reviewsArray.reduce((acc, review) => acc + review.rating, 0);
    return sum / reviewsArray.length;
  };

  // Get all images from reviews (supports media.photos and legacy images[])
  const getAllReviewImages = (reviewsArray: Review[]) => {
    const all: string[] = [];
    for (const r of reviewsArray) {
      const mediaPhotos = Array.isArray((r as any)?.media?.photos) ? (r as any).media.photos : [];
      const legacyImages = Array.isArray((r as any)?.images) ? (r as any).images : [];
      if (mediaPhotos.length) all.push(...mediaPhotos);
      else if (legacyImages.length) all.push(...legacyImages);
    }
    return all;
  };

  const averageRating = calculateAverageRating(reviews);
  const reviewImages = getAllReviewImages(reviews);

  // Extract taste chips and audience tags
  const extractReviewTags = (review: any): { tasteChips: string[]; audienceTags: string[] } => {
    const tasteChips: string[] = [];
    const audienceTags: string[] = [];

    if (review.taste) {
      if (review.taste.value?.level) {
        const valueMap: Record<string, string> = {
          overpriced: 'Overpriced',
          fair: 'Fair value',
          bargain: 'Bargain',
        };
        const label = valueMap[review.taste.value.level];
        if (label) tasteChips.push(label);
      }
      if (review.taste.freshness?.level) {
        const freshnessMap: Record<string, string> = {
          not_fresh: 'Not fresh',
          just_right: 'Fresh',
          very_fresh: 'Very fresh',
        };
        const label = freshnessMap[review.taste.freshness.level];
        if (label) tasteChips.push(label);
      }
      if (review.taste.saltiness?.level) {
        const saltinessMap: Record<string, string> = {
          needs_more_salt: 'Needs more salt',
          balanced: 'Balanced',
          too_salty: 'Too salty',
        };
        const label = saltinessMap[review.taste.saltiness.level];
        if (label) tasteChips.push(label);
      }
    }

    if (review.outcome?.audience && Array.isArray(review.outcome.audience)) {
      const audienceMap: Record<string, string> = {
        spicy_lovers: 'Spicy lovers',
        date_night: 'Date night',
        family: 'Family meal',
        quick_bite: 'Quick bite',
        solo: 'Solo treat',
        group: 'Group hang',
      };
      review.outcome.audience.forEach((tag: string) => {
        const label = audienceMap[tag];
        if (label) audienceTags.push(label);
      });
    }

    return { tasteChips, audienceTags };
  };

  useEffect(() => {
    const fetchDishData = async () => {
      if (!id) return;

      try {
        setLoading(true);

        // Fetch menu item
        const menuItemDoc = await getDoc(doc(db, 'menuItems', id));
        if (menuItemDoc.exists()) {
          const menuData = { id: menuItemDoc.id, ...menuItemDoc.data() } as MenuItem;
          setMenuItem(menuData);

          // Fetch restaurant data
          if (menuData.restaurantId) {
            const restaurantDoc = await getDoc(doc(db, 'restaurants', menuData.restaurantId));
            if (restaurantDoc.exists()) {
              setRestaurant({ id: restaurantDoc.id, ...(restaurantDoc.data() as any) } as Restaurant);
            }

            // Fetch other dishes from the same restaurant
            const otherDishesQuery = query(
              collection(db, 'menuItems'),
              where('restaurantId', '==', menuData.restaurantId)
            );
            const otherDishesSnapshot = await getDocs(otherDishesQuery);
            const otherDishesData = otherDishesSnapshot.docs
              .map(doc => ({ id: doc.id, ...doc.data() } as MenuItem))
              .filter(item => item.id !== id)
              .slice(0, 6);
            setOtherDishes(otherDishesData);
          }
        }

        // Fetch reviews for this specific dish
        // Support both new field (menuItemId) and legacy field (dishId)
        const reviewsRef = collection(db, 'reviews');
        const [byMenuItemSnap, byDishSnap] = await Promise.all([
          getDocs(query(reviewsRef, where('menuItemId', '==', id))),
          getDocs(query(reviewsRef, where('dishId', '==', id))),
        ]);

        const rows = [...byMenuItemSnap.docs, ...byDishSnap.docs];
        const map = new Map<string, any>();
        for (const d of rows) {
          if ((d.data() as any)?.isDeleted === true) continue;
          map.set(d.id, { id: d.id, ...(d.data() as any) });
        }

        // Sort newest first; handle Timestamp, ms, or ISO
        const toMs = (v: any) =>
          v && typeof v.seconds === 'number' && typeof v.nanoseconds === 'number'
            ? v.seconds * 1000 + Math.floor(v.nanoseconds / 1e6)
            : typeof v === 'number'
            ? v
            : typeof v === 'string'
            ? Date.parse(v)
            : (v as Date)?.getTime?.() ?? 0;

        const merged = Array.from(map.values()).sort(
          (a, b) => toMs(b.createdAt) - toMs(a.createdAt)
        ) as Review[];

        setReviews(merged);
      } catch (error) {
        console.error('Error fetching dish data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchDishData();
  }, [id]);

  // Fetch author profiles for reviews (avatar + name)
  useEffect(() => {
    const loadAuthors = async () => {
      const uniqueIds = Array.from(
        new Set(reviews.map((r) => r.userId).filter((x): x is string => typeof x === 'string' && x))
      );
      if (uniqueIds.length === 0) return;

      const updates: Record<string, ReviewAuthor> = {};
      await Promise.all(
        uniqueIds.map(async (uid) => {
          try {
            const res = await getUserProfile(uid);
            if (res.success && res.profile) {
              updates[uid] = {
                id: uid,
                name: res.profile.displayName || res.profile.username,
                username: res.profile.username,
                image: getAvatarUrl(res.profile),
              };
            } else {
              updates[uid] = {
                id: uid,
                name: 'Anonymous',
                username: 'anonymous',
                image: getAvatarUrl({ username: uid }),
              } as any;
            }
          } catch {
            updates[uid] = {
              id: uid,
              name: 'Anonymous',
              username: 'anonymous',
              image: getAvatarUrl({ username: uid }),
            } as any;
          }
        })
      );
      setAuthors((prev) => ({ ...prev, ...updates }));
    };
    loadAuthors();
  }, [reviews]);

  if (loading) {
    return (
      <div className="min-h-screen bg-light-gray flex items-center justify-center pb-16">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-dark-gray">Loading dish details...</p>
        </div>
        <BottomNavigation />
      </div>
    );
  }

  if (!menuItem) {
    return (
      <div className="min-h-screen bg-light-gray flex items-center justify-center pb-16">
        <div className="text-center">
          <p className="text-lg font-medium text-dark-gray mb-4">Dish not found</p>
          <Link to="/discover" className="text-primary hover:underline">Back to Discover</Link>
        </div>
        <BottomNavigation />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-light-gray pb-16">
      {/* Header */}
      <header className="bg-white sticky top-0 z-10 shadow-sm p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <button onClick={() => navigate(-1)} className="mr-3">
              <ArrowLeftIcon size={24} />
            </button>
            <div>
              <h1 className="text-xl font-semibold">{menuItem.name}</h1>
            </div>
          </div>
          {/* Right side icons removed for cleaner header */}
        </div>
      </header>

      {/* Dish Hero Section */}
      <div className="bg-white shadow-sm">
        <div className="relative h-64">
          <img
            src={menuItem.coverImage || (reviewImages.length > 0 ? reviewImages[0] : ('https://source.unsplash.com/800x400/?' + encodeURIComponent(menuItem.name) + ',food'))}
            alt={menuItem.name}
            className="w-full h-full object-cover"
          />
          {reviewImages.length > 1 && (
            <div className="absolute bottom-4 right-4 bg-black bg-opacity-50 text-white px-3 py-1 rounded-full text-sm">
              +{reviewImages.length - 1} more photos
            </div>
          )}
        </div>

        <div className="p-4">
          <div className="flex justify-between items-start mb-3">
            <div>
              <h2 className="text-2xl font-semibold">{menuItem.name}</h2>
              {restaurant && (
                <div className="flex items-center mt-1 text-dark-gray">
                  <MapPinIcon size={16} className="text-primary mr-1" />
                  <Link to={'/restaurant/' + restaurant.id} className="hover:underline">
                    {restaurant.name}
                  </Link>
                </div>
              )}
              <p className="text-dark-gray mt-1">{menuItem.category}</p>
              {menuItem.description && (
                <p className="text-dark-gray text-sm mt-2">{menuItem.description}</p>
              )}
            </div>
            <div className="text-right">
              {menuItem.price && (
                <p className="text-2xl font-bold text-primary">$ {menuItem.price}</p>
              )}
              {averageRating > 0 && (
                <div className="flex items-center mt-1">
                  <span className="font-medium">{averageRating.toFixed(1)}</span>
                  <span className="text-sm text-dark-gray ml-1">({reviews.length})</span>
                </div>
              )}
            </div>
          </div>

          {/* Action Row: Write Review + Bookmark + Share */}
          <div className="flex mt-4 space-x-3">
            <button
              onClick={() => navigate('/create', {
                state: {
                  selectedRestaurant: restaurant,
                  selectedDish: menuItem.name
                }
              })}
              className="flex-1 bg-primary text-white py-3 rounded-full font-medium"
            >
              Write Review
            </button>
            <button
              onClick={() => setShowSaveModal(true)}
              className="w-10 h-10 rounded-full border border-medium-gray flex items-center justify-center"
              aria-label="Save"
            >
              <BookmarkIcon size={18} className={saved ? 'text-secondary fill-secondary' : ''} />
            </button>
            <button
              onClick={() => {
                const title = menuItem.name + (restaurant ? ' at ' + restaurant.name : '');
                const shareData = {
                  title,
                  text: title,
                  url: window.location.href
                } as any;
                if (navigator.share) {
                  (navigator as any).share(shareData).catch(() => {/* ignore */});
                } else {
                  (navigator.clipboard as any)?.writeText(window.location.href);
                  alert('Link copied to clipboard');
                }
              }}
              className="w-10 h-10 rounded-full border border-medium-gray flex items-center justify-center"
              aria-label="Share"
            >
              <ShareIcon size={18} />
            </button>
          </div>
        </div>
      </div>

      {/* Photos Section */}
      {reviewImages.length > 0 && (
        <div className="bg-white mt-2 p-4 shadow-sm">
          <h3 className="font-semibold text-lg mb-3">Photos ({reviewImages.length})</h3>
          <div className="grid grid-cols-3 gap-1">
            {reviewImages.slice(0, 6).map((image, index) => (
              <div key={index} className="aspect-square bg-medium-gray rounded-md overflow-hidden">
                <img
                  src={image}
                  alt="Dish photo"
                  className="w-full h-full object-cover"
                />
              </div>
            ))}
          </div>
          {reviewImages.length > 6 && (
            <button className="w-full mt-3 py-2 border border-medium-gray rounded-full text-center font-medium">
              View All Photos ({reviewImages.length})
            </button>
          )}
        </div>
      )}

      {/* Reviews Section */}
      <div className="bg-white mt-2 p-4 shadow-sm">
        <h3 className="font-semibold text-lg mb-4">Reviews ({reviews.length})</h3>
        <div className="space-y-4">
          {reviews.length > 0 ? reviews.slice(0, 5).map((review) => {
            const author = authors[review.userId];
            const { tasteChips, audienceTags } = extractReviewTags(review as any);
            const createdAtText = (() => {
              const v: any = (review as any).createdAt;
              const ms = v && typeof v.seconds === 'number' && typeof v.nanoseconds === 'number'
                ? v.seconds * 1000 + Math.floor(v.nanoseconds / 1e6)
                : typeof v === 'number'
                ? v
                : typeof v === 'string'
                ? Date.parse(v)
                : (v as Date)?.getTime?.() ?? Date.now();
              return new Date(ms).toLocaleDateString();
            })();
            return (
              <div
                key={review.id}
                className="border-b border-light-gray pb-4 last:border-0"
              >
                <div className="flex items-start">
                  <img
                    src={author?.image || getAvatarUrl({ username: review.userId })}
                    alt={author?.name || 'User'}
                    className="w-10 h-10 rounded-full object-cover cursor-pointer"
                    onClick={() => author?.username && navigate('/user/' + author.username)}
                    role="button"
                  />
                  <div className="ml-3 flex-1">
                    <div className="flex justify-between items-start mb-1">
                      <div className="min-w-0">
                        <p
                          className="text-sm font-medium text-gray-900 truncate cursor-pointer hover:text-primary"
                          onClick={() => author?.username && navigate('/user/' + author.username)}
                          role="button"
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
                          let chipClass = 'inline-flex items-center rounded-full border px-3 py-1.5 text-xs font-medium shadow-sm';
                          if (chip.includes('Bargain') || chip.includes('Fair') || chip.includes('Overpriced')) {
                            chipClass += chip.includes('Bargain')
                              ? ' bg-blue-50 text-blue-700 border-blue-200'
                              : chip.includes('Fair')
                              ? ' bg-sky-50 text-sky-700 border-sky-200'
                              : ' bg-slate-100 text-slate-700 border-slate-300';
                          } else if (chip.includes('fresh') || chip.includes('Fresh')) {
                            chipClass += chip.includes('Very')
                              ? ' bg-gradient-to-r from-green-50 to-emerald-50 text-green-700 border-green-200'
                              : chip == 'Fresh'
                              ? ' bg-green-50 text-green-700 border-green-200'
                              : ' bg-orange-50 text-orange-700 border-orange-200';
                          } else if (chip.includes('salt') || chip.includes('Balanced')) {
                            chipClass += chip.includes('Balanced')
                              ? ' bg-amber-50 text-amber-700 border-amber-200'
                              : chip.includes('Too')
                              ? ' bg-orange-100 text-orange-700 border-orange-300'
                              : ' bg-yellow-50 text-yellow-700 border-yellow-200';
                          } else {
                            chipClass += ' bg-gray-50 text-gray-700 border-gray-200';
                          }
                          return (
                            <span key={'taste-' + i} className={chipClass}>
                              {chip}
                            </span>
                          );
                        })}

                        {audienceTags.map((tag, i) => (
                          <span
                            key={'audience-' + i}
                            className="inline-flex items-center rounded-full border px-3 py-1.5 text-xs font-semibold bg-gradient-to-r from-emerald-50 to-green-50 text-emerald-700 border-emerald-300 shadow-sm"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}

                    {review.personalNote && (
                      <div className="mt-2 p-3 bg-green-50 border-l-4 border-green-400 rounded">
                        <p className="text-sm text-green-800">
                          <span className="font-medium">What was great:</span> {review.personalNote}
                        </p>
                      </div>
                    )}

                    {review.negativeNote && (
                      <div className="mt-2 p-3 bg-red-50 border-l-4 border-red-400 rounded">
                        <p className="text-sm text-red-800">
                          <span className="font-medium">What could be better:</span> {review.negativeNote}
                        </p>
                      </div>
                    )}

                    {review.images && review.images.length > 0 && (
                      <div className="flex mt-3 space-x-2">
                        {review.images.slice(0, 3).map((image, i) => (
                          <img
                            key={i}
                            src={image}
                            alt="Review"
                            className="w-16 h-16 rounded-md object-cover"
                          />
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          }) : (
            <div className="text-center py-8">
              <p className="text-dark-gray mb-4">No reviews yet. Be the first to review this dish!</p>
              <button
                onClick={() => navigate('/create', {
                  state: {
                    selectedRestaurant: restaurant,
                    selectedDish: menuItem.name
                  }
                })}
                className="bg-primary text-white px-6 py-2 rounded-full font-medium hover:bg-primary/90 transition-colors"
              >
                Write First Review
              </button>
            </div>
          )}
        </div>
        {reviews.length > 5 && (
          <button className="w-full mt-4 py-2 border border-medium-gray rounded-full text-center font-medium">
            View All Reviews ({reviews.length})
          </button>
        )}
      </div>

      {/* Other Dishes Section */}
      {restaurant && otherDishes.length > 0 && (
        <div className="bg-white mt-2 p-4 shadow-sm mb-8">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-semibold text-lg">Other dishes at {restaurant.name}</h3>
            <Link
              to={'/restaurant/' + restaurant.id}
              className="text-sm text-primary hover:underline"
            >
              View All →
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {otherDishes.map(dish => (
              <Link
                key={dish.id}
                to={'/dish/' + dish.id}
                className="bg-light-gray rounded-lg p-3 hover:bg-gray-100 transition-colors"
              >
                <div className="flex items-center mb-2">
                  <ChefHatIcon size={16} className="text-dark-gray mr-2" />
                  <span className="text-xs text-dark-gray">{dish.category}</span>
                </div>
                <h4 className="font-medium text-sm mb-1">{dish.name}</h4>
                {dish.price && (
                  <p className="text-primary font-medium text-sm">$ {dish.price}</p>
                )}
              </Link>
            ))}
          </div>
        </div>
      )}

      <BottomNavigation />

      {/* Save Modal */}
      {showSaveModal && menuItem && (
        <SaveToListModal
          isOpen={showSaveModal}
          onClose={() => setShowSaveModal(false)}
          restaurantId={restaurant?.id}
          restaurantName={restaurant?.name}
          dishId={menuItem.id}
          dishName={menuItem.name}
          onSaved={({ listName }) => {
            setSaved(true);
            const msg = listName ? 'Saved to list ✅ — “' + listName + '”' : 'Saved to list ✅';
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
    </div>
  );
};

export default MenuDetail;
