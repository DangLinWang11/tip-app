import React from 'react';
import { useNavigate } from 'react-router-dom';
import { X } from 'lucide-react';

interface Dish {
  id: string;
  name: string;
  rating: number;
  category?: string;
  price?: string;
  restaurantName: string;
  restaurantId?: string;
  image?: string;
}

interface DishCardProps {
  dish: Dish;
  onClose: () => void;
}

const getRatingColor = (rating: number): string => {
  // Convert 0-10 rating to percentage for color consistency
  const percentage = (rating / 10) * 100;
  if (percentage >= 90) return '#10B981'; // Green for high ratings (90%+)
  if (percentage >= 80) return '#34D399'; // Light green (80-89%)
  if (percentage >= 70) return '#FCD34D'; // Yellow (70-79%)
  if (percentage >= 60) return '#FBBF24'; // Orange-yellow (60-69%)
  if (percentage >= 50) return '#FB923C'; // Orange (50-59%)
  return '#EF4444'; // Red for low ratings (<50%)
};

const DishCard: React.FC<DishCardProps> = ({ dish, onClose }) => {
  const navigate = useNavigate();
  const ratingColor = getRatingColor(dish.rating);

  const handleRestaurantClick = () => {
    if (dish.restaurantId) {
      navigate(`/restaurant/${dish.restaurantId}`);
      onClose(); // Close modal when navigating
    }
  };

  const handleOverlayClick = (e: React.MouseEvent) => {
    // Close modal if clicking on the overlay (not the content)
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      onClick={handleOverlayClick}
    >
      <div className="bg-white rounded-2xl overflow-hidden shadow-xl max-w-sm w-full mx-4 relative">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-10 p-1 bg-white bg-opacity-90 hover:bg-opacity-100 rounded-full transition-all duration-200 shadow-sm"
        >
          <X size={20} className="text-gray-600" />
        </button>

        {/* Header Image */}
        {dish.image && (
          <div className="relative">
            <img 
              src={dish.image} 
              alt={dish.name}
              className="w-full h-24 object-cover"
              onError={(e) => {
                // Hide image if it fails to load
                e.currentTarget.style.display = 'none';
              }}
            />
          </div>
        )}

        {/* Content */}
        <div className="p-4">
          {/* Dish Name */}
          <h3 className="text-lg font-semibold text-gray-900 mb-3 pr-6">
            {dish.name}
          </h3>

          {/* Rating and Category Row */}
          <div className="flex items-center gap-2 mb-3">
            <span 
              className="inline-flex items-center justify-center px-3 py-1 rounded-full text-white text-sm font-bold"
              style={{ backgroundColor: ratingColor }}
            >
              {dish.rating.toFixed(1)}
            </span>
            {dish.category && (
              <span className="text-gray-600 text-sm">
                {dish.category}
              </span>
            )}
          </div>

          {/* Price */}
          {dish.price && (
            <div className="mb-3">
              <span className="text-gray-700 font-medium text-sm">
                {dish.price}
              </span>
            </div>
          )}

          {/* Restaurant Name */}
          <div className="mb-0">
            <span className="text-gray-500 text-sm">From </span>
            <button
              onClick={handleRestaurantClick}
              className={`text-sm font-medium transition-colors ${
                dish.restaurantId 
                  ? 'text-primary hover:text-red-600 cursor-pointer' 
                  : 'text-gray-700 cursor-default'
              }`}
            >
              {dish.restaurantName}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DishCard;