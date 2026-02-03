import React, { useMemo, useState } from 'react';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { X, MapPin, Loader2 } from 'lucide-react';
import LocationPickerModal from '../LocationPickerModal';
import { db } from '../../lib/firebase';
import { useI18n } from '../../lib/i18n/useI18n';
import { getCountryFromCoordinates } from '../../utils/reverseGeocode';
import { validateCoordinates } from '../../utils/validateCoordinates';

export interface RestaurantRecord {
  id: string;
  name: string;
  address?: string;
  cuisines?: string[];
  coordinates?: {
    latitude: number;
    longitude: number;
  };
  googlePlaceId?: string;
  source?: 'manual' | 'google_places';
  qualityScore?: number | null;
  countryCode?: string;
  countryName?: string;
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
  const [coordinates, setCoordinates] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locationConfirmed, setLocationConfirmed] = useState<{ label: string; code?: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showMap, setShowMap] = useState(false);
  const [locationMode, setLocationMode] = useState<'search' | 'pin'>('search');

  React.useEffect(() => {
    if (isOpen) {
      setName(defaultName);
      setAddress('');
      setCoordinates(null);
      setLocationConfirmed(null);
      setError(null);
      setIsSubmitting(false);
      setLocationMode('search');
    }
  }, [isOpen, defaultName]);

  const coordinateCheck = useMemo(() => validateCoordinates(
    coordinates ? { latitude: coordinates.latitude, longitude: coordinates.longitude } : null
  ), [coordinates]);

  const canSubmit = useMemo(() => {
    const hasValidName = name.trim().length > 2;
    return hasValidName && coordinateCheck.valid;
  }, [name, coordinateCheck]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSubmit || isSubmitting) return;

    try {
      setIsSubmitting(true);
      setError(null);

      const coordCheck = validateCoordinates(
        coordinates ? { latitude: coordinates.latitude, longitude: coordinates.longitude } : null
      );
      if (!coordCheck.valid) {
        throw new Error('Choose a location (search a place or drop a pin)');
      }

      // Reverse geocode to get country if coordinates available
      let countryCode = '';
      let countryName = '';
      if (coordinates) {
        try {
          const countryResult = await getCountryFromCoordinates(coordinates.latitude, coordinates.longitude);
          if (countryResult) {
            countryCode = countryResult.code;
            countryName = countryResult.name;
            setLocationConfirmed({
              label: `Location set ✓ ${countryResult.name}`,
              code: countryResult.code
            });
          }
        } catch {
          // Non-blocking: country detection is best-effort
        }
      }

      const payload: Record<string, any> = {
        name: name.trim(),
        address: address.trim() || null,
        coordinates: coordinates
          ? {
              lat: coordinates.latitude,
              lng: coordinates.longitude,
              latitude: coordinates.latitude,
              longitude: coordinates.longitude
            }
          : null,
        source: 'manual',
        createdBy: userId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };
      if (countryCode) {
        payload.countryCode = countryCode;
        payload.countryName = countryName;
      }

      const docRef = await addDoc(collection(db, 'restaurants'), payload);
      onCreated({
        id: docRef.id,
        name: payload.name,
        address: payload.address || undefined,
        cuisines: undefined,
        coordinates: payload.coordinates || undefined,
        countryCode: countryCode || undefined,
        countryName: countryName || undefined,
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

  // QA checklist:
  // - Cannot save without coords
  // - Dropping a pin sets coords correctly
  // - Searching a place sets coords correctly
  // - Invalid lng/lat blocked
  // - 0,0 blocked
  // - Works on desktop + mobile PWA

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
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-2">
              {t('basic.labels.location')} <span className="text-red-500">*</span>
            </label>
            <div className="flex items-center gap-2 mb-3">
              <button
                type="button"
                onClick={() => setLocationMode('search')}
                className={`rounded-full px-3 py-1 text-xs font-medium border ${
                  locationMode === 'search'
                    ? 'border-red-300 bg-red-50 text-red-600'
                    : 'border-slate-200 text-slate-500 hover:border-red-200'
                }`}
              >
                Search for a place
              </button>
              <button
                type="button"
                onClick={() => setLocationMode('pin')}
                className={`rounded-full px-3 py-1 text-xs font-medium border ${
                  locationMode === 'pin'
                    ? 'border-red-300 bg-red-50 text-red-600'
                    : 'border-slate-200 text-slate-500 hover:border-red-200'
                }`}
              >
                Drop a pin
              </button>
            </div>
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
                <span className="text-xs text-slate-400">
                  {locationMode === 'search'
                    ? 'Use the search above to select a Google place'
                    : 'Required: drop a pin on the map'}
                </span>
              )}
            </div>
            {locationConfirmed && (
              <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs text-emerald-700">
                <span>{locationConfirmed.label}</span>
              </div>
            )}
            {!coordinateCheck.valid && name.trim().length > 2 && (
              <p className="mt-2 text-sm text-red-500">
                Choose a location (search a place or drop a pin)
              </p>
            )}
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
          setLocationConfirmed({ label: 'Location set ✓' });
          setLocationMode('pin');
          setShowMap(false);
        }}
        onCancel={() => setShowMap(false)}
      />
    </div>
  );
};

export default CreateRestaurantModal;
