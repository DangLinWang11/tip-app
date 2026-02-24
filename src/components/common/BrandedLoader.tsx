import React, { useEffect, useMemo, useRef, useState } from 'react';
import en from '../../lib/i18n/en.json';
import es from '../../lib/i18n/es.json';
import { useI18n } from '../../lib/i18n/useI18n';

type LoaderVariant = 'default' | 'auth' | 'map' | 'list' | 'restaurant' | 'dish';

interface BrandedLoaderProps {
  variant?: LoaderVariant;
  fullScreen?: boolean;
  className?: string;
  messageKeyOverride?: string;
}

const LOGO_BY_VARIANT: Record<LoaderVariant, string> = {
  auth: '/images/tip-logo-white.png',
  default: '/images/tip-logo-red.png',
  map: '/images/tip-logo-red.png',
  list: '/images/tip-logo-red.png',
  restaurant: '/images/tip-logo-red.png',
  dish: '/images/tip-logo-red.png',
};

const BACKGROUND_BY_VARIANT: Record<LoaderVariant, string> = {
  auth: '#ff3131',
  default: '#ffffff',
  map: '#ffffff',
  list: '#ffffff',
  restaurant: '#ffffff',
  dish: '#ffffff',
};

const TEXT_COLOR_BY_VARIANT: Record<LoaderVariant, string> = {
  auth: '#ffffff',
  default: '#1f2937',
  map: '#1f2937',
  list: '#1f2937',
  restaurant: '#1f2937',
  dish: '#1f2937',
};

const GLOW_BY_VARIANT: Record<LoaderVariant, string> = {
  auth: 'radial-gradient(circle, rgba(255,255,255,0.22) 0%, rgba(255,255,255,0) 70%)',
  default: 'radial-gradient(circle, rgba(255,49,49,0.18) 0%, rgba(255,49,49,0) 70%)',
  map: 'radial-gradient(circle, rgba(255,49,49,0.18) 0%, rgba(255,49,49,0) 70%)',
  list: 'radial-gradient(circle, rgba(255,49,49,0.18) 0%, rgba(255,49,49,0) 70%)',
  restaurant: 'radial-gradient(circle, rgba(255,49,49,0.18) 0%, rgba(255,49,49,0) 70%)',
  dish: 'radial-gradient(circle, rgba(255,49,49,0.18) 0%, rgba(255,49,49,0) 70%)',
};

const getDictionary = (language: string) => (language === 'es' ? es : en);

const getMessagePool = (language: string, variant: LoaderVariant) => {
  const dictionary = getDictionary(language) as typeof en;
  const pool = (dictionary.loading && (dictionary.loading as any)[variant]) || dictionary.loading?.default;
  if (Array.isArray(pool) && pool.length > 0) {
    return pool as string[];
  }
  return ['Loading...'];
};

const BrandedLoader: React.FC<BrandedLoaderProps> = ({
  variant = 'default',
  fullScreen = true,
  className = '',
  messageKeyOverride,
}) => {
  const { language, t } = useI18n();
  const messageIndexRef = useRef<number | null>(null);
  const isAuth = variant === 'auth';
  const logoWidth = isAuth ? 168 : 130;
  const ringSize = Math.round(logoWidth * 1.25);
  const [showMessage, setShowMessage] = useState(variant !== 'auth');

  useEffect(() => {
    if (variant !== 'auth') {
      setShowMessage(true);
      return;
    }
    setShowMessage(false);
    const id = window.setTimeout(() => setShowMessage(true), 600);
    return () => window.clearTimeout(id);
  }, [variant]);

  const messagePool = useMemo(() => getMessagePool(language, variant), [language, variant]);

  const messageIndex = useMemo(() => {
    if (messageIndexRef.current === null || messageIndexRef.current >= messagePool.length) {
      messageIndexRef.current = Math.floor(Math.random() * messagePool.length);
    }
    return messageIndexRef.current;
  }, [messagePool.length]);

  const message = messageKeyOverride ? t(messageKeyOverride) : messagePool[messageIndex] || messagePool[0] || 'Loading...';

  return (
    <div
      className={[
        fullScreen ? (isAuth ? 'fixed inset-0 w-full h-[100dvh]' : 'min-h-screen w-full') : '',
        'flex items-center justify-center',
        className
      ].join(' ').trim()}
      style={{ backgroundColor: BACKGROUND_BY_VARIANT[variant] }}
      role="status"
      aria-live="polite"
    >
      <div
        className="flex flex-col items-center justify-center text-center px-6"
        style={
          isAuth
            ? {
                paddingTop: 'env(safe-area-inset-top)',
                paddingBottom: 'env(safe-area-inset-bottom)',
              }
            : undefined
        }
      >
        <div className="relative flex items-center justify-center">
          {!isAuth && (
            <div
              className="absolute -inset-8 rounded-full tip-loader-glow"
              style={{ background: GLOW_BY_VARIANT[variant] }}
              aria-hidden="true"
            />
          )}
          {isAuth && (
            <div
              className="auth-ring"
              style={{ width: ringSize, height: ringSize }}
              aria-hidden="true"
            />
          )}
          <img
            src={LOGO_BY_VARIANT[variant]}
            alt="Tip"
            className={['relative', !isAuth ? 'tip-loader-pulse' : ''].join(' ').trim()}
            style={{ width: logoWidth, height: 'auto' }}
          />
        </div>
        {showMessage && (
          <p
            className={[isAuth ? 'mt-6' : 'mt-4', 'text-sm font-semibold'].join(' ')}
            style={{ color: TEXT_COLOR_BY_VARIANT[variant] }}
          >
            {message}
          </p>
        )}
      </div>
    </div>
  );
};

export default BrandedLoader;
