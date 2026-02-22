import React, { useEffect, useState } from 'react';
import { Menu, X, Settings, HelpCircle, LogOut, Store as StoreIcon, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { signOutUser, analytics } from '../lib/firebase';
import { logEvent } from 'firebase/analytics';
import { useOwnedRestaurants } from '../hooks/useOwnedRestaurants';
import ReactDOM from 'react-dom';
import FeedbackModal from './FeedbackModal';
import { useMapTheme, type MapTheme } from '../map/mapStyleConfig';
import { useI18n, AVAILABLE_LANGUAGES } from '../lib/i18n/useI18n';

// Simple Settings Modal Component
const SettingsModal: React.FC<{ isOpen: boolean; onClose: () => void; onOpenFeedback: () => void }> = ({ isOpen, onClose, onOpenFeedback }) => {
  const [locationPermissionState, setLocationPermissionState] = useState<PermissionState | 'unsupported'>('prompt');
  const [locationMessage, setLocationMessage] = useState<string | null>(null);
  const [mapTheme, setMapTheme] = useMapTheme();
  const { t, language, setLanguage } = useI18n();

  useEffect(() => {
    if (!isOpen || typeof navigator === 'undefined' || !navigator.permissions?.query) {
      return;
    }

    let isMounted = true;
    let permissionStatus: PermissionStatus | null = null;

    const updatePermissionState = (state: PermissionState) => {
      if (!isMounted) return;
      setLocationPermissionState(state);

      if (state === 'denied') {
        setLocationMessage(t('settings.location.messages.denied'));
      } else if (state === 'granted') {
        setLocationMessage(t('settings.location.messages.enabled'));
      } else {
        setLocationMessage(null);
      }
    };

    const queryPermission = async () => {
      try {
        permissionStatus = await navigator.permissions.query({ name: 'geolocation' as PermissionName });
        if (!isMounted || !permissionStatus) return;

        updatePermissionState(permissionStatus.state);
        permissionStatus.addEventListener('change', () => updatePermissionState(permissionStatus!.state));
      } catch {
        setLocationPermissionState('unsupported');
      }
    };

    queryPermission();

    return () => {
      isMounted = false;
      if (permissionStatus) {
        permissionStatus.removeEventListener('change', () => {});
      }
    };
  }, [isOpen]);

  const handleRequestLocation = () => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setLocationMessage(t('settings.location.messages.notSupported'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      () => {
        setLocationPermissionState('granted');
        setLocationMessage(t('settings.location.messages.granted'));
      },
      (error) => {
        if (error.code === error.PERMISSION_DENIED) {
          setLocationMessage(t('settings.location.messages.permissionDenied'));
        } else {
          setLocationMessage(t('settings.location.messages.unable'));
        }
      }
    );
  };

  if (!isOpen) return null;

  const modalContent = (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-[1000] flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">{t('settings.title')}</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <X size={20} className="text-gray-700" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Location Section */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-3">{t('settings.location.title')}</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-gray-700">{t('settings.location.permissionStatus')}</span>
                <span
                  className={`text-sm font-medium ${
                    locationPermissionState === 'granted'
                      ? 'text-green-600'
                      : locationPermissionState === 'denied'
                        ? 'text-red-600'
                        : 'text-gray-500'
                  }`}
                >
                  {locationPermissionState === 'granted'
                    ? t('settings.location.status.granted')
                    : locationPermissionState === 'denied'
                      ? t('settings.location.status.denied')
                      : locationPermissionState === 'unsupported'
                        ? t('settings.location.status.notSupported')
                        : t('settings.location.status.notRequested')}
                </span>
              </div>

              {locationPermissionState !== 'granted' && (
                <button
                  onClick={handleRequestLocation}
                  className="w-full py-2 px-4 bg-primary text-white rounded-lg hover:bg-red-600 transition-colors"
                >
                  {t('settings.location.requestAccess')}
                </button>
              )}

              {locationMessage && (
                <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">
                  {locationMessage}
                </p>
              )}
            </div>
          </div>

          {/* Privacy */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-3">{t('settings.privacy.title')}</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-gray-700">{t('settings.privacy.publicProfile')}</span>
                <input type="checkbox" className="toggle" defaultChecked />
              </div>
            </div>
          </div>

          {/* Map Theme */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-3">{t('settings.map.title')}</h3>
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <span className="text-gray-700">{t('settings.map.theme')}</span>
                <select
                  value={mapTheme}
                  onChange={(e) => setMapTheme(e.target.value as MapTheme)}
                  className="border border-gray-300 rounded-md px-2 py-1 text-sm focus:outline-none focus:border-primary"
                >
                  <option value="pastel">{t('settings.map.themeDefault')}</option>
                  <option value="mono">{t('settings.map.themeMono')}</option>
                </select>
              </div>
              <p className="text-xs text-gray-500">{t('settings.map.applyInstant')}</p>
            </div>
          </div>

          {/* Language */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-3">{t('settings.language.title')}</h3>
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <span className="text-gray-700">{t('settings.language.label')}</span>
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value as any)}
                  className="border border-gray-300 rounded-md px-2 py-1 text-sm focus:outline-none focus:border-primary"
                >
                  {AVAILABLE_LANGUAGES.map((opt) => (
                    <option key={opt.code} value={opt.code}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
              <p className="text-xs text-gray-500">{t('settings.language.applyInstant')}</p>
            </div>
          </div>

          {/* Account */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-3">{t('settings.account.title')}</h3>
            <div className="space-y-3">
              <button className="w-full text-left py-2 text-gray-700 hover:text-primary">
                {t('settings.account.changeEmail')}
              </button>
              <button className="w-full text-left py-2 text-red-600 hover:text-red-700">
                {t('settings.account.deleteAccount')}
              </button>
            </div>
          </div>

          {/* Help & Feedback */}
          <div>
            <div
              className="flex items-center justify-between py-4 cursor-pointer hover:bg-gray-50 -mx-6 px-6 rounded-lg transition-colors"
              onClick={() => {
                onClose();
                onOpenFeedback();
              }}
            >
              <label className="text-lg font-medium text-gray-900 cursor-pointer">{t('settings.helpFeedback')}</label>
              <ChevronRight className="w-5 h-5 text-gray-400" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  if (typeof document === 'undefined') return modalContent;
  return ReactDOM.createPortal(modalContent, document.body);
};

// Simple Help & Support Modal Component
const HelpModal: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
  const { t } = useI18n();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    message: ''
  });


  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Handle form submission here
    console.log('Form submitted:', formData);
    alert(t('settings.help.alertThanks'));
    setFormData({ name: '', email: '', subject: '', message: '' });
    onClose();
  };

  if (!isOpen) return null;

  const modalContent = (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-[1000] flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">{t('settings.help.title')}</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X size={20} className="text-gray-700" />
          </button>
        </div>

        {/* Contact Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('settings.help.form.name')}</label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-primary"
              placeholder={t('settings.help.placeholders.name')}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('settings.help.form.email')}</label>
            <input
              type="email"
              required
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-primary"
              placeholder={t('settings.help.placeholders.email')}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('settings.help.form.subject')}</label>
            <select
              required
              value={formData.subject}
              onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-primary"
            >
              <option value="">{t('settings.help.subject.select')}</option>
              <option value="bug">{t('settings.help.subject.options.bug')}</option>
              <option value="feature">{t('settings.help.subject.options.feature')}</option>
              <option value="account">{t('settings.help.subject.options.account')}</option>
              <option value="restaurant">{t('settings.help.subject.options.restaurant')}</option>
              <option value="other">{t('settings.help.subject.options.other')}</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('settings.help.form.message')}</label>
            <textarea
              required
              rows={4}
              value={formData.message}
              onChange={(e) => setFormData({ ...formData, message: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-primary resize-none"
              placeholder={t('settings.help.placeholders.message')}
            />
          </div>

          <button
            type="submit"
            className="w-full bg-primary text-white py-3 rounded-lg font-medium hover:bg-red-600 transition-colors"
          >
            {t('settings.help.submit')}
          </button>
        </form>
      </div>
    </div>
  );

  if (typeof document === 'undefined') return modalContent;
  return ReactDOM.createPortal(modalContent, document.body);
};

const HamburgerMenu: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useI18n();
  const [isOpen, setIsOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const { ownsAny } = useOwnedRestaurants();

  const toggleMenu = () => {
    setIsOpen(!isOpen);
  };

  const closeMenu = () => {
    setIsOpen(false);
  };

  const openSettings = () => {
    closeMenu();
    setSettingsOpen(true);
  };

  const openHelp = () => {
    closeMenu();
    setHelpOpen(true);
  };

  const handleLogout = async () => {
    closeMenu();
    const ok = window.confirm(t('settings.logout.confirm'));
    if (!ok) return;
    try {
      const res = await signOutUser();
      if (!res.success) {
        alert(res.error || t('settings.logout.failed'));
        return;
      }
      navigate('/');
    } catch (e) {
      console.error('Logout failed', e);
      alert(t('settings.logout.failed'));
    }
  };

  return (
    <div className="relative">
      {/* Menu Button */}
      <button
        onClick={toggleMenu}
        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        aria-label={t('settings.menu.open')}
      >
        <Menu size={24} className="text-gray-700" />
      </button>

      {/* Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-[90]"
          onClick={closeMenu}
        />
      )}

      {/* Dropdown Menu */}
      <div className={`
        absolute top-full right-0 mt-2 w-56 bg-white rounded-lg shadow-xl z-[100] transform transition-all duration-200 ease-in-out
        ${isOpen ? 'opacity-100 scale-100' : 'opacity-0 scale-95 pointer-events-none'}
      `}>
        {/* Menu Items */}
        <div className="py-2">
          {/* For Restaurants */}
          {ownsAny ? (
            <button
              onClick={() => { try { if (analytics) logEvent(analytics as any, 'owner_entry', { source: 'hamburger', variant: 'owner' }); } catch {}; closeMenu(); navigate('/owner'); }}
              className="flex items-center px-4 py-3 text-gray-700 hover:bg-gray-100 transition-colors w-full text-left whitespace-nowrap"
              aria-label={t('settings.menu.owner')}
              title={t('settings.menu.ownerTitle')}
            >
              <StoreIcon size={18} className="mr-3" />
              <span>{t('settings.menu.owner')}</span>
            </button>
          ) : (
            <button
              onClick={() => { try { if (analytics) logEvent(analytics as any, 'owner_entry', { source: 'hamburger', variant: 'claim' }); } catch {}; closeMenu(); navigate('/owner?start=claim'); }}
              className="flex items-center px-4 py-3 text-gray-700 hover:bg-gray-100 transition-colors w-full text-left whitespace-nowrap"
              aria-label={t('settings.menu.claim')}
              title={t('settings.menu.ownerTitle')}
            >
              <StoreIcon size={18} className="mr-3" />
              <span>{t('settings.menu.claim')}</span>
            </button>
          )}

          {/* Settings */}
          <button
            onClick={openSettings}
            className="flex items-center px-4 py-3 text-gray-700 hover:bg-gray-100 transition-colors w-full text-left"
          >
            <Settings size={18} className="mr-3" />
            <span>{t('settings.title')}</span>
          </button>

          {/* Help & Support */}
          <button
            onClick={openHelp}
            className="flex items-center px-4 py-3 text-gray-700 hover:bg-gray-100 transition-colors w-full text-left"
          >
            <HelpCircle size={18} className="mr-3" />
            <span>{t('settings.help.title')}</span>
          </button>

          {/* Logout */}
          <button
            onClick={handleLogout}
            className="flex items-center px-4 py-3 text-red-600 hover:bg-red-50 transition-colors w-full text-left border-t border-gray-100"
          >
            <LogOut size={18} className="mr-3" />
            <span>{t('settings.logout.label')}</span>
          </button>
        </div>
      </div>

      {/* Settings Modal */}
      <SettingsModal
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onOpenFeedback={() => setFeedbackOpen(true)}
      />

      {/* Help Modal */}
      <HelpModal isOpen={helpOpen} onClose={() => setHelpOpen(false)} />

      {/* Feedback Modal */}
      <FeedbackModal isOpen={feedbackOpen} onClose={() => setFeedbackOpen(false)} />
    </div>
  );
};

export default HamburgerMenu;
