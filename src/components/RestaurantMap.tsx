import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Wrapper, Status } from '@googlemaps/react-wrapper';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Navigation } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useMapBottomSheet } from '../hooks/useMapBottomSheet';
import MapBottomSheet from './discover/MapBottomSheet';
import { createDishRatingPinIcon } from '../utils/mapIcons';
import { createCountryOverlay, type CountryOverlayLike } from './map/CountryOverlay';
import { createCityOverlay, type CityOverlayLike } from '../utils/CityOverlay';
import { type CityRestaurantGroup } from '../utils/mapShared';
import { MarkerClusterer } from '@googlemaps/markerclusterer';
import { kMeansGeo, computeClusterK } from '../utils/kMeansClusters';
import { getBaseMapOptions, useMapTheme } from '../map/mapStyleConfig';

const NYC_FALLBACK = { lat: 40.7060, lng: -74.0086 };

interface UserLocationCoordinates extends google.maps.LatLngLiteral {
  accuracy?: number;
}

const getCuisineIcon = (cuisine: string): string => {
  const cuisineMap: { [key: string]: string } = {
    'mediterranean': '🫒',
    'middle eastern': '🫒',
    'american': '🍽️',
    'bistro': '🍽️',
    'seafood': '🦐',
    'italian': '🍝',
    'asian': '🥢',
    'mexican': '🌮',
    'pizza': '🍕',
    'steakhouse': '🥩',
    'bbq': '🥩',
    'sushi': '🍣',
    'coffee': '☕',
    'breakfast': '🥐',
    'brunch': '🥐',
    'fast food': '🍔',
    'casual': '🍽️'
  };
  if (!cuisine) return '🍽️';
  return cuisineMap[cuisine.toLowerCase()] || '🍽️';
};

interface Restaurant {
  id: string | number;
  name: string;
  qualityPercentage: number;
  location: {
    lat: number;
    lng: number;
  };
  cuisine: string;
  rating: number;
  priceRange: string;
  visitCount?: number;
  countryCode?: string;
}

interface Dish {
  id: string;
  name: string;
  rating: number;
  restaurantName: string;
  restaurantId?: string;
  location: {
    lat: number;
    lng: number;
  };
  price?: string;
}

interface CountryStat {
  code: string;
  name: string;
  flag: string;
  count: number;
  lat: number;
  lng: number;
  bounds?: google.maps.LatLngBounds;
}

interface MapProps {
  center: google.maps.LatLngLiteral;
  zoom: number;
  mapType: 'restaurant' | 'dish';
  restaurants: Restaurant[];
  dishes: Dish[];
  demoRestaurants?: Restaurant[];
  demoMode?: boolean;
  userLocation?: UserLocationCoordinates | null;
  onRestaurantClick?: (id: string) => void;
  onDishClick?: (id: string) => void;
  onDemoRestaurantClick?: (id: string) => void;
  onZoomChanged?: (zoom: number) => void;
  showQualityPercentages?: boolean;
  disableInfoWindows?: boolean;
  showMyLocationButton?: boolean;
  showGoogleControl?: boolean;
  myLocationButtonOffset?: number;
  bottomSheetHook?: ReturnType<typeof useMapBottomSheet>;
  navigate?: (path: string) => void;
  countryStats?: CountryStat[];
  focusRestaurantId?: string;
  useClusterer?: boolean;
  mapRestriction?: google.maps.MapRestriction;
  minZoom?: number;
  maxZoom?: number;
  resetTrigger?: number;
  activeCountryCode?: string | null;
  onCountryToggle?: (countryCode: string) => void;
  cityClusters?: CityRestaurantGroup[];
  searchActive?: boolean;
  searchPoints?: google.maps.LatLngLiteral[];
}

const getQualityColor = (percentage: number): string => {
  const clampedScore = Math.max(0, Math.min(100, percentage));

  if (clampedScore >= 90) return '#2F6F4E'; // Premium / Excellent (forest green)
  if (clampedScore >= 80) return '#4F9B75'; // Very Good
  if (clampedScore >= 70) return '#9FD3B5'; // Good / Reliable
  if (clampedScore >= 60) return '#E4D96F'; // Average / Caution
  if (clampedScore >= 50) return '#F0A43C'; // Declining
  if (clampedScore >= 36) return '#E06B2D'; // Poor
  return '#C92A2A';                          // Hard Red / Avoid
};

const getRatingColor = (rating: number): string => {
  // Convert 0-10 rating to percentage for color consistency
  const percentage = (rating / 10) * 100;
  return getQualityColor(percentage);
};

const PIN_ICON_CACHE = new Map<string, string>();
const COMMUNITY_PIN_CACHE = new Map<string, { url: string; width: number; height: number }>();
const DISH_PIN_CACHE = new Map<string, string>();
const CLUSTER_PIN_CACHE = new Map<string, string>();
const COMPACT_QUALITY_PIN_CACHE = new Map<string, { url: string; width: number; height: number }>();
const QUALITY_LABEL_PIN_CACHE = new Map<string, { url: string; width: number; height: number }>();
const GHOST_PIN_CACHE = new Map<string, { url: string; width: number; height: number }>();

const CLUSTER_PIN_W = 48;
const CLUSTER_PIN_H = 68;
const CLUSTER_PIN_ANCHOR_X = CLUSTER_PIN_W / 2;
const CLUSTER_PIN_ANCHOR_Y = CLUSTER_PIN_H; // tip of teardrop

const createClusterPinIcon = (count: number): string => {
  const displayText = count >= 100 ? '99+' : `${count}`;
  const cacheKey = `cluster_${displayText}`;
  const cached = CLUSTER_PIN_CACHE.get(cacheKey);
  if (cached) return cached;

  const fontSize = displayText.length >= 3 ? 9 : displayText.length === 2 ? 11 : 13;

  const svg = `<svg width="24" height="34" viewBox="0 0 24 34" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="cg" x1="12" y1="2" x2="12" y2="30" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stop-color="#FF6B6B"/>
        <stop offset="100%" stop-color="#EE2D2D"/>
      </linearGradient>
      <radialGradient id="cd" cx="40%" cy="35%" r="70%">
        <stop offset="0%" stop-color="white" stop-opacity="0.12"/>
        <stop offset="100%" stop-color="white" stop-opacity="0"/>
      </radialGradient>
      <radialGradient id="cs" cx="0%" cy="0%" r="100%">
        <stop offset="0%" stop-color="white" stop-opacity="0.6"/>
        <stop offset="100%" stop-color="white" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <path d="M 12 2 C 6.5 2, 2 6.5, 2 12 C 2 17.5, 12 30, 12 30 C 12 30, 22 17.5, 22 12 C 22 6.5, 17.5 2, 12 2 Z"
      fill="url(#cg)" stroke="white" stroke-width="2.25"/>
    <circle cx="12" cy="12" r="10" fill="url(#cd)"/>
    <circle cx="9.2" cy="7.6" r="2.6" fill="url(#cs)"/>
    <text x="12" y="12" font-family="'Poppins', sans-serif" font-size="${fontSize}" font-weight="800"
      text-anchor="middle" dominant-baseline="central" fill="#FFFFFF">${displayText}</text>
  </svg>`;

  const url = 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg);
  CLUSTER_PIN_CACHE.set(cacheKey, url);
  return url;
};

const createPinIcon = (text: string, backgroundColor: string, showQualityPercentages: boolean = true): string => {
  const cacheKey = `${text}|${backgroundColor}|${showQualityPercentages ? 1 : 0}`;
  const cached = PIN_ICON_CACHE.get(cacheKey);
  if (cached) return cached;
  const airyColor = '#ff3131';
  const width = text.length > 3 ? 75 : 52;
  const canvasHeight = 44;
  const horizontalPadding = 2;
  const pillX = horizontalPadding;
  const pillWidth = width - horizontalPadding * 2;
  const pillHeight = 28;
  const pillRadius = 14;
  const pillStrokeColor = showQualityPercentages ? backgroundColor : airyColor;
  const textColor = pillStrokeColor;
  const triangleFill = pillStrokeColor;

  const svg = `
    <svg width="${width}" height="${canvasHeight}" viewBox="0 0 ${width} ${canvasHeight}" xmlns="http://www.w3.org/2000/svg">
      <!-- Main pill -->
      <rect x="${pillX}" y="2" width="${pillWidth}" height="${pillHeight}" rx="${pillRadius}" fill="white" stroke="${pillStrokeColor}" stroke-width="2" />
      ${
        text
          ? `<text x="${width / 2}" y="21" font-family="Arial, sans-serif" font-size="12" font-weight="bold" text-anchor="middle" fill="${textColor}">${text}</text>`
          : ''
      }
      <!-- Pointer -->
      <path d="M ${width / 2 - 4} 30 L ${width / 2} 38 L ${width / 2 + 4} 30 Z" fill="${triangleFill}" />
    </svg>
  `;

  const url = 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg);
  PIN_ICON_CACHE.set(cacheKey, url);
  return url;
};

const createCompactQualityPinIcon = (text: string, color: string) => {
  const cacheKey = `${text}|${color}`;
  const cached = COMPACT_QUALITY_PIN_CACHE.get(cacheKey);
  if (cached) return cached;

  const width = text.length >= 4 ? 52 : 44;
  const height = 44;
  const pillX = 2;
  const pillY = 4;
  const pillWidth = width - 4;
  const pillHeight = 26;
  const pillRadius = 13;
  const textSize = text.length >= 4 ? 10 : 11;

  const svg = `
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      <rect x="${pillX}" y="${pillY}" width="${pillWidth}" height="${pillHeight}" rx="${pillRadius}"
        fill="white" stroke="${color}" stroke-width="2" />
      <text x="${width / 2}" y="${pillY + pillHeight / 2}"
        font-family="Arial, sans-serif" font-size="${textSize}" font-weight="700"
        text-anchor="middle" dominant-baseline="central" fill="${color}">
        ${text}
      </text>
      <path d="M ${width / 2 - 3} 30 L ${width / 2} 38 L ${width / 2 + 3} 30 Z" fill="${color}" />
    </svg>
  `;

  const result = {
    url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg),
    width,
    height
  };
  COMPACT_QUALITY_PIN_CACHE.set(cacheKey, result);
  return result;
};

const createQualityPinWithLabel = (text: string, label: string, color: string) => {
  const safeLabel = label.length > 22 ? `${label.slice(0, 22)}...` : label;
  const cacheKey = `${text}|${safeLabel}|${color}`;
  const cached = QUALITY_LABEL_PIN_CACHE.get(cacheKey);
  if (cached) return cached;

  const base = createCompactQualityPinIcon(text, color);
  const gap = 6;
  const labelPaddingX = 8;
  const labelHeight = 20;
  const labelWidth = Math.round(Math.max(36, safeLabel.length * 6.6 + labelPaddingX * 2));
  const labelX = base.width + gap;
  const labelY = 6;
  const width = base.width + gap + labelWidth;
  const height = base.height;

  const svg = `
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" shape-rendering="geometricPrecision" text-rendering="geometricPrecision">
      <defs>
        <linearGradient id="qpin_grad" x1="12" y1="2" x2="12" y2="30" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="${color}"/>
          <stop offset="100%" stop-color="${color}"/>
        </linearGradient>
      </defs>
      <rect x="2" y="4" width="${base.width - 4}" height="26" rx="13" fill="white" stroke="${color}" stroke-width="2" />
      <text x="${base.width / 2}" y="${4 + 13}"
        font-family="Arial, sans-serif" font-size="${text.length >= 4 ? 10 : 11}" font-weight="700"
        text-anchor="middle" dominant-baseline="central" fill="${color}">
        ${text}
      </text>
      <path d="M ${base.width / 2 - 3} 30 L ${base.width / 2} 38 L ${base.width / 2 + 3} 30 Z" fill="${color}" />

      <rect x="${labelX}" y="${labelY}" width="${labelWidth}" height="${labelHeight}" rx="10"
        fill="white" stroke="#E5E7EB" stroke-width="1" />
      <text x="${labelX + labelPaddingX}" y="${labelY + labelHeight / 2}"
        font-family="'Poppins', sans-serif" font-size="11" font-weight="700"
        text-anchor="start" dominant-baseline="central"
        fill="${color}" stroke="#FFFFFF" stroke-width="2.5" paint-order="stroke fill">
        ${safeLabel}
      </text>
      <text x="${labelX + labelPaddingX}" y="${labelY + labelHeight / 2}"
        font-family="'Poppins', sans-serif" font-size="11" font-weight="700"
        text-anchor="start" dominant-baseline="central" fill="${color}">
        ${safeLabel}
      </text>
    </svg>
  `;

  const result = {
    url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg),
    width,
    height
  };
  QUALITY_LABEL_PIN_CACHE.set(cacheKey, result);
  return result;
};

const createCommunityPinIcon = (color: string = '#ef4444') => {
  const viewBoxWidth = 24;
  const viewBoxHeight = 34;
  const height = 34;
  const width = (height * viewBoxWidth) / viewBoxHeight;

  const svg = `
    <svg width="${width}" height="${height}" viewBox="0 0 ${viewBoxWidth} ${viewBoxHeight}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="pinGrad" x1="12" y1="2" x2="12" y2="30" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#ff6b6b" />
          <stop offset="100%" stop-color="#ee2d2d" />
        </linearGradient>
        <radialGradient id="pinDepth" cx="40%" cy="35%" r="70%">
          <stop offset="0%" stop-color="white" stop-opacity="0.12" />
          <stop offset="100%" stop-color="white" stop-opacity="0" />
        </radialGradient>
        <radialGradient id="pinShine" cx="0%" cy="0%" r="100%">
          <stop offset="0%" stop-color="white" stop-opacity="0.6" />
          <stop offset="100%" stop-color="white" stop-opacity="0" />
        </radialGradient>
      </defs>
      <path
        d="M 12 2
           C 6.5 2, 2 6.5, 2 12
           C 2 17.5, 12 30, 12 30
           C 12 30, 22 17.5, 22 12
           C 22 6.5, 17.5 2, 12 2 Z"
        fill="url(#pinGrad)"
        stroke="white"
        stroke-width="2.25"
      />
      <!-- Subtle depth overlay -->
      <circle cx="12" cy="12" r="10" fill="url(#pinDepth)" />
      <!-- Shine highlight -->
      <circle cx="9.2" cy="7.6" r="2.6" fill="url(#pinShine)" />
      <circle cx="12" cy="12" r="4" fill="white" />
    </svg>
  `;

  return {
    url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg),
    width,
    height
  };
};

const createGhostPinIcon = (color: string = '#9CA3AF') => {
  const cacheKey = `ghost_${color}`;
  const cached = GHOST_PIN_CACHE.get(cacheKey);
  if (cached) return cached;
  const viewBoxWidth = 24;
  const viewBoxHeight = 34;
  const height = 34;
  const width = (height * viewBoxWidth) / viewBoxHeight;
  const svg = `
    <svg width="${width}" height="${height}" viewBox="0 0 ${viewBoxWidth} ${viewBoxHeight}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="ghostGrad" x1="12" y1="2" x2="12" y2="30" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="${color}" stop-opacity="0.45" />
          <stop offset="100%" stop-color="${color}" stop-opacity="0.75" />
        </linearGradient>
      </defs>
      <path
        d="M 12 2
           C 6.5 2, 2 6.5, 2 12
           C 2 17.5, 12 30, 12 30
           C 12 30, 22 17.5, 22 12
           C 22 6.5, 17.5 2, 12 2 Z"
        fill="url(#ghostGrad)"
        stroke="${color}"
        stroke-width="2.25"
        stroke-dasharray="3 3"
      />
      <circle cx="12" cy="12" r="4" fill="white" fill-opacity="0.85" />
    </svg>
  `;
  const result = {
    url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg),
    width,
    height
  };
  GHOST_PIN_CACHE.set(cacheKey, result);
  return result;
};

const COMMUNITY_PIN_TIP_X = 12;
const COMMUNITY_PIN_TIP_Y = 30;
const RESTAURANT_PIN_TIP_Y = 38;
const DISH_PIN_TIP_Y = 42;

const createCommunityPinWithLabel = (label: string, color: string = '#ef4444') => {
  const cacheKey = `${label}|${color}`;
  const cached = COMMUNITY_PIN_CACHE.get(cacheKey);
  if (cached) return cached;
  const viewBoxWidth = 24;
  const viewBoxHeight = 34;
  const height = 40;
  const pinWidth = Math.round((height * viewBoxWidth) / viewBoxHeight);
  const gap = -2;
  const fontSize = 11;
  const textLen = Math.max(3, Math.min(label.length, 24));
  const labelWidth = Math.round(textLen * 7.2 + 6);
  const labelHeight = 14;
  const labelX = Math.round(pinWidth + gap);
  const labelY = 7;
  const labelTextX = Math.round(labelX + 2);
  const width = Math.round(pinWidth + gap + labelWidth);

  const svg = `
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" shape-rendering="geometricPrecision" text-rendering="geometricPrecision">
      <defs>
        <linearGradient id="pinGradLabel" x1="12" y1="2" x2="12" y2="30" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#ff6b6b" />
          <stop offset="100%" stop-color="#ee2d2d" />
        </linearGradient>
        <radialGradient id="pinDepthLabel" cx="40%" cy="35%" r="70%">
          <stop offset="0%" stop-color="white" stop-opacity="0.12" />
          <stop offset="100%" stop-color="white" stop-opacity="0" />
        </radialGradient>
        <radialGradient id="pinShineLabel" cx="0%" cy="0%" r="100%">
          <stop offset="0%" stop-color="white" stop-opacity="0.6" />
          <stop offset="100%" stop-color="white" stop-opacity="0" />
        </radialGradient>
      </defs>
      <!-- Pin -->
      <path
        d="M 12 2
           C 6.5 2, 2 6.5, 2 12
           C 2 17.5, 12 30, 12 30
           C 12 30, 22 17.5, 22 12
           C 22 6.5, 17.5 2, 12 2 Z"
        fill="url(#pinGradLabel)"
        stroke="white"
        stroke-width="2.25"
      />
      <circle cx="12" cy="12" r="10" fill="url(#pinDepthLabel)" />
      <circle cx="9.2" cy="7.6" r="2.6" fill="url(#pinShineLabel)" />
      <circle cx="12" cy="12" r="4" fill="white" />

      <!-- Label text with tight white halo -->
      <text x="${labelTextX}" y="${labelY + labelHeight / 2}"
        font-family="'Poppins', sans-serif" font-size="${fontSize}" font-weight="700"
        text-anchor="start" dominant-baseline="central"
        fill="${color}" stroke="#FFFFFF" stroke-width="2.5" paint-order="stroke fill">
        ${label}
      </text>
      <text x="${labelTextX}" y="${labelY + labelHeight / 2}"
        font-family="'Poppins', sans-serif" font-size="${fontSize}" font-weight="700"
        text-anchor="start" dominant-baseline="central" fill="${color}">
        ${label}
      </text>
    </svg>
  `;

  const result = {
    url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg),
    width,
    height
  };
  COMMUNITY_PIN_CACHE.set(cacheKey, result);
  return result;
};

type GamifiedPinState = 'default' | 'hover' | 'clicked';

// --- Progress & scaling helpers ---
const getProgressInfo = (visitCount: number): { progress: number; nextTier: number } => {
  if (visitCount >= 50) return { progress: 1, nextTier: 50 };
  if (visitCount >= 20) return { progress: (visitCount - 20) / 30, nextTier: 50 };
  if (visitCount >= 10) return { progress: (visitCount - 10) / 10, nextTier: 20 };
  if (visitCount >= 5) return { progress: (visitCount - 5) / 5, nextTier: 10 };
  return { progress: (visitCount - 1) / 4, nextTier: 5 };
};

const getJourneyPinScale = (visitCount: number): number => {
  if (visitCount >= 20) return 1.5;
  if (visitCount >= 10) return 1.3;
  if (visitCount >= 5) return 1.15;
  return 1.0;
};

// Base dimensions for circular badge pin
const JOURNEY_PIN_W = 64;
const JOURNEY_PIN_H = 76;
const JOURNEY_ANCHOR_X = JOURNEY_PIN_W / 2; // 32
const JOURNEY_ANCHOR_Y = 68; // tip of the small pointer

const createGamifiedPinIcon = (
  visitCount: number,
  state: GamifiedPinState = 'default'
): string => {
  const W = 64;
  const H = 76;
  const cx = W / 2;     // 32
  const cy = 30;         // center of badge circle
  const outerR = 22;     // outer gradient ring
  const separatorR = 19; // white separator
  const innerR = 18;     // inner white circle
  const progressR = 25;  // progress ring outside badge
  const displayCount = visitCount || 1;

  const displayText = displayCount >= 100 ? '99+' : `${displayCount}`;
  const fontSize = displayText.length >= 3 ? 11 : displayText.length === 2 ? 14 : 17;

  const { progress } = getProgressInfo(displayCount);

  // Milestone tiers
  const isLegendary = displayCount >= 50;
  const isGold = displayCount >= 20;
  const isPlatinum = displayCount >= 10;

  // Color schemes per tier
  let gradStart: string, gradEnd: string, progressStroke: string, textTop: string, textBot: string;
  if (isLegendary) {
    gradStart = '#A78BFA'; gradEnd = '#EC4899';
    progressStroke = '#8B5CF6';
    textTop = '#7C3AED'; textBot = '#EC4899';
  } else if (isGold) {
    gradStart = '#FBBF24'; gradEnd = '#F59E0B';
    progressStroke = '#D97706';
    textTop = '#B45309'; textBot = '#D97706';
  } else if (isPlatinum) {
    gradStart = '#FF5252'; gradEnd = '#FF1744';
    progressStroke = '#E53935';
    textTop = '#D32F2F'; textBot = '#EF5350';
  } else {
    gradStart = '#FF6B6B'; gradEnd = '#EE2D2D';
    progressStroke = '#FF4757';
    textTop = '#EE2D2D'; textBot = '#FF6B6B';
  }

  const uid = `gp2_${state}_${displayCount}`;

  // Progress ring dash calculation
  const progressCirc = 2 * Math.PI * progressR;
  const progressDash = progress * progressCirc;
  const progressGap = progressCirc - progressDash;

  // Pointer position
  const pointerTopY = cy + outerR + 2;
  const pointerTipY = pointerTopY + 10;

  // Click bounce
  const clickAnim = state === 'clicked'
    ? `<animateTransform attributeName="transform" type="scale" values="1;1.12;1" dur="0.3s" repeatCount="1" additive="sum" calcMode="spline" keySplines="0.4 0 0.2 1;0.4 0 0.2 1" />`
    : '';

  // Hover: slightly bigger glow
  const hoverScale = state === 'hover'
    ? `<animateTransform attributeName="transform" type="scale" values="1;1.05" dur="0.15s" fill="freeze" additive="sum" />`
    : '';

  // Sparkle dots for 10+ milestone (solid, no blur)
  const sparkles = isPlatinum ? `
    <circle cx="${cx - 18}" cy="${cy - 16}" r="1.5" fill="${progressStroke}">
      <animate attributeName="opacity" values="1;0.2;1" dur="1.5s" repeatCount="indefinite"/>
    </circle>
    <circle cx="${cx + 20}" cy="${cy - 10}" r="1.2" fill="${progressStroke}">
      <animate attributeName="opacity" values="0.8;0.1;0.8" dur="2s" begin="0.5s" repeatCount="indefinite"/>
    </circle>
    <circle cx="${cx + 16}" cy="${cy + 16}" r="1.3" fill="${progressStroke}">
      <animate attributeName="opacity" values="0.9;0.15;0.9" dur="1.8s" begin="1s" repeatCount="indefinite"/>
    </circle>
  ` : '';

  // Animated rainbow shimmer ring for 50+ legendary
  const legendaryShimmer = isLegendary ? `
    <circle cx="${cx}" cy="${cy}" r="${outerR + 1}" fill="none" stroke="url(#rainbow_${uid})" stroke-width="3" opacity="0.6">
      <animateTransform attributeName="transform" type="rotate" from="0 ${cx} ${cy}" to="360 ${cx} ${cy}" dur="3s" repeatCount="indefinite"/>
    </circle>
  ` : '';

  const svg = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="outer_${uid}" x1="${cx}" y1="${cy - outerR}" x2="${cx}" y2="${cy + outerR}" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="${gradStart}"/>
      <stop offset="100%" stop-color="${gradEnd}"/>
    </linearGradient>
    <linearGradient id="numgrad_${uid}" x1="${cx}" y1="${cy - 8}" x2="${cx}" y2="${cy + 8}" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="${textTop}"/>
      <stop offset="100%" stop-color="${textBot}"/>
    </linearGradient>
    ${isLegendary ? `
    <linearGradient id="rainbow_${uid}" x1="0" y1="0" x2="${W}" y2="${H}" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#FF6B6B"/>
      <stop offset="20%" stop-color="#FBBF24"/>
      <stop offset="40%" stop-color="#4ADE80"/>
      <stop offset="60%" stop-color="#60A5FA"/>
      <stop offset="80%" stop-color="#A78BFA"/>
      <stop offset="100%" stop-color="#FF6B6B"/>
    </linearGradient>` : ''}
  </defs>
  <g transform-origin="${cx} ${cy}">
    ${clickAnim}
    ${hoverScale}

    <!-- Progress ring (XP bar around badge) -->
    ${progress > 0 ? `
    <circle cx="${cx}" cy="${cy}" r="${progressR}" fill="none" stroke="${progressStroke}" stroke-width="3" stroke-linecap="round"
      stroke-dasharray="${progressDash} ${progressGap}"
      transform="rotate(-90 ${cx} ${cy})" opacity="0.7">
      ${state === 'default' ? `<animate attributeName="opacity" values="0.7;0.9;0.7" dur="3s" repeatCount="indefinite"/>` : ''}
    </circle>` : ''}

    <!-- Outer gradient ring (main color band) -->
    <circle cx="${cx}" cy="${cy}" r="${outerR}" fill="url(#outer_${uid})"/>

    <!-- White separator ring (2px gap) -->
    <circle cx="${cx}" cy="${cy}" r="${separatorR}" fill="white"/>

    <!-- Inner white circle -->
    <circle cx="${cx}" cy="${cy}" r="${innerR}" fill="white"/>

    <!-- Subtle inner border for depth -->
    <circle cx="${cx}" cy="${cy}" r="${innerR}" fill="none" stroke="#e5e7eb" stroke-width="0.5"/>

    <!-- Legendary rainbow shimmer -->
    ${legendaryShimmer}

    <!-- Visit count number with gradient -->
    <text x="${cx}" y="${cy}" font-family="'Poppins', sans-serif" font-size="${fontSize}" font-weight="800" text-anchor="middle" dominant-baseline="central" fill="url(#numgrad_${uid})" letter-spacing="0.5">${displayText}</text>

    <!-- Sparkle dots (10+ milestone) -->
    ${sparkles}

    <!-- Small pointer arrow at bottom -->
    <path d="M ${cx - 5} ${pointerTopY} L ${cx} ${pointerTipY} L ${cx + 5} ${pointerTopY} Z" fill="url(#outer_${uid})"/>
  </g>
</svg>`;

  return 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg);
};

const createDishPinIcon = (rating: string, backgroundColor: string): string => {
  const airyColor = '#ff3131';
  const goldColor = '#FFD700';
  const canvasWidth = 60;
  const canvasHeight = 44;
  const horizontalPadding = 2;
  const pillX = horizontalPadding;
  const pillWidth = canvasWidth - horizontalPadding * 2;

  // Star is drawn using the same path, positioned via transform
  const svg = `
    <svg width="${canvasWidth}" height="${canvasHeight}" viewBox="0 0 ${canvasWidth} ${canvasHeight}" xmlns="http://www.w3.org/2000/svg">
      <!-- Main pill -->
      <rect x="${pillX}" y="2" width="${pillWidth}" height="32" rx="16" fill="white" stroke="${airyColor}" stroke-width="2" />
      <text x="19" y="23" font-family="Arial, sans-serif" font-size="16" font-weight="bold" text-anchor="middle" fill="${airyColor}">${rating}</text>
      <!-- Star icon -->
      <path
        d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
        fill="${goldColor}"
        transform="translate(32 6) scale(0.8333)"
      />
      <!-- Pointer -->
      <path d="M 26 34 L 30 42 L 34 34 Z" fill="${airyColor}" />
    </svg>
  `;

  return 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg);
};

const getDishPinIconCached = (rating: string): string => {
  const cached = DISH_PIN_CACHE.get(rating);
  if (cached) return cached;
  const url = createDishRatingPinIcon(rating);
  DISH_PIN_CACHE.set(rating, url);
  return url;
};

const MapView: React.FC<MapProps> = ({ center, zoom, mapType, restaurants, dishes, demoRestaurants = [], demoMode = false, userLocation, onRestaurantClick, onDishClick, onDemoRestaurantClick, onZoomChanged, showQualityPercentages = true, disableInfoWindows = false, showMyLocationButton = true, showGoogleControl = true, myLocationButtonOffset, bottomSheetHook, navigate, countryStats, focusRestaurantId, useClusterer, mapRestriction, minZoom, maxZoom, resetTrigger, activeCountryCode, onCountryToggle, cityClusters, searchActive, searchPoints }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<google.maps.Map>();
  const styleLoggedRef = useRef(false);
  const [locationError, setLocationError] = useState<string>('');
  const [userLocationMarker, setUserLocationMarker] = useState<google.maps.Marker | null>(null);
  const [userAccuracyCircle, setUserAccuracyCircle] = useState<google.maps.Circle | null>(null);
  const onRestaurantClickRef = useRef(onRestaurantClick);
  const onDishClickRef = useRef(onDishClick);
  const onDemoRestaurantClickRef = useRef(onDemoRestaurantClick);
  const onCountryToggleRef = useRef(onCountryToggle);
  const bottomSheetRef = useRef(bottomSheetHook);
  const wasSearchActiveRef = useRef(false);
  // Internal location state when user taps the navigation button
  const [internalUserLocation, setInternalUserLocation] = useState<UserLocationCoordinates | null>(null);
  const [mapTheme] = useMapTheme();
  const baseMapOptions = useMemo(() => getBaseMapOptions(mapTheme), [mapTheme]);
  const runtimeMapOptions = useMemo(() => ({
    ...baseMapOptions,
    restriction: mapRestriction,
    minZoom,
    maxZoom
  }), [baseMapOptions, mapRestriction, minZoom, maxZoom]);

  useEffect(() => {
    onRestaurantClickRef.current = onRestaurantClick;
  }, [onRestaurantClick]);

  useEffect(() => {
    onDishClickRef.current = onDishClick;
  }, [onDishClick]);

  useEffect(() => {
    onDemoRestaurantClickRef.current = onDemoRestaurantClick;
  }, [onDemoRestaurantClick]);

  useEffect(() => {
    onCountryToggleRef.current = onCountryToggle;
  }, [onCountryToggle]);

  useEffect(() => {
    bottomSheetRef.current = bottomSheetHook;
  }, [bottomSheetHook]);


  useEffect(() => {
    if (ref.current && !map) {
      const newMap = new window.google.maps.Map(ref.current, {
        center,
        zoom,
        ...runtimeMapOptions,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: showGoogleControl,
        zoomControl: false,
        rotateControl: false,
        scaleControl: false,
        gestureHandling: 'greedy',
        scrollwheel: true,
        disableDoubleClickZoom: false
      });
      if (!styleLoggedRef.current) {
        console.log(baseMapOptions.mapId ? 'Map style: MAP_ID' : 'Map style: JSON_FALLBACK');
        styleLoggedRef.current = true;
      }
      setMap(newMap);
    }
  }, [ref, map, center, zoom, showGoogleControl, runtimeMapOptions]);

  useEffect(() => {
    if (!map) return;
    map.setOptions(runtimeMapOptions);
  }, [map, runtimeMapOptions]);

  useEffect(() => {
    if (!map || !onZoomChanged) return;
    const handleZoom = () => {
      const currentZoom = map.getZoom();
      if (typeof currentZoom === 'number') onZoomChanged(currentZoom);
    };
    handleZoom();
    const listener = map.addListener('zoom_changed', handleZoom);
    return () => listener.remove();
  }, [map, onZoomChanged]);

  useEffect(() => {
    if (!map) return;
    const isActive = Boolean(searchActive);
    const points = searchPoints ?? [];

    if (isActive && points.length > 0) {
      const bounds = new google.maps.LatLngBounds();
      points.forEach((point) => bounds.extend(point));
      if (points.length === 1) {
        map.panTo(points[0]);
        map.setZoom(14);
      } else {
        map.fitBounds(bounds, { top: 80, bottom: 80, left: 80, right: 80 });
      }
    } else if (wasSearchActiveRef.current && !isActive) {
      map.panTo(center);
      map.setZoom(zoom);
    }

    wasSearchActiveRef.current = isActive;
  }, [map, searchActive, searchPoints, center, zoom]);

  // Reset map to initial center/zoom when resetTrigger changes
  useEffect(() => {
    if (!map || !resetTrigger) return;
    map.panTo(center);
    map.setZoom(zoom);
  }, [map, resetTrigger]);

  // Update user location marker and center map
  useEffect(() => {
    const effectiveLocation = internalUserLocation || userLocation;
    if (map && effectiveLocation) {
      if (userLocationMarker) {
        userLocationMarker.setMap(null);
      }
      if (userAccuracyCircle) {
        userAccuracyCircle.setMap(null);
      }

      // Center map on user location
      const target = { lat: effectiveLocation.lat, lng: effectiveLocation.lng };
      map.panTo(target);
      if ((map.getZoom() ?? 0) < 15) {
        map.setZoom(15);
      }

      // Create new user location marker with blue dot
      const marker = new window.google.maps.Marker({
        position: target,
        map,
        icon: {
          path: window.google.maps.SymbolPath.CIRCLE,
          scale: 8,
          fillColor: '#4285F4',
          fillOpacity: 1,
          strokeColor: '#ffffff',
          strokeWeight: 2,
        },
        title: 'Your location',
        zIndex: 1000
      });

      const radius = Math.min(Math.max(effectiveLocation.accuracy ?? 120, 30), 2000);
      const circle = new window.google.maps.Circle({
        strokeColor: '#4285F4',
        strokeOpacity: 0.6,
        strokeWeight: 1,
        fillColor: '#4285F4',
        fillOpacity: 0.15,
        map,
        center: target,
        radius,
        zIndex: 999
      });

      setUserLocationMarker(marker);
      setUserAccuracyCircle(circle);
    } else {
      if (userLocationMarker) {
        userLocationMarker.setMap(null);
        setUserLocationMarker(null);
      }
      if (userAccuracyCircle) {
        userAccuracyCircle.setMap(null);
        setUserAccuracyCircle(null);
      }
    }
  }, [map, userLocation, internalUserLocation]);

  useEffect(() => {
    if (userLocation) {
      setInternalUserLocation(null);
    }
  }, [userLocation?.lat, userLocation?.lng]);

  useEffect(() => {
    return () => {
      if (userLocationMarker) {
        userLocationMarker.setMap(null);
      }
      if (userAccuracyCircle) {
        userAccuracyCircle.setMap(null);
      }
    };
  }, [userLocationMarker, userAccuracyCircle]);

  useEffect(() => {
    if (map) {
      // Clear existing markers
      const existingMarkers = (map as any).markers || [];
      existingMarkers.forEach((marker: google.maps.Marker) => marker.setMap(null));
      const markerEntries: Array<{ id: string; marker: google.maps.Marker; priority: number; labelText?: string }> = [];

      // Cache for icon variants per restaurant (journey mode)
      const journeyIconCache = new Map<string, {
        badge: google.maps.Icon;  // gamified badge pin (zoom 6-11)
        label: google.maps.Icon;  // pin with name label (zoom 12+)
      }>();
      const qualityIconCache = new Map<string, {
        compact: google.maps.Icon; // percent-only compact pin
        label: google.maps.Icon;   // percent + name label pin
      }>();
      const labelZoomThreshold = 12;

      const isDemoMode = demoMode && demoRestaurants.length > 0;

      if (mapType === 'restaurant') {
        if (isDemoMode) {
          const ghostPin = createGhostPinIcon('#ef4444');
          demoRestaurants.forEach((restaurant) => {
            const position = restaurant.location;
            if (!position || typeof position !== 'object' || typeof position.lat !== 'number' || typeof position.lng !== 'number') {
              return;
            }

            const marker = new window.google.maps.Marker({
              position,
              icon: {
                url: ghostPin.url,
                scaledSize: new window.google.maps.Size(ghostPin.width, ghostPin.height),
                anchor: new window.google.maps.Point(COMMUNITY_PIN_TIP_X, COMMUNITY_PIN_TIP_Y),
              },
              title: restaurant.name,
              zIndex: 1
            });

            marker.addListener('click', () => {
              if (onDemoRestaurantClickRef.current) {
                onDemoRestaurantClickRef.current(restaurant.id.toString());
              }
            });

            markerEntries.push({ id: restaurant.id.toString(), marker, priority: 1 });
          });
        } else {
        const isJourneyMode = showQualityPercentages === false;

        // Show restaurant pins
        restaurants.forEach((restaurant) => {
          // Validate location data before creating marker
          let position = restaurant.location;

          // Safety check: ensure position is a valid LatLng object
          if (!position || typeof position !== 'object' || typeof position.lat !== 'number' || typeof position.lng !== 'number') {
            console.warn(`Invalid location data for restaurant ${restaurant.name}, skipping marker`, position);
            return; // Skip this restaurant
          }

          const qualityColor = getQualityColor(restaurant.qualityPercentage);

          if (isJourneyMode) {
            // Create and cache both icon variants for journey mode
            const visitCount = restaurant.visitCount ?? 1;
            const scale = getJourneyPinScale(visitCount);
            const badgeUrl = createGamifiedPinIcon(visitCount, 'default');
            const scaledW = Math.round(JOURNEY_PIN_W * scale);
            const scaledH = Math.round(JOURNEY_PIN_H * scale);
            const badgeIcon: google.maps.Icon = {
              url: badgeUrl,
              scaledSize: new window.google.maps.Size(scaledW, scaledH),
              anchor: new window.google.maps.Point(
                Math.round(JOURNEY_ANCHOR_X * scale),
                Math.round(JOURNEY_ANCHOR_Y * scale)
              ),
            };

            const labelPin = createCommunityPinWithLabel(restaurant.name, '#ef4444');
            const labelIcon: google.maps.Icon = {
              url: labelPin.url,
              scaledSize: new window.google.maps.Size(labelPin.width, labelPin.height),
              anchor: new window.google.maps.Point(COMMUNITY_PIN_TIP_X, COMMUNITY_PIN_TIP_Y),
            };

            journeyIconCache.set(restaurant.id.toString(), { badge: badgeIcon, label: labelIcon });
          } else {
            const pinText = `${restaurant.qualityPercentage}%`;
            const compactPin = createCompactQualityPinIcon(pinText, qualityColor);
            const compactIcon: google.maps.Icon = {
              url: compactPin.url,
              scaledSize: new window.google.maps.Size(compactPin.width, compactPin.height),
              anchor: new window.google.maps.Point(Math.round(compactPin.width / 2), RESTAURANT_PIN_TIP_Y),
            };

            const labelPin = createQualityPinWithLabel(pinText, restaurant.name, qualityColor);
            const labelIcon: google.maps.Icon = {
              url: labelPin.url,
              scaledSize: new window.google.maps.Size(labelPin.width, labelPin.height),
              anchor: new window.google.maps.Point(Math.round(compactPin.width / 2), RESTAURANT_PIN_TIP_Y),
            };

            qualityIconCache.set(restaurant.id.toString(), { compact: compactIcon, label: labelIcon });
          }

          // Determine initial icon
          let initialIcon: google.maps.Icon;
          if (isJourneyMode) {
            const cached = journeyIconCache.get(restaurant.id.toString());
            initialIcon = cached!.badge; // Start with badge icon
          } else {
            const cached = qualityIconCache.get(restaurant.id.toString());
            const initialZoom = map.getZoom() ?? 0;
            initialIcon = initialZoom >= labelZoomThreshold ? cached!.label : cached!.compact;
          }

          const marker = new window.google.maps.Marker({
            position,
            icon: initialIcon,
            title: restaurant.name,
            zIndex: Math.round((isJourneyMode ? (restaurant.visitCount ?? 0) : restaurant.qualityPercentage) * 10)
          });

          marker.addListener('click', () => {
            const bottomSheet = bottomSheetRef.current;
            // For food journey map (showQualityPercentages === false), prefer modal handler
            if (!isJourneyMode && bottomSheet) {
              bottomSheet.openRestaurantSheet(
                restaurant.location.lat,
                restaurant.location.lng,
                2000 // 2km radius
              );
            } else if (onRestaurantClickRef.current) {
              onRestaurantClickRef.current(restaurant.id.toString());
            }
          });

          const priority = isJourneyMode
            ? (restaurant.visitCount ?? 0)
            : restaurant.qualityPercentage;
          markerEntries.push({ id: restaurant.id.toString(), marker, priority });
        });
        }
      } else {
        // Show dish pins
        dishes.forEach((dish) => {
          const rating = dish.rating != null && typeof dish.rating === 'number' ? dish.rating : 0;
          const displayRating = rating > 0 ? rating.toFixed(1) : 'N/A';
          const labelText = dish.restaurantName
            ? `${dish.name} \u00b7 ${dish.restaurantName}`
            : dish.name;

          const marker = new window.google.maps.Marker({
            position: dish.location,
            icon: {
              url: getDishPinIconCached(displayRating),
              scaledSize: new window.google.maps.Size(64, 48),
              anchor: new window.google.maps.Point(32, DISH_PIN_TIP_Y),
              labelOrigin: new window.google.maps.Point(32, -6),
            },
            title: dish.name,
            zIndex: rating * 10
          });

          marker.addListener('click', () => {
            // Open bottom sheet with all dishes from this restaurant
            const bottomSheet = bottomSheetRef.current;
            if (bottomSheet && dish.restaurantId) {
              bottomSheet.openDishSheet(dish.restaurantId);
            } else if (onDishClickRef.current) {
              onDishClickRef.current(dish.id);
            }
          });

          // Rating text is now embedded in the pin icon
          markerEntries.push({ id: dish.id, marker, priority: rating, labelText });
        });
      }

      // Pin drop animation for focused restaurant
      const focusEntry = focusRestaurantId
        ? markerEntries.find(e => e.id === focusRestaurantId)
        : null;

      if (focusEntry) {
        // Exclude focus restaurant from initial batch
        markerEntries
          .filter(e => e.id !== focusRestaurantId)
          .forEach(({ marker }) => marker.setMap(map));

        // Drop the focus pin after 500ms with animation
        setTimeout(() => {
          focusEntry.marker.setAnimation(google.maps.Animation.DROP);
          focusEntry.marker.setMap(map);
          focusEntry.marker.setZIndex(9999);
          // Brief bounce after drop completes
          setTimeout(() => {
            focusEntry.marker.setAnimation(google.maps.Animation.BOUNCE);
            setTimeout(() => {
              focusEntry.marker.setAnimation(null);
            }, 500);
          }, 400);
        }, 500);
      } else {
        markerEntries.forEach(({ marker }) => marker.setMap(map));
      }

      // Store markers on map for cleanup
      (map as any).markers = markerEntries.map(({ marker }) => marker);

      // Create country overlays if countryStats are provided
      const overlays: CountryOverlayLike[] = [];
      if (countryStats && countryStats.length > 0) {
        countryStats.forEach((stat: any) => {
          // Build LatLngBounds from raw coordinate arrays passed via _boundsLats/_boundsLngs
          let bounds: google.maps.LatLngBounds | undefined;
          if (stat._boundsLats?.length > 0 && stat._boundsLngs?.length > 0) {
            bounds = new google.maps.LatLngBounds();
            for (let i = 0; i < stat._boundsLats.length; i++) {
              bounds.extend({ lat: stat._boundsLats[i], lng: stat._boundsLngs[i] });
            }
          }

          const overlayStat = { ...stat, bounds };
          const overlay = createCountryOverlay(overlayStat, map, (clickedStat) => {
            // Toggle country activation instead of zooming
            onCountryToggleRef.current?.(clickedStat.code);
          });
          if (overlay) overlays.push(overlay);
        });
      }

      // Create city overlays if cityClusters are provided
      const cityOverlays: CityOverlayLike[] = [];
      if (cityClusters && cityClusters.length > 0) {
        const overlayOptions = mapType === 'dish'
          ? { icon: '🍽️', unitLabel: 'dishes' }
          : undefined;
        cityClusters.forEach((cluster) => {
          if (!cluster.restaurants || cluster.restaurants.length === 0) return;
          const bounds = new google.maps.LatLngBounds();
          cluster.restaurants.forEach((restaurant) => {
            bounds.extend({
              lat: restaurant.location.lat,
              lng: restaurant.location.lng,
            });
          });

          const overlay = createCityOverlay(
            {
              city: cluster.city,
              state: cluster.state ?? '',
              count: cluster.count,
              lat: cluster.lat,
              lng: cluster.lng,
            },
            map,
            () => {
              map.fitBounds(bounds, { top: 80, bottom: 80, left: 80, right: 80 });
              google.maps.event.addListenerOnce(map, 'idle', () => {
                const currentZoom = map.getZoom() ?? 0;
                if (currentZoom < 6) map.setZoom(6);
              });
            },
            overlayOptions
          );
          if (overlay) cityOverlays.push(overlay);
        });
      }

      // Create cluster markers for the active country
      const clusterMarkers: google.maps.Marker[] = [];
      if (activeCountryCode) {
        const countryRestaurants = restaurants.filter(r => r.countryCode === activeCountryCode);
        if (countryRestaurants.length > 0) {
          const geoPoints = countryRestaurants.map(r => ({
            lat: r.location.lat,
            lng: r.location.lng,
            id: r.id.toString(),
          }));
          const k = computeClusterK(countryRestaurants.length);
          const clusters = kMeansGeo(geoPoints, k);

          clusters.forEach((cluster) => {
            // Build bounds for this cluster
            const clusterBounds = new google.maps.LatLngBounds();
            cluster.members.forEach(m => clusterBounds.extend({ lat: m.lat, lng: m.lng }));

            const iconUrl = createClusterPinIcon(cluster.members.length);
            const marker = new google.maps.Marker({
              position: cluster.centroid,
              map,
              icon: {
                url: iconUrl,
                scaledSize: new google.maps.Size(CLUSTER_PIN_W, CLUSTER_PIN_H),
                anchor: new google.maps.Point(CLUSTER_PIN_ANCHOR_X, CLUSTER_PIN_ANCHOR_Y),
              },
              title: `${cluster.members.length} restaurants`,
              zIndex: 200,
              visible: false, // visibility managed by updateMarkerVisibility
            });

            marker.addListener('click', () => {
              map.fitBounds(clusterBounds, { top: 60, bottom: 60, left: 60, right: 60 });
              google.maps.event.addListenerOnce(map, 'idle', () => {
                const currentZoom = map.getZoom() ?? 0;
                if (currentZoom < 13) map.setZoom(13);
              });
            });

            clusterMarkers.push(marker);
          });
        }
      }

      const isJourneyMode = showQualityPercentages === false;
      const isDishMode = mapType === 'dish';
      const isSearchActive = Boolean(searchActive);
      let lastIconMode: 'badge' | 'label' | null = null;
      const hasCityOverlays = cityOverlays.length > 0;
      const hasCountryOverlays = overlays.length > 0;

      const updateMarkerVisibility = () => {
        const zoomLevel = map.getZoom() ?? 0;
        if (isSearchActive) {
          if (hasCityOverlays) {
            cityOverlays.forEach(o => o.setVisible(false));
          }
          if (hasCountryOverlays) {
            overlays.forEach(o => o.setVisible(false));
            clusterMarkers.forEach(m => m.setVisible(false));
          }

          if (isDishMode) {
            const showLabels = zoomLevel >= 12;
            markerEntries.forEach(({ marker, labelText }) => {
              marker.setVisible(true);
              if (labelText) {
                marker.setLabel(
                  showLabels
                    ? {
                        text: labelText,
                        color: '#111827',
                        fontSize: '11px',
                        fontWeight: '700',
                        fontFamily: "'Montserrat', 'Apple Color Emoji'",
                      }
                    : null
                );
              }
            });
            return;
          }

          if (!isJourneyMode && qualityIconCache.size > 0) {
            const desiredMode = zoomLevel >= labelZoomThreshold ? 'label' : 'badge';
            if (lastIconMode !== desiredMode) {
              markerEntries.forEach(({ id, marker }) => {
                const cached = qualityIconCache.get(id);
                if (cached) {
                  marker.setIcon(desiredMode === 'label' ? cached.label : cached.compact);
                }
              });
              lastIconMode = desiredMode;
            }
          }

          markerEntries.forEach(({ marker }) => marker.setVisible(true));
          return;
        }

        if (isDishMode) {
          if (hasCityOverlays && zoomLevel <= 11) {
            cityOverlays.forEach(o => o.setVisible(true));
            markerEntries.forEach(({ marker }) => marker.setVisible(false));
            return;
          }

          if (hasCityOverlays) {
            cityOverlays.forEach(o => o.setVisible(false));
          }

          const showPins = zoomLevel >= 6;
          const showLabels = zoomLevel >= 12;
          markerEntries.forEach(({ marker, labelText }) => {
            marker.setVisible(showPins);
            if (!showPins) {
              marker.setLabel(null);
              return;
            }
            if (labelText) {
              marker.setLabel(
                showLabels
                  ? {
                      text: labelText,
                      color: '#111827',
                      fontSize: '11px',
                      fontWeight: '700',
                      fontFamily: "'Montserrat', 'Apple Color Emoji'",
                    }
                  : null
              );
            }
          });
          return;
        }

        if (hasCityOverlays) {
          if (zoomLevel <= 11) {
            cityOverlays.forEach(o => o.setVisible(true));
            if (hasCountryOverlays) {
              overlays.forEach(o => o.setVisible(false));
              clusterMarkers.forEach(m => m.setVisible(false));
            }
            markerEntries.forEach(({ marker }) => marker.setVisible(false));
            lastIconMode = null;
            return;
          }

          cityOverlays.forEach(o => o.setVisible(false));
          markerEntries.forEach(({ marker }) => marker.setVisible(true));
        }

        if (hasCountryOverlays && zoomLevel <= 5) {
          if (activeCountryCode) {
            // Cluster view: hide active country's pill, show others, show cluster markers
            overlays.forEach(o => o.setVisible(o.countryCode !== activeCountryCode));
            clusterMarkers.forEach(m => m.setVisible(true));
            markerEntries.forEach(({ marker }) => marker.setVisible(false));
          } else {
            // Normal global: all pills visible, no clusters, no restaurant markers
            overlays.forEach(o => o.setVisible(true));
            clusterMarkers.forEach(m => m.setVisible(false));
            markerEntries.forEach(({ marker }) => marker.setVisible(false));
          }
          lastIconMode = null;
          return;
        }

        // Zoom 6+ (or 12+ with city overlays): hide ALL overlays and cluster markers, show restaurant pins
        if (hasCountryOverlays) {
          overlays.forEach(o => o.setVisible(false));
        }
        clusterMarkers.forEach(m => m.setVisible(false));

        if (isJourneyMode && journeyIconCache.size > 0) {
          // Always use label pins at zoom 6+
          if (lastIconMode !== 'label') {
            markerEntries.forEach(({ id, marker }) => {
              const cached = journeyIconCache.get(id);
              if (cached) {
                marker.setIcon(cached.label);
              }
            });
            lastIconMode = 'label';
          }

          // Apply grid-based spatial overlap detection at all zoom levels 6+
          const projection = map.getProjection();
          if (!projection) {
            markerEntries.forEach(({ marker }) => marker.setVisible(true));
            return;
          }

          // Larger cell size at lower zoom to avoid excessive overlap
          const CELL_SIZE = zoomLevel >= 12 ? 50 : 80;
          const occupiedCells = new Set<string>();
          const mapBounds = map.getBounds();

          // Sort by priority (visit count descending)
          const sorted = markerEntries
            .slice()
            .sort((a, b) => b.priority - a.priority);

          sorted.forEach(({ marker }) => {
            const pos = marker.getPosition();
            if (!pos) { marker.setVisible(false); return; }
            if (mapBounds && !mapBounds.contains(pos)) { marker.setVisible(false); return; }

            const worldPoint = projection.fromLatLngToPoint(pos);
            if (!worldPoint) { marker.setVisible(false); return; }

            const scale = 1 << (zoomLevel);
            const px = Math.floor(worldPoint.x * scale / CELL_SIZE);
            const py = Math.floor(worldPoint.y * scale / CELL_SIZE);
            const cellKey = `${px},${py}`;

            if (occupiedCells.has(cellKey)) {
              marker.setVisible(false);
            } else {
              marker.setVisible(true);
              occupiedCells.add(cellKey);
            }
          });
        } else {
          // Non-journey mode (discover map)
          if (qualityIconCache.size > 0) {
            const desiredMode = zoomLevel >= labelZoomThreshold ? 'label' : 'badge';
            if (lastIconMode !== desiredMode) {
              markerEntries.forEach(({ id, marker }) => {
                const cached = qualityIconCache.get(id);
                if (cached) {
                  marker.setIcon(desiredMode === 'label' ? cached.label : cached.compact);
                }
              });
              lastIconMode = desiredMode;
            }
          }

          // Apply grid-based spatial overlap detection to reduce clutter when zoomed out
          const projection = map.getProjection();
          if (!projection) {
            markerEntries.forEach(({ marker }) => marker.setVisible(true));
            return;
          }

          const CELL_SIZE = zoomLevel >= labelZoomThreshold ? 70 : 95;
          const occupiedCells = new Set<string>();
          const mapBounds = map.getBounds();

          const sorted = markerEntries
            .slice()
            .sort((a, b) => b.priority - a.priority);

          sorted.forEach(({ marker }) => {
            const pos = marker.getPosition();
            if (!pos) { marker.setVisible(false); return; }
            if (mapBounds && !mapBounds.contains(pos)) { marker.setVisible(false); return; }

            const worldPoint = projection.fromLatLngToPoint(pos);
            if (!worldPoint) { marker.setVisible(false); return; }

            const scale = 1 << (zoomLevel);
            const px = Math.floor(worldPoint.x * scale / CELL_SIZE);
            const py = Math.floor(worldPoint.y * scale / CELL_SIZE);
            const cellKey = `${px},${py}`;

            if (occupiedCells.has(cellKey)) {
              marker.setVisible(false);
            } else {
              marker.setVisible(true);
              occupiedCells.add(cellKey);
            }
          });
        }
      };

      const shouldUseClusterer = useClusterer && !hasCityOverlays && !isSearchActive;

      // Create MarkerClusterer for global view mode
      let clusterer: MarkerClusterer | null = null;
      if (shouldUseClusterer) {
        const allMarkers = markerEntries.map(e => e.marker);
        clusterer = new MarkerClusterer({
          map,
          markers: allMarkers,
        });
      }

      let zoomDebounceTimer: ReturnType<typeof setTimeout> | null = null;
      const debouncedUpdate = () => {
        if (zoomDebounceTimer) clearTimeout(zoomDebounceTimer);
        zoomDebounceTimer = setTimeout(updateMarkerVisibility, 100);
      };

      // Skip visibility management when using clusterer (it handles its own visibility)
      const zoomListener = shouldUseClusterer
        ? null
        : map.addListener('zoom_changed', debouncedUpdate);

      if (!shouldUseClusterer) {
        updateMarkerVisibility();
      }

      return () => {
        if (zoomDebounceTimer) clearTimeout(zoomDebounceTimer);
        if (zoomListener) zoomListener.remove();
        if (clusterer) {
          clusterer.clearMarkers();
        }
        markerEntries.forEach(({ marker }) => marker.setMap(null));
        clusterMarkers.forEach(m => m.setMap(null));
        overlays.forEach(o => o.destroy());
        cityOverlays.forEach(o => o.destroy());
      };
    }
  }, [map, mapType, restaurants, dishes, demoRestaurants, demoMode, showQualityPercentages, countryStats, cityClusters, useClusterer, activeCountryCode, searchActive]);

  // Handle location button click
  const centerOnMyLocation = () => {
    setLocationError('');
    if (!navigator.geolocation) {
      setLocationError('Geolocation is not supported by this browser.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (map) {
          const coords = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            accuracy: position.coords.accuracy ?? undefined
          };
          setInternalUserLocation(coords);
          map.panTo({ lat: coords.lat, lng: coords.lng });
          map.setZoom(15);
        }
      },
      (error) => {
        console.error('Location error:', error);
        if (error.code === error.PERMISSION_DENIED) {
          setLocationError('Location permission denied. Enable it in settings to use navigation.');
        } else if (error.code === error.POSITION_UNAVAILABLE) {
          setLocationError('Location information is unavailable.');
        } else if (error.code === error.TIMEOUT) {
          setLocationError('Request to get your location timed out.');
        } else {
          setLocationError('Failed to get your location.');
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const navButtonClassName = 'absolute w-16 h-16 rounded-full bg-white shadow-lg flex items-center justify-center z-[40] border border-gray-100';
  const navButtonStyle: React.CSSProperties = {
    bottom: myLocationButtonOffset ?? (showGoogleControl ? 96 : 16),
    right: showGoogleControl ? 16 : 8
  };

  const navIconClassName = showGoogleControl ? 'w-8 h-8 text-blue-500' : 'w-8 h-8 text-blue-500';

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <div ref={ref} style={{ width: '100%', height: '100%' }} />

      {/* Hide Google fullscreen control if requested via CSS as fallback */}
      {!showGoogleControl && (
        <style>{`.gm-fullscreen-control{display:none!important}`}</style>
      )}

      {/* Navigation (My Location) Button */}
      {showMyLocationButton && (
        <button
          onClick={centerOnMyLocation}
          className={navButtonClassName}
          style={navButtonStyle}
          title="My Location"
          aria-label="Center on my location"
        >
          <Navigation className={navIconClassName} fill="currentColor" />
        </button>
      )}

      {/* Error Message */}
      {locationError && (
        <div style={{ 
          position: 'absolute', 
          top: 16, 
          left: 16, 
          right: 16, 
          zIndex: 10 
        }}>
          <div style={{
            backgroundColor: '#fef2f2',
            border: '1px solid #fca5a5',
            color: '#dc2626',
            padding: '12px 16px',
            borderRadius: 8,
            fontSize: 14
          }}>
            {locationError}
          </div>
        </div>
      )}
    </div>
  );
};

const LoadingComponent = () => (
  <div className="flex items-center justify-center h-full bg-gray-100">
    <div className="text-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
      <p className="text-gray-600">Loading map...</p>
    </div>
  </div>
);

const ErrorComponent = ({ status }: { status: Status }) => (
  <div className="flex items-center justify-center h-full bg-red-50">
    <div className="text-center">
      <p className="text-red-600 font-medium">Error loading map</p>
      <p className="text-red-500 text-sm">{status}</p>
    </div>
  </div>
);

interface RestaurantMapProps {
  className?: string;
  mapType: 'restaurant' | 'dish';
  restaurants?: Restaurant[];
  demoRestaurants?: Restaurant[];
  demoMode?: boolean;
  userLocation?: UserLocationCoordinates | null;
  onRestaurantClick?: (id: string) => void;
  onDishClick?: (id: string) => void;
  onDemoRestaurantClick?: (id: string) => void;
  onZoomChanged?: (zoom: number) => void;
  showQualityPercentages?: boolean;
  disableInfoWindows?: boolean;
  showMyLocationButton?: boolean;
  showGoogleControl?: boolean;
  focusRestaurantId?: string;
  myLocationButtonOffset?: number;
  initialCenter?: google.maps.LatLngLiteral;
  initialZoom?: number;
  countryStats?: CountryStat[];
  useClusterer?: boolean;
  mapRestriction?: google.maps.MapRestriction;
  minZoom?: number;
  maxZoom?: number;
  resetTrigger?: number;
  activeCountryCode?: string | null;
  onCountryToggle?: (countryCode: string) => void;
  cityClusters?: CityRestaurantGroup[];
  searchActive?: boolean;
  searchPoints?: google.maps.LatLngLiteral[];
}

// Fetch top dish from each restaurant from Firebase menuItems collection
const getTopDishes = async (restaurants: Restaurant[]): Promise<Dish[]> => {
  const dishes: Dish[] = [];
  
  console.log(`🔍 getTopDishes: Starting to fetch dishes for ${restaurants.length} restaurants`);
  
  try {
    console.log('📡 getTopDishes: Fetching menuItems from Firebase...');
    // Get all menu items from Firebase (filter out deleted items)
    const menuItemsRef = collection(db, 'menuItems');
    const menuItemsQuery = query(menuItemsRef, where('isDeleted', '==', false));
    const menuItemsSnapshot = await getDocs(menuItemsQuery);
    const allMenuItems = menuItemsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    console.log(`📊 getTopDishes: Found ${allMenuItems.length} total menu items in Firebase`);
    console.log('📋 getTopDishes: Sample menu items:', allMenuItems.slice(0, 3));
    
    // Group menu items by restaurant and get highest rated dish per restaurant
    
    const getDishScore = (dish: any) => {
      const rating = dish.rating || 0;
      const reviewCount = dish.reviewCount || 0;
      if (reviewCount < 3) return 0;
      return rating * Math.log10(reviewCount + 1);
    };

    restaurants.forEach(restaurant => {
      console.log(`🏪 getTopDishes: Processing restaurant "${restaurant.name}" (ID: ${restaurant.id})`);
      
      const restaurantMenuItems = allMenuItems.filter(
        (item: any) => {
          const matchesId = item.restaurantId === restaurant.id.toString();
          const matchesName = item.restaurantName === restaurant.name;
          return matchesId || matchesName;
        }
      );
      
      console.log(`🍽️ getTopDishes: Found ${restaurantMenuItems.length} menu items for "${restaurant.name}"`);
      
      if (restaurantMenuItems.length > 0) {
        const scoredItems = restaurantMenuItems.filter((item: any) => getDishScore(item) > 0);
        if (scoredItems.length === 0) {
          return;
        }

        const topDish = scoredItems.reduce((prev: any, current: any) =>
          getDishScore(current) > getDishScore(prev) ? current : prev
        );
        
        console.log(`⭐ getTopDishes: Top dish for "${restaurant.name}": "${topDish.name || topDish.dish}" (rating: ${topDish.rating})`);
        
        dishes.push({
          id: topDish.id,
          name: topDish.name || topDish.dish || 'Special Dish',
          rating: topDish.rating || 8.5,
          restaurantName: restaurant.name,
          restaurantId: restaurant.id.toString(),
          location: restaurant.location,
          price: topDish.price || undefined
        });
      }
    });
    
    console.log(`✅ getTopDishes: Successfully processed ${dishes.length} dishes`);
    
  } catch (error) {
    console.error('❌ getTopDishes: Error fetching menu items from Firebase:', error);
    console.log('🔄 getTopDishes: Creating fallback dishes for all restaurants due to Firebase error');
    
    // Fallback to mock data if Firebase fails completely
    restaurants.forEach((restaurant, index) => {
      // Create varied fallback dishes with random ratings between 8.0-9.5
      const fallbackRating = 8.0 + Math.random() * 1.5;
      const dishNames = [
        'Signature Dish', 'Chef\'s Special', 'House Favorite', 
        'Recommended Dish', 'Popular Choice', 'Featured Item'
      ];
      const dishName = dishNames[index % dishNames.length];
      
      const fallbackDish = {
        id: `error-fallback-${restaurant.id}`,
        name: dishName,
        rating: Number(fallbackRating.toFixed(1)),
        restaurantName: restaurant.name,
        restaurantId: restaurant.id.toString(),
        location: restaurant.location,
        price: '$25'
      };
      
      dishes.push(fallbackDish);
      console.log(`🆘 getTopDishes: Created error fallback dish for "${restaurant.name}":`, fallbackDish);
    });
    
    console.log(`🔄 getTopDishes: Created ${dishes.length} fallback dishes due to Firebase error`);
  }
  
  console.log(`🎯 getTopDishes: Returning ${dishes.length} total dishes for dish map`);
  return dishes;
};

const RestaurantMap: React.FC<RestaurantMapProps> = ({
  className = '',
  mapType,
  restaurants = [],
  demoRestaurants = [],
  demoMode = false,
  userLocation,
  onRestaurantClick,
  onDishClick,
  onDemoRestaurantClick,
  onZoomChanged,
  showQualityPercentages = true,
  disableInfoWindows = false,
  showMyLocationButton = true,
  showGoogleControl = true,
  focusRestaurantId,
  myLocationButtonOffset,
  initialCenter: initialCenterProp,
  initialZoom: initialZoomProp,
  countryStats,
  useClusterer,
  mapRestriction,
  minZoom,
  maxZoom,
  resetTrigger,
  activeCountryCode,
  onCountryToggle,
  cityClusters,
  searchActive,
  searchPoints,
}) => {
  const [topDishes, setTopDishes] = useState<Dish[]>([]);
  const [initialCenter, setInitialCenter] = useState(initialCenterProp || NYC_FALLBACK);
  const bottomSheet = useMapBottomSheet();
  const navigate = useNavigate();

  useEffect(() => {
    if (mapType === 'dish' && restaurants.length > 0) {
      getTopDishes(restaurants).then(setTopDishes);
    }
  }, [mapType, restaurants]);

  const focusCenter = (() => {
    if (!focusRestaurantId) return null;
    const r = restaurants.find(r => String(r.id) === String(focusRestaurantId));
    return r?.location || null;
  })();

  const render = (status: Status) => {
    switch (status) {
      case Status.LOADING:
        return <LoadingComponent />;
      case Status.FAILURE:
        return <ErrorComponent status={status} />;
      case Status.SUCCESS:
        return (
          <MapView
            center={focusCenter || initialCenter}
            zoom={focusCenter ? 16 : (initialZoomProp ?? 13)}
            mapType={mapType}
            restaurants={restaurants}
            dishes={topDishes}
            demoRestaurants={demoRestaurants}
            demoMode={demoMode}
            userLocation={userLocation}
            onRestaurantClick={onRestaurantClick}
            onDishClick={onDishClick}
            onDemoRestaurantClick={onDemoRestaurantClick}
            onZoomChanged={onZoomChanged}
            showQualityPercentages={showQualityPercentages}
            disableInfoWindows={disableInfoWindows}
            showMyLocationButton={showMyLocationButton}
            showGoogleControl={showGoogleControl}
            countryStats={countryStats}
            focusRestaurantId={focusRestaurantId}
            useClusterer={useClusterer}
            mapRestriction={mapRestriction}
            minZoom={minZoom}
            maxZoom={maxZoom}
            myLocationButtonOffset={myLocationButtonOffset}
            bottomSheetHook={bottomSheet}
            navigate={navigate}
            resetTrigger={resetTrigger}
            activeCountryCode={activeCountryCode}
            onCountryToggle={onCountryToggle}
            cityClusters={cityClusters}
            searchActive={searchActive}
            searchPoints={searchPoints}
          />
        );
    }
  };

  return (
    <div className={`w-full h-full ${className}`}>
      <Wrapper
        apiKey={import.meta.env.VITE_GOOGLE_MAPS_API_KEY}
        render={render}
        libraries={['places']}
      />
      <MapBottomSheet
        isOpen={bottomSheet.isOpen}
        onClose={bottomSheet.closeSheet}
        items={bottomSheet.items}
        type={bottomSheet.type}
        onItemClick={(id) => {
          if (bottomSheet.type === 'dish') {
            navigate(`/dish/${id}`);
          } else {
            navigate(`/restaurant/${id}`);
          }
        }}
      />
    </div>
  );
};

export default RestaurantMap;
