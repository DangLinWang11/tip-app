# 🧑‍💻 Expo Migration — Developer Checklist

**Project:** Tip PWA → Expo Native App
**Audience:** Developer manual tasks
**Last Updated:** 2025-10-17

---

## Overview

This document contains all tasks that **require manual intervention** during the Expo migration. Each task is organized by phase and includes what you need to do, why it matters, and what to hand back to the AI agent.

---

## Phase 1️⃣: Pre-Migration Decisions

### 🧑‍💻 Task 1.1: Confirm What Stays

**What to do:**
- Review `/src/services` directory
- Confirm all Firebase Auth/Firestore/Storage logic stays intact
- Identify any services with hard web dependencies

**Deliverable:** List of services that need refactoring (if any).

**Why it matters:** Ensures we don't break core business logic during migration.

---

### 🧑‍💻 Task 1.2: Choose Auth Strategy

**Critical Decision:** Your current code uses `signInWithPopup(GoogleAuthProvider)` which **does not work on React Native**.

**Options:**

**Option A: Hybrid JS SDK + Native Google Sign-In**
- ✅ Keep Firebase JS SDK for Auth/Firestore
- ✅ Only replace Google popup with `@react-native-google-signin`
- ✅ Faster migration
- ❌ Limited to features JS SDK supports on mobile

**Option B: Migrate to @react-native-firebase**
- ✅ Full native integration (better performance)
- ✅ Native push notifications, analytics
- ✅ Offline persistence to disk
- ❌ Requires rewriting all Firebase service layer
- ❌ 2-3 week migration timeline

**Recommendation:** Start with **Option A** for MVP, migrate to Option B later if needed.

**Action Required:**
```markdown
I choose: [ ] Option A (Hybrid) [ ] Option B (Native)
```

**Handoff to Agent:** Share your decision so agent knows which auth implementation to scaffold.

---

### 🧑‍💻 Task 1.3: Review Third-Party Package Migration

**What to do:**
Review the agent's package migration mapping and approve:

| Current | Replacement | Approved? |
|---------|-------------|-----------|
| `@googlemaps/react-wrapper` | `react-native-maps` | [ ] |
| `framer-motion` | `moti` + `reanimated` | [ ] |
| `react-router-dom` | `expo-router` | [ ] |
| `vite` | `expo` / `metro` | [ ] |

**Note any concerns:** ___________________________

**Handoff:** Approve or flag issues with agent.

---

### 🧑‍💻 Task 1.4: Decide on UI Component Library (Optional)

**Question:** Do you want to use a pre-built UI kit, or stick with custom components + NativeWind?

**Options:**
- **Custom (NativeWind only):** More control, matches existing design
- **React Native Paper:** Material Design, good components
- **NativeBase:** Large component library
- **Tamagui:** High performance, web + native

**Recommendation:** Start with **custom + NativeWind** since you already have Tailwind classes.

**Action:**
```markdown
I want to use: [ ] NativeWind only [ ] React Native Paper [ ] Other: ________
```

---

## Phase 2️⃣: Repo Cleanup

### 🧑‍💻 Task 2.1: Backup Current PWA

**What to do:**
```bash
cd "C:\Users\djdav\Tip Development"
cp -r tip tip-pwa-backup
```

**Why:** Safety net in case you need to reference original code.

**Verification:** Confirm backup exists before proceeding.

---

### 🧑‍💻 Task 2.2: Review Browser API Usage Report

**What to do:**
- Agent will provide report of all `window`, `document`, `localStorage`, `navigator` usage
- Review each file and prioritize:
  - **Critical** (blocks app): Auth, storage, location
  - **Medium** (degrades UX): Share, clipboard
  - **Low** (nice-to-have): Analytics, service workers

**Action:** Mark priority levels in the report.

**Handoff:** Send prioritized list back to agent.

---

### 🧑‍💻 Task 2.3: Review Tailwind Incompatibility Report

**What to do:**
- Agent will flag all `fixed`, `sticky`, `grid`, `backdrop-*` usage
- For each file, decide:
  - **Refactor to flex:** Most layouts can convert
  - **Use absolute positioning:** For fixed headers/footers
  - **Use ScrollView:** For scrollable containers
  - **Redesign:** For complex grid layouts

**Example decisions:**
```markdown
- src/components/BottomNavigation.tsx: fixed → absolute ✅
- src/pages/Discover.tsx: grid → flex column ✅
- src/components/Modal.tsx: backdrop-blur → solid overlay ✅
```

**Handoff:** Approve refactor strategy per file.

---

### 🧑‍💻 Task 2.4: Enable ESLint Rules

**What to do:**
After agent adds ESLint rules forbidding DOM usage:
```bash
npm run lint
```

Review errors and confirm they're expected (all should be in files marked for migration).

**Fix any false positives:** Update `.eslintrc.json` to exclude vendor files.

---

## Phase 3️⃣: Expo App Creation

### 🧑‍💻 Task 3.1: Verify Expo CLI Installation

**Prerequisites:**
```bash
node --version  # Should be 18+ or 20+
npm --version   # Should be 9+

# Install/update Expo CLI globally
npm install -g eas-cli

# Verify
eas --version
```

**Expected output:** `eas-cli/X.X.X`

---

### 🧑‍💻 Task 3.2: Test Local Development Server

**What to do:**
After agent scaffolds project:
```bash
cd "C:\Users\djdav\Tip Development\tip-mobile"
npx expo start
```

**Expected:**
- Metro bundler starts
- QR code appears
- Press `i` for iOS simulator or `a` for Android emulator

**Verify:**
- [ ] App opens in Expo Go
- [ ] No build errors
- [ ] Basic navigation works

**Troubleshooting:**
- **"Expo Go not installed"**: Download from App Store / Play Store
- **"Cannot connect to Metro"**: Check firewall, try `npx expo start --tunnel`
- **"Module not found"**: Run `npm install` again

---

### 🧑‍💻 Task 3.3: Review Route Structure

**What to do:**
Agent will create file-based routing structure. Review:
```
app/
  (tabs)/
    index.tsx        → Home feed (was /)
    discover.tsx     → Discover (was /discover)
    create.tsx       → Create review (was /create)
    map.tsx          → Food map (was /food-map)
    profile.tsx      → Profile (was /profile)
```

**Questions to answer:**
- Do all your main screens have routes? [ ] Yes [ ] No
- Any routes missing? List: ___________________________
- Any routes that shouldn't be tabs? List: ___________________________

**Handoff:** Approve or request changes.

---

## Phase 4️⃣: EAS & App Store Setup

### 🧑‍💻 Task 4.1: Create Expo Account & EAS Project

**What to do:**
```bash
# Sign up at expo.dev if needed
eas login

# Initialize EAS project
cd tip-mobile
eas init --id com.tipapp.sarasota
```

**Output:** You'll get an EAS Project ID (UUID). **Save this!**

**Action:** Provide project ID to agent for `app.config.ts`.

---

### 🧑‍💻 Task 4.2: Apple Developer Account Setup

**Requirements:**
- **Cost:** $99/year
- **Timeline:** Can take 24-48 hours for approval

**Steps:**
1. Go to https://developer.apple.com/programs/enroll/
2. Enroll as Individual or Organization
3. Complete payment
4. Wait for confirmation email

**Once approved:**
- Log in to https://developer.apple.com/account
- Note your **Team ID** (found in Membership section)
- Create **App ID**: `com.tipapp.sarasota`

**Deliverables:**
```markdown
Apple Team ID: __________________
App ID: com.tipapp.sarasota
Bundle Identifier: com.tipapp.sarasota
```

**Handoff:** Provide Team ID to agent for `eas.json`.

---

### 🧑‍💻 Task 4.3: Google Play Console Setup

**Requirements:**
- **Cost:** $25 one-time
- **Timeline:** Account approval can take days

**Steps:**
1. Go to https://play.google.com/console/signup
2. Pay $25 registration fee
3. Complete developer profile
4. Create new app: "Tip"

**App Configuration:**
- **Package name:** `com.tipapp.sarasota`
- **Default language:** English (US)
- **App category:** Food & Drink
- **Privacy policy URL:** (You must provide this)

**Deliverables:**
```markdown
Play Console Account Email: __________________
Package Name: com.tipapp.sarasota
```

---

### 🧑‍💻 Task 4.4: Create App Icons & Splash Screen

**Requirements:**

**Icon (required):**
- **Size:** 1024×1024 px
- **Format:** PNG, no transparency
- **Design:** Your app logo/branding
- **File name:** `icon.png`

**Adaptive Icon (Android, optional but recommended):**
- **Size:** 1024×1024 px
- **Safe zone:** Keep important content in center 768×768 px circle
- **File name:** `adaptive-icon.png`

**Splash Screen (required):**
- **Size:** 1284×2778 px (iPhone 14 Pro Max portrait)
- **Format:** PNG
- **Design:** Logo centered, plain background
- **File name:** `splash.png`

**Where to put them:**
```
tip-mobile/
  assets/
    icon.png
    adaptive-icon.png
    splash.png
```

**Design tips:**
- Use your existing brand colors (#ff3131 red, #029094 teal)
- Keep it simple - complex icons don't scale well
- Test how it looks at small sizes (60px)

**Handoff:** Place files in `assets/` and notify agent.

---

## Phase 5️⃣: Environment & Secrets

### 🧑‍💻 Task 5.1: Create Environment Variables

**What to do:**
Agent will provide `.env.example`. Copy it:
```bash
cd tip-mobile
cp .env.example .env
```

**Fill in values from your current PWA:**
```bash
# Copy from tip/src/lib/firebase.ts
EXPO_PUBLIC_FIREBASE_API_KEY=AIzaSyBEzuZLNQo0SJ-zfq6IsBPbYKFj6NV6sAM
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=tip-sarasotav2.firebaseapp.com
EXPO_PUBLIC_FIREBASE_PROJECT_ID=tip-sarasotav2
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=tip-sarasotav2.firebasestorage.app
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=279316450534
EXPO_PUBLIC_FIREBASE_APP_ID=1:279316450534:web:6386a22fe38591ef84ff27
EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID=G-9RQW6H7238

# Google Maps (you'll create these in 5.2)
EXPO_PUBLIC_GOOGLE_MAPS_IOS_KEY=
EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_KEY=
```

**Security note:** `.env` is gitignored by default. Never commit secrets!

---

### 🧑‍💻 Task 5.2: Create Google Maps API Keys

**Why separate keys?** iOS and Android require different configurations.

**Steps:**
1. Go to https://console.cloud.google.com/
2. Select project `tip-sarasotav2` (or create new)
3. Enable APIs:
   - ✅ Maps SDK for Android
   - ✅ Maps SDK for iOS
4. Create credentials:

**For iOS:**
```
Credentials → Create Credentials → API Key
Name: "Tip iOS Maps"
Restrictions: iOS apps
Bundle ID: com.tipapp.sarasota
```

**For Android:**
```
Credentials → Create Credentials → API Key
Name: "Tip Android Maps"
Restrictions: Android apps
Package name: com.tipapp.sarasota
SHA-1: (Get from EAS build logs - see Task 5.3)
```

**Save keys to `.env`:**
```bash
EXPO_PUBLIC_GOOGLE_MAPS_IOS_KEY=AIza...
EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_KEY=AIza...
```

---

### 🧑‍💻 Task 5.3: Get Android SHA-1 Fingerprint

**What is this?** Android requires your app's signing certificate fingerprint for Google services.

**How to get it:**
```bash
# Run a development build
eas build -p android --profile development

# Wait for build to complete, then view credentials
eas credentials
```

**Navigate:**
```
Select platform: Android
Select app: com.tipapp.sarasota
View keystore
```

**Copy the SHA-1 fingerprint** (looks like `A1:B2:C3:...`)

**Add to Google Cloud Console:**
- Go to API Credentials → Edit Android key
- Add SHA-1 fingerprint

**Also add to Firebase:**
- Firebase Console → Project Settings → Your apps → Android app
- Add SHA-1 under "SHA certificate fingerprints"

---

### 🧑‍💻 Task 5.4: Store Secrets in EAS

**Why?** Production builds can't access local `.env` files.

**What to do:**
```bash
# Set Firebase secrets
eas secret:create --scope project --name EXPO_PUBLIC_FIREBASE_API_KEY --value "AIzaSyBEzuZLNQo0SJ-zfq6IsBPbYKFj6NV6sAM"

eas secret:create --scope project --name EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN --value "tip-sarasotav2.firebaseapp.com"

eas secret:create --scope project --name EXPO_PUBLIC_FIREBASE_PROJECT_ID --value "tip-sarasotav2"

# ... repeat for all EXPO_PUBLIC_* variables

# Set Maps keys
eas secret:create --scope project --name EXPO_PUBLIC_GOOGLE_MAPS_IOS_KEY --value "YOUR_IOS_KEY"

eas secret:create --scope project --name EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_KEY --value "YOUR_ANDROID_KEY"
```

**Verify:**
```bash
eas secret:list
```

**Expected:** All secrets listed.

---

## Phase 6️⃣: Firebase Configuration

### 🧑‍💻 Task 6.1: Add iOS App to Firebase

**What to do:**
1. Go to https://console.firebase.google.com/
2. Select `tip-sarasotav2` project
3. Click "Add app" → iOS

**Configuration:**
- **iOS bundle ID:** `com.tipapp.sarasota`
- **App nickname:** Tip iOS
- **App Store ID:** (leave blank for now)

**Download `GoogleService-Info.plist`**

**Where to put it:**
```bash
# DO NOT put in version control
# Store locally: tip-mobile/GoogleService-Info.plist
```

**Add to EAS:**
```bash
eas secret:create --scope project --name GOOGLE_SERVICES_IOS --type file --value ./GoogleService-Info.plist
```

**Update `app.config.ts`:**
Agent will add plugin configuration - verify it includes:
```typescript
plugins: [
  [
    'expo-build-properties',
    {
      ios: {
        useFrameworks: 'static',
        googleServicesFile: process.env.GOOGLE_SERVICES_IOS
      }
    }
  ]
]
```

---

### 🧑‍💻 Task 6.2: Add Android App to Firebase

**What to do:**
1. Firebase Console → Add app → Android

**Configuration:**
- **Package name:** `com.tipapp.sarasota`
- **App nickname:** Tip Android
- **SHA-1:** (from Task 5.3)

**Download `google-services.json`**

**Where to put it:**
```bash
# Store locally: tip-mobile/google-services.json
```

**Add to EAS:**
```bash
eas secret:create --scope project --name GOOGLE_SERVICES_ANDROID --type file --value ./google-services.json
```

**Update `app.config.ts`:**
```typescript
plugins: [
  [
    'expo-build-properties',
    {
      android: {
        googleServicesFile: process.env.GOOGLE_SERVICES_ANDROID
      }
    }
  ]
]
```

---

### 🧑‍💻 Task 6.3: Configure OAuth for Google Sign-In

**Critical:** Web popup sign-in doesn't work on mobile.

**What to do:**

**Step 1: Get Web Client ID**
- Firebase Console → Authentication → Sign-in method → Google
- Expand "Web SDK configuration"
- Copy **Web client ID** (looks like `123456-abcdef.apps.googleusercontent.com`)

**Step 2: Get iOS Client ID (if using native sign-in)**
- Download your `GoogleService-Info.plist`
- Find `CLIENT_ID` value

**Step 3: Add to environment**
```bash
# .env
EXPO_PUBLIC_FIREBASE_WEB_CLIENT_ID=123456-abcdef.apps.googleusercontent.com
EXPO_PUBLIC_FIREBASE_IOS_CLIENT_ID=123456-xyz.apps.googleusercontent.com

# EAS secrets
eas secret:create --scope project --name EXPO_PUBLIC_FIREBASE_WEB_CLIENT_ID --value "..."
eas secret:create --scope project --name EXPO_PUBLIC_FIREBASE_IOS_CLIENT_ID --value "..."
```

**Step 4: Test on device**
After agent implements Google Sign-In:
```bash
npx expo start
# Test on physical device (doesn't work in simulator)
```

**Verify:**
- [ ] Google Sign-In button appears
- [ ] Tap opens native Google account picker
- [ ] Selecting account signs you in
- [ ] User created in Firestore

---

### 🧑‍💻 Task 6.4: Test Firebase Connection

**What to do:**
After agent migrates Firebase setup:
```bash
npx expo start
```

**Test checklist:**
- [ ] App starts without Firebase errors
- [ ] Auth state listener works
- [ ] Can create new account (email/password)
- [ ] Can sign in with existing account
- [ ] Firestore reads work (load profile)
- [ ] Firestore writes work (update profile)
- [ ] Storage upload works (change avatar)

**Check logs:**
```
✅ Firebase app initialized
✅ Firebase Auth initialized
✅ Firestore initialized
✅ Storage initialized
```

**Troubleshooting:**
- **"Firebase not initialized"**: Check `Constants.expoConfig.extra` values
- **"Permission denied"**: Check Firestore security rules
- **"Storage upload failed"**: Check Storage CORS and security rules

---

## Phase 7️⃣: Routing Migration

### 🧑‍💻 Task 7.1: Review Generated Routes

**What to do:**
Agent will create all route files. Manually verify:

**Check tab navigation works:**
```bash
npx expo start
# In app: tap each bottom tab
```

**Expected:**
- [ ] Home tab loads
- [ ] Discover tab loads
- [ ] Create tab loads
- [ ] Map tab loads
- [ ] Profile tab loads

**Check deep linking:**
```bash
# iOS simulator
xcrun simctl openurl booted tip://restaurant/abc123

# Android emulator
adb shell am start -W -a android.intent.action.VIEW -d "tip://restaurant/abc123"
```

**Expected:** Restaurant detail screen opens.

---

### 🧑‍💻 Task 7.2: Verify Navigation Logic

**What to do:**
Test all navigation flows from original PWA:

**Critical flows:**
```markdown
1. Home → Restaurant Detail → Menu → Back to Home
2. Discover → Restaurant → Save to List → Back
3. Create Review → Upload Photo → Submit → View in Feed
4. Profile → Edit → Change Password → Save
5. Notifications → Post Detail → User Profile
```

**Known differences:**
- Web: Browser back button
- Mobile: Gesture swipe back (iOS), header back button

**Test on iOS:**
- [ ] Swipe from left edge goes back
- [ ] Header back button works
- [ ] Tab bar persists correctly

**Test on Android:**
- [ ] Android back button works
- [ ] Hardware back exits app from root screen

---

### 🧑‍💻 Task 7.3: Handle Onboarding Flow

**Decision required:** Should onboarding be:
- **Option A:** Full-screen modal that blocks app (recommended)
- **Option B:** Separate stack navigator

**Current behavior (PWA):**
```typescript
// App.tsx shows onboarding if not authenticated
if (!authState.isAuthenticated || authState.needsUsername) {
  return <Onboarding />;
}
```

**Expo Router approach:**
```typescript
// app/index.tsx
export default function Index() {
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    if (!isAuthenticated) {
      router.replace('/onboarding');
    } else {
      router.replace('/(tabs)');
    }
  }, [isAuthenticated]);

  return <LoadingScreen />;
}
```

**Action:** Review agent's implementation and test auth flow.

---

## Phase 8️⃣: UI Component Migration

### 🧑‍💻 Task 8.1: Test NativeWind Styling

**What to do:**
After agent sets up NativeWind:
```bash
npx expo start
```

**Verify:**
- [ ] Tailwind classes apply correctly
- [ ] Custom colors work (primary, secondary, accent)
- [ ] Text sizing matches original design
- [ ] Spacing/padding looks correct

**Common issues:**
- **"className not working"**: Check `babel.config.js` has `nativewind/babel` plugin
- **"Colors wrong"**: Verify `tailwind.config.js` extends match your theme
- **"Fonts not loading"**: See Task 12.2 for font setup

---

### 🧑‍💻 Task 8.2: Manually Migrate Complex Animations

**Agent will convert simple animations.** You must handle:

**Complex animations needing manual work:**
1. **Review wizard step transitions** (`src/components/reviews/Wizard.tsx`)
   - Multi-step form with progress bar
   - Slide animations between steps
   - Agent provides Moti example - you customize

2. **Feed post interactions** (`src/components/FeedPost.tsx`)
   - Like button animation
   - Image expand/collapse
   - Share sheet animation

3. **Map marker clustering**
   - Cluster expand/contract
   - Marker bounce on select

**Recommended approach:**
```typescript
// Example: Like button
import { MotiView } from 'moti';

<MotiView
  animate={{
    scale: isLiked ? 1.2 : 1,
    rotate: isLiked ? '0deg' : '0deg',
  }}
  transition={{ type: 'spring', damping: 15 }}
>
  <Heart fill={isLiked ? '#ff3131' : 'none'} />
</MotiView>
```

**Testing:**
- [ ] All animations feel natural (not too fast/slow)
- [ ] No jank or frame drops
- [ ] Respects reduced motion settings (accessibility)

---

### 🧑‍💻 Task 8.3: Refactor Grid Layouts to Flex

**Agent will flag grid usage.** Common patterns:

**Before (Web - grid):**
```tsx
<div className="grid grid-cols-2 gap-4">
  {items.map(item => <Card key={item.id} />)}
</div>
```

**After (RN - flex + FlatList):**
```tsx
<FlatList
  data={items}
  numColumns={2}
  keyExtractor={(item) => item.id}
  renderItem={({ item }) => <Card item={item} />}
  columnWrapperStyle={{ gap: 16 }}
/>
```

**Files likely needing this:**
- Discovery grid of restaurants
- Image galleries
- Menu item grids

**Action:** Review agent's conversions and test on device.

---

### 🧑‍💻 Task 8.4: Replace Modals with React Native Equivalents

**Current PWA uses:** Web modals with `position: fixed` backdrop.

**React Native options:**
- **React Native Modal:** Built-in, full control
- **Bottom Sheet:** Better mobile UX for many cases
- **React Native Paper Dialog:** Material Design styled

**Recommendation:** Use `@gorhom/bottom-sheet` for most modals.

**Installation:**
```bash
npx expo install @gorhom/bottom-sheet
```

**Example migration:** `SaveToListModal.tsx`
```typescript
import BottomSheet from '@gorhom/bottom-sheet';

export default function SaveToListModal({ isOpen, onClose }) {
  const snapPoints = ['50%', '80%'];

  return (
    <BottomSheet
      index={isOpen ? 0 : -1}
      snapPoints={snapPoints}
      onClose={onClose}
      enablePanDownToClose
    >
      <View className="p-4">
        {/* Your modal content */}
      </View>
    </BottomSheet>
  );
}
```

**Test:**
- [ ] Modal opens smoothly
- [ ] Swipe down to close works
- [ ] Backdrop dims background
- [ ] Keyboard handling works

---

## Phase 9️⃣: Native APIs

### 🧑‍💻 Task 9.1: Test AsyncStorage Migration

**What agent does:** Replace all `localStorage` calls with `AsyncStorage`.

**What you do:** Test data persistence.

**Test cases:**
```markdown
1. Sign in → Close app → Reopen → Should stay signed in
2. Save draft review → Force quit → Reopen → Draft restored
3. Location permission state → Restart → Permission remembered
```

**Debugging:**
```typescript
// View all stored data
import AsyncStorage from '@react-native-async-storage/async-storage';

const debugStorage = async () => {
  const keys = await AsyncStorage.getAllKeys();
  const items = await AsyncStorage.multiGet(keys);
  console.log('Storage contents:', items);
};
```

**Common issues:**
- **"Data not persisting"**: Check you're `await`ing all calls
- **"Sign-in doesn't persist"**: Firebase Auth persistence should use AsyncStorage (agent handles this)

---

### 🧑‍💻 Task 9.2: Test Location Permissions

**What to test:**

**iOS:**
1. Open app → Should prompt for location
2. Tap "Allow Once" → Location works this session
3. Close and reopen → Prompts again
4. Tap "Allow While Using" → Location works persistently
5. Settings → Tip → Location → "Never" → App handles gracefully

**Android:**
1. Prompt appears on first location request
2. Test "Deny" → App shows error message
3. Uninstall/reinstall → Test "Allow" → Location works
4. Background location (if needed): Separate permission

**Edge cases:**
- [ ] Location disabled in device settings → Shows helpful error
- [ ] Airplane mode → Graceful degradation
- [ ] GPS weak signal → Loading state doesn't hang

**Privacy strings (verify in Info.plist):**
```
"We use your location to show nearby restaurants..."
```

**Action:** Approve or revise privacy descriptions.

---

### 🧑‍💻 Task 9.3: Manually Refactor Map Components

**This is the biggest manual task.** Agent provides scaffold, you customize.

**Files to migrate:**
- `src/pages/FoodMap.tsx`
- `src/components/RestaurantMap.tsx`
- `src/components/UserJourneyMap.tsx`

**Key differences:**

| Web (Google Maps JS) | React Native Maps |
|---------------------|-------------------|
| `<GoogleMap>` | `<MapView>` |
| `center={{ lat, lng }}` | `region={{ latitude, longitude }}` |
| `zoom={12}` | `latitudeDelta={0.1}` |
| `<Marker onClick={...}>` | `<Marker onPress={...}>` |
| Custom marker HTML | `<Marker.Callout>` component |
| Clustering plugin | `react-native-maps-super-cluster` |

**Example migration:**
```typescript
// BEFORE (Web)
<GoogleMap
  center={{ lat: 27.3364, lng: -82.5307 }}
  zoom={12}
  onClick={handleMapClick}
>
  {restaurants.map(r => (
    <Marker
      key={r.id}
      position={{ lat: r.coordinates.latitude, lng: r.coordinates.longitude }}
      onClick={() => setSelected(r.id)}
    />
  ))}
</GoogleMap>

// AFTER (React Native)
<MapView
  style={{ flex: 1 }}
  initialRegion={{
    latitude: 27.3364,
    longitude: -82.5307,
    latitudeDelta: 0.1,
    longitudeDelta: 0.1,
  }}
  onPress={handleMapPress}
>
  {restaurants.map(r => (
    <Marker
      key={r.id}
      coordinate={{
        latitude: r.coordinates.latitude,
        longitude: r.coordinates.longitude,
      }}
      onPress={() => setSelected(r.id)}
    >
      <Callout>
        <View className="p-2">
          <Text className="font-bold">{r.name}</Text>
          <Text>{r.cuisine}</Text>
        </View>
      </Callout>
    </Marker>
  ))}
</MapView>
```

**Testing:**
- [ ] Map displays centered on Sarasota
- [ ] Markers appear at correct locations
- [ ] Tap marker shows callout
- [ ] Pinch to zoom works
- [ ] Pan gesture smooth
- [ ] User location dot appears (if permission granted)

**Performance tip:** For 100+ markers, use clustering library.

---

### 🧑‍💻 Task 9.4: Test Image Upload Flow

**Agent migrates to `expo-image-picker`.** You test:

**Test cases:**
1. **Review creation:**
   - [ ] Tap "Add Photo" → Opens picker
   - [ ] Select from library → Image appears
   - [ ] Crop/edit → Changes apply
   - [ ] Submit → Uploads to Firebase Storage
   - [ ] URL saved to Firestore

2. **Profile avatar:**
   - [ ] Tap avatar → Picker opens
   - [ ] Choose photo → Crop screen
   - [ ] Save → Uploads and updates profile

3. **Permissions:**
   - [ ] First use prompts for photo library access
   - [ ] Deny → Shows error message
   - [ ] Open camera → Prompts for camera permission

**iOS specific:**
- Test "Select Photos" limited access → Works correctly

**Android specific:**
- Test permissions on Android 13+ (granular photo picker)

**Verify privacy strings:**
```
NSPhotoLibraryUsageDescription: "We need access..."
NSCameraUsageDescription: "We need camera access..."
```

---

### 🧑‍💻 Task 9.5: Test Share Functionality

**Agent implements `expo-sharing`.** You test:

**Test scenarios:**
```markdown
1. Share restaurant → Opens native share sheet
2. Select "Messages" → Link pre-filled
3. Share to Instagram/Facebook → Deep links work
4. Copy to clipboard fallback (if share unavailable)
```

**Platform differences:**
- **iOS:** Share sheet has all apps, AirDrop
- **Android:** Share sheet has system apps

**Verify:**
- [ ] Share URL format: `https://tip.app/restaurant/abc123`
- [ ] Deep link opens app if installed
- [ ] Web fallback if app not installed

---

## Phase 🔟: Assets & Permissions

### 🧑‍💻 Task 10.1: Verify Icon Rendering

**What to do:**
After placing icons in `assets/`:
```bash
npx expo start
# Press 'i' for iOS, 'a' for Android
```

**Check:**
- [ ] App icon appears on home screen (not default Expo logo)
- [ ] Icon looks crisp, not blurry
- [ ] Safe area respected (no cut-off on rounded corners)

**iOS specific:**
- Icon should have NO transparency (Apple rejects)
- Rounded corners applied automatically

**Android specific:**
- Adaptive icon foreground centered correctly
- Test on different launchers (Samsung, Pixel)

**Troubleshooting:**
- **"Still showing Expo logo"**: Clear cache, rebuild
- **"Icon blurry"**: Ensure 1024×1024, PNG format

---

### 🧑‍💻 Task 10.2: Test Splash Screen

**What to do:**
```bash
# Force quit app
# Reopen from home screen
# Splash should show briefly before app loads
```

**Check:**
- [ ] Logo centered
- [ ] Background color matches brand
- [ ] Transitions smoothly to app
- [ ] Not too fast or too slow (1-2 seconds ideal)

**Customization:**
Update `app.config.ts`:
```typescript
splash: {
  image: './assets/splash.png',
  resizeMode: 'contain', // or 'cover'
  backgroundColor: '#ffffff'
}
```

---

### 🧑‍💻 Task 10.3: Review Permission Requests

**iOS Info.plist descriptions:**
Review and customize these in `app.config.ts`:

```typescript
infoPlist: {
  NSLocationWhenInUseUsageDescription: 'Tip uses your location to show nearby restaurants and help you discover great food around you.',
  NSPhotoLibraryUsageDescription: 'Tip needs access to your photo library so you can upload photos with your reviews.',
  NSCameraUsageDescription: 'Tip needs camera access to take photos of your food for reviews.',
  NSPhotoLibraryAddUsageDescription: 'Tip needs permission to save photos to your library.',
}
```

**Best practices:**
- Be specific (not generic "to provide services")
- Explain benefit to user
- Keep concise (1-2 sentences)

**Android permissions:**
Already in `app.config.ts`. Review:
```typescript
permissions: [
  'ACCESS_FINE_LOCATION',
  'ACCESS_COARSE_LOCATION',
  'CAMERA',
  'READ_EXTERNAL_STORAGE',
  'WRITE_EXTERNAL_STORAGE'
]
```

**Note:** Android 13+ uses granular photo picker (no storage permission needed for most cases).

---

## Phase 1️⃣1️⃣: Testing & Builds

### 🧑‍💻 Task 11.1: Run E2E Manual Test

**Use the checklist** from `TEST_CHECKLIST.md` (agent provides).

**Critical path testing:**
```markdown
Day 1: Auth & Profile
- [ ] Sign up with email
- [ ] Sign in with Google
- [ ] Complete username setup
- [ ] Upload profile photo
- [ ] Edit bio
- [ ] Sign out and back in

Day 2: Discovery & Reviews
- [ ] Search for restaurant
- [ ] View restaurant detail
- [ ] View menu
- [ ] Create review (full wizard)
- [ ] Upload food photo
- [ ] Submit review
- [ ] See review in feed

Day 3: Social & Maps
- [ ] Like a post
- [ ] Save restaurant to list
- [ ] View map
- [ ] Test location permissions
- [ ] View user profile
- [ ] Follow/unfollow

Day 4: Edge Cases
- [ ] Offline mode
- [ ] Slow network
- [ ] Permission denied scenarios
- [ ] Empty states
```

**Track bugs in issue tracker.**

---

### 🧑‍💻 Task 11.2: Create Development Build

**Why?** Expo Go has limitations (can't test native modules fully).

**What to do:**
```bash
# iOS development build (for simulator)
eas build -p ios --profile development

# Wait ~20 minutes
# Download .tar.gz and install in simulator
```

**For Android:**
```bash
eas build -p android --profile development
# Download .apk
# Install: adb install downloaded-file.apk
```

**Test on physical device:**
```bash
# iOS: Install on device via Xcode
# Android: Enable USB debugging, adb install
```

**Advantages over Expo Go:**
- Test Google Sign-In
- Test push notifications
- Test native maps
- True production behavior

---

### 🧑‍💻 Task 11.3: Create Preview Build (Internal Testing)

**Goal:** Share with beta testers before production.

**iOS (TestFlight):**
```bash
eas build -p ios --profile preview

# When complete, submit to TestFlight
eas submit -p ios --profile preview
```

**Wait for Apple review** (usually 1-2 days).

**Add testers:**
- App Store Connect → TestFlight → Internal Testing
- Add emails of beta testers
- They'll receive invite via email

**Android (Internal Testing Track):**
```bash
eas build -p android --profile preview
eas submit -p android --profile preview
```

**Add testers:**
- Play Console → Testing → Internal testing
- Create email list or Google Group
- Share opt-in link with testers

---

### 🧑‍💻 Task 11.4: Production Builds

**Only do this when fully tested!**

**iOS:**
```bash
# Build
eas build -p ios --profile production

# Submit to App Store Connect
eas submit -p ios --profile production
```

**Then in App Store Connect:**
1. Add app metadata (description, screenshots, keywords)
2. Set pricing (free)
3. Choose categories (Food & Drink)
4. Upload privacy policy
5. Submit for review

**Expected timeline:** 1-3 days for approval.

**Android:**
```bash
# Build
eas build -p android --profile production

# Submit to Play Console
eas submit -p android --profile production
```

**Then in Play Console:**
1. Add store listing (description, screenshots)
2. Set content rating (ESRB, PEGI)
3. Upload privacy policy
4. Fill data safety form
5. Choose countries
6. Submit for review

**Expected timeline:** Hours to days.

---

## Phase 1️⃣2️⃣: Push Notifications

### 🧑‍💻 Task 12.1: Get APNs Key (iOS Push Notifications)

**What to do:**
1. Go to https://developer.apple.com/account/resources/authkeys/list
2. Click "+" to create new key
3. **Name:** Tip Push Notifications
4. **Enable:** Apple Push Notifications service (APNs)
5. Click "Continue" → "Register"
6. **Download the .p8 file** (you can only download once!)

**Save securely:** This file is your push notification key.

**Add to EAS:**
```bash
eas credentials

# Select iOS → Push Notifications
# Upload .p8 file
# Provide Key ID and Team ID
```

**Verification:**
```bash
eas build -p ios --profile preview
# Install on device
# Agent's code should register for push tokens
# Check console logs for token
```

---

### 🧑‍💻 Task 12.2: Configure FCM (Android Push Notifications)

**What to do:**
1. Firebase Console → Project Settings → Cloud Messaging
2. **If FCM API not enabled:**
   - Click "Manage" → Enable Cloud Messaging API

**For EAS:**
FCM is auto-configured via `google-services.json` (already done in Task 6.2).

**Test:**
```bash
eas build -p android --profile preview
# Install on device
# Check logs for push token registration
```

**Send test notification:**
- Firebase Console → Cloud Messaging → Send test message
- Enter your device token
- Should receive notification

---

### 🧑‍💻 Task 12.3: Test Push Notification Flow

**End-to-end test:**
```markdown
1. User A creates a review
2. User B receives notification "UserA reviewed Restaurant"
3. Tap notification → Opens app to post detail
4. Notification badge shows on app icon
```

**Platform testing:**
- [ ] iOS: Banner notification
- [ ] iOS: Lock screen notification
- [ ] iOS: Badge count on app icon
- [ ] Android: Notification shade
- [ ] Android: Heads-up notification
- [ ] Android: Notification icon

**Edge cases:**
- [ ] App in foreground → In-app alert
- [ ] App in background → System notification
- [ ] App killed → Notification wakes app
- [ ] Permission denied → Degrades gracefully

---

## Phase 1️⃣3️⃣: Final Polish

### 🧑‍💻 Task 13.1: Create Sentry Account

**What to do:**
1. Go to https://sentry.io/signup/
2. Create account (free tier is fine for starting)
3. Create new project: "tip-mobile"
4. Platform: React Native
5. **Copy DSN** (looks like `https://abc123@o123.ingest.sentry.io/456`)

**Provide to agent:**
```bash
# Agent adds to app.config.ts
extra: {
  sentryDsn: process.env.SENTRY_DSN
}

# You add to EAS secrets
eas secret:create --scope project --name SENTRY_DSN --value "https://..."
```

**Verification:**
```typescript
// Trigger test error
import * as Sentry from '@sentry/react-native';

Sentry.captureException(new Error('Test error from tip-mobile'));
```

Check Sentry dashboard → Should see error logged.

---

### 🧑‍💻 Task 13.2: Add Custom Fonts

**What to do:**
Download your font files:
- `Poppins-Regular.ttf`
- `Poppins-Bold.ttf`
- `KENT-Regular.ttf`

**Where to get them:**
- Google Fonts: https://fonts.google.com/specimen/Poppins
- Custom fonts: From your designer or current PWA `public/fonts/`

**Add to project:**
```
tip-mobile/
  assets/
    fonts/
      Poppins-Regular.ttf
      Poppins-Bold.ttf
      KENT-Regular.ttf
```

**Agent will configure** `expo-font` loading (see Agent Tasks 12.2).

**Verify:**
```bash
npx expo start
# Text should render in Poppins font
```

**Troubleshooting:**
- **"Font not loading"**: Check file names match exactly
- **"Fallback font used"**: Font loading might not be awaited

---

### 🧑‍💻 Task 13.3: App Store Metadata

**iOS (App Store Connect):**

**Required fields:**
```markdown
App Name: Tip
Subtitle: Discover Great Food in Sarasota
Description:
Tip helps you discover the best restaurants and dishes in Sarasota. Share your food journey, save favorites, and explore what others are eating.

Keywords: restaurant,food,sarasota,dining,reviews
Category: Food & Drink
Secondary Category: Social Networking

Privacy Policy URL: https://tip.app/privacy
Support URL: https://tip.app/support
```

**Screenshots required:**
- 6.7" iPhone (1290 x 2796): 3-10 screenshots
- 5.5" iPhone (optional but recommended): 3-10 screenshots
- iPad (optional): 3-10 screenshots

**Android (Play Console):**

**Required fields:**
```markdown
App name: Tip
Short description: Discover great food in Sarasota
Full description:
Tip is your guide to the best restaurants and dishes in Sarasota. Share your food experiences, save favorites, and see what the community is eating.

Features:
• Discover new restaurants near you
• Create detailed food reviews with photos
• Save restaurants to custom lists
• Follow friends and foodies
• Interactive food map
• Track your dining journey

Category: Food & Drink
Tags: restaurant, food, dining, reviews
```

**Screenshots:**
- Phone: 2-8 screenshots (1080 x 1920 or higher)
- 7" Tablet: Optional
- 10" Tablet: Optional

---

### 🧑‍💻 Task 13.4: Privacy Policy & Data Safety

**What to disclose:**

**Data collected:**
- [ ] Email address (for authentication)
- [ ] Username (public profile)
- [ ] Profile photo (optional, user-provided)
- [ ] Location data (when using map features, not stored)
- [ ] User-generated content (reviews, photos)

**Data usage:**
- [ ] Account creation and authentication
- [ ] Social features (profiles, following)
- [ ] Restaurant discovery (location-based)
- [ ] Analytics (crash reporting, usage metrics)

**Third parties:**
- [ ] Firebase (Google) - Auth, database, storage
- [ ] Sentry - Error tracking
- [ ] Google Maps - Map display

**iOS Privacy Nutrition Labels:**
App Store Connect → App Privacy → Get Started

**Android Data Safety:**
Play Console → App content → Data safety → Start

**Recommendation:** Use a privacy policy generator:
- https://www.freeprivacypolicy.com/
- https://app-privacy-policy-generator.firebaseapp.com/

**Host at:** `https://tip.app/privacy`

---

## Phase 1️⃣4️⃣: Launch Preparation

### 🧑‍💻 Task 14.1: Soft Launch Checklist

**Pre-launch verification:**
- [ ] All critical bugs fixed
- [ ] TestFlight beta feedback addressed
- [ ] Privacy policy published
- [ ] Support email set up (support@tip.app)
- [ ] Crash reporting working (Sentry)
- [ ] Push notifications sending
- [ ] App Store metadata complete
- [ ] Screenshots uploaded
- [ ] Pricing confirmed (Free)

**Recommended:**
- [ ] Set up social media (@TipSarasota)
- [ ] Create landing page (tip.app)
- [ ] Prepare launch announcement
- [ ] Line up initial users for reviews

---

### 🧑‍💻 Task 14.2: Monitor Launch

**First 24 hours:**
- Check Sentry for crashes every hour
- Monitor Firebase usage (Auth, Firestore quotas)
- Watch for user-reported bugs (support email)
- Check app store reviews

**First week:**
- Gather user feedback
- Plan first patch release if needed
- Monitor retention metrics
- Celebrate! 🎉

---

## Common Troubleshooting

### Build Errors

**"Keystore not found":**
```bash
eas credentials
# Select Android → Keystore → Generate new keystore
```

**"Code signing error" (iOS):**
```bash
eas credentials
# Select iOS → Distribution Certificate → Generate new
```

**"Build timed out":**
- Check EAS status page
- Try again (occasional infra issues)

### Runtime Errors

**"Network request failed":**
- Check Firebase API keys correct
- Verify SHA-1 fingerprints added
- Check device internet connection

**"Module not found":**
```bash
rm -rf node_modules
npm install
npx expo start --clear
```

**"Invariant Violation":**
- Usually routing issue
- Check all routes have valid exports
- Verify `app/_layout.tsx` configured correctly

### Permission Issues

**Location never prompts:**
- Check `infoPlist` descriptions added
- Verify `expo-location` installed
- Try `expo prebuild --clean` and rebuild

**Photo library access denied:**
- Check iOS simulator/device settings
- Reset permissions: Settings → General → Reset → Reset Location & Privacy

---

## Emergency Contacts

**Expo Support:**
- Discord: https://chat.expo.dev/
- Forums: https://forums.expo.dev/

**Firebase Support:**
- Stack Overflow: [firebase] [react-native]
- Firebase Support: https://firebase.google.com/support/contact/troubleshooting

**App Store Issues:**
- Apple Developer Support: https://developer.apple.com/contact/
- Google Play Support: https://support.google.com/googleplay/android-developer

---

## Final Notes

**Estimated timeline:**
- Phases 1-6: 1-2 weeks (setup & config)
- Phases 7-9: 2-3 weeks (migration & testing)
- Phases 10-12: 1 week (assets & polish)
- Phases 13-14: 1 week (submission & launch)

**Total:** 5-7 weeks for full migration.

**Success metrics:**
- [ ] App approved on both stores
- [ ] Core features working as in PWA
- [ ] No critical bugs in first week
- [ ] User retention comparable to web
- [ ] Positive initial reviews

---

**Document Version:** 1.0
**Last Updated:** 2025-10-17
**Maintained By:** Developer
