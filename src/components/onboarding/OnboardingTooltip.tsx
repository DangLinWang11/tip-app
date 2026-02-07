import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { useOnboardingState } from '../../hooks/useOnboardingState';

interface OnboardingTooltipProps {
  /** Unique identifier for this tooltip - used for persistence */
  id: string;
  /** Content to display in the tooltip */
  children: React.ReactNode;
  /** Whether the tooltip should be visible (beyond dismiss state) */
  show?: boolean;
  /** Callback when dismissed */
  onDismiss?: () => void;
  /** Additional CSS classes */
  className?: string;
  /** Position styling - use Tailwind classes like "absolute top-4 left-4" */
  position?: string;
  /** Whether to show the arrow pointer */
  showArrow?: boolean;
  /** Arrow direction */
  arrowDirection?: 'up' | 'down' | 'left' | 'right';
}

/**
 * Dismissable onboarding tooltip with glass-morphism styling.
 * Automatically persists dismissed state to localStorage.
 */
export function OnboardingTooltip({
  id,
  children,
  show = true,
  onDismiss,
  className = '',
  position = '',
  showArrow = false,
  arrowDirection = 'up',
}: OnboardingTooltipProps) {
  const { dismiss, isDismissed } = useOnboardingState();

  const handleDismiss = () => {
    dismiss(id);
    onDismiss?.();
  };

  // Don't render if already dismissed or not meant to show
  if (isDismissed(id) || !show) {
    return null;
  }

  const arrowClasses = {
    up: 'bottom-full left-1/2 -translate-x-1/2 border-l-transparent border-r-transparent border-t-transparent border-b-white/95',
    down: 'top-full left-1/2 -translate-x-1/2 border-l-transparent border-r-transparent border-b-transparent border-t-white/95',
    left: 'right-full top-1/2 -translate-y-1/2 border-t-transparent border-b-transparent border-l-transparent border-r-white/95',
    right: 'left-full top-1/2 -translate-y-1/2 border-t-transparent border-b-transparent border-r-transparent border-l-white/95',
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: arrowDirection === 'up' ? 8 : arrowDirection === 'down' ? -8 : 0 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
        className={`z-50 ${position} ${className}`}
      >
        <div className="relative bg-white/95 backdrop-blur-xl rounded-xl shadow-[0_8px_24px_rgba(0,0,0,0.15)] border border-white/70 px-4 py-3 max-w-[280px]">
          {/* Dismiss button */}
          <button
            onClick={handleDismiss}
            className="absolute top-2 right-2 p-1 rounded-full hover:bg-gray-100 transition-colors"
            aria-label="Dismiss"
          >
            <X size={14} className="text-gray-400" />
          </button>

          {/* Content */}
          <div className="pr-6 text-sm text-gray-700">
            {children}
          </div>

          {/* Arrow */}
          {showArrow && (
            <div
              className={`absolute w-0 h-0 border-8 ${arrowClasses[arrowDirection]}`}
            />
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

/**
 * Floating onboarding dialog box - larger variant for welcome messages.
 */
export function OnboardingDialog({
  id,
  title,
  description,
  show = true,
  onDismiss,
  className = '',
  position = '',
}: {
  id: string;
  title: string;
  description: string;
  show?: boolean;
  onDismiss?: () => void;
  className?: string;
  position?: string;
}) {
  const { dismiss, isDismissed } = useOnboardingState();

  const handleDismiss = () => {
    dismiss(id);
    onDismiss?.();
  };

  if (isDismissed(id) || !show) {
    return null;
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 10 }}
        transition={{ type: 'spring', stiffness: 260, damping: 28 }}
        className={`z-50 ${position} ${className}`}
      >
        <div className="relative bg-white/95 backdrop-blur-xl rounded-2xl shadow-[0_12px_32px_rgba(0,0,0,0.18)] border border-white/70 p-4 max-w-[320px]">
          {/* Dismiss button */}
          <button
            onClick={handleDismiss}
            className="absolute top-3 right-3 p-1.5 rounded-full hover:bg-gray-100 transition-colors"
            aria-label="Dismiss"
          >
            <X size={16} className="text-gray-400" />
          </button>

          {/* Title */}
          <h4 className="font-semibold text-gray-900 text-base pr-8 mb-1">
            {title}
          </h4>

          {/* Description */}
          <p className="text-sm text-gray-600">
            {description}
          </p>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

export default OnboardingTooltip;
