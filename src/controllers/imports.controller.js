import { buildProjectTemplate, importProjectWorkbook } from "../services/admin/imports.js";
import { auditEvent } from "../auth/audit.js";

/**
 * Spreadsheet import — HTTP surface, per programme.
 *
 *   GET  /api/admin/imports/projects/:slug/template   that programme's .xlsx template
 *   POST /api/admin/imports/projects/:slug            import a workbook into that programme
 *
 * Mounted behind `adminOnly`. Because programmes capture different details, the
 * template is built for ONE programme — its columns are the shared delivery
 * sheet plus that programme's own typed extra fields, and the import is
 * validated against the same sheet the console form renders.
 *
 * The workbook arrives as a base64 string in a JSON body (this router's own
 * parser allows a larger payload than the rest of the API), which keeps the
 * upload dependency-free.
 */

/** 20 MB of decoded workbook — far beyond any realistic delivery register. */
const MAX_BYTES = 20 * 1024 * 1024;

const actor = (req) => ({
  userId: req.session?.user?.id,
  phone: req.session?.user?.username,
  role: req.session?.user?.role,
});

/** 404 when the programme does not exist, 400 for anything else. */
const statusFor = (code) => (code === "NO_PROGRAMME" ? 404 : 400);

export async function getProjectTemplate(req, res, next) {
  try {
    const slug = String(req.params?.slug ?? "").trim();
    const result = await buildProjectTemplate(slug);
    if (result.error) return res.status(statusFor(result.code)).json(result);

    const { buffer, project } = result;
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="${project.slug}-delivery-template.xlsx"`);
    res.setHeader("Content-Length", String(buffer.length));
    res.setHeader("Cache-Control", "no-store");
    res.send(buffer);
  } catch (err) {
    next(err);
  }
}

export async function importProjects(req, res, next) {
  try {
    const slug = String(req.params?.slug ?? "").trim();
    const raw = req.body?.file;
    if (typeof raw !== "string" || !raw.trim()) {
      return res.status(400).json({ error: "No workbook was uploaded", code: "NO_FILE" });
    }

    // Tolerate a data-URL prefix from the browser's FileReader.
    const base64 = raw.includes(",") ? raw.slice(raw.indexOf(",") + 1) : raw;
    const buffer = Buffer.from(base64, "base64");

    if (!buffer.length) {
      return res.status(400).json({ error: "The uploaded file is empty", code: "EMPTY_FILE" });
    }
    if (buffer.length > MAX_BYTES) {
      return res.status(413).json({
        error: `That workbook is ${(buffer.length / 1024 / 1024).toFixed(1)} MB — the limit is ${MAX_BYTES / 1024 / 1024} MB`,
        code: "TOO_LARGE",
      });
    }

    const dryRun = req.body?.dryRun === true || req.body?.dryRun === "true";
    const report = await importProjectWorkbook(buffer, { slug, dryRun });
    if (report.error) return res.status(statusFor(report.code)).json(report);

    auditEvent({
      event: "admin.import.projects",
      ...actor(req),
      programme: report.programme?.slug,
      dryRun,
      createdBeneficiaries: report.created.beneficiaries,
      errors: report.issueCount.errors,
    });

    res.json(report);
  } catch (err) {
    next(err);
  }
}

export default { getProjectTemplate, importProjects };
