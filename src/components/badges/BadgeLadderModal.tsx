import React from 'react';
import { X, CheckCircle, Lock } from 'lucide-react';
import {
  BADGE_TIERS,
  getBadgeBandStyle,
  getRomanNumeral,
  getTierFromPoints
} from '../../badges/badgeTiers';

export interface BadgeLadderModalProps {
  isOpen: boolean;
  onClose: () => void;
  points?: number | null;
  title?: string;
  subtitle?: string;
}

const BadgeLadderModal: React.FC<BadgeLadderModalProps> = ({
  isOpen,
  onClose,
  points = 0,
  title = 'Your Rank',
  subtitle
}) => {
  if (!isOpen) return null;

  const { tierIndex, tierName, currentMin, nextMin, progress } = getTierFromPoints(points ?? 0);
  const roman = getRomanNumeral(tierIndex);
  const theme = getBadgeBandStyle(tierIndex);
  const progressPercent = Math.round(progress * 100);

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  React.useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    const originalBodyOverflow = document.body.style.overflow;
    const originalHtmlOverflow = document.documentElement.style.overflow;

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = originalBodyOverflow || '';
      document.documentElement.style.overflow = originalHtmlOverflow || '';
    };
  }, [isOpen, onClose]);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 px-2 py-6 sm:px-6"
      onClick={handleBackdropClick}
    >
      <div className="flex w-full flex-col overflow-hidden rounded-2xl bg-white shadow-2xl max-h-[calc(100dvh-8rem)] sm:h-auto sm:max-h-[90dvh] sm:max-w-2xl">
        <div className="flex items-center justify-between border-b border-gray-200 p-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
            {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
          </div>
          <button
            onClick={() => {
              onClose();
            }}
            className="p-2 rounded-full hover:bg-gray-100 transition-colors"
            aria-label="Close badge ladder"
          >
            <X size={20} className="text-gray-600" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
          <div className="rounded-2xl border border-gray-200 bg-gradient-to-br from-white to-gray-50 p-4 shadow-sm">
            <div className="flex items-center gap-4">
              <div
                className={`h-12 w-12 flex items-center justify-center border shadow-md ring-2 ${theme.bg} ${theme.text} ${theme.border} ${theme.ring} rounded-[8px] rounded-b-[14px] text-sm font-semibold`}
              >
                {roman}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs uppercase tracking-wide text-gray-500">Current Tier</p>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-semibold text-gray-900 truncate">{tierName}</h3>
                  <span className="text-xs text-gray-500">Tier {tierIndex}</span>
                </div>
                <p className="text-sm text-gray-600 mt-1">
                  {points?.toLocaleString?.() ?? 0} points
                </p>
              </div>
            </div>

            <div className="mt-4">
              <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                <span>{currentMin.toLocaleString()} pts</span>
                <span>{nextMin ? `${nextMin.toLocaleString()} pts` : 'Max tier'}</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
                <div
                  className="h-full bg-red-500 transition-all"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
                <span>{progressPercent}% to next tier</span>
                {nextMin ? (
                  <span>{Math.max(0, nextMin - (points ?? 0)).toLocaleString()} pts to go</span>
                ) : (
                  <span>Tier 20 reached</span>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-gray-700">Badge Ladder</h4>
            <div className="space-y-2">
              {BADGE_TIERS.map((tier) => {
                const isCurrent = tier.index === tierIndex;
                const isUnlocked = tier.index < tierIndex;
                const isLocked = tier.index > tierIndex;
                const tierTheme = getBadgeBandStyle(tier.index);

                return (
                  <div
                    key={tier.index}
                    className={`flex items-center justify-between rounded-xl border px-3 py-2 transition-colors ${
                      isCurrent
                        ? 'border-primary bg-primary/5'
                        : 'border-gray-200 bg-white'
                    } ${isLocked ? 'opacity-50' : ''}`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`h-8 w-8 flex items-center justify-center border shadow-sm ring-1 ${tierTheme.bg} ${tierTheme.text} ${tierTheme.border} ${tierTheme.ring} rounded-[6px] rounded-b-[10px] text-[10px] font-semibold`}
                      >
                        {getRomanNumeral(tier.index)}
                      </div>
                      <div className="min-w-0">
                        <p className={`text-sm font-medium ${isLocked ? 'text-gray-500' : 'text-gray-900'}`}>
                          {tier.name}
                        </p>
                        <p className="text-[11px] text-gray-500">{tier.minPoints.toLocaleString()} pts</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      {isCurrent && (
                        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                          Current
                        </span>
                      )}
                      {isUnlocked && <CheckCircle size={16} className="text-emerald-500" />}
                      {isLocked && <Lock size={14} className="text-gray-400" />}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BadgeLadderModal;
