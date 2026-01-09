import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useI18n } from '../../lib/i18n/useI18n';
import { useReviewWizard } from './WizardContext';

const BUSINESS_TAGS = [
  'Great Staff',
  'Wonderful Atmosphere',
  'Quick Service',
  'Hidden Gem',
  'Worth the Wait',
  'Highly Photogenic',
  'Kid Friendly'
];

const StepWrapUp: React.FC = () => {
  const { t } = useI18n();
  const navigate = useNavigate();
  const {
    visitDraft,
    setVisitDraft,
    dishDrafts,
    mediaItems,
    selectedRestaurant,
    goBack,
    submitReview,
    isSubmitting,
    setIsSubmitting,
    resetDraft,
    pendingUploads,
    pendingUploadCount,
  } = useReviewWizard();

  const [successIds, setSuccessIds] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedBusinessTags, setSelectedBusinessTags] = useState<string[]>(visitDraft.businessTags || []);

  const visitOnlyMediaItems = useMemo(() => {
    return mediaItems.filter((media) => {
      const mediaId = media.id;
      if (!mediaId) return false;
      const isAttachedToAnyDish = dishDrafts.some((dish) => dish.mediaIds?.includes(mediaId));
      return !isAttachedToAnyDish;
    });
  }, [mediaItems, dishDrafts]);

  const disableSubmit = isSubmitting || pendingUploads;

  const toggleBusinessTag = (tag: string) => {
    setSelectedBusinessTags(prev => {
      const newTags = prev.includes(tag)
        ? prev.filter(t => t !== tag)
        : [...prev, tag];
      setVisitDraft(draft => ({ ...draft, businessTags: newTags }));
      return newTags;
    });
  };

  const handleSubmit = async () => {
    if (pendingUploads) {
      setError('Please wait for photo uploads to finish before posting.');
      return;
    }
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
    resetDraft(false); // Clear all draft data
    navigate('/', { replace: true }); // Use replace to prevent back navigation to create
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

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">
          You're rating {selectedRestaurant?.name}
        </h1>
        <p className="text-base text-slate-600">
          Review your visit before posting
        </p>
      </div>

      {/* Dishes Summary */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-slate-900">Your dishes ({dishDrafts.length})</h2>
        <div className="space-y-3">
          {dishDrafts.map((dish) => {
            // Get the first attached photo for this dish
            const firstMediaId = dish.mediaIds?.[0];
            const firstMedia = firstMediaId
              ? mediaItems.find(m => m.id === firstMediaId)
              : null;
            const thumbnailUrl = firstMedia?.downloadURL || firstMedia?.previewUrl || firstMedia?.thumbnailURL;

            return (
              <div
                key={dish.id}
                className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="flex items-center gap-4">
                  {/* Left: Thumbnail */}
                  {thumbnailUrl ? (
                    <div className="flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden bg-slate-100">
                      <img
                        src={thumbnailUrl}
                        alt={dish.dishName}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ) : (
                    <div className="flex-shrink-0 w-16 h-16 rounded-lg bg-slate-100 flex items-center justify-center">
                      <span className="text-2xl">🍽️</span>
                    </div>
                  )}

                  {/* Center: Dish Name & Category */}
                  <div className="flex-1 min-w-0">
                    <h3 className="text-base font-semibold text-slate-900 truncate">
                      {dish.dishName}
                    </h3>
                    {dish.dishCategory && (
                      <p className="text-sm text-slate-500 capitalize">{dish.dishCategory}</p>
                    )}
                  </div>

                  {/* Right: Rating */}
                  <div className="flex-shrink-0">
                    <div className="text-2xl font-bold text-red-600">
                      {dish.rating.toFixed(1)}
                    </div>
                  </div>
                </div>

                {/* Caption if exists */}
                {dish.caption && (
                  <p className="mt-3 text-sm text-slate-600 italic">
                    "{dish.caption}"
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Business Highlight Tags & Owner Message */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 space-y-6">
        {/* What stood out? */}
        <div>
          <h2 className="text-lg font-semibold text-slate-900 mb-4">What stood out?</h2>
          <div className="flex flex-wrap gap-2">
            {BUSINESS_TAGS.map(tag => {
              const isSelected = selectedBusinessTags.includes(tag);
              return (
                <button
                  key={tag}
                  type="button"
                  onClick={() => toggleBusinessTag(tag)}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                    isSelected
                      ? 'bg-slate-900 text-white shadow-sm'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {tag}
                </button>
              );
            })}
          </div>
        </div>

        {/* Say something to the owner */}
        <div>
          <textarea
            value={visitDraft.overallText || ''}
            onChange={(e) => setVisitDraft(prev => ({ ...prev, overallText: e.target.value || undefined }))}
            onBlur={() => {
              // Auto-save on blur (clicking out of textbox)
              console.log('Owner message saved:', visitDraft.overallText);
            }}
            placeholder="Say something to the owner (This will be your review's caption)"
            rows={3}
            className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-100 transition-all"
          />
        </div>
      </div>

      {/* Visit Photos */}
      {visitOnlyMediaItems.length > 0 && (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
          <h2 className="text-lg font-semibold text-slate-900 mb-2">Visit vibes</h2>
          <p className="text-sm text-slate-500 mb-4">
            Photos of the atmosphere, decor, or overall experience
          </p>
          <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1">
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
                    <div className="w-full h-full flex items-center justify-center text-xs text-slate-600">
                      Video
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Visit Details */}
      {visitDraft.mealTime && visitDraft.mealTime !== 'unspecified' && (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Visit details</h2>
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
              Meal Time
            </p>
            <p className="text-sm text-slate-900 capitalize">{visitDraft.mealTime}</p>
          </div>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="rounded-2xl bg-red-50 border border-red-200 p-4">
          <h3 className="text-sm font-semibold text-red-900 mb-1">Failed to post</h3>
          <p className="text-xs text-red-700">{error}</p>
        </div>
      )}
      {pendingUploads && (
        <div className="rounded-2xl bg-amber-50 border border-amber-200 p-3 text-xs font-medium text-amber-800 flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          Uploading {pendingUploadCount} file{pendingUploadCount !== 1 ? 's' : ''} in the background
        </div>
      )}

      {/* Navigation */}
      <div className="flex gap-3 pt-4">
        <button
          type="button"
          onClick={goBack}
          disabled={isSubmitting}
          className="flex-1 rounded-2xl border border-slate-200 py-3 text-center text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
        >
          Back
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={disableSubmit}
          className="flex-1 rounded-2xl bg-red-500 py-3 text-center text-sm font-semibold text-white transition hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-md hover:shadow-lg"
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
