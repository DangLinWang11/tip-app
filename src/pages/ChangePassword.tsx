import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Eye, EyeOff, Lock, Save, Shield, AlertTriangle } from 'lucide-react';
import { updatePassword, reauthenticateWithCredential, EmailAuthProvider } from 'firebase/auth';
import { getCurrentUser } from '../lib/firebase';
import { useI18n } from '../lib/i18n/useI18n';

interface PasswordForm {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

interface PasswordVisibility {
  current: boolean;
  new: boolean;
  confirm: boolean;
}

const ChangePassword: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useI18n();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  
  const [formData, setFormData] = useState<PasswordForm>({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  
  const [passwordVisibility, setPasswordVisibility] = useState<PasswordVisibility>({
    current: false,
    new: false,
    confirm: false
  });

  const [validationErrors, setValidationErrors] = useState<Partial<PasswordForm>>({});

  // Handle form input changes
  const handleInputChange = (field: keyof PasswordForm, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // Clear specific validation error when user starts typing
    if (validationErrors[field]) {
      setValidationErrors(prev => ({ ...prev, [field]: undefined }));
    }
    
    setError(null);
    setSuccessMessage(null);
  };

  // Toggle password visibility
  const togglePasswordVisibility = (field: keyof PasswordVisibility) => {
    setPasswordVisibility(prev => ({ ...prev, [field]: !prev[field] }));
  };

  // Password strength indicator
  const getPasswordStrength = (password: string): { strength: number; labelKey: string; color: string } => {
    if (password.length === 0) return { strength: 0, labelKey: '', color: '' };
    
    let strength = 0;
    const checks = [
      password.length >= 8,           // Length
      /[a-z]/.test(password),        // Lowercase
      /[A-Z]/.test(password),        // Uppercase
      /\d/.test(password),           // Numbers
      /[!@#$%^&*(),.?":{}|<>]/.test(password) // Special chars
    ];
    
    strength = checks.filter(Boolean).length;
    
    if (strength <= 2) return { strength, labelKey: 'settings.password.strength.weak', color: 'text-red-500' };
    if (strength === 3) return { strength, labelKey: 'settings.password.strength.fair', color: 'text-yellow-500' };
    if (strength === 4) return { strength, labelKey: 'settings.password.strength.good', color: 'text-blue-500' };
    return { strength, labelKey: 'settings.password.strength.strong', color: 'text-green-500' };
  };

  // Form validation
  const validateForm = (): boolean => {
    const errors: Partial<PasswordForm> = {};
    
    // Current password validation
    if (!formData.currentPassword) {
      errors.currentPassword = t('validation.password.currentRequired');
    }
    
    // New password validation
    if (!formData.newPassword) {
      errors.newPassword = t('validation.password.newRequired');
    } else if (formData.newPassword.length < 6) {
      errors.newPassword = t('validation.password.minLength', { min: 6 });
    } else if (formData.newPassword === formData.currentPassword) {
      errors.newPassword = t('validation.password.mustDiffer');
    }
    
    // Confirm password validation
    if (!formData.confirmPassword) {
      errors.confirmPassword = t('validation.password.confirmRequired');
    } else if (formData.confirmPassword !== formData.newPassword) {
      errors.confirmPassword = t('validation.password.noMatch');
    }
    
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Handle password change
  const handleChangePassword = async () => {
    if (!validateForm()) {
      setError(t('validation.password.fixErrors'));
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const currentUser = getCurrentUser();
      if (!currentUser || !currentUser.email) {
        setError(t('profile.errors.noAuth'));
        return;
      }

      // Re-authenticate user with current password
      const credential = EmailAuthProvider.credential(currentUser.email, formData.currentPassword);
      
      try {
        await reauthenticateWithCredential(currentUser, credential);
      } catch (reauthError: any) {
        if (reauthError.code === 'auth/wrong-password') {
          setValidationErrors(prev => ({ ...prev, currentPassword: t('validation.password.currentIncorrect') }));
          setError(t('validation.password.currentIncorrect'));
        } else if (reauthError.code === 'auth/too-many-requests') {
          setError(t('settings.password.errors.tooManyAttempts'));
        } else {
          setError(t('settings.password.errors.verifyFailed'));
        }
        return;
      }

      // Update password
      await updatePassword(currentUser, formData.newPassword);
      
      setSuccessMessage(t('settings.password.success.updated'));
      
      // Clear form
      setFormData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      });
      
      // Navigate back to edit profile after a short delay
      setTimeout(() => {
        navigate('/profile/edit');
      }, 2000);

    } catch (error: any) {
      console.error('Error changing password:', error);
      
      if (error.code === 'auth/weak-password') {
        setValidationErrors(prev => ({ ...prev, newPassword: t('validation.password.tooWeak') }));
        setError(t('settings.password.errors.tooWeak'));
      } else if (error.code === 'auth/requires-recent-login') {
        setError(t('settings.password.errors.recentLogin'));
      } else {
        setError(t('settings.password.errors.updateFailed'));
      }
    } finally {
      setLoading(false);
    }
  };

  // Check if form is valid for submit
  const isFormValid = () => {
    return (
      formData.currentPassword &&
      formData.newPassword &&
      formData.confirmPassword &&
      formData.newPassword.length >= 6 &&
      formData.newPassword === formData.confirmPassword &&
      formData.newPassword !== formData.currentPassword
    );
  };

  const passwordStrength = getPasswordStrength(formData.newPassword);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white px-4 py-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <button 
              onClick={() => navigate('/profile/edit')}
              className="mr-3 p-2 hover:bg-gray-100 rounded-full transition-colors"
            >
              <ArrowLeft size={24} className="text-gray-600" />
            </button>
            <h1 className="text-xl font-semibold">{t('settings.password.title')}</h1>
          </div>
          <button
            onClick={handleChangePassword}
            disabled={loading || !isFormValid()}
            className={`flex items-center px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              loading || !isFormValid()
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-primary text-white hover:bg-red-600'
            }`}
          >
            <Save size={16} className="mr-1" />
            {loading ? t('settings.password.actions.updating') : t('settings.password.actions.update')}
          </button>
        </div>
      </header>

      {/* Content */}
      <div className="p-4 max-w-md mx-auto">
        {/* Success Message */}
        {successMessage && (
          <div className="mb-4 p-3 bg-green-100 border border-green-300 text-green-700 rounded-lg flex items-center">
            <Shield size={16} className="mr-2 flex-shrink-0" />
            {successMessage}
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="mb-4 p-3 bg-red-100 border border-red-300 text-red-700 rounded-lg flex items-center">
            <AlertTriangle size={16} className="mr-2 flex-shrink-0" />
            {error}
          </div>
        )}

        {/* Security Notice */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <div className="flex items-start">
            <Shield size={20} className="text-blue-600 mr-3 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-medium text-blue-900 mb-1">{t('settings.password.securityTips.title')}</h3>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>&bull; {t('settings.password.securityTips.unique')}</li>
                <li>&bull; {t('settings.password.securityTips.complex')}</li>
                <li>&bull; {t('settings.password.securityTips.avoidPersonal')}</li>
                <li>&bull; {t('settings.password.securityTips.manager')}</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Password Form */}
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <div className="flex items-center mb-4">
            <Lock size={20} className="text-gray-600 mr-2" />
            <h2 className="text-lg font-semibold">{t('settings.password.sectionTitle')}</h2>
          </div>

          {/* Current Password */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('settings.password.fields.current.label')}
            </label>
            <div className="relative">
              <input
                type={passwordVisibility.current ? 'text' : 'password'}
                value={formData.currentPassword}
                onChange={(e) => handleInputChange('currentPassword', e.target.value)}
                className={`w-full px-3 py-2 pr-10 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent ${
                  validationErrors.currentPassword ? 'border-red-300' : 'border-gray-300'
                }`}
                placeholder={t('settings.password.fields.current.placeholder')}
              />
              <button
                type="button"
                onClick={() => togglePasswordVisibility('current')}
                className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700 transition-colors"
              >
                {passwordVisibility.current ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {validationErrors.currentPassword && (
              <p className="text-red-500 text-xs mt-1">{validationErrors.currentPassword}</p>
            )}
          </div>

          {/* New Password */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('settings.password.fields.new.label')}
            </label>
            <div className="relative">
              <input
                type={passwordVisibility.new ? 'text' : 'password'}
                value={formData.newPassword}
                onChange={(e) => handleInputChange('newPassword', e.target.value)}
                className={`w-full px-3 py-2 pr-10 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent ${
                  validationErrors.newPassword ? 'border-red-300' : 'border-gray-300'
                }`}
                placeholder={t('settings.password.fields.new.placeholder')}
              />
              <button
                type="button"
                onClick={() => togglePasswordVisibility('new')}
                className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700 transition-colors"
              >
                {passwordVisibility.new ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            
            {/* Password Strength Indicator */}
            {formData.newPassword && (
              <div className="mt-2">
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-gray-600">{t('settings.password.strength.label')}</span>
                  <span className={passwordStrength.color}>
                    {passwordStrength.labelKey ? t(passwordStrength.labelKey) : ''}
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-1.5">
                  <div 
                    className={`h-1.5 rounded-full transition-all duration-300 ${
                      passwordStrength.strength <= 2 ? 'bg-red-500' :
                      passwordStrength.strength === 3 ? 'bg-yellow-500' :
                      passwordStrength.strength === 4 ? 'bg-blue-500' : 'bg-green-500'
                    }`}
                    style={{ width: `${(passwordStrength.strength / 5) * 100}%` }}
                  />
                </div>
              </div>
            )}
            
            {validationErrors.newPassword && (
              <p className="text-red-500 text-xs mt-1">{validationErrors.newPassword}</p>
            )}
            <p className="text-xs text-gray-500 mt-1">
              {t('settings.password.fields.new.help', { min: 6 })}
            </p>
          </div>

          {/* Confirm Password */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('settings.password.fields.confirm.label')}
            </label>
            <div className="relative">
              <input
                type={passwordVisibility.confirm ? 'text' : 'password'}
                value={formData.confirmPassword}
                onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
                className={`w-full px-3 py-2 pr-10 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent ${
                  validationErrors.confirmPassword ? 'border-red-300' : 'border-gray-300'
                }`}
                placeholder={t('settings.password.fields.confirm.placeholder')}
              />
              <button
                type="button"
                onClick={() => togglePasswordVisibility('confirm')}
                className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700 transition-colors"
              >
                {passwordVisibility.confirm ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {validationErrors.confirmPassword && (
              <p className="text-red-500 text-xs mt-1">{validationErrors.confirmPassword}</p>
            )}
            {formData.confirmPassword && formData.newPassword && formData.confirmPassword === formData.newPassword && (
              <p className="text-green-500 text-xs mt-1 flex items-center">
                <Shield size={12} className="mr-1" />
                {t('settings.password.fields.confirm.match')}
              </p>
            )}
          </div>

          {/* Submit Button */}
          <button
            onClick={handleChangePassword}
            disabled={loading || !isFormValid()}
            className={`w-full py-3 rounded-lg font-medium transition-colors ${
              loading || !isFormValid()
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-primary text-white hover:bg-red-600'
            }`}
          >
            {loading ? (
              <div className="flex items-center justify-center">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                {t('settings.password.actions.updatingLong')}
              </div>
            ) : (
              t('settings.password.actions.update')
            )}
          </button>
        </div>

        {/* Additional Security Info */}
        <div className="mt-6 bg-white rounded-xl p-4 shadow-sm">
          <h3 className="font-medium text-gray-900 mb-2">{t('settings.password.afterChange.title')}</h3>
          <ul className="text-sm text-gray-600 space-y-1">
            <li>&bull; {t('settings.password.afterChange.staySignedIn')}</li>
            <li>&bull; {t('settings.password.afterChange.signOutOthers')}</li>
            <li>&bull; {t('settings.password.afterChange.updateManager')}</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default ChangePassword;
