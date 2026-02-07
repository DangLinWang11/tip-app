import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  arrow,
  autoUpdate,
  flip,
  offset,
  shift,
  useFloating,
} from '@floating-ui/react';
import { CoachTooltip } from './CoachTooltip';
import { TourOverlay } from './TourOverlay';
import { tourSteps } from './tourSteps';
import { useTour } from './TourProvider';
import { useLocation, useNavigate } from 'react-router-dom';
import type { TourStep } from './types';

const waitForElement = (
  selector: string,
  timeoutMs = 2500
): Promise<HTMLElement | null> => {
  if (typeof document === 'undefined') return Promise.resolve(null);

  const existing = document.querySelector(selector) as HTMLElement | null;
  if (existing) return Promise.resolve(existing);

  return new Promise((resolve) => {
    const observer = new MutationObserver(() => {
      const found = document.querySelector(selector) as HTMLElement | null;
      if (found) {
        observer.disconnect();
        resolve(found);
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });

    const timeout = window.setTimeout(() => {
      observer.disconnect();
      resolve(null);
    }, timeoutMs);

    return () => window.clearTimeout(timeout);
  });
};

const scrollIntoViewIfNeeded = (target: HTMLElement) => {
  try {
    target.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'smooth' });
  } catch {
    // no-op
  }
};

export const CoachMarkLayer: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { activeTourId, stepIndex, isOpen, next, back, skip, complete } = useTour();
  const tour = activeTourId ? tourSteps[activeTourId] : null;
  const step: TourStep | null = tour ? tour.steps[stepIndex] : null;

  const [targetEl, setTargetEl] = useState<HTMLElement | null>(null);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const arrowRef = useRef<HTMLDivElement | null>(null);

  const placement = step?.placement ?? 'bottom';

  const { refs, floatingStyles, middlewareData, update, placement: resolvedPlacement } = useFloating({
    placement,
    middleware: [
      offset(10),
      flip({ padding: 12 }),
      shift({ padding: 12 }),
      arrow({ element: arrowRef, padding: 8 }),
    ],
    whileElementsMounted: autoUpdate,
  });

  const arrowStyle = useMemo(() => {
    const { x, y } = middlewareData.arrow || {};
    const basePlacement = (resolvedPlacement || placement).split('-')[0];
    const staticSide = {
      top: 'bottom',
      right: 'left',
      bottom: 'top',
      left: 'right',
    }[basePlacement] as 'top' | 'right' | 'bottom' | 'left';

    return {
      left: x != null ? `${x}px` : '',
      top: y != null ? `${y}px` : '',
      [staticSide]: '-6px',
    } as React.CSSProperties;
  }, [middlewareData.arrow, placement, resolvedPlacement]);

  useEffect(() => {
    if (!step || !isOpen) {
      setTargetEl(null);
      setTargetRect(null);
      return;
    }

    let cancelled = false;

    const resolveTarget = async () => {
      const found = await waitForElement(step.selector);
      if (cancelled) return;

      if (!found) {
        if (tour && stepIndex < tour.steps.length - 1) {
          next();
        } else {
          complete();
        }
        return;
      }

      scrollIntoViewIfNeeded(found);
      window.setTimeout(() => {
        if (cancelled) return;
        setTargetEl(found);
        setTargetRect(found.getBoundingClientRect());
        refs.setReference(found);
      }, 220);
    };

    resolveTarget();

    return () => {
      cancelled = true;
    };
  }, [step, isOpen, refs, next, complete, stepIndex, tour]);

  useEffect(() => {
    if (!targetEl || !refs.floating.current) return;

    return autoUpdate(targetEl, refs.floating.current, () => {
      update();
      setTargetRect(targetEl.getBoundingClientRect());
    });
  }, [targetEl, refs, update]);

  const routeOk = (() => {
    if (!activeTourId) return false;
    const path = location.pathname;
    if (activeTourId === 'home') {
      if (path === '/') return true;
      return path === '/list-view' && step?.id === 'home-recent-visits-page';
    }
    if (activeTourId === 'profile') return path === '/profile';
    if (activeTourId === 'create_step2' || activeTourId === 'create_step3') return path.startsWith('/create');
    if (activeTourId === 'map_demo') return path === '/food-map' || path === '/list-view';
    return true;
  })();

  if (!isOpen || !step || typeof document === 'undefined' || !routeOk) return null;

  const handleNext = () => {
    if (activeTourId === 'home' && step.id === 'home-recent-visits-page') {
      navigate('/');
      window.setTimeout(() => {
        next();
      }, 200);
      return;
    }
    if (stepIndex === tour.steps.length - 1) {
      complete();
    } else {
      next();
    }
  };

  const overlay = (
    <div className="fixed inset-0 z-[9999]">
      <TourOverlay
        spotlightRect={targetRect}
        spotlightPadding={step.spotlightPadding ?? 8}
        blockInteraction={step.blockInteraction ?? true}
      />
      <div className="fixed inset-0 pointer-events-none">
        <div
          ref={refs.setFloating}
          style={floatingStyles}
          className="pointer-events-auto"
        >
          <div className="relative">
            <CoachTooltip
              title={step.title}
              body={step.body}
              stepIndex={stepIndex}
              totalSteps={tour.steps.length}
              canGoBack={stepIndex > 0}
              isLast={stepIndex === tour.steps.length - 1}
              onBack={back}
              onNext={handleNext}
              onSkip={skip}
            />
            <div
              ref={arrowRef}
              className="absolute h-3 w-3 rotate-45 bg-white border border-white/70 shadow-none"
              style={arrowStyle}
            />
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(overlay, document.body);
};
