// Family Budget — Google Sheets backend
// Storage model: single cell (Sheet1!A1) holds the full budget JSON as a string.
// The sheet stays human-readable in raw form; no per-row schema to maintain.

const SHEET_NAME = 'Sheet1';
const CELL = 'A1';

// Optional shared-secret guard. Set SHARED_TOKEN via Apps Script "Project Settings → Script Properties"
// (key: SHARED_TOKEN). If unset, auth is disabled. If set, incoming requests must include ?token=<value>.
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

function doGet(e) {
  if (!checkAuth_(e)) return json_({ error: 'unauthorized' });
  const raw = getSheet_().getRange(CELL).getValue();
  if (!raw) return json_({ data: null, updatedAt: null });
  try {
    const parsed = JSON.parse(String(raw));
    return json_({ data: parsed.data ?? parsed, updatedAt: parsed.updatedAt ?? null });
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
  if (!body || typeof body.data !== 'object') {
    return json_({ error: 'invalid payload' });
  }
  const updatedAt = new Date().toISOString();
  const stored = JSON.stringify({ data: body.data, updatedAt });
  getSheet_().getRange(CELL).setValue(stored);
  return json_({ updatedAt });
}
