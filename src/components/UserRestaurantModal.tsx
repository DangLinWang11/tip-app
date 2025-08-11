import React, { useState, useEffect } from 'react';
import { X, Star, Calendar, MapPin } from 'lucide-react';
import { getUserRestaurantReviews, FirebaseReview, type UserVisitedRestaurant } from '../services/reviewService';

interface UserRestaurantModalProps {
  restaurant: UserVisitedRestaurant;
  isOpen: boolean;
  onClose: () => void;
}

const UserRestaurantModal: React.FC<UserRestaurantModalProps> = ({
  restaurant,
  isOpen,
  onClose
}) => {
  const [reviews, setReviews] = useState<FirebaseReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load user's reviews for this restaurant
  useEffect(() => {
    if (isOpen && restaurant) {
      const loadRestaurantReviews = async () => {
        try {
          setLoading(true);
          setError(null);
          
          console.log(`🍽️ Loading reviews for restaurant: ${restaurant.name} (${restaurant.id})`);
          const restaurantReviews = await getUserRestaurantReviews(restaurant.id);
          setReviews(restaurantReviews);
          
          console.log(`✅ Loaded ${restaurantReviews.length} reviews for ${restaurant.name}`);
        } catch (err) {
          console.error('❌ Error loading restaurant reviews:', err);
          setError('Failed to load your reviews for this restaurant');
        } finally {
          setLoading(false);
        }
      };

      loadRestaurantReviews();
    }
  }, [isOpen, restaurant]);

  // Close modal when clicking outside
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  // Don't render if not open
  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"
      onClick={handleBackdropClick}
    >
      <div className="bg-white rounded-xl max-w-lg w-full max-h-[80vh] overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="bg-gradient-to-r from-primary to-red-600 text-white p-6 relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 hover:bg-white/20 rounded-full transition-colors"
          >
            <X size={20} />
          </button>
          
          <h2 className="text-xl font-bold mb-2 pr-12">{restaurant.name}</h2>
          <div className="flex items-center space-x-4 text-white/90">
            <div className="flex items-center">
              <Star size={16} className="mr-1 fill-current" />
              <span className="font-medium">{restaurant.averageRating.toFixed(1)}</span>
            </div>
            <div className="flex items-center">
              <Calendar size={16} className="mr-1" />
              <span>{restaurant.visitCount} visit{restaurant.visitCount !== 1 ? 's' : ''}</span>
            </div>
            <div className="flex items-center">
              <MapPin size={16} className="mr-1" />
              <span>{restaurant.cuisine}</span>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="overflow-y-auto max-h-[60vh]">
          {loading ? (
            // Loading state
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                <p className="text-gray-600">Loading your dishes...</p>
              </div>
            </div>
          ) : error ? (
            // Error state
            <div className="text-center py-12 px-6">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-red-600 text-2xl">⚠️</span>
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
            // Empty state
            <div className="text-center py-12 px-6">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-gray-400 text-2xl">🍽️</span>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No Reviews Found</h3>
              <p className="text-gray-600 mb-4">
                We couldn't find any reviews for this restaurant. This might be a sync issue.
              </p>
            </div>
          ) : (
            // Reviews list
            <div className="p-6 space-y-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Your Dishes ({reviews.length})
              </h3>
              
              {reviews.map((review) => (
                <div 
                  key={review.id} 
                  className="bg-gray-50 rounded-lg p-4 border border-gray-200 hover:shadow-md transition-shadow"
                >
                  {/* Dish header */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h4 className="font-semibold text-gray-900">{review.dish}</h4>
                      <div className="flex items-center mt-1">
                        <div className="flex items-center bg-primary/10 px-2 py-1 rounded-full">
                          <Star size={12} className="text-primary mr-1 fill-current" />
                          <span className="text-sm font-medium text-primary">{review.rating.toFixed(1)}</span>
                        </div>
                        {review.price && (
                          <span className="ml-2 text-sm text-gray-600">{review.price}</span>
                        )}
                      </div>
                    </div>
                    
                    {/* Review image */}
                    {review.images.length > 0 && (
                      <div className="ml-4 flex-shrink-0">
                        <img
                          src={review.images[0]}
                          alt={review.dish}
                          className="w-16 h-16 object-cover rounded-lg border"
                        />
                      </div>
                    )}
                  </div>

                  {/* Review content */}
                  <div className="space-y-2">
                    {/* Positive note */}
                    {review.personalNote && (
                      <div className="flex items-start">
                        <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                          <span className="text-green-600 text-sm font-bold">+</span>
                        </div>
                        <p className="ml-2 text-sm text-gray-700 leading-relaxed">{review.personalNote}</p>
                      </div>
                    )}
                    
                    {/* Negative note */}
                    {review.negativeNote && (
                      <div className="flex items-start">
                        <div className="w-6 h-6 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                          <span className="text-red-600 text-sm font-bold">-</span>
                        </div>
                        <p className="ml-2 text-sm text-gray-600 leading-relaxed">{review.negativeNote}</p>
                      </div>
                    )}
                  </div>

                  {/* Review metadata */}
                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-200">
                    <span className="text-xs text-gray-500">
                      {new Date(review.createdAt).toLocaleDateString()}
                    </span>
                    
                    {/* Tags */}
                    {review.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {review.tags.slice(0, 3).map((tag, index) => (
                          <span
                            key={index}
                            className="px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs"
                          >
                            {tag}
                          </span>
                        ))}
                        {review.tags.length > 3 && (
                          <span className="text-xs text-gray-500">
                            +{review.tags.length - 3} more
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 p-4 bg-gray-50">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">
              Last visit: {new Date(restaurant.lastVisit).toLocaleDateString()}
            </span>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
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