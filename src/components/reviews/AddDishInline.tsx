import React, { useMemo, useRef, useState } from 'react';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { Loader2, Utensils } from 'lucide-react';
import { db } from '../../lib/firebase';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { useI18n } from '../../lib/i18n/useI18n';

export interface DishRecord {
  id: string;
  name: string;
  restaurantId: string;
  category?: string;
  price?: number | null;
  description?: string;
}

interface AddDishInlineProps {
  restaurantId: string;
  onAdded: (dish: DishRecord) => void;
  onCancel: () => void;
}

const AddDishInline: React.FC<AddDishInlineProps> = ({
  restaurantId,
  onAdded,
  onCancel
}) => {
  const { t } = useI18n();
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [price, setPrice] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submitActionRef = useRef<'add' | 'translate'>('add');

  const canSubmit = useMemo(() => name.trim().length > 1, [name]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSubmit || isSubmitting || isTranslating) return;

    const shouldTranslate = submitActionRef.current === 'translate';
    submitActionRef.current = 'add';

    try {
      setIsSubmitting(true);
      setError(null);
      const payload = {
        name: name.trim(),
        category: category.trim() || null,
        price: price ? Number(price) : null,
        description: description.trim() || null,
        restaurantId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      const docRef = await addDoc(collection(db, 'menuItems'), payload);

      if (shouldTranslate) {
        try {
          setIsTranslating(true);
          const functions = getFunctions();
          const translate = httpsCallable(functions, 'translateMenuItemToEs');
          await translate({ menuItemId: docRef.id });
        } catch (translateError) {
          console.error('Failed to translate dish', translateError);
        } finally {
          setIsTranslating(false);
        }
      }
      onAdded({
        id: docRef.id,
        name: payload.name,
        restaurantId,
        category: payload.category || undefined,
        price: payload.price ?? undefined,
        description: payload.description || undefined
      });
      onCancel();
    } catch (err) {
      console.error('Failed to create dish', err);
      setError(t('createWizard.status.error'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-md shadow-slate-200/70 space-y-4">
      <div className="flex items-center gap-2">
        <div className="rounded-2xl bg-red-100 p-2 text-red-500">
          <Utensils className="h-5 w-5" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-slate-900">{t('basic.newDish')}</h3>
          <p className="text-sm text-slate-500">{t('basic.createDishHint')}</p>
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-600 mb-2">{t('basic.dish')}</label>
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-base focus:border-red-400 focus:outline-none focus:ring-2 focus:ring-red-100"
          placeholder={t('basic.newDishPlaceholder')}
          required
        />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="block text-sm font-medium text-slate-600 mb-2">{t('basic.labels.category')}</label>
          <input
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-base focus:border-red-400 focus:outline-none focus:ring-2 focus:ring-red-100"
            placeholder={t('common.optional')}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-600 mb-2">{t('basic.labels.price')}</label>
          <input
            value={price}
            onChange={(event) => setPrice(event.target.value)}
            className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-base focus:border-red-400 focus:outline-none focus:ring-2 focus:ring-red-100"
            placeholder="12.00"
            inputMode="decimal"
          />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-600 mb-2">{t('basic.labels.description')}</label>
        <textarea
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-base focus:border-red-400 focus:outline-none focus:ring-2 focus:ring-red-100"
          placeholder={t('common.optional')}
          rows={3}
        />
      </div>
      {error ? <p className="text-sm text-red-500">{error}</p> : null}
      <div className="flex justify-end gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-2xl px-4 py-3 text-sm font-medium text-slate-500 hover:bg-slate-100"
        >
          {t('createWizard.actions.cancel')}
        </button>
        <button
          type="submit"
          disabled={!canSubmit || isSubmitting}
          className="inline-flex items-center gap-2 rounded-2xl bg-red-500 px-5 py-3 text-sm font-semibold text-white shadow-md shadow-red-200/60 transition hover:bg-red-600 disabled:cursor-not-allowed disabled:bg-slate-200"
        >
          {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {t('createWizard.actions.add')}
        </button>
        <button
          type="submit"
          disabled={!canSubmit || isSubmitting || isTranslating}
          onClick={() => { submitActionRef.current = 'translate'; }}
          className="inline-flex items-center gap-2 rounded-2xl border border-red-200 bg-white px-4 py-3 text-xs font-semibold text-red-600 shadow-sm transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isTranslating ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Translate to Spanish
        </button>
      </div>
    </form>
  );
};

export default AddDishInline;
