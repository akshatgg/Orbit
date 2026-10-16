export type OrbitLoaderSize = "sm" | "md" | "lg";

export interface OrbitLoaderMetrics {
  /** Mark width/height in px. */
  mark: number;
  /** Square scene (rings included) in px. */
  scene: number;
  /** Wordmark font size in px. */
  word: number;
}

const MARKS: Record<OrbitLoaderSize, { mark: number; word: number }> = {
  sm: { mark: 44, word: 12 },
  md: { mark: 84, word: 17 },
  lg: { mark: 120, word: 22 },
};

/** Pixel metrics for each loader size; the scene leaves room for the outer ring. */
export function orbitLoaderMetrics(size: OrbitLoaderSize): OrbitLoaderMetrics {
  const m = MARKS[size];
  return { ...m, scene: Math.round(m.mark * 2) };
}
