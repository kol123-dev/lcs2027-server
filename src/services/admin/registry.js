/**
 * SuperAdmin resource registry.
 *
 * One entry per manageable table in the campaign database. The generic CRUD
 * engine (`resources.js`) and the admin console UI are both driven from this
 * single catalogue, so adding a dataset means adding one object here — no new
 * controller, routes or page.
 *
 * Field `type`s map to `coerce.js`:
 *   text | textarea | int | float | bool | date | json | select | relation
 *
 * `readonly` fields are shown but never written (primary keys, derived or
 * server-managed columns). `relation` fields point at another resource and are
 * rendered as a select whose options come from `/api/admin/meta` lookups.
 */

import { PROJECT_CATEGORIES, BENEFICIARY_STATUS, PROJECT_STATUS } from "../projects.js";

export const ADMIN_GROUPS = [
  { id: "geography", label: "Geography & 2022 Baseline", blurb: "Sub-counties, wards, polling stations, centres and candidates." },
  { id: "projects", label: "Projects & Deliveries", blurb: "Programmes and the beneficiary sheets issued under them." },
  { id: "roadmap", label: "Roadmap", blurb: "Dated campaign activities across the county." },
  { id: "field", label: "Field Operations", blurb: "Recruited polling agents and ward readiness records." },
  { id: "outreach", label: "Outreach", blurb: "Community blocs and their captured members." },
];

/** Local option sets — the values the rest of the app stores in these columns. */
const WARD_STATUS = ["Stronghold", "Lean Siyoi", "True Swing", "Marginal", "Opposition Bastion"];
const CENTRE_STATUS = ["Stronghold", "Marginal", "Opposition"];
const ACTIVITY_TYPES = ["mashamba", "ward-tour", "team-tour", "harambee", "burial", "party", "church-blitz", "key-event"];
const ACTIVITY_CATEGORY = ["activity", "key-event"];
const CADENCE = ["once", "weekly", "monthly"];
const ACTIVITY_STATUS = ["planned", "active", "done", "cancelled"];
const AGENT_ROLES = ["primary", "backup", "supervisor"];
const AGENT_STATUS = ["active", "inactive"];
const BLOC_CATEGORIES = ["farm", "business"];
const BLOC_STATUS = ["active", "dormant"];
const GENDERS = ["male", "female"];

const opts = (values) => values.map((v) => ({ value: v, label: v }));

const REL = {
  ward: { resource: "wards", valueField: "id", labelField: "name" },
  subCounty: { resource: "subcounties", valueField: "id", labelField: "name" },
  project: { resource: "projects", valueField: "id", labelField: "name" },
  bloc: { resource: "blocs", valueField: "id", labelField: "name" },
  // Polling centres are stored by IEBC code, so that is the option value.
  // `scopeField` narrows the list to the ward picked in the same form and
  // `labelSuffix` shows the code beside the name (centre names repeat).
  station: {
    resource: "stations",
    valueField: "code",
    labelField: "name",
    scopeField: "wardId",
    labelSuffixField: "code",
  },
};

export const RESOURCES = [
  // ---------------------------------------------------------------- geography
  {
    key: "subcounties",
    model: "subCounty",
    group: "geography",
    label: "Sub-Counties",
    singular: "Sub-county",
    titleField: "name",
    keyField: "id",
    keyType: "string",
    keyGenerated: false,
    searchFields: ["id", "name", "opponent"],
    defaultSort: { field: "name", dir: "asc" },
    columns: [
      { key: "id", label: "ID", mono: true },
      { key: "name", label: "Sub-county" },
      { key: "registered", label: "Registered", align: "right", mono: true },
      { key: "siyoi", label: "Siyoi 2022", align: "right", mono: true },
      { key: "margin", label: "Margin", align: "right", mono: true },
    ],
    fields: [
      { name: "id", label: "ID (slug)", type: "text", required: true, readonly: true, section: "Identity", help: "Stable slug, e.g. kwanza" },
      { name: "name", label: "Name", type: "text", required: true, section: "Identity" },
      { name: "registered", label: "Registered voters", type: "int", required: true, min: 0, section: "2022 baseline" },
      { name: "cast", label: "Votes cast", type: "int", required: true, min: 0, section: "2022 baseline" },
      { name: "rejected", label: "Rejected", type: "int", required: true, min: 0, section: "2022 baseline" },
      { name: "valid", label: "Valid votes", type: "int", required: true, min: 0, section: "2022 baseline" },
      { name: "siyoi", label: "Siyoi votes", type: "int", required: true, min: 0, section: "2022 baseline" },
      { name: "khatundi", label: "Khatundi votes", type: "int", required: true, min: 0, section: "2022 baseline" },
      { name: "nakhumicha", label: "Nakhumicha votes", type: "int", required: true, min: 0, section: "2022 baseline" },
      { name: "margin", label: "Margin (can be negative)", type: "int", required: true, section: "2022 baseline" },
      { name: "opponent", label: "Closest opponent", type: "text", section: "2022 baseline" },
      { name: "turnoutPct", label: "Turnout %", type: "float", section: "2022 baseline" },
      { name: "siyoiShare", label: "Siyoi share", type: "float", section: "2022 baseline" },
      { name: "candidates", label: "Candidates (JSON)", type: "json", jsonShape: "object", section: "Raw data" },
    ],
  },
  {
    key: "wards",
    model: "ward",
    group: "geography",
    label: "Wards",
    singular: "Ward",
    titleField: "name",
    keyField: "id",
    keyType: "string",
    keyGenerated: false,
    searchFields: ["id", "name", "constituency", "wardCode", "leader"],
    defaultSort: { field: "name", dir: "asc" },
    include: { subCounty: { select: { name: true } } },
    columns: [
      { key: "name", label: "Ward" },
      { key: "constituency", label: "Sub-county" },
      { key: "subCountyId", label: "Parent record", ref: "subcounties" },
      { key: "registered", label: "Registered", align: "right", mono: true },
      { key: "siyoi", label: "Siyoi 2022", align: "right", mono: true },
      { key: "status", label: "Sticker" },
    ],
    fields: [
      { name: "id", label: "ID (slug)", type: "text", required: true, readonly: true, section: "Identity", help: "e.g. matisi-ward" },
      { name: "name", label: "Ward name", type: "text", required: true, section: "Identity" },
      { name: "constituency", label: "Sub-county (name)", type: "text", required: true, section: "Identity" },
      { name: "wardCode", label: "Ward code", type: "text", required: true, section: "Identity" },
      { name: "subCountyId", label: "Parent sub-county", type: "relation", relation: REL.subCounty, required: true, section: "Identity" },
      { name: "registered", label: "Registered voters", type: "int", required: true, min: 0, section: "2022 baseline" },
      { name: "cast", label: "Votes cast", type: "int", required: true, min: 0, section: "2022 baseline" },
      { name: "rejected", label: "Rejected", type: "int", required: true, min: 0, section: "2022 baseline" },
      { name: "valid", label: "Valid votes", type: "int", required: true, min: 0, section: "2022 baseline" },
      { name: "siyoi", label: "Siyoi votes", type: "int", required: true, min: 0, section: "2022 baseline" },
      { name: "khatundi", label: "Khatundi votes", type: "int", required: true, min: 0, section: "2022 baseline" },
      { name: "nakhumicha", label: "Nakhumicha votes", type: "int", required: true, min: 0, section: "2022 baseline" },
      { name: "margin", label: "Margin (can be negative)", type: "int", required: true, section: "2022 baseline" },
      { name: "leader", label: "Ward leader", type: "text", section: "Campaign" },
      { name: "status", label: "Officials' sticker", type: "select", options: opts(WARD_STATUS), section: "Campaign" },
      { name: "siyoiShare", label: "Siyoi share", type: "float", section: "Campaign" },
      { name: "candidates", label: "Candidates (JSON)", type: "json", jsonShape: "object", section: "Raw data" },
    ],
  },
  {
    key: "stations",
    model: "station",
    group: "geography",
    label: "Polling Stations",
    singular: "Polling station",
    titleField: "name",
    keyField: "id",
    keyType: "int",
    keyGenerated: true,
    searchFields: ["code", "name", "constituency"],
    defaultSort: { field: "sortOrder", dir: "asc" },
    columns: [
      { key: "code", label: "IEBC code", mono: true },
      { key: "name", label: "Station" },
      { key: "constituency", label: "Sub-county" },
      { key: "registered", label: "Registered", align: "right", mono: true },
      { key: "siyoi", label: "Siyoi 2022", align: "right", mono: true },
    ],
    fields: [
      { name: "id", label: "ID", type: "int", readonly: true, section: "Identity" },
      { name: "code", label: "IEBC code", type: "text", required: true, section: "Identity" },
      { name: "name", label: "Station name", type: "text", required: true, section: "Identity" },
      { name: "constituency", label: "Sub-county", type: "text", required: true, section: "Identity" },
      { name: "wardId", label: "Ward", type: "relation", relation: REL.ward, required: true, section: "Identity" },
      { name: "sortOrder", label: "Sort order", type: "int", min: 0, section: "Identity" },
      { name: "registered", label: "Registered voters", type: "int", required: true, min: 0, section: "2022 baseline" },
      { name: "cast", label: "Votes cast", type: "int", required: true, min: 0, section: "2022 baseline" },
      { name: "rejected", label: "Rejected", type: "int", required: true, min: 0, section: "2022 baseline" },
      { name: "valid", label: "Valid votes", type: "int", required: true, min: 0, section: "2022 baseline" },
      { name: "siyoi", label: "Siyoi votes", type: "int", required: true, min: 0, section: "2022 baseline" },
      { name: "khatundi", label: "Khatundi votes", type: "int", required: true, min: 0, section: "2022 baseline" },
      { name: "nakhumicha", label: "Nakhumicha votes", type: "int", required: true, min: 0, section: "2022 baseline" },
      { name: "verification", label: "Verification note", type: "text", section: "2022 baseline" },
      { name: "candidates", label: "Candidates (JSON)", type: "json", jsonShape: "object", section: "Raw data" },
    ],
  },
  {
    key: "centres",
    model: "centre",
    group: "geography",
    label: "Polling Centres",
    singular: "Polling centre",
    titleField: "name",
    keyField: "id",
    keyType: "int",
    keyGenerated: true,
    searchFields: ["name", "constituency", "ward", "wardCode"],
    defaultSort: { field: "sortOrder", dir: "asc" },
    columns: [
      { key: "name", label: "Centre" },
      { key: "ward", label: "Ward" },
      { key: "status", label: "Status" },
      { key: "registered", label: "Registered", align: "right", mono: true },
      { key: "siyoi", label: "Siyoi 2022", align: "right", mono: true },
    ],
    fields: [
      { name: "id", label: "ID", type: "int", readonly: true, section: "Identity" },
      { name: "name", label: "Centre name", type: "text", required: true, section: "Identity" },
      { name: "constituency", label: "Sub-county", type: "text", required: true, section: "Identity" },
      { name: "ward", label: "Ward (name)", type: "text", required: true, section: "Identity" },
      { name: "wardCode", label: "Ward code", type: "text", required: true, section: "Identity" },
      { name: "wardId", label: "Ward", type: "relation", relation: REL.ward, required: true, section: "Identity" },
      { name: "sortOrder", label: "Sort order", type: "int", min: 0, section: "Identity" },
      { name: "registered", label: "Registered voters", type: "int", required: true, min: 0, section: "2022 baseline" },
      { name: "cast", label: "Votes cast", type: "int", required: true, min: 0, section: "2022 baseline" },
      { name: "rejected", label: "Rejected", type: "int", required: true, min: 0, section: "2022 baseline" },
      { name: "valid", label: "Valid votes", type: "int", required: true, min: 0, section: "2022 baseline" },
      { name: "status", label: "Status", type: "select", options: opts(CENTRE_STATUS), required: true, section: "Campaign" },
      { name: "statusOfficial", label: "Status is official", type: "bool", section: "Campaign" },
      { name: "campaignMessage", label: "Campaign message", type: "textarea", section: "Campaign" },
      { name: "keyAchievements", label: "Key achievements (JSON array)", type: "json", jsonShape: "array", section: "Campaign" },
      { name: "candidates", label: "Candidates (JSON)", type: "json", jsonShape: "object", section: "Raw data" },
    ],
  },
  {
    key: "candidates",
    model: "candidate",
    group: "geography",
    label: "Candidates",
    singular: "Candidate",
    titleField: "name",
    keyField: "key",
    keyType: "string",
    keyGenerated: false,
    searchFields: ["key", "name", "short"],
    defaultSort: { field: "rank", dir: "asc" },
    columns: [
      { key: "key", label: "Key", mono: true },
      { key: "name", label: "Candidate" },
      { key: "short", label: "Short" },
      { key: "votes", label: "Votes", align: "right", mono: true },
      { key: "rank", label: "Rank", align: "right", mono: true },
    ],
    fields: [
      { name: "key", label: "Key", type: "text", required: true, readonly: true, section: "Identity", help: "e.g. lcs" },
      { name: "name", label: "Name", type: "text", required: true, section: "Identity" },
      { name: "short", label: "Short label", type: "text", required: true, section: "Identity" },
      { name: "votes", label: "Votes", type: "int", required: true, min: 0, section: "2022 baseline" },
      { name: "share", label: "Share", type: "float", section: "2022 baseline" },
      { name: "rank", label: "Rank", type: "int", required: true, min: 1, section: "2022 baseline" },
    ],
  },

  // ----------------------------------------------------------------- projects
  {
    key: "projects",
    model: "project",
    group: "projects",
    label: "Programmes",
    singular: "Programme",
    titleField: "name",
    keyField: "id",
    keyType: "string",
    keyGenerated: true,
    searchFields: ["slug", "name", "summary", "description"],
    defaultSort: { field: "order", dir: "asc" },
    columns: [
      { key: "name", label: "Programme" },
      { key: "slug", label: "Slug", mono: true },
      { key: "category", label: "Family" },
      { key: "unit", label: "Unit" },
      { key: "metric", label: "Metric" },
      { key: "status", label: "Status" },
      { key: "order", label: "Order", align: "right", mono: true },
    ],
    fields: [
      { name: "slug", label: "Slug", type: "text", required: true, section: "Identity", help: "URL key, e.g. scholarships" },
      { name: "name", label: "Programme name", type: "text", required: true, section: "Identity" },
      { name: "category", label: "Family", type: "select", required: true, options: PROJECT_CATEGORIES.map((c) => ({ value: c.id, label: c.label })), section: "Identity" },
      { name: "status", label: "Status", type: "select", required: true, options: opts(PROJECT_STATUS), section: "Identity" },
      { name: "unit", label: "Unit issued", type: "text", section: "Identity", help: "what one record issues, e.g. mattress" },
      { name: "metric", label: "Headline metric", type: "select", options: opts(["count", "amount"]), section: "Identity" },
      { name: "order", label: "Display order", type: "int", min: 0, section: "Identity" },
      { name: "startDate", label: "Start date", type: "date", section: "Identity" },
      { name: "summary", label: "Summary", type: "textarea", section: "Narrative" },
      { name: "description", label: "Description", type: "textarea", section: "Narrative" },
      {
        name: "detailFields",
        label: "Sheet fields (JSON array of {key,label,type,…})",
        type: "json",
        jsonShape: "array",
        section: "Sheet shape",
        help: "A shared field name (name, parentName, phone, wardId…) relabels or hides that column; any other key adds a typed extra: {key,label,type,options?,required?,help?} with type text|textarea|select|number|date.",
      },
    ],
  },
  {
    key: "beneficiaries",
    model: "projectBeneficiary",
    group: "projects",
    label: "Beneficiaries",
    singular: "Beneficiary sheet",
    titleField: "name",
    keyField: "id",
    keyType: "string",
    keyGenerated: true,
    searchFields: ["name", "parentName", "phone", "village", "stationName"],
    defaultSort: { field: "createdAt", dir: "desc" },
    include: { project: { select: { name: true } }, ward: { select: { name: true } } },
    columns: [
      { key: "name", label: "Beneficiary" },
      { key: "projectId", label: "Programme", ref: "projects" },
      { key: "phone", label: "Phone", mono: true },
      { key: "wardId", label: "Ward", ref: "wards" },
      { key: "quantity", label: "Qty", align: "right", mono: true },
      { key: "amount", label: "Amount", align: "right", mono: true },
      { key: "status", label: "Status" },
    ],
    fields: [
      { name: "projectId", label: "Programme", type: "relation", relation: REL.project, required: true, section: "Identity" },
      { name: "name", label: "Beneficiary / group", type: "text", required: true, section: "Identity" },
      { name: "parentName", label: "Parent / guardian", type: "text", section: "Identity" },
      { name: "phone", label: "Active phone", type: "text", section: "Identity", help: "07xx / 2547xx / +2547xx" },
      { name: "wardId", label: "Ward", type: "relation", relation: REL.ward, section: "Location" },
      { name: "village", label: "Village", type: "text", section: "Location" },
      {
        name: "stationCode",
        label: "Polling centre",
        type: "relation",
        relation: REL.station,
        // The sheet keeps the centre's code and name in two columns; picking a
        // centre here fills both (`resources.js` resolves the mirror column).
        companion: "stationName",
        section: "Location",
        help: "Choose a ward to narrow the list",
      },
      { name: "quantity", label: "Quantity issued", type: "int", min: 0, section: "Delivery" },
      { name: "amount", label: "Amount issued (KES)", type: "float", min: 0, section: "Delivery" },
      { name: "dateIssued", label: "Date issued", type: "date", section: "Delivery" },
      { name: "status", label: "Status", type: "select", required: true, options: opts(BENEFICIARY_STATUS), section: "Delivery" },
      { name: "details", label: "Programme extras (JSON object)", type: "json", jsonShape: "object", section: "Delivery" },
      { name: "notes", label: "Notes", type: "textarea", section: "Delivery" },
    ],
  },

  // ------------------------------------------------------------------ roadmap
  {
    key: "activities",
    model: "campaignActivity",
    group: "roadmap",
    label: "Activities",
    singular: "Campaign activity",
    titleField: "title",
    keyField: "id",
    keyType: "string",
    keyGenerated: true,
    searchFields: ["title", "location", "owner", "stationName"],
    defaultSort: { field: "date", dir: "asc" },
    include: { ward: { select: { name: true } }, bloc: { select: { name: true } } },
    columns: [
      { key: "title", label: "Activity" },
      { key: "type", label: "Type" },
      { key: "date", label: "Date", mono: true },
      { key: "wardId", label: "Ward", ref: "wards" },
      { key: "blocId", label: "Bloc", ref: "blocs" },
      { key: "status", label: "Status" },
    ],
    fields: [
      { name: "title", label: "Title", type: "text", required: true, section: "Identity" },
      { name: "type", label: "Type", type: "select", required: true, options: opts(ACTIVITY_TYPES), section: "Identity" },
      { name: "category", label: "Category", type: "select", required: true, options: opts(ACTIVITY_CATEGORY), section: "Identity" },
      { name: "date", label: "Date", type: "date", required: true, section: "Schedule" },
      { name: "endDate", label: "End date", type: "date", section: "Schedule" },
      { name: "cadence", label: "Cadence", type: "select", options: opts(CADENCE), section: "Schedule" },
      { name: "status", label: "Status", type: "select", required: true, options: opts(ACTIVITY_STATUS), section: "Schedule" },
      { name: "wardId", label: "Ward", type: "relation", relation: REL.ward, section: "Location" },
      { name: "subCountyId", label: "Sub-county ID", type: "text", section: "Location" },
      { name: "blocId", label: "Bloc", type: "relation", relation: REL.bloc, section: "Location" },
      { name: "location", label: "Venue / location", type: "text", section: "Location" },
      { name: "stationCode", label: "Polling centre code", type: "text", section: "Location" },
      { name: "stationName", label: "Polling centre name", type: "text", section: "Location" },
      { name: "owner", label: "Owner / lead", type: "text", section: "Delivery" },
      { name: "description", label: "Description", type: "textarea", section: "Delivery" },
      { name: "notes", label: "Notes", type: "textarea", section: "Delivery" },
    ],
  },

  // -------------------------------------------------------------------- field
  {
    key: "agents",
    model: "agent",
    group: "field",
    label: "Agents",
    singular: "Polling agent",
    titleField: "fullName",
    keyField: "id",
    keyType: "string",
    keyGenerated: true,
    searchFields: ["fullName", "idNumber", "phone", "stationName", "stationCode"],
    defaultSort: { field: "fullName", dir: "asc" },
    include: { ward: { select: { name: true } } },
    columns: [
      { key: "fullName", label: "Agent" },
      { key: "role", label: "Role" },
      { key: "phone", label: "Phone", mono: true },
      { key: "wardId", label: "Ward", ref: "wards" },
      { key: "stationName", label: "Polling station" },
      { key: "status", label: "Status" },
    ],
    fields: [
      { name: "fullName", label: "Full name", type: "text", required: true, section: "Identity" },
      { name: "idNumber", label: "National ID", type: "text", required: true, section: "Identity" },
      { name: "gender", label: "Gender", type: "select", required: true, options: opts(GENDERS), section: "Identity" },
      { name: "phone", label: "Phone", type: "text", required: true, section: "Identity", help: "254XXXXXXXXX" },
      { name: "altPhone", label: "Alternative phone", type: "text", section: "Identity" },
      { name: "role", label: "Role", type: "select", required: true, options: opts(AGENT_ROLES), section: "Deployment" },
      { name: "status", label: "Status", type: "select", required: true, options: opts(AGENT_STATUS), section: "Deployment" },
      { name: "wardId", label: "Ward", type: "relation", relation: REL.ward, section: "Deployment" },
      { name: "stationCode", label: "Station code", type: "text", section: "Deployment" },
      { name: "stationName", label: "Station name", type: "text", section: "Deployment" },
    ],
  },
  {
    key: "readiness",
    model: "wardReadiness",
    group: "field",
    label: "Ward Readiness",
    singular: "Readiness record",
    titleField: "wardId",
    keyField: "wardId",
    keyType: "string",
    keyGenerated: false,
    searchFields: ["wardId"],
    defaultSort: { field: "wardId", dir: "asc" },
    include: { ward: { select: { name: true } } },
    columns: [
      { key: "wardId", label: "Ward", ref: "wards" },
      { key: "captainsRecruited", label: "Captains rec.", align: "right", mono: true },
      { key: "captainsTrained", label: "Captains tr.", align: "right", mono: true },
      { key: "agentsRecruited", label: "Agents rec.", align: "right", mono: true },
      { key: "agentsTrained", label: "Agents tr.", align: "right", mono: true },
      { key: "gotvBriefed", label: "GOTV briefed", align: "right", mono: true },
    ],
    fields: [
      { name: "wardId", label: "Ward", type: "relation", relation: REL.ward, required: true, readonly: true, section: "Identity" },
      { name: "captainsRecruited", label: "Captains recruited", type: "int", min: 0, section: "Readiness" },
      { name: "captainsTrained", label: "Captains trained", type: "int", min: 0, section: "Readiness" },
      { name: "agentsRecruited", label: "Agents recruited", type: "int", min: 0, section: "Readiness" },
      { name: "agentsTrained", label: "Agents trained", type: "int", min: 0, section: "Readiness" },
      { name: "parallelTallyReady", label: "Parallel tally ready", type: "int", min: 0, section: "Readiness" },
      { name: "gotvBriefed", label: "GOTV briefed", type: "int", min: 0, section: "Readiness" },
    ],
  },

  // ----------------------------------------------------------------- outreach
  {
    key: "blocs",
    model: "bloc",
    group: "outreach",
    label: "Blocs",
    singular: "Bloc",
    titleField: "name",
    keyField: "id",
    keyType: "string",
    keyGenerated: true,
    searchFields: ["name", "officialName", "officialPhone", "stationName"],
    defaultSort: { field: "name", dir: "asc" },
    include: { ward: { select: { name: true } } },
    columns: [
      { key: "name", label: "Bloc" },
      { key: "category", label: "Category" },
      { key: "wardId", label: "Ward", ref: "wards" },
      { key: "population", label: "Members", align: "right", mono: true },
      { key: "officialName", label: "Official" },
      { key: "status", label: "Status" },
    ],
    fields: [
      { name: "name", label: "Bloc name", type: "text", required: true, section: "Identity" },
      { name: "category", label: "Category", type: "select", required: true, options: opts(BLOC_CATEGORIES), section: "Identity" },
      { name: "status", label: "Status", type: "select", required: true, options: opts(BLOC_STATUS), section: "Identity" },
      { name: "population", label: "Population spoken for", type: "int", min: 0, section: "Identity" },
      { name: "officialName", label: "Official / chairman", type: "text", required: true, section: "Official" },
      { name: "officialPhone", label: "Official phone", type: "text", required: true, section: "Official" },
      { name: "officialId", label: "Official national ID", type: "text", required: true, section: "Official" },
      { name: "wardId", label: "Ward", type: "relation", relation: REL.ward, section: "Location" },
      { name: "stationCode", label: "Polling centre code", type: "text", section: "Location" },
      { name: "stationName", label: "Polling centre name", type: "text", section: "Location" },
      { name: "engagements", label: "Engagements", type: "int", min: 0, section: "Outreach" },
      { name: "issues", label: "Issues logged", type: "int", min: 0, section: "Outreach" },
      { name: "messages", label: "Messages delivered", type: "int", min: 0, section: "Outreach" },
      { name: "keyMessages", label: "Key messages (JSON array)", type: "json", jsonShape: "array", section: "Outreach" },
    ],
  },
  {
    key: "bloc-members",
    model: "blocMember",
    group: "outreach",
    label: "Bloc Members",
    singular: "Bloc member",
    titleField: "fullName",
    keyField: "id",
    keyType: "string",
    keyGenerated: true,
    searchFields: ["fullName", "idNumber", "phone"],
    defaultSort: { field: "fullName", dir: "asc" },
    include: { bloc: { select: { name: true } } },
    columns: [
      { key: "fullName", label: "Member" },
      { key: "blocId", label: "Bloc", ref: "blocs" },
      { key: "gender", label: "Gender" },
      { key: "phone", label: "Phone", mono: true },
    ],
    fields: [
      { name: "blocId", label: "Bloc", type: "relation", relation: REL.bloc, required: true, section: "Identity" },
      { name: "fullName", label: "Full name", type: "text", required: true, section: "Identity" },
      { name: "idNumber", label: "National ID", type: "text", required: true, section: "Identity" },
      { name: "gender", label: "Gender", type: "select", required: true, options: opts(GENDERS), section: "Identity" },
      { name: "phone", label: "Phone", type: "text", required: true, section: "Identity" },
    ],
  },
];

const BY_KEY = new Map(RESOURCES.map((r) => [r.key, r]));

export function resourceByKey(key) {
  return BY_KEY.get(String(key)) ?? null;
}

/** Every `relation` descriptor used across the registry, de-duplicated. */
export function relationTargets() {
  const targets = new Map();
  for (const r of RESOURCES) {
    for (const f of r.fields) {
      if (f.type === "relation" && f.relation) targets.set(f.relation.resource, f.relation);
    }
  }
  return [...targets.values()];
}

/** Compact metadata handed to the admin console (no server-only hints leak). */
export function publicResource(r) {
  return {
    key: r.key,
    label: r.label,
    singular: r.singular,
    group: r.group,
    titleField: r.titleField,
    keyField: r.keyField,
    keyType: r.keyType,
    keyGenerated: r.keyGenerated,
    columns: r.columns,
    fields: r.fields,
    defaultSort: r.defaultSort,
  };
}

export default { ADMIN_GROUPS, RESOURCES, resourceByKey, relationTargets, publicResource };
