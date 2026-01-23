import React from 'react';
import { getBadgeBandStyle, getRomanNumeral } from '../../badges/badgeTiers';

export interface AvatarBadgeProps {
  tierIndex: number;
  size?: 'profile' | 'feed' | 'small';
  className?: string;
}

const sizeClasses: Record<NonNullable<AvatarBadgeProps['size']>, { wrapper: string; text: string }> = {
  profile: {
    wrapper: 'h-7 w-7 -top-1 -left-1',
    text: 'text-[10px]'
  },
  feed: {
    wrapper: 'h-4 w-4 -top-1 -left-1',
    text: 'text-[8px]'
  },
  small: {
    wrapper: 'h-3 w-3 -top-0.5 -left-0.5',
    text: 'text-[7px]'
  }
};

const AvatarBadge: React.FC<AvatarBadgeProps> = ({ tierIndex, size = 'feed', className }) => {
  const safeTier = Math.max(1, Math.min(20, Math.floor(tierIndex || 1)));
  const label = size === 'profile' ? getRomanNumeral(safeTier) : String(safeTier);
  const theme = getBadgeBandStyle(safeTier);
  const sizing = sizeClasses[size];

  return (
    <div
      className={`absolute ${sizing.wrapper} ${theme.bg} ${theme.text} ${theme.border} ${theme.ring} ${sizing.text} flex items-center justify-center border shadow-md ring-2 font-semibold leading-none rounded-[6px] rounded-b-[10px] ${className || ''}`}
      aria-label={`Badge tier ${safeTier}`}
    >
      {label}
    </div>
  );
};

export default AvatarBadge;
