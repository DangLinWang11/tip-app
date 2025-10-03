import React, { useEffect, useMemo, useState } from 'react';
import { collection, getDocs, limit, query, where, orderBy } from 'firebase/firestore';
import { Compass, History, Layers, Sparkles } from 'lucide-react';
import { db } from '../../lib/firebase';
import { useI18n } from '../../lib/i18n/useI18n';
import { useReviewWizard } from './WizardContext';



const ARCHETYPES = [
  { group: 'pizza', tags: ['ny', 'neapolitan', 'detroit', 'chicago', 'roman'] },
  { group: 'burgers', tags: ['smash', 'diner', 'pub', 'gourmet', 'fastfood'] },
  { group: 'tacos', tags: ['street', 'baja', 'birria', 'al_pastor', 'texmex'] },
  { group: 'ramen', tags: ['tonkotsu', 'shoyu', 'miso', 'spicy', 'tsukemen'] },
  { group: 'sushi', tags: ['nigiri', 'rolls', 'omakase', 'fusion'] },
  { group: 'pasta', tags: ['roman', 'northern', 'seafood', 'baked'] },
  { group: 'salads', tags: ['chopped', 'mediterranean', 'protein_bowl', 'caesar'] },
  { group: 'desserts', tags: ['cheesecake', 'gelato', 'cake', 'pastry', 'fruit'] },
  { group: 'coffee', tags: ['third_wave', 'medium_classic', 'dark_robust', 'sweet_specialty'] }
];

type CompareMode = 'same_restaurant' | 'history' | 'archetype' | 'free_text';

interface ReviewSummary {
  id: string;
  dishName: string;
  rating: number;
  restaurantName?: string;
}

const Step3Compare: React.FC = () => {
  const { t } = useI18n();
  const { draft, updateDraft, goBack, goNext, showReward, userId } = useReviewWizard();
  const [mode, setMode] = useState<CompareMode>(draft.comparison?.mode || 'same_restaurant');
  const [reasons, setReasons] = useState<string[]>(draft.comparison?.reasons || []);
  const [freeText, setFreeText] = useState(draft.comparison?.targetText || '');
  const [error, setError] = useState<string | null>(null);
  const [restaurantDishes, setRestaurantDishes] = useState<ReviewSummary[]>([]);
  const [historyReviews, setHistoryReviews] = useState<ReviewSummary[]>([]);
  const [selectedDishId, setSelectedDishId] = useState<string | undefined>(draft.comparison?.targetDishId);
  const [selectedArchetype, setSelectedArchetype] = useState<string | undefined>(draft.comparison?.archetypeTag);

  useEffect(() => {
    if (!draft.restaurantId) return;
    const load = async () => {
      const snapshot = await getDocs(query(collection(db, 'menuItems'), where('restaurantId', '==', draft.restaurantId), limit(12)));
      setRestaurantDishes(snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        dishName: (docSnap.data() as { name: string }).name,
        rating: 0
      })));
    };
    load();
  }, [draft.restaurantId]);

  useEffect(() => {
    const loadHistory = async () => {
      if (!userId) return;
      const snapshot = await getDocs(query(collection(db, 'reviews'), where('userId', '==', userId), orderBy('createdAt', 'desc'), limit(12)));
      setHistoryReviews(snapshot.docs.map((docSnap) => {
        const data = docSnap.data() as any;
        return {
          id: docSnap.id,
          dishName: data.dishName || data.dish || 'Dish',
          rating: data.rating || 0,
          restaurantName: data.restaurantName
        };
      }));
    };
    loadHistory();
  }, [userId]);

  useEffect(() => {
    if (draft.comparison?.reasons) {
      setReasons(draft.comparison.reasons);
    }
    if (draft.comparison?.targetText) {
      setFreeText(draft.comparison.targetText);
    }
    if (draft.comparison?.targetDishId) {
      setSelectedDishId(draft.comparison.targetDishId);
    }
    if (draft.comparison?.archetypeTag) {
      setSelectedArchetype(draft.comparison.archetypeTag);
    }
  }, [draft.comparison]);

  const toggleReason = (reason: string) => {
    setReasons((prev) => {
      if (prev.includes(reason)) {
        return prev.filter((item) => item !== reason);
      }
      if (prev.length >= 2) {
        return [...prev.slice(1), reason];
      }
      return [...prev, reason];
    });
  };

  const chips = ['stale', 'cleanFlavors', 'bright', 'underSeasoned', 'balancedSalt', 'tooSalty', 'lukewarm', 'idealTemp', 'scalding', 'mushy', 'greatBite', 'tough', 'lackedKick', 'niceWarmth', 'overwhelms'];

  const handleModeChange = (nextMode: CompareMode) => {
    setMode(nextMode);
    setError(null);
    if (nextMode === 'free_text') {
      updateDraft((prev) => ({
        ...prev,
        comparison: prev.comparison?.mode === 'free_text' ? prev.comparison : { mode: 'free_text', targetText: '' }
      }));
    }
  };

  const handleSubmit = () => {
    if (mode === 'free_text') {
      if (freeText && BAD_WORDS.some((word) => freeText.toLowerCase().includes(word))) {
        setError(t('validation.profanity'));
        return;
      }
      updateDraft((prev) => ({
        ...prev,
        comparison: freeText.trim()
          ? { mode: 'free_text', targetText: freeText.trim() }
          : undefined
      }));
      showReward('compare');
      goNext();
      return;
    }

    if (reasons.length < 2) {
      setError(t('validation.comparisonReasons'));
      return;
    }

    if (mode === 'same_restaurant' && selectedDishId) {
      updateDraft((prev) => ({
        ...prev,
        comparison: {
          mode,
          targetDishId: selectedDishId,
          reasons
        }
      }));
      showReward('compare');
      goNext();
      return;
    }

    if (mode === 'history' && selectedDishId) {
      updateDraft((prev) => ({
        ...prev,
        comparison: {
          mode,
          targetDishId: selectedDishId,
          reasons
        }
      }));
      showReward('compare');
      goNext();
      return;
    }

    if (mode === 'archetype' && selectedArchetype) {
      updateDraft((prev) => ({
        ...prev,
        comparison: {
          mode,
          archetypeTag: selectedArchetype,
          reasons
        }
      }));
      showReward('compare');
      goNext();
      return;
    }

    setError(t('validation.required'));
  };

  const handleSkip = () => {
    updateDraft((prev) => ({
      ...prev,
      comparison: undefined
    }));
    goNext();
  };

  const reasonSection = (
    <div className="space-y-2">
      <p className="text-xs font-medium text-slate-500">{t('comparison.reasonsPrompt')}</p>
      <div className="flex flex-wrap gap-2">
        {chips.map((chip) => {
          const selected = reasons.includes(chip);
          return (
            <button
              key={chip}
              type="button"
              onClick={() => toggleReason(chip)}
              className={`rounded-2xl px-4 py-2 text-xs font-semibold transition ${selected ? 'bg-emerald-500 text-white shadow-md shadow-emerald-200/60' : 'bg-slate-100 text-slate-600 hover:bg-emerald-50 hover:text-emerald-600'}`}
            >
              {t(`comparison.chips.${chip}`)}
            </button>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="space-y-8">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-md shadow-slate-200/60 space-y-6">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">{t('comparison.title')}</h2>
          <p className="text-sm text-slate-500">{t('comparison.subtitle')}</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => handleModeChange('same_restaurant')}
            className={`flex items-center gap-3 rounded-2xl border px-4 py-3 text-left transition ${mode === 'same_restaurant' ? 'border-red-400 bg-red-50' : 'border-slate-200 hover:border-red-200 hover:bg-red-50/40'}`}
          >
            <Layers className="h-5 w-5 text-red-500" />
            <div>
              <p className="text-sm font-semibold text-slate-800">{t('comparison.sameRestaurant')}</p>
              <p className="text-xs text-slate-500">{selectedDishId && mode === 'same_restaurant' ? draft.comparison?.targetDishId : null}</p>
            </div>
          </button>
          <button
            type="button"
            onClick={() => handleModeChange('history')}
            className={`flex items-center gap-3 rounded-2xl border px-4 py-3 text-left transition ${mode === 'history' ? 'border-red-400 bg-red-50' : 'border-slate-200 hover:border-red-200 hover:bg-red-50/40'}`}
          >
            <History className="h-5 w-5 text-red-500" />
            <div>
              <p className="text-sm font-semibold text-slate-800">{t('comparison.history')}</p>
              <p className="text-xs text-slate-500">{t('comparison.recentlyTried')}</p>
            </div>
          </button>
          <button
            type="button"
            onClick={() => handleModeChange('archetype')}
            className={`flex items-center gap-3 rounded-2xl border px-4 py-3 text-left transition ${mode === 'archetype' ? 'border-red-400 bg-red-50' : 'border-slate-200 hover:border-red-200 hover:bg-red-50/40'}`}
          >
            <Compass className="h-5 w-5 text-red-500" />
            <div>
              <p className="text-sm font-semibold text-slate-800">{t('comparison.archetype')}</p>
              <p className="text-xs text-slate-500">{t('comparison.selectArchetype')}</p>
            </div>
          </button>
          <button
            type="button"
            onClick={() => handleModeChange('free_text')}
            className={`flex items-center gap-3 rounded-2xl border px-4 py-3 text-left transition ${mode === 'free_text' ? 'border-red-400 bg-red-50' : 'border-slate-200 hover:border-red-200 hover:bg-red-50/40'}`}
          >
            <Sparkles className="h-5 w-5 text-red-500" />
            <div>
              <p className="text-sm font-semibold text-slate-800">{t('comparison.freeText')}</p>
              <p className="text-xs text-slate-500">{t('comparison.freeTextPlaceholder')}</p>
            </div>
          </button>
        </div>

        {mode === 'same_restaurant' && draft.restaurantId ? (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-slate-800">{t('comparison.selectDish')}</h3>
            <div className="grid gap-2">
              {restaurantDishes.map((dish) => (
                <button
                  key={dish.id}
                  type="button"
                  onClick={() => setSelectedDishId(dish.id)}
                  className={`rounded-2xl border px-4 py-3 text-left transition ${selectedDishId === dish.id ? 'border-emerald-400 bg-emerald-50' : 'border-slate-200 hover:border-emerald-200 hover:bg-emerald-50/40'}`}
                >
                  <p className="text-sm font-semibold text-slate-800">{dish.dishName}</p>
                </button>
              ))}
            </div>
            {reasonSection}
          </div>
        ) : null}

        {mode === 'history' ? (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-slate-800">{t('comparison.history')}</h3>
            <div className="grid gap-2">
              {historyReviews.map((review) => (
                <button
                  key={review.id}
                  type="button"
                  onClick={() => setSelectedDishId(review.id)}
                  className={`rounded-2xl border px-4 py-3 text-left transition ${selectedDishId === review.id ? 'border-emerald-400 bg-emerald-50' : 'border-slate-200 hover:border-emerald-200 hover:bg-emerald-50/40'}`}
                >
                  <p className="text-sm font-semibold text-slate-800">{review.dishName}</p>
                  {review.restaurantName ? (
                    <p className="text-xs text-slate-500">{review.restaurantName}</p>
                  ) : null}
                </button>
              ))}
            </div>
            {reasonSection}
          </div>
        ) : null}

        {mode === 'archetype' ? (
          <div className="space-y-3">
            {ARCHETYPES.map((group) => (
              <div key={group.group} className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{group.group}</p>
                <div className="flex flex-wrap gap-2">
                  {group.tags.map((tag) => {
                    const fullTag = `${group.group}:${tag}`;
                    const selected = selectedArchetype === fullTag;
                    return (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => setSelectedArchetype(fullTag)}
                        className={`rounded-2xl px-4 py-2 text-sm font-medium transition ${selected ? 'bg-emerald-500 text-white shadow-md shadow-emerald-200/60' : 'bg-slate-100 text-slate-600 hover:bg-emerald-50 hover:text-emerald-600'}`}
                      >
                        {tag.replace('_', ' ')}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
            {reasonSection}
          </div>
        ) : null}

        {mode === 'free_text' ? (
          <div className="space-y-3">
            <textarea
              value={freeText}
              onChange={(event) => setFreeText(event.target.value)}
              placeholder={t('comparison.freeTextPlaceholder')}
              rows={4}
              className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-base focus:border-red-400 focus:outline-none focus:ring-2 focus:ring-red-100"
            />
          </div>
        ) : null}

        {error ? <p className="text-sm text-red-500">{error}</p> : null}
      </section>

      <div className="flex justify-between">
        <button
          type="button"
          onClick={goBack}
          className="rounded-2xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-600 hover:border-red-200 hover:text-red-500"
        >
          {t('createWizard.actions.back')}
        </button>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={handleSkip}
            className="rounded-2xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-600 hover:border-red-200 hover:text-red-500"
          >
            {t('createWizard.actions.skip')}
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            className="rounded-2xl bg-red-500 px-6 py-3 text-sm font-semibold text-white shadow-md shadow-red-200/60 hover:bg-red-600"
          >
            {t('createWizard.actions.next')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Step3Compare;
