// ═══════════════════════════════════════════════════════════════
//  Resume Screener AI — Google Apps Script Backend
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

    // ── Health check endpoint ──
  return jsonResponse({ 
    status: '✅ Resume Screener AI — Apps Script is running.',
    timestamp: new Date().toISOString(),
    version: '2.1'
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

    // ── Inline feedback from share page buttons ──
    if (data.action === 'saveInlineFeedback') {
      return handleInlineFeedback(data);
    }

    const { recipients, candidateName, candidateCount, position, shareLink, matchScore, isBulk, candidates } = data;

    if (!recipients || !recipients.length) {
      return jsonResponse({ success: false, error: 'No recipients provided' });
    }

    // ── Send emails ──
    recipients.forEach(({ name, email }) => {
      const subject = isBulk
        ? `Candidate Shortlist: ${candidateCount} profiles for ${position}`
        : `Candidate Profile: ${candidateName} for ${position}`;

      const htmlBody = isBulk
        ? buildBulkEmailHtml(name, candidates || [], position, shareLink)
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
function buildBulkEmailHtml(interviewerName, candidates, position, shareLink) {
  const count    = candidates.length;
  const avgScore = count ? Math.round(candidates.reduce((s, c) => s + c.match_score, 0) / count) : 0;
  const topScore = count ? candidates[0].match_score : 0;

  const candidateRows = candidates.map((c, i) => {
    const sc  = c.match_score >= 75 ? '#1D9E75' : c.match_score >= 50 ? '#BA7517' : '#A32D2D';
    const sb  = c.match_score >= 75 ? '#E1F5EE' : c.match_score >= 50 ? '#FAEEDA' : '#FCEBEB';
    const ini = c.name.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();
    const lbl = c.match_score >= 75 ? 'Recommended' : c.match_score >= 50 ? 'Consider' : 'Not Recommended';
    return `
      <tr>
        <td style="padding:10px 20px;border-bottom:1px solid #e2e8f0;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="vertical-align:middle;padding-right:10px;">
                <div style="font-size:11px;font-weight:700;color:#94a3b8;margin-bottom:2px;">#${i+1}</div>
                <div style="width:36px;height:36px;border-radius:8px;background:#E6F1FB;text-align:center;line-height:36px;font-size:13px;font-weight:700;color:#0C447C;">${ini}</div>
              </td>
              <td style="vertical-align:middle;">
                <div style="font-size:14px;font-weight:700;color:#1a1a2e;">${c.name}</div>
                <div style="font-size:11px;color:#64748b;margin-top:2px;">${lbl}</div>
              </td>
              <td align="right" style="vertical-align:middle;">
                <div style="display:inline-block;background:${sb};border-radius:16px;padding:4px 12px;">
                  <span style="font-size:15px;font-weight:700;color:${sc};">${c.match_score}%</span>
                </div>
              </td>
            </tr>
          </table>
        </td>
      </tr>`;
  }).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Candidate Shortlist</title></head>
<body style="margin:0;padding:0;background:#f4f6f9;font-family:'Segoe UI',Arial,sans-serif;color:#1a1a2e;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f9;padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
        <tr>
          <td style="background:#0C447C;border-radius:12px 12px 0 0;padding:24px 28px;">
            <table width="100%" cellpadding="0" cellspacing="0"><tr>
              <td>
                <div style="font-size:10px;color:#85B7EB;letter-spacing:0.08em;text-transform:uppercase;font-weight:600;margin-bottom:5px;">Talent Acquisition · Candidate Shortlist</div>
                <div style="font-size:20px;font-weight:700;color:#E6F1FB;">${position}</div>
              </td>
              <td align="right">
                <table cellpadding="0" cellspacing="0"><tr>
                  <td align="center" style="padding:0 12px;">
                    <div style="font-size:22px;font-weight:700;color:#E6F1FB;">${count}</div>
                    <div style="font-size:9px;color:#85B7EB;text-transform:uppercase;letter-spacing:0.06em;">Candidates</div>
                  </td>
                  <td align="center" style="padding:0 12px;border-left:1px solid rgba(133,183,235,0.3);">
                    <div style="font-size:22px;font-weight:700;color:#E6F1FB;">${avgScore}%</div>
                    <div style="font-size:9px;color:#85B7EB;text-transform:uppercase;letter-spacing:0.06em;">Avg Score</div>
                  </td>
                  <td align="center" style="padding:0 0 0 12px;border-left:1px solid rgba(133,183,235,0.3);">
                    <div style="font-size:22px;font-weight:700;color:#E6F1FB;">${topScore}%</div>
                    <div style="font-size:9px;color:#85B7EB;text-transform:uppercase;letter-spacing:0.06em;">Top Score</div>
                  </td>
                </tr></table>
              </td>
            </tr></table>
          </td>
        </tr>
        <tr>
          <td style="background:#ffffff;border-left:1px solid #e2e8f0;border-right:1px solid #e2e8f0;padding:28px 28px 20px;">
            <p style="margin:0 0 4px;font-size:14px;color:#1a1a2e;">Hi <strong>${interviewerName}</strong>,</p>
            <p style="margin:0 0 20px;font-size:13px;color:#64748b;line-height:1.7;">
              Here is a shortlist of <strong>${count} candidate${count > 1 ? 's' : ''}</strong> screened for <strong>${position}</strong>.
              Click the button below to view all profiles with detailed information and resumes.
            </p>
            <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;margin-bottom:20px;">
              <tr><td style="padding:12px 20px;background:#f8fafc;border-bottom:1px solid #e2e8f0;">
                <div style="font-size:10px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.06em;font-weight:600;">Ranked by AI Match Score</div>
              </td></tr>
              ${candidateRows}
              <tr><td style="padding:20px;background:#f8fafc;text-align:center;">
                <a href="${shareLink}" target="_blank"
                   style="display:inline-block;padding:14px 32px;background:#0C447C;border-radius:8px;font-size:14px;font-weight:700;color:#ffffff;text-decoration:none;box-shadow:0 4px 12px rgba(12,68,124,0.3);">
                  View All Candidates &amp; Resumes &rarr;
                </a>
                <div style="margin-top:10px;font-size:11px;color:#94a3b8;">Click to access detailed profiles, resumes and give your feedback</div>
              </td></tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="background:#0C447C;border-radius:0 0 12px 12px;padding:16px 28px;">
            <table width="100%" cellpadding="0" cellspacing="0"><tr>
              <td>
                <div style="font-size:12px;font-weight:700;color:#E6F1FB;">Talent Acquisition Team</div>
                <div style="font-size:11px;color:#85B7EB;margin-top:2px;">This email is confidential and intended only for the recipient.</div>
              </td>
              <td align="right"><div style="font-size:10px;color:#85B7EB;">Resume Screener AI</div></td>
            </tr></table>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ───────────────────────────────────────────────────────────────
// Single candidate email
// ───────────────────────────────────────────────────────────────
function buildEmailHtml(interviewerName, candidateName, position, shareLink, matchScore) {
  const scoreColor = matchScore >= 75 ? '#1D9E75' : matchScore >= 50 ? '#BA7517' : '#A32D2D';
  const scoreBg    = matchScore >= 75 ? '#E1F5EE' : matchScore >= 50 ? '#FAEEDA' : '#FCEBEB';
  const scoreLabel = matchScore >= 75 ? 'Strong Match' : matchScore >= 50 ? 'Good Match' : 'Low Match';
  const ini = candidateName.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Candidate Profile</title></head>
<body style="margin:0;padding:0;background:#f4f6f9;font-family:'Segoe UI',Arial,sans-serif;color:#1a1a2e;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f9;padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
        <tr>
          <td style="background:#0C447C;border-radius:12px 12px 0 0;padding:24px 28px;">
            <div style="font-size:10px;color:#85B7EB;letter-spacing:0.08em;text-transform:uppercase;font-weight:600;margin-bottom:5px;">Talent Acquisition · Candidate Profile</div>
            <div style="font-size:20px;font-weight:700;color:#E6F1FB;">${position}</div>
          </td>
        </tr>
        <tr>
          <td style="background:#ffffff;border-left:1px solid #e2e8f0;border-right:1px solid #e2e8f0;padding:28px 28px 20px;">
            <p style="margin:0 0 4px;font-size:14px;color:#1a1a2e;">Hi <strong>${interviewerName}</strong>,</p>
            <p style="margin:0 0 24px;font-size:13px;color:#64748b;line-height:1.7;">
              Please find the screened candidate profile below for <strong>${position}</strong>.
              Click the button to view the complete profile with resume and detailed analysis.
            </p>
            <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;margin-bottom:20px;">
              <tr>
                <td style="padding:16px 20px;border-bottom:1px solid #e2e8f0;">
                  <table width="100%" cellpadding="0" cellspacing="0"><tr>
                    <td style="vertical-align:middle;">
                      <table cellpadding="0" cellspacing="0"><tr>
                        <td style="vertical-align:middle;padding-right:14px;">
                          <div style="width:44px;height:44px;border-radius:50%;background:#E6F1FB;text-align:center;line-height:44px;font-size:15px;font-weight:700;color:#0C447C;">${ini}</div>
                        </td>
                        <td style="vertical-align:middle;">
                          <div style="font-size:16px;font-weight:700;color:#1a1a2e;">${candidateName}</div>
                          <div style="font-size:12px;color:#64748b;margin-top:2px;">Candidate Profile &middot; ${position}</div>
                        </td>
                      </tr></table>
                    </td>
                    <td align="right" style="vertical-align:middle;">
                      <div style="display:inline-block;background:${scoreBg};border-radius:20px;padding:5px 14px;">
                        <span style="font-size:16px;font-weight:700;color:${scoreColor};">${matchScore}%</span>
                        <span style="font-size:10px;font-weight:600;color:${scoreColor};text-transform:uppercase;letter-spacing:0.05em;margin-left:4px;">${scoreLabel}</span>
                      </div>
                    </td>
                  </tr></table>
                </td>
              </tr>
              <tr>
                <td style="padding:14px 20px;border-bottom:1px solid #e2e8f0;">
                  <div style="font-size:10px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.06em;font-weight:600;margin-bottom:6px;">AI Match Score</div>
                  <table width="100%" cellpadding="0" cellspacing="0"><tr>
                    <td style="background:#f1f5f9;border-radius:4px;height:8px;">
                      <div style="width:${matchScore}%;height:8px;background:${scoreColor};border-radius:4px;"></div>
                    </td>
                  </tr></table>
                </td>
              </tr>
              <tr>
                <td style="padding:24px 20px;background:#f8fafc;text-align:center;">
                  <a href="${shareLink}" target="_blank"
                     style="display:inline-block;padding:14px 32px;background:#0C447C;border-radius:8px;font-size:14px;font-weight:700;color:#ffffff;text-decoration:none;box-shadow:0 4px 12px rgba(12,68,124,0.3);">
                    View Complete Profile &amp; Resume &rarr;
                  </a>
                  <div style="margin-top:12px;font-size:11px;color:#94a3b8;">Access full candidate details, skills analysis, and resume</div>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="background:#0C447C;border-radius:0 0 12px 12px;padding:16px 28px;">
            <table width="100%" cellpadding="0" cellspacing="0"><tr>
              <td>
                <div style="font-size:12px;font-weight:700;color:#E6F1FB;">Talent Acquisition Team</div>
                <div style="font-size:11px;color:#85B7EB;margin-top:2px;">This email is confidential and intended only for the recipient.</div>
              </td>
              <td align="right"><div style="font-size:10px;color:#85B7EB;">Resume Screener AI</div></td>
            </tr></table>
          </td>
        </tr>
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
    let   sheet = ss.getSheetByName('Candidate Profile Share');
    if (!sheet) {
      sheet = ss.insertSheet('Candidate Profile Share');
      sheet.appendRow(['Timestamp', 'Candidate Name', 'Position', 'Recipients', 'Share Link']);
      sheet.getRange(1, 1, 1, 5).setFontWeight('bold');
    }
    sheet.appendRow([
      new Date().toISOString(),
      candidateName,
      position,
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
      <div style="font-size:11px;color:#85B7EB;">Resume Screener AI &nbsp;&middot;&nbsp; Your feedback will be recorded in the recruiting team's spreadsheet.</div>
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
    const ts = new Date().toISOString();
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
    const ts = new Date().toISOString();
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