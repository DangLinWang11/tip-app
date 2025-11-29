/**
 * Returns Tailwind background color class based on quality score (0-100)
 */
export function getQualityColor(score: number): string {
  if (score >= 95) return 'bg-lime-200';   // Bright lime for top spots
  if (score >= 85) return 'bg-lime-300';   // Light lime
  if (score >= 75) return 'bg-yellow-300'; // Light yellow
  if (score >= 60) return 'bg-yellow-400'; // Deeper yellow
  if (score >= 45) return 'bg-orange-500'; // Bright orange
  if (score >= 30) return 'bg-orange-700'; // Dark orange
  return 'bg-red-700';                     // Deep red for poor scores
}
