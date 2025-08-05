import React from 'react';
interface RatingBadgeProps {
  rating: number;
  size?: 'sm' | 'md' | 'lg';
}
const RatingBadge: React.FC<RatingBadgeProps> = ({
  rating,
  size = 'md'
}) => {
  const sizeClasses = {
    sm: 'w-8 h-8 text-sm',
    md: 'w-12 h-12 text-base',
    lg: 'w-16 h-16 text-lg'
  };
  return (
    <span className="text-primary font-bold text-lg">
      {rating.toFixed(1)}
    </span>
  );
};
export default RatingBadge;