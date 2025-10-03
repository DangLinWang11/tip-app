import { RestaurantRecord } from './CreateRestaurantModal';
import { DishRecord } from './AddDishInline';
import { ReviewDraft } from '../../dev/types/review';

export type WizardStepKey = 'basic' | 'taste' | 'compare' | 'caption' | 'outcome';

export interface RestaurantOption extends RestaurantRecord {}

export interface DishOption extends DishRecord {}

type MediaKind = 'photo' | 'video';

type MediaStatus = 'idle' | 'uploading' | 'uploaded' | 'error';

export interface LocalMediaItem {
  id: string;
  kind: MediaKind;
  previewUrl: string;
  storagePath?: string;
  downloadURL?: string;
  thumbnailPath?: string;
  thumbnailURL?: string;
  status: MediaStatus;
  error?: string;
}

export interface WizardContextValue {
  draft: ReviewDraft;
  updateDraft: (updater: (draft: ReviewDraft) => ReviewDraft) => void;
  mediaItems: LocalMediaItem[];
  setMediaItems: React.Dispatch<React.SetStateAction<LocalMediaItem[]>>;
  uploadMedia: (files: File[]) => Promise<void>;
  removeMedia: (id: string) => void;
  pendingUploads: boolean;
  selectedRestaurant: RestaurantOption | null;
  selectRestaurant: (restaurant: RestaurantOption | null, options?: { restoreDraft?: boolean }) => void;
  selectedDish: DishOption | null;
  selectDish: (dish: DishOption | null) => void;
  userId: string;
  setStep: (step: number) => void;
  currentStep: number;
  goNext: () => void;
  goBack: () => void;
  showReward: (key: 'taste' | 'compare' | 'submit' | 'media') => void;
  isSubmitting: boolean;
  setIsSubmitting: React.Dispatch<React.SetStateAction<boolean>>;
  resetDraft: (keepRestaurant?: boolean) => void;
  submitReview: () => Promise<string>;
  autosaveState: 'idle' | 'saving' | 'saved' | 'error';
}

export type DraftUpdater = (draft: ReviewDraft) => ReviewDraft;
