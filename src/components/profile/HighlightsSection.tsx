import React from 'react';
import TopDishesCard from './TopDishesCard';
import StatsSummaryCard from './StatsSummaryCard';
import type { TopDish } from '../../utils/topDishes';

interface HighlightsSectionProps {
  topDishes: TopDish[];
  restaurantsCount: number;
  dishesReviewed: number;
  citiesCount: number;
}

const HighlightsSection: React.FC<HighlightsSectionProps> = ({
  topDishes,
  restaurantsCount,
  dishesReviewed,
  citiesCount
}) => {
  return (
    <div className="mt-4 grid gap-3 sm:grid-cols-2 items-stretch">
      <TopDishesCard topDishes={topDishes} />
      <StatsSummaryCard
        restaurantsCount={restaurantsCount}
        dishesReviewed={dishesReviewed}
        citiesCount={citiesCount}
      />
    </div>
  );
};

export default HighlightsSection;
