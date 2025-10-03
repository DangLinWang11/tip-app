import React, { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Sparkles } from 'lucide-react';

interface RewardToastProps {
  message: string;
  visible: boolean;
  onDismiss: () => void;
  timeout?: number;
}

const RewardToast: React.FC<RewardToastProps> = ({
  message,
  visible,
  onDismiss,
  timeout = 2600
}) => {
  useEffect(() => {
    if (!visible) return;
    const handle = window.setTimeout(onDismiss, timeout);
    return () => window.clearTimeout(handle);
  }, [visible, timeout, onDismiss]);

  return (
    <AnimatePresence>
      {visible ? (
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 24 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50"
        >
          <div className="flex items-center gap-3 rounded-2xl bg-white shadow-lg shadow-slate-200/80 px-5 py-4 border border-slate-100">
            <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center text-amber-600">
              <Sparkles className="w-5 h-5" />
            </div>
            <p className="text-sm font-medium text-slate-800">{message}</p>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
};

export default RewardToast;
