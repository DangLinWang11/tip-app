import React, { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { useI18n } from '../../lib/i18n/useI18n';
import { useReviewWizard } from './WizardContext';
import { ReviewDraft } from '../../dev/types/review';

interface TasteOption {
  value: string;
  labelKey: string;
}

interface TasteConfig {
  key: keyof ReviewDraft['taste'];
  translation: string;
  options: TasteOption[];
  fallback: string;
  optional?: boolean;
}

const CORE_ATTRIBUTES: TasteConfig[] = [
  {
    key: 'portion',
    translation: 'taste.attributes.portion',
    options: [
      { value: 'small', labelKey: 'taste.levels.small' },
      { value: 'just_right', labelKey: 'taste.levels.just_right' },
      { value: 'generous', labelKey: 'taste.levels.generous' }
    ],
    fallback: 'just_right'
  },
  {
    key: 'value',
    translation: 'taste.attributes.value',
    options: [
      { value: 'overpriced', labelKey: 'taste.levels.overpriced' },
      { value: 'fair', labelKey: 'taste.levels.fair' },
      { value: 'bargain', labelKey: 'taste.levels.bargain' }
    ],
    fallback: 'fair'
  },
  {
    key: 'presentation',
    translation: 'taste.attributes.presentation',
    options: [
      { value: 'messy', labelKey: 'taste.levels.messy' },
      { value: 'clean', labelKey: 'taste.levels.clean' },
      { value: 'wow', labelKey: 'taste.levels.wow' }
    ],
    fallback: 'clean'
  },
  {
    key: 'freshness',
    translation: 'taste.attributes.freshness',
    options: [
      { value: 'not_fresh', labelKey: 'taste.levels.not_fresh' },
      { value: 'just_right', labelKey: 'taste.levels.just_right' },
      { value: 'very_fresh', labelKey: 'taste.levels.very_fresh' }
    ],
    fallback: 'just_right'
  }
];

const OPTIONAL_ATTRIBUTES: TasteConfig[] = [
  {
    key: 'saltiness',
    translation: 'taste.attributes.saltiness',
    options: [
      { value: 'needs_more_salt', labelKey: 'taste.levels.needs_more_salt' },
      { value: 'balanced', labelKey: 'taste.levels.balanced' },
      { value: 'too_salty', labelKey: 'taste.levels.too_salty' }
    ],
    fallback: 'balanced',
    optional: true
  },
  {
    key: 'temperature',
    translation: 'taste.attributes.temperature',
    options: [
      { value: 'needs_reheating', labelKey: 'taste.levels.needs_reheating' },
      { value: 'ideal', labelKey: 'taste.levels.ideal' },
      { value: 'too_hot', labelKey: 'taste.levels.too_hot' }
    ],
    fallback: 'ideal',
    optional: true
  },
  {
    key: 'texture',
    translation: 'taste.attributes.texture',
    options: [
      { value: 'mushy', labelKey: 'taste.levels.mushy' },
      { value: 'great_bite', labelKey: 'taste.levels.great_bite' },
      { value: 'tough', labelKey: 'taste.levels.tough' }
    ],
    fallback: 'great_bite',
    optional: true
  },
  {
    key: 'spiciness',
    translation: 'taste.attributes.spiciness',
    options: [
      { value: 'lacked_kick', labelKey: 'taste.levels.lacked_kick' },
      { value: 'nice_warmth', labelKey: 'taste.levels.nice_warmth' },
      { value: 'too_spicy', labelKey: 'taste.levels.too_spicy' }
    ],
    fallback: 'nice_warmth',
    optional: true
  }
];

const Step2Taste: React.FC = () => {
  const { t } = useI18n();
  const { draft, updateDraft, goBack, goNext, showReward } = useReviewWizard();
  const [expanded, setExpanded] = useState(false);

  const handleLevelSelect = (key: TasteConfig['key'], value: string, optional = false) => {
    updateDraft((prev) => ({
      ...prev,
      taste: {
        ...prev.taste,
        [key]: optional && prev.taste[key]?.level === value
          ? undefined
          : {
              level: value as never,
              note: prev.taste[key]?.note
            }
      }
    }));
  };

  const isCoreComplete = useMemo(() => {
    return CORE_ATTRIBUTES.every(({ key }) => Boolean(draft.taste[key]?.level));
  }, [draft.taste]);

  const handleNext = () => {
    if (!isCoreComplete) return;
    showReward('taste');
    goNext();
  };

  const renderAttribute = (config: TasteConfig) => (
    <div key={config.key} className="space-y-3">
      <h3 className="text-sm font-semibold text-slate-800">{t(config.translation)}</h3>
      <div className="flex flex-wrap gap-2">
        {config.options.map((option) => {
          const isActive = draft.taste[config.key]?.level === option.value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => handleLevelSelect(config.key, option.value, Boolean(config.optional))}
              className={`rounded-2xl px-4 py-2 text-sm font-medium transition ${
                isActive
                  ? 'bg-red-500 text-white shadow-md shadow-red-200/60'
                  : 'bg-slate-100 text-slate-600 hover:bg-red-50 hover:text-red-500'
              }`}
            >
              {t(option.labelKey)}
            </button>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="space-y-8">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-md shadow-slate-200/60 space-y-6">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">{t('taste.coreTitle')}</h2>
          <p className="text-sm text-slate-500">{t('taste.coreSubtitle')}</p>
        </div>
        <div className="space-y-6">
          {CORE_ATTRIBUTES.map(renderAttribute)}
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-md shadow-slate-200/60">
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          className="flex w-full items-center justify-between"
        >
          <div>
            <h2 className="text-lg font-semibold text-slate-900">{t('review.addDetails')}</h2>
            <p className="text-sm text-slate-500">{t('taste.optionalSubtitle')}</p>
          </div>
          {expanded ? <ChevronDown className="h-5 w-5 text-slate-400" /> : <ChevronRight className="h-5 w-5 text-slate-400" />}
        </button>
        {expanded ? (
          <div className="mt-6 space-y-6">
            {OPTIONAL_ATTRIBUTES.map(renderAttribute)}
          </div>
        ) : null}
      </section>

      <div className="flex justify-between">
        <button
          type="button"
          onClick={goBack}
          className="rounded-2xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-600 hover:border-red-200 hover:text-red-500"
        >
          {t('createWizard.actions.back')}
        </button>
        <button
          type="button"
          onClick={handleNext}
          className={`rounded-2xl px-6 py-3 text-sm font-semibold transition ${isCoreComplete ? 'bg-red-500 text-white hover:bg-red-600 shadow-md shadow-red-200/60' : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}
          disabled={!isCoreComplete}
        >
          {t('createWizard.actions.next')}
        </button>
      </div>
    </div>
  );
};

export default Step2Taste;
