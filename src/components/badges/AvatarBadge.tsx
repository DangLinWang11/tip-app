import React from 'react';
import { getBadgeBandStyle, getRomanNumeral } from '../../badges/badgeTiers';

export interface AvatarBadgeProps {
  tierIndex: number;
  size?: 'profile' | 'feed' | 'small' | 'inline' | 'ladder' | 'ladder-lg';
  className?: string;
}

const sizeClasses: Record<NonNullable<AvatarBadgeProps['size']>, { wrapper: string; text: string; inline?: boolean }> = {
  profile: {
    wrapper: 'h-8 w-8 -top-1 -left-1',
    text: 'text-[13.5px]'
  },
  feed: {
    wrapper: 'h-5 w-5 -top-1 -left-1',
    text: 'text-[11px]'
  },
  small: {
    wrapper: 'h-3.5 w-3.5 -top-0.5 -left-0.5',
    text: 'text-[9px]'
  },
  inline: {
    wrapper: 'h-5 w-5',
    text: 'text-[11px]',
    inline: true
  },
  ladder: {
    wrapper: 'h-6 w-6',
    text: 'text-[11px]',
    inline: true
  },
  'ladder-lg': {
    wrapper: 'h-6 w-6',
    text: 'text-[11px]',
    inline: true
  }
};

const getStarCount = (tierIndex: number): number => {
  const posInBand = ((tierIndex - 1) % 5) + 1;
  // 1 = prestige base (no stars), 2 = 1 star, 3 = 2 stars, 4 = 3 stars, 5 = special (no stars)
  if (posInBand >= 2 && posInBand <= 4) return posInBand - 1;
  return 0;
};

const isPrestigeTier = (tierIndex: number): boolean => {
  return [1, 6, 11, 16].includes(tierIndex);
};

const isMilestoneTier = (tierIndex: number): boolean => {
  return [5, 10, 15, 20].includes(tierIndex);
};

const MilestoneIcon: React.FC<{ tierIndex: number; size: string }> = ({ tierIndex, size }) => {
  const iconSize = size === 'small' ? 9 : size === 'feed' || size === 'inline' ? 11 : size === 'ladder' || size === 'ladder-lg' ? 12 : 14;

  if (tierIndex === 5) {
    // Flame - multi-tip, gamified
    return (
      <svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* Main flame body */}
        <path d="M12 2C12 2 5.5 9 5.5 14.5C5.5 17.81 8.41 20.5 12 20.5C15.59 20.5 18.5 17.81 18.5 14.5C18.5 9 12 2 12 2Z" fill="url(#flame5main)" />
        {/* Left tip */}
        <path d="M8.5 6C8.5 6 6 9.5 6 12.5C6 13.5 6.3 14.3 6.8 15" fill="url(#flame5tip)" />
        {/* Right tip */}
        <path d="M15.5 5C15.5 5 18 9 18 12C18 13.2 17.7 14.2 17.2 15" fill="url(#flame5tip2)" />
        {/* Center spark */}
        <path d="M12 4L10.5 7.5C10.5 7.5 12 6.5 13.5 7.5L12 4Z" fill="#FDE68A" fillOpacity="0.8" />
        {/* Inner glow */}
        <path d="M12 11C12 11 9 14 9 16.5C9 18.16 10.34 19.5 12 19.5C13.66 19.5 15 18.16 15 16.5C15 14 12 11 12 11Z" fill="#FCD34D" />
        {/* Hot core */}
        <path d="M12 14.5C12 14.5 10.8 16 10.8 17C10.8 17.66 11.34 18.2 12 18.2C12.66 18.2 13.2 17.66 13.2 17C13.2 16 12 14.5 12 14.5Z" fill="#FEF3C7" />
        <defs>
          <linearGradient id="flame5main" x1="12" y1="2" x2="12" y2="20.5" gradientUnits="userSpaceOnUse">
            <stop stopColor="#F97316" />
            <stop offset="0.6" stopColor="#EF4444" />
            <stop offset="1" stopColor="#DC2626" />
          </linearGradient>
          <linearGradient id="flame5tip" x1="7.25" y1="6" x2="7.25" y2="15" gradientUnits="userSpaceOnUse">
            <stop stopColor="#FB923C" />
            <stop offset="1" stopColor="#F97316" />
          </linearGradient>
          <linearGradient id="flame5tip2" x1="16.75" y1="5" x2="16.75" y2="15" gradientUnits="userSpaceOnUse">
            <stop stopColor="#FB923C" />
            <stop offset="1" stopColor="#F97316" />
          </linearGradient>
        </defs>
      </svg>
    );
  }

  if (tierIndex === 10) {
    // Chef hat - bold black outline, visible details
    return (
      <svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 3.5C9.2 3.5 7.2 5.2 6.7 7.3C5 7.5 3.5 9.2 3.5 11.2C3.5 13.4 5.2 15 7.5 15V19.5H16.5V15C18.8 15 20.5 13.4 20.5 11.2C20.5 9.2 19 7.5 17.3 7.3C16.8 5.2 14.8 3.5 12 3.5Z" fill="white" />
        <rect x="7.5" y="16.5" width="9" height="3" rx="0.5" fill="white" />
        <line x1="7.5" y1="17.5" x2="16.5" y2="17.5" stroke="#1a1a1a" strokeWidth="1" strokeLinecap="round" />
        <path d="M12 3.5C9.2 3.5 7.2 5.2 6.7 7.3C5 7.5 3.5 9.2 3.5 11.2C3.5 13.4 5.2 15 7.5 15V19.5H16.5V15C18.8 15 20.5 13.4 20.5 11.2C20.5 9.2 19 7.5 17.3 7.3C16.8 5.2 14.8 3.5 12 3.5Z" stroke="#1a1a1a" strokeWidth="1.4" strokeLinejoin="round" />
        <rect x="7.5" y="16.5" width="9" height="3" rx="0.5" stroke="#1a1a1a" strokeWidth="1.2" />
      </svg>
    );
  }

  if (tierIndex === 15) {
    // Trophy - flat gamified style matching reference
    return (
      <svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* Cup body */}
        <path d="M7 3H17V11C17 13.76 14.76 16 12 16C9.24 16 7 13.76 7 11V3Z" fill="url(#trophy15body)" />
        {/* Left handle */}
        <path d="M7 5H5.5C4.67 5 4 5.67 4 6.5V8.5C4 9.88 5.12 11 6.5 11H7" stroke="#F59E0B" strokeWidth="2" fill="none" />
        {/* Right handle */}
        <path d="M17 5H18.5C19.33 5 20 5.67 20 6.5V8.5C20 9.88 18.88 11 17.5 11H17" stroke="#F59E0B" strokeWidth="2" fill="none" />
        {/* Highlight stripe */}
        <path d="M13 3V11C13 13 12.5 14.5 12 16" stroke="#FDE68A" strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />
        {/* Stem */}
        <rect x="10.5" y="16" width="3" height="2.5" fill="#D97706" />
        {/* Base */}
        <rect x="8" y="18.5" width="8" height="2.5" rx="1" fill="#F59E0B" />
        {/* Base highlight */}
        <rect x="8" y="18.5" width="8" height="1.2" rx="0.6" fill="#FCD34D" opacity="0.5" />
        <defs>
          <linearGradient id="trophy15body" x1="9" y1="3" x2="15" y2="16" gradientUnits="userSpaceOnUse">
            <stop stopColor="#FCD34D" />
            <stop offset="1" stopColor="#F59E0B" />
          </linearGradient>
        </defs>
      </svg>
    );
  }

  if (tierIndex === 20) {
    // Diamond - icy blue / cyan, slightly bigger
    const diamondSize = iconSize + 2;
    return (
      <svg width={diamondSize} height={diamondSize} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 20L3 9L6.5 4H17.5L21 9L12 20Z" fill="url(#diamond20)" />
        <path d="M3 9H21" stroke="#BAE6FD" strokeWidth="0.6" />
        <path d="M12 20L9 9L6.5 4" stroke="#BAE6FD" strokeWidth="0.5" />
        <path d="M12 20L15 9L17.5 4" stroke="#BAE6FD" strokeWidth="0.5" />
        <path d="M12 4V9" stroke="#BAE6FD" strokeWidth="0.5" />
        <path d="M9 9L12 4L15 9" fill="#E0F2FE" fillOpacity="0.6" />
        <defs>
          <linearGradient id="diamond20" x1="12" y1="4" x2="12" y2="20" gradientUnits="userSpaceOnUse">
            <stop stopColor="#67E8F9" />
            <stop offset="0.5" stopColor="#22D3EE" />
            <stop offset="1" stopColor="#0891B2" />
          </linearGradient>
        </defs>
      </svg>
    );
  }

  return null;
};

const AvatarBadge: React.FC<AvatarBadgeProps> = ({ tierIndex, size = 'feed', className }) => {
  const safeTier = Math.max(1, Math.min(20, Math.floor(tierIndex || 1)));
  const label = size === 'profile' ? getRomanNumeral(safeTier) : String(safeTier);
  const theme = getBadgeBandStyle(safeTier);
  const sizing = sizeClasses[size];

  const isInline = sizing.inline;

  const hasShine = !isPrestigeTier(safeTier);
  const starCount = getStarCount(safeTier);
  const hasMilestoneIcon = isMilestoneTier(safeTier);

  const badge = (
    <div
      className={`${isInline ? 'inline-flex' : 'absolute'} ${sizing.wrapper} ${theme.bg} ${theme.text} ${theme.border} ${theme.ring} ${sizing.text} flex items-center justify-center border shadow-md ring-1 font-semibold leading-none rounded-[6px] rounded-b-[10px] ${hasShine ? 'overflow-hidden' : ''} ${className || ''}`}
      aria-label={`Badge tier ${safeTier}`}
      style={hasShine ? { position: 'relative' as const } : undefined}
    >
      {label}
      {hasShine && (
        <>
          <style>{`
            @keyframes badge-shine {
              0% { transform: translateX(-100%) rotate(25deg); }
              100% { transform: translateX(200%) rotate(25deg); }
            }
          `}</style>
          <span
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '50%',
              height: '100%',
              background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.45), transparent)',
              animation: 'badge-shine 2.5s ease-in-out infinite',
              pointerEvents: 'none'
            }}
          />
        </>
      )}
    </div>
  );

  // Milestone tiers (5, 10, 15, 20) get an icon in the top-right
  if (hasMilestoneIcon) {
    const iconOffset = safeTier === 20
      ? (size === 'small' ? { top: -5, right: -4 } : size === 'feed' || size === 'inline' ? { top: -6, right: -5 } : { top: -7, right: -6 })
      : (size === 'small' ? { top: -5, right: -5 } : size === 'feed' || size === 'inline' ? { top: -6, right: -6 } : { top: -7, right: -7 });
    return (
      <div className={`${isInline ? 'inline-flex' : 'absolute'} items-center justify-center`} style={{ position: 'relative' }}>
        {badge}
        <div
          style={{
            position: 'absolute',
            top: iconOffset.top,
            right: iconOffset.right,
            zIndex: 1,
            pointerEvents: 'none',
            filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.25))'
          }}
        >
          <MilestoneIcon tierIndex={safeTier} size={size} />
        </div>
      </div>
    );
  }

  // Star tiers (2-4, 7-9, 12-14, 17-19) get stars above
  if (starCount > 0) {
    return (
      <div className={`${isInline ? 'inline-flex' : 'absolute'} flex-col items-center`} style={{ position: isInline ? undefined : 'absolute' as const }}>
        <div
          className="flex items-center justify-center gap-[1px]"
          style={{
            fontSize: size === 'small' ? '5px' : size === 'feed' || size === 'inline' ? '7px' : '8px',
            marginBottom: 1,
            width: '100%'
          }}
        >
          {Array.from({ length: starCount }, (_, i) => (
            <span key={i} className="text-[#FFC529]" style={{ lineHeight: 1 }}>&#9733;</span>
          ))}
        </div>
        {React.cloneElement(badge as React.ReactElement<{ className?: string }>, {
          className: `inline-flex ${sizing.wrapper} ${theme.bg} ${theme.text} ${theme.border} ${theme.ring} ${sizing.text} flex items-center justify-center border shadow-md ring-1 font-semibold leading-none rounded-[6px] rounded-b-[10px] ${hasShine ? 'overflow-hidden' : ''} ${className || ''}`
        })}
      </div>
    );
  }

  return badge;
};

export default AvatarBadge;
