import React, { useState } from 'react';
import { Star, Store } from 'lucide-react';

export interface RestaurantCardData {
  id: string;
  name: string;
  qualityPercentage: number;
  averageRating: number;
  cuisineType: string;
  priceRange: string;
  address: string;
  reviewCount: number;
  imageUrl: string;
}

interface RestaurantCardProps {
  data: RestaurantCardData;
  onClick?: (id: string) => void;
}

const getQualityColor = (percentage: number): string => {
  if (percentage >= 95) return '#059669';
  if (percentage >= 90) return '#10B981';
  if (percentage >= 85) return '#34D399';
  if (percentage >= 80) return '#6EE7B7';
  if (percentage >= 75) return '#FDE047';
  if (percentage >= 70) return '#FACC15';
  if (percentage >= 65) return '#F59E0B';
  if (percentage >= 60) return '#F97316';
  if (percentage >= 55) return '#FB7185';
  return '#EF4444';
};

const RestaurantCard: React.FC<RestaurantCardProps> = ({ data, onClick }) => {
  const [imgError, setImgError] = useState(false);
  const qualityColor = getQualityColor(data.qualityPercentage);

  return (
    <div
      className="bg-white rounded-2xl overflow-hidden h-full flex flex-col cursor-pointer hover:shadow-lg transition-shadow"
      onClick={() => onClick?.(data.id)}
    >
      {/* Image container */}
      <div className="relative w-full h-48 bg-gray-100 flex-shrink-0">
        {data.imageUrl && !imgError ? (
          <img
            src={data.imageUrl}
            alt={data.name}
            className="w-full h-full object-cover"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Store size={48} className="text-gray-300" />
          </div>
        )}
        {/* Quality badge overlay */}
        <div
          className="absolute top-3 right-3 px-3 py-1.5 rounded-full shadow-lg font-bold text-white text-sm"
          style={{ backgroundColor: qualityColor }}
        >
          {data.qualityPercentage}%
        </div>
      </div>

      {/* Content area */}
      <div className="flex-1 p-4 flex flex-col gap-2">
        {/* Restaurant name */}
        <h3 className="text-xl font-bold text-gray-900 line-clamp-1">
          {data.name}
        </h3>

        {/* Rating and cuisine row */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <Star size={16} className="text-yellow-500 fill-yellow-500" />
            <span className="text-sm font-semibold text-gray-700">
              {data.averageRating.toFixed(1)}
            </span>
          </div>
          <span className="text-gray-400">•</span>
          <span className="text-sm text-gray-600 truncate">{data.cuisineType}</span>
        </div>

        {/* Info badges */}
        <div className="flex items-center gap-2 flex-wrap">
          {data.priceRange && (
            <span className="px-3 py-1 bg-gray-100 text-gray-700 text-xs font-medium rounded-full">
              {data.priceRange}
            </span>
          )}
          <span className="px-3 py-1 bg-gray-100 text-gray-700 text-xs font-medium rounded-full">
            {data.reviewCount} reviews
          </span>
        </div>

        {/* Address */}
        <p className="text-xs text-gray-500 truncate mt-auto">
          {data.address}
        </p>
      </div>
    </div>
  );
};

export default RestaurantCard;
