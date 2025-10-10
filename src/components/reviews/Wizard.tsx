import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { collection, doc, writeBatch, serverTimestamp } from 'firebase/firestore';
import { saveReview, type ReviewData } from '../../services/reviewService';
import { db, getCurrentUser } from '../../lib/firebase';
import { useI18n } from '../../lib/i18n/useI18n';
import ProgressBar from './ProgressBar';
import Step1Basic from './Step1Basic';
import Step2Taste from './Step2Taste';
import Step3Compare from './Step3Compare';
import Step3Caption from './Step3Caption';
import Step4Outcome from './Step4Outcome';
import RewardToast from './RewardToast';
import { fileToPreview, processAndUploadImage, processAndUploadVideo, revokePreview } from '../../lib/media';
import { ReviewDraft } from '../../dev/types/review';
import { DishOption, LocalMediaItem, RestaurantOption, WizardContextValue, WizardStepKey } from './types';
import { WizardContext } from './WizardContext';
import { useFeature } from '../../utils/features';

const buildStorageKey = (uid: string, restaurantId?: string | null) => `review-draft:${uid}:${restaurantId || 'new'}`;

const safeId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2);
};

const sanitizeCuisinesInput = (value?: unknown): string[] | undefined => {
  if (!value) return undefined;

  const toArray = (): string[] => {
    if (Array.isArray(value)) return value as string[];
    if (typeof value === 'string') return value.split(',');
    return [String(value)];
  };

  const cleaned = toArray()
    .map((entry) => (typeof entry === 'string' ? entry : String(entry || '')))
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);

  if (!cleaned.length) return undefined;
  return Array.from(new Set(cleaned));
};

const extractRestaurantCuisines = (restaurant?: Partial<RestaurantOption> | null): string[] | undefined => {
  if (!restaurant) return undefined;
  return sanitizeCuisinesInput((restaurant as any).cuisines ?? (restaurant as any).cuisine);
};

const mapLegacyLevel = (attribute: string, level?: string): string | undefined => {
  if (!level) return undefined;
  const normalized = level.toLowerCase();
  switch (attribute) {
    case 'portion':
      if (normalized === 'right') return 'just_right';
      if (normalized === 'big') return 'generous';
      return normalized;
    case 'freshness':
      if (normalized === 'low') return 'not_fresh';
      if (normalized === 'balanced') return 'just_right';
      if (normalized === 'high') return 'very_fresh';
      return normalized;
    case 'saltiness':
      if (normalized === 'low') return 'needs_more_salt';
      if (normalized === 'balanced') return 'balanced';
      if (normalized === 'high') return 'too_salty';
      return normalized;
    case 'temperature':
      if (normalized === 'low') return 'needs_reheating';
      if (normalized === 'balanced') return 'ideal';
      if (normalized === 'high') return 'too_hot';
      return normalized;
    case 'texture':
      if (normalized === 'low') return 'mushy';
      if (normalized === 'balanced') return 'great_bite';
      if (normalized === 'high') return 'tough';
      return normalized;
    case 'spiciness':
      if (normalized === 'low') return 'lacked_kick';
      if (normalized === 'balanced') return 'nice_warmth';
      if (normalized === 'high') return 'too_spicy';
      return normalized;
    default:
      return normalized;
  }
};

const ensureAttribute = <L extends string>(attribute: string, input: any, fallback: L): { level: L; note?: string } => {
  const mapped = mapLegacyLevel(attribute, input?.level) as L | undefined;
  return {
    level: mapped ?? fallback,
    note: typeof input?.note === 'string' ? input.note : undefined
  };
};

const ensureOptionalAttribute = <L extends string>(attribute: string, input: any): { level: L; note?: string } | undefined => {
  if (!input || !(typeof input === 'object')) return undefined;
  const mapped = mapLegacyLevel(attribute, (input as any).level) as L | undefined;
  if (!mapped) return undefined;
  return {
    level: mapped,
    note: typeof (input as any).note === 'string' ? (input as any).note : undefined
  };
};

const ensureDraftShape = (draft: ReviewDraft): ReviewDraft => {
  const taste = draft.taste || ({} as ReviewDraft['taste']);
  const cuisines = sanitizeCuisinesInput(draft.cuisines) ?? sanitizeCuisinesInput(draft.restaurantCuisines);

  const normalized: ReviewDraft = {
    userId: draft.userId,
    restaurantId: draft.restaurantId,
    restaurantCuisines: cuisines,
    cuisines,
    dishId: draft.dishId,
    dishName: draft.dishName || '',
    dishCategory: draft.dishCategory,
    rating: draft.rating || 7.5,
    dishTag: draft.dishTag,
    caption: typeof draft.caption === 'string' ? draft.caption : undefined,
    media: {
      photos: draft.media?.photos || [],
      videos: draft.media?.videos || [],
      thumbnails: draft.media?.thumbnails || []
    },
    taste: {
      portion: ensureAttribute('portion', taste.portion, 'just_right'),
      value: ensureAttribute('value', taste.value, 'fair'),
      presentation: ensureAttribute('presentation', taste.presentation, 'clean'),
      freshness: ensureAttribute('freshness', taste.freshness, 'just_right'),
      saltiness: ensureOptionalAttribute('saltiness', taste.saltiness),
      temperature: ensureOptionalAttribute('temperature', taste.temperature),
      texture: ensureOptionalAttribute('texture', taste.texture),
      spiciness: ensureOptionalAttribute('spiciness', taste.spiciness)
    },
    comparison: draft.comparison,
    outcome: {
      orderAgain: draft.outcome?.orderAgain ?? true,
      recommend: draft.outcome?.recommend ?? true,
      audience: draft.outcome?.audience || [],
      returnIntent: draft.outcome?.returnIntent || 'for_this'
    },
    createdAt: draft.createdAt,
    updatedAt: draft.updatedAt,
    isDeleted: draft.isDeleted
  };

  return normalized;
};

const buildInitialDraft = (userId: string): ReviewDraft => ensureDraftShape({
  userId,
  dishName: '',
  rating: 7.5,
  media: { photos: [], videos: [], thumbnails: [] },
  taste: {
    portion: { level: 'just_right' },
    value: { level: 'fair' },
    presentation: { level: 'clean' },
    freshness: { level: 'just_right' }
  },
  outcome: {
    orderAgain: true,
    recommend: true,
    audience: [],
    returnIntent: 'for_this'
  }
} as ReviewDraft);

const STEP_COMPONENTS: Record<WizardStepKey, React.ComponentType> = {
  basic: Step1Basic,
  taste: Step2Taste,
  compare: Step3Compare,
  caption: Step3Caption,
  outcome: Step4Outcome
};

const Wizard: React.FC = () => {
  const { t, language } = useI18n();
  const newCreateFlowEnabled = useFeature('NEW_CREATE_FLOW');
  const newCreateV2Enabled = useFeature('NEW_CREATE_V2');
  const useCaptionStep = newCreateFlowEnabled && newCreateV2Enabled;

  const [userId, setUserId] = useState<string>('');
  const [authChecked, setAuthChecked] = useState(false);
  const [draft, setDraft] = useState<ReviewDraft>(() => buildInitialDraft(''));
  const [mediaItems, setMediaItems] = useState<LocalMediaItem[]>([]);
  const mediaItemsRef = useRef<LocalMediaItem[]>([]);
  const [selectedRestaurant, setSelectedRestaurant] = useState<RestaurantOption | null>(null);
  const [selectedDish, setSelectedDish] = useState<DishOption | null>(null);
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [rewardToast, setRewardToast] = useState<{ key: 'taste' | 'compare' | 'submit' | 'media'; message: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [autosaveState, setAutosaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const autosaveTimeout = useRef<number>();
  const lastStorageKeyRef = useRef<string | null>(null);
  const rewardHistoryRef = useRef<Record<'taste' | 'compare' | 'submit' | 'media', boolean>>({ media: false, taste: false, compare: false, submit: false });

  useEffect(() => {
    const user = getCurrentUser();
    if (user) {
      setUserId(user.uid);
      setDraft((prev) => ensureDraftShape({ ...prev, userId: user.uid }));
    }
    setAuthChecked(true);
  }, []);

  const rewardMessages = useMemo(() => ({
    taste: t('reward.tasteBonus'),
    compare: t('reward.compareBonus'),
    submit: t('reward.submitBonus'),
    media: t('reward.mediaBonus')
  }), [t, language]);

  const pendingUploads = useMemo(() => mediaItems.some((item) => item.status === 'uploading'), [mediaItems]);

  useEffect(() => {
    mediaItemsRef.current = mediaItems;
  }, [mediaItems]);

  const updateDraft = useCallback((updater: (draftState: ReviewDraft) => ReviewDraft) => {
    setDraft((prev) => ensureDraftShape(updater(ensureDraftShape(prev))));
  }, []);

  const showReward = useCallback((key: 'taste' | 'compare' | 'submit' | 'media') => {
    if (rewardHistoryRef.current[key]) return;
    rewardHistoryRef.current[key] = true;
    const message = rewardMessages[key];
    if (message) {
      setRewardToast({ key, message });
    }
  }, [rewardMessages]);

  const selectRestaurant = useCallback(
    (restaurant: RestaurantOption | null, options?: { restoreDraft?: boolean }) => {
      setSelectedRestaurant(restaurant);
      setSelectedDish(null);

      if (!restaurant) {
        updateDraft((prev) => ({
          ...prev,
          restaurantId: undefined,
          restaurantCuisines: undefined,
          cuisines: undefined,
          dishId: undefined,
          dishName: ''
        }));
        return;
      }

      const cuisines = extractRestaurantCuisines(restaurant);
      const restore = options?.restoreDraft ?? true;
      if (userId && restore) {
        try {
          const stored = localStorage.getItem(buildStorageKey(userId, restaurant.id));
          if (stored) {
            const parsed = ensureDraftShape(JSON.parse(stored));
            parsed.userId = userId;
            parsed.restaurantId = restaurant.id;
            parsed.restaurantCuisines = cuisines ?? parsed.restaurantCuisines;
            parsed.cuisines = cuisines ?? parsed.cuisines;
            setDraft(parsed);
            return;
          }
        } catch (error) {
          console.warn('Failed to restore draft for restaurant', error);
        }
      }

      updateDraft((prev) => ({
        ...prev,
        restaurantId: restaurant.id,
        restaurantCuisines: cuisines,
        cuisines: cuisines,
        dishId: undefined,
        dishName: ''
      }));
    },
    [updateDraft, userId]
  );

  const selectDish = useCallback((dish: DishOption | null) => {
    setSelectedDish(dish);
    updateDraft((prev) => ({
      ...prev,
      dishId: dish?.id,
      dishName: dish?.name || prev.dishName
    }));
  }, [updateDraft]);

  useEffect(() => {
    if (!userId) return;
    try {
      const stored = localStorage.getItem(buildStorageKey(userId, null));
      if (stored) {
        const parsed = ensureDraftShape(JSON.parse(stored));
        parsed.userId = userId;
        setDraft(parsed);
        setAutosaveState('saved');
      }
    } catch (error) {
      console.warn('Failed to load saved draft', error);
    }
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    const key = buildStorageKey(userId, draft.restaurantId);
    if (lastStorageKeyRef.current && lastStorageKeyRef.current !== key) {
      try {
        localStorage.removeItem(lastStorageKeyRef.current);
      } catch (error) {
        console.warn('Failed to remove old draft key', error);
      }
    }
    lastStorageKeyRef.current = key;

    window.clearTimeout(autosaveTimeout.current);
    setAutosaveState('saving');
    autosaveTimeout.current = window.setTimeout(() => {
      try {
        localStorage.setItem(key, JSON.stringify(draft));
        setAutosaveState('saved');
      } catch (error) {
        console.warn('Failed to save draft', error);
        setAutosaveState('error');
      }
    }, 400);

    return () => window.clearTimeout(autosaveTimeout.current);
  }, [draft, userId]);

  useEffect(() => () => {
    mediaItemsRef.current.forEach((item) => revokePreview(item.previewUrl));
  }, []);

  const removeMedia = useCallback((id: string) => {
    let removed: LocalMediaItem | undefined;
    setMediaItems((prev) => {
      removed = prev.find((item) => item.id === id);
      if (removed) {
        revokePreview(removed.previewUrl);
      }
      return prev.filter((item) => item.id !== id);
    });
    if (!removed) return;
    updateDraft((prev) => ({
      ...prev,
      media: {
        photos: removed?.kind === 'photo' && removed.storagePath
          ? prev.media.photos.filter((path) => path !== removed?.storagePath)
          : prev.media.photos,
        videos: removed?.kind === 'video' && removed.storagePath
          ? prev.media.videos.filter((path) => path !== removed?.storagePath)
          : prev.media.videos,
        thumbnails: removed?.thumbnailPath
          ? prev.media.thumbnails.filter((path) => path !== removed?.thumbnailPath)
          : prev.media.thumbnails
      }
    }));
  }, [updateDraft]);

  const uploadMedia = useCallback(async (files: File[]) => {
    if (!userId) {
      throw new Error('User must be signed in to upload media');
    }

    await Promise.all(
      files.map(async (file) => {
        const kind: LocalMediaItem['kind'] = file.type.startsWith('video') ? 'video' : 'photo';
        if (kind === 'photo' && !file.type.startsWith('image')) {
          return;
        }
        const id = safeId();
        const previewUrl = fileToPreview(file);
        setMediaItems((prev) => ([
          ...prev,
          {
            id,
            kind,
            previewUrl,
            status: 'uploading'
          }
        ]));

        try {
          if (kind === 'photo') {
            const upload = await processAndUploadImage(file, userId);
            setMediaItems((prev) => prev.map((item) => item.id === id ? {
              ...item,
              status: 'uploaded',
              storagePath: upload.storagePath,
              downloadURL: upload.downloadURL
            } : item));
            updateDraft((prev) => ({
              ...prev,
              media: {
                ...prev.media,
                photos: [...prev.media.photos, upload.downloadURL]
              }
            }));
            showReward('media');
          } else {
            const uploads = await processAndUploadVideo(file, userId);
            setMediaItems((prev) => prev.map((item) => item.id === id ? {
              ...item,
              status: 'uploaded',
              storagePath: uploads.video.storagePath,
              downloadURL: uploads.video.downloadURL,
              thumbnailPath: uploads.thumbnail.storagePath,
              thumbnailURL: uploads.thumbnail.downloadURL
            } : item));
            updateDraft((prev) => ({
              ...prev,
              media: {
                photos: prev.media.photos,
                videos: [...prev.media.videos, uploads.video.downloadURL],
                thumbnails: [...prev.media.thumbnails, uploads.thumbnail.downloadURL]
              }
            }));
          }
        } catch (error) {
          console.error('Media upload failed', error);
          setMediaItems((prev) => prev.map((item) => item.id === id ? {
            ...item,
            status: 'error',
            error: error instanceof Error ? error.message : 'Upload failed'
          } : item));
        }
      })
    );
  }, [showReward, updateDraft, userId]);

  const goNext = useCallback(() => {
    setCurrentStep((step) => Math.min(step + 1, 3));
  }, []);

  const goBack = useCallback(() => {
    setCurrentStep((step) => Math.max(step - 1, 0));
  }, []);

  const resetDraft = useCallback((keepRestaurant?: boolean) => {
    if (!userId) return;
    const fresh = buildInitialDraft(userId);
    if (keepRestaurant && selectedRestaurant) {
      fresh.restaurantId = selectedRestaurant.id;
      const cuisines = extractRestaurantCuisines(selectedRestaurant);
      fresh.restaurantCuisines = cuisines;
      fresh.cuisines = cuisines;
    }
    setDraft(fresh);
    setMediaItems((prev) => {
      prev.forEach((item) => revokePreview(item.previewUrl));
      return [];
    });
    setSelectedDish(null);
    if (!keepRestaurant) {
      setSelectedRestaurant(null);
    }
    setCurrentStep(0);
    rewardHistoryRef.current = { media: false, taste: false, compare: false, submit: false };
  }, [selectedRestaurant, userId]);

  const submitReview = useCallback(async () => {
    if (!userId) throw new Error('User must be signed in');
    const normalizedDraft = ensureDraftShape(draft);
    if (!normalizedDraft.dishCategory) {
      throw new Error('Dish category is required');
    }

    const { comparison, caption, restaurantCuisines, cuisines: draftCuisines, ...restDraft } = normalizedDraft;
    const sanitizedCaption = caption?.trim();
    const cuisines = sanitizeCuisinesInput(draftCuisines) ?? sanitizeCuisinesInput(restaurantCuisines);

    // Build ReviewData payload for saveReview so we get proper menuItemId linkage
    const reviewData: ReviewData & { caption?: string } = {
      restaurant: selectedRestaurant?.name || (restDraft as any).restaurant || 'Unknown Restaurant',
      location: (selectedRestaurant as any)?.address || (restDraft as any).location || '',
      dish: restDraft.dishName || (selectedDish as any)?.name || 'Unknown Dish',
      rating: restDraft.rating,
      personalNote: (restDraft as any).personalNote || '',
      negativeNote: (restDraft as any).negativeNote || '',
      serverRating: (restDraft as any).serverRating ?? null,
      price: (restDraft as any).price ?? null,
      tags: Array.isArray((restDraft as any).tags) ? (restDraft as any).tags : [],
      restaurantCuisines: cuisines,
      cuisines: cuisines,
      images: Array.isArray(restDraft.media?.photos) ? restDraft.media!.photos : [],
      isPublic: true,
      caption: sanitizedCaption,
    };

    const reviewId = await saveReview(reviewData, selectedRestaurant, selectedDish);
    try {
      localStorage.removeItem(buildStorageKey(userId, draft.restaurantId));
    } catch (error) {
      console.warn('Failed to clear draft storage', error);
    }
    showReward('submit');
    return reviewId;
  }, [draft, showReward, userId, useCaptionStep, selectedRestaurant, selectedDish]);

  const contextValue = useMemo<WizardContextValue>(() => ({
    draft,
    updateDraft,
    mediaItems,
    setMediaItems,
    uploadMedia,
    removeMedia,
    pendingUploads,
    selectedRestaurant,
    selectRestaurant,
    selectedDish,
    selectDish,
    userId,
    setStep: setCurrentStep,
    currentStep,
    goNext,
    goBack,
    showReward,
    isSubmitting,
    setIsSubmitting,
    resetDraft,
    submitReview,
    autosaveState
  }), [draft, mediaItems, uploadMedia, removeMedia, pendingUploads, selectedRestaurant, selectRestaurant, selectedDish, selectDish, userId, currentStep, goNext, goBack, showReward, isSubmitting, resetDraft, submitReview, autosaveState]);

  const stepOrder = useMemo<WizardStepKey[]>(() => (
    useCaptionStep ? ['basic', 'taste', 'caption', 'outcome'] : ['basic', 'taste', 'compare', 'outcome']
  ), [useCaptionStep]);

  const steps = useMemo(() => stepOrder.map((key) => ({
    key,
    label: t(`createWizard.steps.${key}.title`)
  })), [stepOrder, t, language]);

  const StepComponent = STEP_COMPONENTS[steps[currentStep].key];

  if (!authChecked) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-slate-500">
        Loading...
      </div>
    );
  }

  if (!userId) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-center">
        <h2 className="text-xl font-semibold text-slate-800">Please sign in to create a review</h2>
      </div>
    );
  }

  return (
    <WizardContext.Provider value={contextValue}>
      <div className="mx-auto w-full max-w-3xl px-4 pt-16 pb-24">
        <div className="sticky top-0 z-10 bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/70">
          <div className="flex items-center justify-between py-4">
            <div>
              <h1 className="text-2xl font-semibold text-slate-900">{t('createWizard.title')}</h1>
              <p className="text-sm text-slate-500 mb-4">{t('createWizard.subtitle')}</p>
            </div>
            <span className={`text-xs font-medium ${autosaveState === 'saved' ? 'text-emerald-500' : autosaveState === 'error' ? 'text-red-500' : 'text-slate-400'}`}>
              {autosaveState === 'saving' && t('createWizard.status.autosaving')}
              {autosaveState === 'saved' && t('createWizard.status.saved')}
              {autosaveState === 'error' && t('createWizard.status.error')}
            </span>
          </div>
          <div className="mb-6"><ProgressBar steps={steps} currentStep={currentStep} /></div>
        </div>
        <AnimatePresence mode="wait">
          <motion.div
            key={steps[currentStep].key}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.24, ease: 'easeOut' }}
          >
            <StepComponent />
          </motion.div>
        </AnimatePresence>
      </div>
      <RewardToast
        message={rewardToast?.message || ''}
        visible={Boolean(rewardToast)}
        onDismiss={() => setRewardToast(null)}
      />
    </WizardContext.Provider>
  );
};

export default Wizard;






























