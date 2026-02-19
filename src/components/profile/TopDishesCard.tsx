import React from 'react';
import { Trophy } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { TopDish } from '../../utils/topDishes';

const GLASS_CARD =
  'rounded-3xl bg-white/92 backdrop-blur-xl shadow-[0_20px_40px_rgba(15,23,42,0.2)] border border-white/70';

interface TopDishesCardProps {
  topDishes: TopDish[];
}

const TopDishesCard: React.FC<TopDishesCardProps> = ({ topDishes }) => {
  const navigate = useNavigate();

  const handleViewAll = () => {
    navigate('/profile/top');
  };

  const handleRowClick = (dish: TopDish) => {
    if (dish.dishId) {
      navigate(`/dish/${dish.dishId}`, { state: { originReviewId: dish.representativeReviewId } });
      return;
    }
    navigate(`/post/${dish.representativeReviewId}`);
  };

  return (
    <div className={`${GLASS_CARD} p-5 h-full`}>
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <span className="w-5 flex items-center justify-center text-primary" aria-hidden="true">
            <Trophy size={16} />
          </span>
          <h3 className="text-sm font-semibold text-gray-800">Top Dishes</h3>
        </div>
        <button
          type="button"
          onClick={handleViewAll}
          className="text-xs font-medium text-secondary hover:underline"
        >
          View All →
        </button>
      </div>

      {topDishes.length === 0 ? (
        <div className="mt-3 rounded-2xl bg-white/80 border border-white/70 px-4 py-2.5 text-sm text-gray-600">
          Rate your first dish to see your Top 3.
        </div>
      ) : (
        <div className="mt-3 space-y-2">
          {topDishes.map((dish, index) => (
            <button
              key={`${dish.dishId || dish.representativeReviewId}-${index}`}
              type="button"
              onClick={() => handleRowClick(dish)}
              className="w-full flex items-center gap-3 rounded-2xl px-1 py-1.5 hover:bg-white/80 transition-colors text-left"
            >
              <span className="w-5 text-center text-sm font-semibold text-primary">
                {index + 1}
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-gray-900 leading-tight">
                  {dish.dishName}
                </div>
                {dish.restaurantName ? (
                  <div className="text-xs text-gray-500 truncate leading-tight">
                    {dish.restaurantName}
                  </div>
                ) : null}
              </div>
              <span className="rounded-full bg-accent text-white px-2 py-0.5 text-xs font-semibold">
                {dish.averageRating.toFixed(1)}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default TopDishesCard;
