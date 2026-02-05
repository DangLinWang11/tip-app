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
  const clampedScore = Math.max(0, Math.min(100, percentage));

  if (clampedScore >= 90) return '#2F6F4E'; // Premium / Excellent (forest green)
  if (clampedScore >= 80) return '#4F9B75'; // Very Good
  if (clampedScore >= 70) return '#9FD3B5'; // Good / Reliable
  if (clampedScore >= 60) return '#E4D96F'; // Average / Caution
  if (clampedScore >= 50) return '#F0A43C'; // Declining
  if (clampedScore >= 36) return '#E06B2D'; // Poor
  return '#C92A2A';                          // Hard Red / Avoid
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
