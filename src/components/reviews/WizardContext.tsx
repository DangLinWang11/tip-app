import React from 'react';
import { WizardContextValue } from './types';

export const WizardContext = React.createContext<WizardContextValue | undefined>(undefined);

export const useReviewWizard = (): WizardContextValue => {
  const context = React.useContext(WizardContext);
  if (!context) {
    throw new Error('useReviewWizard must be used within a WizardContext.Provider');
  }
  return context;
};
