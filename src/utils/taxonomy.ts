export const DISH_TYPES = [
  'burgers','tacos','ramen','pho','pizza','bbq','fried chicken','sandwiches',
  'salads','pasta','sushi','dumplings','noodles','steak','seafood','desserts','coffee','tea'
];

export const CUISINES = [
  'italian',
  'japanese',
  'chinese',
  'mexican',
  'thai',
  'american',
  'french',
  'indian',
  'mediterranean',
  'latin american',
  'spanish',
  'greek',
  'korean',
  'vietnamese',
  'middle eastern',
  'caribbean',
  'bbq/grill',
  'seafood',
  'breakfast / brunch',
  'sandwiches / deli',
  'pizza',
  'european',
  'african',
  'peruvian',
  'argentine',
  'brazilian',
  'filipino',
  'hawaiian',
  'turkish',
  'lebanese'
];

const CUISINE_LABEL_OVERRIDES: Record<string, string> = {
  bbq: 'BBQ/Grill',
  'bbq/grill': 'BBQ/Grill',
  'breakfast / brunch': 'Breakfast / Brunch',
  'sandwiches / deli': 'Sandwiches / Deli',
  'latin american': 'Latin American'
};

export const getCuisineLabel = (slug: string): string => {
  const key = slug.toLowerCase();
  if (CUISINE_LABEL_OVERRIDES[key]) {
    return CUISINE_LABEL_OVERRIDES[key];
  }
  return key.split(' ').map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
};

export const normalizeToken = (s: string) =>
  s.toLowerCase().trim()
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .replace(/\s+/g, ' ');

export function tokenizeForSearch(...texts: string[]): string[] {
  const tokens = new Set<string>();
  texts.forEach((text) => {
    if (typeof text !== 'string' || !text.trim()) return;
    const normalized = normalizeToken(text);
    normalized.split(' ').forEach((token) => {
      if (token.length >= 2) {
        tokens.add(token);
      }
    });
  });
  return Array.from(tokens);
}

export function inferFacetsFromText(text: string) {
  const t = normalizeToken(text);
  const dishTypes = new Set<string>();
  const cuisines = new Set<string>();
  const attributes = new Set<string>();
  const add = (set: Set<string>, v?: string) => v && set.add(v);

  // light rules
  if (/\b(burger|cheeseburger)\b/.test(t)) add(dishTypes, 'burgers');
  if (/\b(taco|al pastor|carnitas)\b/.test(t)) add(dishTypes, 'tacos');
  if (/\b(pizza|margherita)\b/.test(t)) add(dishTypes, 'pizza');
  if (/\b(ramen)\b/.test(t)) add(dishTypes, 'ramen');
  if (/\b(pho)\b/.test(t)) add(dishTypes, 'pho');
  if (/\b(sushi|nigiri|maki)\b/.test(t)) add(dishTypes, 'sushi');
  if (/\b(bbq|barbecue|brisket)\b/.test(t)) add(dishTypes, 'bbq');

  if (/\bmexican|al pastor|taco\b/.test(t)) add(cuisines, 'mexican');
  if (/\bthai|kaphrao|pad thai\b/.test(t)) add(cuisines, 'thai');
  if (/\bjapanese|ramen|sushi\b/.test(t)) add(cuisines, 'japanese');
  if (/\bitalian|pizza|pasta\b/.test(t)) add(cuisines, 'italian');

  if (/\b(spicy|heat|hot)\b/.test(t)) add(attributes, 'spicy');
  if (/\b(crispy|crunchy)\b/.test(t)) add(attributes, 'crispy');

  return {
    dishTypes: [...dishTypes].slice(0, 5),
    cuisines: [...cuisines].slice(0, 5),
    attributes: [...attributes].slice(0, 5),
  };
}
