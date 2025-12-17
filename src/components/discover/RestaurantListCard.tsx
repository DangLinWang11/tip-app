import React from 'react';
import { MapPin, Store } from 'lucide-react';

export type RestaurantCardModel = {
  id: string;
  name: string;
  coverImage: string | null;
  priceText: string | null;
  priceBadge: string | null;
  distanceLabel: string | null;
  subtitleText: string;
  badgeText: string | null;
  badgeColor: string | null;
  limitedRatingsText: string | null;
  reviewCountText: string | null;
  tags?: string[];
  source: 'tip' | 'google';
  restaurantId?: string;
  googlePlaceId?: string;
};

const getQualityColor = (percentage: number): string => {
  if (percentage >= 95) return '#059669';
  if (percentage >= 90) return '#10B981';
  if (percentage >= 85) return '#34D399';
  if (percentage >= 80) return '#6EE7B7';
  if (percentage >= 75) return '#FDE047';
  if (percentage >= 70) return '#FACC15';
  if (percentage >= 65) return '#F59E0B';
  if (percentage >= 60) return '#F97316';
  if (percentage >= 55) return '#FB7185';
  return '#EF4444';
};

interface RestaurantListCardProps {
  card: RestaurantCardModel;
  onClick: () => void;
}

/**
 * Formats tag labels from snake_case to Title Case
 */
const formatTagLabel = (tag: string): string => {
  return tag
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

/**
 * Truncates text in the middle with ellipsis
 * Example: "1234 Main Street, Suite 100" -> "1234 Main St...Suite 100"
 */
const truncateMiddle = (text: string, maxLength: number): string => {
  if (text.length <= maxLength) return text;

  const ellipsis = '...';
  const charsToShow = maxLength - ellipsis.length;
  const frontChars = Math.ceil(charsToShow * 0.6);  // 60% at start
  const backChars = Math.floor(charsToShow * 0.4);  // 40% at end

  return text.substring(0, frontChars) + ellipsis + text.substring(text.length - backChars);
};

const RestaurantListCard: React.FC<RestaurantListCardProps> = ({ card, onClick }) => {
  const [imgError, setImgError] = React.useState(false);
  const [displaySubtitle, setDisplaySubtitle] = React.useState(card.subtitleText);
  const subtitleRef = React.useRef<HTMLSpanElement>(null);

  // Detect if text wraps to multiple lines and truncate
  React.useEffect(() => {
    const element = subtitleRef.current;
    if (!element || !card.subtitleText) return;

    // Reset to original text first
    setDisplaySubtitle(card.subtitleText);

    // Wait for next frame to measure after render
    requestAnimationFrame(() => {
      if (!element) return;

      // Check if text wraps to multiple lines
      const lineHeight = parseInt(getComputedStyle(element).lineHeight);
      const height = element.scrollHeight;
      const lines = Math.round(height / lineHeight);

      if (lines > 1) {
        // Text wraps - apply middle truncation
        // Estimate characters per line based on element width
        const charWidth = 7; // Approximate px per character for text-sm
        const availableWidth = element.clientWidth;
        const charsPerLine = Math.floor(availableWidth / charWidth);
        const maxChars = Math.floor(charsPerLine * 1.5); // 1.5 lines worth

        setDisplaySubtitle(truncateMiddle(card.subtitleText, maxChars));
      }
    });
  }, [card.subtitleText]);

  return (
    <div
      className="bg-white rounded-xl shadow-sm flex items-center overflow-hidden border cursor-pointer hover:bg-gray-50 transition-colors h-[116px]"
      onClick={onClick}
    >
      <div className="relative w-20 h-20 bg-slate-100 flex items-center justify-center flex-shrink-0 rounded-2xl overflow-hidden ml-3">
        {card.coverImage && !imgError ? (
          <img
            src={card.coverImage}
            alt={card.name}
            className="w-full h-full object-cover"
            onError={() => setImgError(true)}
          />
        ) : (
          <Store size={32} className="text-slate-400" />
        )}
        {card.priceBadge && (
          <div className="absolute top-1 left-1 bg-[#EF4444] rounded-full px-1.5 py-0.5 z-10">
            <span className="text-[10px] font-semibold text-white leading-none">{card.priceBadge}</span>
          </div>
        )}
      </div>
      <div className="p-3 flex-1 relative overflow-hidden">
        <div className="flex justify-between items-start gap-2">
          <div className="flex-1 min-w-0 max-w-[calc(100%-70px)]">
            <h3 className="font-medium truncate">{card.name}</h3>
            {(card.limitedRatingsText || card.reviewCountText || (card.tags && card.tags.length > 0)) && (
              <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                {/* Review badge */}
                {(card.limitedRatingsText || card.reviewCountText) && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">
                    {card.reviewCountText || card.limitedRatingsText}
                  </span>
                )}
                {/* Restaurant tags (1-2 most used) */}
                {card.tags && card.tags.length > 0 && card.tags.map(tag => (
                  <span key={tag} className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-600">
                    {formatTagLabel(tag)}
                  </span>
                ))}
              </div>
            )}
          </div>
          <div className="absolute right-3 top-3">
            {card.badgeText && (
              <div
                className="px-2 py-0.5 rounded-full"
                style={{ backgroundColor: card.badgeColor || '#9CA3AF' }}
              >
                <span className="text-xs font-medium text-white">{card.badgeText}</span>
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center justify-between mt-1">
          <div className="flex items-center text-sm text-slate-600 space-x-2 pr-2">
            {card.subtitleText && (
              <span ref={subtitleRef} className="line-clamp-2">
                {displaySubtitle}
              </span>
            )}
            {card.priceText && <span>{card.priceText}</span>}
          </div>
          <div className="flex items-center text-xs text-slate-500">
            <MapPin size={14} className="text-slate-500 mr-1" />
            <span>{card.distanceLabel ?? '-'}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RestaurantListCard;
export { getQualityColor };
