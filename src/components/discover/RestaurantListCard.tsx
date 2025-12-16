import React from 'react';
import { MapPin, Store } from 'lucide-react';

export type RestaurantCardModel = {
  id: string;
  name: string;
  coverImage: string | null;
  priceText: string | null;
  distanceLabel: string | null;
  subtitleText: string;
  badgeText: string | null;
  badgeColor: string | null;
  limitedRatingsText: string | null;
  reviewCountText: string | null;
  source: 'tip' | 'google';
  restaurantId?: string;
  googlePlaceId?: string;
};

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

interface RestaurantListCardProps {
  card: RestaurantCardModel;
  onClick: () => void;
}

const RestaurantListCard: React.FC<RestaurantListCardProps> = ({ card, onClick }) => {
  return (
    <div
      className="bg-white rounded-xl shadow-sm flex overflow-hidden border cursor-pointer hover:bg-gray-50 transition-colors"
      onClick={onClick}
    >
      <div className="w-20 h-20 bg-gray-100 flex items-center justify-center flex-shrink-0">
        {card.coverImage ? (
          <img
            src={card.coverImage}
            alt={card.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-12 h-12 bg-gray-300 rounded-lg flex items-center justify-center">
            <Store size={24} className="text-gray-500" />
          </div>
        )}
      </div>
      <div className="p-3 flex-1">
        <div className="flex justify-between items-start gap-2">
          <div className="flex-1 min-w-0 max-w-[calc(100%-60px)]">
            <h3 className="font-medium truncate">{card.name}</h3>
            {(card.limitedRatingsText || card.reviewCountText) && (
              <div className="mt-1">
                <div className="inline-block px-2 py-0.5 rounded-full bg-gray-200">
                  <span className="text-xs font-medium text-gray-600">
                    {card.reviewCountText || card.limitedRatingsText}
                  </span>
                </div>
              </div>
            )}
          </div>
          <div className="flex items-center gap-1 flex-shrink-0 w-[52px] justify-end">
            {card.badgeText && (
              <div
                className="px-2 py-0.5 rounded-full"
                style={{ backgroundColor: card.badgeColor || '#9CA3AF' }}
              >
                <span className="text-xs font-medium text-white">{card.badgeText}</span>
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center justify-between mt-1">
          <div className="flex items-center text-sm text-dark-gray space-x-2">
            <span>{card.subtitleText}</span>
            {card.priceText && <span>{card.priceText}</span>}
          </div>
          <div className="flex items-center text-xs text-dark-gray">
            <MapPin size={14} className="text-dark-gray mr-1" />
            <span>{card.distanceLabel ?? '-'}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RestaurantListCard;
export { getQualityColor };
