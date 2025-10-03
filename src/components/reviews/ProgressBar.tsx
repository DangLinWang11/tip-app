import React from 'react';
import { motion } from 'framer-motion';

interface ProgressStep {
  key: string;
  label: string;
}

interface ProgressBarProps {
  steps: ProgressStep[];
  currentStep: number;
}

const ProgressBar: React.FC<ProgressBarProps> = ({ steps, currentStep }) => {
  const progress = (currentStep / Math.max(steps.length - 1, 1)) * 100;

  return (
    <div className="mb-8">
      <div className="relative">
        <div className="h-1 bg-slate-200 rounded-full" />
        <motion.div
          className="absolute inset-y-0 left-0 bg-red-400 rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.3, ease: 'easeInOut' }}
        />
        <div className="absolute inset-0 flex justify-between">
          {steps.map((step, index) => {
            const isActive = index <= currentStep;
            return (
              <div key={step.key} className="flex flex-col items-center -mt-3">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-colors ${
                    isActive ? 'bg-red-500 text-white shadow-lg shadow-red-200/60' : 'bg-white border border-slate-200 text-slate-400'
                  }`}
                >
                  {index + 1}
                </div>
                <span className={`mt-2 text-xs font-medium ${isActive ? 'text-slate-900' : 'text-slate-400'}`}>
                  {step.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default ProgressBar;
