import type { ReviewDraft } from '../dev/types/review';

export const CUISINES = [
  { value: 'italian', label: 'Italian' },
  { value: 'japanese', label: 'Japanese' },
  { value: 'chinese', label: 'Chinese' },
  { value: 'mexican', label: 'Mexican' },
  { value: 'thai', label: 'Thai' },
  { value: 'american', label: 'American' },
  { value: 'french', label: 'French' },
  { value: 'german', label: 'German' },
  { value: 'indian', label: 'Indian' },
  { value: 'mediterranean', label: 'Mediterranean' },
  { value: 'latin', label: 'Latin American' }
] as const;

export const DISH_TYPES = [
  { value: 'pizza', label: 'Pizza' },
  { value: 'taco', label: 'Taco' },
  { value: 'burger', label: 'Burger' },
  { value: 'sandwich', label: 'Sandwich' },
  { value: 'pasta', label: 'Pasta' },
  { value: 'sushi', label: 'Sushi' },
  { value: 'bbq', label: 'BBQ/Grill' },
  { value: 'soup', label: 'Soup' },
  { value: 'steak', label: 'Steak' },
  { value: 'dessert', label: 'Dessert' }
] as const;

export const DISH_STYLES = [
  { value: 'tavern_pizza', label: 'Tavern-Style Pizza', archetype: 'pizza' },
  { value: 'ny_pizza', label: 'New York Pizza', archetype: 'pizza' },
  { value: 'neapolitan_pizza', label: 'Neapolitan Pizza', archetype: 'pizza' },
  { value: 'detroit_pizza', label: 'Detroit-Style Pizza', archetype: 'pizza' },
  { value: 'chicago_pizza', label: 'Chicago Deep Dish', archetype: 'pizza' },
  { value: 'basque_cheesecake', label: 'Basque Cheesecake', archetype: 'dessert' },
  { value: 'smashburger', label: 'Smashburger', archetype: 'burger' },
  { value: 'birria_taco', label: 'Birria Taco', archetype: 'taco' }
] as const;

export const ATTRIBUTES = [
  { value: 'crispy', label: 'Crispy / Crunchy', emoji: '??' },
  { value: 'saucy', label: 'Saucy', emoji: '??' },
  { value: 'creamy', label: 'Creamy', emoji: '??' },
  { value: 'light', label: 'Light', emoji: '??' },
  { value: 'rich', label: 'Rich / Indulgent', emoji: '??' },
  { value: 'spicy', label: 'Spicy', emoji: '???' },
  { value: 'sweet', label: 'Sweet', emoji: '??' },
  { value: 'fresh', label: 'Fresh', emoji: '??' },
  { value: 'scratch_made', label: 'Scratch-made', emoji: '?????' }
] as const;

export const OCCASIONS = [
  { value: 'date_night', label: 'Date Night', emoji: '💑' },
  { value: 'family', label: 'Family-Friendly', emoji: '👨‍👩‍👧‍👦' },
  { value: 'takeout', label: 'Takeout', emoji: '🥡' },
  { value: 'quick_lunch', label: 'Quick Lunch', emoji: '⏱️' },
  { value: 'special_occasion', label: 'Special Occasion', emoji: '🎉' },
  { value: 'late_night', label: 'Late Night', emoji: '🌙' },
  { value: 'business', label: 'Business Meal', emoji: '💼' },
  { value: 'group', label: 'Good for Groups', emoji: '👥' }
] as const;

export const DIETARY = [
  { value: 'vegetarian', label: 'Vegetarian', emoji: '🥗' },
  { value: 'vegan', label: 'Vegan', emoji: '🌱' },
  { value: 'gluten_free', label: 'Gluten-Free Friendly', emoji: '🌾' },
  { value: 'dairy_free', label: 'Dairy-Free', emoji: '🥛' },
  { value: 'nut_free', label: 'Nut-Free', emoji: '🥜' }
] as const;

export function buildExplicitTags(explicit: ReviewDraft['explicit']): string[] {
  if (!explicit) return [];

  const tags: string[] = [];

  if (explicit.cuisine) tags.push(`cuisine_${explicit.cuisine}`);
  if (explicit.dishType) tags.push(`type_${explicit.dishType}`);
  if (explicit.dishStyle) tags.push(`style_${explicit.dishStyle}`);

  explicit.attributes.forEach((attr) => tags.push(`attr_${attr}`));
  explicit.occasions.forEach((occ) => tags.push(`occasion_${occ}`));
  explicit.dietary.forEach((diet) => tags.push(`dietary_${diet}`));

  return tags;
}

export function buildDerivedTags(sentiment: ReviewDraft['sentiment']): string[] {
  if (!sentiment) return [];

  const tags: string[] = [];

  if (sentiment.pricePerception === 'bargain') tags.push('val_good_value');
  if (sentiment.pricePerception === 'overpriced') tags.push('val_overpriced');
  if (sentiment.pricePerception === 'fair') tags.push('val_fair');

  return tags;
}
