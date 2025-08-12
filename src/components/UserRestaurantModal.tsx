import React, { useState, useEffect } from 'react';
import { X, Star, Calendar, MapPin } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
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
  const navigate = useNavigate();
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

  // Handle review card click to navigate to the post
  const handleReviewClick = (review: FirebaseReview) => {
    // Navigate to the review post - assuming the route is /post/{reviewId}
    navigate(`/post/${review.id}`);
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
        <div className="bg-white p-6 relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X size={20} className="text-gray-600" />
          </button>
          
          {/* Date in top-right */}
          <div className="absolute top-4 left-4 text-sm text-gray-500">
            {new Date(restaurant.lastVisit).toLocaleDateString()}
          </div>
          
          {/* Restaurant name */}
          <div className="flex items-center justify-center mb-4 mt-2">
            <h2 className="text-xl font-bold text-gray-900">{restaurant.name}</h2>
          </div>
          
          {/* Stats row - visit count and cuisine only */}
          <div className="flex items-center justify-center space-x-4 text-gray-600">
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
            <div className="px-4 py-6">
              <div className="space-y-1">
                {reviews.map((review) => (
                  <div 
                    key={review.id} 
                    onClick={() => handleReviewClick(review)}
                    className="bg-white rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow cursor-pointer border border-gray-100"
                  >
                    <div className="flex items-start space-x-3">
                      {/* Review image */}
                      {review.images.length > 0 && (
                        <div className="flex-shrink-0">
                          <img
                            src={review.images[0]}
                            alt={review.dish}
                            className="w-10 h-10 object-cover rounded-full"
                          />
                        </div>
                      )}
                      
                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div>
                          <div>
                            <p className="text-sm text-gray-900 leading-5">
                              <span className="font-medium">{review.dish}</span>
                              {review.price && (
                                <span className="text-gray-600"> - {review.price}</span>
                              )}
                            </p>
                            
                            {/* Review notes preview */}
                            {review.personalNote && (
                              <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                                {review.personalNote}
                                {review.rating && (
                                  <span className="text-primary text-lg font-bold"> {review.rating}</span>
                                )}
                              </p>
                            )}
                          </div>
                          
                          {/* Timestamp at bottom-right */}
                          <div className="flex justify-end mt-2">
                            <div className="text-xs text-gray-500">
                              {new Date(review.createdAt).toLocaleDateString()}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 p-4 bg-gray-50">
          <div className="flex items-center justify-end">
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