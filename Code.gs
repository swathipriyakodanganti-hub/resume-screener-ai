// ═══════════════════════════════════════════════════════════════
//  Pearl Hire — Google Apps Script Backend
//  File: Code.gs
//
//  DEPLOYMENT STEPS:
//  1. Open Google Apps Script: script.google.com
//  2. Create a new project, paste this entire file
//  3. Run the "authorizeDriveAccess" function to authorize permissions
//  4. Click "Deploy" → "New Deployment"
//  5. Type: Web App
//  6. Execute as: Me
//  7. Who has access: Anyone
//  8. Click "Deploy" → copy the Web App URL
//  9. Paste that URL into the "Apps Script URL" field in the HTML app
// ═══════════════════════════════════════════════════════════════
function testEmail() {
  GmailApp.sendEmail(
    'your-own-email@gmail.com',
    'Test from Resume Screener',
    'If you see this, email works!'
  );
}

// ─── Run this in Apps Script to create the Interviewer Feedback tab ───
function testFeedback() {
  const result = handleInlineFeedback({
    reviewer:  'Test Reviewer',
    position:  'Test Position',
    decisions: { 'Test Candidate': 'proceed' }
  });
  Logger.log(result.getContent());
}

// ─── Set your Google Sheet ID here (optional for logging) ───
const SHEET_ID = '1a0bPPx0LaaMX-ik4SySTaaWB114XZN1uBY87_hbxLEU';

// ─── Authorization Function (RUN THIS FIRST!) ───
// Run this once manually in Apps Script to authorize Drive access
function authorizeDriveAccess() {
  try {
    const folders = DriveApp.getFolders();
    Logger.log('✅ Authorization successful! Drive access granted.');
    return true;
  } catch (e) {
    Logger.log('❌ Authorization failed: ' + e.toString());
    return false;
  }
}

// ─── RUN THIS to authorize Google Sheets access ───
function authorizeSheets() {
  try {
    const ss = SpreadsheetApp.openById(SHEET_ID);
    Logger.log('✅ Sheets authorization successful! Opened: ' + ss.getName());
    return true;
  } catch (e) {
    Logger.log('❌ Sheets authorization failed: ' + e.toString());
    return false;
  }
}

// ─── Diagnostic: paste a real fileId and run this in Apps Script editor ───
function testGetFile() {
  const fileId = '1nTu4_9sfvg3ynpf4LNQ_dZ7x8xyie3tb'; // ← replace with actual file ID
  try {
    const file = DriveApp.getFileById(fileId);
    Logger.log('✅ File accessible: ' + file.getName());
    Logger.log('   MIME: ' + file.getMimeType());
    Logger.log('   Size: ' + file.getSize() + ' bytes');
    Logger.log('   Sharing: ' + file.getSharingAccess());
  } catch (e) {
    Logger.log('❌ Error: ' + e.toString());
    Logger.log('   Stack: ' + e.stack);
  }
}

// ───────────────────────────────────────────────────────────────
// doGet — main entry point for folder listing
// ───────────────────────────────────────────────────────────────
function doGet(e) {
  const action = e && e.parameter && e.parameter.action;

  // ── Pearly: recent cross-session memory ──
  if (action === 'getPearlyMemory') {
    return getPearlyMemory(e);
  }

  // ── Pearly: full transcript for one session (session link) ──
  if (action === 'getPearlySession') {
    return getPearlySession(e);
  }

  // ── List all PDF files in a Google Drive folder ──
  if (action === 'listFolder') {
    try {
      const folderId = e.parameter.folderId;
      if (!folderId) {
        throw new Error('Missing folderId parameter');
      }

      Logger.log('📂 Accessing folder: ' + folderId);

      // Get folder
      const folder = DriveApp.getFolderById(folderId);
      const folderName = folder.getName();
      
      // Iterate through all files
      const iter = folder.getFiles();
      const files = [];
      let totalFiles = 0;
      let skipped = [];

      while (iter.hasNext()) {
        totalFiles++;
        const file = iter.next();
        const fileName = file.getName();
        const mimeType = file.getMimeType();
        const fileId = file.getId();
        
        Logger.log(`📄 File ${totalFiles}: ${fileName} (${mimeType})`);
        
        // STRICT: Only actual PDFs with correct MIME type
        if (mimeType === 'application/pdf') {
          // Double-check extension as well
          if (fileName.toLowerCase().endsWith('.pdf')) {
            
            // Check if file is accessible
            try {
              const sharingAccess = file.getSharingAccess();
              const sharingPermission = file.getSharingPermission();
              
              files.push({
                id: fileId,
                name: fileName,
                mimeType: mimeType,
                size: file.getSize(),
                viewLink: `https://drive.google.com/file/d/${fileId}/preview`,
                downloadLink: `https://drive.google.com/uc?export=download&id=${fileId}`,
                sharing: {
                  access: sharingAccess.toString(),
                  permission: sharingPermission.toString()
                }
              });
              
              Logger.log(`  ✅ Added: ${fileName}`);
              
            } catch (permErr) {
              Logger.log(`  ⚠️ Permission check failed for ${fileName}: ${permErr.message}`);
              // Still add the file, but note the permission issue
              files.push({
                id: fileId,
                name: fileName,
                mimeType: mimeType,
                size: file.getSize(),
                viewLink: `https://drive.google.com/file/d/${fileId}/preview`,
                downloadLink: `https://drive.google.com/uc?export=download&id=${fileId}`,
                permissionWarning: true
              });
            }
            
          } else {
            skipped.push({ name: fileName, reason: 'PDF MIME type but wrong extension' });
            Logger.log(`  ⏭️ Skipped: ${fileName} (has PDF MIME but extension is not .pdf)`);
          }
        } else {
          // Not a PDF
          const reason = fileName.toLowerCase().endsWith('.pdf') 
            ? `Wrong MIME type: ${mimeType} (probably a Word doc saved as .pdf)`
            : `Not a PDF (${mimeType})`;
          skipped.push({ name: fileName, reason: reason });
          Logger.log(`  ⏭️ Skipped: ${fileName} (${reason})`);
        }
      }

      Logger.log(`\n📊 Summary: ${files.length} PDFs loaded, ${skipped.length} files skipped out of ${totalFiles} total`);

      return jsonResponse({ 
        ok: true, 
        files: files, 
        total: files.length,
        skipped: skipped.length,
        skippedDetails: skipped,
        folderName: folderName,
        totalFilesInFolder: totalFiles
      });

    } catch (err) {
      Logger.log('❌ Error: ' + err.message);
      Logger.log('Stack: ' + err.stack);
      
      return jsonResponse({ 
        ok: false, 
        error: err.message,
        details: err.stack
      });
    }
  }

  // ── Fetch a single Drive file as base64 (bypasses browser CORS) ──
  if (action === 'getFile') {
    try {
      const fileId = e.parameter.fileId;
      if (!fileId) throw new Error('Missing fileId parameter');

      Logger.log('📄 Fetching file: ' + fileId);

      const file     = DriveApp.getFileById(fileId);
      const blob     = file.getBlob();
      const bytes    = blob.getBytes();
      const base64   = Utilities.base64Encode(bytes);
      const mimeType = blob.getContentType();
      const name     = file.getName();

      Logger.log('✅ File fetched: ' + name + ' (' + mimeType + ', ' + bytes.length + ' bytes)');

      return jsonResponse({ ok: true, data: base64, mimeType: mimeType, name: name });

    } catch (err) {
      // Use toString() — err.message is empty for Drive permission errors
      const errMsg = err.toString() || err.message || 'Unknown error';
      Logger.log('❌ getFile error: ' + errMsg);
      Logger.log('Stack: ' + err.stack);
      return jsonResponse({ ok: false, error: errMsg, stack: err.stack });
    }
  }

  // ── Fetch complete spreadsheet snapshot (all tabs, rows, columns) ──
  if (action === 'getSheetSnapshot') {
    try {
      const spreadsheetId = (e.parameter.spreadsheetId || e.parameter.sheetId || '').trim();
      if (!spreadsheetId) throw new Error('Missing spreadsheetId parameter');

      const ss = SpreadsheetApp.openById(spreadsheetId);
      const sheets = ss.getSheets().map(sheet => {
        const rowCount = sheet.getLastRow();
        const columnCount = sheet.getLastColumn();

        if (!rowCount || !columnCount) {
          return {
            name: sheet.getName(),
            rowCount: 0,
            columnCount: 0,
            headers: [],
            rows: []
          };
        }

        const values = sheet.getRange(1, 1, rowCount, columnCount).getDisplayValues();
        return {
          name: sheet.getName(),
          rowCount: rowCount,
          columnCount: columnCount,
          headers: values[0] || [],
          rows: values.slice(1)
        };
      });

      return jsonResponse({
        ok: true,
        spreadsheetId: ss.getId(),
        spreadsheetName: ss.getName(),
        sheets: sheets,
        fetchedAt: new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
      });
    } catch (err) {
      Logger.log('❌ getSheetSnapshot error: ' + err.toString());
      Logger.log('Stack: ' + err.stack);
      return jsonResponse({ ok: false, error: err.message || String(err) });
    }
  }

    // ── List all saved analysis batches ──
  if (action === 'getBatches') {
    try {
      const ss = SpreadsheetApp.openById(SHEET_ID);
      let sheet = ss.getSheetByName('Analysis Batches');
      if (!sheet) {
        return jsonResponse({ ok: true, batches: [] });
      }
      const data = sheet.getDataRange().getValues();
      if (data.length <= 1) return jsonResponse({ ok: true, batches: [] });

      const batches = data.slice(1).map(row => ({
        batchId:      row[0],
        position:     row[1],
        savedAt:      row[2],
        candidateCount: row[3],
        avgScore:     row[4]
      })).reverse(); // newest first

      return jsonResponse({ ok: true, batches });
    } catch (err) {
      return jsonResponse({ ok: false, error: err.message });
    }
  }

  // ── Get a single saved batch by batchId ──
  if (action === 'getBatch') {
    try {
      const batchId = (e.parameter.batchId || '').trim();
      if (!batchId) throw new Error('Missing batchId');

      const ss    = SpreadsheetApp.openById(SHEET_ID);
      const sheet = ss.getSheetByName('Analysis Batches');
      if (!sheet) throw new Error('No batches saved yet');

      const data = sheet.getDataRange().getValues();
      const row  = data.slice(1).find(r => String(r[0]) === batchId);
      if (!row) throw new Error('Batch not found: ' + batchId);

      const candidates = JSON.parse(row[5] || '[]');
      return jsonResponse({
        ok: true,
        batchId:   row[0],
        position:  row[1],
        savedAt:   row[2],
        candidates
      });
    } catch (err) {
      return jsonResponse({ ok: false, error: err.message });
    }
  }

  // ── Health check endpoint ──
  return jsonResponse({ 
    status: '✅ Pearl Hire — Apps Script is running.',
    timestamp: new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
    version: '2.2'
  });
}

// ───────────────────────────────────────────────────────────────
// doPost — Email sending functionality
// ───────────────────────────────────────────────────────────────
function doPost(e) {
  try {
    const raw = (e.parameter && e.parameter.payload)
      ? e.parameter.payload
      : (e.postData && e.postData.contents ? e.postData.contents : '');

    if (!raw) {
      return jsonResponse({ success: false, error: 'Empty request body' });
    }

    const data = JSON.parse(raw);

    // ── Save an analysis batch ──
    if (data.action === 'saveBatch') {
      return saveBatch(data);
    }

    // ── Inline feedback from share page buttons ──
    if (data.action === 'saveInlineFeedback') {
      return handleInlineFeedback(data);
    }

    // ── Prompt change log ──
    if (data.action === 'logPromptChange') {
      return logPromptChange(data);
    }

    // ── Pearly chat message log (Sheet-backed memory) ──
    if (data.action === 'logPearlyMessage') {
      return logPearlyMessage(data);
    }

    // ── Push candidates to a target spreadsheet ──
    if (data.action === 'pushCandidates') {
      return pushCandidatesToSheet(data);
    }

    // ── Save a custom Position Name + JD into the JD tab ──
    if (data.action === 'savePositionJD') {
      return savePositionToJDSheet(data);
    }

    const { recipients, candidateName, candidateCount, position, shareLink, matchScore, isBulk, candidates, urgency } = data;

    if (!recipients || !recipients.length) {
      return jsonResponse({ success: false, error: 'No recipients provided' });
    }

    // ── Send emails ──
    recipients.forEach(({ name, email }) => {
      const subject = isBulk
        ? `Candidate profiles for ${position} \u2014 would love your thoughts`
        : `Candidate Profile: ${candidateName} for ${position}`;

      const htmlBody = isBulk
        ? buildBulkEmailHtml(name, candidates || [], position, shareLink, urgency)
        : buildEmailHtml(name, candidateName, position, shareLink, matchScore);

      const textBody = buildEmailText(name, candidateName || `${candidateCount} candidates`, position, shareLink);

      GmailApp.sendEmail(email, subject, textBody, {
        htmlBody,
        name: 'Talent Acquisition Team'
      });
    });

    logShare(candidateName || `${candidateCount} candidates`, position, shareLink, recipients);

    return jsonResponse({ success: true, sent: recipients.length });

  } catch (err) {
    Logger.log('doPost error: ' + err.toString());
    return jsonResponse({ success: false, error: err.message });
  }
}

// ───────────────────────────────────────────────────────────────
// Bulk email HTML
// ───────────────────────────────────────────────────────────────
function buildBulkEmailHtml(interviewerName, candidates, position, shareLink, urgency) {
  candidates = candidates || [];
  const count = candidates.length;

  // Design B candidate list: "Name · XX% match"
  const candidateRows = candidates.map(function(c) {
    const s = c.match_score || 0;
    return '<div style="font-size:14px;color:#111827;margin-bottom:10px;">' +
      '<strong>' + (c.name || 'Candidate') + '</strong> ' +
      '<span style="color:#9ca3af;">&middot;</span> ' +
      '<span style="color:#16a34a;font-weight:600;">' + s + '% match</span>' +
    '</div>';
  }).join('');

  return '<!DOCTYPE html>' +
'<html lang="en">' +
'<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Candidate Shortlist</title>' +
'<style>' +
'@keyframes emailBtnGlitch { 0%,88%,100% { text-shadow:none; } 90% { text-shadow:-2px 0 #ff4d6d,2px 0 #4dfff0; } 93% { text-shadow:2px 0 #ff4d6d,-2px 0 #4dfff0; } 96% { text-shadow:none; } }' +
'@keyframes emailBtnBorder { 0%,88%,100% { border-color:rgba(77,255,150,0.4); } 90% { border-color:rgba(255,77,109,0.6); } 93% { border-color:rgba(77,255,240,0.6); } }' +
'.glitch-btn { animation: emailBtnGlitch 4s infinite, emailBtnBorder 4s infinite; }' +
'</style>' +
'</head>' +
'<body style="margin:0;padding:0;background:#f4f4f5;font-family:Arial,sans-serif;color:#111827;">' +
'<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 16px;">' +
'<tr><td align="center">' +
'<table width="520" cellpadding="0" cellspacing="0" style="max-width:520px;width:100%;background:#ffffff;border:1px solid #e5e7eb;border-radius:10px;">' +

'<!-- Greeting + intro -->' +
'<tr><td style="padding:28px 28px 8px;">' +
  '<p style="margin:0 0 4px;font-size:14px;color:#111827;">Hi <strong>' + interviewerName + '</strong>,</p>' +
  '<p style="margin:0 0 14px;font-size:13px;color:#4b5563;line-height:1.7;">Hope your week is going well!</p>' +
  '<p style="margin:0 0 22px;font-size:13px;color:#4b5563;line-height:1.7;">' +
    'I\u2019ve gone through the applications for <strong style="color:#111827;">' + position + '</strong> and put together a shortlist of ' +
    '<strong style="color:#111827;">' + count + ' candidate' + (count > 1 ? 's' : '') + '</strong> I think ' + (count > 1 ? 'are' : 'is') + ' genuinely worth a closer look. ' +
    'I\u2019m sharing them with you so you can review them before we decide who to move forward with.' +
  '</p>' +
'</td></tr>' +

'<!-- Candidate list -->' +
'<tr><td style="padding:0 28px 22px;">' +
  candidateRows +
'</td></tr>' +

'<!-- Glitch button -->' +
'<tr><td style="padding:0 28px 30px;">' +
  '<a href="' + shareLink + '" class="glitch-btn" style="display:inline-block;background:#050a12;border:1.5px solid rgba(77,255,150,0.4);border-radius:7px;padding:10px 22px;font-family:\'Courier New\',monospace;font-size:13px;color:#86efac;text-decoration:none;">&gt; View Profiles &amp; Resumes_</a>' +
'</td></tr>' +

'<!-- Sign-off -->' +
'<tr><td style="padding:16px 28px 26px;border-top:1px solid #f3f4f6;">' +
  '<p style="margin:0;font-size:12px;color:#9ca3af;">\u2014 Talent Acquisition Team</p>' +
'</td></tr>' +

'</table></td></tr></table>' +
'</body></html>';
}

// ───────────────────────────────────────────────────────────────
// Single candidate email
// ───────────────────────────────────────────────────────────────
function buildEmailHtml(interviewerName, candidateName, position, shareLink, matchScore) {
  const s = matchScore || 0;
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Candidate Profile</title>
<style>
@keyframes emailBtnGlitch { 0%,88%,100% { text-shadow:none; } 90% { text-shadow:-2px 0 #ff4d6d,2px 0 #4dfff0; } 93% { text-shadow:2px 0 #ff4d6d,-2px 0 #4dfff0; } 96% { text-shadow:none; } }
@keyframes emailBtnBorder { 0%,88%,100% { border-color:rgba(77,255,150,0.4); } 90% { border-color:rgba(255,77,109,0.6); } 93% { border-color:rgba(77,255,240,0.6); } }
.glitch-btn { animation: emailBtnGlitch 4s infinite, emailBtnBorder 4s infinite; }
</style>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:Arial,sans-serif;color:#111827;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 16px;">
    <tr><td align="center">
      <table width="520" cellpadding="0" cellspacing="0" style="max-width:520px;width:100%;background:#ffffff;border:1px solid #e5e7eb;border-radius:10px;">

        <!-- Greeting + intro -->
        <tr><td style="padding:28px 28px 8px;">
          <p style="margin:0 0 4px;font-size:14px;color:#111827;">Hi <strong>${interviewerName}</strong>,</p>
          <p style="margin:0 0 14px;font-size:13px;color:#4b5563;line-height:1.7;">Hope your week is going well!</p>
          <p style="margin:0 0 22px;font-size:13px;color:#4b5563;line-height:1.7;">
            I've gone through the applications for <strong style="color:#111827;">${position}</strong> and wanted to share a candidate profile I think is genuinely worth a closer look.
          </p>
        </td></tr>

        <!-- Candidate row -->
        <tr><td style="padding:0 28px 22px;">
          <div style="font-size:14px;color:#111827;">
            <strong>${candidateName}</strong> <span style="color:#9ca3af;">&middot;</span> <span style="color:#16a34a;font-weight:600;">${s}% match</span>
          </div>
        </td></tr>

        <!-- Glitch button -->
        <tr><td style="padding:0 28px 30px;">
          <a href="${shareLink}" class="glitch-btn" style="display:inline-block;background:#050a12;border:1.5px solid rgba(77,255,150,0.4);border-radius:7px;padding:10px 22px;font-family:'Courier New',monospace;font-size:13px;color:#86efac;text-decoration:none;">&gt; View Profile &amp; Resume_</a>
        </td></tr>

        <!-- Sign-off -->
        <tr><td style="padding:16px 28px 26px;border-top:1px solid #f3f4f6;">
          <p style="margin:0;font-size:12px;color:#9ca3af;">&mdash; Talent Acquisition Team</p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ───────────────────────────────────────────────────────────────
// Plain-text email fallback
// ───────────────────────────────────────────────────────────────
function buildEmailText(interviewerName, candidateName, position, shareLink) {
  return `Hi ${interviewerName},

Hope your week is going well!

I've gone through the applications for ${position} and wanted to share a candidate profile I think is genuinely worth a closer look.

Candidate: ${candidateName}
View profile & resume: ${shareLink}

\u2014 Talent Acquisition Team`;
}

// ───────────────────────────────────────────────────────────────
// Log share events to Google Sheets
// ───────────────────────────────────────────────────────────────
function logShare(candidateName, position, shareLink, recipients) {
  try {
    const ss    = SpreadsheetApp.openById(SHEET_ID);

    // ── Original log tab ──
    let sheet = ss.getSheetByName('Candidate Profile Share');
    if (!sheet) {
      sheet = ss.insertSheet('Candidate Profile Share');
      sheet.appendRow(['Timestamp', 'Candidate Name', 'Position', 'Recipients', 'Share Link']);
      sheet.getRange(1, 1, 1, 5).setFontWeight('bold');
    }
    sheet.appendRow([
      new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
      candidateName,
      position,
      recipients.map(r => `${r.name} <${r.email}>`).join(', '),
      shareLink
    ]);

    // ── New "Candies links" tab — with batch number per position ──
    let linksSheet = ss.getSheetByName('Candies links');
    if (!linksSheet) {
      linksSheet = ss.insertSheet('Candies links');
      linksSheet.appendRow(['Batch No.', 'Timestamp', 'Position', 'Candidate(s)', 'Shared With', 'Share Link']);
      linksSheet.getRange(1, 1, 1, 6).setFontWeight('bold').setBackground('#0C447C').setFontColor('#ffffff');
      linksSheet.setColumnWidth(6, 400);
    }

    // Calculate batch number for this position (count existing rows for same position + 1).
    // Locked: two shares for the same position at once would otherwise read the same count.
    const lock = LockService.getScriptLock();
    lock.waitLock(30000);
    try {
      const allData  = linksSheet.getDataRange().getValues();
      const posRows  = allData.slice(1).filter(row => row[2] === position);
      const batchNo  = posRows.length + 1;

      linksSheet.appendRow([
        batchNo,
        new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
        position,
        candidateName,
        recipients.map(r => `${r.name} <${r.email}>`).join(', '),
        shareLink
      ]);
    } finally {
      lock.releaseLock();
    }

  } catch (err) {
    Logger.log('logShare warning (non-fatal): ' + err.message);
  }
}

// ─── Run this once to apply colour formatting to the existing sheet ───
function applyFeedbackFormatting() {
  const ss    = SpreadsheetApp.openById(SHEET_ID);
  const sheet = ss.getSheetByName('Interviewer Feedback');
  if (!sheet) { Logger.log('Sheet not found'); return; }
  const maxRows   = 1000;
  const fullRange = sheet.getRange(2, 1, maxRows, 5);
  const proceedRule = SpreadsheetApp.newConditionalFormatRule()
    .whenFormulaSatisfied('=$E2="proceed"')
    .setBackground('#C8F0DC')
    .setFontColor('#1D6B45')
    .setRanges([fullRange])
    .build();
  const passRule = SpreadsheetApp.newConditionalFormatRule()
    .whenFormulaSatisfied('=$E2="pass"')
    .setBackground('#FADADD')
    .setFontColor('#8B1A1A')
    .setRanges([fullRange])
    .build();
  sheet.setConditionalFormatRules([proceedRule, passRule]);
  Logger.log('✅ Conditional formatting applied to Interviewer Feedback');
}

// Handle inline Proceed/Pass feedback submitted from the share page
function handleInlineFeedback(data) {
  const reviewer  = data.reviewer  || 'Unknown';
  const position  = data.position  || '';
  const decisions = data.decisions || {};
  try {
    if (!SHEET_ID || SHEET_ID === 'YOUR_GOOGLE_SHEET_ID_HERE') {
      throw new Error('SHEET_ID is not configured in Code.gs');
    }
    const ss    = SpreadsheetApp.openById(SHEET_ID);
    let   sheet = ss.getSheetByName('Interviewer Feedback');
    if (!sheet) {
      sheet = ss.insertSheet('Interviewer Feedback');
      sheet.appendRow(['Timestamp', 'Position', 'Reviewer Name', 'Candidate Name', 'Decision', 'Notes']);
      sheet.getRange(1, 1, 1, 6).setFontWeight('bold').setBackground('#0C447C').setFontColor('#ffffff');
      sheet.setFrozenRows(1);

      // Conditional formatting: green row for "proceed", red row for "pass"
      const maxRows = 1000;
      const fullRange = sheet.getRange(2, 1, maxRows, 6);
      const proceedRule = SpreadsheetApp.newConditionalFormatRule()
        .whenFormulaSatisfied('=$E2="proceed"')
        .setBackground('#C8F0DC')
        .setFontColor('#1D6B45')
        .setRanges([fullRange])
        .build();
      const passRule = SpreadsheetApp.newConditionalFormatRule()
        .whenFormulaSatisfied('=$E2="pass"')
        .setBackground('#FADADD')
        .setFontColor('#8B1A1A')
        .setRanges([fullRange])
        .build();
      sheet.setConditionalFormatRules([proceedRule, passRule]);
    } else if (sheet.getLastColumn() === 5 && !sheet.getRange(1, 6).getValue()) {
      // Migrate sheets created before the Notes column existed
      sheet.getRange(1, 6).setValue('Notes').setFontWeight('bold').setBackground('#0C447C').setFontColor('#ffffff');
    }
    const ts = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
    for (const candidateName in decisions) {
      const entry    = decisions[candidateName];
      const isObj    = entry && typeof entry === 'object';
      const decision = isObj ? (entry.decision || '') : (entry || '');
      const note     = isObj ? (entry.note || '') : '';
      sheet.appendRow([ts, position, reviewer, candidateName, decision, note]);
    }
    return jsonResponse({ success: true });
  } catch (err) {
    Logger.log('handleInlineFeedback error: ' + err.toString());
    return jsonResponse({ success: false, error: err.message });
  }
}

// ───────────────────────────────────────────────────────────────
// Helper: JSON response
// ───────────────────────────────────────────────────────────────
function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}


// ───────────────────────────────────────────────────────────────
// Save a custom Position Name + JD directly into the JD tab
// (the same tab the app's "Select Position" dropdown reads from)
// ───────────────────────────────────────────────────────────────
function savePositionToJDSheet(data) {
  // Locked: two first-time saves of the same position must not both append a row
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    return _savePositionToJDSheetLocked(data);
  } finally {
    lock.releaseLock();
  }
}

function _savePositionToJDSheetLocked(data) {
  try {
    const position = (data.position || '').trim();
    const jd       = (data.jd || '').trim();
    const spreadsheetId = (data.spreadsheetId || '').trim();

    if (!spreadsheetId) throw new Error('Missing spreadsheetId — save your Google Sheets link in the Links tab first');
    if (!position) throw new Error('Missing position name');
    if (!jd) throw new Error('Missing job description');

    let ss;
    try {
      ss = SpreadsheetApp.openById(spreadsheetId);
    } catch (openErr) {
      throw new Error(
        'Could not open that spreadsheet. Either the Sheet ID/URL is wrong, or it is not shared with the Google ' +
        'account that owns this Apps Script deployment (Editor access). Original error: ' + (openErr.message || openErr)
      );
    }

    let sheet = ss.getSheetByName('JD');
    if (!sheet) {
      sheet = ss.insertSheet('JD');
      sheet.appendRow(['Position', 'Job Description']);
      sheet.getRange(1, 1, 1, 2).setFontWeight('bold').setBackground('#0C447C').setFontColor('#ffffff');
      sheet.setFrozenRows(1);
    }

    // Existing rows (row 0 is the header, matching how the app's Select Position
    // dropdown reads this tab) — update in place if this position already exists,
    // otherwise append a new row.
    const values = sheet.getDataRange().getValues();
    let rowIndex = -1; // 1-based sheet row number
    for (let i = 1; i < values.length; i++) {
      if (String(values[i][0] || '').trim().toLowerCase() === position.toLowerCase()) {
        rowIndex = i + 1;
        break;
      }
    }

    let updated = false;
    if (rowIndex > 0) {
      sheet.getRange(rowIndex, 2).setValue(jd);
      updated = true;
    } else {
      sheet.appendRow([position, jd]);
      rowIndex = sheet.getLastRow();
    }

    return jsonResponse({ ok: true, position: position, rowIndex: rowIndex, updated: updated });
  } catch (err) {
    Logger.log('savePositionToJDSheet error: ' + err.toString());
    return jsonResponse({ ok: false, error: err.message || String(err) });
  }
}

// ───────────────────────────────────────────────────────────────
// Push screened candidates to a target Google Sheet
// ───────────────────────────────────────────────────────────────
function pushCandidatesToSheet(data) {
  try {
    const { targetSheetId, tabName, position, candidates } = data;

    if (!targetSheetId) throw new Error('Missing targetSheetId');
    if (!candidates || !candidates.length) throw new Error('No candidates provided');

    let ss;
    try {
      ss = SpreadsheetApp.openById(targetSheetId.trim());
    } catch (openErr) {
      throw new Error(
        'Could not open the target spreadsheet. Either the Sheet ID/URL is wrong, or it is not shared ' +
        'with the Google account that owns this Apps Script deployment. Share the sheet with that account ' +
        '(Editor access) and try again. Original error: ' + (openErr.message || openErr)
      );
    }

    // Use specified tab name, or fall back to first sheet (the main Strix sheet)
    const sheetName = (tabName || '').trim();
    const STRIX_HEADERS = [
      'Date','Job Portal','Job Code','Position','Name','Mobile','Email',
      'Recruiter','Recruiter Feedback','Education','Experience','Relevant Experience',
      'Current CTC','Expected CTC','Notice Period','Location','Resume',
      'Interview Timing','L1 Panel','L1 Status','L2 Panel','L2 Status',
      'Final Round','Meet Link','AI Score','Score Reasons','Screen Status',
      'Form Sent','Form Filled','Resume Text','L1 Feedback Status','L2 Feedback Status',
      'L3 Scheduled','CEO Notified','L1 Feedback Form ID','L2 Feedback Form ID',
      'Form Sent Date','Form Link','Form ID','L1 Schedule','L2 Schedule',
      'Preferred Location','LinkedIn','Status','Column 1','Column 2','Why do you want to join BeamX'
    ];
    let sheet = sheetName ? ss.getSheetByName(sheetName) : ss.getSheets()[0];
    let createdNewTab = false;
    if (!sheet && sheetName) {
      // Tab doesn't exist yet — create it with the standard Strix header row instead of failing
      sheet = ss.insertSheet(sheetName);
      sheet.appendRow(STRIX_HEADERS);
      sheet.getRange(1, 1, 1, STRIX_HEADERS.length).setFontWeight('bold').setBackground('#0C447C').setFontColor('#ffffff');
      sheet.setFrozenRows(1);
      createdNewTab = true;
    }
    if (!sheet) throw new Error('No sheet tab available to push into. Check the spreadsheet has at least one tab.');

    // ── Exact Strix column order ──
    // Date | Job Portal | Job Code | Position | Name | Mobile | Email |
    // Recruiter | Recruiter Feedback | Education | Experience | Relevant Experience |
    // Current CTC | Expected CTC | Notice Period | Location | Resume |
    // Interview Timing | L1 Panel | L1 Status | L2 Panel | L2 Status |
    // Final Round | Meet Link | AI Score | Score Reasons | Screen Status |
    // Form Sent | Form Filled | Resume Text | L1 Feedback Status | L2 Feedback Status |
    // L3 Scheduled | CEO Notified | L1 Feedback Form ID | L2 Feedback Form ID |
    // Form Sent Date | Form Link | Form ID | L1 Schedule | L2 Schedule |
    // Preferred Location | LinkedIn | Status | Column 1 | Column 2 | Why do you want to join BeamX

    const ts  = new Date().toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' });
    const pos = position || '';

    const rows = candidates.map(r => {
      const scoreReasons = [
        r.rating_reason || '',
        (r.highlights || []).join(' | ')
      ].filter(Boolean).join(' || ');

      const screenStatus = r.match_score >= 75 ? 'Proceed' : r.match_score >= 50 ? 'Consider' : 'Pass';

      const expStr = r.experience_years > 0
        ? r.experience_years + ' yrs'
        : r.internship_months > 0 ? r.internship_months + ' months (internship)' : '';

      return [
        ts,                   // Date
        '',                   // Job Portal
        '',                   // Job Code
        pos,                  // Position
        r.name || '',         // Name
        r.phone || '',        // Mobile
        r.email || '',        // Email
        '',                   // Recruiter
        '',                   // Recruiter Feedback
        '',                   // Education
        expStr,               // Experience
        '',                   // Relevant Experience
        r.current_ctc || '',  // Current CTC
        r.expected_ctc || '', // Expected CTC
        r.notice_period || '',// Notice Period
        r.location || '',     // Location
        r.drive_link || '',   // Resume
        '',                   // Interview Timing
        '',                   // L1 Panel
        '',                   // L1 Status
        '',                   // L2 Panel
        '',                   // L2 Status
        '',                   // Final Round
        '',                   // Meet Link
        r.match_score || 0,   // AI Score
        scoreReasons,         // Score Reasons
        screenStatus,         // Screen Status
        '',                   // Form Sent
        '',                   // Form Filled
        r.summary || '',      // Resume Text
        '',                   // L1 Feedback Status
        '',                   // L2 Feedback Status
        '',                   // L3 Scheduled
        '',                   // CEO Notified
        '',                   // L1 Feedback Form ID
        '',                   // L2 Feedback Form ID
        '',                   // Form Sent Date
        '',                   // Form Link
        '',                   // Form ID
        '',                   // L1 Schedule
        '',                   // L2 Schedule
        r.location || '',     // Preferred Location
        r.linkedin_url || '', // LinkedIn
        '',                   // Status
        '',                   // Column 1
        '',                   // Column 2
        ''                    // Why do you want to join BeamX
      ];
    });

    // ── Write by HEADER NAME, not by fixed position ──
    // The target tab's columns may have been reordered or extended by hand. Read its real
    // header row and put each value under the column with the same name. Columns the tab
    // doesn't have are skipped, so nothing is shifted into the wrong place.
    const lock = LockService.getScriptLock();
    lock.waitLock(30000); // serialise pushes so two runs can't interleave rows
    try {
      if (sheet.getLastRow() === 0) {
        sheet.appendRow(STRIX_HEADERS);
        sheet.getRange(1, 1, 1, STRIX_HEADERS.length).setFontWeight('bold').setBackground('#0C447C').setFontColor('#ffffff');
        sheet.setFrozenRows(1);
      }
      const width        = sheet.getLastColumn();
      const sheetHeaders = sheet.getRange(1, 1, 1, width).getValues()[0].map(h => String(h).trim());
      if (sheetHeaders.indexOf('Name') === -1 && sheetHeaders.indexOf('Email') === -1) {
        throw new Error(
          'The tab "' + sheet.getName() + '" has no recognised header row (expected columns such as "Name" and "Email"). ' +
          'Pick the correct tab, or leave the tab name blank to use the first tab.'
        );
      }

      const colOf = {}; // header name -> 0-based column index in this tab
      sheetHeaders.forEach((h, c) => { if (h && colOf[h] === undefined) colOf[h] = c; });

      const outRows = rows.map(row => {
        const out = new Array(width).fill('');
        STRIX_HEADERS.forEach((name, idx) => {
          if (colOf[name] !== undefined) out[colOf[name]] = row[idx];
        });
        return out;
      });

      const startRow = sheet.getLastRow() + 1;
      sheet.getRange(startRow, 1, outRows.length, width).setValues(outRows);

      // Colour-code the Screen Status column, located by its header name
      const statusIdx = STRIX_HEADERS.indexOf('Screen Status');
      const statusCol = colOf['Screen Status'];
      if (statusCol !== undefined) {
        for (let i = 0; i < rows.length; i++) {
          const status = rows[i][statusIdx];
          const bg = status === 'Proceed' ? '#e1f5ee' : status === 'Consider' ? '#faeeda' : '#fcebeb';
          const fg = status === 'Proceed' ? '#1D9E75' : status === 'Consider' ? '#BA7517' : '#A32D2D';
          sheet.getRange(startRow + i, statusCol + 1).setBackground(bg).setFontColor(fg).setFontWeight('bold');
        }
      }
    } finally {
      lock.releaseLock();
    }

    return jsonResponse({
      success: true,
      pushed: rows.length,
      sheetName: sheet.getName(),
      spreadsheetName: ss.getName(),
      spreadsheetUrl: ss.getUrl(),
      createdNewTab: createdNewTab
    });

  } catch (err) {
    Logger.log('pushCandidatesToSheet error: ' + err.toString());
    return jsonResponse({ success: false, error: err.message || String(err) });
  }
}



// ───────────────────────────────────────────────────────────────
// Pearly Chat — Sheet-backed memory + per-session transcript
// ───────────────────────────────────────────────────────────────
function logPearlyMessage(data) {
  try {
    const ss = SpreadsheetApp.openById(SHEET_ID);

    let sheet = ss.getSheetByName('Pearly Chat Log');
    if (!sheet) {
      sheet = ss.insertSheet('Pearly Chat Log');
      const headers = ['Timestamp', 'Session ID', 'Role', 'Message'];
      sheet.appendRow(headers);
      const headerRange = sheet.getRange(1, 1, 1, headers.length);
      headerRange.setFontWeight('bold').setBackground('#0C447C').setFontColor('#ffffff');
      sheet.setColumnWidth(1, 180);
      sheet.setColumnWidth(2, 220);
      sheet.setColumnWidth(3, 80);
      sheet.setColumnWidth(4, 600);
      sheet.setFrozenRows(1);
    }

    const ts = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
    sheet.appendRow([ts, data.sessionId || 'unknown', data.role || 'user', data.message || '']);

    const lastRow = sheet.getLastRow();
    sheet.getRange(lastRow, 4).setWrap(true);

    return jsonResponse({ success: true });
  } catch (err) {
    Logger.log('logPearlyMessage error: ' + err.message);
    return jsonResponse({ success: false, error: err.message });
  }
}

// Recent cross-session memory (last N messages) — gives Pearly recall of past chats, even after a reload
function getPearlyMemory(e) {
  try {
    const ss = SpreadsheetApp.openById(SHEET_ID);
    const sheet = ss.getSheetByName('Pearly Chat Log');
    if (!sheet || sheet.getLastRow() < 2) {
      return jsonResponse({ success: true, messages: [] });
    }

    const limit = parseInt((e && e.parameter && e.parameter.limit) || '30', 10);
    const lastRow = sheet.getLastRow();
    const firstRow = Math.max(2, lastRow - limit + 1);
    const numRows = lastRow - firstRow + 1;
    const values = sheet.getRange(firstRow, 1, numRows, 4).getValues();

    const messages = values.map(function(row) {
      return { timestamp: row[0], sessionId: row[1], role: row[2], message: row[3] };
    });

    return jsonResponse({ success: true, messages: messages });
  } catch (err) {
    Logger.log('getPearlyMemory error: ' + err.message);
    return jsonResponse({ success: false, error: err.message, messages: [] });
  }
}

// Full transcript for one specific session — backs the "session link" feature
function getPearlySession(e) {
  try {
    const ss = SpreadsheetApp.openById(SHEET_ID);
    const sheet = ss.getSheetByName('Pearly Chat Log');
    const sessionId = e && e.parameter && e.parameter.sessionId;
    if (!sheet || !sessionId || sheet.getLastRow() < 2) {
      return jsonResponse({ success: true, sessionId: sessionId || '', messages: [] });
    }

    const lastRow = sheet.getLastRow();
    const values = sheet.getRange(2, 1, lastRow - 1, 4).getValues();
    const messages = values
      .filter(function(row) { return row[1] === sessionId; })
      .map(function(row) { return { timestamp: row[0], role: row[2], message: row[3] }; });

    return jsonResponse({ success: true, sessionId: sessionId, messages: messages });
  } catch (err) {
    Logger.log('getPearlySession error: ' + err.message);
    return jsonResponse({ success: false, error: err.message, messages: [] });
  }
}

function logPromptChange(data) {
  try {
    const ss = SpreadsheetApp.openById(SHEET_ID);

    let sheet = ss.getSheetByName('Prompt History');
    if (!sheet) {
      sheet = ss.insertSheet('Prompt History');
      const headers = ['Timestamp', 'Prompt Type', 'Changed By', 'Prompt Text'];
      sheet.appendRow(headers);
      const headerRange = sheet.getRange(1, 1, 1, headers.length);
      headerRange.setFontWeight('bold').setBackground('#0C447C').setFontColor('#ffffff');
      sheet.setColumnWidth(1, 180);
      sheet.setColumnWidth(2, 140);
      sheet.setColumnWidth(3, 160);
      sheet.setColumnWidth(4, 600);
      sheet.setFrozenRows(1);
    }

    const ts = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
    sheet.appendRow([ts, data.promptType || 'Unknown', data.changedBy || 'User', data.promptText || '']);

    // Auto-wrap the prompt text column
    const lastRow = sheet.getLastRow();
    sheet.getRange(lastRow, 4).setWrap(true);

    return jsonResponse({ success: true });
  } catch (err) {
    Logger.log('logPromptChange error: ' + err.message);
    return jsonResponse({ success: false, error: err.message });
  }
}

// ───────────────────────────────────────────────────────────────
// Save Analysis Batch to Google Sheet
// ───────────────────────────────────────────────────────────────
function saveBatch(data) {
  // Locked: two saves of the same batch must not both find "no existing row" and append twice
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    return _saveBatchLocked(data);
  } finally {
    lock.releaseLock();
  }
}

function _saveBatchLocked(data) {
  try {
    const { batchId, position, savedAt, candidates } = data;

    if (!batchId)    throw new Error('Missing batchId');
    if (!candidates || !candidates.length) throw new Error('No candidates to save');

    const ss = SpreadsheetApp.openById(SHEET_ID);
    let sheet = ss.getSheetByName('Analysis Batches');

    if (!sheet) {
      sheet = ss.insertSheet('Analysis Batches');
      const headers = ['Batch ID', 'Position', 'Saved At', 'Candidate Count', 'Avg Score', 'Candidates JSON'];
      sheet.appendRow(headers);
      const hRange = sheet.getRange(1, 1, 1, headers.length);
      hRange.setFontWeight('bold').setBackground('#0C447C').setFontColor('#ffffff');
      sheet.setFrozenRows(1);
      sheet.setColumnWidth(1, 160);
      sheet.setColumnWidth(2, 180);
      sheet.setColumnWidth(3, 180);
      sheet.setColumnWidth(4, 100);
      sheet.setColumnWidth(5, 100);
      sheet.setColumnWidth(6, 400);
    }

    // Check if batchId already exists — update in place
    const allData = sheet.getDataRange().getValues();
    const existingRow = allData.findIndex((r, i) => i > 0 && String(r[0]) === String(batchId));

    const avgScore = Math.round(candidates.reduce((s, c) => s + (c.match_score || 0), 0) / candidates.length);

    // Strip resume base64 blobs before saving — keep everything else
    const slim = candidates.map(c => {
      const copy = Object.assign({}, c);
      delete copy.resume_pdf_b64; // can be 500KB+ per resume
      return copy;
    });
    const jsonStr = JSON.stringify(slim);

    if (existingRow > 0) {
      // Update existing row
      sheet.getRange(existingRow + 1, 1, 1, 6).setValues([[
        batchId, position, savedAt, candidates.length, avgScore, jsonStr
      ]]);
    } else {
      sheet.appendRow([batchId, position, savedAt, candidates.length, avgScore, jsonStr]);
      // Style the new data row
      const lastRow = sheet.getLastRow();
      sheet.getRange(lastRow, 5).setNumberFormat('0"%"');
    }

    return jsonResponse({ ok: true, batchId });
  } catch (err) {
    Logger.log('saveBatch error: ' + err.toString());
    return jsonResponse({ ok: false, error: err.message || String(err) });
  }
}
