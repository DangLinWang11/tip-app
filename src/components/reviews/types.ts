import { RestaurantRecord } from './CreateRestaurantModal';
import { DishRecord } from './AddDishInline';
import { ReviewDraft, VisitDraft, DishDraft } from '../../dev/types/review';

export type WizardStepKey = 'visit' | 'dishes' | 'wrapup';

// Re-export types for use in step components
export type { VisitDraft, DishDraft } from '../../dev/types/review';

export interface RestaurantOption extends RestaurantRecord {
  distance?: number;
}

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
  role?: 'dish' | 'visit';
}

export interface WizardContextValue {
  // Visit-level state
  visitDraft: VisitDraft;
  setVisitDraft: React.Dispatch<React.SetStateAction<VisitDraft>>;

  // Per-dish state
  dishDrafts: DishDraft[];
  setDishDrafts: React.Dispatch<React.SetStateAction<DishDraft[]>>;
  updateDishDraft: (id: string, updater: (draft: DishDraft) => DishDraft) => void;

  activeDishIndex: number;
  setActiveDishIndex: React.Dispatch<React.SetStateAction<number>>;

  // Media management
  mediaItems: LocalMediaItem[];
  setMediaItems: React.Dispatch<React.SetStateAction<LocalMediaItem[]>>;
  uploadMedia: (files: File[]) => Promise<void>;
  removeMedia: (id: string) => void;
  pendingUploads: boolean;
  pendingUploadCount: number;

  // Restaurant at visit level
  selectedRestaurant: RestaurantOption | null;
  selectRestaurant: (restaurant: RestaurantOption | null, options?: { restoreDraft?: boolean }) => void;

  // User & navigation
  userId: string;
  setStep: (step: number) => void;
  currentStep: number;
  goNext: () => void;
  goBack: () => void;

  // Rewards & submission
  showReward: (key: 'taste' | 'compare' | 'submit' | 'media' | 'dishes') => void;
  isSubmitting: boolean;
  setIsSubmitting: React.Dispatch<React.SetStateAction<boolean>>;
  resetDraft: (keepRestaurant?: boolean) => void;
  submitReview: () => Promise<string[]>;

  // Autosave
  autosaveState: 'idle' | 'saving' | 'saved' | 'error';

  // UI state for step navigation
  expandedDishIds: string[];
  setExpandedDishIds: React.Dispatch<React.SetStateAction<string[]>>;
  toggleDishExpanded: (dishId: string) => void;
}

export type DraftUpdater = (draft: ReviewDraft) => ReviewDraft;
export type DishDraftUpdater = (draft: DishDraft) => DishDraft;

export interface WizardUIState {
  currentStep: number;              // 0-2 for visit/dishes/wrapup
  activeDishIndex: number;          // Which dish is being edited (default 0)
  expandedDishIds: string[];        // Which dish cards are expanded
}

export interface MediaItemDraft {
  id: string;
  kind: 'photo' | 'video';
  downloadURL: string;              // Firebase Storage URL only
  storagePath?: string;
  status: 'uploaded';               // Only save successfully uploaded media
  attachedToDishes: string[];       // Track which dishes use this media
}

export type MultiDishCreateState = {
  visit: VisitDraft;
  dishes: DishDraft[];
  mediaItems?: MediaItemDraft[];    // Add this field
  uiState?: WizardUIState;          // Add this field
};
