import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapPinIcon } from 'lucide-react';
import { motion } from 'framer-motion';
import AvatarBadge from './badges/AvatarBadge';
import UserStatsPills from './UserStatsPills';

interface FloatingUserStatsBoxProps {
  avatar?: string | null;
  username: string;
  tierIndex: number;
  tierName: string;
  reviewsCount: number;
  dishesCount: number;
}

const GLASS_CARD_STYLES = 'rounded-3xl bg-white/92 backdrop-blur-xl shadow-[0_20px_40px_rgba(15,23,42,0.2)] border border-white/70';

const FloatingUserStatsBox: React.FC<FloatingUserStatsBoxProps> = ({
  avatar,
  username,
  tierIndex,
  tierName,
  reviewsCount,
  dishesCount
}) => {
  const navigate = useNavigate();
  const [avatarError, setAvatarError] = useState(false);
  const displayName = username?.trim() || 'You';
  const displayTierName = tierName?.trim();

  const resolvedAvatar = avatar && !avatarError ? avatar : null;

  return (
    <div className="mb-6" data-tour="home-stats-box">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 260, damping: 28, mass: 0.9 }}
        data-tour="home-stats-box"
        className={GLASS_CARD_STYLES + ' p-3'}
      >
        {/* Top row: Avatar + Username/Tier | Stacked Pills */}
        <div className="flex items-center justify-between gap-2">
          {/* Left side: Avatar + Username - min-w-0 allows truncation */}
          <div className="flex items-center gap-2 min-w-0 flex-1">
            {/* Avatar with Badge */}
            <div className="relative flex-shrink-0" style={{ width: 48, height: 48 }}>
              {resolvedAvatar ? (
                <img
                  src={resolvedAvatar}
                  alt={displayName}
                  onError={() => setAvatarError(true)}
                  className="h-12 w-12 rounded-full object-cover shadow-md border-2 border-white"
                />
              ) : (
                <div className="h-12 w-12 rounded-full bg-gradient-to-br from-rose-500 to-red-600 text-white flex items-center justify-center font-semibold text-base shadow-md">
                  {displayName.slice(0, 1).toUpperCase()}
                </div>
              )}
            </div>

            {/* Username and Tier Name - min-w-0 allows text truncation */}
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-gray-900 text-base max-w-[120px] truncate">{displayName}</h3>
                <AvatarBadge tierIndex={tierIndex} size="feed" className="flex-shrink-0" />
              </div>
              {displayTierName ? (
                <p className="text-sm text-gray-500 truncate">{displayTierName}</p>
              ) : null}
            </div>
          </div>

          {/* Right side: Stacked Stat Pills - flex-shrink-0 keeps pills fixed */}
          <div className="flex-shrink-0">
            <UserStatsPills
              reviewsCount={reviewsCount}
              dishesCount={dishesCount}
              stacked
            />
          </div>
        </div>

        {/* Bottom row: Recent Visits Button centered */}
        <div className="flex justify-center mt-3">
          <button
            onClick={() => navigate('/list-view')}
            className="flex items-center gap-1.5 bg-white rounded-full border border-gray-200 px-4 py-2 shadow-sm hover:shadow-md transition-all duration-200"
          >
            <MapPinIcon size={16} className="text-secondary" />
            <span className="text-sm font-medium text-gray-900">Recent Visits</span>
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default FloatingUserStatsBox;
