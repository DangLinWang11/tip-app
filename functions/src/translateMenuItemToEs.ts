import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { TranslationServiceClient } from '@google-cloud/translate';
import * as crypto from 'crypto';

const translateClient = new TranslationServiceClient();

const MAX_NAME_CHARS = 120;
const MAX_DESC_CHARS = 600;
const COOLDOWN_MS = 24 * 60 * 60 * 1000;

const normalizeText = (value: unknown): string => {
  if (typeof value !== 'string') return '';
  return value.trim();
};

const truncate = (value: string, maxChars: number): string => {
  if (value.length <= maxChars) return value;
  return value.slice(0, maxChars);
};

const computeSourceHash = (name: string, description: string): string => {
  return crypto
    .createHash('sha256')
    .update(`${name}\n${description}`)
    .digest('hex');
};

export const translateMenuItemToEs = functions
  .runWith({
    timeoutSeconds: 30,
    memory: '256MB',
    serviceAccount: 'tip-translate-fn@tip-sarasotav2.iam.gserviceaccount.com'
  })
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Authentication required');
    }

    const menuItemId = data?.menuItemId;
    if (!menuItemId || typeof menuItemId !== 'string') {
      throw new functions.https.HttpsError('invalid-argument', 'menuItemId is required');
    }

    const menuItemRef = admin.firestore().collection('menuItems').doc(menuItemId);
    const menuItemSnap = await menuItemRef.get();
    if (!menuItemSnap.exists) {
      throw new functions.https.HttpsError('not-found', 'Menu item not found');
    }

    const menuItem = menuItemSnap.data() || {};
    const rawName = normalizeText(menuItem.name);
    const rawDescription = normalizeText(menuItem.description);

    if (!rawName) {
      throw new functions.https.HttpsError('failed-precondition', 'Menu item name is missing');
    }

    const name = truncate(rawName, MAX_NAME_CHARS);
    const description = truncate(rawDescription, MAX_DESC_CHARS);
    const sourceHash = computeSourceHash(name, description);

    const existing = menuItem.translations?.es;
    const existingHasText = Boolean(
      existing &&
      typeof existing.name === 'string' &&
      (description ? typeof existing.description === 'string' : true)
    );

    if (existing && existing.sourceHash === sourceHash && existingHasText) {
      return { status: 'cached', translations: existing };
    }

    const lastTranslatedAt = existing?.translatedAt?.toDate ? existing.translatedAt.toDate() : null;
    if (lastTranslatedAt) {
      const withinCooldown = Date.now() - lastTranslatedAt.getTime() < COOLDOWN_MS;
      if (withinCooldown && existing?.sourceHash === sourceHash && existingHasText) {
        return { status: 'cached', translations: existing };
      }
    }

    const contents: string[] = [name];
    let descriptionIndex = -1;
    if (description) {
      descriptionIndex = contents.length;
      contents.push(description);
    }

    const projectId = process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT || 'tip-sarasotav2';
    const parent = `projects/${projectId}/locations/global`;

    const [response] = await translateClient.translateText({
      parent,
      contents,
      mimeType: 'text/plain',
      targetLanguageCode: 'es'
    });

    const translated = response.translations || [];
    const translatedName = translated[0]?.translatedText || name;
    const translatedDescription =
      descriptionIndex >= 0 ? (translated[descriptionIndex]?.translatedText || description) : '';

    const translationsPayload = {
      name: translatedName,
      description: translatedDescription,
      sourceHash,
      translatedAt: admin.firestore.FieldValue.serverTimestamp(),
      provider: 'gcp-translate'
    };

    await menuItemRef.set(
      { translations: { es: translationsPayload } },
      { merge: true }
    );

    return { status: 'translated', translations: translationsPayload };
  });
