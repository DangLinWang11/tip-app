import React, { useMemo, useState, useEffect, useRef } from 'react';
import { collection, getDocs, query, where, addDoc, serverTimestamp } from 'firebase/firestore';
import { Plus, ChevronDown, ChevronUp, Trash2, Camera, AlertCircle, Loader2, X } from 'lucide-react';
import { useI18n } from '../../lib/i18n/useI18n';
import { DishDraft, DishCategory } from '../../dev/types/review';
import { useReviewWizard } from './WizardContext';
import RatingSlider from '../RatingSlider';
import { CUISINES, getCuisineLabel } from '../../utils/taxonomy';
import { POSITIVE_ATTRIBUTES, NEGATIVE_ATTRIBUTES } from '../../data/tagDefinitions';
import { db } from '../../lib/firebase';
import { DishRecord } from './AddDishInline';
import { useAutoStartTour } from '../../tour/TourProvider';

const StepDishes: React.FC = () => {
  const { t } = useI18n();
  const {
    dishDrafts,
    setDishDrafts,
    updateDishDraft,
    activeDishIndex,
    setActiveDishIndex,
    mediaItems,
    setMediaItems,
    uploadMedia,
    goNext,
    goBack,
    showReward,
    selectedRestaurant,
    expandedDishIds,
    toggleDishExpanded,
    setExpandedDishIds,
    isNewUser,
  } = useReviewWizard();

  const [menuItems, setMenuItems] = useState<DishRecord[]>([]);
  const [loadingMenuItems, setLoadingMenuItems] = useState(false);
  const [menuError, setMenuError] = useState<string | null>(null);
  const [addingMenuItem, setAddingMenuItem] = useState(false);
  const [customCuisineInputs, setCustomCuisineInputs] = useState<Record<string, string>>({});
  const [customCuisineSelections, setCustomCuisineSelections] = useState<Record<string, boolean>>({});

  useAutoStartTour('create_step2', isNewUser);

  // Track uploading state per dish for direct thumbnail upload
  const [uploadingForDish, setUploadingForDish] = useState<Record<string, boolean>>({});
  const [uploadErrorForDish, setUploadErrorForDish] = useState<Record<string, string | null>>({});
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  // Initialize expandedDishIds with first dish if empty
  useEffect(() => {
    if (expandedDishIds.length === 0 && dishDrafts.length > 0) {
      setExpandedDishIds([dishDrafts[0].id]);
    }
  }, []); // Only run on mount

  useEffect(() => {
    if (!selectedRestaurant) {
      setMenuItems([]);
      return;
    }
    const fetchMenuItems = async () => {
      try {
        setLoadingMenuItems(true);
        const menuQuery = query(collection(db, 'menuItems'), where('restaurantId', '==', selectedRestaurant.id));
        const snapshot = await getDocs(menuQuery);
        const list: DishRecord[] = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...(docSnap.data() as DishRecord)
        }));
        setMenuItems(list);
      } catch (error) {
        console.error('Failed to load menu items', error);
        setMenuError('Unable to load menu items');
      } finally {
        setLoadingMenuItems(false);
      }
    };
    fetchMenuItems();
  }, [selectedRestaurant]);

  const addDish = () => {
    const cuisineDefault = (selectedRestaurant as any)?.cuisines?.[0];
    const newDish: DishDraft = {
      id: `dish_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      mediaIds: [],
      dishName: '',
      dishCategory: undefined,
      dishCuisine: cuisineDefault || undefined,
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
    };
    setDishDrafts(prev => [...prev, newDish]);
    setExpandedDishIds(prev => [...prev, newDish.id]);
    setActiveDishIndex(dishDrafts.length);
  };

  const getMatchingMenuItems = useMemo(() => {
    const cache = new Map<string, DishRecord[]>();
    return (name: string) => {
      const term = name.trim().toLowerCase();
      if (!term) return [];
      if (cache.has(term)) return cache.get(term)!;
      const matches = menuItems
        .filter(item => item.name?.toLowerCase().includes(term))
        .slice(0, 5);
      cache.set(term, matches);
      return matches;
    };
  }, [menuItems]);

  const hasExactMenuMatch = useMemo(() => {
    const set = new Set(menuItems.map(item => item.name?.trim().toLowerCase()).filter(Boolean) as string[]);
    return (name: string) => {
      const term = name.trim().toLowerCase();
      if (!term) return false;
      return set.has(term);
    };
  }, [menuItems]);

  const handleSelectMenuItem = (dishId: string, item: DishRecord) => {
    updateDishDraft(dishId, prev => ({
      ...prev,
      dishName: item.name,
      dishCategory: prev.dishCategory || (item.category as DishCategory) || prev.dishCategory
    }));
  };

  const handleAddMenuItem = async (dishId: string, name: string, category?: DishCategory) => {
    if (!selectedRestaurant || !name.trim()) return;
    try {
      setAddingMenuItem(true);
      const payload = {
        name: name.trim(),
        restaurantId: selectedRestaurant.id,
        category: category || null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };
      const docRef = await addDoc(collection(db, 'menuItems'), payload);
      const newItem: DishRecord = {
        id: docRef.id,
        name: payload.name,
        restaurantId: selectedRestaurant.id,
        category: payload.category || undefined
      };
      setMenuItems(prev => [...prev, newItem]);
      updateDishDraft(dishId, prev => ({ ...prev, dishName: newItem.name }));
    } catch (error) {
      console.error('Failed to add menu item', error);
      setMenuError('Could not add dish to menu');
    } finally {
      setAddingMenuItem(false);
    }
  };

  const removeDish = (index: number) => {
    const dishId = dishDrafts[index]?.id;
    setDishDrafts(prev => prev.filter((_, i) => i !== index));
    if (dishId) {
      setExpandedDishIds(prev => prev.filter(id => id !== dishId));
    }
    if (activeDishIndex >= dishDrafts.length - 1) {
      setActiveDishIndex(Math.max(0, dishDrafts.length - 2));
    }
  };

  const toggleMediaForDish = (dishId: string, mediaId: string) => {
    setDishDrafts((prev) =>
      prev.map((dish) => {
        if (dish.id !== dishId) return dish;
        const alreadyAttached = dish.mediaIds.includes(mediaId);
        if (alreadyAttached) {
          return {
            ...dish,
            mediaIds: dish.mediaIds.filter((id) => id !== mediaId),
          };
        }
        const without = dish.mediaIds.filter((id) => id !== mediaId);
        return {
          ...dish,
          mediaIds: [mediaId, ...without],
        };
      })
    );
  };

  const removeMediaFromDish = (dishId: string) => {
    setDishDrafts(prev =>
      prev.map(dish => {
        if (dish.id !== dishId) return dish;
        // Remove the first media item (cover image)
        return {
          ...dish,
          mediaIds: dish.mediaIds.slice(1)
        };
      })
    );
  };

  const handleThumbnailClick = (dishId: string) => {
    const input = fileInputRefs.current[dishId];
    if (input) {
      input.click();
    }
  };

  const handleDishFileSelect = async (dishId: string, event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    try {
      await handleDishUpload(dishId, Array.from(files));
    } finally {
      // Reset input to allow same file to be selected again
      event.target.value = '';
    }
  };

  const handleDishUpload = async (dishId: string, files: File[]) => {
    if (files.length === 0) return;

    // Prevent concurrent uploads to same dish
    if (uploadingForDish[dishId]) {
      console.warn('Upload already in progress for this dish');
      return;
    }

    // Validate files
    const validFiles: File[] = [];
    const errors: string[] = [];
    const MAX_IMAGE_SIZE = 8 * 1024 * 1024; // 8MB
    const MAX_VIDEO_SIZE = 50 * 1024 * 1024; // 50MB

    for (const file of files) {
      const isImage = file.type.startsWith('image/');
      const isVideo = file.type.startsWith('video/');

      if (!isImage && !isVideo) {
        errors.push(`${file.name}: Unsupported file type`);
        continue;
      }

      if (isImage && file.size > MAX_IMAGE_SIZE) {
        errors.push(`${file.name}: Image too large (max 8MB)`);
        continue;
      }

      if (isVideo && file.size > MAX_VIDEO_SIZE) {
        errors.push(`${file.name}: Video too large (max 50MB)`);
        continue;
      }

      validFiles.push(file);
    }

    // Show validation errors if any
    if (errors.length > 0) {
      setUploadErrorForDish(prev => ({
        ...prev,
        [dishId]: errors.join('; ')
      }));
    }

    // Only proceed if we have valid files
    if (validFiles.length === 0) return;

    // Mark dish as uploading
    setUploadingForDish(prev => ({ ...prev, [dishId]: true }));

    try {
      // Clear any previous errors
      setUploadErrorForDish(prev => {
        const { [dishId]: _, ...rest } = prev;
        return rest;
      });

      // Upload to shared pool and get the IDs of newly created media items
      const newMediaIds = await uploadMedia(validFiles);

      // Attach new media to dish - first photo becomes thumbnail (at index 0)
      if (newMediaIds.length > 0) {
        setDishDrafts(prev => prev.map(dish => {
          if (dish.id !== dishId) return dish;

          // Add new media IDs at the start (first = cover image)
          return {
            ...dish,
            mediaIds: [...newMediaIds, ...dish.mediaIds]
          };
        }));
      }
    } catch (error) {
      console.error('Failed to upload media for dish:', error);
      const message = error instanceof Error
        ? error.message
        : 'Failed to upload. Please try again.';
      setUploadErrorForDish(prev => ({ ...prev, [dishId]: message }));
    } finally {
      // Clear uploading state after a small delay to show the upload feedback
      setTimeout(() => {
        setUploadingForDish(prev => {
          const { [dishId]: _, ...rest } = prev;
          return rest;
        });
      }, 100);
    }
  };

  const getMediaCountText = (dishId: string): string => {
    const dish = dishDrafts.find(d => d.id === dishId);
    const count = dish ? new Set(dish.mediaIds).size : 0;
    return count === 0 ? 'No photos' : `${count} photo${count !== 1 ? 's' : ''}`;
  };

  const validateDishes = (): string[] => {
    const errors: string[] = [];
    dishDrafts.forEach((dish, idx) => {
      if (!dish.dishName.trim()) {
        errors.push(`Dish ${idx + 1}: Name is required`);
      }
      if (!dish.dishCategory) {
        errors.push(`Dish ${idx + 1}: Category is required`);
      }
      if (!dish.dishCuisine) {
        errors.push(`Dish ${idx + 1}: Cuisine is required`);
      }
      if (dish.rating < 0.1 || dish.rating > 10) {
        errors.push(`Dish ${idx + 1}: Rating must be between 0.1 and 10`);
      }
    });
    return errors;
  };

  const errors = validateDishes();
  const canProceed = dishDrafts.length > 0 && errors.length === 0;

  const handleNext = () => {
    if (!canProceed) return;
    showReward('dishes');
    goNext();
  };

  if (!dishDrafts.length) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-slate-500">No dishes</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Onboarding dialog removed: replaced by coach-mark tour */}

      {/* Dishes List */}
      <div className="space-y-3">
        {dishDrafts.map((dish, index) => {
          const isExpanded = expandedDishIds.includes(dish.id);
          const coverMediaId = dish.mediaIds?.[0];
          const coverMedia = coverMediaId ? mediaItems.find((m) => m.id === coverMediaId) : undefined;
          const coverImage = coverMedia?.downloadURL || coverMedia?.previewUrl || coverMedia?.thumbnailURL;

          const handleHeaderToggle = () => {
            setActiveDishIndex(index);
            toggleDishExpanded(dish.id);
          };

          const handleHeaderKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              handleHeaderToggle();
            }
          };

          return (
            <div key={dish.id} className="rounded-3xl border border-slate-200 bg-white overflow-hidden shadow-md shadow-slate-200/60">
            {/* Dish Card Header */}
            <div
              role="button"
              tabIndex={0}
              onClick={handleHeaderToggle}
              onKeyDown={handleHeaderKeyDown}
              className={`w-full p-4 flex items-center gap-4 rounded-3xl border transition ${
                isExpanded ? 'bg-rose-50/60 border-rose-100' : 'bg-rose-50/40 border-transparent hover:bg-rose-50/70'
              }`}
            >
              <div data-tour={index === 0 ? 'create-dish-camera' : undefined}>
                {coverImage ? (
                  // Photo is attached - show non-clickable thumbnail with X button
                  <div className="relative flex-shrink-0 w-16 h-16 rounded-2xl overflow-hidden">
                    <img
                      src={coverImage}
                      alt="Dish"
                      className="w-full h-full object-cover"
                    />
                    {/* X button to remove photo - always visible */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeMediaFromDish(dish.id);
                      }}
                      className="absolute top-1 right-1 bg-red-500 hover:bg-red-600 rounded-full p-1 transition-colors shadow-sm"
                      aria-label="Remove photo from this dish"
                    >
                      <X className="h-3 w-3 text-white" strokeWidth={3} />
                    </button>
                  </div>
                ) : (
                  // No photo - clickable to upload
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleThumbnailClick(dish.id);
                    }}
                    disabled={uploadingForDish[dish.id]}
                    className={`relative flex-shrink-0 w-16 h-16 rounded-2xl flex items-center justify-center bg-slate-100 hover:bg-slate-200 transition-all cursor-pointer group focus:outline-none focus:ring-2 focus:ring-red-400 focus:ring-offset-2 ${
                      uploadingForDish[dish.id] ? 'cursor-wait opacity-75' : ''
                    }`}
                    aria-label="Upload photo for this dish"
                  >
                    <div className="relative">
                      <Camera className="h-10 w-10 text-slate-400 group-hover:text-slate-600 transition" />
                      {/* Plus badge at top-right corner of camera icon */}
                      <div className="absolute -top-1 -right-1 bg-red-500 rounded-full p-1">
                        <Plus className="h-3 w-3 text-white" strokeWidth={3} />
                      </div>
                    </div>
                    {/* Loading overlay during upload */}
                    {uploadingForDish[dish.id] && (
                      <>
                        <div className="absolute inset-0 bg-white/80 flex items-center justify-center">
                          <Loader2 className="h-5 w-5 animate-spin text-red-500" />
                        </div>
                        <span className="sr-only" role="status" aria-live="polite">
                          Uploading photos for {dish.dishName || 'dish'}
                        </span>
                      </>
                    )}
                  </button>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="truncate text-sm font-semibold text-slate-900">
                    {dish.dishName || 'Unnamed dish'}
                  </h3>
                </div>
                <div className="mt-1 flex items-center gap-2 text-xs text-slate-500 flex-wrap">
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                    {dish.dishCategory || 'No category'}
                  </span>
                  <span>{getMediaCountText(dish.id)}</span>
                </div>
              </div>

              <div className="flex-shrink-0 flex items-center gap-3">
                <span className="text-2xl font-bold text-red-500 leading-none" style={{ transform: 'translateY(0.175rem)' }}>
                  {dish.rating.toFixed(1)}
                </span>
                {isExpanded ? (
                  <ChevronUp className="h-4 w-4 text-slate-500" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-slate-500" />
                )}
              </div>
            </div>

            {/* Upload Error Banner */}
            {uploadErrorForDish[dish.id] && (
              <div className="px-4 py-3 bg-red-50 border-t border-red-100 flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-red-700">{uploadErrorForDish[dish.id]}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setUploadErrorForDish(prev => {
                    const { [dish.id]: _, ...rest } = prev;
                    return rest;
                  })}
                  className="text-red-400 hover:text-red-600 transition"
                  aria-label="Dismiss error"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}

            {/* Expanded Content */}
            {isExpanded && (
              <div className="border-t border-slate-200 p-4 space-y-4">
                {/* Dish Name */}
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Dish Name *</label>
                  <input
                    type="text"
                    value={dish.dishName}
                    onChange={(e) => updateDishDraft(dish.id, prev => ({ ...prev, dishName: e.target.value }))}
                    placeholder="What did you order?"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-red-400 focus:outline-none focus:ring-1 focus:ring-red-100"
                  />
                  {selectedRestaurant && dish.dishName.trim() ? (
                    <div className="mt-2 space-y-1">
                      {loadingMenuItems && (
                        <div className="flex items-center gap-2 text-xs text-slate-500">
                          <Loader2 className="h-3 w-3 animate-spin" /> Loading menu...
                        </div>
                      )}
                      {!loadingMenuItems && getMatchingMenuItems(dish.dishName).map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => handleSelectMenuItem(dish.id, item)}
                          className="w-full rounded-2xl border border-slate-200 px-3 py-2 text-left text-xs font-medium text-slate-700 transition hover:border-red-300 hover:bg-red-50"
                        >
                          {item.name}
                        </button>
                      ))}
                      {!loadingMenuItems && !hasExactMenuMatch(dish.dishName) && (
                        <button
                          type="button"
                          onClick={() => handleAddMenuItem(dish.id, dish.dishName, dish.dishCategory)}
                          disabled={addingMenuItem}
                          className="w-full rounded-2xl border border-dashed border-slate-300 px-3 py-2 text-left text-xs font-medium text-slate-600 transition hover:border-red-300 hover:bg-red-50 disabled:opacity-60"
                        >
                          {addingMenuItem ? (
                            <span className="flex items-center gap-2">
                              <Loader2 className="h-3 w-3 animate-spin" /> Adding...
                            </span>
                          ) : (
                            <>Add "{dish.dishName.trim()}" as a menu item</>
                          )}
                        </button>
                      )}
                      {menuError && (
                        <p className="text-xs text-red-500">{menuError}</p>
                      )}
                    </div>
                  ) : null}
                </div>

                {/* Category & Cuisine */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Category *</label>
                    <select
                      value={dish.dishCategory || ''}
                      onChange={(e) => updateDishDraft(dish.id, prev => ({
                        ...prev,
                        dishCategory: (e.target.value as DishCategory) || undefined
                      }))}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-red-400 focus:outline-none focus:ring-1 focus:ring-red-100"
                    >
                      <option value="">Select...</option>
                      <option value="appetizer">Appetizer</option>
                      <option value="entree">Entree</option>
                      <option value="handheld">Handheld</option>
                      <option value="side">Side</option>
                      <option value="dessert">Dessert</option>
                      <option value="drink">Drink</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Cuisine *</label>
                    <select
                      value={CUISINES.includes(dish.dishCuisine || '') ? dish.dishCuisine || '' : customCuisineSelections[dish.id] ? 'custom' : ''}
                      onChange={(e) => {
                        const value = e.target.value;
                        if (!value) {
                          setCustomCuisineSelections(prev => {
                            const { [dish.id]: _omit, ...rest } = prev;
                            return rest;
                          });
                          setCustomCuisineInputs(prev => {
                            const { [dish.id]: _omit, ...rest } = prev;
                            return rest;
                          });
                          updateDishDraft(dish.id, prev => ({ ...prev, dishCuisine: undefined }));
                        } else if (value === 'custom') {
                          const existing = customCuisineInputs[dish.id] || '';
                          setCustomCuisineSelections(prev => ({ ...prev, [dish.id]: true }));
                          setCustomCuisineInputs(prev => ({ ...prev, [dish.id]: existing }));
                          updateDishDraft(dish.id, prev => ({ ...prev, dishCuisine: existing || undefined }));
                        } else {
                          setCustomCuisineSelections(prev => {
                            const { [dish.id]: _omit, ...rest } = prev;
                            return rest;
                          });
                          setCustomCuisineInputs(prev => {
                            const { [dish.id]: _omit, ...rest } = prev;
                            return rest;
                          });
                          updateDishDraft(dish.id, prev => ({ ...prev, dishCuisine: value }));
                        }
                      }}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-red-400 focus:outline-none focus:ring-1 focus:ring-red-100"
                    >
                      <option value="">Select...</option>
                      {CUISINES.map((cuisine) => (
                        <option key={cuisine} value={cuisine}>
                          {getCuisineLabel(cuisine)}
                        </option>
                      ))}
                      <option value="custom">Other (specify)</option>
                    </select>
                    {customCuisineSelections[dish.id] && (
                      <input
                        type="text"
                        value={customCuisineInputs[dish.id] || ''}
                        onChange={(e) => {
                          const value = e.target.value;
                          setCustomCuisineInputs(prev => ({ ...prev, [dish.id]: value }));
                          updateDishDraft(dish.id, prev => ({ ...prev, dishCuisine: value.trim() || undefined }));
                          if (!value.trim()) {
                            setCustomCuisineSelections(prev => ({ ...prev, [dish.id]: true }));
                          }
                        }}
                        placeholder="Enter cuisine..."
                        className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-red-400 focus:outline-none focus:ring-1 focus:ring-red-100"
                      />
                    )}
                  </div>
                </div>

                {/* Rating */}
                <div className="pb-4">
                  <label className="block text-xs font-medium text-slate-600 mb-2">Rating: {dish.rating.toFixed(1)}</label>
                  <RatingSlider
                    value={dish.rating}
                    onChange={(value) => updateDishDraft(dish.id, prev => ({ ...prev, rating: value }))}
                    step={0.1}
                  />
                </div>

                {/* Caption */}
                <div className="pt-2">
                  <label className="block text-xs font-medium text-slate-600 mb-1">Thoughts on this dish?</label>
                  <textarea
                    value={dish.caption || ''}
                    onChange={(e) => updateDishDraft(dish.id, prev => ({ ...prev, caption: e.target.value || undefined }))}
                    placeholder="Optional notes..."
                    rows={3}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-red-400 focus:outline-none focus:ring-1 focus:ring-red-100"
                  />
                </div>

                {/* Media Attachment */}
                {mediaItems.length > 0 && (
                  <div className="mt-4" data-tour={index === 0 ? 'create-media-attach' : undefined}>
                    <label className="block text-xs font-medium text-slate-600 mb-2">
                      Choose a photo for this dish
                    </label>
                    <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
                      {mediaItems.map((media) => {
                        const src = media.downloadURL || media.previewUrl || media.thumbnailURL;
                        if (!src && media.kind !== 'video') {
                          return null;
                        }
                        const isAttached = dish.mediaIds.includes(media.id);
                        return (
                          <button
                            key={media.id}
                            type="button"
                            onClick={() => toggleMediaForDish(dish.id, media.id)}
                            className={`flex-shrink-0 w-24 h-24 rounded-xl overflow-hidden border-2 transition ${
                              isAttached ? 'border-emerald-500' : 'border-slate-200 hover:border-slate-300'
                            }`}
                          >
                            {media.kind === 'photo' && src ? (
                              <img
                                src={src}
                                alt="Dish media"
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-[11px] text-slate-600 bg-slate-100">
                                Video
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Taste Attributes */}
                <div className="space-y-3 border-t border-slate-100 pt-4">
                  <h4 className="text-xs font-semibold text-slate-700 uppercase">More Details (Optional)</h4>

                  {/* Price Perception */}
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-2">Was the price...?</label>
                    <div className="flex gap-2">
                      {['bargain', 'fair', 'overpriced'].map((val) => (
                        <button
                          key={val}
                          type="button"
                          onClick={() => updateDishDraft(dish.id, prev => ({
                            ...prev,
                            sentiment: {
                              pricePerception: prev.sentiment?.pricePerception === val ? null : (val as any)
                            }
                          }))}
                          className={`flex-1 py-1.5 rounded text-xs font-medium border ${
                            dish.sentiment?.pricePerception === val
                              ? 'bg-red-500 text-white border-red-500'
                              : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                          }`}
                        >
                          {val.charAt(0).toUpperCase() + val.slice(1)}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Positive Attributes */}
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-2">What stood out?</label>
                    <div className="flex flex-wrap gap-1.5">
                      {POSITIVE_ATTRIBUTES.map((attr) => {
                        const isSelected = dish.explicit?.positiveTags?.includes(attr.value);
                        return (
                          <button
                            key={attr.value}
                            type="button"
                            onClick={() => updateDishDraft(dish.id, prev => {
                              const current = prev.explicit?.positiveTags || [];
                              return {
                                ...prev,
                                explicit: {
                                  ...(prev.explicit || { dishType: null, dishStyle: null, cuisine: null, positiveTags: [], negativeTags: [], occasions: [], dietary: [] }),
                                  positiveTags: isSelected
                                    ? current.filter(t => t !== attr.value)
                                    : [...current, attr.value]
                                }
                              };
                            })}
                            className={`px-2 py-1 rounded text-xs font-medium transition ${
                              isSelected
                                ? 'bg-emerald-500 text-white'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                          >
                            {attr.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Negative Attributes */}
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-2">Could be better?</label>
                    <div className="flex flex-wrap gap-1.5">
                      {NEGATIVE_ATTRIBUTES.map((attr) => {
                        const isSelected = dish.explicit?.negativeTags?.includes(attr.value);
                        return (
                          <button
                            key={attr.value}
                            type="button"
                            onClick={() => updateDishDraft(dish.id, prev => {
                              const current = prev.explicit?.negativeTags || [];
                              return {
                                ...prev,
                                explicit: {
                                  ...(prev.explicit || { dishType: null, dishStyle: null, cuisine: null, positiveTags: [], negativeTags: [], occasions: [], dietary: [] }),
                                  negativeTags: isSelected
                                    ? current.filter(t => t !== attr.value)
                                    : [...current, attr.value]
                                }
                              };
                            })}
                            className={`px-2 py-1 rounded text-xs font-medium transition ${
                              isSelected
                                ? 'bg-slate-400 text-white'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                          >
                            {attr.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Outcome Toggles */}
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={dish.outcome.orderAgain}
                        onChange={(e) => updateDishDraft(dish.id, prev => ({
                          ...prev,
                          outcome: { ...prev.outcome, orderAgain: e.target.checked }
                        }))}
                        className="rounded"
                      />
                      Would order this again
                    </label>
                    <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={dish.outcome.recommend}
                        onChange={(e) => updateDishDraft(dish.id, prev => ({
                          ...prev,
                          outcome: { ...prev.outcome, recommend: e.target.checked }
                        }))}
                        className="rounded"
                      />
                      Would recommend to friends
                    </label>
                  </div>
                </div>

                {/* Delete Dish */}
                {dishDrafts.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeDish(index)}
                    className="w-full flex items-center justify-center gap-2 py-2 text-xs font-medium text-red-500 hover:bg-red-50 rounded-lg transition"
                  >
                    <Trash2 className="h-4 w-4" />
                    Remove this dish
                  </button>
                )}
              </div>
            )}

            {/* Hidden file input for direct upload */}
            <input
              ref={(el) => { fileInputRefs.current[dish.id] = el; }}
              type="file"
              accept="image/*,video/mp4,video/webm"
              multiple
              className="hidden"
              onChange={(e) => handleDishFileSelect(dish.id, e)}
              aria-hidden="true"
            />
          </div>
        );
        })}
      </div>

      {/* Add Dish Button */}
      <button
        type="button"
        onClick={addDish}
        className="w-full rounded-2xl border-2 border-dashed border-slate-300 py-4 text-center text-sm font-semibold text-slate-700 transition hover:border-red-300 hover:bg-red-50"
      >
        <Plus className="h-4 w-4 inline mr-2" />
        Add another dish
      </button>

      {/* Errors */}
      {errors.length > 0 && (
        <div className="rounded-2xl bg-red-50 border border-red-200 p-4">
          <div className="flex gap-3">
            <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-red-900 mb-1">Complete all required fields:</h3>
              <ul className="text-xs text-red-700 space-y-0.5">
                {errors.map((err, i) => (
                  <li key={i}>• {err}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="flex gap-3 pt-4">
        <button
          type="button"
          onClick={goBack}
          className="flex-1 rounded-2xl border border-slate-200 py-3 text-center text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
        >
          Back
        </button>
        <button
          type="button"
          onClick={handleNext}
          disabled={!canProceed}
          className="flex-1 rounded-2xl bg-red-500 py-3 text-center text-sm font-semibold text-white transition hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Next
        </button>
      </div>
    </div>
  );
};

export default StepDishes;
