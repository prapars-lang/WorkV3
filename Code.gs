
/**
 * *********************************************************************************
 * ระบบบริหารจัดการงานกิจกรรม (วิชาสุขศึกษาและพลศึกษา 2568)
 * ฉบับแก้ไข: Data Healing - กู้คืนคอลัมน์ที่สลับกันให้ถูกต้อง
 * *********************************************************************************
 */

const CONFIG = {
  FOLDER_ID: '1RFo4R9L4MmhuKLINTxU_MjnGm32IPTvS', 
  SHEET_ID: '1Q8H3WkidkIfW_e5Voinf1Xro07fU3GPmGCJla4aq9tw' 
};

const TELEGRAM_BOT_TOKEN = '8331424730:AAFSQohH5QXg380flhcLyW_xupp8eppGyro';
const TELEGRAM_CHAT_ID = '-1003596963057';

function getSheetName(base, activityType) {
  const suffix = (activityType === 'Sports Day' || !activityType) ? '_Sports' : '_Children';
  return base + suffix;
}

function doPost(e) {
  try {
    const params = JSON.parse(e.postData.contents);
    const action = params.action;
    const data = params.data || {};
    let result;

    switch(action) {
      case 'upload': result = processSubmission(data); break;
      case 'list': result = getSubmissionsWithReviews(); break;
      case 'grade': result = saveRubricReview(data); break;
      case 'login': result = checkTeacherLogin(data.username, data.pin); break;
      case 'get_rubric': result = getRubricCriteria(); break;
      case 'setup': result = setupInitialSheets(); break;
      default: result = { success: false, message: 'Unknown Action' };
    }
    return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, message: err.toString() })).setMimeType(ContentService.MimeType.JSON);
  }
}

function getSubmissionsWithReviews() {
  try {
    const activities = ['Sports Day', 'Children Day'];
    let allData = [];
    const ss = SpreadsheetApp.openById(CONFIG.SHEET_ID);
    
    activities.forEach(act => {
      const subSheetName = getSheetName('Submissions', act);
      const revSheetName = getSheetName('Reviews', act);
      
      const subSheet = getSheet(subSheetName);
      const revSheet = getSheet(revSheetName);
      
      const subData = subSheet.getDataRange().getValues();
      const revData = revSheet.getDataRange().getValues();
      
      const reviewMap = {};
      if (revData.length > 1) {
        for (let i = 1; i < revData.length; i++) {
          if (!revData[i][0]) continue;
          reviewMap[revData[i][0]] = {
            contentAccuracy: revData[i][1], participation: revData[i][2], presentation: revData[i][3], discipline: revData[i][4],
            totalScore: revData[i][5], percentage: revData[i][6], comment: revData[i][7], gradedAt: revData[i][8], status: 'Graded'
          };
        }
      }

      if (subData.length > 1) {
        // แถวที่ต้องแก้ไขในชีตจริง (ถ้ามี)
        let rowsToFix = [];

        const activityResults = subData.slice(1).map((row, index) => {
          if (!row[0]) return null;
          
          let activityType = row[6];
          let fileUrl = row[7];

          // 🛠️ DATA HEALING: ถ้าช่อง Activity เป็น URL ให้สลับค่ากลับ
          if (activityType && activityType.toString().indexOf('http') === 0) {
            fileUrl = activityType;
            activityType = act; // 'Sports Day' หรือ 'Children Day'
            
            // เก็บดัชนีไว้เพื่อไปอัปเดตในชีตให้ถูกต้องถาวร
            rowsToFix.push({
              rowNum: index + 2, 
              activity: activityType,
              url: fileUrl
            });
          }

          // กรณีช่อง Activity ว่างเปล่า
          if (!activityType) activityType = act;

          return {
            rowId: row[0], 
            timestamp: row[1], 
            name: row[2], 
            studentNumber: row[3] ? row[3].toString() : "", 
            grade: row[4], 
            room: row[5], 
            activityType: activityType, 
            fileUrl: fileUrl,
            review: reviewMap[row[0]] || null
          };
        }).filter(r => r !== null);

        // ทำการ Fix ข้อมูลในชีตให้ถูกต้อง (Async-like)
        if (rowsToFix.length > 0) {
          rowsToFix.forEach(fix => {
            subSheet.getRange(fix.rowNum, 7, 1, 2).setValues([[fix.activity, fix.url]]);
          });
        }

        allData = allData.concat(activityResults);
      }
    });
    
    return { success: true, data: allData.sort((a,b) => b.rowId - a.rowId) };
  } catch (e) { return { success: false, message: e.toString() }; }
}

function processSubmission(data) {
  try {
    const folder = DriveApp.getFolderById(CONFIG.FOLDER_ID);
    const decodedFile = Utilities.base64Decode(data.fileData);
    const blob = Utilities.newBlob(decodedFile, data.mimeType || 'video/mp4', data.fileName);
    const file = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    const fileUrl = file.getUrl();

    const activity = data.activityType || 'Sports Day';
    const sheetName = getSheetName('Submissions', activity);
    const sheet = getSheet(sheetName);
    const nextId = sheet.getLastRow() > 0 ? sheet.getLastRow() : 1;
    
    sheet.appendRow([nextId, new Date(), data.name, data.studentNumber, data.grade, data.room, activity, fileUrl]);
    
    const actName = activity === 'Sports Day' ? 'งานกีฬาสี 🏃' : 'งานวันเด็ก 🎈';
    sendTelegramNotification(`<b>📢 ส่งงานใหม่! (${actName})</b>\n👤 ${data.name}\n🏫 ${data.grade}/${data.room}\n🔗 <a href="${fileUrl}">ดูวิดีโอ</a>`);
    
    return { success: true, fileUrl: fileUrl };
  } catch (e) { return { success: false, message: e.toString() }; }
}

function saveRubricReview(data) {
  try {
    const activity = data.activityType || 'Sports Day';
    const revSheetName = getSheetName('Reviews', activity);
    const sheet = getSheet(revSheetName);
    const values = sheet.getDataRange().getValues();
    let rowIndex = -1;
    
    for (let i = 1; i < values.length; i++) {
      if (values[i][0] && values[i][0].toString() === data.rowId.toString()) { rowIndex = i + 1; break; }
    }
    
    const rowData = [data.rowId, data.contentAccuracy, data.participation, data.presentation, data.discipline, data.totalScore, data.percentage, data.comment, new Date()];
    if (rowIndex > 0) sheet.getRange(rowIndex, 1, 1, rowData.length).setValues([rowData]);
    else sheet.appendRow(rowData);
    
    return { success: true };
  } catch (e) { return { success: false, message: e.toString() }; }
}

function checkTeacherLogin(username, pin) {
  const sheet = getSheet('Teachers');
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0].toString() === (username || "").toString() && data[i][1].toString() === (pin || "").toString()) return { success: true, teacherName: data[i][2] };
  }
  return { success: false, message: "PIN ไม่ถูกต้อง" };
}

function getRubricCriteria() {
  const sheet = getSheet('Rubric');
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return { success: true, data: [{ name: 'เนื้อหา', icon: '✅' }, { name: 'การมีส่วนร่วม', icon: '🤝' }, { name: 'นำเสนอ', icon: '🎤' }, { name: 'วินัย', icon: '📏' }] };
  return { success: true, data: data.slice(1).map(r => ({ name: r[0], icon: r[2] })) };
}

function getSheet(sheetName) {
  if (!sheetName) return null;
  const ss = SpreadsheetApp.openById(CONFIG.SHEET_ID);
  let sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    initSheetHeaders(sheet, sheetName);
  }
  return sheet;
}

function initSheetHeaders(sheet, sheetName) {
  if (!sheet || !sheetName) return;
  let headers = [];
  const nameStr = sheetName.toString();
  if (nameStr.indexOf('Submissions') === 0) headers = ['ID', 'Timestamp', 'Name', 'No', 'Grade', 'Room', 'Activity', 'URL'];
  else if (nameStr.indexOf('Reviews') === 0) headers = ['Sub ID', 'Accuracy', 'Partic', 'Presen', 'Discip', 'Total', '%', 'Comment', 'At'];
  else if (nameStr === 'Teachers') headers = ['User', 'PIN', 'Name'];
  else if (nameStr === 'Rubric') headers = ['Crit', 'Max', 'Icon'];
  if (headers.length > 0) {
    sheet.appendRow(headers);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#4F46E5').setFontColor('#FFFFFF').setHorizontalAlignment('center');
    sheet.setFrozenRows(1);
  }
}

function setupInitialSheets() {
  try {
    const teacherSheet = getSheet('Teachers');
    if (teacherSheet.getLastRow() === 1) teacherSheet.appendRow(['admin', '1234', 'ครูสายรุ้ง ใจดี']);
    const rubricSheet = getSheet('Rubric');
    if (rubricSheet.getLastRow() === 1) {
      rubricSheet.appendRow(['เนื้อหาและความถูกต้อง', '5', '✅']);
      rubricSheet.appendRow(['การมีส่วนร่วมในกิจกรรม', '5', '🤝']);
      rubricSheet.appendRow(['เทคนิคการนำเสนอ', '5', '🎤']);
      rubricSheet.appendRow(['ความมีวินัยและตรงต่อเวลา', '5', '📏']);
    }
    getSheet('Submissions_Sports'); getSheet('Reviews_Sports');
    getSheet('Submissions_Children'); getSheet('Reviews_Children');
    return { success: true, message: 'รีเซ็ตระบบและซ่อมแซมข้อมูลพื้นฐานเรียบร้อย!' };
  } catch (e) { return { success: false, message: 'Setup Error: ' + e.toString() }; }
}

function sendTelegramNotification(msg) {
  try { UrlFetchApp.fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, { 'method': 'post', 'contentType': 'application/json', 'payload': JSON.stringify({ 'chat_id': TELEGRAM_CHAT_ID, 'text': msg, 'parse_mode': 'HTML' }) }); } catch (e) {}
}
