# Security Actions Required

This document outlines the security hardening actions needed for the Tip PWA application.

## ✅ Completed Actions

- [x] Moved Firebase configuration from hardcoded values to environment variables
- [x] Moved Google Maps API key from hardcoded values to environment variables
- [x] Created `.env.example` template for developers
- [x] Added `.env` to `.gitignore` to prevent credential leaks
- [x] Fixed `android/.gitignore` to exclude `google-services.json`
- [x] Verified service account key has never been committed to git history

## 🔴 CRITICAL: Required Actions in Google Cloud Console

### 1. Restrict Firebase Web API Key

**Location:** Google Cloud Console > APIs & Services > Credentials

**API Key:** `AIzaSyBEzuZLNQo0SJ-zfq6IsBPbYKFj6NV6sAM`

**Actions Required:**

1. Navigate to: https://console.cloud.google.com/apis/credentials?project=tip-sarasotav2
2. Find the API key for Firebase Web (App ID: `1:279316450534:web:6386a22fe38591ef84ff27`)
3. Click "Edit API key"
4. Under "Application restrictions":
   - Select "HTTP referrers (web sites)"
   - Add authorized referrers:
     - `https://tip-sarasotav2.web.app/*` (production)
     - `https://tip-sarasotav2.firebaseapp.com/*` (production)
     - `http://localhost:*` (development)
     - `http://127.0.0.1:*` (development)
5. Under "API restrictions":
   - Select "Restrict key"
   - Enable only these APIs:
     - Firebase Authentication API
     - Cloud Firestore API
     - Firebase Storage API
     - Firebase Analytics API
6. Click "Save"

**Why:** Prevents unauthorized use of your Firebase API key from other domains.

---

### 2. Restrict Google Maps API Key

**Location:** Google Cloud Console > APIs & Services > Credentials

**API Key:** `AIzaSyDH-MgeMBC3_yvge3yLz_gaCl_2x8Ra6PY`

**Actions Required:**

1. Navigate to: https://console.cloud.google.com/apis/credentials?project=tip-sarasotav2
2. Find the Google Maps API key
3. Click "Edit API key"
4. Under "Application restrictions":
   - Select "HTTP referrers (web sites)"
   - Add authorized referrers:
     - `https://tip-sarasotav2.web.app/*` (production)
     - `https://tip-sarasotav2.firebaseapp.com/*` (production)
     - `http://localhost:*` (development)
     - `http://127.0.0.1:*` (development)
5. Under "API restrictions":
   - Select "Restrict key"
   - Enable only these APIs:
     - Maps JavaScript API
     - Places API
     - Geocoding API
6. Under "Quota management":
   - Set up billing alerts at 80% and 100% of expected usage
   - Consider setting daily quotas to prevent abuse
7. Click "Save"

**Why:** Prevents quota exhaustion attacks and unauthorized usage from other domains.

**Cost Protection:**
- Set up billing alerts in Google Cloud Console > Billing > Budgets & alerts
- Recommended alert thresholds: $50, $100, $200/month
- Enable quota limits: Google Cloud Console > APIs & Services > Quotas

---

### 3. Restrict Firebase Android API Key

**Location:** Google Cloud Console > APIs & Services > Credentials

**API Key:** `AIzaSyBbN4ZFa42Dc5bSqDwSYEBIGxgzuHf0nF8` (from google-services.json)

**Actions Required:**

1. Navigate to: https://console.cloud.google.com/apis/credentials?project=tip-sarasotav2
2. Find the API key for Firebase Android
3. Click "Edit API key"
4. Under "Application restrictions":
   - Select "Android apps"
   - Add package name: `com.tip.sarasota`
   - Add SHA-1 certificate fingerprint (get from your keystore):
     ```bash
     keytool -list -v -keystore path/to/your/keystore.jks
     ```
5. Under "API restrictions":
   - Select "Restrict key"
   - Enable only Firebase APIs (same as web)
6. Click "Save"

**Why:** Prevents unauthorized apps from using your Android Firebase configuration.

---

## 🟡 Firebase Security Rules Review

### 4. Audit Firestore Security Rules

**Location:** Firebase Console > Firestore Database > Rules

**File:** `firestore.rules`

**Review Checklist:**

- [ ] All collections have authentication requirements
- [ ] User data is protected (users can only access their own data)
- [ ] Admin checks use security rules, not client-side checks
- [ ] Sensitive fields are write-protected (e.g., `isAdmin`, `createdAt`)
- [ ] Rate limiting is implemented where applicable
- [ ] Input validation is in place (field types, sizes, formats)

**Current Status:** Rules appear well-structured with:
- Authentication-based access control
- Owner-only write access for user documents
- Admin role checks via `users/{uid}.isAdmin`
- Soft-delete pattern for reviews

**Action:** Review and test rules using Firebase Emulator Suite:
```bash
cd tip
npm run test:rules
```

---

### 5. Audit Storage Security Rules

**Location:** Firebase Console > Storage > Rules

**File:** `storage.rules`

**Review Checklist:**

- [ ] Public read access is intentional
- [ ] Write access requires authentication
- [ ] File size limits are enforced
- [ ] File type validation is in place
- [ ] User-specific paths protect user data

**Action:** Review current rules and ensure:
- Review media is publicly readable (required for app functionality)
- Only authenticated users can upload
- File size limits prevent abuse
- File paths prevent overwrites of other users' files

---

## 🟢 Optional Security Hardening

### 6. Implement Secret Scanning

**Pre-commit Hook with git-secrets:**

```bash
# Install git-secrets
# Windows (using Git Bash):
git clone https://github.com/awslabs/git-secrets.git
cd git-secrets
make install

# Navigate to your repo
cd "c:\Users\djdav\Tip Development\tip"

# Install hooks
git secrets --install

# Add patterns to detect
git secrets --register-aws
git secrets --add 'AIza[0-9A-Za-z_-]{35}'  # Google API keys
git secrets --add 'private_key.*-----BEGIN'  # Private keys
git secrets --add 'serviceAccountKey'  # Service account files
```

**Alternative: Use Gitleaks**

```bash
# Install gitleaks
# Windows: Download from https://github.com/gitleaks/gitleaks/releases

# Run scan
gitleaks detect --source . --verbose
```

---

### 7. Enable Firebase App Check

**Location:** Firebase Console > App Check

**Purpose:** Prevents abuse of your backend by verifying requests come from your authentic app.

**Actions:**

1. Navigate to Firebase Console > App Check
2. Enable App Check for web app:
   - Use reCAPTCHA v3 for web
   - Configure reCAPTCHA site key
3. Enable App Check for Android app:
   - Use Play Integrity API or SafetyNet
4. Enforce App Check on:
   - Firestore
   - Storage
   - Cloud Functions (if applicable)

**Documentation:** https://firebase.google.com/docs/app-check

---

### 8. Configure Security Headers

**Location:** `firebase.json` hosting configuration

**Add security headers:**

```json
{
  "hosting": {
    "headers": [
      {
        "source": "**",
        "headers": [
          {
            "key": "Content-Security-Policy",
            "value": "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://maps.googleapis.com https://www.gstatic.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https: blob:; connect-src 'self' https://*.googleapis.com https://*.firebaseio.com wss://*.firebaseio.com; frame-src https://www.google.com;"
          },
          {
            "key": "X-Content-Type-Options",
            "value": "nosniff"
          },
          {
            "key": "X-Frame-Options",
            "value": "DENY"
          },
          {
            "key": "X-XSS-Protection",
            "value": "1; mode=block"
          },
          {
            "key": "Referrer-Policy",
            "value": "strict-origin-when-cross-origin"
          },
          {
            "key": "Permissions-Policy",
            "value": "geolocation=(self), microphone=(), camera=()"
          }
        ]
      }
    ]
  }
}
```

**Note:** Test thoroughly after adding CSP to ensure all functionality works.

---

## 🔄 Service Account Key Rotation Procedure

**Only perform this if the service account key was ever exposed to version control or publicly.**

### Steps to Rotate Service Account Key:

1. **Create New Key:**
   ```bash
   # Using Firebase CLI
   firebase login
   firebase projects:list

   # Go to Google Cloud Console
   # IAM & Admin > Service Accounts > firebase-adminsdk@tip-sarasotav2.iam.gserviceaccount.com
   # Click "Add Key" > "Create new key" > JSON
   # Download and save as serviceAccountKey.json in functions/
   ```

2. **Delete Old Key:**
   - In Google Cloud Console > IAM & Admin > Service Accounts
   - Find the old key ID: `62fb593bc4efda04b87bb17220f295cbd5216753`
   - Click the three dots menu > Delete

3. **Deploy Cloud Functions with New Key:**
   ```bash
   cd functions
   firebase deploy --only functions
   ```

4. **Verify Functions Work:**
   - Test all Cloud Functions in Firebase Console
   - Check Cloud Functions logs for errors

**Current Status:** ✅ No rotation needed - key has never been in git history.

---

## 📋 Environment Setup for New Developers

When onboarding new developers, they should:

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Fill in the values (get from team lead or Firebase Console)

3. Never commit `.env` file (already gitignored)

4. For Android development, obtain `google-services.json` from Firebase Console:
   - Firebase Console > Project Settings > Your apps > Android app
   - Download google-services.json
   - Place in `android/app/google-services.json`
   - File is gitignored automatically

---

## 🔍 Security Monitoring

### Ongoing Security Practices:

1. **Regular Audits:**
   - Review Firebase Console > Authentication > Users for suspicious activity
   - Check Cloud Functions logs for unusual patterns
   - Monitor Storage usage for unexpected growth

2. **Quota Monitoring:**
   - Set up Google Cloud billing alerts
   - Monitor Firebase usage dashboard
   - Track Google Maps API usage

3. **Dependency Updates:**
   - Run `npm audit` regularly
   - Keep Firebase SDK updated
   - Update dependencies with security patches

4. **Access Control:**
   - Limit Firebase Console admin access to essential team members
   - Use Firebase Admin SDK service accounts only in secure Cloud Functions
   - Never use service account keys in client-side code

---

## 📞 Security Incident Response

If you suspect a security breach:

1. **Immediately rotate all API keys** (Firebase, Google Maps)
2. **Rotate service account keys**
3. **Review Firebase Authentication logs** for unauthorized access
4. **Check Firestore audit logs** for unauthorized data access
5. **Review Cloud Functions logs** for suspicious activity
6. **Contact Google Cloud Support** if needed

---

## ✅ Completion Checklist

Use this checklist to track security hardening progress:

- [x] Move API keys to environment variables
- [x] Add `.env` to `.gitignore`
- [x] Create `.env.example` template
- [x] Fix `android/.gitignore` for `google-services.json`
- [ ] **Restrict Firebase Web API key in Google Cloud Console**
- [ ] **Restrict Google Maps API key in Google Cloud Console**
- [ ] **Restrict Firebase Android API key in Google Cloud Console**
- [ ] Review and test Firestore security rules
- [ ] Review and test Storage security rules
- [ ] Set up billing alerts in Google Cloud
- [ ] (Optional) Implement git-secrets or gitleaks
- [ ] (Optional) Enable Firebase App Check
- [ ] (Optional) Add security headers to hosting config
- [ ] Document security procedures for team

---

**Last Updated:** 2025-12-26
**Next Review:** Quarterly (or after any security incident)
