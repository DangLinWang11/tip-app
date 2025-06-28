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
  return <div className={`${sizeClasses[size]} rounded-full bg-primary text-white flex items-center justify-center font-semibold`}>
      {rating.toFixed(1)}
    </div>;
};
export default RatingBadge;