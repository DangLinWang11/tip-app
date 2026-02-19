import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeftIcon } from 'lucide-react';
import { fetchUserReviews, type FirebaseReview } from '../services/reviewService';
import { getTopDishes } from '../utils/topDishes';

const GLASS_CARD =
  'rounded-3xl bg-white/92 backdrop-blur-xl shadow-[0_20px_40px_rgba(15,23,42,0.2)] border border-white/70';

const TopDishes: React.FC = () => {
  const navigate = useNavigate();
  const [reviews, setReviews] = useState<FirebaseReview[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const loadReviews = async () => {
      setLoading(true);
      const data = await fetchUserReviews(200);
      if (mounted) {
        setReviews(data);
        setLoading(false);
      }
    };
    loadReviews();
    return () => {
      mounted = false;
    };
  }, []);

  const topDishes = useMemo(() => getTopDishes(reviews, 5), [reviews]);

  return (
    <div className="min-h-screen bg-light-gray pb-16">
      <div className="sticky top-0 z-10 bg-white shadow-sm">
        <div className="flex items-center gap-3 px-4 py-4">
          <button
            onClick={() => navigate(-1)}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            aria-label="Back"
          >
            <ArrowLeftIcon size={18} className="text-gray-600" />
          </button>
          <h1 className="text-lg font-semibold text-gray-900">Top Dishes</h1>
        </div>
      </div>

      <div className="p-4">
        <div className={`${GLASS_CARD} p-6`}>
          {loading ? (
            <div className="text-center py-8">
              <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
              <p className="text-gray-600 text-sm">Loading your top dishes...</p>
            </div>
          ) : topDishes.length === 0 ? (
            <div className="text-center py-6 text-sm text-gray-600">
              Rate your first dish to see your Top 5.
            </div>
          ) : (
            <div className="space-y-3">
              {topDishes.map((dish, index) => (
                <button
                  key={`${dish.dishId || dish.representativeReviewId}-${index}`}
                  type="button"
                  onClick={() => {
                    if (dish.dishId) {
                      navigate(`/dish/${dish.dishId}`, { state: { originReviewId: dish.representativeReviewId } });
                      return;
                    }
                    navigate(`/post/${dish.representativeReviewId}`);
                  }}
                  className="w-full flex items-center gap-3 rounded-2xl px-3 py-2 hover:bg-white/80 transition-colors text-left"
                >
                  <span className="text-base font-semibold text-gray-900 w-6 text-center">
                    {index + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-gray-900">
                      {dish.dishName}
                    </div>
                    {dish.restaurantName ? (
                      <div className="text-xs text-gray-500 truncate">
                        {dish.restaurantName}
                      </div>
                    ) : null}
                  </div>
                  <span className="rounded-full bg-accent text-white px-2 py-1 text-xs font-semibold">
                    {dish.averageRating.toFixed(1)}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TopDishes;
