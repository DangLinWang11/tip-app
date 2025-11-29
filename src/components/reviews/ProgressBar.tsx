import React from 'react';

interface ProgressStep {
  key: string;
  label: string;
}

interface ProgressBarProps {
  steps: ProgressStep[];
  currentStep: number;
}

const ProgressBar: React.FC<ProgressBarProps> = ({ steps, currentStep }) => {
  return (
    <div className="mb-2 pb-2">
      <div className="relative pt-2">
        <div className="absolute left-0 right-0 top-2 z-0 px-4">
          <div className="flex items-center h-8">
            {steps.slice(0, -1).map((_, index) => (
              <React.Fragment key={`segment-${index}`}>
                <div className={index === 1 ? 'w-6' : 'w-8'} />
                <div
                  className={`flex-1 h-1 rounded-full ${
                    index < currentStep ? 'bg-red-500' : 'bg-slate-200'
                  }`}
                />
              </React.Fragment>
            ))}
            <div className="w-8" />
          </div>
        </div>
        <div className="relative z-10 flex justify-between px-4">
          {steps.map((step, index) => {
            const isActive = index <= currentStep;
            return (
              <div key={step.key} className="flex flex-col items-center">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-colors ${
                    isActive ? 'bg-red-500 text-white shadow-lg shadow-red-200/60' : 'bg-white border border-slate-200 text-slate-400'
                  }`}
                >
                  {index + 1}
                </div>
                <span className={`mt-2 text-xs font-medium text-center ${isActive ? 'text-slate-900' : 'text-slate-400'}`}>
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
