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

  const viewWidth = typeof window !== 'undefined' ? window.innerWidth : 0;
  const viewHeight = typeof window !== 'undefined' ? window.innerHeight : 0;

  const rect = spotlightRect
    ? {
        x: clamp(
          Math.round(spotlightRect.x - padding),
          0,
          Math.max(0, viewWidth - Math.round(spotlightRect.width + padding * 2))
        ),
        y: clamp(
          Math.round(spotlightRect.y - padding),
          0,
          Math.max(0, viewHeight - Math.round(spotlightRect.height + padding * 2))
        ),
        width: Math.round(spotlightRect.width + padding * 2),
        height: Math.round(spotlightRect.height + padding * 2),
        r: 14,
      }
    : null;

  const handleBlockEvent = (event: React.SyntheticEvent) => {
    event.preventDefault();
    event.stopPropagation();
  };

  return (
    <div
      className="fixed inset-0"
      style={{
        pointerEvents: blockInteraction ? 'auto' : 'none',
        touchAction: blockInteraction ? 'none' : 'auto',
        overscrollBehavior: blockInteraction ? 'none' : 'auto',
      }}
      aria-hidden="true"
      onWheel={blockInteraction ? handleBlockEvent : undefined}
      onTouchMove={blockInteraction ? handleBlockEvent : undefined}
    >
      {rect && (
        <div
          style={{
            position: 'fixed',
            left: rect.x,
            top: rect.y,
            width: rect.width,
            height: rect.height,
            borderRadius: rect.r,
            boxShadow: '0 0 0 9999px rgba(15, 23, 42, 0.55)',
            pointerEvents: 'none',
            transition: 'left 300ms ease-out, top 300ms ease-out, width 300ms ease-out, height 300ms ease-out',
          }}
        />
      )}
    </div>
  );
};
