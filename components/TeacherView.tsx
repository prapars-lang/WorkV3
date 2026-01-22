
import React, { useState, useMemo } from 'react';
import { GoogleGenAI, Type } from "@google/genai";
import confetti from "canvas-confetti";
import { StudentSubmission, RubricReview } from '../types';

interface TeacherViewProps {
  submissions: StudentSubmission[];
  onUpdate: () => void;
  handleUpdateGrade: (rowId: number, rubricData: any) => Promise<boolean>;
  rubricCriteria: any[];
  teacherName: string;
  onGenerateAIFeedback: (studentName: string, rubric: RubricReview) => Promise<string>;
}

const TeacherView: React.FC<TeacherViewProps> = ({ submissions, onUpdate, handleUpdateGrade, rubricCriteria, teacherName, onGenerateAIFeedback }) => {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [filterText, setFilterText] = useState('');
  const [filterGrade, setFilterGrade] = useState('All');
  const [filterRoom, setFilterRoom] = useState('All');
  const [filterActivity, setFilterActivity] = useState('Sports Day');
  const [filterStatus, setFilterStatus] = useState<'All' | 'Pending' | 'Graded'>('All');
  
  const [isBulkGrading, setIsBulkGrading] = useState(false);
  const [bulkProgress, setBulkProgress] = useState({ current: 0, total: 0, currentName: '' });
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // States for Advanced PDF Export
  const [exportGrade, setExportGrade] = useState<string>('Prathom 5');
  const [exportRoom, setExportRoom] = useState<string>('Room 1');
  const [exportActivity, setExportActivity] = useState<string>('Sports Day');

  const [rubric, setRubric] = useState<RubricReview>({
    contentAccuracy: 0, participation: 0, presentation: 0, discipline: 0,
    totalScore: 0, percentage: 0, comment: '', status: 'Pending'
  });

  const [saving, setSaving] = useState(false);
  const [isAutoGrading, setIsAutoGrading] = useState(false);

  const filteredSubmissions = useMemo(() => {
    return submissions.filter(s => {
      const matchesText = s.name.toLowerCase().includes(filterText.toLowerCase()) || 
                         s.studentNumber.includes(filterText);
      const matchesGrade = filterGrade === 'All' || s.grade === filterGrade;
      const matchesRoom = filterRoom === 'All' || s.room === filterRoom;
      const matchesActivity = filterActivity === 'All' || s.activityType === filterActivity;
      
      const isGraded = s.review?.status === 'Graded';
      const matchesStatus = filterStatus === 'All' || 
                           (filterStatus === 'Graded' && isGraded) || 
                           (filterStatus === 'Pending' && !isGraded);

      return matchesText && matchesGrade && matchesRoom && matchesActivity && matchesStatus;
    });
  }, [submissions, filterText, filterGrade, filterRoom, filterActivity, filterStatus]);

  const pendingVisibleSubmissions = useMemo(() => 
    filteredSubmissions.filter(s => !s.review || s.review.status !== 'Graded'),
    [filteredSubmissions]
  );

  const startGrading = (sub: StudentSubmission) => {
    setEditingId(sub.rowId);
    setErrorMessage(null);
    setRubric(sub.review || {
      contentAccuracy: 0, participation: 0, presentation: 0, discipline: 0,
      totalScore: 0, percentage: 0, comment: '', status: 'Pending'
    });
    // Smooth scroll to the editor
    setTimeout(() => {
        document.getElementById(`editor-${sub.rowId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);
  };

  const updateRubricItem = (key: keyof RubricReview, val: any) => {
    setRubric(prev => {
      const next = { ...prev, [key]: val };
      if (typeof val === 'number' && ['contentAccuracy', 'participation', 'presentation', 'discipline'].includes(key)) {
        const total = (next.contentAccuracy || 0) + (next.participation || 0) + (next.presentation || 0) + (next.discipline || 0);
        next.totalScore = total;
        next.percentage = Math.round((total / 20) * 100);
      }
      return next;
    });
  };

  const runAIScore = async (student: StudentSubmission) => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `ในฐานะครูผู้เชี่ยวชาญด้านสุขศึกษาและพลศึกษา (ประถมศึกษา) กรุณาประเมินวิดีโอส่งงานของนักเรียน:
      ชื่อ: ${student.name}
      ระดับชั้น: ${student.grade}
      กิจกรรม: ${student.activityType === 'Sports Day' ? 'การเคลื่อนไหวร่างกายแบบกีฬาสี' : 'กิจกรรมสร้างสรรค์วันเด็ก'}
      
      กรุณาประเมินและให้คะแนน (0-5) สำหรับเกณฑ์ดังนี้ในรูปแบบ JSON:
      1. contentAccuracy: ความถูกต้องของทักษะหรือเนื้อหา
      2. participation: ความตั้งใจและความพยายามที่เห็นในวิดีโอ
      3. presentation: ความชัดเจนและเทคนิคการนำเสนอ
      4. discipline: ระเบียบวินัยและการปฏิบัติตามคำสั่ง
      
      และเขียน "comment" ภาษาไทย 2-3 ประโยคที่เน้นการชมเชยและให้คำแนะนำอย่างอบอุ่นแบบคุณครูใจดี`,
      config: { 
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            contentAccuracy: { type: Type.INTEGER, description: "คะแนน 0-5" },
            participation: { type: Type.INTEGER, description: "คะแนน 0-5" },
            presentation: { type: Type.INTEGER, description: "คะแนน 0-5" },
            discipline: { type: Type.INTEGER, description: "คะแนน 0-5" },
            comment: { type: Type.STRING, description: "คำชมและแนะนำภาษาไทย" }
          },
          required: ["contentAccuracy", "participation", "presentation", "discipline", "comment"]
        }
      }
    });
    return JSON.parse(response.text);
  };

  const handleAutoGrade = async () => {
    const currentStudent = filteredSubmissions.find(s => s.rowId === editingId);
    if (!currentStudent) return;
    setIsAutoGrading(true);
    try {
      const aiResult = await runAIScore(currentStudent);
      const total = aiResult.contentAccuracy + aiResult.participation + aiResult.presentation + aiResult.discipline;
      setRubric(prev => ({ 
        ...prev, 
        ...aiResult, 
        totalScore: total, 
        percentage: Math.round((total / 20) * 100),
        comment: `🤖 [AI ประเมิน]: ${aiResult.comment}`
      }));
    } catch (error) { 
      setErrorMessage("AI ตรวจไม่สำเร็จจ้า กรุณาลองใหม่นะ"); 
    } finally { 
      setIsAutoGrading(false); 
    }
  };

  const handleBulkAutoGrade = async () => {
    if (pendingVisibleSubmissions.length === 0) return;
    setIsBulkGrading(true);
    setBulkProgress({ current: 0, total: pendingVisibleSubmissions.length, currentName: '' });

    for (let i = 0; i < pendingVisibleSubmissions.length; i++) {
      const sub = pendingVisibleSubmissions[i];
      setBulkProgress(prev => ({ ...prev, current: i + 1, currentName: sub.name }));
      try {
        const aiResult = await runAIScore(sub);
        const total = aiResult.contentAccuracy + aiResult.participation + aiResult.presentation + aiResult.discipline;
        if (sub.rowId !== undefined) {
          await handleUpdateGrade(sub.rowId, {
            ...aiResult,
            totalScore: total,
            percentage: Math.round((total / 20) * 100),
            status: 'Graded',
            comment: `🤖 [AI ตรวจอัตโนมัติ]: ${aiResult.comment}`,
            activityType: sub.activityType
          });
        }
      } catch (err) { console.error(err); }
    }
    setIsBulkGrading(false);
    onUpdate();
    confetti({ particleCount: 150, spread: 60, origin: { y: 0.7 } });
  };

  const handleSave = async () => {
    const currentStudent = filteredSubmissions.find(s => s.rowId === editingId);
    if (!editingId || !currentStudent) return;
    setSaving(true);
    const success = await handleUpdateGrade(editingId, { ...rubric, status: 'Graded', activityType: currentStudent.activityType });
    if (success) { setEditingId(null); onUpdate(); }
    setSaving(false);
  };

  // 📝 Generate Detailed Class PDF Report
  const exportToPDF = () => {
    const toExport = submissions.filter(s => 
      s.grade === exportGrade && 
      s.room === exportRoom && 
      s.activityType === exportActivity
    ).sort((a, b) => parseInt(a.studentNumber || '0') - parseInt(b.studentNumber || '0'));

    if (toExport.length === 0) {
      alert("ไม่พบข้อมูลนักเรียนในห้องและกิจกรรมที่เลือกจ้า");
      return;
    }

    renderOfficialPDF(toExport, `ระดับชั้น ${exportGrade === 'Prathom 5' ? 'ป.5' : 'ป.6'} | ${exportRoom.replace('Room ', 'ห้อง ')}`);
  };

  // 📋 Generate Grade Summary Report (All rooms in a grade)
  const exportGradeSummary = () => {
    const toExport = submissions.filter(s => 
      s.grade === exportGrade && 
      s.activityType === exportActivity
    ).sort((a, b) => {
      // Sort by room first, then by number
      if (a.room !== b.room) return a.room.localeCompare(b.room);
      return parseInt(a.studentNumber || '0') - parseInt(b.studentNumber || '0');
    });

    if (toExport.length === 0) {
      alert("ไม่พบข้อมูลนักเรียนในระดับชั้นที่เลือกจ้า");
      return;
    }

    renderOfficialPDF(toExport, `สรุปผลคะแนน ระดับชั้น ${exportGrade === 'Prathom 5' ? 'ป.5' : 'ป.6'} (ทุกห้องเรียน)`, true);
  };

  const renderOfficialPDF = (dataList: StudentSubmission[], subtitle: string, isSummary = false) => {
    const printArea = document.getElementById('print-area');
    if (!printArea) return;

    const activityName = exportActivity === 'Sports Day' ? 'กิจกรรมกีฬาสี 🏃' : 'กิจกรรมวันเด็ก 🎈';

    printArea.innerHTML = `
      <div class="print-header" style="font-family: 'Sarabun', sans-serif; text-align: center; margin-bottom: 30px;">
        <h1 style="font-size: 24pt; margin: 0 0 10px 0; font-weight: bold; border-bottom: 2px solid #000; display: inline-block; padding-bottom: 5px;">
            รายงานสรุปผลการเรียนวิชาสุขศึกษาและพลศึกษา
        </h1>
        <h2 style="font-size: 18pt; margin: 15px 0 5px 0; color: #333;">${activityName}</h2>
        <p style="font-size: 14pt; font-weight: bold; margin: 0; color: #444;">${subtitle}</p>
        <p style="font-size: 12pt; margin-top: 10px;">คุณครูผู้สอน: ${teacherName}</p>
      </div>
      <table style="width: 100%; border: 1px solid #000; border-collapse: collapse; font-family: 'Sarabun', sans-serif;">
        <thead>
          <tr style="background-color: #f3f4f6;">
            ${isSummary ? '<th style="border: 1px solid #000; padding: 10px; width: 8%;">ห้อง</th>' : ''}
            <th style="border: 1px solid #000; padding: 10px; width: 8%;">เลขที่</th>
            <th style="border: 1px solid #000; padding: 10px; width: 25%; text-align: left;">ชื่อ-นามสกุล</th>
            <th style="border: 1px solid #000; padding: 10px; width: 12%;">คะแนน (20)</th>
            <th style="border: 1px solid #000; padding: 10px; width: 10%;">ร้อยละ</th>
            <th style="border: 1px solid #000; padding: 10px; width: 37%; text-align: left;">คำชม/ข้อเสนอแนะ</th>
          </tr>
        </thead>
        <tbody>
          ${dataList.map(s => `
            <tr>
              ${isSummary ? `<td style="border: 1px solid #000; padding: 8px; text-align: center;">${s.room.replace('Room ', '')}</td>` : ''}
              <td style="border: 1px solid #000; padding: 8px; text-align: center;">${s.studentNumber}</td>
              <td style="border: 1px solid #000; padding: 8px; text-align: left;">${s.name}</td>
              <td style="border: 1px solid #000; padding: 8px; text-align: center; font-weight: bold;">${s.review?.totalScore ?? '-'}</td>
              <td style="border: 1px solid #000; padding: 8px; text-align: center;">${s.review?.percentage ?? '-'}%</td>
              <td style="border: 1px solid #000; padding: 8px; text-align: left; font-size: 10pt; line-height: 1.3;">${s.review?.comment || '<span style="color:#999 italic">รอดำเนินการ</span>'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      <div style="margin-top: 60px; text-align: right; padding-right: 60px; font-family: 'Sarabun', sans-serif;">
        <div style="display: inline-block; text-align: center;">
          <p>ลงชื่อ..........................................................</p>
          <p style="margin-top: 10px; font-weight: bold; font-size: 13pt;">(${teacherName})</p>
          <p style="font-size: 10pt; color: #666; margin-top: 8px;">พิมพ์รายงานเมื่อ: ${new Date().toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
        </div>
      </div>
    `;
    window.print();
  };

  const PointSelector = ({ label, icon, current, onSelect }: { label: string, icon: string, current: number, onSelect: (v: number) => void }) => (
    <div className="bg-white p-4 rounded-2xl border-2 border-indigo-50 mb-4 shadow-sm">
      <div className="flex justify-between items-center mb-3">
        <span className="font-bold text-indigo-700 flex items-center gap-2"><span className="text-xl">{icon}</span> {label}</span>
        <span className="bg-indigo-100 text-indigo-600 px-3 py-1 rounded-full text-xs font-bold">{current}/5</span>
      </div>
      <div className="flex gap-2">
        {[0, 1, 2, 3, 4, 5].map(pt => (
          <button key={pt} onClick={() => onSelect(pt)} className={`flex-1 py-3 rounded-xl font-bold transition-all ${current === pt ? 'bg-indigo-500 text-white shadow-lg' : 'bg-gray-50 text-gray-400 hover:bg-gray-100'}`}>{pt}</button>
        ))}
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {isBulkGrading && (
        <div className="fixed inset-0 z-[200] bg-indigo-900/60 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="bg-white rounded-[3rem] p-10 max-w-lg w-full text-center shadow-2xl animate-in zoom-in border-8 border-indigo-50">
            <div className="text-7xl mb-6 animate-bounce">🤖</div>
            <h3 className="text-3xl font-kids text-indigo-600 mb-2">AI กำลังทำงาน...</h3>
            <p className="text-slate-500 font-bold mb-8">ตรวจงานของ: <span className="text-indigo-500">{bulkProgress.currentName}</span></p>
            <div className="w-full bg-slate-100 h-6 rounded-full overflow-hidden mb-4 border-2 border-indigo-50">
              <div className="bg-gradient-to-r from-indigo-400 to-indigo-600 h-full transition-all duration-500" style={{ width: `${(bulkProgress.current / bulkProgress.total) * 100}%` }}></div>
            </div>
            <p className="text-sm font-black text-indigo-400">{bulkProgress.current} จาก {bulkProgress.total} รายการ</p>
          </div>
        </div>
      )}

      <div className="bg-white rounded-[3rem] p-6 shadow-xl border-4 border-indigo-50">
        <div className="flex flex-col lg:flex-row justify-between items-center gap-6 mb-8">
            <div className="flex items-center gap-6">
              <div className="text-6xl bg-indigo-100 p-4 rounded-3xl shadow-inner">👩‍🏫</div>
              <div>
                  <h2 className="text-2xl font-kids text-indigo-600">จัดการคะแนน โดยคุณครู {teacherName}</h2>
                  <p className="text-slate-400 font-bold italic text-sm">ส่วนงานประเมินผลและรายงานวิชาสุขศึกษา</p>
              </div>
            </div>
            <button onClick={handleBulkAutoGrade} className="bg-yellow-400 text-indigo-900 px-8 py-4 rounded-2xl font-bold shadow-lg hover:bg-yellow-300 hover:scale-105 active:scale-95 transition-all flex items-center gap-2 group">
                <span className="text-2xl group-hover:rotate-12 transition-transform">🪄</span>
                AI ตรวจงานรอตรวจทั้งหมด ({pendingVisibleSubmissions.length})
            </button>
        </div>

        {/* 📋 Official PDF Export Control Center */}
        <div className="bg-indigo-50 p-6 rounded-[2.5rem] border-4 border-indigo-100 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-kids text-indigo-700 flex items-center gap-2">
                <span className="text-2xl">📄</span> ออกรายงานใบคะแนน (Official PDF)
            </h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-bold text-indigo-600 mb-2 ml-2 uppercase tracking-tighter">1. เลือกระดับชั้น</label>
              <select value={exportGrade} onChange={(e) => setExportGrade(e.target.value)} className="w-full p-3 rounded-2xl bg-white border-2 border-indigo-100 font-bold outline-none cursor-pointer text-indigo-800 focus:border-indigo-400 transition-colors">
                <option value="Prathom 5">ป.5</option>
                <option value="Prathom 6">ป.6</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-indigo-600 mb-2 ml-2 uppercase tracking-tighter">2. เลือกห้องเรียน</label>
              <select value={exportRoom} onChange={(e) => setExportRoom(e.target.value)} className="w-full p-3 rounded-2xl bg-white border-2 border-indigo-100 font-bold outline-none cursor-pointer text-indigo-800 focus:border-indigo-400 transition-colors">
                {[1,2,3,4].map(r => <option key={r} value={`Room ${r}`}>ห้อง {r}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-indigo-600 mb-2 ml-2 uppercase tracking-tighter">3. เลือกกิจกรรม</label>
              <select value={exportActivity} onChange={(e) => setExportActivity(e.target.value)} className="w-full p-3 rounded-2xl bg-white border-2 border-indigo-100 font-bold outline-none cursor-pointer text-indigo-800 focus:border-indigo-400 transition-colors">
                <option value="Sports Day">งานกีฬาสี 🏃</option>
                <option value="Children Day">งานวันเด็ก 🎈</option>
              </select>
            </div>
            <div className="flex flex-col gap-2 justify-end">
              <button onClick={exportToPDF} className="w-full bg-indigo-600 text-white py-2.5 rounded-2xl font-bold text-sm hover:bg-indigo-700 shadow-md transition-all flex items-center justify-center gap-2">
                พิมพ์รายห้อง 📄
              </button>
              <button onClick={exportGradeSummary} className="w-full bg-slate-700 text-white py-2.5 rounded-2xl font-bold text-sm hover:bg-slate-800 shadow-md transition-all flex items-center justify-center gap-2">
                พิมพ์รวมทุกห้อง (สรุป) 📊
              </button>
            </div>
          </div>
          <p className="text-[10px] text-indigo-400 font-bold italic ml-2">* เลือกปลายทางเป็น "Save as PDF" เพื่อให้ได้รายงานที่คมชัดที่สุด และฟอนต์ไม่เพี้ยนครับคุณครู</p>
        </div>
      </div>

      <div className="bg-white p-4 rounded-[2.5rem] shadow-sm border-2 border-indigo-50">
          <div className="flex flex-wrap justify-center gap-3 mb-6">
              {[
                  {id: 'All', label: 'ทั้งหมด', icon: '📁'},
                  {id: 'Pending', label: 'รอตรวจ', icon: '⏳'},
                  {id: 'Graded', label: 'ตรวจแล้ว', icon: '✅'}
              ].map(tab => (
                  <button key={tab.id} onClick={() => setFilterStatus(tab.id as any)} className={`px-6 py-2.5 rounded-2xl font-bold transition-all flex items-center gap-2 ${filterStatus === tab.id ? 'bg-indigo-500 text-white shadow-md' : 'text-indigo-400 hover:bg-white'}`}>
                      <span>{tab.icon}</span> {tab.label}
                  </button>
              ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                  <label className="block text-[10px] font-black text-indigo-300 mb-2 ml-2 uppercase tracking-widest">ชุดกิจกรรม</label>
                  <select value={filterActivity} onChange={(e) => setFilterActivity(e.target.value as any)} className="w-full p-3 rounded-2xl bg-white border-2 border-indigo-100 font-bold outline-none cursor-pointer">
                      <option value="Sports Day">งานกีฬาสี 🏃</option>
                      <option value="Children Day">งานวันเด็ก 🎈</option>
                      <option value="All">ทุกกิจกรรม</option>
                  </select>
              </div>
              <div>
                  <label className="block text-[10px] font-black text-indigo-300 mb-2 ml-2 uppercase tracking-widest">ค้นหา ชื่อ/เลขที่</label>
                  <input type="text" placeholder="พิมพ์เพื่อค้นหา..." value={filterText} onChange={(e) => setFilterText(e.target.value)} className="w-full p-3 rounded-2xl bg-white border-2 border-indigo-100 outline-none font-bold focus:border-indigo-300 transition-colors"/>
              </div>
              <div>
                  <label className="block text-[10px] font-black text-indigo-300 mb-2 ml-2 uppercase tracking-widest">ระดับชั้น</label>
                  <select value={filterGrade} onChange={(e) => setFilterGrade(e.target.value)} className="w-full p-3 rounded-2xl bg-white border-2 border-indigo-100 font-bold cursor-pointer">
                      <option value="All">ทุกชั้น</option>
                      <option value="Prathom 5">ป.5</option>
                      <option value="Prathom 6">ป.6</option>
                  </select>
              </div>
              <div>
                  <label className="block text-[10px] font-black text-indigo-300 mb-2 ml-2 uppercase tracking-widest">ห้องเรียน</label>
                  <select value={filterRoom} onChange={(e) => setFilterRoom(e.target.value)} className="w-full p-3 rounded-2xl bg-white border-2 border-indigo-100 font-bold cursor-pointer">
                      <option value="All">ทุกห้อง</option>
                      {[1,2,3,4].map(r => <option key={r} value={`Room ${r}`}>ห้อง {r}</option>)}
                  </select>
              </div>
          </div>
      </div>

      <div className="grid gap-4">
        {filteredSubmissions.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-[3rem] border-4 border-dashed border-indigo-50 shadow-inner">
             <p className="text-7xl mb-6">🏖️</p>
             <p className="text-indigo-300 font-bold italic font-kids text-xl">ไม่พบข้อมูลที่หนูต้องการหาจ้า</p>
          </div>
        ) : filteredSubmissions.map((sub) => (
          <div key={sub.rowId} id={`editor-${sub.rowId}`} className={`p-6 rounded-[2.5rem] border-4 transition-all relative overflow-hidden ${sub.review?.status === 'Graded' ? 'border-green-100 bg-white' : 'bg-white border-indigo-100 shadow-xl'}`}>
            <div className="flex flex-col md:flex-row justify-between items-center gap-6">
              <div className="flex items-center gap-4">
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-2xl shadow-md border-2 ${sub.activityType === 'Sports Day' ? 'bg-orange-100 border-orange-200' : 'bg-cyan-100 border-cyan-200'}`}>
                   {sub.activityType === 'Sports Day' ? '🏃' : '🎈'}
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-700">{sub.name}</h3>
                  <p className="text-[10px] font-black text-indigo-400 uppercase tracking-tighter">เลขที่ {sub.studentNumber} | {sub.grade === 'Prathom 5' ? 'ป.5' : 'ป.6'} | {sub.room.replace('Room ','ห้อง ')}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <a href={sub.fileUrl} target="_blank" className="bg-indigo-500 text-white px-6 py-2 rounded-xl font-bold shadow-md hover:bg-indigo-600 hover:scale-105 active:scale-95 transition-all text-sm flex items-center gap-2">ดูวิดีโอ 📺</a>
                <button onClick={() => startGrading(sub)} className={`px-6 py-2 rounded-xl font-bold shadow-md hover:scale-105 active:scale-95 transition-all text-sm text-white ${sub.review?.status === 'Graded' ? 'bg-green-500' : 'bg-orange-400'}`}>
                  {sub.review?.status === 'Graded' ? `ตรวจแล้ว (${sub.review.totalScore}/20)` : 'ประเมินงาน ✍️'}
                </button>
              </div>
            </div>

            {editingId === sub.rowId && (
              <div className="mt-6 p-6 bg-indigo-50 rounded-[2rem] border-4 border-indigo-100 shadow-inner animate-in slide-in-from-top duration-500">
                <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
                   <h4 className="text-lg font-kids text-indigo-700 flex items-center gap-2">📑 แบบประเมินรายบุคคล</h4>
                   <button onClick={handleAutoGrade} disabled={isAutoGrading} className="bg-yellow-400 text-indigo-900 px-5 py-2 rounded-xl font-black text-xs shadow-md disabled:opacity-50 transition-all hover:scale-105 active:scale-95">
                    {isAutoGrading ? '🪄 กำลังวิเคราะห์วิดีโอ...' : '🪄 ให้ AI ประเมินเบื้องต้น'}
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <PointSelector label="เนื้อหา/ความถูกต้อง" icon="✅" current={rubric.contentAccuracy} onSelect={(v) => updateRubricItem('contentAccuracy', v)}/>
                  <PointSelector label="ความมีส่วนร่วม" icon="🤝" current={rubric.participation} onSelect={(v) => updateRubricItem('participation', v)}/>
                  <PointSelector label="เทคนิคการนำเสนอ" icon="🎤" current={rubric.presentation} onSelect={(v) => updateRubricItem('presentation', v)}/>
                  <PointSelector label="ระเบียบวินัย" icon="📏" current={rubric.discipline} onSelect={(v) => updateRubricItem('discipline', v)}/>
                </div>
                <div className="mt-6">
                  <label className="block text-xs font-bold text-indigo-300 mb-2 ml-2">คำติชมและข้อแนะนำ (ภาษาไทย)</label>
                  <textarea value={rubric.comment} onChange={(e) => updateRubricItem('comment', e.target.value)} className="w-full p-4 rounded-2xl h-24 border-4 border-indigo-100 outline-none text-sm focus:border-indigo-400 transition-all shadow-inner bg-white font-medium" placeholder="เขียนคำแนะนำดีๆ ให้นักเรียนที่นี่นะจ๊ะ..."/>
                </div>
                <div className="flex flex-col sm:flex-row gap-4 mt-6">
                  <button onClick={handleSave} disabled={saving} className="flex-1 bg-indigo-500 text-white font-kids text-xl py-4 rounded-2xl shadow-xl hover:scale-[1.01] active:scale-95 transition-all border-b-6 border-indigo-700">
                    {saving ? 'กำลังประมวลผล...' : 'บันทึกคะแนนเรียบร้อย! 💾'}
                  </button>
                  <button onClick={() => setEditingId(null)} className="bg-white text-gray-400 px-8 py-4 rounded-2xl border-4 border-gray-100 font-bold hover:bg-gray-50 transition-all">ยกเลิก</button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default TeacherView;
