import React from 'react';

const GLASS_CARD =
  'rounded-3xl bg-white/92 backdrop-blur-xl shadow-[0_20px_40px_rgba(15,23,42,0.2)] border border-white/70';

interface StatsSummaryCardProps {
  restaurantsCount: number;
  dishesReviewed: number;
  citiesCount: number;
}

const StatsSummaryCard: React.FC<StatsSummaryCardProps> = ({
  restaurantsCount,
  dishesReviewed,
  citiesCount
}) => {
  return (
    <div className={`${GLASS_CARD} p-6 h-full`}>
      <h3 className="text-sm font-semibold text-gray-800">Stats Summary</h3>
      <div className="mt-4 space-y-4">
        <div>
          <div className="text-2xl font-semibold text-gray-900">{restaurantsCount}</div>
          <div className="text-xs text-gray-500">Restaurants</div>
        </div>
        <div>
          <div className="text-2xl font-semibold text-gray-900">{dishesReviewed}</div>
          <div className="text-xs text-gray-500">Dishes Reviewed</div>
        </div>
        <div>
          <div className="text-2xl font-semibold text-gray-900">{citiesCount}</div>
          <div className="text-xs text-gray-500">Cities</div>
        </div>
      </div>
    </div>
  );
};

export default StatsSummaryCard;
