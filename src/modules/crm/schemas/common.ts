import { z } from 'zod'

export const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use the format YYYY-MM-DD')
  .refine((value) => {
    const parsed = new Date(`${value}T00:00:00Z`)
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
  }, 'Not a real calendar date')

export const nullableIsoDate = isoDate
  .nullable()
  .optional()
  .transform((value) => value ?? null)

export const nullableUuid = z
  .string()
  .uuid()
  .nullable()
  .optional()
  .transform((value) => value ?? null)

/** Trimmed text. Empty and missing both become null. */
export const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => (value === '' ? null : value))
    .nullable()
    .optional()
    .transform((value) => value ?? null)

export const versionField = z.number().int().min(1)

export const versionBodySchema = z.object({ version: versionField })
export type VersionBody = z.output<typeof versionBodySchema>

export const idParamsSchema = z.object({ id: z.string().uuid() })

/** Money columns in the CRM tables stop at one trillion fils, the same ceiling as the database checks. */
export const MAX_MINOR = 1_000_000_000_000
