import ExcelJS from "exceljs";
import prisma from "../../db.js";
import context from "../../data/context.js";
import { createBeneficiary, buildBeneficiary, sheetOf, BENEFICIARY_STATUS } from "../projects.js";

/**
 * Spreadsheet import for one programme's delivery register.
 *
 * Because programmes capture different details, the template is built per
 * programme: its columns are the shared delivery sheet plus that programme's
 * own extra fields, typed exactly as the beneficiary form renders them. Rows
 * are translated into the same payloads the dashboard sends and handed to
 * `createBeneficiary`, so the spreadsheet can never write something the form
 * would have rejected.
 *
 * `dryRun` validates everything and reports what would happen without writing,
 * which is what the console's "Validate only" button uses.
 */

const { Workbook } = ExcelJS;

const DATA_SHEET = "Beneficiaries";
const REFERENCE_SHEET = "Reference";
const INSTRUCTIONS_SHEET = "Instructions";

/** Rows below the header that carry a dropdown, so a blank row still validates. */
const VALIDATION_ROWS = 300;

// ------------------------------------------------------------------ helpers

const norm = (v) => String(v ?? "").trim().toLowerCase().replace(/[^a-z0-9]/g, "");

/** Read a cell as text, unwrapping rich text, formulas and hyperlinks. */
function cellText(cell) {
  const v = cell?.value;
  if (v === null || v === undefined) return "";
  if (v instanceof Date) return v;
  if (typeof v === "object") {
    if (Array.isArray(v.richText)) return v.richText.map((r) => r.text ?? "").join("").trim();
    if (v.result !== undefined) return v.result;
    if (v.text !== undefined) return String(v.text).trim();
    if (v.hyperlink !== undefined) return String(v.hyperlink).trim();
    return "";
  }
  if (typeof v === "string") return v.trim();
  return v;
}

const asText = (v) => (v instanceof Date ? v.toISOString().slice(0, 10) : String(v ?? "").trim());

/** "25,000 KES" -> 25000. Returns null when the cell holds no number at all. */
function asNumber(v) {
  if (v === "" || v === null || v === undefined) return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const cleaned = String(v).replace(/[^0-9.\-]/g, "");
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

const wardIdByName = new Map();
for (const w of context.wards) {
  wardIdByName.set(norm(w.name), w.id);
  wardIdByName.set(norm(w.wardCode), w.id);
}

/** Match typed polling-centre text against the ward's own centre list. */
function matchCentre(wardId, text) {
  const needle = norm(text);
  if (!needle || !wardId) return null;
  return context.centres.find((c) => c.wardId === wardId && norm(c.name) === needle) ?? null;
}

// ------------------------------------------------------------------ columns

/** The template column for one shared sheet field. */
function baseColumn(b) {
  switch (b.key) {
    case "name":
      return { key: "name", header: b.label, width: 30 };
    case "parentName":
      return { key: "parentName", header: b.label, width: 24 };
    case "phone":
      return { key: "phone", header: b.label, width: 18 };
    case "wardId":
      return { key: "wardId", header: b.label, aliases: ["ward"], width: 28, list: "wards" };
    case "village":
      return { key: "village", header: b.label, width: 20 };
    case "stationCode":
      return { key: "stationCode", header: b.label, aliases: ["polling centre", "polling center"], width: 26 };
    case "quantity":
      return { key: "quantity", header: b.label, width: 14 };
    case "amount":
      return { key: "amount", header: b.label, width: 18 };
    case "dateIssued":
      return { key: "dateIssued", header: b.label, width: 14, date: true };
    case "status":
      return { key: "status", header: b.label, width: 12, list: "beneficiaryStatus" };
    case "notes":
      return { key: "notes", header: b.label, width: 32 };
    default:
      return { key: b.key, header: b.label, width: 20 };
  }
}

/**
 * The programme's column list: every shared field it kept, then its own extra
 * columns, with Notes last. Extra columns carry a `x:` prefix so a programme
 * field can never collide with a shared column.
 */
function columnsFor(sheet) {
  const cols = [];
  for (const b of sheet.base) {
    if (b.key === "notes") continue;
    cols.push(baseColumn(b));
  }
  for (const e of sheet.extras) {
    cols.push({
      key: `x:${e.key}`,
      header: e.label,
      aliases: [e.key],
      width: 24,
      ...(e.type === "select" ? { list: `opt:${e.key}` } : {}),
    });
  }
  const notes = sheet.base.find((b) => b.key === "notes");
  if (notes) cols.push(baseColumn(notes));
  return cols;
}

/** Resolve a spreadsheet header row into { columnKey: cellIndex }. */
function mapHeaderRow(row, columns) {
  const byHeader = new Map();
  for (const c of columns) {
    byHeader.set(norm(c.header), c.key);
    byHeader.set(norm(c.key), c.key);
    for (const a of c.aliases ?? []) byHeader.set(norm(a), c.key);
  }
  const index = {};
  row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
    const key = byHeader.get(norm(cellText(cell)));
    if (key && index[key] === undefined) index[key] = colNumber;
  });
  return index;
}

/** Pull one row into a { key: value } object using the header index. */
function readRow(row, index) {
  const out = {};
  for (const [key, col] of Object.entries(index)) out[key] = cellText(row.getCell(col));
  return out;
}

/** Read a sheet into `{ rowNumber, data }`, skipping rows that are fully blank. */
function readSheet(wb, name, columns) {
  const ws = wb.getWorksheet(name);
  if (!ws) return { missing: true, rows: [] };

  // Find the header row: the first row that matches at least two known columns.
  let headerRow = 0;
  let index = {};
  for (let r = 1; r <= Math.min(10, ws.rowCount); r++) {
    const candidate = mapHeaderRow(ws.getRow(r), columns);
    if (Object.keys(candidate).length >= 2) {
      headerRow = r;
      index = candidate;
      break;
    }
  }
  if (!headerRow) return { missing: false, noHeader: true, rows: [] };

  const rows = [];
  for (let r = headerRow + 1; r <= ws.rowCount; r++) {
    const data = readRow(ws.getRow(r), index);
    const filled = Object.values(data).some((v) => asText(v) !== "");
    if (filled) rows.push({ rowNumber: r, data });
  }
  return { rows };
}

/** The programme slug a workbook was built for, read from its Instructions sheet. */
function templateProgramme(wb) {
  const ws = wb.getWorksheet(INSTRUCTIONS_SHEET);
  if (!ws) return null;
  for (let r = 1; r <= ws.rowCount; r++) {
    if (norm(cellText(ws.getCell(r, 1))) === "programmeslug") {
      const v = asText(cellText(ws.getCell(r, 2)));
      return v || null;
    }
  }
  return null;
}

// ----------------------------------------------------------------- template

function styleHeader(row) {
  row.height = 20;
  row.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F2937" } };
    cell.alignment = { vertical: "middle", horizontal: "left" };
    cell.border = { bottom: { style: "thin", color: { argb: "FF4B5563" } } };
  });
}

/**
 * Build the .xlsx template for one programme: an Instructions sheet, the
 * delivery sheet with that programme's exact columns and dropdowns, and a
 * hidden Reference sheet holding the option lists (ward names read live from
 * the register, so the dropdown is always current).
 */
export async function buildProjectTemplate(slug) {
  const project = await prisma.project.findUnique({
    where: { slug: String(slug ?? "") },
    include: { fields: { orderBy: { order: "asc" } } },
  });
  if (!project) return { error: `No programme with slug "${slug}"`, code: "NO_PROGRAMME" };

  const sheet = sheetOf(project);
  const columns = columnsFor(sheet);

  const lists = {
    beneficiaryStatus: BENEFICIARY_STATUS,
    wards: context.wards.map((w) => w.name).sort((a, b) => a.localeCompare(b)),
  };
  for (const e of sheet.extras) if (e.type === "select") lists[`opt:${e.key}`] = e.options;

  const wb = new Workbook();
  wb.creator = "TUTAM Campaign War Room";
  wb.created = new Date();

  // ------------------------------------------------------------ reference
  const ref = wb.addWorksheet(REFERENCE_SHEET);
  let refCol = 0;
  for (const [name, values] of Object.entries(lists)) {
    refCol += 1;
    const col = ref.getColumn(refCol);
    col.header = name;
    col.width = Math.max(18, name.length + 4);
    values.forEach((v, i) => {
      ref.getCell(i + 2, refCol).value = v;
    });
  }
  ref.state = "veryHidden";

  const refRange = (name, count) => {
    const colIndex = Object.keys(lists).indexOf(name) + 1;
    const letter = ref.getColumn(colIndex).letter;
    return `${REFERENCE_SHEET}!$${letter}$2:$${letter}$${Math.max(2, count + 1)}`;
  };

  // --------------------------------------------------------- instructions
  const info = wb.addWorksheet(INSTRUCTIONS_SHEET, { properties: { tabColor: { argb: "FF4FACFE" } } });
  info.columns = [{ width: 30 }, { width: 96 }];
  const heading = (text) => {
    const row = info.addRow([text]);
    row.getCell(1).font = { bold: true, size: 13, color: { argb: "FF111827" } };
    row.height = 22;
  };
  const pair = (left, right) => {
    const row = info.addRow([left, right]);
    row.getCell(1).font = { bold: true, size: 10, color: { argb: "FF374151" } };
    row.getCell(2).alignment = { wrapText: true, vertical: "top" };
  };

  info.addRow([`Delivery template — ${project.name}`]).getCell(1).font = {
    bold: true,
    size: 18,
    color: { argb: "FF0B0F19" },
  };
  info.addRow([`Import from Admin → Programmes → Import from Excel, choosing this programme.`]);
  info.addRow([]);

  heading("Programme");
  // Read back on import to catch a workbook uploaded against the wrong programme.
  pair("Programme slug", project.slug);
  pair("Programme name", project.name);
  pair("Unit issued", project.unit);
  pair("Headline metric", project.metric);
  info.addRow([]);

  heading("How it works");
  pair("Sheet", `Fill "${DATA_SHEET}". Row 1 is the header and must stay in place.`);
  pair("Columns", "Columns may be re-ordered — matching is by header text. Columns you remove are simply left blank.");
  pair("Unknown columns", "Any header the importer does not recognise is ignored.");
  pair("Empty rows", "Completely blank rows are skipped.");
  pair("Appending", "Rows are always appended. Importing the same file twice duplicates the rows, so validate first and clear the sheet once it has been imported.");
  pair("Validate first", "Use “Validate only” to see exactly what would be created or rejected before anything is written.");
  info.addRow([]);

  heading("Columns");
  for (const b of sheet.base) {
    pair(b.label + (b.required ? " *" : ""), baseHelp(b, project.unit));
  }
  for (const e of sheet.extras) {
    const bits = [e.help || `${e.label} for this beneficiary.`];
    if (e.type === "select") bits.push(`Choose one of: ${e.options.join(", ")}.`);
    if (e.type === "number") bits.push("Numbers only.");
    if (e.type === "date") bits.push("YYYY-MM-DD.");
    if (e.required) bits.push("Required.");
    pair(e.label + (e.required ? " *" : ""), bits.join(" "));
  }

  // ---------------------------------------------------------- data sheet
  const ws = wb.addWorksheet(DATA_SHEET, { views: [{ state: "frozen", ySplit: 1 }] });
  ws.columns = columns.map((c) => ({ header: c.header, key: c.key, width: c.width }));
  styleHeader(ws.getRow(1));

  const sample = {};
  for (const c of columns) sample[c.key] = "";
  sample.name = "Example row — delete before importing";
  if (columns.some((c) => c.key === "notes")) sample.notes = "Placeholder row showing the sheet shape.";
  ws.addRow(sample);

  for (const c of columns) {
    const col = ws.getColumn(c.key).number;
    if (c.list) {
      const formula = refRange(c.list, (lists[c.list] ?? []).length);
      for (let r = 2; r <= VALIDATION_ROWS; r++) {
        ws.getCell(r, col).dataValidation = {
          type: "list",
          allowBlank: true,
          formulae: [formula],
          showErrorMessage: true,
          errorTitle: "Pick from the list",
          error: `Choose one of the listed ${c.header} values, or leave blank.`,
        };
      }
    }
    if (c.date) {
      for (let r = 2; r <= VALIDATION_ROWS; r++) ws.getCell(r, col).numFmt = "yyyy-mm-dd";
    }
  }

  return { buffer: Buffer.from(await wb.xlsx.writeBuffer()), project };
}

/** One line explaining a shared field, for the Instructions sheet. */
function baseHelp(b, unit) {
  switch (b.key) {
    case "name":
      return "The person, household, group, school or stage. Required.";
    case "parentName":
      return "Optional contact for the beneficiary.";
    case "phone":
      return "07xx, 2547xx or +2547xx. Normalised automatically.";
    case "wardId":
      return "Pick from the dropdown. A ward that is not on the register is rejected, so deliveries never lose their geography.";
    case "village":
      return "Optional.";
    case "stationCode":
      return "Optional. Matched against the chosen ward's polling centres when possible.";
    case "quantity":
      return `Whole number, zero or more. Counts the ${unit}s issued. Optional.`;
    case "amount":
      return "Number, zero or more. Optional.";
    case "dateIssued":
      return "YYYY-MM-DD. Optional.";
    case "status":
      return `${BENEFICIARY_STATUS.join(" or ")}. Defaults to issued.`;
    case "notes":
      return "Free text.";
    default:
      return "Optional.";
  }
}

// ------------------------------------------------------------------- import

/** Turn one spreadsheet row into a delivery payload, collecting row issues. */
function beneficiaryPayload(row, extras, issues, rowNumber) {
  const add = (level, message) => issues.push({ sheet: DATA_SHEET, row: rowNumber, level, message });

  const name = asText(row.name);
  if (!name) add("error", "Beneficiary name is required");

  const payload = {
    name,
    parentName: asText(row.parentName),
    phone: asText(row.phone),
    village: asText(row.village),
    quantity: asNumber(row.quantity),
    amount: asNumber(row.amount),
    status: asText(row.status).toLowerCase() || "issued",
    notes: asText(row.notes),
  };

  const dateRaw = row.dateIssued;
  payload.dateIssued = dateRaw instanceof Date ? dateRaw.toISOString().slice(0, 10) : asText(dateRaw) || null;

  const rawWard = asText(row.wardId);
  let wardId = "";
  if (rawWard) {
    wardId = wardIdByName.get(norm(rawWard)) ?? "";
    if (!wardId) add("error", `Ward "${rawWard}" does not match any ward on the register`);
  }
  payload.wardId = wardId;

  // The polling centre is typed as a name and resolved against the chosen
  // ward's own centre list, so it is always a real site; an unmatched entry is
  // kept as free text rather than dropped.
  const centre = asText(row.stationCode);
  if (centre) {
    const match = matchCentre(wardId, centre);
    if (match) {
      payload.stationName = match.name;
    } else {
      payload.stationName = centre;
      if (wardId) add("warning", `Polling centre "${centre}" is not on this ward's list — saved as a name only`);
    }
  }

  const details = {};
  for (const e of extras) {
    const v = asText(row[`x:${e.key}`]);
    if (v) details[e.key] = v;
  }
  payload.details = details;

  const blocked = issues.some((i) => i.sheet === DATA_SHEET && i.row === rowNumber && i.level === "error");
  return { payload, blocked };
}

/**
 * Import a workbook into one programme's register.
 *
 * @param buffer  the .xlsx file
 * @param slug    the programme the deliveries belong to
 * @param dryRun  validate and report without writing anything
 */
export async function importProjectWorkbook(buffer, { slug, dryRun = false } = {}) {
  const project = await prisma.project.findUnique({
    where: { slug: String(slug ?? "") },
    include: { fields: { orderBy: { order: "asc" } } },
  });
  if (!project) {
    return { error: `No programme with slug "${slug}" — choose an existing programme to import into`, code: "NO_PROGRAMME" };
  }

  const wb = new Workbook();
  try {
    await wb.xlsx.load(buffer);
  } catch {
    return { error: "That file could not be read as an .xlsx workbook", code: "BAD_WORKBOOK" };
  }

  const sheet = sheetOf(project);
  const columns = columnsFor(sheet);
  const parsed = readSheet(wb, DATA_SHEET, columns);

  if (parsed.missing) {
    return { error: `The workbook needs a "${DATA_SHEET}" sheet — use the template for ${project.name}`, code: "BAD_SHEETS" };
  }
  if (parsed.noHeader) {
    return {
      error: `Could not find the header row on the "${DATA_SHEET}" sheet — download a fresh template for this programme`,
      code: "NO_HEADER",
    };
  }

  const issues = [];
  const created = { beneficiaries: 0 };

  // A workbook built for another programme would silently drop its extra
  // columns, so that mismatch is refused outright.
  const builtFor = templateProgramme(wb);
  if (builtFor && builtFor !== project.slug) {
    return {
      error: `This workbook was built for programme "${builtFor}", not "${project.slug}" — download this programme's template`,
      code: "WRONG_PROGRAMME",
    };
  }

  for (const { rowNumber, data } of parsed.rows) {
    const { payload, blocked } = beneficiaryPayload(data, sheet.extras, issues, rowNumber);
    if (blocked) continue;

    if (dryRun) {
      const { error } = buildBeneficiary(payload, { extras: sheet.extras });
      if (error) {
        issues.push({ sheet: DATA_SHEET, row: rowNumber, level: "error", message: error });
        continue;
      }
      created.beneficiaries += 1;
      continue;
    }

    // `createBeneficiary` performs the full delivery validation itself.
    const result = await createBeneficiary(project.slug, payload);
    if (result.error) {
      issues.push({ sheet: DATA_SHEET, row: rowNumber, level: "error", message: result.error });
      continue;
    }
    created.beneficiaries += 1;
  }

  const errors = issues.filter((i) => i.level === "error");
  return {
    ok: errors.length === 0,
    dryRun,
    programme: { slug: project.slug, name: project.name },
    sheets: { [DATA_SHEET]: parsed.rows.length },
    created,
    skipped: { programmes: 0 },
    issueCount: { errors: errors.length, warnings: issues.length - errors.length },
    issues,
  };
}

export default { buildProjectTemplate, importProjectWorkbook };
