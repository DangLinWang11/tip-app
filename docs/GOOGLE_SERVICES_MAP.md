# Google Services & Firebase Configuration Map

> Last updated: 2026-01-06
>
> This document maps all Google Cloud Platform and Firebase configurations for the Tip PWA application.

---

## Table of Contents

1. [Firebase Project Configuration](#firebase-project-configuration)
2. [API Keys & Credentials](#api-keys--credentials)
3. [OAuth Configuration](#oauth-configuration)
4. [Android Configuration](#android-configuration)
5. [Domain & Hosting Setup](#domain--hosting-setup)
6. [Critical File Locations](#critical-file-locations)
7. [Security Checklist](#security-checklist)
8. [Setup Instructions](#setup-instructions)

---

## Firebase Project Configuration

### Project Details

| Property | Value |
|----------|-------|
| **Project ID** | `tip-sarasotav2` |
| **Auth Domain** | `tip-sarasotav2.firebaseapp.com` |
| **Storage Bucket** | `tip-sarasotav2.firebasestorage.app` |
| **Messaging Sender ID** | `279316450534` |
| **App ID** | `1:279316450534:web:6386a22fe38591ef84ff27` |
| **Measurement ID** | `G-9RQW6H7238` |

### Firebase Services Enabled

- ✅ Authentication (Email/Password + Google Sign-In)
- ✅ Cloud Firestore (Database)
- ✅ Cloud Storage (Media uploads)
- ✅ Analytics
- ✅ Hosting
- ⚠️ Cloud Functions (Check if deployed)

---

## API Keys & Credentials

### Firebase Web API Key

```
First 20 chars: AIzaSyBEzuZLNQo0SJ-z
Full key location: .env.local (VITE_FIREBASE_API_KEY)
```

**Purpose:** Client-side Firebase SDK initialization
**Exposure:** Safe to expose in client-side code (protected by Firebase Security Rules)

### Google Maps API Key

```
First 20 chars: AIzaSyCNPHw0kJAOEnel
Full key location: .env.local (VITE_GOOGLE_MAPS_API_KEY)
```

**Purpose:** Google Maps integration for restaurant locations
**Restrictions:** Should be restricted to specific domains/apps in Google Cloud Console

**⚠️ Important:** Verify API key restrictions in Google Cloud Console:
- Go to: https://console.cloud.google.com/apis/credentials
- Restrict to authorized domains only
- Enable only required APIs (Maps JavaScript API, Places API, Geocoding API)

---

## OAuth Configuration

### Google Sign-In

**Status:** ⚠️ Needs verification

**Required Setup:**

1. **Web OAuth Client**
   - Console: Firebase Console > Authentication > Sign-in method > Google
   - Authorized domains must include:
     - `localhost` (for development)
     - `tip-sarasotav2.firebaseapp.com`
     - `tip-sarasotav2.web.app`
     - Any custom domains

2. **Android OAuth Client**
   - **Status:** TODO: Add manually
   - Required for native Android Google Sign-In
   - Must be configured in Firebase Console with SHA-1 fingerprint

### Authorized Domains

Current authorized domains (verify in Firebase Console > Authentication > Settings):

- ✅ `localhost` (development)
- ✅ `tip-sarasotav2.firebaseapp.com` (default Firebase hosting)
- ✅ `tip-sarasotav2.web.app` (Firebase hosting)
- TODO: Add any custom domains here

---

## Android Configuration

### Capacitor App Configuration

| Property | Value |
|----------|-------|
| **App ID** | `com.tip.app` |
| **App Name** | `Tip` |
| **Package Name** | `com.tip.app` |

### Google Services Configuration

**File:** `android/app/google-services.json`

**Status:** ❌ Not found (must be added manually)

**Download from:**
1. Go to: https://console.firebase.google.com/project/tip-sarasotav2/settings/general
2. Scroll to "Your apps" section
3. Click on Android app (or add one if not exists)
4. Download `google-services.json`
5. Place in: `android/app/google-services.json`

**⚠️ Security:** This file is (and should remain) in `.gitignore`

### SHA-1 Fingerprints

**Status:** TODO: Add manually

**Required for:**
- Google Sign-In on Android
- Firebase App Check
- Firebase Dynamic Links

**How to generate:**

```bash
# Debug keystore (for development)
keytool -list -v -keystore ~/.android/debug.keystore -alias androiddebugkey -storepass android -keypass android

# Release keystore (for production)
keytool -list -v -keystore /path/to/your-release-key.keystore -alias your-key-alias
```

**Where to add:**
1. Copy the SHA-1 fingerprint from the output
2. Go to: Firebase Console > Project Settings > Your apps > Android app
3. Add SHA-1 fingerprint

**TODO:** Document SHA-1 fingerprints here once generated:
- Debug SHA-1: `TODO: Add after running keytool command`
- Release SHA-1: `TODO: Add after generating release keystore`

---

## Domain & Hosting Setup

### Firebase Hosting

**Status:** ✅ Configured

**Configuration:** `firebase.json`

```json
{
  "hosting": {
    "public": "dist",
    "rewrites": [
      {
        "source": "**",
        "destination": "/index.html"
      }
    ]
  }
}
```

**Default URLs:**
- https://tip-sarasotav2.web.app
- https://tip-sarasotav2.firebaseapp.com

**Custom Domain:** TODO: Add if configured

**Deployment:**
```bash
npm run build
firebase deploy --only hosting
```

### Authorized Domains for Authentication

**Where to configure:** Firebase Console > Authentication > Settings > Authorized domains

**Required domains:**
- `localhost` (development)
- `tip-sarasotav2.firebaseapp.com`
- `tip-sarasotav2.web.app`
- TODO: Add custom domains

---

## Critical File Locations

### Configuration Files

| File | Path | Version Control | Purpose |
|------|------|-----------------|---------|
| **Firebase Config** | `src/lib/firebase.ts` | ✅ Committed | Firebase initialization |
| **Environment Variables** | `.env.local` | ❌ Gitignored | API keys and secrets |
| **Environment Template** | `.env.example` | ✅ Committed | Template for new devs |
| **Capacitor Config** | `capacitor.config.ts` | ✅ Committed | Mobile app settings |
| **Google Services (Android)** | `android/app/google-services.json` | ❌ Gitignored | Android Firebase config |
| **Firebase Hosting** | `firebase.json` | ✅ Committed | Hosting configuration |
| **Firebase Project** | `.firebaserc` | ✅ Committed | Active Firebase project |
| **Package Config** | `package.json` | ✅ Committed | Dependencies |

### Environment Variables

**File:** `.env.local` (create from `.env.example`)

```bash
# Firebase Configuration
VITE_FIREBASE_API_KEY=AIzaSyBEzuZLNQo0SJ-zfq6IsBPbYKFj6NV6sAM
VITE_FIREBASE_AUTH_DOMAIN=tip-sarasotav2.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=tip-sarasotav2
VITE_FIREBASE_STORAGE_BUCKET=tip-sarasotav2.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=279316450534
VITE_FIREBASE_APP_ID=1:279316450534:web:6386a22fe38591ef84ff27
VITE_FIREBASE_MEASUREMENT_ID=G-9RQW6H7238

# Google Maps
VITE_GOOGLE_MAPS_API_KEY=AIzaSyCNPHw0kJAOEnel8UoYDhkTW4lBsCvaOJI

# Development
VITE_USE_EMULATORS=false
```

**Total Environment Variables:** 9

---

## Security Checklist

### ✅ Completed

- [x] API keys stored in environment variables (not hardcoded)
- [x] `.env.local` is in `.gitignore`
- [x] Firebase config uses `import.meta.env` variables
- [x] Capacitor app ID uses reverse domain notation
- [x] Firebase hosting configured with SPA rewrites

### ⚠️ Needs Attention

- [ ] **CRITICAL:** Private key found in `functions/serviceAccountKey.json` - Should be gitignored!
- [ ] `google-services.json` should be added to `android/app/.gitignore`
- [ ] Google Maps API key should be restricted in Google Cloud Console
- [ ] Firebase API key restrictions should be verified

### 📋 TODO

- [ ] Add `google-services.json` to `android/app/` directory
- [ ] Generate and add SHA-1 fingerprints to Firebase Console
- [ ] Configure OAuth client for Android in Firebase Console
- [ ] Document SHA-1 fingerprints in this file
- [ ] Verify authorized domains in Firebase Authentication settings
- [ ] Set up Firebase App Check for additional security
- [ ] Configure Google Maps API key restrictions
- [ ] Create `.env.production` for production builds

---

## Setup Instructions

### For New Developers

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd tip
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env.local
   # Edit .env.local with actual values (ask team lead)
   ```

4. **Download google-services.json** (Android only)
   - Get from Firebase Console or team lead
   - Place in `android/app/google-services.json`

5. **Run development server**
   ```bash
   npm run dev
   ```

### For Production Deployment

1. **Build the application**
   ```bash
   npm run build
   ```

2. **Deploy to Firebase Hosting**
   ```bash
   firebase deploy --only hosting
   ```

3. **For Android release**
   - Generate release keystore
   - Get SHA-1 fingerprint
   - Add to Firebase Console
   - Build release APK/AAB

---

## Audit Scripts

Two scripts are available to audit the configuration:

### 1. Configuration Audit
```bash
node scripts/audit-config.js
```

**Reports:**
- Firebase project details
- Google Maps API key
- Capacitor installation
- Environment files
- Environment variables

### 2. Firebase Setup Check
```bash
node scripts/check-firebase-setup.js
```

**Reports:**
- Authorized domains
- SHA-1 fingerprints
- Hardcoded secrets scan
- google-services.json status
- Capacitor config validation
- Firebase hosting setup

---

## Common Issues & Solutions

### Issue: Google Sign-In not working on Android

**Solution:**
1. Ensure `google-services.json` is in `android/app/`
2. Verify SHA-1 fingerprint is added to Firebase Console
3. Check OAuth client is configured for Android
4. Rebuild the app after adding `google-services.json`

### Issue: "API key not valid" error

**Solution:**
1. Verify API key in `.env.local` matches Firebase Console
2. Check API key restrictions in Google Cloud Console
3. Ensure required APIs are enabled (Maps, Places, Geocoding)

### Issue: Authentication domain not authorized

**Solution:**
1. Go to Firebase Console > Authentication > Settings > Authorized domains
2. Add your domain (e.g., `localhost`, custom domain)
3. Wait a few minutes for changes to propagate

---

## Additional Resources

- [Firebase Console](https://console.firebase.google.com/project/tip-sarasotav2)
- [Google Cloud Console](https://console.cloud.google.com/)
- [Capacitor Documentation](https://capacitorjs.com/docs)
- [Firebase Authentication Docs](https://firebase.google.com/docs/auth)
- [Google Maps Platform](https://console.cloud.google.com/google/maps-apis)

---

## Contacts

**Project Lead:** TODO: Add contact
**Firebase Admin:** TODO: Add contact
**DevOps:** TODO: Add contact

---

*This document is auto-generated using audit scripts and should be updated whenever configuration changes.*
