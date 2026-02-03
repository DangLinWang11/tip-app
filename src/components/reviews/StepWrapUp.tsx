import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useI18n } from '../../lib/i18n/useI18n';
import { useReviewWizard } from './WizardContext';
import ConfettiEffect from './ConfettiEffect';
import { ToGoFeedback, DineInFeedback } from '../../dev/types/review';

const BUSINESS_TAGS = [
  'Great Staff',
  'Wonderful Atmosphere',
  'Quick Service',
  'Hidden Gem',
  'Worth the Wait',
  'Highly Photogenic',
  'Kid Friendly'
];

const MAX_BUSINESS_TAGS = 3;

const BUSINESS_LOWLIGHTS = [
  'Rude Staff',
  'Very Loud Environment',
  'Overcrowded',
  'Dirty',
  'Poor Parking',
  'Slow Service',
  'Overpriced'
];

const MAX_BUSINESS_LOWLIGHTS = 3;

const formatTagLabel = (tag: string): string => {
  // Replace underscores and hyphens with spaces
  return tag.replace(/_/g, ' ').replace(/-/g, ' ');
};

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
  const [selectedBusinessLowlights, setSelectedBusinessLowlights] = useState<string[]>(visitDraft.businessLowlights || []);
  const [countdown, setCountdown] = useState(5);

  // Structured feedback state
  const [toGoFeedback, setToGoFeedback] = useState<ToGoFeedback>({});
  const [dineInFeedback, setDineInFeedback] = useState<DineInFeedback>({});

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
      const isRemoving = prev.includes(tag);
      const newTags = isRemoving
        ? prev.filter(t => t !== tag)
        : prev.length >= MAX_BUSINESS_TAGS
          ? prev // Don't add if already at max
          : [...prev, tag];
      setVisitDraft(draft => ({ ...draft, businessTags: newTags }));
      return newTags;
    });
  };

  const toggleBusinessLowlight = (tag: string) => {
    setSelectedBusinessLowlights(prev => {
      const isRemoving = prev.includes(tag);
      const newTags = isRemoving
        ? prev.filter(t => t !== tag)
        : prev.length >= MAX_BUSINESS_LOWLIGHTS
          ? prev // Don't add if already at max
          : [...prev, tag];
      setVisitDraft(draft => ({ ...draft, businessLowlights: newTags }));
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

      // Update visitDraft with feedback before submission
      const hasToGoFeedback = Object.keys(toGoFeedback).length > 0;
      const hasDineInFeedback = Object.keys(dineInFeedback).length > 0;

      setVisitDraft(draft => ({
        ...draft,
        ...(visitDraft.isToGo && hasToGoFeedback ? { toGoFeedback } : {}),
        ...(!visitDraft.isToGo && hasDineInFeedback ? { dineInFeedback } : {})
      }));

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
    // Pass restaurant location to Home for map focus + pin drop animation
    const focusRestaurant = selectedRestaurant?.coordinates
      ? {
          lat: selectedRestaurant.coordinates.latitude,
          lng: selectedRestaurant.coordinates.longitude,
          id: selectedRestaurant.id,
          name: selectedRestaurant.name,
        }
      : undefined;

    resetDraft(false); // Clear all draft data
    navigate('/', {
      replace: true,
      state: focusRestaurant ? { focusRestaurant } : undefined,
    });
  };

  // Auto-redirect countdown effect
  useEffect(() => {
    if (!successIds) return;

    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          handleGoHome();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [successIds]);

  if (successIds) {
    return (
      <div className="space-y-6">
        {/* Confetti Effect */}
        <ConfettiEffect visible={true} />

        {/* Success Message */}
        <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-8 text-center shadow-md">
          <div className="text-4xl mb-4">✨</div>
          <h2 className="text-2xl font-semibold text-emerald-900 mb-2">
            Visit posted!
          </h2>
          <p className="text-emerald-700 mb-1">
            {successIds.length} dish review{successIds.length !== 1 ? 's' : ''} from your visit
          </p>
          <p className="text-sm text-emerald-600 mb-3">
            +XP awarded. Reward points pending verification.
          </p>
          <p className="text-xs text-emerald-500 mt-4">
            Redirecting to home in {countdown}s...
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
    <div className="space-y-6">
      {/* Lightweight Context Header */}
      <div className="space-y-3">
        <div>
          <p className="text-sm text-slate-500 mb-1">You're rating</p>
          <h1 className="text-2xl font-bold text-slate-900">
            {selectedRestaurant?.name}
          </h1>
          {selectedRestaurant?.address && (
            <p className="text-sm text-slate-600 mt-0.5">
              {selectedRestaurant.address}
            </p>
          )}
        </div>

        {/* Chips for Visit Type and Meal Time */}
        <div className="flex flex-wrap gap-2">
          {visitDraft.isToGo !== undefined && (
            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${
              visitDraft.isToGo
                ? 'bg-blue-100 text-blue-700'
                : 'bg-purple-100 text-purple-700'
            }`}>
              {visitDraft.isToGo ? '🍱 To-Go' : '🍽️ Dine-In'}
            </span>
          )}
          {visitDraft.mealTime && visitDraft.mealTime !== 'unspecified' && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700 capitalize">
              {visitDraft.mealTime.replace('_', ' ')}
            </span>
          )}
          {visitDraft.restaurantPriceLevel && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700">
              {visitDraft.restaurantPriceLevel}
            </span>
          )}
        </div>
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

            // Get taste tags
            const positiveTags = dish.explicit?.positiveTags || [];
            const negativeTags = dish.explicit?.negativeTags || [];

            return (
              <div
                key={dish.id}
                className="bg-white rounded-2xl border-2 border-slate-200 p-4 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="flex items-center gap-4">
                  {/* Left: Thumbnail */}
                  {thumbnailUrl ? (
                    <div className="flex-shrink-0 w-20 h-20 rounded-xl overflow-hidden bg-slate-100 border-2 border-slate-200">
                      <img
                        src={thumbnailUrl}
                        alt={dish.dishName}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ) : (
                    <div className="flex-shrink-0 w-20 h-20 rounded-xl bg-slate-100 border-2 border-slate-200 flex items-center justify-center">
                      <span className="text-3xl">🍽️</span>
                    </div>
                  )}

                  {/* Center: Dish Name & Category */}
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-bold text-slate-900 truncate">
                      {dish.dishName}
                    </h3>
                    {dish.dishCategory && (
                      <p className="text-sm text-slate-500 capitalize">{dish.dishCategory}</p>
                    )}
                  </div>

                  {/* Right: Rating */}
                  <div className="flex-shrink-0">
                    <div className="flex items-center justify-center bg-red-50 rounded-xl px-3 py-2 border-2 border-red-200">
                      <div className="text-2xl font-bold text-red-600">
                        {dish.rating.toFixed(1)}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Taste Tags */}
                {(positiveTags.length > 0 || negativeTags.length > 0) && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {positiveTags.slice(0, 3).map((tag, idx) => (
                      <span
                        key={`pos-${idx}`}
                        className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700"
                      >
                        ✓ {formatTagLabel(tag)}
                      </span>
                    ))}
                    {negativeTags.slice(0, 2).map((tag, idx) => (
                      <span
                        key={`neg-${idx}`}
                        className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-700"
                      >
                        ⚠ {formatTagLabel(tag)}
                      </span>
                    ))}
                  </div>
                )}

                {/* Caption if exists */}
                {dish.caption && (
                  <p className="mt-3 text-sm text-slate-700 italic bg-slate-50 rounded-lg p-2 border border-slate-200">
                    "{dish.caption}"
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Conditional To-Go Scorecard or Dine-In Feedback */}
      {visitDraft.isToGo === true ? (
        <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-2xl p-6 border-2 border-blue-200 shadow-md">
          <h2 className="text-lg font-bold text-blue-900 mb-2 flex items-center gap-2">
            🍱 To-Go Scorecard
          </h2>
          <p className="text-sm text-blue-700 mb-4">
            Help the restaurant improve their to-go experience
          </p>

          <div className="space-y-4">
            {/* Ready on time */}
            <div>
              <p className="text-sm font-semibold text-slate-800 mb-2">Ready on time?</p>
              <div className="flex gap-2">
                {(['poor', 'ok', 'great'] as const).map((score) => (
                  <button
                    key={score}
                    type="button"
                    onClick={() => setToGoFeedback(prev => ({ ...prev, readyOnTime: score }))}
                    className={`flex-1 px-3 py-2 rounded-xl text-sm font-medium transition-all ${
                      toGoFeedback.readyOnTime === score
                        ? 'bg-blue-600 text-white shadow-md scale-105'
                        : 'bg-white text-slate-700 hover:bg-blue-100 border border-blue-200'
                    }`}
                  >
                    {score === 'poor' && '😕 Poor'}
                    {score === 'ok' && '😐 OK'}
                    {score === 'great' && '😊 Great'}
                  </button>
                ))}
              </div>
            </div>

            {/* Order accurate */}
            <div>
              <p className="text-sm font-semibold text-slate-800 mb-2">Order accurate?</p>
              <div className="flex gap-2">
                {(['poor', 'ok', 'great'] as const).map((score) => (
                  <button
                    key={score}
                    type="button"
                    onClick={() => setToGoFeedback(prev => ({ ...prev, orderAccurate: score }))}
                    className={`flex-1 px-3 py-2 rounded-xl text-sm font-medium transition-all ${
                      toGoFeedback.orderAccurate === score
                        ? 'bg-blue-600 text-white shadow-md scale-105'
                        : 'bg-white text-slate-700 hover:bg-blue-100 border border-blue-200'
                    }`}
                  >
                    {score === 'poor' && '😕 Poor'}
                    {score === 'ok' && '😐 OK'}
                    {score === 'great' && '😊 Great'}
                  </button>
                ))}
              </div>
            </div>

            {/* Packaging quality */}
            <div>
              <p className="text-sm font-semibold text-slate-800 mb-2">Packaging quality?</p>
              <div className="flex gap-2">
                {(['poor', 'ok', 'great'] as const).map((score) => (
                  <button
                    key={score}
                    type="button"
                    onClick={() => setToGoFeedback(prev => ({ ...prev, packagingQuality: score }))}
                    className={`flex-1 px-3 py-2 rounded-xl text-sm font-medium transition-all ${
                      toGoFeedback.packagingQuality === score
                        ? 'bg-blue-600 text-white shadow-md scale-105'
                        : 'bg-white text-slate-700 hover:bg-blue-100 border border-blue-200'
                    }`}
                  >
                    {score === 'poor' && '😕 Poor'}
                    {score === 'ok' && '😐 OK'}
                    {score === 'great' && '😊 Great'}
                  </button>
                ))}
              </div>
            </div>

            {/* Food temperature */}
            <div>
              <p className="text-sm font-semibold text-slate-800 mb-2">Food temperature on arrival?</p>
              <div className="flex gap-2">
                {(['poor', 'ok', 'great'] as const).map((score) => (
                  <button
                    key={score}
                    type="button"
                    onClick={() => setToGoFeedback(prev => ({ ...prev, foodTemperature: score }))}
                    className={`flex-1 px-3 py-2 rounded-xl text-sm font-medium transition-all ${
                      toGoFeedback.foodTemperature === score
                        ? 'bg-blue-600 text-white shadow-md scale-105'
                        : 'bg-white text-slate-700 hover:bg-blue-100 border border-blue-200'
                    }`}
                  >
                    {score === 'poor' && '😕 Poor'}
                    {score === 'ok' && '😐 OK'}
                    {score === 'great' && '😊 Great'}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : visitDraft.isToGo === false ? (
        <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-2xl p-6 border-2 border-purple-200 shadow-md">
          <h2 className="text-lg font-bold text-purple-900 mb-2 flex items-center gap-2">
            🍽️ Service & Vibes
          </h2>
          <p className="text-sm text-purple-700 mb-4">
            Quick feedback on your dine-in experience
          </p>

          <div className="space-y-4">
            {/* Wait time */}
            <div>
              <p className="text-sm font-semibold text-slate-800 mb-2">How was the wait time?</p>
              <div className="flex gap-2">
                {[
                  { value: 'too_long' as const, label: '🐌 Too Long' },
                  { value: 'fine' as const, label: '👍 Fine' },
                  { value: 'fast' as const, label: '⚡ Fast' }
                ].map(({ value, label }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setDineInFeedback(prev => ({ ...prev, waitTime: value }))}
                    className={`flex-1 px-3 py-2 rounded-xl text-sm font-medium transition-all ${
                      dineInFeedback.waitTime === value
                        ? 'bg-purple-600 text-white shadow-md scale-105'
                        : 'bg-white text-slate-700 hover:bg-purple-100 border border-purple-200'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Staff friendliness */}
            <div>
              <p className="text-sm font-semibold text-slate-800 mb-2">Staff friendliness?</p>
              <div className="flex gap-2">
                {[
                  { value: 'low' as const, label: '😕 Low' },
                  { value: 'ok' as const, label: '😐 OK' },
                  { value: 'great' as const, label: '😊 Great' }
                ].map(({ value, label }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setDineInFeedback(prev => ({ ...prev, staffFriendliness: value }))}
                    className={`flex-1 px-3 py-2 rounded-xl text-sm font-medium transition-all ${
                      dineInFeedback.staffFriendliness === value
                        ? 'bg-purple-600 text-white shadow-md scale-105'
                        : 'bg-white text-slate-700 hover:bg-purple-100 border border-purple-200'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Noise level */}
            <div>
              <p className="text-sm font-semibold text-slate-800 mb-2">Noise level?</p>
              <div className="flex gap-2">
                {[
                  { value: 'too_loud' as const, label: '📢 Too Loud' },
                  { value: 'fine' as const, label: '👌 Fine' },
                  { value: 'quiet' as const, label: '🤫 Quiet' }
                ].map(({ value, label }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setDineInFeedback(prev => ({ ...prev, noiseLevel: value }))}
                    className={`flex-1 px-3 py-2 rounded-xl text-sm font-medium transition-all ${
                      dineInFeedback.noiseLevel === value
                        ? 'bg-purple-600 text-white shadow-md scale-105'
                        : 'bg-white text-slate-700 hover:bg-purple-100 border border-purple-200'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* Business Highlight Tags & Owner Message */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 space-y-6">
        {/* What stood out? */}
        <div>
          <h2 className="text-lg font-semibold text-slate-900 mb-2">What stood out?</h2>
          <p className="text-xs text-slate-500 mb-3">Select up to {MAX_BUSINESS_TAGS} highlights</p>
          <div className="flex flex-wrap gap-2">
            {BUSINESS_TAGS.map(tag => {
              const isSelected = selectedBusinessTags.includes(tag);
              const isMaxed = selectedBusinessTags.length >= MAX_BUSINESS_TAGS && !isSelected;
              return (
                <button
                  key={tag}
                  type="button"
                  onClick={() => toggleBusinessTag(tag)}
                  disabled={isMaxed}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                    isSelected
                      ? 'bg-green-100 text-green-700 shadow-sm'
                      : isMaxed
                        ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {tag}
                </button>
              );
            })}
          </div>
        </div>

        {/* What could be better? (Lowlights) */}
        <div>
          <h2 className="text-lg font-semibold text-slate-900 mb-2">Any lowlights?</h2>
          <p className="text-xs text-slate-500 mb-3">Select up to {MAX_BUSINESS_LOWLIGHTS} lowlights (optional)</p>
          <div className="flex flex-wrap gap-2">
            {BUSINESS_LOWLIGHTS.map(tag => {
              const isSelected = selectedBusinessLowlights.includes(tag);
              const isMaxed = selectedBusinessLowlights.length >= MAX_BUSINESS_LOWLIGHTS && !isSelected;
              return (
                <button
                  key={tag}
                  type="button"
                  onClick={() => toggleBusinessLowlight(tag)}
                  disabled={isMaxed}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                    isSelected
                      ? 'bg-red-100 text-red-700 shadow-sm'
                      : isMaxed
                        ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
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
