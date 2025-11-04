# 🤖 Expo Migration — Agent/AI Tasks

**Project:** Tip PWA → Expo Native App
**Audience:** Claude/Codex automation tasks
**Last Updated:** 2025-10-17

---

## Overview

This document contains all tasks that can be **automated or scaffolded** by AI agents during the Expo migration. Each task references the corresponding developer checklist item when manual approval/input is needed.

---

## Phase 1️⃣: Pre-Migration Audit

### 🤖 Task 1.1: Scan for Browser-Only APIs

**Goal:** Identify all files using `window`, `document`, `localStorage`, `navigator`, etc.

**Commands:**
```bash
cd "C:\Users\djdav\Tip Development\tip"

# Find window/document references
grep -r "window\." src/ --include="*.ts" --include="*.tsx" > browser-apis-window.txt
grep -r "document\." src/ --include="*.ts" --include="*.tsx" > browser-apis-document.txt
grep -r "localStorage" src/ --include="*.ts" --include="*.tsx" > browser-apis-storage.txt
grep -r "navigator\." src/ --include="*.ts" --include="*.tsx" > browser-apis-navigator.txt
```

**Output:** Provide summary report to developer with file paths and line numbers.

**Handoff:** → Developer reviews and prioritizes refactors (see Developer Checklist 1.2)

---

### 🤖 Task 1.2: Audit Tailwind Classes for RN Incompatibility

**Goal:** Flag Tailwind utilities that don't work in React Native.

**Incompatible patterns to search for:**
- `position: fixed` or `sticky`
- `backdrop-*` utilities
- `grid` layouts
- `table` layouts
- `overflow-x-scroll` (needs ScrollView)

**Commands:**
```bash
# Search for problematic Tailwind classes
grep -rE "fixed|sticky|backdrop-|grid|grid-cols|table" src/ --include="*.tsx" > tailwind-issues.txt
```

**Deliverable:** List of files needing manual layout refactors.

**Handoff:** → Developer decides replacement strategy (Developer Checklist 2.3)

---

### 🤖 Task 1.3: Inventory Third-Party Dependencies

**Goal:** Check which dependencies need React Native equivalents.

**Analysis:**
```javascript
// Current web-only deps from package.json:
{
  "@googlemaps/react-wrapper": "^1.2.0",    // → react-native-maps
  "framer-motion": "^11.11.17",             // → moti / reanimated
  "react-router-dom": "^6.26.2",            // → expo-router
  "vite": "^5.2.0"                          // → expo/metro
}

// Can stay:
{
  "firebase": "^11.10.0",                   // ✅ Works with RN (with tweaks)
  "lucide-react": "^0.441.0",               // ✅ Has lucide-react-native
  "react": "^18.3.1"                        // ✅ Core dependency
}
```

**Action:** Generate migration mapping document.

**Handoff:** → Developer approves package replacement plan (Developer Checklist 1.3)

---

## Phase 2️⃣: Repo Prep & Cleanup

### 🤖 Task 2.1: Remove PWA Artifacts

**Goal:** Clean out web-only build configurations.

**Files to remove:**
```bash
rm vite.config.ts
rm -rf public/  # If exists
rm -rf .firebase/  # Build cache
```

**Files to modify:**
- Remove `manifest.json` references from `index.html`
- Remove service worker registration from any init files

**Handoff:** → Developer confirms no critical assets lost (Developer Checklist 2.1)

---

### 🤖 Task 2.2: Normalize Service Exports

**Goal:** Ensure `/src/services/*.ts` use consistent export patterns for tree-shaking.

**Example refactor:**
```typescript
// BEFORE (mixed exports in firebase.ts)
export { auth, db, storage };
export const signUpWithEmail = async (...) => { ... };
export default app;

// AFTER (named exports only)
export { auth, db, storage, app };
export { signUpWithEmail, signInWithEmail, signOutUser };
// Remove export default to avoid metro bundler issues
```

**Files to normalize:**
- `src/lib/firebase.ts`
- `src/services/reviewService.ts`
- `src/services/userService.ts`
- All other service files

**Validation:** Run ESLint check for default exports.

---

### 🤖 Task 2.3: Add ESLint Rule for DOM Calls

**Goal:** Prevent accidental DOM usage after migration.

**Configuration:**
```json
// .eslintrc.json (new rules)
{
  "rules": {
    "no-restricted-globals": ["error", "document", "window"],
    "no-restricted-syntax": [
      "error",
      {
        "selector": "MemberExpression[object.name='localStorage']",
        "message": "Use AsyncStorage instead of localStorage"
      },
      {
        "selector": "MemberExpression[object.name='sessionStorage']",
        "message": "Use AsyncStorage instead of sessionStorage"
      }
    ]
  }
}
```

**Handoff:** → Developer reviews and enables linting (Developer Checklist 2.4)

---

## Phase 3️⃣: Expo App Initialization

### 🤖 Task 3.1: Scaffold Expo Project

**Goal:** Create new Expo app with TypeScript + expo-router.

**Commands:**
```bash
cd "C:\Users\djdav\Tip Development"

# Create new Expo project
npx create-expo-app tip-mobile --template expo-template-blank-typescript

cd tip-mobile

# Install expo-router and dependencies
npx expo install expo-router react-native-safe-area-context react-native-screens expo-linking expo-constants expo-status-bar

# Install async storage for persistence
npx expo install @react-native-async-storage/async-storage

# Install crypto polyfills for Firebase
npx expo install react-native-get-random-values expo-crypto
```

**Verify installation:**
```bash
npx expo start
```

**Handoff:** → Developer confirms local dev server runs (Developer Checklist 3.1)

---

### 🤖 Task 3.2: Configure Babel for expo-router + NativeWind

**Goal:** Set up Metro bundler plugins.

**File:** `babel.config.js`
```javascript
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // Expo Router
      require.resolve('expo-router/babel'),
      // NativeWind
      'nativewind/babel',
      // Reanimated (must be last)
      'react-native-reanimated/plugin',
    ],
  };
};
```

---

### 🤖 Task 3.3: Create Initial app/ Directory Structure

**Goal:** Set up file-based routing scaffold.

**Directory structure:**
```
tip-mobile/
  app/
    _layout.tsx              # Root layout
    index.tsx                # Redirect to onboarding/tabs
    onboarding.tsx           # Auth flow
    (tabs)/
      _layout.tsx            # Tab navigation
      index.tsx              # Home feed
      discover.tsx           # Discover restaurants
      create.tsx             # Create review
      profile.tsx            # User profile
      map.tsx                # Food map
    restaurant/
      [id].tsx               # Restaurant detail
      [id]/menu.tsx          # Menu detail
    post/
      [postId].tsx           # Post detail
    user/
      [username].tsx         # Public profile
    list/
      [id].tsx               # List detail
    profile/
      edit.tsx               # Edit profile
      change-password.tsx    # Change password
    admin/
      upload.tsx
      claims.tsx
      reviews.tsx
    owner/
      _layout.tsx            # Owner portal sub-routes
      index.tsx
```

**Files to generate:** All `_layout.tsx` and route files with basic scaffolding.

**Template for basic route:**
```typescript
// app/(tabs)/discover.tsx
import { View, Text } from 'react-native';

export default function DiscoverScreen() {
  return (
    <View className="flex-1 items-center justify-center">
      <Text className="text-xl">Discover Screen</Text>
    </View>
  );
}
```

**Handoff:** → Developer reviews route structure (Developer Checklist 3.2)

---

## Phase 4️⃣: EAS Setup

### 🤖 Task 4.1: Generate eas.json

**Goal:** Create build profiles for dev/preview/production.

**File:** `eas.json`
```json
{
  "cli": {
    "version": ">= 5.0.0"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "ios": {
        "simulator": true
      }
    },
    "preview": {
      "distribution": "internal",
      "channel": "preview",
      "ios": {
        "simulator": false,
        "bundleIdentifier": "com.tipapp.sarasota"
      },
      "android": {
        "buildType": "apk",
        "applicationId": "com.tipapp.sarasota"
      }
    },
    "production": {
      "channel": "production",
      "ios": {
        "bundleIdentifier": "com.tipapp.sarasota"
      },
      "android": {
        "applicationId": "com.tipapp.sarasota"
      }
    }
  },
  "submit": {
    "production": {
      "ios": {
        "appleId": "YOUR_APPLE_ID@example.com",
        "ascAppId": "PLACEHOLDER",
        "appleTeamId": "PLACEHOLDER"
      },
      "android": {
        "serviceAccountKeyPath": "./google-play-service-account.json",
        "track": "internal"
      }
    }
  }
}
```

**Handoff:** → Developer fills in Apple/Google IDs (Developer Checklist 4.2)

---

### 🤖 Task 4.2: Configure app.json / app.config.ts

**Goal:** Set up app metadata and permissions.

**File:** `app.config.ts`
```typescript
import { ExpoConfig, ConfigContext } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'Tip',
  slug: 'tip-mobile',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'light',
  scheme: 'tip',
  splash: {
    image: './assets/splash.png',
    resizeMode: 'contain',
    backgroundColor: '#ffffff'
  },
  assetBundlePatterns: ['**/*'],
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'com.tipapp.sarasota',
    infoPlist: {
      NSLocationWhenInUseUsageDescription: 'We use your location to show nearby restaurants and help you discover great food around you.',
      NSPhotoLibraryUsageDescription: 'We need access to your photo library to upload food photos with your reviews.',
      NSCameraUsageDescription: 'We need camera access to take photos of your food for reviews.',
    },
    config: {
      googleMapsApiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_IOS_KEY
    }
  },
  android: {
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#ffffff'
    },
    package: 'com.tipapp.sarasota',
    permissions: [
      'ACCESS_FINE_LOCATION',
      'ACCESS_COARSE_LOCATION',
      'CAMERA',
      'READ_EXTERNAL_STORAGE',
      'WRITE_EXTERNAL_STORAGE'
    ],
    config: {
      googleMaps: {
        apiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_KEY
      }
    }
  },
  web: {
    favicon: './assets/favicon.png',
    bundler: 'metro'
  },
  plugins: [
    'expo-router',
    'expo-localization',
    [
      'expo-build-properties',
      {
        ios: {
          useFrameworks: 'static'
        }
      }
    ]
  ],
  extra: {
    router: {
      origin: false
    },
    eas: {
      projectId: 'PLACEHOLDER_EAS_PROJECT_ID'
    },
    // Firebase config (loaded from env)
    firebaseApiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
    firebaseAuthDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
    firebaseProjectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
    firebaseStorageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
    firebaseMessagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    firebaseAppId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
    firebaseMeasurementId: process.env.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID
  }
});
```

**Handoff:** → Developer provides EAS project ID after running `eas init` (Developer Checklist 4.1)

---

## Phase 5️⃣: Environment & Firebase Config

### 🤖 Task 5.1: Create .env Template

**Goal:** Document all required environment variables.

**File:** `.env.example`
```bash
# Firebase Web SDK Config
EXPO_PUBLIC_FIREBASE_API_KEY=AIzaSyBEzuZLNQo0SJ-zfq6IsBPbYKFj6NV6sAM
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=tip-sarasotav2.firebaseapp.com
EXPO_PUBLIC_FIREBASE_PROJECT_ID=tip-sarasotav2
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=tip-sarasotav2.firebasestorage.app
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=279316450534
EXPO_PUBLIC_FIREBASE_APP_ID=1:279316450534:web:6386a22fe38591ef84ff27
EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID=G-9RQW6H7238

# Google Maps API Keys (separate for iOS/Android)
EXPO_PUBLIC_GOOGLE_MAPS_IOS_KEY=your_ios_key_here
EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_KEY=your_android_key_here

# Optional: Emulator toggle
EXPO_PUBLIC_USE_EMULATORS=false
```

**Handoff:** → Developer creates `.env` from template (Developer Checklist 5.1)

---

### 🤖 Task 5.2: Migrate Firebase Initialization

**Goal:** Adapt `src/lib/firebase.ts` for React Native with AsyncStorage persistence.

**New file:** `tip-mobile/src/lib/firebase.ts`
```typescript
import { initializeApp, getApps } from 'firebase/app';
import {
  getAuth,
  initializeAuth,
  getReactNativePersistence
} from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getAnalytics } from 'firebase/analytics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import 'react-native-get-random-values'; // Required for Firebase

const firebaseConfig = {
  apiKey: Constants.expoConfig?.extra?.firebaseApiKey,
  authDomain: Constants.expoConfig?.extra?.firebaseAuthDomain,
  projectId: Constants.expoConfig?.extra?.firebaseProjectId,
  storageBucket: Constants.expoConfig?.extra?.firebaseStorageBucket,
  messagingSenderId: Constants.expoConfig?.extra?.firebaseMessagingSenderId,
  appId: Constants.expoConfig?.extra?.firebaseAppId,
  measurementId: Constants.expoConfig?.extra?.firebaseMeasurementId,
};

// Initialize Firebase
let app;
if (!getApps().length) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApps()[0];
}

// Initialize Auth with AsyncStorage persistence
const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage)
});

// Initialize Firestore
const db = getFirestore(app);

// Initialize Storage
const storage = getStorage(app);

// Analytics (optional, web-only feature)
let analytics = null;
// Note: Firebase Analytics JS SDK doesn't work on RN
// Use @react-native-firebase/analytics if needed

export { auth, db, storage, analytics, app };

// Re-export all auth functions from original firebase.ts
export * from './firebaseAuth';
export * from './firebaseProfile';
export * from './firebaseStorage';
```

**Additional files to create:**
- `firebaseAuth.ts` - All auth functions (signUpWithEmail, etc.)
- `firebaseProfile.ts` - User profile management
- `firebaseStorage.ts` - Image upload functions

**Handoff:** → Developer tests Firebase connection on device (Developer Checklist 6.2)

---

### 🤖 Task 5.3: Handle Google Sign-In Migration

**Goal:** Replace `signInWithPopup` with React Native Google Sign-In.

**Installation:**
```bash
npx expo install @react-native-google-signin/google-signin
```

**New implementation:** `src/lib/firebaseAuth.ts`
```typescript
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { GoogleAuthProvider, signInWithCredential } from 'firebase/auth';
import { auth } from './firebase';
import Constants from 'expo-constants';

// Configure Google Sign-In
GoogleSignin.configure({
  webClientId: Constants.expoConfig?.extra?.firebaseWebClientId, // From Firebase Console
  iosClientId: Constants.expoConfig?.extra?.firebaseIosClientId, // Optional: iOS-specific
});

export const signInWithGoogle = async (): Promise<{ success: boolean; user?: User; error?: string }> => {
  try {
    await GoogleSignin.hasPlayServices();
    const userInfo = await GoogleSignin.signIn();

    // Create Firebase credential
    const googleCredential = GoogleAuthProvider.credential(userInfo.idToken);

    // Sign in to Firebase
    const userCredential = await signInWithCredential(auth, googleCredential);

    return { success: true, user: userCredential.user };
  } catch (error: any) {
    console.error('Google Sign-In failed:', error);
    return { success: false, error: error.message };
  }
};
```

**Handoff:** → Developer adds OAuth client IDs to Firebase Console (Developer Checklist 6.3)

---

## Phase 6️⃣: Copy Services Layer

### 🤖 Task 6.1: Copy All Service Files

**Goal:** Move existing `/src/services/*.ts` to new Expo project.

**Commands:**
```bash
# Copy services directory
cp -r "C:\Users\djdav\Tip Development\tip\src\services" "C:\Users\djdav\Tip Development\tip-mobile\src\"

# Copy utils
cp -r "C:\Users\djdav\Tip Development\tip\src\utils" "C:\Users\djdav\Tip Development\tip-mobile\src\"

# Copy contexts
cp -r "C:\Users\djdav\Tip Development\tip\src\contexts" "C:\Users\djdav\Tip Development\tip-mobile\src\"

# Copy config
cp -r "C:\Users\djdav\Tip Development\tip\src\config" "C:\Users\djdav\Tip Development\tip-mobile\src\"

# Copy lib (i18n, etc.)
cp -r "C:\Users\djdav\Tip Development\tip\src\lib" "C:\Users\djdav\Tip Development\tip-mobile\src\"
```

**Validation:** Run TypeScript compilation to catch missing imports.

---

### 🤖 Task 6.2: Refactor LocationContext for React Native

**Goal:** Replace `navigator.geolocation` with `expo-location`.

**Installation:**
```bash
npx expo install expo-location
```

**New file:** `src/contexts/LocationContext.tsx`
```typescript
import React, { createContext, useContext, useState, useEffect } from 'react';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface LocationCoordinates {
  latitude: number;
  longitude: number;
}

export interface LocationContextType {
  hasPermission: boolean;
  isPermissionRequested: boolean;
  currentLocation: LocationCoordinates | null;
  isLoading: boolean;
  error: string | null;
  requestLocationPermission: () => Promise<boolean>;
  getCurrentLocation: () => Promise<LocationCoordinates | null>;
  clearError: () => void;
}

const LocationContext = createContext<LocationContextType | undefined>(undefined);

export const LocationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [hasPermission, setHasPermission] = useState<boolean>(false);
  const [isPermissionRequested, setIsPermissionRequested] = useState<boolean>(false);
  const [currentLocation, setCurrentLocation] = useState<LocationCoordinates | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    checkExistingPermission();
  }, []);

  const checkExistingPermission = async () => {
    const { status } = await Location.getForegroundPermissionsAsync();
    setHasPermission(status === 'granted');

    const requested = await AsyncStorage.getItem('locationPermissionRequested');
    setIsPermissionRequested(requested === 'true');

    if (status === 'granted') {
      getCurrentLocation();
    }
  };

  const requestLocationPermission = async (): Promise<boolean> => {
    setIsLoading(true);
    setError(null);

    try {
      const { status } = await Location.requestForegroundPermissionsAsync();

      setIsPermissionRequested(true);
      await AsyncStorage.setItem('locationPermissionRequested', 'true');

      if (status === 'granted') {
        setHasPermission(true);
        await getCurrentLocation();
        setIsLoading(false);
        return true;
      } else {
        setHasPermission(false);
        setError('Location permission denied');
        setIsLoading(false);
        return false;
      }
    } catch (err) {
      setError('Failed to request location permission');
      setIsLoading(false);
      return false;
    }
  };

  const getCurrentLocation = async (): Promise<LocationCoordinates | null> => {
    if (!hasPermission) {
      setError('Location permission not granted');
      return null;
    }

    setIsLoading(true);
    setError(null);

    try {
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      const coordinates = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      };

      setCurrentLocation(coordinates);
      setIsLoading(false);
      return coordinates;
    } catch (err) {
      setError('Failed to get current location');
      setIsLoading(false);
      return null;
    }
  };

  const clearError = () => setError(null);

  return (
    <LocationContext.Provider
      value={{
        hasPermission,
        isPermissionRequested,
        currentLocation,
        isLoading,
        error,
        requestLocationPermission,
        getCurrentLocation,
        clearError,
      }}
    >
      {children}
    </LocationContext.Provider>
  );
};

export const useLocation = () => {
  const context = useContext(LocationContext);
  if (!context) {
    throw new Error('useLocation must be used within LocationProvider');
  }
  return context;
};
```

**Handoff:** → Developer tests location permissions on iOS/Android (Developer Checklist 9.2)

---

## Phase 7️⃣: Routing Migration

### 🤖 Task 7.1: Map React Router Routes to expo-router

**Goal:** Convert each `<Route>` from App.tsx to file-based route.

**Mapping table:**

| React Router Path | Expo Router File | Notes |
|------------------|------------------|-------|
| `/` | `app/(tabs)/index.tsx` | Home feed |
| `/discover` | `app/(tabs)/discover.tsx` | - |
| `/discover/list` | `app/(tabs)/discover/list.tsx` | Nested route |
| `/create` | `app/(tabs)/create.tsx` | - |
| `/notifications` | `app/(tabs)/notifications.tsx` | Feature-flagged |
| `/profile` | `app/(tabs)/profile.tsx` | - |
| `/recent-activity` | `app/recent-activity.tsx` | Outside tabs |
| `/rewards` | `app/rewards.tsx` | - |
| `/food-map` | `app/(tabs)/map.tsx` | - |
| `/user/:username` | `app/user/[username].tsx` | Dynamic param |
| `/list/:id` | `app/list/[id].tsx` | Dynamic param |
| `/restaurant/:id` | `app/restaurant/[id].tsx` | Dynamic param |
| `/restaurant/:id/menu` | `app/restaurant/[id]/menu.tsx` | Nested dynamic |
| `/dish/:id` | `app/dish/[id].tsx` | Dynamic param |
| `/post/:postId` | `app/post/[postId].tsx` | Dynamic param |
| `/profile/edit` | `app/profile/edit.tsx` | - |
| `/profile/change-password` | `app/profile/change-password.tsx` | - |
| `/admin-upload` | `app/admin/upload.tsx` | - |
| `/admin/claims` | `app/admin/claims.tsx` | - |
| `/admin/reviews` | `app/admin/reviews.tsx` | - |
| `/owner/*` | `app/owner/_layout.tsx` + sub-routes | Nested stack |

**Generate:** All route files with basic scaffolding.

---

### 🤖 Task 7.2: Create Tab Navigation Layout

**Goal:** Implement bottom navigation with icons.

**File:** `app/(tabs)/_layout.tsx`
```typescript
import { Tabs } from 'expo-router';
import { Home, Search, PlusCircle, Map, User } from 'lucide-react-native';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#ff3131',
        tabBarInactiveTintColor: '#9E9E9E',
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#ffffff',
          borderTopWidth: 1,
          borderTopColor: '#E0E0E0',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }) => <Home color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="discover"
        options={{
          title: 'Discover',
          tabBarIcon: ({ color, size }) => <Search color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="create"
        options={{
          title: 'Create',
          tabBarIcon: ({ color, size }) => <PlusCircle color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="map"
        options={{
          title: 'Map',
          tabBarIcon: ({ color, size }) => <Map color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size }) => <User color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}
```

**Installation:**
```bash
npx expo install lucide-react-native
```

---

### 🤖 Task 7.3: Replace Router Hooks

**Goal:** Convert all React Router hooks to expo-router equivalents.

**Find and replace patterns:**

```typescript
// BEFORE (React Router)
import { useNavigate, useParams, useLocation } from 'react-router-dom';

const navigate = useNavigate();
navigate('/restaurant/123');

const { id } = useParams();
const location = useLocation();

// AFTER (Expo Router)
import { useRouter, useLocalSearchParams, usePathname } from 'expo-router';

const router = useRouter();
router.push('/restaurant/123');

const { id } = useLocalSearchParams();
const pathname = usePathname();
```

**Automated refactor commands:**
```bash
# Search for all useNavigate usage
grep -r "useNavigate" src/ --include="*.tsx" > navigate-usage.txt

# Search for all useParams
grep -r "useParams" src/ --include="*.tsx" > params-usage.txt
```

**Handoff:** → Developer reviews navigation logic changes (Developer Checklist 7.2)

---

## Phase 8️⃣: UI Component Migration

### 🤖 Task 8.1: Install NativeWind + Dependencies

**Goal:** Set up Tailwind for React Native.

**Commands:**
```bash
npx expo install nativewind tailwindcss react-native-reanimated react-native-gesture-handler
```

**File:** `tailwind.config.js`
```javascript
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,jsx,ts,tsx}',
    './src/**/*.{js,jsx,ts,tsx}'
  ],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        primary: '#ff3131',
        secondary: '#029094',
        accent: '#FFC529',
        background: '#FFFFFF',
        'light-gray': '#F5F5F5',
        'medium-gray': '#E0E0E0',
        'dark-gray': '#9E9E9E',
      },
      fontFamily: {
        // Custom fonts require expo-font
        poppins: ['Poppins', 'sans-serif'],
        kent: ['KENT', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
```

**File:** `metro.config.js`
```javascript
const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

module.exports = withNativeWind(config, { input: './global.css' });
```

**File:** `global.css`
```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

---

### 🤖 Task 8.2: Create RN Component Mapping Guide

**Goal:** Document Web → RN primitive conversions.

**Mapping table:**

| Web Element | React Native | Notes |
|-------------|--------------|-------|
| `<div>` | `<View>` | Main container |
| `<span>`, `<p>` | `<Text>` | All text must be in `<Text>` |
| `<img>` | `<Image>` | Requires `source={{ uri }}` |
| `<button>` | `<Pressable>` or `<TouchableOpacity>` | No native button styling |
| `<input>` | `<TextInput>` | Different props |
| `<input type="file">` | `expo-image-picker` | Completely different API |
| `<a>` | `<Link>` from expo-router | - |
| `<select>` | `@react-native-picker/picker` | Native picker |
| Scroll container | `<ScrollView>` | Explicit scroll wrapper |
| List | `<FlatList>` | Virtualized |

**Action:** Provide this as reference doc for manual migration.

---

### 🤖 Task 8.3: Install Moti for Animations

**Goal:** Replace Framer Motion with React Native animations.

**Commands:**
```bash
npx expo install moti
```

**Migration examples:**

```typescript
// BEFORE (Framer Motion)
import { motion } from 'framer-motion';

<motion.div
  initial={{ opacity: 0, y: 20 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ duration: 0.3 }}
>
  Content
</motion.div>

// AFTER (Moti)
import { MotiView } from 'moti';

<MotiView
  from={{ opacity: 0, translateY: 20 }}
  animate={{ opacity: 1, translateY: 0 }}
  transition={{ type: 'timing', duration: 300 }}
>
  Content
</MotiView>
```

**Handoff:** → Developer migrates complex animations manually (Developer Checklist 8.2)

---

### 🤖 Task 8.4: Scaffold Common Components

**Goal:** Create RN versions of Layout, LoadingScreen, ComingSoon.

**File:** `src/components/Layout.tsx`
```typescript
import React from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="flex-1 pb-20">
        {children}
      </View>
    </SafeAreaView>
  );
}
```

**File:** `src/components/LoadingScreen.tsx`
```typescript
import React from 'react';
import { View, Text, ActivityIndicator } from 'react-native';

export default function LoadingScreen() {
  return (
    <View className="flex-1 bg-white items-center justify-center">
      <ActivityIndicator size="large" color="#ff3131" />
      <Text className="mt-4 text-gray-600">Loading...</Text>
    </View>
  );
}
```

---

## Phase 9️⃣: Native API Replacements

### 🤖 Task 9.1: Replace localStorage with AsyncStorage

**Goal:** Update all storage calls.

**Installation:** Already installed in Phase 3.1.

**Find and replace:**
```typescript
// BEFORE
localStorage.setItem('key', 'value');
const value = localStorage.getItem('key');
localStorage.removeItem('key');

// AFTER
import AsyncStorage from '@react-native-async-storage/async-storage';

await AsyncStorage.setItem('key', 'value');
const value = await AsyncStorage.getItem('key');
await AsyncStorage.removeItem('key');
```

**Search command:**
```bash
grep -r "localStorage\." src/ --include="*.ts" --include="*.tsx"
```

**Note:** All functions using localStorage become `async`.

**Handoff:** → Developer reviews affected functions (Developer Checklist 9.1)

---

### 🤖 Task 9.2: Implement expo-image-picker for Uploads

**Goal:** Replace file input with native image picker.

**Installation:**
```bash
npx expo install expo-image-picker
```

**Example migration:** `src/components/ReceiptUploadModal.tsx`
```typescript
// BEFORE (Web)
<input
  type="file"
  accept="image/*"
  onChange={(e) => {
    const file = e.target.files?.[0];
    if (file) handleUpload(file);
  }}
/>

// AFTER (React Native)
import * as ImagePicker from 'expo-image-picker';

const pickImage = async () => {
  // Request permission
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (status !== 'granted') {
    alert('Sorry, we need camera roll permissions!');
    return;
  }

  // Pick image
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsEditing: true,
    aspect: [4, 3],
    quality: 0.8,
  });

  if (!result.canceled) {
    handleUpload(result.assets[0].uri);
  }
};

<Pressable onPress={pickImage}>
  <Text>Upload Photo</Text>
</Pressable>
```

**Files to update:**
- `ReceiptUploadModal.tsx`
- `EditProfile.tsx` (avatar upload)
- Review creation wizard steps

---

### 🤖 Task 9.3: Update Firebase Storage Upload for RN

**Goal:** Handle URI uploads instead of Blob.

**New implementation:** `src/lib/firebaseStorage.ts`
```typescript
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from './firebase';
import * as FileSystem from 'expo-file-system';

export const uploadProfileImage = async (
  uri: string,
  userId: string
): Promise<{ success: boolean; url?: string; error?: string }> => {
  try {
    // Convert URI to blob
    const response = await fetch(uri);
    const blob = await response.blob();

    const timestamp = Date.now();
    const fileName = `profile-images/${userId}_${timestamp}.jpg`;
    const storageRef = ref(storage, fileName);

    const snapshot = await uploadBytes(storageRef, blob);
    const downloadURL = await getDownloadURL(snapshot.ref);

    return { success: true, url: downloadURL };
  } catch (error: any) {
    console.error('Upload failed:', error);
    return { success: false, error: error.message };
  }
};
```

**Installation:**
```bash
npx expo install expo-file-system
```

---

### 🤖 Task 9.4: Implement expo-sharing for Share Functionality

**Goal:** Replace Web Share API.

**Installation:**
```bash
npx expo install expo-sharing
```

**Implementation:**
```typescript
import * as Sharing from 'expo-sharing';

export const sharePost = async (postUrl: string) => {
  const isAvailable = await Sharing.isAvailableAsync();

  if (isAvailable) {
    await Sharing.shareAsync(postUrl, {
      dialogTitle: 'Share this post',
    });
  } else {
    // Fallback: copy to clipboard
    await Clipboard.setStringAsync(postUrl);
    alert('Link copied to clipboard!');
  }
};
```

---

### 🤖 Task 9.5: Migrate Google Maps to react-native-maps

**Goal:** Replace `@googlemaps/react-wrapper` with native maps.

**Installation:**
```bash
npx expo install react-native-maps
```

**Example migration:** `src/components/RestaurantMap.tsx`
```typescript
// BEFORE (Web)
import { GoogleMap, Marker } from '@googlemaps/react-wrapper';

<GoogleMap
  center={{ lat: 27.3364, lng: -82.5307 }}
  zoom={12}
>
  {restaurants.map(r => (
    <Marker
      key={r.id}
      position={{ lat: r.lat, lng: r.lng }}
      onClick={() => handleMarkerClick(r)}
    />
  ))}
</GoogleMap>

// AFTER (React Native)
import MapView, { Marker } from 'react-native-maps';

<MapView
  style={{ flex: 1 }}
  initialRegion={{
    latitude: 27.3364,
    longitude: -82.5307,
    latitudeDelta: 0.1,
    longitudeDelta: 0.1,
  }}
>
  {restaurants.map(r => (
    <Marker
      key={r.id}
      coordinate={{ latitude: r.lat, longitude: r.lng }}
      onPress={() => handleMarkerClick(r)}
      title={r.name}
    />
  ))}
</MapView>
```

**Note:** Major refactor required - different props, clustering, callouts.

**Handoff:** → Developer manually refactors map components (Developer Checklist 9.3)

---

## Phase 🔟: Testing Automation

### 🤖 Task 10.1: Create Test Script for Critical Flows

**Goal:** Document manual test checklist.

**File:** `TEST_CHECKLIST.md`
```markdown
# Manual Testing Checklist

## Auth Flow
- [ ] Email signup creates user
- [ ] Email login works
- [ ] Google Sign-In works (iOS)
- [ ] Google Sign-In works (Android)
- [ ] Logout clears session
- [ ] Username creation enforced

## Restaurant Discovery
- [ ] Search returns results
- [ ] Map markers display correctly
- [ ] Restaurant detail loads
- [ ] Menu items visible

## Review Creation
- [ ] Photo picker opens
- [ ] Image uploads to Storage
- [ ] Review saves to Firestore
- [ ] Post appears in feed

## Location Services
- [ ] Permission prompt appears
- [ ] Current location detected
- [ ] Nearby restaurants filtered

## Profile
- [ ] Avatar upload works
- [ ] Profile updates save
- [ ] Password change works
- [ ] Public profile loads

## Edge Cases
- [ ] Offline mode (Firestore cache)
- [ ] Slow network handling
- [ ] Permission denied gracefully
- [ ] Empty states render
```

---

### 🤖 Task 10.2: Generate Build Commands Cheat Sheet

**Goal:** Quick reference for common builds.

**File:** `BUILD_COMMANDS.md`
```markdown
# EAS Build Commands

## Development Builds
```bash
# iOS simulator
eas build -p ios --profile development

# Android emulator
eas build -p android --profile development

# Install on device
eas build -p ios --profile development
# Then: download .ipa and install via Xcode
```

## Preview Builds (Internal Testing)
```bash
# iOS (TestFlight)
eas build -p ios --profile preview

# Android (APK)
eas build -p android --profile preview
```

## Production Builds
```bash
# iOS App Store
eas build -p ios --profile production
eas submit -p ios

# Google Play Store
eas build -p android --profile production
eas submit -p android
```

## OTA Updates (After Published)
```bash
# Publish update to production channel
eas update --branch production --message "Fix critical bug"
```
```

---

## Phase 1️⃣1️⃣: Push Notifications Setup

### 🤖 Task 11.1: Install expo-notifications

**Commands:**
```bash
npx expo install expo-notifications expo-device expo-constants
```

---

### 🤖 Task 11.2: Create Push Token Registration Service

**File:** `src/services/pushNotifications.ts`
```typescript
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { doc, updateDoc } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export async function registerForPushNotificationsAsync() {
  let token;

  if (Device.isDevice) {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.warn('Failed to get push token for push notification!');
      return;
    }

    token = (await Notifications.getExpoPushTokenAsync({
      projectId: 'YOUR_EAS_PROJECT_ID', // From app.config.ts
    })).data;

    // Save token to Firestore user profile
    const user = auth.currentUser;
    if (user) {
      await updateDoc(doc(db, 'users', user.uid), {
        pushToken: token,
        pushTokenUpdatedAt: new Date(),
      });
    }
  } else {
    console.warn('Must use physical device for Push Notifications');
  }

  if (Platform.OS === 'android') {
    Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF3131',
    });
  }

  return token;
}
```

**Handoff:** → Developer adds APNs key and FCM credentials (Developer Checklist 11.1)

---

## Phase 1️⃣2️⃣: Final Polishing

### 🤖 Task 12.1: Add Sentry for Error Tracking

**Installation:**
```bash
npx expo install @sentry/react-native
```

**Configuration:** `app.config.ts`
```typescript
plugins: [
  // ... existing plugins
  [
    '@sentry/react-native/expo',
    {
      organization: 'your-org',
      project: 'tip-mobile',
    }
  ]
]
```

**Initialization:** `app/_layout.tsx`
```typescript
import * as Sentry from '@sentry/react-native';

Sentry.init({
  dsn: 'YOUR_SENTRY_DSN',
  enableInExpoDevelopment: false,
  debug: __DEV__,
});
```

**Handoff:** → Developer creates Sentry project and provides DSN (Developer Checklist 12.1)

---

### 🤖 Task 12.2: Add expo-font for Custom Fonts

**Installation:**
```bash
npx expo install expo-font
```

**Implementation:** `app/_layout.tsx`
```typescript
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    'Poppins-Regular': require('../assets/fonts/Poppins-Regular.ttf'),
    'Poppins-Bold': require('../assets/fonts/Poppins-Bold.ttf'),
    'KENT-Regular': require('../assets/fonts/KENT-Regular.ttf'),
  });

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  return (
    // ... rest of layout
  );
}
```

**Handoff:** → Developer provides font files (Developer Checklist 12.2)

---

## Blockers & Risks

### 🚨 Known Issues to Flag

1. **Firebase JS SDK Limitations:**
   - No native push notifications (use Expo or @react-native-firebase)
   - Firestore offline persistence = memory only (no disk cache)
   - Analytics doesn't work (need native module)

2. **Google Sign-In:**
   - Requires separate OAuth client IDs for iOS/Android/Web
   - Must configure SHA-1 fingerprints for Android

3. **Maps Complexity:**
   - `react-native-maps` API is very different from web
   - Clustering requires third-party library
   - iOS requires CocoaPods configuration

4. **Tailwind Coverage:**
   - ~30% of Tailwind utilities don't work in RN
   - Grid layouts need complete redesign
   - Backdrop effects unsupported

5. **EAS Build Times:**
   - iOS builds: 15-30 minutes
   - Android builds: 10-20 minutes
   - Plan for iteration delays

---

## Completion Checklist

- [ ] All Phase 3 scaffolding complete
- [ ] Firebase connects on device
- [ ] Auth flow works (email + Google)
- [ ] At least 5 core screens migrated
- [ ] Image uploads functional
- [ ] Maps display markers
- [ ] Location permissions work
- [ ] Development build runs on physical device
- [ ] EAS production build succeeds for iOS/Android
- [ ] App submitted to TestFlight/Play Console

---

## Support References

**Expo Docs:**
- https://docs.expo.dev/router/introduction/
- https://docs.expo.dev/build/introduction/
- https://docs.expo.dev/push-notifications/overview/

**Firebase RN Guide:**
- https://firebase.google.com/docs/web/setup (JS SDK)
- https://rnfirebase.io/ (Native modules alternative)

**NativeWind:**
- https://www.nativewind.dev/v4/overview

**React Native Maps:**
- https://github.com/react-native-maps/react-native-maps

---

**Document Version:** 1.0
**Last Updated:** 2025-10-17
**Maintained By:** AI Agent
