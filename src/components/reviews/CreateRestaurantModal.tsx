import React, { useMemo, useState } from 'react';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { X, MapPin, Loader2 } from 'lucide-react';
import LocationPickerModal from '../LocationPickerModal';
import { db } from '../../lib/firebase';
import { useI18n } from '../../lib/i18n/useI18n';

export interface RestaurantRecord {
  id: string;
  name: string;
  address?: string;
  cuisine?: string;
  cuisines?: string[];
  phone?: string;
  coordinates?: {
    latitude: number;
    longitude: number;
  };
}

interface CreateRestaurantModalProps {
  isOpen: boolean;
  defaultName?: string;
  userId: string;
  onClose: () => void;
  onCreated: (restaurant: RestaurantRecord) => void;
}

const CreateRestaurantModal: React.FC<CreateRestaurantModalProps> = ({
  isOpen,
  defaultName = '',
  userId,
  onClose,
  onCreated
}) => {
  const { t } = useI18n();
  const [name, setName] = useState(defaultName);
  const [address, setAddress] = useState('');
  const [cuisineInput, setCuisineInput] = useState('');
  const [phone, setPhone] = useState('');
  const [coordinates, setCoordinates] = useState<{ latitude: number; longitude: number } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showMap, setShowMap] = useState(false);

  React.useEffect(() => {
    if (isOpen) {
      setName(defaultName);
      setAddress('');
      setCuisineInput('');
      setPhone('');
      setCoordinates(null);
      setError(null);
      setIsSubmitting(false);
    }
  }, [isOpen, defaultName]);

  const canSubmit = useMemo(() => name.trim().length > 2 && cuisineInput.trim().length > 0, [name, cuisineInput]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSubmit || isSubmitting) return;

    try {
      setIsSubmitting(true);
      setError(null);

      const cuisineList = cuisineInput
        .split(',')
        .map((entry) => entry.trim())
        .filter(Boolean);

      const payload = {
        name: name.trim(),
        address: address.trim() || null,
        cuisine: cuisineList[0] || null,
        cuisines: cuisineList.length ? cuisineList : null,
        phone: phone.trim() || null,
        coordinates: coordinates
          ? {
              latitude: coordinates.latitude,
              longitude: coordinates.longitude
            }
          : null,
        createdBy: userId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      const docRef = await addDoc(collection(db, 'restaurants'), payload);
      onCreated({
        id: docRef.id,
        name: payload.name,
        address: payload.address || undefined,
        cuisine: payload.cuisine || undefined,
        cuisines: payload.cuisines || undefined,
        phone: payload.phone || undefined,
        coordinates: payload.coordinates || undefined
      });
      onClose();
    } catch (err) {
      console.error('Failed to create restaurant', err);
      setError(err instanceof Error ? err.message : t('createWizard.status.error'));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-lg rounded-3xl bg-white shadow-xl p-1">
        <div className="flex items-center justify-between px-6 pt-6">
          <h2 className="text-xl font-semibold text-slate-900">{t('basic.newRestaurant')}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-slate-500 hover:bg-slate-100"
            aria-label={t('createWizard.actions.cancel')}
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 pb-6 pt-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-2">
              {t('basic.labels.name')} *
            </label>
            <input
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-base focus:border-red-400 focus:outline-none focus:ring-2 focus:ring-red-100"
              placeholder={t('basic.labels.name')}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-2">
              {t('basic.labels.address')}
            </label>
            <input
              type="text"
              value={address}
              onChange={(event) => setAddress(event.target.value)}
              className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-base focus:border-red-400 focus:outline-none focus:ring-2 focus:ring-red-100"
              placeholder={t('basic.labels.address')}
            />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-2">
                {t('basic.labels.cuisine')} *
              </label>
              <input
                type="text"
                value={cuisineInput}
                onChange={(event) => setCuisineInput(event.target.value)}
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-base focus:border-red-400 focus:outline-none focus:ring-2 focus:ring-red-100"
                placeholder={t('basic.labels.cuisine')}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-2">
                {t('basic.labels.phone')}
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-base focus:border-red-400 focus:outline-none focus:ring-2 focus:ring-red-100"
                placeholder={t('basic.labels.phone')}
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-2">
              {t('basic.labels.location')}
            </label>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setShowMap(true)}
                className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700 hover:border-red-300 hover:text-red-500"
              >
                <MapPin className="h-4 w-4" />
                {coordinates ? t('basic.actions.updateLocation') : t('basic.actions.setOnMap')}
              </button>
              {coordinates ? (
                <span className="text-xs text-slate-500">
                  {coordinates.latitude.toFixed(4)}, {coordinates.longitude.toFixed(4)}
                </span>
              ) : (
                <span className="text-xs text-slate-400">{t('basic.helpers.locationOptional')}</span>
              )}
            </div>
          </div>
          {error ? <p className="text-sm text-red-500">{error}</p> : null}
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
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
              {t('basic.actions.createRestaurant')}
            </button>
          </div>
        </form>
      </div>
      <LocationPickerModal
        isOpen={showMap}
        restaurantName={name}
        onConfirm={(coords) => {
          setCoordinates({ latitude: coords.lat, longitude: coords.lng });
          setShowMap(false);
        }}
        onCancel={() => setShowMap(false)}
      />
    </div>
  );
};

export default CreateRestaurantModal;
