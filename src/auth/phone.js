/**
 * Kenyan mobile number helpers.
 *
 * The entire auth contract is built on the mobile number as the canonical
 * identifier. Everything is normalised to E.164-without-plus: `254712345678`.
 */
const KE_MOBILE_RE = /^(?:\+?254|0)([17][0-9]{8})$/;

/** Strip separators, normalise a Kenyan mobile to `254` + 9 digits. Returns null when invalid. */
export function normalizePhone(input) {
  if (typeof input !== "string") return null;
  const cleaned = input.replace(/[\s\-()]/g, "");
  const m = cleaned.match(KE_MOBILE_RE);
  if (!m) return null;
  // "0xxxx" -> "254xxxx"; "+254xxx"/"254xxx" keep the 254
  const digits = cleaned.replace(/^0/, "+254").replace(/\D/g, "");
  return digits.startsWith("254") ? digits : null;
}

export function isValidKenyanMobile(input) {
  return normalizePhone(input) !== null;
}

/** Human-friendly display, e.g. 254712345678 -> +254 712 345 678 */
export function formatPhone(national) {
  if (!national) return "";
  const c = national.replace(/\D/g, "");
  if (c.startsWith("254") && c.length === 12) return `+254 ${c.slice(3, 6)} ${c.slice(6, 9)} ${c.slice(9)}`;
  return c;
}