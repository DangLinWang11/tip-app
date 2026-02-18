import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { CoachMarkLayer } from './CoachMarkLayer';
import { getCompleted, setCompleted, setHomeFeaturedHidden } from './tourStorage';
import { tourSteps } from './tourSteps';
import type { TourId } from './types';

interface TourContextValue {
  activeTourId: TourId | null;
  stepIndex: number;
  isOpen: boolean;
  startTour: (tourId: TourId) => void;
  next: () => void;
  back: () => void;
  skip: () => void;
  complete: () => void;
  isTourCompleted: (tourId: TourId) => boolean;
  isTourRunning: boolean;
}

const TourContext = createContext<TourContextValue | undefined>(undefined);

export const TourProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeTourId, setActiveTourId] = useState<TourId | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [isOpen, setIsOpen] = useState(false);

  const isTourCompleted = useCallback((tourId: TourId) => getCompleted(tourId), []);

  const startTour = useCallback((tourId: TourId) => {
    const tour = tourSteps[tourId];
    if (!tour || tour.steps.length === 0) return;
    setActiveTourId(tourId);
    setStepIndex(0);
    setIsOpen(true);
  }, []);

  const next = useCallback(() => {
    setStepIndex((prev) => prev + 1);
  }, []);

  const back = useCallback(() => {
    setStepIndex((prev) => Math.max(0, prev - 1));
  }, []);

  const skip = useCallback(() => {
    if (activeTourId) setCompleted(activeTourId);
    setIsOpen(false);
    setActiveTourId(null);
    setStepIndex(0);
  }, [activeTourId]);

  const complete = useCallback(() => {
    if (activeTourId) {
      setCompleted(activeTourId);
      if (activeTourId === 'home') {
        setHomeFeaturedHidden();
      }
    }
    setIsOpen(false);
    setActiveTourId(null);
    setStepIndex(0);
  }, [activeTourId]);

  const isTourRunning = isOpen && Boolean(activeTourId);

  const value = useMemo<TourContextValue>(() => ({
    activeTourId,
    stepIndex,
    isOpen,
    startTour,
    next,
    back,
    skip,
    complete,
    isTourCompleted,
    isTourRunning,
  }), [
    activeTourId,
    stepIndex,
    isOpen,
    startTour,
    next,
    back,
    skip,
    complete,
    isTourCompleted,
    isTourRunning,
  ]);

  return (
    <TourContext.Provider value={value}>
      {children}
      <CoachMarkLayer />
    </TourContext.Provider>
  );
};

export const useTour = (): TourContextValue => {
  const ctx = useContext(TourContext);
  if (!ctx) {
    throw new Error('useTour must be used within TourProvider');
  }
  return ctx;
};

export const useAutoStartTour = (
  tourId: TourId,
  enabledCondition: boolean
): void => {
  const { startTour, isTourCompleted, isTourRunning, activeTourId } = useTour();
  const hasStartedRef = React.useRef(false);

  React.useEffect(() => {
    if (!enabledCondition) {
      hasStartedRef.current = false;
      return;
    }
    if (isTourRunning) return;
    if (activeTourId && activeTourId !== tourId) return;
    if (isTourCompleted(tourId)) return;
    if (hasStartedRef.current) return;
    hasStartedRef.current = true;
    startTour(tourId);
  }, [enabledCondition, isTourCompleted, isTourRunning, activeTourId, tourId, startTour]);
};
