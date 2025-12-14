// src/utils/loadingMessages.ts

const LOADING_MESSAGES = [
  "Your next food journey awaits...",
  "Discovering local flavors...",
  "Loading your food map...",
  "Prepping your personalized feed...",
  "Getting everything ready...",
  "Curating your dining experiences...",
  "Warming up your food feed...",
  "Almost there, food lover..."
];

/**
 * Returns a random loading message from the predefined list
 * @returns A random loading message string
 */
export const getRandomLoadingMessage = (): string => {
  const randomIndex = Math.floor(Math.random() * LOADING_MESSAGES.length);
  return LOADING_MESSAGES[randomIndex];
};
