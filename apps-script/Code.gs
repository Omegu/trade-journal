/**
 * Trade Journal — Google Apps Script Backend
 *
 * การติดตั้ง: ดูคำแนะนำทั้งหมดใน apps-script/README.md
 *
 * API:
 *   GET  (ไม่ระบุ action)                  -> เสิร์ฟหน้าเว็บแอป (Index.html ที่ build จาก Vite)
 *   GET  ?action=list                      -> { ok, trades: [] }        (เพิ่ม &sheet=Backtests ได้)
 *   GET  ?action=calendar                  -> { ok, events: [] } ปฏิทินข่าว ForexFactory
 *   GET  ?action=news                      -> { ok, items: [] } ข่าวล่าสุด ForexLive RSS
 *   POST { action: "create", trade: {...}, sheet } -> { ok, trade }     (sheet: "Trades" | "Backtests")
 *   POST { action: "update", trade: {...}, sheet } -> { ok, trade }
 *   POST { action: "delete", id: "...", sheet }    -> { ok }
 *   POST { action: "uploadImage", fileName, base64 } -> { ok, imageUrl }  (รูปเก็บใน Google Drive)
 */

var SHEET_NAME = "Trades";
var IMAGE_FOLDER_NAME = "Trade Journal Images";

// ชีตข้อมูลหลัก — ปล่อยว่างเพื่อใช้ชีตที่สคริปต์ผูกอยู่ (getActiveSpreadsheet)
// ถ้าต้องการชี้ไปชีตอื่นโดยไม่ผูก ให้ใส่ ID ของชีตนั้น เช่น "1wVtL-..."
var SPREADSHEET_ID = "";

// ลำดับคอลัมน์ในชีต — ห้ามเปลี่ยนลำดับหลังเริ่มใช้งาน
var HEADERS = [
  "id",
  "date",
  "symbol",
  "direction",
  "entryPrice",
  "exitPrice",
  "lotSize",
  "stopLoss",
  "takeProfit",
  "pnl",
  "setup",
  "emotion",
  "notes",
  "imageUrl",
  "createdAt",
  "updatedAt",
];

var TEXT_FIELDS = { id: true, symbol: true, direction: true, setup: true, emotion: true, notes: true, imageUrl: true, createdAt: true, updatedAt: true };
var NUMBER_FIELDS = { entryPrice: true, exitPrice: true, lotSize: true, stopLoss: true, takeProfit: true, pnl: true };

function doGet(e) {
  var action = e && e.parameter && e.parameter.action;
  // ไม่ระบุ action = เปิดหน้าเว็บแอป (ไฟล์ Index.html ที่ build จาก Vite)
  if (!action) {
    return HtmlService.createHtmlOutputFromFile("Index")
      .setTitle("Trade Journal")
      .addMetaTag("viewport", "width=device-width, initial-scale=1");
  }
  var denied = checkToken_(e, null);
  if (denied) return json_(denied);
  if (action === "list") {
    var sheet = (e && e.parameter && e.parameter.sheet) || SHEET_NAME;
    return json_({ ok: true, trades: listTrades_(sheet) });
  }
  if (action === "calendar") {
    return json_(getCalendar_());
  }
  if (action === "news") {
    return json_(getNews_());
  }
  return json_({ ok: false, error: "Unknown action: " + action });
}

function doPost(e) {
  var body;
  try {
    body = JSON.parse(e.postData.contents);
  } catch (err) {
    return json_({ ok: false, error: "Invalid JSON body" });
  }

  var denied = checkToken_(e, body);
  if (denied) return json_(denied);

  switch (body.action) {
    case "create":
      return json_(createTrade_(body.trade || {}, body.sheet));
    case "update":
      return json_(updateTrade_(body.trade || {}, body.sheet));
    case "delete":
      return json_(deleteTrade_(body.id, body.sheet));
    case "uploadImage":
      return json_(uploadImage_(body.fileName, body.base64));
    default:
      return json_({ ok: false, error: "Unknown action: " + body.action });
  }
}

// ---------- Handlers ----------

function listTrades_(sheetName) {
  var sheet = getSheet_(sheetName);
  var values = sheet.getDataRange().getValues();
  var trades = [];
  for (var i = 1; i < values.length; i++) {
    var row = values[i];
    if (!row[0]) continue;
    trades.push(rowToTrade_(row));
  }
  // เรียงใหม่ -> เก่า ตามวันที่
  trades.sort(function (a, b) {
    return String(b.date).localeCompare(String(a.date)) || String(b.createdAt).localeCompare(String(a.createdAt));
  });
  return trades;
}

function createTrade_(input, sheetName) {
  var sheet = getSheet_(sheetName);
  var now = new Date().toISOString();
  var trade = normalizeTrade_(input);
  trade.id = Utilities.getUuid();
  trade.createdAt = now;
  trade.updatedAt = now;
  sheet.appendRow(tradeToRow_(trade));
  return { ok: true, trade: trade };
}

function updateTrade_(input, sheetName) {
  if (!input.id) return { ok: false, error: "Missing trade id" };
  var sheet = getSheet_(sheetName);
  var rowIndex = findRowById_(sheet, input.id);
  if (rowIndex === -1) return { ok: false, error: "Trade not found: " + input.id };

  var existing = rowToTrade_(sheet.getRange(rowIndex, 1, 1, HEADERS.length).getValues()[0]);
  var updated = normalizeTrade_(mergeTrade_(existing, input));
  updated.id = existing.id;
  updated.createdAt = existing.createdAt;
  updated.updatedAt = new Date().toISOString();
  sheet.getRange(rowIndex, 1, 1, HEADERS.length).setValues([tradeToRow_(updated)]);
  return { ok: true, trade: updated };
}

function deleteTrade_(id, sheetName) {
  if (!id) return { ok: false, error: "Missing id" };
  var sheet = getSheet_(sheetName);
  var rowIndex = findRowById_(sheet, id);
  if (rowIndex === -1) return { ok: false, error: "Trade not found: " + id };
  sheet.deleteRow(rowIndex);
  return { ok: true };
}

function uploadImage_(fileName, base64) {
  if (!base64) return { ok: false, error: "Missing image data" };
  var folder = getImageFolder_();
  var bytes = Utilities.base64Decode(base64);
  var blob = Utilities.newBlob(bytes, "image/png", fileName || ("chart-" + new Date().getTime() + ".png"));
  var file = folder.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  // รูปแบบ URL ที่ฝังลง <img> ได้โดยตรง
  var imageUrl = "https://drive.google.com/thumbnail?id=" + file.getId() + "&sz=w1200";
  return { ok: true, imageUrl: imageUrl };
}

// ---------- ForexFactory Economic Calendar ----------

var CALENDAR_FEEDS = [
  "https://nfs.faireconomy.media/ff_calendar_thisweek.json",
  "https://nfs.faireconomy.media/ff_calendar_nextweek.json",
];
var CALENDAR_CACHE_SECONDS = 600; // 10 นาที

/**
 * ดึงปฏิทินข่าวเศรษฐกิจจาก ForexFactory (data feed ทางการของ faireconomy.media)
 * ผ่าน cache เพื่อไม่ยิงถี่เกินไป — คืน { ok, events, fetchedAt }
 */
function getCalendar_() {
  var cache = CacheService.getScriptCache();
  var cached = cache.get("ff_calendar");
  if (cached) {
    return { ok: true, events: JSON.parse(cached), cached: true };
  }

  var events = [];
  for (var i = 0; i < CALENDAR_FEEDS.length; i++) {
    try {
      var res = UrlFetchApp.fetch(CALENDAR_FEEDS[i], { muteHttpExceptions: true });
      if (res.getResponseCode() !== 200) continue;
      var batch = JSON.parse(res.getContentText());
      events = events.concat(batch);
    } catch (err) {
      // feed ตัวใดตัวหนึ่งล้ม ยังคืนส่วนที่ได้
    }
  }

  if (events.length === 0) {
    return { ok: false, error: "ดึงปฏิทินข่าวจาก ForexFactory ไม่สำเร็จ ลองใหม่อีกครั้ง" };
  }

  try {
    cache.put("ff_calendar", JSON.stringify(events), CALENDAR_CACHE_SECONDS);
  } catch (err) {
    // cache ใส่ไม่ได้ (ข้อมูลใหญ่เกิน) ข้ามไปได้
  }
  return { ok: true, events: events, cached: false, fetchedAt: new Date().toISOString() };
}

// ---------- ข่าว ForexLive (RSS) ----------

// ForexLive (ตอนนี้ investinglive.com) — feed ข่าว breaking news สาย forex แบบ RSS 2.0
var NEWS_FEED_URL = "https://investinglive.com/feed/news";
var NEWS_CACHE_SECONDS = 180; // 3 นาที
var NEWS_MAX_ITEMS = 40;

/**
 * ดึงข่าวล่าสุดจาก RSS ของ ForexLive/investinglive — แยกวิเคราะห์ XML เป็น JSON
 * คืน { ok, items: [{ title, link, pubDate, snippet }] }
 */
function getNews_() {
  var cache = CacheService.getScriptCache();
  var cached = cache.get("news_rss");
  if (cached) {
    return { ok: true, items: JSON.parse(cached), cached: true };
  }

  var res;
  try {
    res = UrlFetchApp.fetch(NEWS_FEED_URL, {
      muteHttpExceptions: true,
      followRedirects: true,
      headers: { "User-Agent": "Mozilla/5.0 (compatible; TradeJournal/1.0)" },
    });
  } catch (err) {
    return { ok: false, error: "เชื่อมต่อไปยังแหล่งข่าวไม่ได้" };
  }
  if (res.getResponseCode() !== 200) {
    return { ok: false, error: "แหล่งข่าวตอบกลับ HTTP " + res.getResponseCode() };
  }

  var items;
  try {
    var doc = XmlService.parse(res.getContentText());
    var channel = doc.getRootElement().getChild("channel");
    items = channel.getChildren("item").slice(0, NEWS_MAX_ITEMS).map(function (item) {
      var title = text_(item.getChild("title"));
      var link = text_(item.getChild("link"));
      var pubDate = text_(item.getChild("pubDate"));
      var description = text_(item.getChild("description")).replace(/<[^>]*>/g, "").trim();
      return {
        title: title,
        link: link,
        pubDate: pubDate,
        snippet: description.length > 220 ? description.slice(0, 220) + "…" : description,
      };
    }).filter(function (item) { return item.title !== ""; });
  } catch (err) {
    return { ok: false, error: "อ่านข้อมูลข่าวไม่สำเร็จ" };
  }

  if (items.length === 0) {
    return { ok: false, error: "ไม่พบรายการข่าวใน feed" };
  }

  try {
    cache.put("news_rss", JSON.stringify(items), NEWS_CACHE_SECONDS);
  } catch (err) {
    // ข้ามได้ถ้า cache ไม่พอ
  }
  return { ok: true, items: items, fetchedAt: new Date().toISOString() };
}

function text_(element) {
  return element ? (element.getText() || "") : "";
}

// ---------- Helpers ----------

function getSheet_(sheetName) {
  var name = sheetName || SHEET_NAME;
  if (name !== SHEET_NAME && name !== "Backtests") {
    throw new Error("Unknown sheet: " + name);
  }
  var ss = getSpreadsheet_();
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
  }
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight("bold");
  }
  return sheet;
}

/**
 * ตรวจ token ก่อนทำงาน API (ถ้าตั้ง Script Property ชื่อ API_TOKEN ไว้)
 * - ไม่ตั้ง API_TOKEN = เปิดใช้งานแบบเดิม (ไม่ต้องส่ง token)
 * - ตั้งแล้ว = ทุกคำขอ API ต้องส่ง token มา (frontend ส่งจาก VITE_API_TOKEN ตอน build)
 * หน้าเว็บแอป (ไม่ระบุ action) ไม่ถูกตรวจ เพื่อให้เปิดหน้าได้เสมอ
 */
function checkToken_(e, body) {
  var expected = PropertiesService.getScriptProperties().getProperty("API_TOKEN");
  if (!expected) return null;
  var got = (e && e.parameter && e.parameter.token) || (body && body.token) || "";
  if (got === expected) return null;
  return { ok: false, error: "Unauthorized: token ไม่ถูกต้อง" };
}

function getSpreadsheet_() {
  if (SPREADSHEET_ID) {
    try {
      return SpreadsheetApp.openById(SPREADSHEET_ID);
    } catch (err) {
      // เข้าถึงไม่ได้ (ID ผิด/ไม่มีสิทธิ์) — ลองใช้ชีตที่ผูกอยู่แทน
    }
  }
  return SpreadsheetApp.getActiveSpreadsheet();
}

function getImageFolder_() {
  var folders = DriveApp.getFoldersByName(IMAGE_FOLDER_NAME);
  if (folders.hasNext()) return folders.next();
  return DriveApp.createFolder(IMAGE_FOLDER_NAME);
}

function findRowById_(sheet, id) {
  var values = sheet.getDataRange().getValues();
  for (var i = 1; i < values.length; i++) {
    if (values[i][0] === id) return i + 1;
  }
  return -1;
}

function rowToTrade_(row) {
  var trade = {};
  for (var c = 0; c < HEADERS.length; c++) {
    trade[HEADERS[c]] = row[c];
  }
  // วันที่ในชีตอาจเป็น Date object
  if (trade.date instanceof Date) {
    trade.date = Utilities.formatDate(trade.date, Session.getScriptTimeZone(), "yyyy-MM-dd");
  }
  if (trade.createdAt instanceof Date) trade.createdAt = trade.createdAt.toISOString();
  if (trade.updatedAt instanceof Date) trade.updatedAt = trade.updatedAt.toISOString();
  return trade;
}

function tradeToRow_(trade) {
  return HEADERS.map(function (h) {
    return trade[h] !== undefined && trade[h] !== null ? trade[h] : "";
  });
}

function mergeTrade_(base, patch) {
  var out = {};
  for (var i = 0; i < HEADERS.length; i++) {
    var h = HEADERS[i];
    out[h] = patch[h] !== undefined ? patch[h] : base[h];
  }
  return out;
}

// ทำค่าให้เป็นชนิดที่ถูกต้องก่อนเขียนลงชีต
function normalizeTrade_(trade) {
  var out = {};
  for (var i = 0; i < HEADERS.length; i++) {
    var h = HEADERS[i];
    var v = trade[h];
    if (TEXT_FIELDS[h]) {
      out[h] = v === undefined || v === null ? "" : String(v);
    } else if (NUMBER_FIELDS[h]) {
      var n = parseFloat(v);
      out[h] = isNaN(n) ? "" : n;
    } else {
      out[h] = v === undefined || v === null ? "" : v;
    }
  }
  // วันที่บังคับกรอก — ถ้าไม่มีใช้วันนี้
  if (!out.date) {
    out.date = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd");
  }
  return out;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON
  );
}
