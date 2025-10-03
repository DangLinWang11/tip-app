import React, { useEffect, useRef, useState } from 'react';
import { useI18n } from '../../lib/i18n/useI18n';
import { useReviewWizard } from './WizardContext';
import { BAD_WORDS } from './profanity';

const Step3Caption: React.FC = () => {
  const { t } = useI18n();
  const { draft, updateDraft, goBack, goNext, showReward } = useReviewWizard();
  const [caption, setCaption] = useState(() => draft.caption || '');
  const [error, setError] = useState<string | null>(null);
  const mappedRef = useRef(false);

  useEffect(() => {
    if (mappedRef.current) return;
    if (!draft.caption && draft.comparison?.mode === 'free_text' && draft.comparison?.targetText) {
      const text = draft.comparison.targetText;
      setCaption(text);
      updateDraft((prev) => ({
        ...prev,
        caption: text,
        comparison: undefined
      }));
    }
    mappedRef.current = true;
  }, [draft.caption, draft.comparison, updateDraft]);

  const handleAdvance = () => {
    const trimmed = caption.trim();
    if (trimmed && BAD_WORDS.some((word) => trimmed.toLowerCase().includes(word))) {
      setError(t('validation.profanity'));
      return;
    }
    setError(null);
    updateDraft((prev) => ({
      ...prev,
      caption: trimmed ? trimmed : undefined,
      comparison: undefined
    }));
    if (trimmed) {
      showReward('compare');
    }
    goNext();
  };

  const handleSkip = () => {
    setCaption('');
    setError(null);
    updateDraft((prev) => ({
      ...prev,
      caption: undefined,
      comparison: undefined
    }));
    goNext();
  };

  return (
    <div className="space-y-8">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-md shadow-slate-200/60 space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">{t('review.addCaption')}</h2>
          <p className="text-sm text-slate-500">{t('review.addDetails')}</p>
        </div>
        <textarea
          value={caption}
          onChange={(event) => setCaption(event.target.value)}
          placeholder={t('review.addCaption')}
          rows={4}
          className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-base focus:border-red-400 focus:outline-none focus:ring-2 focus:ring-red-100"
        />
        {error ? <p className="text-sm text-red-500">{error}</p> : null}
      </section>

      <div className="flex justify-between">
        <button
          type="button"
          onClick={goBack}
          className="rounded-2xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-600 hover:border-red-200 hover:text-red-500"
        >
          {t('createWizard.actions.back')}
        </button>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={handleSkip}
            className="rounded-2xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-600 hover:border-red-200 hover:text-red-500"
          >
            {t('createWizard.actions.skip')}
          </button>
          <button
            type="button"
            onClick={handleAdvance}
            className="rounded-2xl bg-red-500 px-6 py-3 text-sm font-semibold text-white shadow-md shadow-red-200/60 hover:bg-red-600"
          >
            {t('createWizard.actions.next')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Step3Caption;
