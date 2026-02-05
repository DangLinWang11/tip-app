import React from 'react';
import { Star } from 'lucide-react';
import DishIcon from './icons/DishIcon';

interface UserStatsPillsProps {
  reviewsCount: number;
  dishesCount: number;
  compact?: boolean;
  stacked?: boolean;
}

const UserStatsPills: React.FC<UserStatsPillsProps> = ({
  reviewsCount,
  dishesCount,
  compact = false,
  stacked = false
}) => {
  if (compact) {
    return (
      <div className="flex items-center gap-1.5 text-xs">
        <span className="flex items-center text-blue-400">
          <Star size={12} className="mr-0.5" />
          {reviewsCount}
        </span>
        <span className="text-gray-500">|</span>
        <span className="flex items-center text-amber-400">
          <DishIcon className="mr-0.5" size={12} />
          {dishesCount}
        </span>
      </div>
    );
  }

  if (stacked) {
    return (
      <div className="flex flex-col gap-1.5">
        {/* Reviews Pill - Blue */}
        <div className="flex items-center px-2.5 py-1 bg-blue-50 rounded-full text-xs">
          <Star size={12} className="mr-1 text-blue-500" />
          <span className="font-medium text-blue-700">{reviewsCount}</span>
          <span className="text-blue-600 ml-1">Reviews</span>
        </div>

        {/* Dishes Pill - Amber */}
        <div className="flex items-center px-2.5 py-1 bg-amber-50 rounded-full text-xs">
          <DishIcon className="mr-1 text-amber-500" size={12} />
          <span className="font-medium text-amber-700">{dishesCount}</span>
          <span className="text-amber-600 ml-1">Dishes</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 mt-3">
      {/* Reviews Pill - Blue */}
      <div className="flex items-center px-3 py-1.5 bg-blue-50 rounded-full text-sm">
        <Star size={14} className="mr-1.5 text-blue-500" />
        <span className="font-medium text-blue-700">{reviewsCount}</span>
        <span className="text-blue-600 ml-1">Reviews</span>
      </div>

      {/* Dishes Pill - Amber */}
      <div className="flex items-center px-3 py-1.5 bg-amber-50 rounded-full text-sm">
        <DishIcon className="mr-1.5 text-amber-500" size={14} />
        <span className="font-medium text-amber-700">{dishesCount}</span>
        <span className="text-amber-600 ml-1">Dishes</span>
      </div>
    </div>
  );
};

export default UserStatsPills;
