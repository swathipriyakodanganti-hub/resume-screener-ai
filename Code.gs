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
// ─── Set your Google Sheet ID here (optional for logging) ───
const SHEET_ID = 'YOUR_GOOGLE_SHEET_ID_HERE';

// ─── Authorization Function (RUN THIS FIRST!) ───
// Run this once manually in Apps Script to authorize Drive access
function authorizeDriveAccess() {
  try {
    // This will trigger the authorization prompt
    const folders = DriveApp.getFolders();
    Logger.log('✅ Authorization successful! Drive access granted.');
    return true;
  } catch (e) {
    Logger.log('❌ Authorization failed: ' + e.toString());
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
    const raw = (e.parameter && e.parameter.payload)
      ? e.parameter.payload
      : (e.postData && e.postData.contents ? e.postData.contents : '');

    if (!raw) {
      return jsonResponse({ success: false, error: 'Empty request body' });
    }

    const data = JSON.parse(raw);
    const { recipients, candidateName, candidateCount, position, shareLink, matchScore, isBulk, candidates } = data;

    if (!recipients || !recipients.length) {
      return jsonResponse({ success: false, error: 'No recipients provided' });
    }

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
    const lbl = c.match_score >= 75 ? '✅ Recommended' : c.match_score >= 50 ? '🔶 Consider' : '❌ Pass';
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
                <div style="margin-top:10px;font-size:11px;color:#94a3b8;">Click to access detailed profiles with resumes</div>
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
// Helper: JSON response
// ───────────────────────────────────────────────────────────────
function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}