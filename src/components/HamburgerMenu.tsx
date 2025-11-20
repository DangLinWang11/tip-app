import React, { useEffect, useState } from 'react';
import { Menu, X, Settings, HelpCircle, LogOut, Store as StoreIcon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { signOutUser, analytics } from '../lib/firebase';
import { logEvent } from 'firebase/analytics';
import { useOwnedRestaurants } from '../hooks/useOwnedRestaurants';

// Simple Settings Modal Component
const SettingsModal: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
  const [shareLocationEnabled, setShareLocationEnabled] = useState(false);
  const [locationPermissionState, setLocationPermissionState] = useState<PermissionState | 'unsupported'>('prompt');
  const [locationMessage, setLocationMessage] = useState<string | null>(null);
  const [isLocationMessageError, setIsLocationMessageError] = useState(false);
  const [isRequestingLocation, setIsRequestingLocation] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof navigator === 'undefined') {
      return;
    }

    let isMounted = true;
    let permissionStatus: PermissionStatus | null = null;

    const updateFromPermission = (state: PermissionState) => {
      if (!isMounted) return;
      setLocationPermissionState(state);
      const granted = state === 'granted';
      setShareLocationEnabled(granted);
      if (state === 'denied') {
        setLocationMessage('Location permission denied. Enable it in your browser settings.');
        setIsLocationMessageError(true);
      }
      if (state === 'granted') {
        setLocationMessage(null);
        setIsLocationMessageError(false);
      }
    };

    const handlePermissionChange = () => {
      if (!permissionStatus) return;
      updateFromPermission(permissionStatus.state);
    };

    const queryPermission = async () => {
      if (!navigator.permissions?.query) {
        setLocationPermissionState('unsupported');
        setShareLocationEnabled(false);
        return;
      }

      try {
        permissionStatus = await navigator.permissions.query({
          name: 'geolocation' as PermissionName
        });

        if (!isMounted || !permissionStatus) return;
        updateFromPermission(permissionStatus.state);
        permissionStatus.addEventListener('change', handlePermissionChange);
      } catch (error) {
        if (!isMounted) return;
        setLocationPermissionState('prompt');
        setShareLocationEnabled(false);
      }
    };

    queryPermission();

    return () => {
      isMounted = false;
      if (permissionStatus) {
        permissionStatus.removeEventListener('change', handlePermissionChange);
      }
    };
  }, []);

  const handleShareLocationChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const checked = event.target.checked;

    if (checked) {
      if (typeof navigator === 'undefined' || !navigator.geolocation) {
        setShareLocationEnabled(false);
        setLocationMessage('Geolocation is not supported in this browser.');
        setIsLocationMessageError(true);
        return;
      }

      setIsRequestingLocation(true);
      setLocationMessage(null);
      setIsLocationMessageError(false);

      navigator.geolocation.getCurrentPosition(
        () => {
          setIsRequestingLocation(false);
          setLocationPermissionState('granted');
          setShareLocationEnabled(true);
          setLocationMessage(null);
          setIsLocationMessageError(false);
        },
        (error: GeolocationPositionError) => {
          setIsRequestingLocation(false);
          setShareLocationEnabled(false);
          const denied = error.code === error.PERMISSION_DENIED;
          setLocationPermissionState(denied ? 'denied' : 'prompt');
          setLocationMessage(
            denied
              ? 'Location access denied. Enable it in your browser settings.'
              : 'Unable to access location. Please try again.'
          );
          setIsLocationMessageError(true);
        }
      );
    } else {
      setLocationMessage('To fully disable location, go to your browser settings.');
      setIsLocationMessageError(false);
      setShareLocationEnabled(locationPermissionState === 'granted');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-[110] flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Settings</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X size={20} className="text-gray-700" />
          </button>
        </div>

        {/* Settings Content */}
        <div className="p-6 space-y-6">
          {/* Notifications */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-3">Notifications</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-gray-700">Push Notifications</span>
                <input type="checkbox" className="toggle" defaultChecked />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-700">Email Updates</span>
                <input type="checkbox" className="toggle" />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-700">Review Reminders</span>
                <input type="checkbox" className="toggle" defaultChecked />
              </div>
            </div>
          </div>

          {/* Privacy */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-3">Privacy</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-gray-700">Public Profile</span>
                <input type="checkbox" className="toggle" defaultChecked />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-700">Share Location</span>
                <input
                  type="checkbox"
                  className="toggle"
                  checked={shareLocationEnabled}
                  onChange={handleShareLocationChange}
                  disabled={isRequestingLocation}
                />
              </div>
              {locationMessage && (
                <p className={`text-sm mt-2 ${isLocationMessageError ? 'text-red-600' : 'text-gray-500'}`}>
                  {locationMessage}
                </p>
              )}
            </div>
          </div>

          {/* Account */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-3">Account</h3>
            <div className="space-y-3">
              <button className="w-full text-left py-2 text-gray-700 hover:text-primary">
                Change Email Address
              </button>
              <button className="w-full text-left py-2 text-gray-700 hover:text-primary">
                Export My Data
              </button>
              <button className="w-full text-left py-2 text-red-600 hover:text-red-700">
                Delete Account
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Simple Help & Support Modal Component
const HelpModal: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    message: ''
  });

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Handle form submission here
    console.log('Form submitted:', formData);
    alert('Thank you for your message! We\'ll get back to you soon.');
    setFormData({ name: '', email: '', subject: '', message: '' });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-[110] flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Help & Support</h2>
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
            <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-primary"
              placeholder="Your name"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              required
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-primary"
              placeholder="your@email.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
            <select
              required
              value={formData.subject}
              onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-primary"
            >
              <option value="">Select a topic</option>
              <option value="bug">Report a Bug</option>
              <option value="feature">Feature Request</option>
              <option value="account">Account Issue</option>
              <option value="restaurant">Restaurant Partnership</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Message</label>
            <textarea
              required
              rows={4}
              value={formData.message}
              onChange={(e) => setFormData({ ...formData, message: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-primary resize-none"
              placeholder="Tell us how we can help..."
            />
          </div>

          <button
            type="submit"
            className="w-full bg-primary text-white py-3 rounded-lg font-medium hover:bg-red-600 transition-colors"
          >
            Send Message
          </button>
        </form>
      </div>
    </div>
  );
};

const HamburgerMenu: React.FC = () => {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
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
    const ok = window.confirm('Are you sure you want to log out?');
    if (!ok) return;
    try {
      const res = await signOutUser();
      if (!res.success) {
        alert(res.error || 'Failed to log out');
        return;
      }
      navigate('/');
    } catch (e) {
      console.error('Logout failed', e);
      alert('Failed to log out');
    }
  };

  return (
    <div className="relative">
      {/* Menu Button */}
      <button
        onClick={toggleMenu}
        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        aria-label="Open menu"
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
              aria-label="Your Restaurant"
              title="Analytics & deals for your restaurant."
            >
              <StoreIcon size={18} className="mr-3" />
              <span>Your Restaurant</span>
            </button>
          ) : (
            <button
              onClick={() => { try { if (analytics) logEvent(analytics as any, 'owner_entry', { source: 'hamburger', variant: 'claim' }); } catch {}; closeMenu(); navigate('/owner?start=claim'); }}
              className="flex items-center px-4 py-3 text-gray-700 hover:bg-gray-100 transition-colors w-full text-left whitespace-nowrap"
              aria-label="Claim my restaurant"
              title="Analytics & deals for your restaurant."
            >
              <StoreIcon size={18} className="mr-3" />
              <span>Claim my restaurant</span>
            </button>
          )}

          {/* Settings */}
          <button
            onClick={openSettings}
            className="flex items-center px-4 py-3 text-gray-700 hover:bg-gray-100 transition-colors w-full text-left"
          >
            <Settings size={18} className="mr-3" />
            <span>Settings</span>
          </button>

          {/* Help & Support */}
          <button
            onClick={openHelp}
            className="flex items-center px-4 py-3 text-gray-700 hover:bg-gray-100 transition-colors w-full text-left"
          >
            <HelpCircle size={18} className="mr-3" />
            <span>Help & Support</span>
          </button>

          {/* Logout */}
          <button
            onClick={handleLogout}
            className="flex items-center px-4 py-3 text-red-600 hover:bg-red-50 transition-colors w-full text-left border-t border-gray-100"
          >
            <LogOut size={18} className="mr-3" />
            <span>Log Out</span>
          </button>
        </div>
      </div>

      {/* Settings Modal */}
      <SettingsModal isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />

      {/* Help Modal */}
      <HelpModal isOpen={helpOpen} onClose={() => setHelpOpen(false)} />
    </div>
  );
};

export default HamburgerMenu;
