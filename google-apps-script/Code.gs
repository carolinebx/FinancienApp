/**
 * Eenvoudige key-value opslag bovenop een Google Sheet, aan te spreken vanuit de
 * Huishoudboekje-app als Web App.
 *
 * Installatie: zie GOOGLE_SHEET_SETUP.md in de hoofdmap van dit project.
 */

var SHEET_NAME = "storage";
var TOKEN = "kies-hier-een-eigen-geheim-wachtwoord"; // moet exact gelijk zijn aan API_TOKEN in src/config.js

function getSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow(["key", "value"]);
  }
  return sheet;
}

function findRow_(sheet, key) {
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (data[i][0] === key) return i + 1; // 1-indexed, +1 voor header
  }
  return -1;
}

function jsonOut_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function checkToken_(token) {
  return token === TOKEN;
}

function doGet(e) {
  var params = e.parameter;
  if (!checkToken_(params.token)) return jsonOut_({ error: "unauthorized" });

  var sheet = getSheet_();
  var action = params.action || "get";

  if (action === "get") {
    var row = findRow_(sheet, params.key);
    if (row === -1) return jsonOut_({ key: params.key, value: null });
    var value = sheet.getRange(row, 2).getValue();
    return jsonOut_({ key: params.key, value: value });
  }

  if (action === "list") {
    var data = sheet.getDataRange().getValues();
    var prefix = params.prefix || "";
    var keys = [];
    for (var i = 1; i < data.length; i++) {
      if (data[i][0] && data[i][0].toString().indexOf(prefix) === 0) keys.push(data[i][0]);
    }
    return jsonOut_({ keys: keys });
  }

  return jsonOut_({ error: "unknown action" });
}

function doPost(e) {
  var body;
  try {
    body = JSON.parse(e.postData.contents);
  } catch (err) {
    return jsonOut_({ error: "invalid body" });
  }
  if (!checkToken_(body.token)) return jsonOut_({ error: "unauthorized" });

  var sheet = getSheet_();

  if (body.action === "set") {
    var row = findRow_(sheet, body.key);
    if (row === -1) {
      sheet.appendRow([body.key, body.value]);
    } else {
      sheet.getRange(row, 2).setValue(body.value);
    }
    return jsonOut_({ key: body.key, value: body.value });
  }

  if (body.action === "delete") {
    var row2 = findRow_(sheet, body.key);
    if (row2 !== -1) sheet.deleteRow(row2);
    return jsonOut_({ key: body.key, deleted: true });
  }

  return jsonOut_({ error: "unknown action" });
}
