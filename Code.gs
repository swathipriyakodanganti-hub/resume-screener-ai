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

  // ── Serve interviewer feedback form ──
  if (action === 'feedback') {
    try {
      const sid = e.parameter.sid;
      if (!sid) return HtmlService.createHtmlOutput('<p style="font-family:sans-serif;padding:40px;">Invalid feedback link.</p>');
      const scriptUrl = ScriptApp.getService().getUrl();
      return HtmlService.createHtmlOutput(buildFeedbackFormHtml(sid, scriptUrl))
        .setTitle('Interview Feedback');
    } catch (err) {
      return HtmlService.createHtmlOutput('<p style="font-family:sans-serif;padding:40px;">Error loading feedback form: ' + err.message + '</p>');
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
    // ── Feedback form submission (HTML form POST) ──
    if (e.parameter && e.parameter.action === 'submitFeedback') {
      return handleFeedbackSubmit(e);
    }

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
  const count  = candidates.length;
  const isAsap = urgency === 'asap';

  // Plain text candidate list: "Name — XX%"
  const candidateRows = candidates.map(function(c) {
    const s = c.match_score || 0;
    return '<p style="margin:0 0 8px;font-size:13.5px;color:#111827;line-height:1.6;">' +
      (c.name || 'Candidate') + ' \u2014 <strong>' + s + '%</strong>' +
    '</p>';
  }).join('');

  const closingLine = isAsap
    ? 'Hoping to move quickly on this one \u2014 would appreciate your thoughts soon.'
    : 'No rush at all \u2014 take your time and review whenever it suits you.';

  return '<!DOCTYPE html>' +
'<html lang="en">' +
'<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Candidate Shortlist</title></head>' +
'<body style="margin:0;padding:0;background:#f4f4f5;font-family:Arial,sans-serif;color:#111827;">' +
'<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 16px;">' +
'<tr><td align="center">' +
'<table width="520" cellpadding="0" cellspacing="0" style="max-width:520px;width:100%;background:#ffffff;border:1px solid #e5e7eb;border-radius:10px;">' +

'<!-- Top: greeting + compact score list -->' +
'<tr><td style="padding:22px 26px 8px;">' +
  '<p style="margin:0 0 2px;font-size:14px;color:#111827;">Hi <strong>' + interviewerName + '</strong>,</p>' +
  '<p style="margin:0;font-size:12.5px;color:#6b7280;">' + count + ' shortlisted candidate' + (count > 1 ? 's' : '') + ' for <strong style="color:#111827;">' + position + '</strong></p>' +
'</td></tr>' +

'<tr><td style="padding:14px 26px 4px;">' +
  candidateRows +
'</td></tr>' +

'<!-- Bottom: plain text link + sign-off -->' +
'<tr><td style="padding:14px 26px 24px;border-top:1px solid #f3f4f6;">' +
  '<p style="margin:14px 0 0;font-size:13.5px;">' +
    '<a href="' + shareLink + '" style="color:#2563eb;text-decoration:underline;">View profiles &amp; resumes \u2192</a>' +
  '</p>' +
  '<p style="margin:12px 0 0;font-size:12.5px;color:#6b7280;line-height:1.7;">' + closingLine + '</p>' +
  '<p style="margin:16px 0 0;font-size:12.5px;color:#6b7280;">Thanks,<br>Talent Acquisition Team</p>' +
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
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Candidate Profile</title></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:Arial,sans-serif;color:#111827;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 16px;">
    <tr><td align="center">
      <table width="520" cellpadding="0" cellspacing="0" style="max-width:520px;width:100%;background:#ffffff;border:1px solid #e5e7eb;border-radius:10px;">

        <!-- Top: greeting + compact score -->
        <tr><td style="padding:22px 26px 8px;">
          <p style="margin:0 0 2px;font-size:14px;color:#111827;">Hi <strong>${interviewerName}</strong>,</p>
          <p style="margin:0;font-size:12.5px;color:#6b7280;">Candidate profile for <strong style="color:#111827;">${position}</strong></p>
        </td></tr>

        <tr><td style="padding:14px 26px 4px;">
          <p style="margin:0 0 8px;font-size:13.5px;color:#111827;line-height:1.6;">
            ${candidateName} &mdash; <strong>${s}%</strong>
          </p>
        </td></tr>

        <!-- Bottom: plain text link + sign-off -->
        <tr><td style="padding:14px 26px 24px;border-top:1px solid #f3f4f6;">
          <p style="margin:14px 0 0;font-size:13.5px;">
            <a href="${shareLink}" style="color:#2563eb;text-decoration:underline;">View complete profile &amp; resume &rarr;</a>
          </p>
          <p style="margin:16px 0 0;font-size:12.5px;color:#6b7280;">Thanks,<br>Talent Acquisition Team</p>
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

Please find below the candidate profile shortlisted for ${position}.

Candidate: ${candidateName}
View Details & Resume: ${shareLink}

Kindly review and let us know your thoughts.

Best regards,
Talent Acquisition Team`;
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

    // Calculate batch number for this position (count existing rows for same position + 1)
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

  } catch (err) {
    Logger.log('logShare warning (non-fatal): ' + err.message);
  }
}

// ───────────────────────────────────────────────────────────────
// Reviewer Feedback — session creation & form serving
// ───────────────────────────────────────────────────────────────

// Store candidate list for a feedback session in Script Properties
function createFeedbackSession(sid, position, candidates) {
  const sessionData = JSON.stringify({ position, candidates });
  PropertiesService.getScriptProperties().setProperty('feedback_' + sid, sessionData);
}

// Build the HTML feedback form page served to the reviewer
function buildFeedbackFormHtml(sid, scriptUrl) {
  const prop = PropertiesService.getScriptProperties().getProperty('feedback_' + sid);
  if (!prop) {
    return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>Feedback</title></head>
<body style="margin:0;padding:40px 16px;background:#f4f6f9;font-family:'Segoe UI',Arial,sans-serif;text-align:center;">
  <div style="max-width:480px;margin:0 auto;background:#fff;border-radius:12px;padding:40px 28px;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
    <div style="font-size:40px;margin-bottom:16px;">⚠️</div>
    <div style="font-size:18px;font-weight:700;color:#1a1a2e;margin-bottom:8px;">Link Expired</div>
    <div style="font-size:13px;color:#64748b;">This feedback link is no longer valid. Please ask the recruiting team for a new one.</div>
  </div>
</body></html>`;
  }

  const session = JSON.parse(prop);
  const { position, candidates } = session;

  const candidateFields = candidates.map((c, i) => {
    const sc = c.match_score >= 75 ? '#1D9E75' : c.match_score >= 50 ? '#BA7517' : '#A32D2D';
    const lbl = c.match_score >= 75 ? 'Strong Match' : c.match_score >= 50 ? 'Good Match' : 'Low Match';
    return `
      <input type="hidden" name="candName_${i}" value="${escapeHtml(c.name)}">
      <input type="hidden" name="candScore_${i}" value="${c.match_score}">
      <div class="cand-card">
        <div class="cand-top">
          <div>
            <div class="cand-name">${escapeHtml(c.name)}</div>
            <div class="cand-lbl" style="color:${sc};">${lbl}</div>
          </div>
          <div class="score-pill" style="color:${sc};border-color:${sc};">${c.match_score}%</div>
        </div>
        <div class="radio-row">
          <label class="radio-opt proceed">
            <input type="radio" name="decision_${i}" value="Proceed" required>
            <span>✅ Proceed</span>
          </label>
          <label class="radio-opt hold">
            <input type="radio" name="decision_${i}" value="Hold">
            <span>🔶 Hold</span>
          </label>
          <label class="radio-opt pass">
            <input type="radio" name="decision_${i}" value="Pass">
            <span>❌ Pass</span>
          </label>
        </div>
        <textarea name="notes_${i}" placeholder="Optional notes for this candidate..." class="notes-ta"></textarea>
      </div>`;
  }).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>Interview Feedback — ${escapeHtml(position)}</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    body { margin:0; padding:24px 16px 48px; background:#f4f6f9; font-family:'Segoe UI',Arial,sans-serif; color:#1a1a2e; }
    .card { max-width:620px; margin:0 auto; background:#fff; border-radius:14px; box-shadow:0 2px 16px rgba(0,0,0,0.10); overflow:hidden; }
    .card-header { background:#0C447C; padding:22px 26px; }
    .card-body   { padding:26px; }
    .card-footer { background:#0C447C; padding:14px 26px; }
    .field-lbl { font-size:11px; font-weight:700; color:#94a3b8; text-transform:uppercase; letter-spacing:0.06em; margin-bottom:5px; }
    .text-inp { width:100%; padding:10px 12px; border:1px solid #e2e8f0; border-radius:7px; font-size:13px; font-family:inherit; color:#1a1a2e; transition:border-color .15s; }
    .text-inp:focus { outline:none; border-color:#0C447C; box-shadow:0 0 0 3px rgba(12,68,124,.1); }
    .cand-card { border:1px solid #e2e8f0; border-radius:10px; padding:16px; margin-bottom:12px; }
    .cand-top  { display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; }
    .cand-name { font-size:14px; font-weight:700; color:#1a1a2e; }
    .cand-lbl  { font-size:11px; font-weight:600; margin-top:2px; }
    .score-pill{ font-size:15px; font-weight:700; border:2px solid; border-radius:20px; padding:3px 12px; }
    .radio-row { display:flex; gap:10px; flex-wrap:wrap; margin-bottom:10px; }
    .radio-opt { display:flex; align-items:center; gap:6px; cursor:pointer; font-size:13px; font-weight:600; padding:6px 12px; border-radius:7px; border:1px solid #e2e8f0; user-select:none; transition:background .12s,border-color .12s; }
    .radio-opt input[type=radio] { accent-color:#0C447C; }
    .radio-opt:has(input:checked) { border-color:#0C447C; background:#EBF2FA; }
    .proceed span { color:#1D9E75; }
    .hold    span { color:#BA7517; }
    .pass    span { color:#A32D2D; }
    .notes-ta { width:100%; padding:8px 10px; border:1px solid #e2e8f0; border-radius:7px; font-size:12px; font-family:inherit; color:#1a1a2e; resize:vertical; min-height:48px; transition:border-color .15s; }
    .notes-ta:focus { outline:none; border-color:#0C447C; }
    .submit-btn { width:100%; padding:14px; background:#0C447C; border:none; border-radius:9px; font-size:14px; font-weight:700; color:#fff; cursor:pointer; font-family:inherit; margin-top:8px; transition:background .15s; }
    .submit-btn:hover { background:#0a3a6e; }
    .section-divider { font-size:12px; font-weight:700; color:#94a3b8; text-transform:uppercase; letter-spacing:0.06em; margin:0 0 12px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="card-header">
      <div style="font-size:10px;color:#85B7EB;letter-spacing:0.08em;text-transform:uppercase;font-weight:600;margin-bottom:5px;">Interview Feedback</div>
      <div style="font-size:19px;font-weight:700;color:#E6F1FB;">${escapeHtml(position)}</div>
      <div style="font-size:12px;color:#85B7EB;margin-top:4px;">${candidates.length} candidate${candidates.length !== 1 ? 's' : ''} to review</div>
    </div>
    <div class="card-body">
      <form method="POST" action="${scriptUrl}" onsubmit="return validateForm(this)" id="fbForm">
        <input type="hidden" name="action" value="submitFeedback">
        <input type="hidden" name="sid" value="${escapeHtml(sid)}">
        <input type="hidden" name="candidateCount" value="${candidates.length}">

        <div style="margin-bottom:14px;">
          <div class="field-lbl">Your Name *</div>
          <input class="text-inp" type="text" name="reviewerName" placeholder="Enter your full name" required>
        </div>
        <div style="margin-bottom:22px;">
          <div class="field-lbl">Your Email *</div>
          <input class="text-inp" type="email" name="reviewerEmail" placeholder="Enter your email address" required>
        </div>

        <div class="section-divider">Candidates — Select Your Decision</div>
        ${candidateFields}

        <button type="submit" class="submit-btn" id="submitBtn">Submit Feedback &rarr;</button>
      </form>
    </div>
    <div class="card-footer">
      <div style="font-size:11px;color:#85B7EB;">Pearl Hire &nbsp;&middot;&nbsp; Your feedback will be recorded in the recruiting team's spreadsheet.</div>
    </div>
  </div>
  <script>
    function validateForm(form) {
      const count = parseInt(form.candidateCount.value);
      for (let i = 0; i < count; i++) {
        const radios = form.querySelectorAll('input[name="decision_' + i + '"]');
        const checked = Array.from(radios).some(r => r.checked);
        if (!checked) {
          alert('Please select Proceed / Hold / Pass for every candidate before submitting.');
          return false;
        }
      }
      document.getElementById('submitBtn').textContent = 'Submitting…';
      document.getElementById('submitBtn').disabled = true;
      return true;
    }
  </script>
</body>
</html>`;
}

// Handle the feedback form POST — write decisions to the Interviewer Feedback sheet tab
function handleFeedbackSubmit(e) {
  const reviewerName  = e.parameter.reviewerName  || '';
  const reviewerEmail = e.parameter.reviewerEmail || '';
  const sid           = e.parameter.sid           || '';
  const count         = parseInt(e.parameter.candidateCount) || 0;

  // Get position from stored session
  let position = 'Unknown';
  try {
    const prop = PropertiesService.getScriptProperties().getProperty('feedback_' + sid);
    if (prop) position = JSON.parse(prop).position || 'Unknown';
  } catch (_) {}

  // Write to "Interviewer Feedback" sheet tab
  try {
    const ss    = SpreadsheetApp.openById(SHEET_ID);
    let   sheet = ss.getSheetByName('Interviewer Feedback');
    if (!sheet) {
      sheet = ss.insertSheet('Interviewer Feedback');
      sheet.appendRow(['Timestamp', 'Position', 'Reviewer Name', 'Reviewer Email', 'Candidate Name', 'Match Score', 'Decision', 'Notes']);
      sheet.getRange(1, 1, 1, 8).setFontWeight('bold');
      sheet.setFrozenRows(1);
      // Color the header row
      sheet.getRange(1, 1, 1, 8).setBackground('#0C447C').setFontColor('#ffffff');
    }
    const ts = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
    for (let i = 0; i < count; i++) {
      sheet.appendRow([
        ts,
        position,
        reviewerName,
        reviewerEmail,
        e.parameter['candName_'  + i] || '',
        e.parameter['candScore_' + i] || '',
        e.parameter['decision_'  + i] || '',
        e.parameter['notes_'     + i] || ''
      ]);
    }
  } catch (err) {
    Logger.log('handleFeedbackSubmit sheet error (non-fatal): ' + err.toString());
  }

  // Return a success page
  return HtmlService.createHtmlOutput(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>Feedback Submitted</title>
</head>
<body style="margin:0;padding:40px 16px;background:#f4f6f9;font-family:'Segoe UI',Arial,sans-serif;text-align:center;">
  <div style="max-width:480px;margin:0 auto;background:#fff;border-radius:14px;padding:44px 28px;box-shadow:0 2px 16px rgba(0,0,0,0.10);">
    <div style="font-size:52px;margin-bottom:16px;">✅</div>
    <div style="font-size:20px;font-weight:700;color:#1a1a2e;margin-bottom:10px;">Feedback Submitted!</div>
    <div style="font-size:13px;color:#64748b;line-height:1.7;">
      Thank you, <strong>${escapeHtml(reviewerName)}</strong>.<br>
      Your decisions for <strong>${count} candidate${count !== 1 ? 's' : ''}</strong> have been recorded.<br>
      The recruiting team will be notified.
    </div>
    <div style="margin-top:28px;font-size:11px;color:#94a3b8;">You can close this tab.</div>
  </div>
</body>
</html>`).setTitle('Feedback Submitted');
}

// Escape HTML special characters
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
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
      sheet.appendRow(['Timestamp', 'Position', 'Reviewer Name', 'Candidate Name', 'Decision']);
      sheet.getRange(1, 1, 1, 5).setFontWeight('bold').setBackground('#0C447C').setFontColor('#ffffff');
      sheet.setFrozenRows(1);

      // Conditional formatting: green row for "proceed", red row for "pass"
      const maxRows = 1000;
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
    }
    const ts = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
    for (const candidateName in decisions) {
      sheet.appendRow([ts, position, reviewer, candidateName, decisions[candidateName]]);
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

    rows.forEach(row => sheet.appendRow(row));

    // Colour-code Screen Status column (col 27) for pushed rows
    const lastRow = sheet.getLastRow();
    const firstDataRow = lastRow - rows.length + 1;
    for (let i = 0; i < rows.length; i++) {
      const rowIdx = firstDataRow + i;
      const status = rows[i][26]; // Screen Status — 0-based index 26 = col 27
      const bg = status === 'Proceed' ? '#e1f5ee' : status === 'Consider' ? '#faeeda' : '#fcebeb';
      const fg = status === 'Proceed' ? '#1D9E75' : status === 'Consider' ? '#BA7517'  : '#A32D2D';
      sheet.getRange(rowIdx, 27).setBackground(bg).setFontColor(fg).setFontWeight('bold');
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
