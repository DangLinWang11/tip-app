import { useState, useCallback, useEffect } from 'react';

const ONBOARDING_STORAGE_KEY = 'tip.onboarding.dismissed';

/**
 * Hook for managing dismissable onboarding tooltip states.
 * Persists dismissed tooltip IDs to localStorage.
 */
export function useOnboardingState() {
  const [dismissed, setDismissed] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem(ONBOARDING_STORAGE_KEY);
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch {
      return new Set();
    }
  });

  // Sync to localStorage whenever dismissed changes
  useEffect(() => {
    try {
      localStorage.setItem(ONBOARDING_STORAGE_KEY, JSON.stringify([...dismissed]));
    } catch {
      // Ignore storage errors
    }
  }, [dismissed]);

  const dismiss = useCallback((id: string) => {
    setDismissed((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }, []);

  const isDismissed = useCallback((id: string) => dismissed.has(id), [dismissed]);

  const reset = useCallback(() => {
    localStorage.removeItem(ONBOARDING_STORAGE_KEY);
    setDismissed(new Set());
  }, []);

  return { dismiss, isDismissed, reset, dismissedIds: dismissed };
}

export default useOnboardingState;
