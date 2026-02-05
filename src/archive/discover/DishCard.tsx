import React, { useState } from 'react';
import { MapPin, Utensils } from 'lucide-react';
import RatingBadge from '../RatingBadge';

export interface DishCardData {
  id: string;
  name: string;
  rating: number;
  restaurantName: string;
  restaurantId: string;
  category: string[];
  address: string;
  priceRange: string;
  imageUrl: string;
}

interface DishCardProps {
  data: DishCardData;
  onClick?: (id: string) => void;
}

const DishCard: React.FC<DishCardProps> = ({ data, onClick }) => {
  const [imgError, setImgError] = useState(false);

  return (
    <div
      className="bg-white rounded-2xl overflow-hidden h-full flex flex-col cursor-pointer hover:shadow-lg transition-shadow"
      onClick={() => onClick?.(data.id)}
    >
      {/* Image container with aspect ratio */}
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
            <Utensils size={48} className="text-gray-300" />
          </div>
        )}
        {/* Rating badge overlay (top-right) */}
        <div className="absolute top-3 right-3 bg-white/95 backdrop-blur-sm px-3 py-1.5 rounded-full shadow-lg">
          <RatingBadge rating={data.rating} size="lg" />
        </div>
      </div>

      {/* Content area */}
      <div className="flex-1 p-4 flex flex-col gap-2">
        {/* Dish name */}
        <h3 className="text-xl font-bold text-gray-900 line-clamp-1">
          {data.name}
        </h3>

        {/* Restaurant info */}
        <div className="flex items-center gap-2 text-gray-700">
          <MapPin size={16} className="text-primary flex-shrink-0" />
          <span className="text-sm font-medium truncate">{data.restaurantName}</span>
        </div>

        {/* Tags row */}
        <div className="flex items-center gap-2 flex-wrap">
          {data.category.slice(0, 3).map((cat) => (
            <span
              key={cat}
              className="px-3 py-1 bg-gray-100 text-gray-700 text-xs font-medium rounded-full"
            >
              {cat}
            </span>
          ))}
          {data.priceRange && (
            <span className="px-3 py-1 bg-primary/10 text-primary text-xs font-semibold rounded-full">
              {data.priceRange}
            </span>
          )}
        </div>

        {/* Address */}
        <p className="text-xs text-gray-500 truncate mt-auto">
          {data.address}
        </p>
      </div>
    </div>
  );
};

export default DishCard;
