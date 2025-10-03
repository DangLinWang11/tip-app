import React from 'react';
import Wizard from '../components/reviews/Wizard';
import { useFeature } from '../utils/features';

const LegacyCreatePlaceholder: React.FC = () => (
  <div className="mx-auto max-w-2xl px-4 py-16 text-center text-slate-500">
    <p>Legacy create flow is currently disabled.</p>
  </div>
);

const Create: React.FC = () => {
  const newFlowEnabled = useFeature('NEW_CREATE_FLOW');

  if (!newFlowEnabled) {
    return <LegacyCreatePlaceholder />;
  }

  return <Wizard />;
};

export default Create;
