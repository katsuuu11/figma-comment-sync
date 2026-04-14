/**
 * Figma annotation webhook for Google Sheets.
 * Sheet columns:
 * ID / 注釈タイプ / ステータス / 本文 / 作成者 / 確認者 / 対象ページ / 対象フレーム / 投稿日時 / 更新日時 / FigmaURL
 */
const SHEET_NAME = '修正管理';
const HEADERS = [
  'ID',
  '注釈タイプ',
  'ステータス',
  '本文',
  '作成者',
  '確認者',
  '対象ページ',
  '対象フレーム',
  '投稿日時',
  '更新日時',
  'FigmaURL',
];

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return jsonResponse(400, { ok: false, error: 'Missing body' });
    }

    const payload = JSON.parse(e.postData.contents);
    validatePayload(payload);

    const sheet = getOrCreateSheet();
    const rowData = toRow(payload);
    const rowIndex = findRowById(sheet, payload.id);

    if (rowIndex > 0) {
      sheet.getRange(rowIndex, 1, 1, HEADERS.length).setValues([rowData]);
      return jsonResponse(200, { ok: true, mode: 'updated', row: rowIndex });
    }

    sheet.appendRow(rowData);
    return jsonResponse(200, { ok: true, mode: 'inserted', row: sheet.getLastRow() });
  } catch (error) {
    return jsonResponse(500, {
      ok: false,
      error: error && error.message ? error.message : String(error),
    });
  }
}

function getOrCreateSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
  }

  const firstRow = sheet.getRange(1, 1, 1, HEADERS.length).getValues()[0];
  const headerMissing = HEADERS.some((header, i) => firstRow[i] !== header);
  if (headerMissing) {
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
  }
  return sheet;
}

function validatePayload(payload) {
  if (!payload || typeof payload !== 'object') {
    throw new Error('Invalid JSON payload');
  }

  const required = ['id', 'type', 'status', 'body', 'author', 'reviewer', 'page', 'frame', 'figmaUrl'];
  required.forEach((key) => {
    if (payload[key] === undefined || payload[key] === null || payload[key] === '') {
      throw new Error('Missing required field: ' + key);
    }
  });
}

function toRow(payload) {
  return [
    payload.id,
    payload.type,
    payload.status,
    payload.body,
    payload.author,
    payload.reviewer,
    payload.page,
    payload.frame,
    payload.createdAt || new Date().toISOString(),
    payload.updatedAt || new Date().toISOString(),
    payload.figmaUrl,
  ];
}

function findRowById(sheet, id) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return -1;

  const idValues = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  for (let i = 0; i < idValues.length; i += 1) {
    if (String(idValues[i][0]) === String(id)) {
      return i + 2;
    }
  }
  return -1;
}

function jsonResponse(status, payload) {
  return ContentService.createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}
