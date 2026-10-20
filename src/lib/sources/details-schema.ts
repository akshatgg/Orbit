// Validation for the admin "Details" editor on imported events.

import { z } from "zod";

const httpsImage = z
  .string()
  .trim()
  .max(2000, "That image link is too long")
  .transform((v) => v || null)
  .refine((v) => v === null || /^https:\/\//i.test(v), "Image links must start with https://");

const money = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : Number(v)))
  .refine((v) => v === null || Number.isFinite(v), "Prices must be numbers")
  .refine((v) => v === null || v >= 0, "Prices can't be negative")
  .refine((v) => v === null || v <= 100_000, "That price is too high");

export const importedDetailsSchema = z
  .object({
    id: z.uuid({ message: "Unknown event" }),
    /** A link to copy into Cloudinary (pasted from the Luma/Meetup page). */
    image_url: httpsImage,
    /** An image the admin already uploaded with uploadImage(). */
    cover_url: httpsImage,
    description: z.string().trim().max(5000, "Keep the description under 5,000 characters").transform((v) => v || null),
    price_min: money,
    price_max: money,
  })
  .refine((d) => d.price_min === null || d.price_max === null || d.price_max >= d.price_min, {
    message: "“Price to” must be at least “Price from”.",
    path: ["price_max"],
  });

export type ImportedDetailsInput = z.infer<typeof importedDetailsSchema>;
