import React, { useState } from 'react';
import { Check } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useI18n } from '../../lib/i18n/useI18n';
import { useReviewWizard } from './WizardContext';

const AUDIENCE_OPTIONS = [
  { value: 'spicy_lovers', labelKey: 'audience.spicy' },
  { value: 'date_night', labelKey: 'audience.date' },
  { value: 'family', labelKey: 'audience.family' },
  { value: 'quick_bite', labelKey: 'audience.quick' },
  { value: 'solo', labelKey: 'audience.solo' },
  { value: 'group', labelKey: 'audience.group' }
] as const;

const RETURN_OPTIONS = [
  { value: 'for_this', labelKey: 'nextVisit.comeBack' },
  { value: 'for_others', labelKey: 'nextVisit.bring' },
  { value: 'no', labelKey: 'nextVisit.no' }
] as const;

type AudienceOption = typeof AUDIENCE_OPTIONS[number]['value'];

const Step4Outcome: React.FC = () => {
  const { t } = useI18n();
  const navigate = useNavigate();
  const {
    draft,
    updateDraft,
    goBack,
    submitReview,
    isSubmitting,
    setIsSubmitting,
    resetDraft,
    selectedRestaurant
  } = useReviewWizard();
  const [successId, setSuccessId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const toggleAudience = (option: AudienceOption) => {
    updateDraft((prev) => {
      const audience = prev.outcome.audience || [];
      const exists = audience.includes(option);
      return {
        ...prev,
        outcome: {
          ...prev.outcome,
          audience: exists ? audience.filter((item) => item !== option) : [...audience, option]
        }
      };
    });
  };

  const handleSubmit = async () => {
    try {
      setIsSubmitting(true);
      setError(null);
      const id = await submitReview();
      setSuccessId(id);
    } catch (err) {
      console.error('Submit failed', err);
      setError(t('createWizard.status.error'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-8">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-md shadow-slate-200/60 space-y-6">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">{t('outcome.title')}</h2>
          <p className="text-sm text-slate-500">{t('outcome.subtitle')}</p>
        </div>

        <div className="space-y-4">
          <div>
            <p className="text-sm font-semibold text-slate-800">{t('review.orderAgain')}</p>
            <div className="mt-2 flex gap-2">
              {[true, false].map((value) => {
                const active = draft.outcome.orderAgain === value;
                return (
                  <button
                    key={`orderAgain-${value}`}
                    type="button"
                    onClick={() => updateDraft((prev) => ({
                      ...prev,
                      outcome: {
                        ...prev.outcome,
                        orderAgain: value
                      }
                    }))}
                    className={`rounded-2xl px-4 py-3 text-sm font-semibold transition ${active ? 'bg-red-500 text-white shadow-md shadow-red-200/60' : 'bg-slate-100 text-slate-600 hover:bg-red-50 hover:text-red-500'}`}
                  >
                    {value ? t('common.yes') : t('common.no')}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <p className="text-sm font-semibold text-slate-800">{t('review.recommend')}</p>
            <div className="mt-2 flex gap-2">
              {[true, false].map((value) => {
                const active = draft.outcome.recommend === value;
                return (
                  <button
                    key={`recommend-${value}`}
                    type="button"
                    onClick={() => updateDraft((prev) => ({
                      ...prev,
                      outcome: {
                        ...prev.outcome,
                        recommend: value
                      }
                    }))}
                    className={`rounded-2xl px-4 py-3 text-sm font-semibold transition ${active ? 'bg-red-500 text-white shadow-md shadow-red-200/60' : 'bg-slate-100 text-slate-600 hover:bg-red-50 hover:text-red-500'}`}
                  >
                    {value ? t('common.yes') : t('common.no')}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <p className="text-sm font-semibold text-slate-800">{t('outcome.audience')}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {AUDIENCE_OPTIONS.map((option) => {
                const active = draft.outcome.audience?.includes(option.value) ?? false;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => toggleAudience(option.value)}
                    className={`rounded-2xl px-4 py-2 text-xs font-semibold transition ${active ? 'bg-emerald-500 text-white shadow-md shadow-emerald-200/60' : 'bg-slate-100 text-slate-600 hover:bg-emerald-50 hover:text-emerald-600'}`}
                  >
                    {t(option.labelKey)}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <p className="text-sm font-semibold text-slate-800">{t('outcome.returnIntent')}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {RETURN_OPTIONS.map((option) => {
                const active = draft.outcome.returnIntent === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => updateDraft((prev) => ({
                      ...prev,
                      outcome: {
                        ...prev.outcome,
                        returnIntent: option.value
                      }
                    }))}
                    className={`rounded-2xl px-4 py-2 text-sm font-semibold transition ${active ? 'bg-red-500 text-white shadow-md shadow-red-200/60' : 'bg-slate-100 text-slate-600 hover:bg-red-50 hover:text-red-500'}`}
                  >
                    {t(option.labelKey)}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {error ? <p className="text-sm text-red-500">{error}</p> : null}
      {successId ? (
        <div className="rounded-3xl border border-emerald-200 bg-emerald-50 px-6 py-5 text-emerald-700 shadow-md shadow-emerald-200/60">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-emerald-500 p-2 text-white">
              <Check className="h-4 w-4" />
            </div>
            <div>
              <p className="text-sm font-semibold">{t('reward.submitBonus')}</p>
              <p className="text-xs">{t('createWizard.actions.clone')}</p>
            </div>
          </div>
          <div className="mt-4">
            <button
              type="button"
              onClick={() => {
                setSuccessId(null);
                resetDraft(true);
              }}
              className="rounded-2xl bg-red-500 px-5 py-2 text-sm font-semibold text-white shadow-md shadow-red-200/60 hover:bg-red-600"
            >
              {t('createWizard.actions.cloneFromRestaurant')}
            </button>
          </div>
        </div>
      ) : null}

      <div className="flex justify-between">
        <button
          type="button"
          onClick={goBack}
          className="rounded-2xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-600 hover:border-red-200 hover:text-red-500"
        >
          {t('createWizard.actions.back')}
        </button>
        {successId ? (
          <button
            type="button"
            onClick={() => navigate('/')}
            className="rounded-2xl bg-red-500 px-6 py-3 text-sm font-semibold text-white shadow-md shadow-red-200/60 hover:bg-red-600"
          >
            {t('createWizard.actions.home')}
          </button>
        ) : (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className={`rounded-2xl px-6 py-3 text-sm font-semibold transition ${isSubmitting ? 'bg-slate-200 text-slate-400' : 'bg-red-500 text-white hover:bg-red-600 shadow-md shadow-red-200/60'}`}
          >
            {isSubmitting ? t('createWizard.status.autosaving') : t('review.submit')}
          </button>
        )}
      </div>
    </div>
  );
};

export default Step4Outcome;
