import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  timeoutMs = 4000
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

export const CoachMarkLayer: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { activeTourId, stepIndex, isOpen, next, back, skip, complete } = useTour();
  const tour = activeTourId ? tourSteps[activeTourId] : null;
  const step: TourStep | null = tour ? tour.steps[stepIndex] : null;

  const [targetEl, setTargetEl] = useState<HTMLElement | null>(null);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const arrowRef = useRef<HTMLDivElement | null>(null);
  const scrollLockRef = useRef<{
    bodyOverflow: string;
    bodyTouchAction: string;
    htmlOverflow: string;
    htmlOverscrollBehavior: string;
  } | null>(null);
  const allowScrollLockRef = useRef(false);
  const scrollAssistRef = useRef<{
    cleanup: () => void;
    resolve?: () => void;
  } | null>(null);

  const placement = step?.placement ?? 'bottom';

  const offsetValue =
    step?.id === 'home-recent-visits-card' || step?.id === 'home-profile-photo'
      ? 16
      : step?.id === 'home-stats-box'
        ? 19
        : step?.id === 'home-menu-item'
          ? 27
          : step?.id === 'home-profile-restaurant'
            ? 14
            : 10;
  const shouldFlip = step?.id !== 'home-menu-item';
  const { refs, floatingStyles, middlewareData, update, placement: resolvedPlacement } = useFloating({
    placement,
    middleware: [
      offset(offsetValue),
      shouldFlip ? flip({ padding: 12 }) : undefined,
      shift({ padding: 12 }),
      arrow({ element: arrowRef, padding: 8 }),
    ].filter(Boolean) as any,
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

  const lockScroll = useCallback(() => {
    if (typeof document === 'undefined') return;
    if (!allowScrollLockRef.current) return;
    if (scrollLockRef.current) return;

    const { body, documentElement } = document;
    scrollLockRef.current = {
      bodyOverflow: body.style.overflow,
      bodyTouchAction: body.style.touchAction,
      htmlOverflow: documentElement.style.overflow,
      htmlOverscrollBehavior: documentElement.style.overscrollBehavior,
    };

    body.style.overflow = 'hidden';
    body.style.touchAction = 'none';
    documentElement.style.overflow = 'hidden';
    documentElement.style.overscrollBehavior = 'none';
  }, []);

  const unlockScroll = useCallback(() => {
    if (typeof document === 'undefined') return;
    if (!scrollLockRef.current) return;

    const { body, documentElement } = document;
    const prev = scrollLockRef.current;
    scrollLockRef.current = null;

    body.style.overflow = prev.bodyOverflow;
    body.style.touchAction = prev.bodyTouchAction;
    documentElement.style.overflow = prev.htmlOverflow;
    documentElement.style.overscrollBehavior = prev.htmlOverscrollBehavior;
  }, []);

  const hardUnlockScroll = useCallback(() => {
    if (typeof document === 'undefined') return;
    const { body, documentElement } = document;
    body.style.overflow = '';
    body.style.touchAction = '';
    documentElement.style.overflow = '';
    documentElement.style.overscrollBehavior = '';
    scrollLockRef.current = null;
  }, []);

  const forceUnlockScroll = useCallback(() => {
    if (scrollAssistRef.current) {
      scrollAssistRef.current.cleanup();
      scrollAssistRef.current.resolve?.();
      scrollAssistRef.current = null;
    }
    unlockScroll();
    hardUnlockScroll();
  }, [hardUnlockScroll, unlockScroll]);

  const scrollIntoViewIfNeeded = useCallback(
    (target: HTMLElement): Promise<void> => {
      try {
        const shouldBlock = step?.blockInteraction ?? true;
        const rect = target.getBoundingClientRect();
        const viewHeight = window.innerHeight || 0;
        const margin = 24;
        const needsScroll = rect.top < margin || rect.bottom > viewHeight - margin;
        if (!needsScroll) return Promise.resolve();
        const useInstantScroll = step?.id === 'home-menu-item';

        const minOffset = 120;
        const offset = Math.max(minOffset, (viewHeight - rect.height) / 2);
        const desiredTop = Math.max(0, rect.top + window.scrollY - offset);

        if (shouldBlock) {
          if (scrollAssistRef.current) {
            scrollAssistRef.current.cleanup();
            scrollAssistRef.current.resolve?.();
            scrollAssistRef.current = null;
          }

          unlockScroll();

          if (useInstantScroll) {
            window.scrollTo({ top: desiredTop, behavior: 'auto' });
            if (allowScrollLockRef.current) {
              lockScroll();
            }
            return new Promise((resolve) => {
              requestAnimationFrame(() => {
                requestAnimationFrame(resolve);
              });
            });
          }

          return new Promise((resolve) => {
            const requestScroll = () => {
              target.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'smooth' });
            };

            requestAnimationFrame(() => {
              requestScroll();
            });

            let maxTimeout: number | null = null;
            let idleTimeout: number | null = null;

            const finish = () => {
              if (idleTimeout) window.clearTimeout(idleTimeout);
              if (maxTimeout) window.clearTimeout(maxTimeout);
              window.removeEventListener('scroll', onScroll);
              if (allowScrollLockRef.current) {
                lockScroll();
              }
              scrollAssistRef.current = null;
              resolve();
            };

            const onScroll = () => {
              if (idleTimeout) window.clearTimeout(idleTimeout);
              idleTimeout = window.setTimeout(finish, 180);
            };

            window.addEventListener('scroll', onScroll, { passive: true });
            maxTimeout = window.setTimeout(finish, 1400);

            scrollAssistRef.current = {
              cleanup: () => {
                if (idleTimeout) window.clearTimeout(idleTimeout);
                if (maxTimeout) window.clearTimeout(maxTimeout);
                window.removeEventListener('scroll', onScroll);
              },
              resolve,
            };
          });
        }
        if (useInstantScroll) {
          window.scrollTo({ top: desiredTop, behavior: 'auto' });
          return new Promise((resolve) => {
            requestAnimationFrame(() => {
              requestAnimationFrame(resolve);
            });
          });
        }
        return new Promise((resolve) => {
          target.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'smooth' });
          let maxTimeout: number | null = null;
          let idleTimeout: number | null = null;

          const finish = () => {
            if (idleTimeout) window.clearTimeout(idleTimeout);
            if (maxTimeout) window.clearTimeout(maxTimeout);
            window.removeEventListener('scroll', onScroll);
            resolve();
          };

          const onScroll = () => {
            if (idleTimeout) window.clearTimeout(idleTimeout);
            idleTimeout = window.setTimeout(finish, 180);
          };

          window.addEventListener('scroll', onScroll, { passive: true });
          maxTimeout = window.setTimeout(finish, 1000);
        });
      } catch {
        // no-op
        return Promise.resolve();
      }
    },
    [lockScroll, step?.blockInteraction, unlockScroll]
  );

  useEffect(() => {
    if (!step || !isOpen) {
      setTargetEl(null);
      setTargetRect(null);
      return;
    }

    let cancelled = false;

    // Check if the new target already exists in the DOM (same-page transition).
    // If so, keep the old spotlight visible so the CSS transition can animate
    // smoothly from the old position to the new one.
    const immediateTarget = document.querySelector(step.selector) as HTMLElement | null;
    if (!immediateTarget || step.id === 'home-menu-item') {
      // Cross-page transition — element doesn't exist yet, clear old target
      setTargetEl(null);
      setTargetRect(null);
    }

    const resolveTarget = async () => {
      const found = immediateTarget || await waitForElement(step.selector);
      if (cancelled) return;

      if (!found) {
        if (tour && stepIndex < tour.steps.length - 1) {
          next();
        } else {
          complete();
        }
        return;
      }

      await scrollIntoViewIfNeeded(found);

      // Wait a frame after scroll to get the settled position
      requestAnimationFrame(() => {
        if (cancelled) return;
        setTargetEl(found);
        setTargetRect(found.getBoundingClientRect());
        refs.setReference(found);
      });
    };

    resolveTarget();

    return () => {
      cancelled = true;
    };
  }, [step, isOpen, refs, next, complete, stepIndex, tour, scrollIntoViewIfNeeded]);

  useEffect(() => {
    if (!targetEl || !refs.floating.current) return;

    return autoUpdate(targetEl, refs.floating.current, () => {
      update();
      setTargetRect(targetEl.getBoundingClientRect());
    });
  }, [targetEl, refs, update]);

  useEffect(() => {
    return () => {
      if (scrollAssistRef.current) {
        scrollAssistRef.current.cleanup();
        scrollAssistRef.current.resolve?.();
        scrollAssistRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (isOpen) {
      allowScrollLockRef.current = true;
      return;
    }
    allowScrollLockRef.current = false;
    hardUnlockScroll();
    forceUnlockScroll();
  }, [isOpen, forceUnlockScroll, hardUnlockScroll]);

  useEffect(() => {
    const shouldBlock = isOpen && !!step && (step.blockInteraction ?? true);
    if (!shouldBlock) return;
    lockScroll();
    return () => {
      unlockScroll();
    };
  }, [isOpen, lockScroll, step, unlockScroll]);

  const routeOk = (() => {
    if (!activeTourId) return false;
    const path = location.pathname;
    if (activeTourId === 'home') {
      if (path === '/') return !step?.id?.startsWith('home-recent-visits');
      return path === '/list-view' && step?.id?.startsWith('home-recent-visits');
    }
    if (activeTourId === 'profile') return path === '/profile';
    if (activeTourId === 'create_step2' || activeTourId === 'create_step3') return path.startsWith('/create');
    if (activeTourId === 'map_demo') return path === '/food-map' || path === '/list-view';
    return true;
  })();

  // Don't render anything if tour isn't active or route doesn't match.
  // Also wait until target element is found to avoid a flash of dark overlay with no spotlight.
  if (!isOpen || !step || typeof document === 'undefined' || !routeOk || !targetEl) return null;

  const handleBack = () => {
    const prevStep = tour.steps[stepIndex - 1];
    if (activeTourId === 'home' && prevStep) {
      const targetPath = prevStep.id.startsWith('home-recent-visits') ? '/list-view' : '/';
      if (location.pathname !== targetPath) {
        navigate(targetPath);
        window.setTimeout(() => {
          back();
        }, 200);
        return;
      }
    }
    back();
  };

  const handleNext = () => {
    if (activeTourId === 'home' && step.id === 'home-stats-box' && location.pathname === '/') {
      // Navigate to Recent Visits; FoodMap will advance to the next step on /list-view.
      navigate('/list-view');
      return;
    }
    if (activeTourId === 'home' && step.id === 'home-recent-visits-card') {
      navigate('/');
      window.setTimeout(() => {
        next();
      }, 80);
      return;
    }
    if (stepIndex === tour.steps.length - 1) {
      if (activeTourId === 'home' && location.pathname === '/') {
        hardUnlockScroll();
        forceUnlockScroll();
        requestAnimationFrame(() => {
          window.scrollTo({ top: 0, behavior: 'smooth' });
        });
      }
      complete();
    } else {
      next();
    }
  };

  const displayStepIndex = stepIndex;
  const displayTotalSteps = tour.steps.length;

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
          style={{ ...floatingStyles, transition: 'transform 300ms ease-out' }}
          className="pointer-events-auto"
        >
          <CoachTooltip
            title={step.title}
            body={step.body}
            stepIndex={stepIndex}
            totalSteps={tour.steps.length}
            displayStepIndex={displayStepIndex}
            displayTotalSteps={displayTotalSteps}
            canGoBack={stepIndex > 0}
            isLast={stepIndex === tour.steps.length - 1}
            onBack={handleBack}
            onNext={handleNext}
            onSkip={skip}
            arrowRef={arrowRef}
            arrowStyle={arrowStyle}
          />
        </div>
      </div>
    </div>
  );

  return createPortal(overlay, document.body);
};
