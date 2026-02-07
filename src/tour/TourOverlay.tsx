import React from 'react';

interface TourOverlayProps {
  spotlightRect?: DOMRect | null;
  spotlightPadding?: number;
  blockInteraction?: boolean;
}

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export const TourOverlay: React.FC<TourOverlayProps> = ({
  spotlightRect,
  spotlightPadding = 8,
  blockInteraction = true,
}) => {
  const padding = Math.max(0, spotlightPadding);

  const rect = spotlightRect
    ? {
        x: Math.round(spotlightRect.x - padding),
        y: Math.round(spotlightRect.y - padding),
        width: Math.round(spotlightRect.width + padding * 2),
        height: Math.round(spotlightRect.height + padding * 2),
        r: 14,
      }
    : null;

  const viewWidth = typeof window !== 'undefined' ? window.innerWidth : 0;
  const viewHeight = typeof window !== 'undefined' ? window.innerHeight : 0;

  const maskId = 'tour-spotlight-mask';
  const safeX = rect ? clamp(rect.x, 0, Math.max(0, viewWidth - rect.width)) : 0;
  const safeY = rect ? clamp(rect.y, 0, Math.max(0, viewHeight - rect.height)) : 0;

  return (
    <div
      className="fixed inset-0"
      style={{ pointerEvents: blockInteraction ? 'auto' : 'none' }}
      aria-hidden="true"
    >
      <svg
        className="w-full h-full"
        viewBox={`0 0 ${viewWidth} ${viewHeight}`}
        preserveAspectRatio="none"
      >
        <defs>
          <mask id={maskId}>
            <rect width="100%" height="100%" fill="white" />
            {rect && (
              <rect
                x={safeX}
                y={safeY}
                width={rect.width}
                height={rect.height}
                rx={rect.r}
                ry={rect.r}
                fill="black"
              />
            )}
          </mask>
        </defs>
        <rect
          width="100%"
          height="100%"
          fill="rgba(15, 23, 42, 0.55)"
          mask={`url(#${maskId})`}
        />
      </svg>
    </div>
  );
};
