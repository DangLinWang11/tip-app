import React from 'react';

interface RatingBadgeProps {
  rating: number;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

const RatingBadge: React.FC<RatingBadgeProps> = ({ rating, size = 'md' }) => {
  const sizeClasses: Record<'sm' | 'md' | 'lg' | 'xl', string> = {
    sm: 'text-base',
    md: 'text-xl',
    lg: 'text-2xl',
    xl: 'text-3xl',
  };

  return (
    <span className={`text-primary font-bold ${sizeClasses[size]}`}>
      {rating.toFixed(1)}
    </span>
  );
};

export default RatingBadge;

