# Capacitor Code Locations - Quick Reference

> **Quick reference table of all Capacitor-specific code in the codebase**
>
> **Date:** 2026-01-06

---

## Capacitor Imports

| File | Line | Code | Purpose | PWA Risk |
|------|------|------|---------|----------|
| [src/lib/firebase.ts](../src/lib/firebase.ts#L5) | 5 | `import { Capacitor } from '@capacitor/core'` | Platform detection | ✅ Safe |
| [src/lib/firebase.ts](../src/lib/firebase.ts#L6) | 6 | `import { GoogleAuth } from '@codetrix-studio/capacitor-google-auth'` | Google Sign-In (native) | ⚠️ Conditional use |
| [src/index.tsx](../src/index.tsx#L5) | 5 | `import { GoogleAuth } from '@codetrix-studio/capacitor-google-auth'` | Google Auth init | 🔴 Unconditional init |

---

## Platform Detection Code

| File | Line | Code | Purpose | PWA Safe? |
|------|------|------|---------|-----------|
| [src/lib/firebase.ts](../src/lib/firebase.ts#L268) | 268 | `const isNativePlatform = Capacitor.isNativePlatform()` | Detect native vs web | ✅ Yes |
| [src/lib/firebase.ts](../src/lib/firebase.ts#L270) | 270 | `if (isNativePlatform) { ... } else { ... }` | Branch for native/web auth | ✅ Yes |

---

## GoogleAuth Usage

| File | Line | Code | Purpose | PWA Impact |
|------|------|------|---------|------------|
| [src/index.tsx](../src/index.tsx#L43) | 43-47 | `GoogleAuth.initialize({ clientId: '...' })` | Initialize plugin | 🔴 **Needs platform check** |
| [src/lib/firebase.ts](../src/lib/firebase.ts#L272) | 272 | `const googleUser = await GoogleAuth.signIn()` | Native sign-in | ✅ Only called on native |

---

## User Agent Detection (Not Capacitor)

| File | Line | Code | Purpose | PWA Safe? |
|------|------|------|---------|-----------|
| [src/components/LocationDeniedMessage.tsx](../src/components/LocationDeniedMessage.tsx#L14) | 14 | `/iPad\|iPhone\|iPod/.test(navigator.userAgent)` | Detect iOS for instructions | ✅ Yes |

---

## Geolocation API (Standard Web API)

| File | Line | Code | Notes |
|------|------|------|-------|
| [src/contexts/LocationContext.tsx](../src/contexts/LocationContext.tsx#L61) | 61 | `navigator.geolocation` check | ✅ Standard browser API |
| [src/contexts/LocationContext.tsx](../src/contexts/LocationContext.tsx#L87) | 87 | `new Promise<GeolocationPosition>` | ✅ Browser geolocation |
| [src/pages/Discover.tsx](../src/pages/Discover.tsx#L157) | 157 | Geolocation not supported check | ✅ Browser API |
| [src/components/LocationPickerModal.tsx](../src/components/LocationPickerModal.tsx#L165) | 165 | Geolocation not supported alert | ✅ Browser API |
| [src/components/RestaurantMap.tsx](../src/components/RestaurantMap.tsx#L456) | 456 | Geolocation error handling | ✅ Browser API |
| [src/components/reviews/Step1Basic.tsx](../src/components/reviews/Step1Basic.tsx#L83) | 83 | Geolocation not supported | ✅ Browser API |
| [src/components/reviews/StepVisit.tsx](../src/components/reviews/StepVisit.tsx#L150) | 150 | Geolocation not supported | ✅ Browser API |

---

## Camera/Photo Upload (HTML File Input)

| File | Line | Component | Implementation | PWA Safe? |
|------|------|-----------|----------------|-----------|
| [src/components/reviews/Step1Basic.tsx](../src/components/reviews/Step1Basic.tsx#L446) | 446 | Photo upload | `<input type="file" accept="image/*">` | ✅ Yes |
| [src/components/reviews/StepVisit.tsx](../src/components/reviews/StepVisit.tsx#L440) | 440 | Photo upload | `<input type="file" accept="image/*">` | ✅ Yes |
| [src/components/reviews/StepDishes.tsx](../src/components/reviews/StepDishes.tsx#L272) | 272 | Photo upload | `<input type="file">` | ✅ Yes |
| [src/components/ReceiptUploadModal.tsx](../src/components/ReceiptUploadModal.tsx#L41) | 41-111 | Camera/upload modal | HTML file input | ✅ Yes |
| [src/pages/Onboarding.tsx](../src/pages/Onboarding.tsx#L569) | 569 | Avatar upload | HTML file input | ✅ Yes |
| [src/pages/EditProfile.tsx](../src/pages/EditProfile.tsx#L426) | 426 | Profile photo | HTML file input | ✅ Yes |

---

## Firebase Storage (Not Capacitor)

| File | Line | Function | Purpose | PWA Safe? |
|------|------|----------|---------|-----------|
| [src/lib/firebase.ts](../src/lib/firebase.ts#L71) | 71-79 | Storage initialization | Firebase Cloud Storage | ✅ Yes |
| [src/lib/firebase.ts](../src/lib/firebase.ts#L699) | 699-761 | `uploadProfileImage` | Upload to Firebase Storage | ✅ Yes |
| [src/lib/media.ts](../src/lib/media.ts#L172) | 172-206 | Upload functions | Media upload to Storage | ✅ Yes |
| [src/services/claimsService.ts](../src/services/claimsService.ts#L60) | 60 | Receipt upload | Firebase Storage ref | ✅ Yes |

---

## localStorage Usage (Standard Web API)

| File | Lines | Purpose | PWA Safe? |
|------|-------|---------|-----------|
| [src/index.tsx](../src/index.tsx#L12-40) | 12-40 | Cache clearing on version change | ✅ Yes |
| [src/contexts/LocationContext.tsx](../src/contexts/LocationContext.tsx#L41-56) | 41-56 | Location permission tracking | ✅ Yes |
| [src/utils/locationStore.ts](../src/utils/locationStore.ts#L23-56) | 23-56 | Location persistence | ✅ Yes |
| [src/lib/i18n/useI18n.ts](../src/lib/i18n/useI18n.ts#L49-66) | 49-66 | Language preference | ✅ Yes |
| [src/components/reviews/Wizard.tsx](../src/components/reviews/Wizard.tsx#L279-554) | 279-554 | Draft review persistence | ✅ Yes |

---

## IndexedDB (Firebase Firestore)

| File | Line | Code | Purpose | PWA Safe? |
|------|------|------|---------|-----------|
| [src/lib/firebase.ts](../src/lib/firebase.ts#L59) | 59 | `enableIndexedDbPersistence(db)` | Offline Firestore | ✅ Yes |

---

## Summary Statistics

### Capacitor-Specific Code

| Category | Count | PWA Risk Level |
|----------|-------|----------------|
| **Capacitor Imports** | 3 | ⚠️ Medium (1 needs fix) |
| **Platform Detection** | 2 | ✅ Safe |
| **GoogleAuth Calls** | 2 | 🔴 1 needs conditional init |

### Standard Web APIs (Not Capacitor)

| Category | Count | PWA Compatible? |
|----------|-------|-----------------|
| **Geolocation API** | 7 | ✅ 100% |
| **File Input (Camera)** | 6 | ✅ 100% |
| **localStorage** | 5+ files | ✅ 100% |
| **IndexedDB** | 1 | ✅ 100% |
| **Firebase Storage** | 4 | ✅ 100% |

---

## Critical Fix Required

### 🔴 src/index.tsx Line 43-47

**Current Code:**
```typescript
GoogleAuth.initialize({
  clientId: '279316450534-fo43car2agmbd1p4uujgsoqegkjkb9b6.apps.googleusercontent.com',
  scopes: ['profile', 'email'],
  grantOfflineAccess: true,
});
```

**Required Fix:**
```typescript
import { Capacitor } from '@capacitor/core';

if (Capacitor.isNativePlatform()) {
  GoogleAuth.initialize({
    clientId: '279316450534-fo43car2agmbd1p4uujgsoqegkjkb9b6.apps.googleusercontent.com',
    scopes: ['profile', 'email'],
    grantOfflineAccess: true,
  });
}
```

---

## Capacitor Plugins Used

| Plugin | Package | Used? | PWA Alternative |
|--------|---------|-------|-----------------|
| Core | `@capacitor/core` | ✅ Yes | N/A (platform detection) |
| GoogleAuth | `@codetrix-studio/capacitor-google-auth` | ✅ Yes | Firebase popup auth |
| Camera | `@capacitor/camera` | ❌ No | `<input type="file">` |
| Filesystem | `@capacitor/filesystem` | ❌ No | File API / Firebase Storage |
| Geolocation | `@capacitor/geolocation` | ❌ No | `navigator.geolocation` |
| Storage | `@capacitor/storage` | ❌ No | `localStorage` / IndexedDB |

**Analysis:** Only 2 Capacitor packages actively used, and only GoogleAuth needs attention for PWA compatibility.

---

## Quick Assessment

### What Works on PWA? ✅

- Email/Password authentication
- Google Sign-In (via Firebase popup)
- Photo/video uploads
- Geolocation
- Offline mode
- Local storage
- All Firebase features

### What Needs Testing? ⚠️

- Google Sign-In initialization on web
- No console errors on web build
- Bundle size impact

### What Needs Fixing? 🔴

- GoogleAuth.initialize() must be conditional

---

## Related Documents

- [CAPACITOR_CODE_AUDIT.md](./CAPACITOR_CODE_AUDIT.md) - Full analysis and recommendations
- [GOOGLE_SERVICES_MAP.md](./GOOGLE_SERVICES_MAP.md) - Configuration reference

---

**Last Updated:** 2026-01-06
