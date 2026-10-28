// A pen signature drawn in the browser: strokes of points, each coordinate
// normalized to 0..1 across the pad (x to the right, y down). The pad and the
// PDF area share one aspect ratio, so the drawing keeps its shape.
import { z } from 'zod';

export const DRAWN_ASPECT = 7 / 2; // width / height, pad and PDF alike

export const MAX_STROKES = 100;
export const MAX_POINTS_PER_STROKE = 1000;
export const MAX_POINTS = 10_000;
const coord = z
  .number()
  .finite()
  .transform((n) => Math.round(Math.min(1, Math.max(0, n)) * 1000) / 1000);

export const strokesSchema = z
  .array(z.array(z.tuple([coord, coord])).min(1).max(MAX_POINTS_PER_STROKE))
  .min(1)
  .max(MAX_STROKES)
  .refine((s) => s.reduce((n, stroke) => n + stroke.length, 0) <= MAX_POINTS, 'Too many points');

export type Strokes = z.infer<typeof strokesSchema>;
