/**
 * SmartBill CRM — Google Apps Script mailer + Drive backup.
 *
 * Setup (once):
 *  1. Go to https://script.google.com → New project → paste this file.
 *  2. Project Settings → Script properties → add SHARED_SECRET = <a long random string>.
 *     Use the same value for GAS_SHARED_SECRET in the Next.js app.
 *  3. Deploy → New deployment → type "Web app"
 *       Execute as: Me
 *       Who has access: Anyone
 *     Copy the Web app URL into GAS_WEBAPP_URL.
 *  4. Run `authorize` once from the editor to grant Gmail + Drive permissions.
 *
 * After editing this file, use Deploy → Manage deployments → Edit → New version,
 * so the URL stays the same.
 */

var ROOT_FOLDER = 'SmartBill';

function doPost(e) {
  try {
    var req = JSON.parse(e.postData.contents);
    var secret = PropertiesService.getScriptProperties().getProperty('SHARED_SECRET');
    if (!secret || req.secret !== secret) return json_({ ok: false, error: 'Unauthorized' });

    switch (req.action) {
      case 'ping':
        return json_({ ok: true, quota: MailApp.getRemainingDailyQuota(), account: Session.getEffectiveUser().getEmail() });
      case 'sendEmail':
        return json_(sendEmail_(req));
      case 'backup':
        return json_(backup_(req));
      default:
        return json_({ ok: false, error: 'Unknown action' });
    }
  } catch (err) {
    return json_({ ok: false, error: String(err && err.message ? err.message : err) });
  }
}

function doGet() {
  return json_({ ok: true, service: 'SmartBill CRM mailer' });
}

function sendEmail_(req) {
  if (!req.to) return { ok: false, error: 'Recipient email is missing' };
  if (MailApp.getRemainingDailyQuota() < 1) return { ok: false, error: 'Daily Gmail sending quota reached. Try again tomorrow.' };

  var blob = Utilities.newBlob(Utilities.base64Decode(req.attachment.base64), 'application/pdf', req.attachment.fileName);
  var options = {
    name: req.fromName || 'SmartBill',
    htmlBody: toHtml_(req.body || ''),
    attachments: [blob],
  };
  if (req.cc) options.cc = req.cc;
  if (req.replyTo) options.replyTo = req.replyTo;

  GmailApp.sendEmail(req.to, req.subject || 'Document', req.body || '', options);

  var backup = null;
  if (req.backup && req.backup.folderPath) {
    backup = saveToDrive_(blob, req.backup.folderPath);
  }
  return { ok: true, quota: MailApp.getRemainingDailyQuota(), backup: backup };
}

function backup_(req) {
  var blob = Utilities.newBlob(Utilities.base64Decode(req.base64), 'application/pdf', req.fileName);
  return { ok: true, file: saveToDrive_(blob, req.folderPath || []) };
}

/** Saves into SmartBill/<path...>, replacing a file with the same name. */
function saveToDrive_(blob, folderPath) {
  var folder = getOrCreate_(DriveApp.getRootFolder(), ROOT_FOLDER);
  for (var i = 0; i < folderPath.length; i++) folder = getOrCreate_(folder, folderPath[i]);
  var existing = folder.getFilesByName(blob.getName());
  while (existing.hasNext()) existing.next().setTrashed(true);
  var file = folder.createFile(blob);
  return { id: file.getId(), url: file.getUrl() };
}

function getOrCreate_(parent, name) {
  var it = parent.getFoldersByName(name);
  return it.hasNext() ? it.next() : parent.createFolder(name);
}

function toHtml_(text) {
  var esc = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  esc = esc.replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1">$1</a>');
  return '<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.5;color:#0f172a">' +
    esc.replace(/\n/g, '<br>') + '</div>';
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

/** Run once manually to grant permissions. */
function authorize() {
  MailApp.getRemainingDailyQuota();
  DriveApp.getRootFolder();
  GmailApp.getAliases();
}
