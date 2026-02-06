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
    const COLLAPSE_AT = 220;
    const EXPAND_AT = 140;

    const handleScroll = () => {
      const scrollY = window.scrollY || document.documentElement.scrollTop || 0;
      setIsCollapsed((prev) => {
        if (prev && scrollY < EXPAND_AT) return false;
        if (!prev && scrollY > COLLAPSE_AT) return true;
        return prev;
      });
    };

    handleScroll();
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
              transition={{ type: 'spring', stiffness: 260, damping: 28, mass: 0.9 }}
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
            transition={{ type: 'spring', stiffness: 320, damping: 28, mass: 0.9 }}
            className="fixed top-2 right-4 z-50"
          >
            <div className="relative">
              <button
                onClick={scrollToTop}
                className="flex items-center gap-2 rounded-full bg-gray-900/95 backdrop-blur-xl px-3 py-1.5 shadow-lg border border-gray-700/50"
              >
                <div className="flex items-center gap-1 text-gray-200 text-xs font-montserrat">
                  <ChevronUp size={14} />
                  <span>Back to top</span>
                </div>
              </button>
              <div className="absolute left-1/2 -top-1.5 h-3 w-3 -translate-x-1/2 rotate-45 bg-gray-900/95 border border-gray-700/50" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default FloatingUserStatsBox;
