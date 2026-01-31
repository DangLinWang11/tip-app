import React, { useEffect, useRef, useState } from 'react';
import { MarkerClusterer, SuperClusterAlgorithm } from '@googlemaps/markerclusterer';
import { Wrapper, Status } from '@googlemaps/react-wrapper';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Navigation } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useMapBottomSheet } from '../hooks/useMapBottomSheet';
import MapBottomSheet from './discover/MapBottomSheet';
import { createDishRatingPinIcon } from '../utils/mapIcons';


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
  id: number;
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

interface MapProps {
  center: google.maps.LatLngLiteral;
  zoom: number;
  mapType: 'restaurant' | 'dish';
  restaurants: Restaurant[];
  dishes: Dish[];
  userLocation?: UserLocationCoordinates | null;
  onRestaurantClick?: (id: string) => void;
  onDishClick?: (id: string) => void;
  showQualityPercentages?: boolean;
  disableInfoWindows?: boolean;
  showMyLocationButton?: boolean;
  showGoogleControl?: boolean;
  myLocationButtonOffset?: number;
  bottomSheetHook?: ReturnType<typeof useMapBottomSheet>;
  navigate?: (path: string) => void;
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
const CLUSTER_ICON_CACHE = new Map<string, { url: string; width: number; height: number }>();
const DISH_PIN_CACHE = new Map<string, string>();

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
      <!-- Faux shadow pill -->
      <rect x="${pillX}" y="4" width="${pillWidth}" height="${pillHeight}" rx="${pillRadius}" fill="black" opacity="0.12" />
      <!-- Main pill -->
      <rect x="${pillX}" y="2" width="${pillWidth}" height="${pillHeight}" rx="${pillRadius}" fill="white" stroke="${pillStrokeColor}" stroke-width="2" />
      ${
        text
          ? `<text x="${width / 2}" y="21" font-family="Arial, sans-serif" font-size="12" font-weight="bold" text-anchor="middle" fill="${textColor}">${text}</text>`
          : ''
      }
      <!-- Pointer shadow -->
      <path d="M ${width / 2 - 4} 32 L ${width / 2} 40 L ${width / 2 + 4} 32 Z" fill="black" opacity="0.12" />
      <!-- Pointer -->
      <path d="M ${width / 2 - 4} 30 L ${width / 2} 38 L ${width / 2 + 4} 30 Z" fill="${triangleFill}" />
    </svg>
  `;

  const url = 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg);
  PIN_ICON_CACHE.set(cacheKey, url);
  return url;
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
        <filter id="pinShadow" x="-10%" y="-10%" width="120%" height="140%">
          <feOffset dx="0" dy="3" />
          <feGaussianBlur stdDeviation="2" />
          <feColorMatrix type="matrix" values="0 0 0 0 0
                                               0 0 0 0 0
                                               0 0 0 0 0
                                               0 0 0 0.2 0" />
          <feMerge>
            <feMergeNode />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <!-- Drop shadow -->
      <path
        d="M 12 2
           C 6.5 2, 2 6.5, 2 12
           C 2 17.5, 12 30, 12 30
           C 12 30, 22 17.5, 22 12
           C 22 6.5, 17.5 2, 12 2 Z"
        fill="black"
        opacity="1"
        filter="url(#pinShadow)"
      />
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

const createCommunityPinWithLabel = (label: string, color: string = '#ef4444') => {
  const cacheKey = `${label}|${color}`;
  const cached = COMMUNITY_PIN_CACHE.get(cacheKey);
  if (cached) return cached;
  const viewBoxWidth = 24;
  const viewBoxHeight = 34;
  const height = 40;
  const pinWidth = (height * viewBoxWidth) / viewBoxHeight;
  const gap = -2;
  const fontSize = 11;
  const textLen = Math.max(3, Math.min(label.length, 24));
  const labelWidth = Math.round(textLen * 7.2 + 6);
  const labelHeight = 14;
  const labelX = pinWidth + gap;
  const labelY = 7;
  const labelTextX = labelX + 2;
  const width = Math.round(pinWidth + gap + labelWidth);

  const svg = `
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
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
        <filter id="pinShadowLabel" x="-10%" y="-10%" width="120%" height="140%">
          <feOffset dx="0" dy="3" />
          <feGaussianBlur stdDeviation="2" />
          <feColorMatrix type="matrix" values="0 0 0 0 0
                                               0 0 0 0 0
                                               0 0 0 0 0
                                               0 0 0 0.2 0" />
          <feMerge>
            <feMergeNode />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id="textShadowLabel" x="-50%" y="-50%" width="200%" height="200%">
          <feDropShadow dx="0" dy="1" stdDeviation="1" flood-color="#000000" flood-opacity="0.1" />
        </filter>
      </defs>
      <!-- Pin shadow -->
      <path
        d="M 12 2
           C 6.5 2, 2 6.5, 2 12
           C 2 17.5, 12 30, 12 30
           C 12 30, 22 17.5, 22 12
           C 22 6.5, 17.5 2, 12 2 Z"
        fill="black"
        opacity="1"
        filter="url(#pinShadowLabel)"
      />
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
        fill="${color}" stroke="#FFFFFF" stroke-width="3" paint-order="stroke fill"
        filter="url(#textShadowLabel)">
        ${label}
      </text>
      <text x="${labelTextX}" y="${labelY + labelHeight / 2}"
        font-family="'Poppins', sans-serif" font-size="${fontSize}" font-weight="700"
        text-anchor="start" dominant-baseline="central" fill="${color}" filter="url(#textShadowLabel)">
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
  const separatorR = 20; // white separator
  const innerR = 16;     // inner white circle
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

const hashString = (value: string): number => {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
};

const applyCollisionJitter = (
  position: { lat: number; lng: number },
  id: string,
  seen: Map<string, number>
) => {
  const key = `${position.lat.toFixed(6)},${position.lng.toFixed(6)}`;
  const count = seen.get(key) ?? 0;
  seen.set(key, count + 1);
  if (count === 0) return position;

  const hash = hashString(id);
  const angle = ((hash % 360) * Math.PI) / 180;
  const magnitude = 0.00003 + (count * 0.000008);
  return {
    lat: position.lat + Math.cos(angle) * magnitude,
    lng: position.lng + Math.sin(angle) * magnitude
  };
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
      <!-- Faux shadow pill -->
      <rect x="${pillX}" y="4" width="${pillWidth}" height="32" rx="16" fill="black" opacity="0.12" />
      <!-- Main pill -->
      <rect x="${pillX}" y="2" width="${pillWidth}" height="32" rx="16" fill="white" stroke="${airyColor}" stroke-width="2" />
      <text x="19" y="23" font-family="Arial, sans-serif" font-size="16" font-weight="bold" text-anchor="middle" fill="${airyColor}">${rating}</text>
      <!-- Star icon -->
      <path
        d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
        fill="${goldColor}"
        transform="translate(32 6) scale(0.8333)"
      />
      <!-- Pointer shadow -->
      <path d="M 26 36 L 30 44 L 34 36 Z" fill="black" opacity="0.12" />
      <!-- Pointer -->
      <path d="M 26 34 L 30 42 L 34 34 Z" fill="${airyColor}" />
    </svg>
  `;

  return 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg);
};

const getClusterStyle = (count: number) => {
  if (count >= 51) {
    return {
      size: 58,
      gradStart: '#E53935',
      gradEnd: '#B71C1C',
      textColor: '#C62828'
    };
  }
  if (count >= 11) {
    return {
      size: 52,
      gradStart: '#FF5252',
      gradEnd: '#E53935',
      textColor: '#D32F2F'
    };
  }
  return {
    size: 44,
    gradStart: '#FF6B6B',
    gradEnd: '#EE2D2D',
    textColor: '#E11D48'
  };
};

const createClusterIcon = (count: number): { url: string; width: number; height: number } => {
  const cached = CLUSTER_ICON_CACHE.get(String(count));
  if (cached) return cached;
  const { size, gradStart, gradEnd } = getClusterStyle(count);
  const viewBoxWidth = 24;
  const viewBoxHeight = 34;
  const height = size;
  const width = (height * viewBoxWidth) / viewBoxHeight;
  const fontSize = count >= 100 ? 11 : count >= 10 ? 13 : 14;
  const uid = `cluster_${count}_${size}`;

  const svg = `
    <svg width="${width}" height="${height}" viewBox="0 0 ${viewBoxWidth} ${viewBoxHeight}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="grad_${uid}" x1="12" y1="2" x2="12" y2="30" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="${gradStart}" />
          <stop offset="100%" stop-color="${gradEnd}" />
        </linearGradient>
        <radialGradient id="depth_${uid}" cx="40%" cy="35%" r="70%">
          <stop offset="0%" stop-color="white" stop-opacity="0.12" />
          <stop offset="100%" stop-color="white" stop-opacity="0" />
        </radialGradient>
        <radialGradient id="shine_${uid}" cx="0%" cy="0%" r="100%">
          <stop offset="0%" stop-color="white" stop-opacity="0.6" />
          <stop offset="100%" stop-color="white" stop-opacity="0" />
        </radialGradient>
        <filter id="shadow_${uid}" x="-10%" y="-10%" width="120%" height="140%">
          <feOffset dx="0" dy="3" />
          <feGaussianBlur stdDeviation="2" />
          <feColorMatrix type="matrix" values="0 0 0 0 0
                                               0 0 0 0 0
                                               0 0 0 0 0
                                               0 0 0 0.2 0" />
          <feMerge>
            <feMergeNode />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id="textShadow_${uid}" x="-50%" y="-50%" width="200%" height="200%">
          <feDropShadow dx="0" dy="1" stdDeviation="1" flood-color="#000000" flood-opacity="0.1" />
        </filter>
      </defs>
      <path
        d="M 12 2
           C 6.5 2, 2 6.5, 2 12
           C 2 17.5, 12 30, 12 30
           C 12 30, 22 17.5, 22 12
           C 22 6.5, 17.5 2, 12 2 Z"
        fill="black"
        opacity="1"
        filter="url(#shadow_${uid})"
      />
      <path
        d="M 12 2
           C 6.5 2, 2 6.5, 2 12
           C 2 17.5, 12 30, 12 30
           C 12 30, 22 17.5, 22 12
           C 22 6.5, 17.5 2, 12 2 Z"
        fill="url(#grad_${uid})"
        stroke="white"
        stroke-width="2.25"
      />
      <circle cx="12" cy="12" r="10" fill="url(#depth_${uid})" />
      <circle cx="9.2" cy="7.6" r="2.6" fill="url(#shine_${uid})" />
      <text x="12" y="12" font-family="'Poppins', sans-serif" font-size="${fontSize}" font-weight="800" text-anchor="middle" dominant-baseline="central" fill="#FFFFFF" filter="url(#textShadow_${uid})">${count}</text>
    </svg>
  `;

  const result = {
    url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg),
    width,
    height
  };
  CLUSTER_ICON_CACHE.set(String(count), result);
  return result;
};

const DEFAULT_MAP_STYLE: google.maps.MapTypeStyle[] = [
  {
    featureType: "water",
    elementType: "geometry",
    stylers: [{ color: "#e3f2fd" }]
  },
  {
    featureType: "landscape",
    elementType: "geometry",
    stylers: [{ color: "#f5f5f5" }]
  },
  {
    featureType: "road",
    elementType: "geometry",
    stylers: [{ color: "#ffffff" }]
  },
  {
    featureType: "road",
    elementType: "labels.text.fill",
    stylers: [{ color: "#9e9e9e" }]
  },
  {
    featureType: "poi",
    elementType: "labels",
    stylers: [{ visibility: "off" }]
  },
  {
    featureType: "transit",
    stylers: [{ visibility: "off" }]
  }
];

const getDishPinIconCached = (rating: string): string => {
  const cached = DISH_PIN_CACHE.get(rating);
  if (cached) return cached;
  const url = createDishRatingPinIcon(rating);
  DISH_PIN_CACHE.set(rating, url);
  return url;
};

const MapView: React.FC<MapProps> = ({ center, zoom, mapType, restaurants, dishes, userLocation, onRestaurantClick, onDishClick, showQualityPercentages = true, disableInfoWindows = false, showMyLocationButton = true, showGoogleControl = true, myLocationButtonOffset, bottomSheetHook, navigate }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<google.maps.Map>();
  const styleLoggedRef = useRef(false);
  const clustererRef = useRef<MarkerClusterer | null>(null);
  const [locationError, setLocationError] = useState<string>('');
  const [userLocationMarker, setUserLocationMarker] = useState<google.maps.Marker | null>(null);
  const [userAccuracyCircle, setUserAccuracyCircle] = useState<google.maps.Circle | null>(null);
  const onRestaurantClickRef = useRef(onRestaurantClick);
  const onDishClickRef = useRef(onDishClick);
  const bottomSheetRef = useRef(bottomSheetHook);
  // Internal location state when user taps the navigation button
  const [internalUserLocation, setInternalUserLocation] = useState<UserLocationCoordinates | null>(null);

  useEffect(() => {
    onRestaurantClickRef.current = onRestaurantClick;
  }, [onRestaurantClick]);

  useEffect(() => {
    onDishClickRef.current = onDishClick;
  }, [onDishClick]);

  useEffect(() => {
    bottomSheetRef.current = bottomSheetHook;
  }, [bottomSheetHook]);


  useEffect(() => {
    if (ref.current && !map) {
      const mapId = import.meta.env.VITE_GOOGLE_MAPS_MAP_ID || undefined;
      const mapStyles = mapId ? undefined : DEFAULT_MAP_STYLE;
      const newMap = new window.google.maps.Map(ref.current, {
        center,
        zoom,
        mapId,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: showGoogleControl,
        zoomControl: false,
        rotateControl: false,
        scaleControl: false,
        gestureHandling: 'greedy',
        scrollwheel: true,
        disableDoubleClickZoom: false,
        styles: mapStyles
      });
      if (!styleLoggedRef.current) {
        console.log(mapId ? 'Map style: MAP_ID' : 'Map style: DEFAULT');
        styleLoggedRef.current = true;
      }
      setMap(newMap);
    }
  }, [ref, map, center, zoom, showGoogleControl]);


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
      if (clustererRef.current) {
        clustererRef.current.clearMarkers();
        clustererRef.current.setMap(null);
        clustererRef.current = null;
      }

      const markers: google.maps.Marker[] = [];

      if (mapType === 'restaurant') {
        // Show restaurant pins
        const positionCounts = new globalThis.Map<string, number>();
        restaurants.forEach((restaurant) => {
          // Validate location data before creating marker
          let position = restaurant.location;

          // Safety check: ensure position is a valid LatLng object
          if (!position || typeof position !== 'object' || typeof position.lat !== 'number' || typeof position.lng !== 'number') {
            console.warn(`⚠️ Invalid location data for restaurant ${restaurant.name}, skipping marker`, position);
            return; // Skip this restaurant
          }

          const qualityColor = getQualityColor(restaurant.qualityPercentage);
          const isJourneyMode = showQualityPercentages === false;

          // Determine what text to show in the pin
          let pinText = '';
          let pinWidth = 52;
          if (isJourneyMode && restaurant.visitCount) {
            pinText = `${restaurant.visitCount}`;
            pinWidth = 36;
          } else if (!isJourneyMode) {
            // Show quality percentage for regular restaurant maps
            pinText = `${restaurant.qualityPercentage}%`;
          }

          const markerPosition = applyCollisionJitter(
            position,
            String(restaurant.id),
            positionCounts
          );

          const communityPin = isJourneyMode
            ? createCommunityPinWithLabel(restaurant.name, '#ef4444')
            : null;
          const communityAnchorX = communityPin ? (communityPin.width * (24 / 34)) / 2 : 0;
          const communityAnchorY = communityPin ? communityPin.height : 0;

          const marker = new window.google.maps.Marker({
            position: markerPosition,
            icon: isJourneyMode
              ? {
                  url: communityPin!.url,
                  scaledSize: new window.google.maps.Size(communityPin!.width, communityPin!.height),
                  anchor: new window.google.maps.Point(communityAnchorX, communityAnchorY)
                }
              : {
                  url: createPinIcon(pinText, qualityColor, showQualityPercentages),
                  scaledSize: new window.google.maps.Size(pinWidth, 44),
                  anchor: new window.google.maps.Point(pinWidth / 2, 50)
                },
            title: restaurant.name,
            zIndex: restaurant.qualityPercentage
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

          markers.push(marker);
        });
      } else {
        // Show dish pins
        dishes.forEach((dish) => {
          const rating = dish.rating != null && typeof dish.rating === 'number' ? dish.rating : 0;
          const displayRating = rating > 0 ? rating.toFixed(1) : 'N/A';

          const marker = new window.google.maps.Marker({
            position: dish.location,
            icon: {
              url: getDishPinIconCached(displayRating),
              scaledSize: new window.google.maps.Size(64, 48),
              anchor: new window.google.maps.Point(32, 48)
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
          markers.push(marker);
        });
      }

      if (mapType === 'restaurant') {
        clustererRef.current = new MarkerClusterer({
          map,
          markers,
          algorithm: new SuperClusterAlgorithm({
            radius: 100,
            maxZoom: 15
          }),
          renderer: {
            render: ({ count, position }) => {
              const icon = createClusterIcon(count);
              return new window.google.maps.Marker({
                position,
                icon: {
                  url: icon.url,
                  scaledSize: new window.google.maps.Size(icon.width, icon.height),
                  anchor: new window.google.maps.Point(icon.width / 2, icon.height)
                },
                zIndex: (google.maps.Marker.MAX_ZINDEX || 1000) + count
              });
            }
          }
        });
      } else {
        markers.forEach((marker) => marker.setMap(map));
      }

      // Store markers on map for cleanup
      (map as any).markers = markers;

      // Removed auto-fit bounds to keep map centered on initial user/fallback location
    }
  }, [map, mapType, restaurants, dishes, showQualityPercentages]);

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
    right: showGoogleControl ? 16 : 12
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
  userLocation?: UserLocationCoordinates | null;
  onRestaurantClick?: (id: string) => void;
  onDishClick?: (id: string) => void;
  showQualityPercentages?: boolean;
  disableInfoWindows?: boolean;
  showMyLocationButton?: boolean;
  showGoogleControl?: boolean;
  focusRestaurantId?: string;
  myLocationButtonOffset?: number;
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
        // Get the highest rated dish for this restaurant
        const topDish = restaurantMenuItems.reduce((prev: any, current: any) => 
          (current.rating || 0) > (prev.rating || 0) ? current : prev
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
  userLocation,
  onRestaurantClick,
  onDishClick,
  showQualityPercentages = true,
  disableInfoWindows = false,
  showMyLocationButton = true,
  showGoogleControl = true,
  focusRestaurantId,
  myLocationButtonOffset
}) => {
  const [topDishes, setTopDishes] = useState<Dish[]>([]);
  const [initialCenter, setInitialCenter] = useState(NYC_FALLBACK);
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
            zoom={focusCenter ? 16 : 13}
            mapType={mapType}
            restaurants={restaurants}
            dishes={topDishes}
            userLocation={userLocation}
            onRestaurantClick={onRestaurantClick}
            onDishClick={onDishClick}
            showQualityPercentages={showQualityPercentages}
            disableInfoWindows={disableInfoWindows}
            showMyLocationButton={showMyLocationButton}
            showGoogleControl={showGoogleControl}
            myLocationButtonOffset={myLocationButtonOffset}
            bottomSheetHook={bottomSheet}
            navigate={navigate}
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
