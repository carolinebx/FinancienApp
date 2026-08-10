import { SHEET_API_URL, API_TOKEN } from "./config.js";

// Deze module geeft dezelfde API als de window.storage die Claude-artifacts gebruiken
// (get/set/delete/list), maar praat in plaats daarvan met een Google Apps Script Web App
// die als eenvoudige key-value opslag bovenop een Google Sheet werkt.
//
// Elke aanroep stuurt een "token" mee als simpele bescherming (geen echte auth, maar
// voorkomt dat willekeurige bezoekers van je Apps Script URL je sheet kunnen uitlezen).

const isConfigured = () =>
  typeof SHEET_API_URL === "string" && SHEET_API_URL.startsWith("http") && SHEET_API_URL.indexOf("PLAK_HIER") === -1;

async function get(key) {
  if (!isConfigured()) throw new Error("Google Sheet nog niet gekoppeld (zie src/config.js)");
  const url = `${SHEET_API_URL}?action=get&key=${encodeURIComponent(key)}&token=${encodeURIComponent(API_TOKEN)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Storage get failed: ${res.status}`);
  const data = await res.json();
  if (!data || data.value === undefined || data.value === null) return null;
  return { key: data.key, value: data.value, shared: false };
}

async function set(key, value) {
  if (!isConfigured()) throw new Error("Google Sheet nog niet gekoppeld (zie src/config.js)");
  const res = await fetch(SHEET_API_URL, {
    method: "POST",
    // Bewust GEEN custom headers/content-type: zo blijft dit een "simple request"
    // en hoeft de browser geen CORS-preflight te doen (Apps Script beantwoordt die niet).
    body: JSON.stringify({ action: "set", key, value, token: API_TOKEN }),
  });
  if (!res.ok) throw new Error(`Storage set failed: ${res.status}`);
  const data = await res.json();
  return { key: data.key, value: data.value, shared: false };
}

async function del(key) {
  if (!isConfigured()) throw new Error("Google Sheet nog niet gekoppeld (zie src/config.js)");
  const res = await fetch(SHEET_API_URL, {
    method: "POST",
    body: JSON.stringify({ action: "delete", key, token: API_TOKEN }),
  });
  if (!res.ok) throw new Error(`Storage delete failed: ${res.status}`);
  const data = await res.json();
  return { key, deleted: !!data.deleted, shared: false };
}

async function list(prefix) {
  if (!isConfigured()) throw new Error("Google Sheet nog niet gekoppeld (zie src/config.js)");
  const url = `${SHEET_API_URL}?action=list&prefix=${encodeURIComponent(prefix || "")}&token=${encodeURIComponent(API_TOKEN)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Storage list failed: ${res.status}`);
  const data = await res.json();
  return { keys: data.keys || [], prefix, shared: false };
}

export const storage = { get, set, delete: del, list, isConfigured };
