import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';

interface CoachTooltipProps {
  title?: string;
  body: string;
  stepIndex: number;
  totalSteps: number;
  canGoBack: boolean;
  isLast: boolean;
  onBack: () => void;
  onNext: () => void;
  onSkip: () => void;
}

const baseCard =
  'max-w-[320px] rounded-2xl bg-white shadow-[0_18px_40px_rgba(15,23,42,0.18)] border border-white/70 backdrop-blur-xl';

export const CoachTooltip: React.FC<CoachTooltipProps> = ({
  title,
  body,
  stepIndex,
  totalSteps,
  canGoBack,
  isLast,
  onBack,
  onNext,
  onSkip,
}) => {
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={`${stepIndex}-${title ?? body}`}
        initial={{ opacity: 0, y: 8, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 6, scale: 0.98 }}
        transition={{ type: 'spring', stiffness: 280, damping: 26 }}
        className={baseCard}
        role="dialog"
        aria-live="polite"
      >
        <div className="px-4 pt-4 pb-3">
          {title && (
            <div className="text-[13px] font-semibold text-slate-900 mb-1">
              {title}
            </div>
          )}
          <div className="text-sm text-slate-700 leading-snug">{body}</div>
        </div>

        <div className="flex items-center justify-between px-4 pb-3">
          <div className="text-[11px] text-slate-400">
            {stepIndex + 1} / {totalSteps}
          </div>
          <div className="flex items-center gap-2">
            {canGoBack && (
              <button
                type="button"
                onClick={onBack}
                className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                <ChevronLeft size={12} />
                Back
              </button>
            )}
            <button
              type="button"
              onClick={onNext}
              className="inline-flex items-center gap-1 rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white hover:bg-slate-800"
            >
              {isLast ? 'Done' : 'Next'}
              <ChevronRight size={12} />
            </button>
            <button
              type="button"
              onClick={onSkip}
              className="inline-flex items-center gap-1 rounded-full border border-transparent px-2 py-1 text-[11px] text-slate-400 hover:text-slate-500"
            >
              <X size={12} />
              Skip
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
