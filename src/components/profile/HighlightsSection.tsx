import React from 'react';
import TopDishesCard from './TopDishesCard';
import type { TopDish } from '../../utils/topDishes';

interface HighlightsSectionProps {
  topDishes: TopDish[];
}

const HighlightsSection: React.FC<HighlightsSectionProps> = ({
  topDishes
}) => {
  return (
    <div className="mt-4">
      <TopDishesCard topDishes={topDishes} />
    </div>
  );
};

export default HighlightsSection;
