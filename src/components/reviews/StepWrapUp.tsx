import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useI18n } from '../../lib/i18n/useI18n';
import { useReviewWizard } from './WizardContext';

const StepWrapUp: React.FC = () => {
  const { t } = useI18n();
  const navigate = useNavigate();
  const {
    visitDraft,
    dishDrafts,
    mediaItems,
    selectedRestaurant,
    goBack,
    submitReview,
    isSubmitting,
    setIsSubmitting,
    resetDraft,
  } = useReviewWizard();

  const [successIds, setSuccessIds] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const visitOnlyMediaItems = useMemo(() => {
    return mediaItems.filter((media) => {
      const mediaId = media.id;
      if (!mediaId) return false;
      const isAttachedToAnyDish = dishDrafts.some((dish) => dish.mediaIds?.includes(mediaId));
      return !isAttachedToAnyDish;
    });
  }, [mediaItems, dishDrafts]);

  const handleSubmit = async () => {
    try {
      setIsSubmitting(true);
      setError(null);
      const ids = await submitReview();
      setSuccessIds(ids);
    } catch (err) {
      console.error('Submit failed', err);
      setError(err instanceof Error ? err.message : t('createWizard.status.error'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePostAnother = () => {
    resetDraft(true); // Keep restaurant selected
    navigate('/create');
  };

  const handleGoHome = () => {
    navigate('/?refresh=1');
  };

  if (successIds) {
    return (
      <div className="space-y-6">
        {/* Success Message */}
        <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-8 text-center shadow-md">
          <div className="text-4xl mb-4">✨</div>
          <h2 className="text-2xl font-semibold text-emerald-900 mb-2">
            Visit posted!
          </h2>
          <p className="text-emerald-700 mb-1">
            {successIds.length} dish review{successIds.length !== 1 ? 's' : ''} from your visit
          </p>
          <p className="text-sm text-emerald-600">
            +XP awarded. Reward points pending verification.
          </p>
        </div>

        {/* Navigation */}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={handlePostAnother}
            className="flex-1 rounded-2xl border border-red-500 py-3 text-center text-sm font-semibold text-red-500 transition hover:bg-red-50"
          >
            Post another from {selectedRestaurant?.name || 'this restaurant'}
          </button>
          <button
            type="button"
            onClick={handleGoHome}
            className="flex-1 rounded-2xl bg-red-500 py-3 text-center text-sm font-semibold text-white transition hover:bg-red-600"
          >
            Home
          </button>
        </div>
      </div>
    );
  }

  const mediaCount = mediaItems.filter(m => m.downloadURL).length;
  const attachedMediaCount = dishDrafts.reduce((total, dish) => total + dish.mediaIds.length, 0);

  return (
    <div className="space-y-6">
      {visitOnlyMediaItems.length > 0 && (
        <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900">Your Visit Photos</h2>
          <p className="mt-1 text-xs text-slate-500">
            These photos are for the place, decor, or vibes. They&apos;re not tied to one specific dish.
          </p>
          <div className="mt-3 flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
            {visitOnlyMediaItems.map((media) => {
              const src = media.downloadURL || media.previewUrl || media.thumbnailURL;
              if (!src) return null;
              return (
                <div
                  key={media.id}
                  className="flex-shrink-0 w-24 h-24 rounded-xl overflow-hidden border border-slate-200 bg-slate-50"
                >
                  {media.kind === 'photo' ? (
                    <img src={src} alt="Visit photo" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-[11px] text-slate-600">
                      Video
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Summary Card */}
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-md shadow-slate-200/60">
        <h2 className="text-lg font-semibold text-slate-900 mb-6">Review Summary</h2>

        {/* Restaurant */}
        <div className="space-y-4">
          <div>
            <h3 className="text-xs font-semibold text-slate-600 uppercase mb-1">Restaurant</h3>
            <p className="text-sm font-medium text-slate-900">{selectedRestaurant?.name}</p>
            {(selectedRestaurant as any)?.address && (
              <p className="text-xs text-slate-500">{(selectedRestaurant as any).address}</p>
            )}
          </div>

          {/* Meal Time */}
          {visitDraft.mealTime && visitDraft.mealTime !== 'unspecified' && (
            <div>
              <h3 className="text-xs font-semibold text-slate-600 uppercase mb-1">Meal Time</h3>
              <p className="text-sm font-medium text-slate-900 capitalize">{visitDraft.mealTime}</p>
            </div>
          )}

          {/* Visit Text */}
          {visitDraft.overallText && (
            <div>
              <h3 className="text-xs font-semibold text-slate-600 uppercase mb-1">About This Visit</h3>
              <p className="text-sm text-slate-700 leading-relaxed">{visitDraft.overallText}</p>
            </div>
          )}

          {/* Media Summary */}
          <div>
            <h3 className="text-xs font-semibold text-slate-600 uppercase mb-1">Photos & Videos</h3>
            <div className="flex gap-2 text-sm">
              <span className="text-slate-700">
                {mediaCount} uploaded
              </span>
              {attachedMediaCount < mediaCount && (
                <>
                  <span className="text-slate-400">•</span>
                  <span className="text-amber-600">
                    {mediaCount - attachedMediaCount} visit-only
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Dishes Summary */}
      <div className="space-y-3">
        <h3 className="text-lg font-semibold text-slate-900">Dishes ({dishDrafts.length})</h3>
        {dishDrafts.map((dish, idx) => {
          const attachedCount = dish.mediaIds.length;
          return (
            <div key={dish.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="flex-1">
                  <h4 className="text-sm font-semibold text-slate-900">{dish.dishName}</h4>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span className="text-xs bg-slate-100 px-2 py-0.5 rounded text-slate-600">
                      {dish.dishCategory}
                    </span>
                    <span className="text-xs text-slate-500">⭐ {dish.rating.toFixed(1)}</span>
                    {attachedCount > 0 && (
                      <span className="text-xs bg-emerald-100 px-2 py-0.5 rounded text-emerald-700">
                        {attachedCount} photo{attachedCount !== 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                  {dish.caption && (
                    <p className="text-xs text-slate-500 mt-2 italic">"{dish.caption}"</p>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Error Display */}
      {error && (
        <div className="rounded-2xl bg-red-50 border border-red-200 p-4">
          <h3 className="text-sm font-semibold text-red-900 mb-1">Failed to post</h3>
          <p className="text-xs text-red-700">{error}</p>
        </div>
      )}

      {/* Navigation */}
      <div className="flex gap-3 pt-4">
        <button
          type="button"
          onClick={goBack}
          disabled={isSubmitting}
          className="flex-1 rounded-2xl border border-slate-200 py-3 text-center text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Back
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={isSubmitting}
          className="flex-1 rounded-2xl bg-red-500 py-3 text-center text-sm font-semibold text-white transition hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Posting...
            </>
          ) : (
            'Post Visit'
          )}
        </button>
      </div>
    </div>
  );
};

export default StepWrapUp;
