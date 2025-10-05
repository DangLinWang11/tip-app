/**
 * Profanity filter utility
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
  // Add more as needed
];

/**
 * Normalize a string for profanity checking
 * Removes special characters, extra spaces, and converts to lowercase
 */
const normalizeForCheck = (text: string): string => {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '') // Remove special chars
    .replace(/\s+/g, ' ') // Normalize spaces
    .trim();
};

/**
 * Check if a string contains profanity
 */
export const containsProfanity = (text: string): boolean => {
  const normalized = normalizeForCheck(text);

  // Check for exact word matches
  return PROFANITY_LIST.some(word => {
    const regex = new RegExp(`\\b${word}\\b`, 'i');
    return regex.test(normalized);
  });
};

/**
 * Filter out profane terms from an array of strings
 */
export const filterProfanity = (terms: string[]): string[] => {
  return terms.filter(term => !containsProfanity(term));
};

/**
 * Validate a cuisine string
 * Returns true if the cuisine is valid (no profanity, reasonable length)
 */
export const isValidCuisine = (cuisine: string): boolean => {
  if (!cuisine || typeof cuisine !== 'string') {
    return false;
  }

  const trimmed = cuisine.trim();

  // Check length (cuisines should be reasonably short)
  if (trimmed.length < 2 || trimmed.length > 50) {
    return false;
  }

  // Check for profanity
  if (containsProfanity(trimmed)) {
    return false;
  }

  // Check that it's mostly letters (allow spaces and hyphens)
  if (!/^[a-zA-Z\s\-]+$/.test(trimmed)) {
    return false;
  }

  return true;
};

/**
 * Clean and validate an array of cuisine strings
 * Returns only valid, non-profane cuisines
 */
export const cleanCuisines = (cuisines: string[]): string[] => {
  if (!Array.isArray(cuisines)) {
    return [];
  }

  return cuisines
    .filter(cuisine => isValidCuisine(cuisine))
    .map(cuisine => cuisine.trim().toLowerCase())
    // Remove duplicates
    .filter((cuisine, index, self) => self.indexOf(cuisine) === index);
};
