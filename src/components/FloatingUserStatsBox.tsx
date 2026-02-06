import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapPinIcon, ChevronUp } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
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
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [avatarError, setAvatarError] = useState(false);
  const placeholderRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleScroll = () => {
      if (placeholderRef.current) {
        const rect = placeholderRef.current.getBoundingClientRect();
        const shouldCollapse = rect.top < 80;
        setIsCollapsed(shouldCollapse);
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const resolvedAvatar = avatar && !avatarError ? avatar : null;

  return (
    <>
      {/* Placeholder to maintain layout space */}
      <div ref={placeholderRef} className="mb-6">
        <AnimatePresence mode="wait">
          {!isCollapsed && (
            <motion.div
              key="expanded"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className={GLASS_CARD_STYLES + ' p-3'}
            >
              {/* Top row: Avatar + Username/Tier | Stacked Pills */}
              <div className="flex items-center justify-between gap-2">
                {/* Left side: Avatar + Username */}
                <div className="flex items-center gap-2">
                  {/* Avatar with Badge */}
                  <div className="relative flex-shrink-0" style={{ width: 48, height: 48 }}>
                    {resolvedAvatar ? (
                      <img
                        src={resolvedAvatar}
                        alt={username}
                        onError={() => setAvatarError(true)}
                        className="h-12 w-12 rounded-full object-cover shadow-md border-2 border-white"
                      />
                    ) : (
                      <div className="h-12 w-12 rounded-full bg-gradient-to-br from-rose-500 to-red-600 text-white flex items-center justify-center font-semibold text-base shadow-md">
                        {username.slice(0, 1).toUpperCase()}
                      </div>
                    )}
                  </div>

                  {/* Username and Tier Name */}
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-gray-900 text-base">{username}</h3>
                      <AvatarBadge tierIndex={tierIndex} size="feed" />
                    </div>
                    <p className="text-sm text-gray-500">{tierName}</p>
                  </div>
                </div>

                {/* Right side: Stacked Stat Pills */}
                <UserStatsPills
                  reviewsCount={reviewsCount}
                  dishesCount={dishesCount}
                  stacked
                />
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
          )}
        </AnimatePresence>
      </div>

      {/* Dynamic Island - Sticky collapsed version */}
      <AnimatePresence>
        {isCollapsed && (
          <motion.div
            key="collapsed"
            initial={{ opacity: 0, y: -20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.9 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            className="fixed top-2 left-1/2 -translate-x-1/2 z-50"
          >
            <button
              onClick={scrollToTop}
              className="flex items-center gap-3 rounded-full bg-gray-900/95 backdrop-blur-xl px-4 py-2 shadow-lg border border-gray-700/50"
            >
              {/* Mini Avatar */}
              <div className="relative" style={{ width: 28, height: 28 }}>
                {resolvedAvatar ? (
                  <img
                    src={resolvedAvatar}
                    alt={username}
                    className="h-7 w-7 rounded-full object-cover border border-white/30"
                  />
                ) : (
                  <div className="h-7 w-7 rounded-full bg-gradient-to-br from-rose-500 to-red-600 text-white flex items-center justify-center text-xs font-semibold">
                    {username.slice(0, 1).toUpperCase()}
                  </div>
                )}
                <div className="absolute -top-0.5 -left-0.5 z-10 scale-75">
                  <AvatarBadge tierIndex={tierIndex} size="small" />
                </div>
              </div>

              {/* Compact Stats */}
              <UserStatsPills
                reviewsCount={reviewsCount}
                dishesCount={dishesCount}
                compact
              />

              {/* Back to top indicator */}
              <div className="flex items-center gap-1 text-gray-400 text-xs font-montserrat">
                <ChevronUp size={14} />
                <span>Top</span>
              </div>
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default FloatingUserStatsBox;
