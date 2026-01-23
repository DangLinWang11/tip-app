import React from 'react';
import { Store, TrendingUp } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface StatPillsProps {
  restaurantsCount: number;
  averageRating: number;
  username: string;
}

const StatPills: React.FC<StatPillsProps> = ({
  restaurantsCount,
  averageRating,
  username
}) => {
  const navigate = useNavigate();

  return (
    <div className="flex items-center gap-2 mt-4">
      {/* Restaurants Pill */}
      <button
        onClick={() => navigate(`/user/${username}/restaurants`)}
        className="flex items-center px-3 py-1.5 bg-blue-50 rounded-full text-sm hover:bg-blue-100 transition-colors"
      >
        <Store size={14} className="mr-1.5 text-blue-500" />
        <span className="font-medium text-blue-700">{restaurantsCount}</span>
        <span className="text-blue-600 ml-1">Restaurants</span>
      </button>

      {/* Average Rating Pill */}
      <button
        onClick={() => navigate(`/list-view?user=${username}`)}
        className="flex items-center px-3 py-1.5 bg-green-50 rounded-full text-sm hover:bg-green-100 transition-colors"
      >
        <TrendingUp size={14} className="mr-1.5 text-green-500" />
        <span className="font-medium text-green-700">
          {averageRating > 0 ? averageRating.toFixed(1) : '0.0'}
        </span>
        <span className="text-green-600 ml-1">Avg Rating</span>
      </button>
    </div>
  );
};

export default StatPills;
