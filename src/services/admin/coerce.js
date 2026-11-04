/**
 * Field coercion for the admin console.
 *
 * The admin registry describes every editable column as a typed field
 * (`text` | `textarea` | `int` | `float` | `bool` | `date` | `json` | `select`
 * | `relation`). This module turns the raw JSON strings the browser sends into
 * the exact values Prisma expects, and returns readable validation errors
 * instead of letting a bad payload reach the database.
 *
 * `json` fields are stored as TEXT on MySQL (the campaign's convention for
 * structured columns), so they are validated then re-serialised here.
 */

const TEXT_MAX = 200;
const LONG_MAX = 20_000;

const isBlank = (v) => v === "" || v === undefined || v === null;

const clampText = (v, max) => String(v).trim().slice(0, max);

/** Validate + normalise one field. Returns { value } or { error }. */
function one(field, raw) {
  const label = field.label ?? field.name;

  if (field.type === "bool") {
    if (raw === true || raw === "true" || raw === 1 || raw === "1") return { value: true };
    if (raw === false || raw === "false" || raw === 0 || raw === "0") return { value: false };
    return { error: `${label} must be true or false` };
  }

  // Everything else treats a blank string as "not supplied".
  if (isBlank(raw)) {
    if (field.required) return { error: `${label} is required` };
    if (field.type === "json") {
      const shape = field.jsonShape === "array" ? "[]" : "{}";
      return { value: field.jsonShape === "array" ? "[]" : shape };
    }
    return { value: null };
  }

  switch (field.type) {
    case "int": {
      const n = Number(raw);
      if (!Number.isFinite(n) || !Number.isInteger(n)) return { error: `${label} must be a whole number` };
      if (field.min !== undefined && n < field.min) return { error: `${label} must be at least ${field.min}` };
      if (field.max !== undefined && n > field.max) return { error: `${label} must be at most ${field.max}` };
      return { value: n };
    }
    case "float": {
      const n = Number(raw);
      if (!Number.isFinite(n)) return { error: `${label} must be a number` };
      if (field.min !== undefined && n < field.min) return { error: `${label} must be at least ${field.min}` };
      if (field.max !== undefined && n > field.max) return { error: `${label} must be at most ${field.max}` };
      return { value: Math.round(n * 10000) / 10000 };
    }
    case "date": {
      const d = new Date(raw);
      if (Number.isNaN(d.getTime())) return { error: `${label} is not a valid date` };
      return { value: d };
    }
    case "select": {
      const v = String(raw).trim();
      const allowed = (field.options ?? []).map((o) => (typeof o === "string" ? o : o.value));
      if (allowed.length && !allowed.includes(v)) return { error: `${label} must be one of: ${allowed.join(", ")}` };
      return { value: v };
    }
    case "relation":
      return { value: String(raw).trim() };
    case "json": {
      let parsed = raw;
      if (typeof raw === "string") {
        try {
          parsed = JSON.parse(raw);
        } catch {
          return { error: `${label} must be valid JSON` };
        }
      }
      const wantArray = field.jsonShape === "array";
      if (wantArray && !Array.isArray(parsed)) return { error: `${label} must be a JSON array` };
      if (!wantArray && (typeof parsed !== "object" || parsed === null || Array.isArray(parsed))) {
        return { error: `${label} must be a JSON object` };
      }
      return { value: JSON.stringify(parsed) };
    }
    case "textarea":
      return { value: clampText(raw, field.max ?? LONG_MAX) };
    default:
      return { value: clampText(raw, field.max ?? TEXT_MAX) };
  }
}

/**
 * Coerce a whole payload against a resource's field list.
 *
 * @param fields  registry field descriptors (readonly ones are ignored)
 * @param payload raw request body
 * @param opts.partial  true for an update — only supplied keys are touched
 * @returns { data, errors }
 */
export function coerceFields(fields, payload = {}, { partial = false } = {}) {
  const data = {};
  const errors = [];

  for (const field of fields) {
    if (field.readonly) continue;
    const supplied = Object.prototype.hasOwnProperty.call(payload, field.name);

    if (!supplied) {
      if (!partial && field.required) errors.push(`${field.label ?? field.name} is required`);
      continue;
    }

    const { value, error } = one(field, payload[field.name]);
    if (error) {
      errors.push(error);
      continue;
    }
    data[field.name] = value;
  }

  return { data, errors };
}

export default { coerceFields };
