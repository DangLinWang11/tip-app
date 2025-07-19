import React from 'react';
import { X, Star, MapPin, ChefHat } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface DishDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  dish: {
    id: string;
    name: string;
    rating: number;
    hasReviews: boolean;
    price?: string;
    category: string;
    restaurantId: string;
    restaurantName: string;
    image: string;
  } | null;
}

const DishDetailModal: React.FC<DishDetailModalProps> = ({ isOpen, onClose, dish }) => {
  const navigate = useNavigate();

  if (!isOpen || !dish) return null;

  const handleRestaurantClick = () => {
    onClose();
    navigate(`/restaurant/${dish.restaurantId}`);
  };

  const handleDishClick = () => {
    onClose();
    navigate(`/dish/${dish.id}`);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-[9999] flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="relative">
          <button
            onClick={onClose}
            className="absolute top-3 right-3 p-2 bg-black bg-opacity-50 hover:bg-opacity-70 rounded-full transition-colors z-10"
          >
            <X size={18} className="text-white" />
          </button>
          
          {/* Dish Image */}
          <div className="h-48 bg-gray-200 rounded-t-xl overflow-hidden">
            <img 
              src={dish.image} 
              alt={dish.name}
              className="w-full h-full object-cover"
            />
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Dish Name - Clickable */}
          <button
            onClick={handleDishClick}
            className="text-left w-full mb-3 group"
          >
            <h3 className="text-xl font-semibold text-gray-900 group-hover:text-primary transition-colors">
              {dish.name}
            </h3>
            <div className="flex items-center mt-1">
              <ChefHat size={14} className="text-gray-500 mr-1" />
              <span className="text-sm text-gray-500">{dish.category}</span>
            </div>
          </button>

          {/* Rating */}
          <div className="flex items-center mb-4">
            <div className="flex items-center">
              <Star 
                size={16} 
                className={dish.hasReviews ? "text-yellow-500 fill-yellow-500" : "text-gray-400"} 
              />
              <span className="ml-2 font-medium">
                {dish.hasReviews ? `${dish.rating.toFixed(1)}/10` : 'No rating yet'}
              </span>
            </div>
            {dish.price && (
              <>
                <span className="mx-2 text-gray-300">•</span>
                <span className="font-semibold text-primary">${dish.price}</span>
              </>
            )}
          </div>

          {/* Restaurant Info - Clickable */}
          <button
            onClick={handleRestaurantClick}
            className="w-full bg-gray-50 rounded-lg p-3 hover:bg-gray-100 transition-colors text-left"
          >
            <div className="flex items-center">
              <MapPin size={16} className="text-gray-500 mr-2" />
              <span className="font-medium text-primary hover:underline">
                {dish.restaurantName}
              </span>
            </div>
          </button>

          {/* Action Buttons */}
          <div className="flex gap-3 mt-4">
            <button
              onClick={handleDishClick}
              className="flex-1 bg-primary text-white py-2 rounded-lg font-medium hover:bg-red-600 transition-colors"
            >
              View Details
            </button>
            <button
              onClick={handleRestaurantClick}
              className="px-4 py-2 border border-gray-300 rounded-lg font-medium hover:bg-gray-50 transition-colors"
            >
              Restaurant
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DishDetailModal;