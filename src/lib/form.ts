import { z } from "zod";

/** Optional trimmed string; empty becomes null so updates can clear a field. */
export const opt = (max = 200) =>
  z.string().trim().max(max).optional().transform((v) => (v ? v : null));

export const req = (max = 200) => z.string().trim().min(1, "Required").max(max);

export const optInt = (max: number) =>
  z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? Number(v) : null))
    .refine((v) => v === null || (Number.isInteger(v) && v >= 0 && v <= max), "Invalid number");

export const optDate = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v ? new Date(v) : null))
  .refine((v) => v === null || !Number.isNaN(v.getTime()), "Invalid date");

/** Checkbox: present as "on" when ticked. */
export const flag = (fd: FormData, key: string) => fd.get(key) === "on";

export const idOf = (fd: FormData) => {
  const v = fd.get("id");
  return typeof v === "string" && v ? v : null;
};

export function isUnique(e: unknown): boolean {
  return typeof e === "object" && e !== null && (e as { code?: string }).code === "P2002";
}

export function firstError(e: z.ZodError): string {
  const i = e.issues[0];
  return `${i.path.join(".") || "Form"}: ${i.message}`;
}
