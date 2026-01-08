import React from 'react';
import { MapPin, Store } from 'lucide-react';
import { ATTRIBUTES, DIETARY, OCCASIONS } from '../../data/tagDefinitions';

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
  serviceSpeedLabel?: string | null;
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
 * Converts snake_case to Title Case
 */
const formatSnakeCase = (str: string): string => {
  return str
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

/**
 * Gets the proper display label for a tag by handling prefixes and looking up definitions
 */
const getTagLabel = (tag: string): string => {
  // Handle prefixed tags
  if (tag.startsWith('attr_')) {
    const attrValue = tag.replace('attr_', '');
    const attr = ATTRIBUTES.find(a => a.value === attrValue);
    return attr?.label || formatSnakeCase(attrValue);
  }

  if (tag.startsWith('meal_')) {
    const mealValue = tag.replace('meal_', '');
    return formatSnakeCase(mealValue); // "breakfast", "lunch", "dinner"
  }

  if (tag.startsWith('dietary_')) {
    const dietValue = tag.replace('dietary_', '');
    const diet = DIETARY.find(d => d.value === dietValue);
    return diet?.label || formatSnakeCase(dietValue);
  }

  if (tag.startsWith('occasion_')) {
    const occValue = tag.replace('occasion_', '');
    const occ = OCCASIONS.find(o => o.value === occValue);
    return occ?.label || formatSnakeCase(occValue);
  }

  if (tag.startsWith('service_')) {
    const serviceValue = tag.replace('service_', '');
    return formatSnakeCase(serviceValue); // "Fast", "Normal", "Slow"
  }

  // Fallback for non-prefixed tags
  return formatSnakeCase(tag);
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

  // Calculate dynamic badge dimensions based on price level
  const getBadgeDimensions = (priceText: string | null) => {
    if (!priceText) return { width: 'auto', height: 'auto', borderRadius: '9999px' };

    const dollarCount = priceText.length;
    // Width increases with more dollar signs, height stays consistent
    // $ -> 18px width (nearly circular)
    // $$ -> 24px width (slightly elongated)
    // $$$ -> 30px width (more elongated)
    // $$$$ -> 36px width (most elongated)
    const width = 12 + (dollarCount * 6); // 18, 24, 30, 36
    const height = 18; // Consistent height

    return {
      width: `${width}px`,
      height: `${height}px`,
      borderRadius: '9999px' // Fully rounded ends
    };
  };

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
      className="bg-white rounded-xl shadow-sm flex items-center overflow-hidden border cursor-pointer hover:bg-gray-50 transition-colors h-[100px]"
      onClick={onClick}
    >
      <div className="relative w-16 h-16 flex-shrink-0 ml-2">
        <div className="w-full h-full bg-slate-100 flex items-center justify-center rounded-2xl overflow-hidden">
          {card.coverImage && !imgError ? (
            <img
              src={card.coverImage}
              alt={card.name}
              className="w-full h-full object-cover"
              onError={() => setImgError(true)}
            />
          ) : (
            <Store size={28} className="text-slate-400" />
          )}
        </div>
        {card.priceBadge && (
          <div
            className="absolute top-0 -left-0.5 bg-[#EF4444] z-10 flex items-center justify-center shadow-sm"
            style={getBadgeDimensions(card.priceBadge)}
          >
            <span className="text-[10px] font-semibold text-white leading-none">{card.priceBadge}</span>
          </div>
        )}
      </div>
      <div className="px-2.5 py-2 flex-1 relative overflow-hidden flex flex-col h-full">
        <div className="flex justify-between items-start gap-2">
          <div className="flex-1 min-w-0 max-w-[calc(100%-50px)]">
            <h3 className="font-medium text-[15px] truncate leading-tight">{card.name}</h3>
            {/* Mileage and review count row */}
            <div className="mt-0.5 flex items-center gap-1.5 flex-wrap">
              <div className="flex items-center text-xs text-slate-500">
                <MapPin size={12} className="text-slate-500 mr-0.5" />
                <span>{card.distanceLabel ?? '-'}</span>
              </div>
              {/* Restaurant tags (for Tip restaurants) - shown before review badge */}
              {card.source === 'tip' && card.tags && card.tags.length > 0 && card.tags.slice(0, 2).map(tag => (
                <span key={tag} className="inline-flex items-center rounded-full bg-slate-100 px-1.5 py-0.5 text-[9px] text-slate-600 whitespace-nowrap">
                  {getTagLabel(tag)}
                </span>
              ))}
              {/* Review badge */}
              {(card.limitedRatingsText || card.reviewCountText) && (
                <span className="inline-flex items-center rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600">
                  {card.reviewCountText || card.limitedRatingsText}
                </span>
              )}
            </div>
            {/* Address line with truncation - moved inside the main content area */}
            <div className="mt-0.5">
              {card.subtitleText && (
                <span className="text-xs text-slate-600 truncate block">
                  {displaySubtitle}
                </span>
              )}
            </div>
          </div>
          <div className="absolute right-2 top-2">
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

        {/* Bottom right: Only source badges (Visited/New to You) */}
        <div className="flex items-center justify-end mt-auto">
          <div className="flex items-center gap-1 flex-shrink-0">
            {/* Source badge - show for Google Places */}
            {card.source === 'google' && (
              <span className="inline-flex items-center rounded-full bg-blue-50 px-1.5 py-0.5 text-[9px] text-blue-700 font-semibold whitespace-nowrap">
                New to You
              </span>
            )}
            {/* Source badge - show for Visited restaurants */}
            {card.source === 'tip' && (
              <span className="inline-flex items-center rounded-full bg-green-50 px-1.5 py-0.5 text-[9px] text-green-700 font-semibold whitespace-nowrap">
                Visited
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default RestaurantListCard;
export { getQualityColor };
