import React, { useState } from 'react';
import { Check } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useI18n } from '../../lib/i18n/useI18n';
import { useReviewWizard } from './WizardContext';
import { uploadReviewProofs, markReviewPendingProof } from '../../services/reviewVerificationService';
import { BAD_WORDS } from './profanity';
import type { MealTimeTag, ServiceSpeed } from '../../dev/types/review';

const MEAL_TIME_OPTIONS: Array<{ value: MealTimeTag; labelKey: string; emoji: string }> = [
  { value: 'breakfast', labelKey: 'mealTime.breakfast', emoji: '🌅' },
  { value: 'brunch', labelKey: 'mealTime.brunch', emoji: '🥂' },
  { value: 'lunch', labelKey: 'mealTime.lunch', emoji: '🌤️' },
  { value: 'dinner', labelKey: 'mealTime.dinner', emoji: '🌙' },
  { value: 'late_night', labelKey: 'mealTime.lateNight', emoji: '🌃' },
  { value: 'dessert', labelKey: 'mealTime.dessert', emoji: '🍰' },
  { value: 'snack', labelKey: 'mealTime.snack', emoji: '🍿' }
];

const SERVICE_SPEED_OPTIONS: Array<{ value: ServiceSpeed; labelKey: string }> = [
  { value: 'fast', labelKey: 'service.fast' },
  { value: 'normal', labelKey: 'service.normal' },
  { value: 'slow', labelKey: 'service.slow' }
];

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

const Step3Outcome: React.FC = () => {
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
  const [caption, setCaption] = useState(() => draft.caption || '');
  const [captionError, setCaptionError] = useState<string | null>(null);
  const [successId, setSuccessId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [proofMessage, setProofMessage] = useState<string | null>(null);

  const toggleMealTime = (mealTime: MealTimeTag) => {
    updateDraft((prev) => {
      const mealTimes = prev.mealTimes || [];
      const exists = mealTimes.includes(mealTime);
      return {
        ...prev,
        mealTimes: exists ? mealTimes.filter((item) => item !== mealTime) : [...mealTimes, mealTime]
      };
    });
  };

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
    // Validate caption for profanity if non-empty
    const trimmedCaption = caption.trim();
    if (trimmedCaption && BAD_WORDS.some((word) => trimmedCaption.toLowerCase().includes(word))) {
      setCaptionError(t('validation.profanity'));
      return;
    }
    setCaptionError(null);

    // Update draft with caption before submitting
    updateDraft((prev) => ({
      ...prev,
      caption: trimmedCaption || undefined
    }));

    try {
      setIsSubmitting(true);
      setError(null);
      const id = await submitReview();
      setSuccessId(id);
      // Inform user that XP is instant but points are gated
      setProofMessage('+XP awarded. Reward points pending verification.');
      try {
        // Hint the Home screen to bypass cache once
        navigate('/?refresh=1');
      } catch {}
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

        <div className="space-y-6">
          {/* Meal Time Section */}
          <div>
            <p className="text-sm font-semibold text-slate-800 mb-3">When is this dish best?</p>
            <div className="flex flex-wrap gap-2">
              {MEAL_TIME_OPTIONS.map((option) => {
                const active = (draft.mealTimes || []).includes(option.value);
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => toggleMealTime(option.value)}
                    className={`flex items-center gap-1 rounded-2xl px-3 py-2 text-xs font-semibold transition ${
                      active
                        ? 'bg-emerald-500 text-white shadow-md shadow-emerald-200/60'
                        : 'bg-slate-100 text-slate-600 hover:bg-emerald-50 hover:text-emerald-600'
                    }`}
                  >
                    <span>{option.emoji}</span>
                    {t(option.labelKey)}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Service Speed Section */}
          <div>
            <p className="text-sm font-semibold text-slate-800 mb-3">How was the service?</p>
            <div className="flex gap-2">
              {SERVICE_SPEED_OPTIONS.map((option) => {
                const active = draft.serviceSpeed === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() =>
                      updateDraft((prev) => ({
                        ...prev,
                        serviceSpeed: active ? null : option.value
                      }))
                    }
                    className={`flex-1 rounded-2xl px-4 py-3 text-sm font-semibold transition ${
                      active
                        ? 'bg-blue-500 text-white shadow-md shadow-blue-200/60'
                        : 'bg-slate-100 text-slate-600 hover:bg-blue-50 hover:text-blue-600'
                    }`}
                  >
                    {t(option.labelKey)}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Order Again Section */}
          <div>
            <p className="text-sm font-semibold text-slate-800 mb-2">{t('review.orderAgain')}</p>
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

          {/* Caption / Notes Section */}
          <div className="pt-2">
            <label className="block text-sm font-semibold text-slate-800 mb-3">Add any notes? (optional)</label>
            <textarea
              value={caption}
              onChange={(event) => setCaption(event.target.value)}
              placeholder="Share thoughts about the dish, presentation, flavor, etc..."
              rows={3}
              className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-base focus:border-red-400 focus:outline-none focus:ring-2 focus:ring-red-100"
            />
            {captionError ? <p className="text-sm text-red-500 mt-2">{captionError}</p> : null}
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
              <p className="text-xs">{proofMessage || t('createWizard.actions.clone')}</p>
            </div>
          </div>
          {/* Optional: Add receipt/proof upload */}
          <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
            <div className="font-medium text-slate-800 mb-1">Add a receipt to earn reward points (optional).</div>
            <p className="text-xs text-slate-500 mb-3">Your proof is private and only visible to admins.</p>
            <input
              type="file"
              accept="image/*,application/pdf"
              multiple
              disabled={uploading}
              onChange={async (e) => {
                const files = Array.from(e.target.files || []);
                if (!successId || files.length === 0) return;
                try {
                  setUploading(true);
                  setProgress(0);
                  const urls = await uploadReviewProofs(successId, files, (r) => setProgress(Math.round(r*100)));
                  await markReviewPendingProof(successId, urls);
                  setProofMessage('Proof submitted. Pending verification.');
                } catch (err) {
                  console.error('Proof upload failed', err);
                  setProofMessage('Failed to upload proof. Please try again.');
                } finally {
                  setUploading(false);
                }
              }}
              className="block w-full text-sm"
            />
            {uploading && (
              <div className="text-xs text-slate-600 mt-2">Uploading... {progress}%</div>
            )}
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

export default Step3Outcome;
