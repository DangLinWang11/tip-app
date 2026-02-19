import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { getUserRestaurantReviews, FirebaseReview, type UserVisitedRestaurant, calculateModalPriceLevel } from '../services/reviewService';

interface UserRestaurantModalProps {
  restaurant: UserVisitedRestaurant;
  isOpen: boolean;
  onClose: () => void;
  userId?: string;
}

const UserRestaurantModal: React.FC<UserRestaurantModalProps> = ({
  restaurant,
  isOpen,
  onClose,
  userId
}) => {
  const navigate = useNavigate();
  const [reviews, setReviews] = useState<FirebaseReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [restaurantImage, setRestaurantImage] = useState<string | null>(null);
  const [restaurantMeta, setRestaurantMeta] = useState<{ cuisine?: string; priceTag?: string; quality?: number | null } | null>(null);

  useEffect(() => {
    if (isOpen && restaurant) {
      const loadRestaurantReviews = async () => {
        try {
          setLoading(true);
          setError(null);

          const restaurantReviews = await getUserRestaurantReviews(restaurant.id, userId, restaurant.name);
          setReviews(restaurantReviews);

          let restaurantData: any = null;
          if (restaurant.id && !restaurant.id.startsWith('manual_')) {
            try {
              const restaurantDoc = await getDoc(doc(db, 'restaurants', restaurant.id));
              if (restaurantDoc.exists()) {
                restaurantData = { id: restaurantDoc.id, ...restaurantDoc.data() };
              }
            } catch (err) {
              console.warn('Failed to load restaurant metadata:', err);
            }
          }

          const isValidImage = (url?: string | null): boolean => {
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
                urlLower.includes('gstatic.com/maps') ||
                urlLower.includes('googleusercontent.com/maps') ||
                urlLower.includes('streetview') ||
                urlLower.includes('maptile') ||
                urlLower.includes('maps/vt')) {
              return false;
            }
            return true;
          };

          const reviewPhotoRaw =
            restaurantReviews.find(r => Array.isArray(r.images) && r.images.length > 0)?.images?.[0] || null;
          const reviewPhoto = isValidImage(reviewPhotoRaw) ? reviewPhotoRaw : null;

          const coverCandidates = [
            restaurantData?.coverImage,
            restaurantData?.headerImage,
            Array.isArray(restaurantData?.googlePhotos) && restaurantData.googlePhotos.length > 0 ? restaurantData.googlePhotos[0] : null,
            restaurantData?.photoUrl
          ];
          const coverImage = coverCandidates.find((u: string | null | undefined) => isValidImage(u)) || null;

          const priceLevel =
            typeof restaurantData?.priceLevel === 'number' && restaurantData.priceLevel >= 1 && restaurantData.priceLevel <= 4
              ? '$'.repeat(restaurantData.priceLevel)
              : typeof restaurantData?.priceRange === 'string'
              ? restaurantData.priceRange
              : (() => {
                  const modal = calculateModalPriceLevel(restaurantReviews);
                  return modal ? '$'.repeat(modal) : null;
                })();

          const cuisine =
            restaurantData?.cuisine ||
            (Array.isArray(restaurantData?.cuisines) && restaurantData.cuisines.length > 0 ? restaurantData.cuisines[0] : null) ||
            restaurant.cuisine;

          const quality =
            typeof restaurantData?.qualityScore === 'number'
              ? Math.round(restaurantData.qualityScore)
              : typeof restaurantData?.qualityPercentage === 'number'
              ? Math.round(restaurantData.qualityPercentage)
              : null;

          setRestaurantImage(reviewPhoto || coverImage);
          setRestaurantMeta({ cuisine: cuisine || undefined, priceTag: priceLevel || undefined, quality });
        } catch (err) {
          console.error('Error loading restaurant reviews:', err);
          setError('Failed to load your reviews for this restaurant');
        } finally {
          setLoading(false);
        }
      };

      loadRestaurantReviews();
    }
  }, [isOpen, restaurant, userId]);

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const formatReviewDate = (input: Date | number | string | any): string => {
    const toMillis = (v: any) =>
      v && typeof v.seconds === 'number' && typeof v.nanoseconds === 'number'
        ? v.seconds * 1000 + Math.floor(v.nanoseconds / 1e6)
        : typeof v === 'string'
        ? Date.parse(v)
        : typeof v === 'number'
        ? v
        : (v as Date)?.getTime?.() ?? Date.now();
    const d = new Date(toMillis(input));
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"
      onClick={handleBackdropClick}
    >
      <div className="bg-white rounded-2xl max-w-2xl w-full h-[78vh] max-h-[78vh] overflow-hidden shadow-2xl flex flex-col">
        <div className="bg-white p-6 relative border-b border-gray-100">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X size={20} className="text-gray-600" />
          </button>

          <div className="flex items-start gap-4">
            <div className="h-20 w-20 rounded-xl bg-gray-100 overflow-hidden flex-shrink-0">
              {restaurantImage ? (
                <img src={restaurantImage} alt={restaurant.name} className="h-full w-full object-cover" />
              ) : (
                <div className="h-full w-full bg-gray-100" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <button
                onClick={() => navigate(`/restaurant/${restaurant.id}`)}
                className="text-xl font-bold text-black leading-tight hover:opacity-80 transition-opacity text-left"
              >
                {restaurant.name}
              </button>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                {restaurantMeta?.cuisine && (
                  <span className="bg-gray-100 text-gray-700 px-2.5 py-1 rounded-full">{restaurantMeta.cuisine}</span>
                )}
                {restaurantMeta?.priceTag && (
                  <span className="bg-gray-100 text-gray-700 px-2.5 py-1 rounded-full">{restaurantMeta.priceTag}</span>
                )}
                {restaurantMeta?.quality != null && (
                  <span className="bg-primary/10 text-primary px-2.5 py-1 rounded-full font-semibold">
                    {restaurantMeta.quality}%
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                <p className="text-gray-600">Loading your dishes...</p>
              </div>
            </div>
          ) : error ? (
            <div className="text-center py-12 px-6">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-red-600 text-2xl">!</span>
              </div>
              <h3 className="text-lg font-semibold text-red-900 mb-2">Unable to Load Reviews</h3>
              <p className="text-red-600 mb-4">{error}</p>
              <button
                onClick={() => setLoading(true)}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                Try Again
              </button>
            </div>
          ) : reviews.length === 0 ? (
            <div className="text-center py-12 px-6">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-gray-400 text-2xl">?</span>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No Reviews Found</h3>
              <p className="text-gray-600 mb-4">
                We couldn't find any reviews for this restaurant. This might be a sync issue.
              </p>
            </div>
          ) : (
            <div className="px-4 pb-6 pt-4 min-h-[280px]">
              <div className="space-y-3">
                {reviews.map((review) => (
                  <div
                    key={review.id}
                    className="bg-white rounded-xl p-4 shadow-sm border border-gray-200"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="font-semibold text-gray-900 truncate">{review.dish}</p>
                        {(review.personalNote || (review as any)?.personalNotes?.[0]?.text) && (
                          <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                            {review.personalNote || (review as any)?.personalNotes?.[0]?.text}
                          </p>
                        )}
                        <div className="text-xs text-gray-400 mt-2">
                          {formatReviewDate(
                            (review as any)?.createdAt ??
                            (review as any)?.createdAtMs ??
                            review.timestamp
                          )}
                        </div>
                      </div>
                      {review.rating != null && typeof review.rating === 'number' && (
                        <div className="text-primary font-bold text-xl flex-shrink-0">
                          {review.rating.toFixed(1)}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="border-t border-gray-100 p-4 bg-white">
          <div className="flex items-center justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-full hover:bg-gray-200 transition-colors text-sm font-medium"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserRestaurantModal;
