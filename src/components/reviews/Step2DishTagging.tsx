import React from 'react';
import { useReviewWizard } from './WizardContext';
import { CUISINES, DISH_TYPES, DISH_STYLES, ATTRIBUTES, OCCASIONS, DIETARY } from '../../data/tagDefinitions';
import type { ReviewDraft } from '../../dev/types/review';

type ExplicitState = NonNullable<ReviewDraft['explicit']>;
type SentimentState = NonNullable<ReviewDraft['sentiment']>;

const createExplicitState = (input?: ReviewDraft['explicit']): ExplicitState => ({
  dishType: input?.dishType ?? null,
  dishStyle: input?.dishStyle ?? null,
  cuisine: input?.cuisine ?? null,
  attributes: Array.isArray(input?.attributes) ? [...input!.attributes] : [],
  occasions: Array.isArray(input?.occasions) ? [...input!.occasions] : [],
  dietary: Array.isArray(input?.dietary) ? [...input!.dietary] : []
});

const createSentimentState = (input?: ReviewDraft['sentiment']): SentimentState => ({
  pricePerception: input?.pricePerception ?? null
});

const Step2DishTagging: React.FC = () => {
  const { draft, updateDraft, goBack, goNext, showReward } = useReviewWizard();

  const explicit = createExplicitState(draft.explicit);
  const sentiment = createSentimentState(draft.sentiment);

  const updateExplicit = <K extends keyof ExplicitState>(field: K, value: ExplicitState[K]) => {
    updateDraft((prev) => {
      const next = createExplicitState(prev.explicit);
      return {
        ...prev,
        explicit: {
          ...next,
          [field]: value
        }
      };
    });
  };

  const updateSentiment = <K extends keyof SentimentState>(field: K, value: SentimentState[K]) => {
    updateDraft((prev) => ({
      ...prev,
      sentiment: {
        ...createSentimentState(prev.sentiment),
        [field]: value
      }
    }));
  };

  const toggleExplicitArray = (field: keyof Pick<ExplicitState, 'attributes' | 'occasions' | 'dietary'>, value: string) => {
    updateDraft((prev) => {
      const next = createExplicitState(prev.explicit);
      const currentValues = next[field];
      const exists = currentValues.includes(value);
      return {
        ...prev,
        explicit: {
          ...next,
          [field]: exists ? currentValues.filter((item) => item !== value) : [...currentValues, value]
        }
      };
    });
  };

  const canProceed = explicit.cuisine !== null;

  const handleNext = () => {
    if (!canProceed) return;
    showReward('taste');
    goNext();
  };

  return (
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-medium mb-2">Price</label>
        <div className="flex gap-2">
          {['bargain', 'fair', 'overpriced'].map((val) => (
            <button
              key={val}
              type="button"
              onClick={() => updateSentiment('pricePerception', val as SentimentState['pricePerception'])}
              className={`flex-1 py-2 rounded-lg border ${
                sentiment.pricePerception === val ? 'bg-primary text-white border-primary' : 'bg-white border-gray-300'
              }`}
            >
              {val.charAt(0).toUpperCase() + val.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">
          Cuisine <span className="text-red-500">*</span>
        </label>
        <select
          value={explicit.cuisine || ''}
          onChange={(event) => updateExplicit('cuisine', event.target.value ? event.target.value : null)}
          className="w-full p-2 border rounded-lg"
        >
          <option value="">Select cuisine...</option>
          {CUISINES.map((cuisine) => (
            <option key={cuisine.value} value={cuisine.value}>
              {cuisine.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">Dish Type</label>
        <select
          value={explicit.dishType || ''}
          onChange={(event) => updateExplicit('dishType', event.target.value ? event.target.value : null)}
          className="w-full p-2 border rounded-lg"
        >
          <option value="">Select type...</option>
          {DISH_TYPES.map((type) => (
            <option key={type.value} value={type.value}>
              {type.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">Dish Style (optional)</label>
        <select
          value={explicit.dishStyle || ''}
          onChange={(event) => updateExplicit('dishStyle', event.target.value ? event.target.value : null)}
          className="w-full p-2 border rounded-lg"
        >
          <option value="">None</option>
          {DISH_STYLES.map((style) => (
            <option key={style.value} value={style.value}>
              {style.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">Attributes</label>
        <div className="flex flex-wrap gap-2">
          {ATTRIBUTES.map((attribute) => {
            const active = explicit.attributes.includes(attribute.value);
            return (
              <button
                key={attribute.value}
                type="button"
                onClick={() => toggleExplicitArray('attributes', attribute.value)}
                className={`px-3 py-1.5 rounded-full text-sm ${
                  active ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-700'
                }`}
              >
                {attribute.emoji} {attribute.label}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">Best for</label>
        <div className="flex flex-wrap gap-2">
          {OCCASIONS.map((occasion) => {
            const active = explicit.occasions.includes(occasion.value);
            return (
              <button
                key={occasion.value}
                type="button"
                onClick={() => toggleExplicitArray('occasions', occasion.value)}
                className={`px-3 py-1.5 rounded-full text-sm ${
                  active ? 'bg-emerald-500 text-white' : 'bg-gray-100 text-gray-700'
                }`}
              >
                {occasion.emoji} {occasion.label}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">Dietary</label>
        <div className="flex flex-wrap gap-2">
          {DIETARY.map((diet) => {
            const active = explicit.dietary.includes(diet.value);
            return (
              <button
                key={diet.value}
                type="button"
                onClick={() => toggleExplicitArray('dietary', diet.value)}
                className={`px-3 py-1.5 rounded-full text-sm ${
                  active ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-700'
                }`}
              >
                {diet.emoji} {diet.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex gap-3 pt-4">
        <button type="button" onClick={goBack} className="flex-1 py-3 border rounded-lg">
          Back
        </button>
        <button
          type="button"
          onClick={handleNext}
          disabled={!canProceed}
          className={`flex-1 py-3 rounded-lg ${
            canProceed ? 'bg-primary text-white' : 'bg-gray-300 text-gray-500 cursor-not-allowed'
          }`}
        >
          Next
        </button>
      </div>
    </div>
  );
};

export default Step2DishTagging;
