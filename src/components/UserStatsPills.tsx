import React from 'react';
import { Store } from 'lucide-react';
import DishIcon from './icons/DishIcon';

interface UserStatsPillsProps {
  restaurantsCount: number;
  dishesCount: number;
  compact?: boolean;
}

const UserStatsPills: React.FC<UserStatsPillsProps> = ({
  restaurantsCount,
  dishesCount,
  compact = false
}) => {
  if (compact) {
    return (
      <div className="flex items-center gap-1.5 text-xs">
        <span className="flex items-center text-blue-400">
          <Store size={12} className="mr-0.5" />
          {restaurantsCount}
        </span>
        <span className="text-gray-500">|</span>
        <span className="flex items-center text-amber-400">
          <DishIcon className="mr-0.5" size={12} />
          {dishesCount}
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 mt-3">
      {/* Restaurants Pill - Blue */}
      <div className="flex items-center px-3 py-1.5 bg-blue-50 rounded-full text-sm">
        <Store size={14} className="mr-1.5 text-blue-500" />
        <span className="font-medium text-blue-700">{restaurantsCount}</span>
        <span className="text-blue-600 ml-1">Restaurants</span>
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
