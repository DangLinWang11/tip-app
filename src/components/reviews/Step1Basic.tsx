import React, { useEffect, useMemo, useState } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { Camera, Loader2, MapPin, Plus, Trash2, Video } from 'lucide-react';
import { db } from '../../lib/firebase';
import RatingSlider from '../RatingSlider';
import { useI18n } from '../../lib/i18n/useI18n';
import { RestaurantOption, DishOption } from './types';
import { useReviewWizard } from './WizardContext';
import CreateRestaurantModal from './CreateRestaurantModal';
import AddDishInline from './AddDishInline';
import DishCategorySelect from './DishCategorySelect';
import { CUISINES, normalizeToken } from '../../utils/taxonomy';

const CATEGORY_SLUGS = ['appetizer', 'entree', 'handheld', 'side', 'dessert', 'drink'] as const;

const Step1Basic: React.FC = () => {
  const { t } = useI18n();
  const {
    draft,
    updateDraft,
    mediaItems,
    uploadMedia,
    removeMedia,
    pendingUploads,
    selectedRestaurant,
    selectRestaurant,
    selectedDish,
    selectDish,
    goNext,
    userId
  } = useReviewWizard();

  const [restaurantQuery, setRestaurantQuery] = useState('');
  const [restaurants, setRestaurants] = useState<RestaurantOption[]>([]);
  const [loadingRestaurants, setLoadingRestaurants] = useState(false);
  const [restaurantError, setRestaurantError] = useState<string | null>(null);
  const [showCreateRestaurant, setShowCreateRestaurant] = useState(false);
  const [dishes, setDishes] = useState<DishOption[]>([]);
  const [loadingDishes, setLoadingDishes] = useState(false);
  const [showAddDish, setShowAddDish] = useState(false);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [customCuisineInput, setCustomCuisineInput] = useState('');

  useEffect(() => {
    const fetchRestaurants = async () => {
      try {
        setLoadingRestaurants(true);
        const snapshot = await getDocs(collection(db, 'restaurants'));
        const list: RestaurantOption[] = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...(docSnap.data() as RestaurantOption)
        }));
        setRestaurants(list);
      } catch (error) {
        console.error('Failed to load restaurants', error);
        setRestaurantError(t('createWizard.status.error'));
      } finally {
        setLoadingRestaurants(false);
      }
    };
    fetchRestaurants();
  }, [t]);

  useEffect(() => {
    const loadDishes = async () => {
      if (!selectedRestaurant) {
        setDishes([]);
        return;
      }
      try {
        setLoadingDishes(true);
        const dishQuery = query(collection(db, 'menuItems'), where('restaurantId', '==', selectedRestaurant.id));
        const snapshot = await getDocs(dishQuery);
        const list: DishOption[] = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...(docSnap.data() as DishOption)
        }));
        setDishes(list);
      } catch (error) {
        console.error('Failed to load dishes', error);
      } finally {
        setLoadingDishes(false);
      }
    };
    loadDishes();
  }, [selectedRestaurant]);

  const updateCuisineValues = (updater: (current: string[]) => string[]) => {
    updateDraft((prev) => {
      const current = prev.restaurantCuisines ?? prev.cuisines ?? [];
      const next = updater(current);
      const normalized = Array.from(new Set(next.map((entry) => normalizeToken(entry)).filter(Boolean)));
      return {
        ...prev,
        restaurantCuisines: normalized.length ? normalized : undefined,
        cuisines: normalized.length ? normalized : undefined
      };
    });
  };

  const toggleCuisine = (value: string) => {
    const normalized = normalizeToken(value);
    if (!normalized) return;
    updateCuisineValues((current) => {
      const set = new Set(current);
      if (set.has(normalized)) {
        set.delete(normalized);
      } else {
        set.add(normalized);
      }
      return Array.from(set);
    });
  };

  const addCustomCuisine = () => {
    const normalized = normalizeToken(customCuisineInput);
    if (!normalized) return;
    updateCuisineValues((current) => {
      if (current.includes(normalized)) {
        return current;
      }
      return [...current, normalized];
    });
    setCustomCuisineInput('');
  };

  const handleCustomCuisineKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    addCustomCuisine();
  };

  const selectedCuisines = useMemo(() => draft.restaurantCuisines ?? draft.cuisines ?? [], [draft.restaurantCuisines, draft.cuisines]);
  const customSelectedCuisines = useMemo(() => selectedCuisines.filter((value) => !CUISINES.includes(value)), [selectedCuisines]);

  const formatCuisineLabel = (value: string) => {
    return value.split(' ').map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  };


  useEffect(() => {
    if (selectedRestaurant) {
      setRestaurantQuery(selectedRestaurant.name);
    }
  }, [selectedRestaurant]);

  const filteredRestaurants = useMemo(() => {
    if (!restaurantQuery.trim()) return restaurants.slice(0, 6);
    const lower = restaurantQuery.toLowerCase();
    return restaurants.filter((restaurant) => restaurant.name.toLowerCase().includes(lower)).slice(0, 6);
  }, [restaurantQuery, restaurants]);

  const filteredDishes = useMemo(() => {
    if (!draft.dishName.trim()) return dishes.slice(0, 6);
    const lower = draft.dishName.toLowerCase();
    return dishes.filter((dish) => dish.name.toLowerCase().includes(lower)).slice(0, 6);
  }, [draft.dishName, dishes]);

  const handleFileInput = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    setMediaError(null);
    try {
      await uploadMedia(Array.from(files));
    } catch (error) {
      console.error('Upload error', error);
      setMediaError(t('media.errors.unknown'));
    } finally {
      event.target.value = '';
    }
  };

  const onRestaurantSelected = (restaurant: RestaurantOption) => {
    selectRestaurant(restaurant);
    setShowCreateRestaurant(false);
  };

  const onDishSelected = (dish: DishOption) => {
    selectDish(dish);
    updateDraft((prev) => ({ ...prev, dishName: dish.name }));
  };

  const canProceed = !!selectedRestaurant && !!draft.dishName.trim() && !!draft.dishCategory && draft.rating >= 0.1 && draft.rating <= 10 && !pendingUploads;

  const handleNext = () => {
    if (!canProceed) return;
    goNext();
  };

  return (
    <div className="space-y-8">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-md shadow-slate-200/60">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">{t('review.addMedia')}</h2>
            <p className="text-sm text-slate-500">{t('media.imageLimit')} / {t('media.videoLimit')}</p>
          </div>
        </div>


        <div className="mt-4 grid gap-4">
          <label className="flex min-h-[160px] cursor-pointer flex-col items-center justify-center rounded-3xl border-2 border-dashed border-slate-200 bg-slate-50 text-center transition hover:border-red-200 hover:bg-red-50">
            <input type="file" accept="image/*,video/mp4,video/webm" multiple className="hidden" onChange={handleFileInput} />
            <div className="rounded-full bg-red-100 p-3 text-red-500">
              <Camera className="h-6 w-6" />
            </div>
            <p className="mt-3 text-sm font-medium text-slate-700">{t('media.addMedia')}</p>
            <p className="text-xs text-slate-400">{t('media.dragDrop')} <span className="text-red-500">{t('media.browse')}</span></p>
          </label>
          {mediaError ? <p className="text-sm text-red-500">{mediaError}</p> : null}
          {mediaItems.length > 0 ? (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              {mediaItems.map((item) => (
                <div key={item.id} className="group relative overflow-hidden rounded-2xl border border-slate-200">
                  {item.kind === 'photo' ? (
                    <img src={item.downloadURL || item.previewUrl} alt="Review media" className="h-36 w-full object-cover" />
                  ) : (
                    <div className="relative h-36 w-full overflow-hidden bg-black/5">
                      <video src={item.downloadURL || item.previewUrl} className="h-full w-full object-cover" muted />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <Video className="h-8 w-8 text-white drop-shadow" />
                      </div>
                    </div>
                  )}
                  <div className="absolute inset-0 flex flex-col justify-between p-3">
                    <div className="flex justify-between text-xs">
                      <span className={`rounded-full px-2 py-1 text-white ${item.status === 'uploaded' ? 'bg-emerald-500' : item.status === 'uploading' ? 'bg-amber-500' : item.status === 'error' ? 'bg-red-500' : 'bg-slate-400'}`}>
                        {item.status === 'uploading' && t('createWizard.status.autosaving')}
                        {item.status === 'uploaded' && t('createWizard.status.saved')}
                        {item.status === 'error' && t('createWizard.status.error')}
                        {item.status === 'idle' && ''}
                      </span>
                    </div>
                    <button type="button" onClick={() => removeMedia(item.id)} className="flex items-center gap-1 self-end rounded-full bg-white/90 px-2 py-1 text-xs font-medium text-red-500 opacity-0 transition group-hover:opacity-100">
                      <Trash2 className="h-3 w-3" />
                      {t('media.remove')}
                    </button>
                  </div>
                  {item.status === 'uploading' ? (
                    <div className="absolute inset-0 flex items-center justify-center bg-white/80">
                      <Loader2 className="h-6 w-6 animate-spin text-red-500" />
                    </div>
                  ) : null}
                  {item.error ? (
                    <div className="absolute inset-x-0 bottom-0 bg-red-500/90 p-2 text-xs text-white">
                      {item.error}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-md shadow-slate-200/60 space-y-6">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">{t('basic.restaurant')}</h2>
        </div>
        <div className="space-y-2">
          <div className="relative">
            <input
              value={restaurantQuery}
              onChange={(event) => setRestaurantQuery(event.target.value)}
              placeholder={t('basic.searchPlaceholder.restaurant')}
              className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-base focus:border-red-400 focus:outline-none focus:ring-2 focus:ring-red-100"
            />
            <MapPin className="absolute right-4 top-3.5 h-5 w-5 text-slate-300" />
          </div>
          {restaurantError ? <p className="text-sm text-red-500">{restaurantError}</p> : null}
          {loadingRestaurants ? (
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              {t('basic.loadingRestaurants')}
            </div>
          ) : null}
          {restaurantQuery && filteredRestaurants.length > 0 ? (
            <div className="grid gap-2">
              {filteredRestaurants.map((restaurant) => (
                <button
                  type="button"
                  key={restaurant.id}
                  onClick={() => onRestaurantSelected(restaurant)}
                  className={`flex items-center justify-between rounded-2xl border px-4 py-3 text-left transition ${selectedRestaurant?.id === restaurant.id ? 'border-red-400 bg-red-50' : 'border-slate-200 hover:border-red-200 hover:bg-red-50/40'}`}
                >
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{restaurant.name}</p>
                    {restaurant.address ? (
                      <p className="text-xs text-slate-500">{restaurant.address}</p>
                    ) : null}
                  </div>
                  <span className="text-xs text-slate-400">{t('basic.restaurant')}</span>
                </button>
              ))}
            </div>
          ) : null}
          <button
            type="button"
            onClick={() => setShowCreateRestaurant(true)}
            className="inline-flex items-center gap-2 rounded-2xl border border-dashed border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:border-red-300 hover:text-red-500"
          >
            <Plus className="h-4 w-4" />
            {t('review.addRestaurant')}
          </button>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-md shadow-slate-200/60 space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">{t('basic.dish')}</h2>
          {selectedRestaurant ? (
            <button
              type="button"
              onClick={() => setShowAddDish((value) => !value)}
              className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 px-3 py-2 text-xs font-semibold text-red-500 hover:border-red-300"
            >
              <Plus className="h-4 w-4" />
              {t('basic.addDish')}
            </button>
          ) : null}
        </div>
        <input
          value={draft.dishName}
          onChange={(event) => updateDraft((prev) => ({ ...prev, dishName: event.target.value }))}
          placeholder={t('basic.searchPlaceholder.dish')}
          className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-base focus:border-red-400 focus:outline-none focus:ring-2 focus:ring-red-100"
        />
        {selectedRestaurant ? (
          loadingDishes ? (
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              {t('basic.loadingDishes')}
            </div>
          ) : (
            <div className="grid gap-2">
              {filteredDishes.map((dish) => (
                <button
                  key={dish.id}
                  type="button"
                  onClick={() => onDishSelected(dish)}
                  className={`flex items-center justify-between rounded-2xl border px-4 py-3 text-left transition ${selectedDish?.id === dish.id ? 'border-red-400 bg-red-50' : 'border-slate-200 hover:border-red-200 hover:bg-red-50/40'}`}
                >
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{dish.name}</p>
                    {dish.description ? (
                      <p className="text-xs text-slate-500">{dish.description}</p>
                    ) : null}
                  </div>
                  {dish.price ? (
                    <span className="text-xs text-slate-500">${dish.price}</span>
                  ) : null}
                </button>
              ))}
            </div>
          )
        ) : (
          <p className="text-xs text-slate-400"></p>
        )}
        {showAddDish && selectedRestaurant ? (
          <AddDishInline
            restaurantId={selectedRestaurant.id}
            onAdded={(dish) => {
              setDishes((prev) => [...prev, dish]);
              onDishSelected(dish);
            }}
            onCancel={() => setShowAddDish(false)}
          />
        ) : null}
        <div className="pt-4 space-y-3">
          <h3 className="text-sm font-semibold text-slate-800">{t('review.dishCategory')}</h3>
          <DishCategorySelect
            value={(draft.dishCategory ?? null) as any}
            onSelect={(slug) =>
              updateDraft((prev) => ({
                ...prev,
                dishCategory: slug
              }))
            }
            options={CATEGORY_SLUGS as unknown as string[]}
          />
        </div>
        <div className="pt-2 space-y-3">
          <h3 className="text-sm font-semibold text-slate-800">Cuisine (optional)</h3>
          <div className="flex flex-wrap gap-2">
            {CUISINES.map((cuisine) => {
              const normalizedValue = normalizeToken(cuisine);
              const isSelected = selectedCuisines.includes(normalizedValue);
              return (
                <button
                  key={normalizedValue}
                  type="button"
                  onClick={() => toggleCuisine(cuisine)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition ${
                    isSelected ? 'bg-red-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {formatCuisineLabel(cuisine)}
                </button>
              );
            })}
          </div>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={customCuisineInput}
              onChange={(event) => setCustomCuisineInput(event.target.value)}
              onKeyDown={handleCustomCuisineKeyDown}
              placeholder="Add custom cuisine"
              className="flex-1 rounded-2xl border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-red-400 focus:outline-none focus:ring-2 focus:ring-red-100"
            />
            <button
              type="button"
              onClick={addCustomCuisine}
              disabled={!customCuisineInput.trim()}
              className={`rounded-2xl px-3 py-2 text-sm font-semibold transition ${
                customCuisineInput.trim() ? 'bg-red-500 text-white hover:bg-red-600' : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              }`}
            >
              Add
            </button>
          </div>
          {customSelectedCuisines.length ? (
            <div className="flex flex-wrap gap-2">
              {customSelectedCuisines.map((cuisine) => (
                <button
                  key={cuisine}
                  type="button"
                  onClick={() => toggleCuisine(cuisine)}
                  className="px-3 py-1 rounded-full bg-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-300 transition"
                >
                  {formatCuisineLabel(cuisine)}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-md shadow-slate-200/60 space-y-6">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">{t('review.overallRating')}</h2>
          <p className="text-sm text-slate-500">{t('basic.ratingHelp')}</p>
        </div>
        <div className="space-y-4">
          <RatingSlider value={draft.rating} onChange={(value) => updateDraft((prev) => ({ ...prev, rating: value }))} step={0.1} />
          <div className="flex items-center gap-3">
            <input
              type="number"
              step="0.1"
              min="0.1"
              max="10"
              value={draft.rating}
              onChange={(event) => {
                const value = parseFloat(event.target.value);
                if (!Number.isNaN(value)) {
                  updateDraft((prev) => ({ ...prev, rating: Math.max(0.1, Math.min(10, value)) }));
                }
              }}
              className="w-24 rounded-2xl border border-slate-200 px-3 py-2 text-center text-lg font-semibold text-slate-800 focus:border-red-400 focus:outline-none focus:ring-2 focus:ring-red-100"
            />
            <span className="text-sm text-slate-400">/ 10</span>
          </div>
        </div>
      </section>


      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleNext}
          disabled={!canProceed}
          className={`inline-flex items-center gap-2 rounded-2xl px-6 py-3 text-sm font-semibold transition ${canProceed ? 'bg-red-500 text-white hover:bg-red-600 shadow-md shadow-red-200/60' : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}
        >
          {pendingUploads ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {t('createWizard.actions.next')}
        </button>
      </div>

      <CreateRestaurantModal
        isOpen={showCreateRestaurant}
        userId={userId}
        defaultName={restaurantQuery}
        onClose={() => setShowCreateRestaurant(false)}
        onCreated={(restaurant) => {
          setRestaurants((prev) => [...prev, restaurant]);
          onRestaurantSelected(restaurant);
        }}
      />
    </div>
  );
};

export default Step1Basic;


























