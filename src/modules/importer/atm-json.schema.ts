import { z } from 'zod';

/**
 * Raw record shape produced by the Google Places crawler export that was
 * provided as data/atms.json. Extra fields are allowed (`.passthrough()`) and
 * ignored — the importer never stores phone numbers, ratings, reviews,
 * photos or plus codes.
 *
 * See docs/data-format.md.
 */
export const rawAtmRecordSchema = z
  .object({
    title: z.string().nullable().optional(),
    address: z.string().nullable().optional(),
    street: z.string().nullable().optional(),
    neighborhood: z.string().nullable().optional(),
    city: z.string().nullable().optional(),
    state: z.string().nullable().optional(),
    countryCode: z.string().nullable().optional(),
    location: z
      .object({
        lat: z.number().nullable().optional(),
        lng: z.number().nullable().optional(),
      })
      .nullable()
      .optional(),
    categories: z.array(z.string()).nullable().optional(),
    openingHours: z
      .array(
        z.object({
          day: z.string().nullable().optional(),
          hours: z.string().nullable().optional(),
        }),
      )
      .nullable()
      .optional(),
    placeId: z.string().nullable().optional(),
    permanentlyClosed: z.boolean().nullable().optional(),
    temporarilyClosed: z.boolean().nullable().optional(),
    scrapedAt: z.string().nullable().optional(),
  })
  .passthrough();

export type RawAtmRecord = z.infer<typeof rawAtmRecordSchema>;

/** The file may be a bare array (the provided file) or {fetchedAt, records}. */
export const rawFileSchema = z.union([
  z.array(z.unknown()),
  z.object({ records: z.array(z.unknown()), fetchedAt: z.string().optional() }).passthrough(),
]);

export type RawFile = z.infer<typeof rawFileSchema>;

export function extractRecords(file: RawFile): { records: unknown[]; fetchedAt?: string } {
  if (Array.isArray(file)) return { records: file };
  return { records: file.records, fetchedAt: file.fetchedAt };
}
