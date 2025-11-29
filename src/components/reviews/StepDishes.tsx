import React, { useMemo, useState } from 'react';
import { Plus, X, ChevronDown, ChevronUp, Trash2, Camera, AlertCircle } from 'lucide-react';
import { useI18n } from '../../lib/i18n/useI18n';
import { DishDraft, DishCategory } from '../../dev/types/review';
import { useReviewWizard } from './WizardContext';
import RatingSlider from '../RatingSlider';
import { CUISINES } from '../../utils/taxonomy';
import { ATTRIBUTES, OCCASIONS, DIETARY } from '../../data/tagDefinitions';

const StepDishes: React.FC = () => {
  const { t } = useI18n();
  const {
    dishDrafts,
    setDishDrafts,
    updateDishDraft,
    activeDishIndex,
    setActiveDishIndex,
    mediaItems,
    removeMedia,
    goNext,
    goBack,
    showReward,
    selectedRestaurant,
  } = useReviewWizard();

  const activeDish = dishDrafts[activeDishIndex];

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
    setActiveDishIndex(dishDrafts.length);
  };

  const removeDish = (index: number) => {
    setDishDrafts(prev => prev.filter((_, i) => i !== index));
    if (activeDishIndex >= dishDrafts.length - 1) {
      setActiveDishIndex(Math.max(0, dishDrafts.length - 2));
    }
  };

  const toggleMediaForDish = (mediaId: string) => {
    if (!activeDish) return;
    updateDishDraft(activeDish.id, prev => ({
      ...prev,
      mediaIds: prev.mediaIds.includes(mediaId)
        ? prev.mediaIds.filter(id => id !== mediaId)
        : [...prev.mediaIds, mediaId]
    }));
  };

  const getMediaCountText = (dishId: string): string => {
    const count = dishDrafts.find(d => d.id === dishId)?.mediaIds.length || 0;
    return count === 0 ? 'No photos' : `${count} photo${count !== 1 ? 's' : ''}`;
  };

  const getUnassignedMediaCount = (): number => {
    const assignedIds = new Set(dishDrafts.flatMap(d => d.mediaIds));
    return mediaItems.filter(m => m.downloadURL && !assignedIds.has(m.id)).length;
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

  if (!activeDish) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-slate-500">No dishes</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Media Gallery */}
      {mediaItems.length > 0 && (
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-md shadow-slate-200/60">
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-slate-900">Your Visit Photos</h2>
            <p className="text-sm text-slate-500">Attach to dishes or keep as visit-only memories</p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {mediaItems.map((media) => {
              if (!media.downloadURL) return null;
              const attachedCount = dishDrafts.reduce((count, dish) =>
                dish.mediaIds.includes(media.id) ? count + 1 : count, 0);

              return (
                <div key={media.id} className="relative group">
                  {media.kind === 'photo' ? (
                    <img src={media.downloadURL} alt="Visit" className="h-24 w-full object-cover rounded-lg border border-slate-200" />
                  ) : (
                    <div className="h-24 w-full bg-black/10 rounded-lg border border-slate-200 flex items-center justify-center">
                      <div className="text-slate-400 text-xs">Video</div>
                    </div>
                  )}
                  {attachedCount > 0 && (
                    <span className="absolute top-1 right-1 bg-emerald-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full">
                      {attachedCount}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => removeMedia(media.id)}
                    className="absolute top-0 right-0 p-1 bg-red-500 text-white rounded-bl-lg opacity-0 group-hover:opacity-100 transition"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              );
            })}
          </div>
          {getUnassignedMediaCount() > 0 && (
            <p className="text-xs text-slate-500 mt-3">
              {getUnassignedMediaCount()} photo{getUnassignedMediaCount() !== 1 ? 's' : ''} not yet attached to any dish (visit-only)
            </p>
          )}
        </section>
      )}

      {/* Dishes List */}
      <div className="space-y-3">
        {dishDrafts.map((dish, index) => (
          <div key={dish.id} className="rounded-3xl border border-slate-200 bg-white overflow-hidden shadow-md shadow-slate-200/60">
            {/* Dish Card Header */}
            <button
              type="button"
              onClick={() => setActiveDishIndex(index)}
              className={`w-full p-4 flex items-start gap-4 transition ${
                activeDishIndex === index ? 'bg-red-50' : 'hover:bg-slate-50'
              }`}
            >
              {/* Dish Thumbnail */}
              <div className="flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden bg-slate-100 border border-slate-200">
                {dish.mediaIds.length > 0 ? (
                  (() => {
                    const firstMedia = mediaItems.find(m => m.id === dish.mediaIds[0]);
                    return firstMedia?.downloadURL ? (
                      <img src={firstMedia.downloadURL} alt="Dish" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-400">
                        <Camera className="h-6 w-6" />
                      </div>
                    );
                  })()
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-slate-400">
                    <Camera className="h-6 w-6" />
                  </div>
                )}
              </div>

              {/* Dish Info */}
              <div className="flex-1 text-left">
                <h3 className="text-sm font-semibold text-slate-900">{dish.dishName || 'Unnamed dish'}</h3>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs bg-slate-100 px-2 py-0.5 rounded text-slate-600">
                    {dish.dishCategory || 'No category'}
                  </span>
                  <span className="text-xs text-slate-500">⭐ {dish.rating.toFixed(1)}</span>
                </div>
                <p className="text-xs text-slate-500 mt-1">{getMediaCountText(dish.id)}</p>
              </div>

              {/* Actions */}
              <div className="flex-shrink-0 flex items-center gap-2">
                {activeDishIndex === index ? (
                  <ChevronUp className="h-5 w-5 text-slate-400" />
                ) : (
                  <ChevronDown className="h-5 w-5 text-slate-400" />
                )}
              </div>
            </button>

            {/* Expanded Content */}
            {activeDishIndex === index && (
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
                      value={dish.dishCuisine || ''}
                      onChange={(e) => updateDishDraft(dish.id, prev => ({ ...prev, dishCuisine: e.target.value || undefined }))}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-red-400 focus:outline-none focus:ring-1 focus:ring-red-100"
                    >
                      <option value="">Select...</option>
                      {CUISINES.map(c => (
                        <option key={c.value} value={c.value}>{c.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Rating */}
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-2">Rating: {dish.rating.toFixed(1)}</label>
                  <RatingSlider
                    value={dish.rating}
                    onChange={(value) => updateDishDraft(dish.id, prev => ({ ...prev, rating: value }))}
                  />
                </div>

                {/* Caption */}
                <div>
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
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-2">
                      Attach Photos to This Dish
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {mediaItems.map((media) => {
                        if (!media.downloadURL) return null;
                        const isAttached = dish.mediaIds.includes(media.id);
                        return (
                          <button
                            key={media.id}
                            type="button"
                            onClick={() => toggleMediaForDish(media.id)}
                            className={`relative rounded-lg overflow-hidden border-2 transition ${
                              isAttached ? 'border-emerald-500' : 'border-slate-200 hover:border-slate-300'
                            }`}
                          >
                            {media.kind === 'photo' ? (
                              <img src={media.downloadURL} alt="Media" className="w-full h-20 object-cover" />
                            ) : (
                              <div className="w-full h-20 bg-black/10 flex items-center justify-center text-xs text-slate-500">Video</div>
                            )}
                            {isAttached && (
                              <div className="absolute inset-0 bg-emerald-500/20 flex items-center justify-center">
                                <div className="bg-emerald-500 text-white rounded-full p-1">
                                  <X className="h-3 w-3" />
                                </div>
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

                  {/* Attributes */}
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-2">Describe it:</label>
                    <div className="flex flex-wrap gap-1.5">
                      {ATTRIBUTES.map((attr) => {
                        const isSelected = dish.explicit?.attributes.includes(attr.value);
                        return (
                          <button
                            key={attr.value}
                            type="button"
                            onClick={() => updateDishDraft(dish.id, prev => {
                              const attrs = prev.explicit?.attributes || [];
                              return {
                                ...prev,
                                explicit: {
                                  ...(prev.explicit || { dishType: null, dishStyle: null, cuisine: null, attributes: [], occasions: [], dietary: [] }),
                                  attributes: isSelected
                                    ? attrs.filter(a => a !== attr.value)
                                    : [...attrs, attr.value]
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
          </div>
        ))}
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
