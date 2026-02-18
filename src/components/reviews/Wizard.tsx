import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { saveReview, type ReviewData, buildReviewCreatePayload } from '../../services/reviewService';
import { db, getCurrentUser, getUserProfile } from '../../lib/firebase';
import { useI18n } from '../../lib/i18n/useI18n';
import ProgressBar from './ProgressBar';
import StepVisit from './StepVisit';
import StepDishes from './StepDishes';
import StepWrapUp from './StepWrapUp';
import RewardToast from './RewardToast';
import { fileToPreview, processAndUploadImage, processAndUploadVideo, revokePreview } from '../../lib/media';
import { ReviewDraft, VisitDraft, DishDraft, DishCategory, MealTimeTag } from '../../dev/types/review';
import { LocalMediaItem, RestaurantOption, WizardContextValue, WizardStepKey, MultiDishCreateState, MediaItemDraft, WizardUIState } from './types';
import { WizardContext } from './WizardContext';
import { useFeature } from '../../utils/features';
import { buildExplicitTags, buildDerivedTags, buildMealTimeTags, buildServiceSpeedTags } from '../../data/tagDefinitions';
import { useReviewStore } from '../../stores/reviewStore';

const buildStorageKey = (uid: string, restaurantId?: string | null) => `review-visit-draft:${uid}:${restaurantId || 'new'}`;

const safeId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2);
};

const generateVisitId = (): string => {
  return `visit_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
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

const normalizeStringArray = (value?: unknown): string[] => {
  if (!value) return [];
  const toArray = Array.isArray(value) ? value : [value];
  const normalized = toArray
    .map((entry) => (typeof entry === 'string' ? entry : String(entry || '')))
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
  return Array.from(new Set(normalized));
};

const normalizeExplicitSelections = (input?: ReviewDraft['explicit']): ReviewDraft['explicit'] | undefined => {
  if (!input) return undefined;
  const normalized = {
    dishType: typeof input.dishType === 'string' && input.dishType.trim() ? input.dishType.trim().toLowerCase() : null,
    dishStyle: typeof input.dishStyle === 'string' && input.dishStyle.trim() ? input.dishStyle.trim().toLowerCase() : null,
    cuisine: typeof input.cuisine === 'string' && input.cuisine.trim() ? input.cuisine.trim().toLowerCase() : null,
    attributes: normalizeStringArray(input.attributes),
    occasions: normalizeStringArray(input.occasions),
    dietary: normalizeStringArray(input.dietary)
  };

  const hasData = Boolean(
    normalized.dishType ||
    normalized.dishStyle ||
    normalized.cuisine ||
    normalized.attributes.length ||
    normalized.occasions.length ||
    normalized.dietary.length
  );

  return hasData ? normalized : undefined;
};

const normalizeMealTimes = (input?: MealTimeTag[] | string): MealTimeTag[] | undefined => {
  if (!input) return undefined;
  if (typeof input === 'string') {
    return input && input !== 'unspecified' ? [input as MealTimeTag] : undefined;
  }
  if (!Array.isArray(input) || input.length === 0) return undefined;
  const valid = input.filter(v => typeof v === 'string' && v.length > 0);
  return valid.length > 0 ? (valid as MealTimeTag[]) : undefined;
};

const normalizeServiceSpeed = (input?: any): any => {
  if (!input) return undefined;
  if (typeof input === 'string' && ['fast', 'normal', 'slow'].includes(input)) {
    return input;
  }
  return undefined;
};

const buildInitialVisitDraft = (): VisitDraft => ({
  mealTime: undefined,
  overallText: undefined,
  serviceSpeed: null,
  restaurantPriceLevel: null,
});

const buildInitialDishDraft = (dishCuisine?: string): DishDraft => ({
  id: safeId(),
  mediaIds: [],
  dishName: '',
  dishCategory: undefined,
  dishCuisine: dishCuisine || undefined,
  rating: 7.5,
  explicit: undefined,
  sentiment: undefined,
  outcome: {
    orderAgain: true,
    recommend: true,
    audience: [],
    returnIntent: 'for_this'
  },
  caption: undefined,
});

const normalizeDishDraft = (draft: DishDraft): DishDraft => ({
  ...draft,
  mediaIds: Array.from(new Set((draft.mediaIds || []).filter(Boolean))),
});

// Helper to build MediaBundle for a dish based on attached media
const buildMediaBundleForDish = (dish: DishDraft, mediaItems: LocalMediaItem[]): ReviewDraft['media'] => {
  const photos: string[] = [];
  const photoObjects: any[] = []; // Will store MediaObject[]
  const videos: string[] = [];
  const thumbnails: string[] = [];

  dish.mediaIds.forEach(mediaId => {
    const media = mediaItems.find(m => m.id === mediaId);
    if (media && media.downloadURL) {
      if (media.kind === 'photo') {
        photos.push(media.downloadURL);
        // Generate thumbnail URLs using Firebase Resize Images extension convention
        const urlParts = media.downloadURL.split('?');
        const basePath = urlParts[0];
        const queryParams = urlParts[1] ? `?${urlParts[1]}` : '';
        const lastDotIndex = basePath.lastIndexOf('.');

        if (lastDotIndex !== -1) {
          const baseWithoutExt = basePath.substring(0, lastDotIndex);
          const ext = basePath.substring(lastDotIndex);

          photoObjects.push({
            original: media.downloadURL,
            thumbnail: `${baseWithoutExt}_200x200${ext}${queryParams}`,
            medium: `${baseWithoutExt}_800x800${ext}${queryParams}`
          });
        } else {
          // Fallback if no extension found
          photoObjects.push({
            original: media.downloadURL,
            thumbnail: media.downloadURL,
            medium: media.downloadURL
          });
        }
      } else if (media.kind === 'video') {
        videos.push(media.downloadURL);
        if (media.thumbnailURL) {
          thumbnails.push(media.thumbnailURL);
        }
      }
    }
  });

  return { photos, photoObjects, videos, thumbnails };
};

const STEP_COMPONENTS: Record<WizardStepKey, React.ComponentType> = {
  visit: StepVisit,
  dishes: StepDishes,
  wrapup: StepWrapUp,
};

const Wizard: React.FC = () => {
  const { t, language } = useI18n();
  const { clearCache } = useReviewStore();

  const [userId, setUserId] = useState<string>('');
  const [authChecked, setAuthChecked] = useState(false);
  const [isNewUser, setIsNewUser] = useState(false);
  const [visitDraft, setVisitDraft] = useState<VisitDraft>(buildInitialVisitDraft());
  const [dishDrafts, setDishDraftsState] = useState<DishDraft[]>([buildInitialDishDraft()]);
  const setDishDrafts = useCallback((updater: React.SetStateAction<DishDraft[]>) => {
    setDishDraftsState((prev) => {
      const next = typeof updater === 'function' ? (updater as (state: DishDraft[]) => DishDraft[])(prev) : updater;
      return next.map(normalizeDishDraft);
    });
  }, [setDishDraftsState]);

  const [activeDishIndex, setActiveDishIndex] = useState(0);
  const [mediaItems, setMediaItems] = useState<LocalMediaItem[]>([]);
  const mediaItemsRef = useRef<LocalMediaItem[]>([]);
  const [selectedRestaurant, setSelectedRestaurant] = useState<RestaurantOption | null>(null);
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [rewardToast, setRewardToast] = useState<{ key: 'taste' | 'compare' | 'submit' | 'media' | 'dishes'; message: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [autosaveState, setAutosaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [expandedDishIds, setExpandedDishIds] = useState<string[]>([]);
  const [showHowItWorks, setShowHowItWorks] = useState(true);
  const autosaveTimeout = useRef<number>();
  const lastStorageKeyRef = useRef<string | null>(null);
  const submissionCompleteRef = useRef(false);
  const rewardHistoryRef = useRef<Record<'taste' | 'compare' | 'submit' | 'media' | 'dishes', boolean>>({
    media: false,
    taste: false,
    compare: false,
    submit: false,
    dishes: false,
  });

  useEffect(() => {
    const user = getCurrentUser();
    if (user) {
      setUserId(user.uid);
    }
    setAuthChecked(true);
  }, []);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    const loadProfile = async () => {
      try {
        const result = await getUserProfile();
        if (cancelled) return;
        const totalReviews = result.success && result.profile
          ? (result.profile.stats?.totalReviews ?? 0)
          : 0;
        setIsNewUser(totalReviews === 0);
      } catch {
        if (!cancelled) {
          setIsNewUser(false);
        }
      }
    };
    loadProfile();
    return () => {
      cancelled = true;
    };
  }, [userId]);


  const rewardMessages = useMemo(() => ({
    taste: t('reward.tasteBonus'),
    compare: t('reward.compareBonus'),
    submit: t('reward.submitBonus'),
    media: t('reward.mediaBonus'),
    dishes: t('reward.dishBonus') || 'Great! Now describe what you ordered.',
  }), [t, language]);

  const pendingUploadCount = useMemo(
    () => mediaItems.filter((item) => item.status === 'uploading').length,
    [mediaItems]
  );
  const pendingUploads = pendingUploadCount > 0;

  useEffect(() => {
    mediaItemsRef.current = mediaItems;
  }, [mediaItems]);

  const showReward = useCallback((key: 'taste' | 'compare' | 'submit' | 'media' | 'dishes') => {
    if (rewardHistoryRef.current[key]) return;
    rewardHistoryRef.current[key] = true;
    const message = rewardMessages[key];
    if (message) {
      setRewardToast({ key, message });
    }
  }, [rewardMessages]);

  const updateDishDraft = useCallback((id: string, updater: (draft: DishDraft) => DishDraft) => {
    setDishDrafts(prev =>
      prev.map(dish => dish.id === id ? updater(dish) : dish)
    );
  }, [setDishDrafts]);

  const selectRestaurant = useCallback(
    (restaurant: RestaurantOption | null, options?: { restoreDraft?: boolean }) => {
      setSelectedRestaurant(restaurant);

      if (!restaurant) {
        setVisitDraft(buildInitialVisitDraft());
        setDishDrafts([buildInitialDishDraft()]);
        setActiveDishIndex(0);
        return;
      }

      const cuisines = extractRestaurantCuisines(restaurant);
      const restore = options?.restoreDraft ?? true;
      if (userId && restore) {
        try {
          const stored = localStorage.getItem(buildStorageKey(userId, restaurant.id));
          if (stored) {
            const parsed = JSON.parse(stored) as MultiDishCreateState;
            setVisitDraft({ ...parsed.visit, restaurantId: restaurant.id });
            setDishDrafts(parsed.dishes);
            setActiveDishIndex(0);
            return;
          }
        } catch (error) {
          console.warn('Failed to restore draft for restaurant', error);
        }
      }

      // Fresh state for new restaurant
      setVisitDraft({
        restaurantId: restaurant.id,
        restaurantName: restaurant.name,
        restaurantAddress: (restaurant as any).address,
        restaurantPriceLevel: null,
        mealTime: undefined,
        overallText: undefined,
        serviceSpeed: null,
      });
      setDishDrafts([buildInitialDishDraft(cuisines?.[0])]);
      setActiveDishIndex(0);
    },
    [setDishDrafts, userId]
  );

  useEffect(() => {
    if (!userId) return;
    // Skip restoration if submission just completed
    if (submissionCompleteRef.current) return;
    try {
      const stored = localStorage.getItem(buildStorageKey(userId, null));
      if (stored) {
        const parsed = JSON.parse(stored) as MultiDishCreateState;

        // Restore visit and dishes
        setVisitDraft(parsed.visit);
        setDishDrafts(parsed.dishes);

        // Restore media items
        if (parsed.mediaItems && parsed.mediaItems.length > 0) {
          const restoredMedia: LocalMediaItem[] = parsed.mediaItems
            .filter(m => m.downloadURL && !m.downloadURL.startsWith('blob:')) // Validate URLs
            .map(m => ({
              id: m.id,
              kind: m.kind,
              previewUrl: m.downloadURL,  // Use Firebase URL as preview
              downloadURL: m.downloadURL,
              storagePath: m.storagePath,
              status: 'uploaded' as const
            }));
          setMediaItems(restoredMedia);
        }

        // Restore UI state
        if (parsed.uiState) {
          setCurrentStep(parsed.uiState.currentStep);
          setActiveDishIndex(parsed.uiState.activeDishIndex);
          setExpandedDishIds(parsed.uiState.expandedDishIds || []);
        }

        setAutosaveState('saved');
      }
    } catch (error) {
      console.warn('Failed to load saved draft', error);
    }
  }, [setDishDrafts, userId]);

  useEffect(() => {
    if (!userId) return;
    // Skip autosave if submission just completed
    if (submissionCompleteRef.current) return;

    const key = buildStorageKey(userId, visitDraft.restaurantId);
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
        // Build media items draft (only uploaded with Firebase URLs)
        const mediaItemsDraft: MediaItemDraft[] = mediaItems
          .filter(m => {
            // CRITICAL: Only save uploaded media with valid Firebase URLs
            return m.status === 'uploaded' &&
                   m.downloadURL &&
                   !m.downloadURL.startsWith('blob:'); // Explicitly filter blob URLs
          })
          .map(m => ({
            id: m.id,
            kind: m.kind,
            downloadURL: m.downloadURL!,
            storagePath: m.storagePath,
            status: 'uploaded' as const,
            attachedToDishes: dishDrafts
              .filter(dish => dish.mediaIds.includes(m.id))
              .map(dish => dish.id)
          }));

        // Build UI state
        const uiState: WizardUIState = {
          currentStep,
          activeDishIndex,
          expandedDishIds
        };

        const state: MultiDishCreateState = {
          visit: visitDraft,
          dishes: dishDrafts,
          mediaItems: mediaItemsDraft,
          uiState
        };

        localStorage.setItem(key, JSON.stringify(state));
        setAutosaveState('saved');

      } catch (error) {
        console.error('Failed to save draft', error);
        setAutosaveState('error');

        // Handle quota exceeded error
        if (error instanceof Error && error.name === 'QuotaExceededError') {
          // TODO: Show user-facing error message via toast/alert
          console.error('localStorage quota exceeded. Draft autosave disabled.');
        }
      }
    }, 400);

    return () => window.clearTimeout(autosaveTimeout.current);
  }, [visitDraft, dishDrafts, mediaItems, userId, currentStep, activeDishIndex, expandedDishIds]);

  useEffect(() => () => {
    mediaItemsRef.current.forEach((item) => revokePreview(item.previewUrl));
  }, []);

  const removeMedia = useCallback((id: string) => {
    // Auto-detach from all dishes before deletion
    const attachedDishes = dishDrafts.filter(dish =>
      dish.mediaIds.includes(id)
    );

    if (attachedDishes.length > 0) {
      // Remove photo from all dishes that use it
      setDishDrafts(prev =>
        prev.map(dish => ({
          ...dish,
          mediaIds: dish.mediaIds.filter(mediaId => mediaId !== id)
        }))
      );
    }

    // Proceed with deletion from media pool
    let removed: LocalMediaItem | undefined;
    setMediaItems((prev) => {
      removed = prev.find((item) => item.id === id);
      if (removed) {
        revokePreview(removed.previewUrl);
      }
      return prev.filter((item) => item.id !== id);
    });
  }, [dishDrafts, setDishDrafts]);

  const uploadMedia = useCallback(async (files: File[]) => {
    if (!userId) {
      throw new Error('User must be signed in to upload media');
    }

    // PERFORMANCE FIX: Create all preview items upfront in a single state update
    const newItems: LocalMediaItem[] = files
      .filter(file => file.type.startsWith('image') || file.type.startsWith('video'))
      .map(file => {
        const kind: LocalMediaItem['kind'] = file.type.startsWith('video') ? 'video' : 'photo';
        return {
          id: safeId(),
          kind,
          previewUrl: fileToPreview(file),
          status: 'uploading' as const
        };
      });

    // Single batched state update for all new items
    setMediaItems((prev) => [...prev, ...newItems]);

    // Process uploads in parallel and batch status updates
    await Promise.all(
      files.map(async (file, index) => {
        const kind: LocalMediaItem['kind'] = file.type.startsWith('video') ? 'video' : 'photo';
        if (kind === 'photo' && !file.type.startsWith('image')) {
          return;
        }
        const item = newItems[index];
        if (!item) return;

        try {
          if (kind === 'photo') {
            const upload = await processAndUploadImage(file, userId);
            setMediaItems((prev) => prev.map((m) => m.id === item.id ? {
              ...m,
              status: 'uploaded',
              storagePath: upload.storagePath,
              downloadURL: upload.downloadURL
            } : m));
            showReward('media');
          } else {
            const uploads = await processAndUploadVideo(file, userId);
            setMediaItems((prev) => prev.map((m) => m.id === item.id ? {
              ...m,
              status: 'uploaded',
              storagePath: uploads.video.storagePath,
              downloadURL: uploads.video.downloadURL,
              thumbnailPath: uploads.thumbnail.storagePath,
              thumbnailURL: uploads.thumbnail.downloadURL
            } : m));
          }
        } catch (error) {
          console.error('Media upload failed', error);
          setMediaItems((prev) => prev.map((m) => m.id === item.id ? {
            ...m,
            status: 'error',
            error: error instanceof Error ? error.message : 'Upload failed'
          } : m));
        }
      })
    );

    // Return the IDs of newly created media items so callers can use them immediately
    return newItems.map(item => item.id);
  }, [showReward, userId]);

  // Immediate autosave helper (non-debounced) for navigation
  const autosaveImmediate = useCallback(() => {
    if (!userId) return;
    const key = buildStorageKey(userId, visitDraft.restaurantId);

    try {
      // Build media items draft
      const mediaItemsDraft: MediaItemDraft[] = mediaItems
        .filter(m => m.status === 'uploaded' && m.downloadURL && !m.downloadURL.startsWith('blob:'))
        .map(m => ({
          id: m.id,
          kind: m.kind,
          downloadURL: m.downloadURL!,
          storagePath: m.storagePath,
          status: 'uploaded' as const,
          attachedToDishes: dishDrafts
            .filter(dish => dish.mediaIds.includes(m.id))
            .map(dish => dish.id)
        }));

      const uiState: WizardUIState = {
        currentStep,
        activeDishIndex,
        expandedDishIds
      };

      const state: MultiDishCreateState = {
        visit: visitDraft,
        dishes: dishDrafts,
        mediaItems: mediaItemsDraft,
        uiState
      };

      localStorage.setItem(key, JSON.stringify(state));
      setAutosaveState('saved');
    } catch (error) {
      console.error('Failed to save draft immediately', error);
      setAutosaveState('error');
    }
  }, [userId, visitDraft, dishDrafts, mediaItems, currentStep, activeDishIndex, expandedDishIds]);

  const goNext = useCallback(() => {
    // Note: Validation removed to allow free navigation
    // Data validation happens on final submit only
    autosaveImmediate(); // Save immediately before navigation
    setCurrentStep((step) => Math.min(step + 1, 2));
  }, [autosaveImmediate]);

  const goBack = useCallback(() => {
    autosaveImmediate(); // Save immediately, no validation needed
    setCurrentStep((step) => Math.max(step - 1, 0));
  }, [autosaveImmediate]);

  const goToStep = useCallback((stepIndex: number) => {
    autosaveImmediate(); // Save immediately before navigation
    setCurrentStep(Math.max(0, Math.min(stepIndex, 2)));
  }, [autosaveImmediate]);

  const toggleDishExpanded = useCallback((dishId: string) => {
    setExpandedDishIds(prev =>
      prev.includes(dishId)
        ? prev.filter(id => id !== dishId)
        : [...prev, dishId]
    );
  }, []);

  const resetDraft = useCallback((keepRestaurant?: boolean) => {
    if (!userId) return;
    setVisitDraft(prev => keepRestaurant && selectedRestaurant ? {
      restaurantId: selectedRestaurant.id,
      restaurantName: selectedRestaurant.name,
      restaurantAddress: (selectedRestaurant as any).address,
      restaurantPriceLevel: prev.restaurantPriceLevel ?? null,
      mealTime: undefined,
      overallText: undefined,
      serviceSpeed: null,
    } : buildInitialVisitDraft());

    const cuisines = keepRestaurant ? extractRestaurantCuisines(selectedRestaurant) : undefined;
    setDishDrafts([buildInitialDishDraft(cuisines?.[0])]);
    setActiveDishIndex(0);
    setMediaItems((prev) => {
      prev.forEach((item) => revokePreview(item.previewUrl));
      return [];
    });
    setCurrentStep(0);
    setExpandedDishIds([]);
    rewardHistoryRef.current = { media: false, taste: false, compare: false, submit: false, dishes: false };
    // Reset submission flag to allow draft restoration for next review
    submissionCompleteRef.current = false;
  }, [selectedRestaurant, setDishDrafts, userId]);

  const submitReview = useCallback(async (): Promise<string[]> => {
    if (!userId) throw new Error('User must be signed in');
    if (!selectedRestaurant) throw new Error('Restaurant required');
    if (!dishDrafts.length) throw new Error('At least one dish required');

    const sharedVisitId = visitDraft.visitId ?? generateVisitId();
    const visitLevelCaption = typeof visitDraft.overallText === 'string' && visitDraft.overallText.trim().length
      ? visitDraft.overallText.trim()
      : undefined;

    // Collect unassigned photos (vibes/visit-level media)
    const usedMediaIds = new Set<string>();
    dishDrafts.forEach(d => {
      d.mediaIds.forEach(id => usedMediaIds.add(id));
    });
    const visitMediaUrls = mediaItems
      .filter(item => !usedMediaIds.has(item.id) && item.kind === 'photo')
      .map(item => item.downloadURL)
      .filter(Boolean);

    const reviewIds: string[] = [];

    try {
      for (const dish of dishDrafts) {
        if (!dish.dishName.trim()) {
          throw new Error('All dishes must have a name');
        }
        if (!dish.dishCategory) {
          throw new Error('All dishes must have a category');
        }
        if (!dish.dishCuisine) {
          throw new Error('All dishes must have a cuisine');
        }

        // Build media for this dish
        const media = buildMediaBundleForDish(dish, mediaItems);

        // Build tags
        const mealTimesToUse = visitDraft.mealTime && visitDraft.mealTime !== 'unspecified'
          ? [visitDraft.mealTime as MealTimeTag]
          : undefined;
        const explicitTags = buildExplicitTags(dish.explicit);
        const derivedTags = buildDerivedTags(dish.sentiment);
        const mealTimeTags = buildMealTimeTags(mealTimesToUse);
        const serviceSpeedTags = buildServiceSpeedTags(visitDraft.serviceSpeed);
        const mergedTags = Array.from(new Set([...explicitTags, ...derivedTags, ...mealTimeTags, ...serviceSpeedTags]));

        // Build ReviewData payload
        const reviewData: ReviewData & { caption?: string } = {
          restaurant: selectedRestaurant.name || 'Unknown Restaurant',
          location: selectedRestaurant.address || (selectedRestaurant as any).formatted_address || '',
          dish: dish.dishName,
          rating: dish.rating,
          personalNote: visitDraft.overallText || '',
          negativeNote: '',
          serverRating: null,
          price: null,
          restaurantPriceLevel: visitDraft.restaurantPriceLevel ?? null,
          images: media.photos,
          isPublic: true,
          explicit: dish.explicit || null,
          sentiment: dish.sentiment || null,
          explicitTags,
          derivedTags,
          tags: mergedTags,
          restaurantCuisines: sanitizeCuisinesInput((selectedRestaurant as any).cuisines),
          cuisines: sanitizeCuisinesInput((selectedRestaurant as any).cuisines),
          caption: dish.caption,
          visitId: sharedVisitId,
          dishCategory: dish.dishCategory,
          ...(visitLevelCaption ? { visitCaption: visitLevelCaption } : {}),
          ...(visitMediaUrls.length ? { visitMedia: visitMediaUrls } : {}),
          ...(visitDraft.businessTags?.length ? { businessTags: visitDraft.businessTags } : {}),
          ...(visitDraft.isToGo !== undefined ? { isToGo: visitDraft.isToGo } : {}),
          ...(visitDraft.toGoFeedback && Object.keys(visitDraft.toGoFeedback).length > 0 ? { toGoFeedback: visitDraft.toGoFeedback } : {}),
          ...(visitDraft.dineInFeedback && Object.keys(visitDraft.dineInFeedback).length > 0 ? { dineInFeedback: visitDraft.dineInFeedback } : {}),
        };

        // Add to payload for saveReview
        const payload = buildReviewCreatePayload(reviewData);
        const reviewId = await saveReview(payload, selectedRestaurant, null);
        reviewIds.push(reviewId);
      }

      // Clear ALL localStorage keys (both generic and restaurant-specific)
      try {
        localStorage.removeItem(buildStorageKey(userId, visitDraft.restaurantId));
        localStorage.removeItem(buildStorageKey(userId, null)); // Clear generic "new" key
      } catch (error) {
        console.warn('Failed to clear draft storage', error);
      }

      // Clear review cache to force refetch with new data
      clearCache();
      console.log('✅ Cleared review cache - new reviews will be fetched on next page load');

      // Reset ALL state (not just UI state)
      setCurrentStep(0);
      setActiveDishIndex(0);
      setExpandedDishIds([]);
      setVisitDraft(buildInitialVisitDraft());
      setDishDrafts([buildInitialDishDraft()]);
      setMediaItems([]);
      setSelectedRestaurant(null);

      // Set flag to prevent draft restoration
      submissionCompleteRef.current = true;

      showReward('submit');
      return reviewIds;
    } catch (error) {
      console.error('Submission failed:', error);
      throw error;
    }
  }, [userId, selectedRestaurant, dishDrafts, visitDraft, mediaItems, showReward, clearCache]);

  const contextValue = useMemo<WizardContextValue>(() => ({
    visitDraft,
    setVisitDraft,
    dishDrafts,
    setDishDrafts,
    updateDishDraft,
    activeDishIndex,
    setActiveDishIndex,
    mediaItems,
    setMediaItems,
    uploadMedia,
    removeMedia,
    pendingUploads,
    pendingUploadCount,
    selectedRestaurant,
    selectRestaurant,
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
    autosaveState,
    expandedDishIds,
    setExpandedDishIds,
    toggleDishExpanded,
    isNewUser
  }), [
    visitDraft,
    dishDrafts,
    setDishDrafts,
    updateDishDraft,
    activeDishIndex,
    mediaItems,
    uploadMedia,
    removeMedia,
    pendingUploads,
    pendingUploadCount,
    selectedRestaurant,
    selectRestaurant,
    userId,
    currentStep,
    goNext,
    goBack,
    showReward,
    isSubmitting,
    resetDraft,
    submitReview,
    autosaveState,
    expandedDishIds,
    toggleDishExpanded,
    isNewUser
  ]);

  const stepOrder = useMemo<WizardStepKey[]>(() => (
    ['visit', 'dishes', 'wrapup']
  ), []);

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
      <div className="create-wizard mx-auto w-full max-w-3xl px-4 pt-6 pb-24">
        <div className="sticky top-0 z-10 bg-white">
          <div className="flex items-center justify-between py-4">
            <div>
              <h1 className="text-2xl font-semibold text-slate-900">{t('createWizard.title')}</h1>
              <p className="text-sm text-slate-500 mb-2">{t('createWizard.subtitle')}</p>
            </div>
            <span className={`text-xs font-medium ${autosaveState === 'saved' ? 'text-emerald-500' : autosaveState === 'error' ? 'text-red-500' : 'text-slate-400'}`}>
              {autosaveState === 'saving' && t('createWizard.status.autosaving')}
              {autosaveState === 'saved' && t('createWizard.status.saved')}
              {autosaveState === 'error' && t('createWizard.status.error')}
            </span>
          </div>
          <div className="mb-3"><ProgressBar steps={steps} currentStep={currentStep} onStepClick={goToStep} /></div>
        </div>
        {isNewUser && currentStep === 0 && showHowItWorks && (
          <div className="relative mb-4 rounded-xl border border-slate-200 bg-white px-4 py-3">
            <button
              type="button"
              onClick={() => setShowHowItWorks(false)}
              className="absolute top-2 right-2 h-7 w-7 rounded-full bg-white text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors flex items-center justify-center"
              aria-label="Dismiss how it works"
            >
              <X className="h-4 w-4" />
            </button>
            <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">How it works</p>
            <ul className="mt-1 text-sm text-slate-700 space-y-1">
              <li className="flex items-start gap-2">
                <span className="text-primary mt-0.5">-</span>
                <span>Search the restaurant you're reviewing.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary mt-0.5">-</span>
                <span>Add multiple items from one visit.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary mt-0.5">-</span>
                <span>Rate anything, anywhere.</span>
              </li>
            </ul>
          </div>
        )}
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
