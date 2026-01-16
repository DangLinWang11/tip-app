/**
 * Returns hex color based on quality score (0-100)
 * Scores are clamped to 0-100 range
 */
export function getQualityColor(score: number): string {
  const clampedScore = Math.max(0, Math.min(100, score));

  if (clampedScore >= 90) return '#2F6F4E'; // Premium / Excellent (forest green)
  if (clampedScore >= 80) return '#4F9B75'; // Very Good
  if (clampedScore >= 70) return '#9FD3B5'; // Good / Reliable
  if (clampedScore >= 60) return '#E4D96F'; // Average / Caution
  if (clampedScore >= 50) return '#F0A43C'; // Declining
  if (clampedScore >= 36) return '#E06B2D'; // Poor
  return '#C92A2A';                          // Hard Red / Avoid
}
