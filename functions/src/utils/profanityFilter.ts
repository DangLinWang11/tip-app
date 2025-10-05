/**
 * Profanity filter utility for Cloud Functions
 * Filters out inappropriate terms from user-generated content like cuisine tags
 */

// Basic profanity word list (expand as needed)
const PROFANITY_LIST = [
  'fuck',
  'shit',
  'ass',
  'bitch',
  'damn',
  'hell',
  'bastard',
  'crap',
  'piss',
  'dick',
  'cock',
  'pussy',
  'slut',
  'whore',
  'fag',
  'nigger',
  'nigga',
  'cunt',
  'twat',
];

/**
 * Normalize a string for profanity checking
 */
const normalizeForCheck = (text: string): string => {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
};

/**
 * Check if a string contains profanity
 */
export const containsProfanity = (text: string): boolean => {
  const normalized = normalizeForCheck(text);
  return PROFANITY_LIST.some(word => {
    const regex = new RegExp(`\\b${word}\\b`, 'i');
    return regex.test(normalized);
  });
};

/**
 * Validate a cuisine string
 */
export const isValidCuisine = (cuisine: string): boolean => {
  if (!cuisine || typeof cuisine !== 'string') {
    return false;
  }

  const trimmed = cuisine.trim();

  if (trimmed.length < 2 || trimmed.length > 50) {
    return false;
  }

  if (containsProfanity(trimmed)) {
    return false;
  }

  if (!/^[a-zA-Z\s\-]+$/.test(trimmed)) {
    return false;
  }

  return true;
};

/**
 * Clean and validate an array of cuisine strings
 */
export const cleanCuisines = (cuisines: string[]): string[] => {
  if (!Array.isArray(cuisines)) {
    return [];
  }

  return cuisines
    .filter(cuisine => isValidCuisine(cuisine))
    .map(cuisine => cuisine.trim().toLowerCase())
    .filter((cuisine, index, self) => self.indexOf(cuisine) === index);
};
