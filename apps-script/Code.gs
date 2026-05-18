// Family Budget — Google Sheets backend
//
// Storage model: single cell (Sheet1!A1) holds the budget envelope as a
// JSON string with the shape:
//   { version: number, data: BudgetSnapshot, updatedAt: string }
// `version` mirrors `STORE_VERSION` from `lib/store.ts`. doPost rejects
// writes whose `body.version` is older than the stored one, so a stale
// client cannot clobber a newer envelope.
//
// Apps Script Web Apps cannot read request headers (e.headers is not
// exposed), so the shared-token check uses the query string `?token=`.
// The Next.js app sends the token both as ?token= and as an Authorization
// header — the header is forward-compat only.

const SHEET_NAME = 'Sheet1';
const CELL = 'A1';

// Optional shared-secret guard. Set SHARED_TOKEN via Apps Script
// "Project Settings → Script Properties" (key: SHARED_TOKEN). If unset,
// auth is disabled. If set, incoming requests must include ?token=<value>.
function getToken_() {
  return PropertiesService.getScriptProperties().getProperty('SHARED_TOKEN') || '';
}

function checkAuth_(e) {
  const required = getToken_();
  if (!required) return true;
  const provided = (e && e.parameter && e.parameter.token) || '';
  return provided === required;
}

function getSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) sh = ss.insertSheet(SHEET_NAME);
  return sh;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON,
  );
}

// Parse the cell into the canonical envelope shape. Returns null when the
// cell is empty, and a {version, data, updatedAt} object otherwise.
// Pre-envelope cells (legacy shape `{ data, updatedAt }`) are surfaced with
// `version: null` so the client can decide whether to import.
function readEnvelope_() {
  const raw = getSheet_().getRange(CELL).getValue();
  if (!raw) return null;
  const parsed = JSON.parse(String(raw));
  if (parsed && typeof parsed === 'object' && 'data' in parsed) {
    return {
      version: typeof parsed.version === 'number' ? parsed.version : null,
      data: parsed.data,
      updatedAt: parsed.updatedAt || null,
    };
  }
  // Absolute legacy: cell contained the snapshot directly with no wrapper.
  return { version: null, data: parsed, updatedAt: null };
}

function doGet(e) {
  if (!checkAuth_(e)) return json_({ error: 'unauthorized' });
  try {
    const env = readEnvelope_();
    if (!env) return json_({ version: null, data: null, updatedAt: null });
    return json_(env);
  } catch (err) {
    return json_({ error: 'corrupt cell', detail: String(err) });
  }
}

function doPost(e) {
  if (!checkAuth_(e)) return json_({ error: 'unauthorized' });
  let body;
  try {
    body = JSON.parse(e.postData.contents);
  } catch (err) {
    return json_({ error: 'invalid json', detail: String(err) });
  }
  if (!body || typeof body.data !== 'object' || body.data === null) {
    return json_({ error: 'invalid payload' });
  }
  const incomingVersion =
    typeof body.version === 'number' && body.version >= 0 ? body.version : null;

  // Stale-write guard: refuse when the cell already holds a newer envelope.
  let storedVersion = null;
  try {
    const existing = readEnvelope_();
    if (existing && typeof existing.version === 'number') {
      storedVersion = existing.version;
    }
  } catch (_) {
    // Ignore corrupt cell — first write recovers it.
  }
  if (
    incomingVersion !== null &&
    storedVersion !== null &&
    incomingVersion < storedVersion
  ) {
    return json_({
      error: 'stale schema',
      storedVersion,
      incomingVersion,
    });
  }

  const updatedAt = new Date().toISOString();
  const stored = JSON.stringify({
    version: incomingVersion ?? storedVersion ?? null,
    data: body.data,
    updatedAt,
  });
  getSheet_().getRange(CELL).setValue(stored);
  return json_({ version: incomingVersion ?? storedVersion ?? null, updatedAt });
}
