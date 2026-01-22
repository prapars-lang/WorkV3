
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
  const [viewMode, setViewMode] = useState<'list' | 'summary'>('list');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [filterText, setFilterText] = useState('');
  const [filterGrade, setFilterGrade] = useState('All');
  const [filterRoom, setFilterRoom] = useState('All');
  const [filterActivity, setFilterActivity] = useState('Sports Day');
  const [filterStatus, setFilterStatus] = useState<'All' | 'Pending' | 'Graded'>('All');
  
  const [isBulkGrading, setIsBulkGrading] = useState(false);
  const [bulkProgress, setBulkProgress] = useState({ current: 0, total: 0, currentName: '' });
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // States for Advanced PDF Export & Summary
  const [exportGrade, setExportGrade] = useState<string>('Prathom 5');
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

  const summaryData = useMemo(() => {
    return submissions
      .filter(s => s.grade === exportGrade && s.activityType === exportActivity)
      .sort((a, b) => {
        if (a.room !== b.room) return a.room.localeCompare(b.room);
        return parseInt(a.studentNumber || '0') - parseInt(b.studentNumber || '0');
      });
  }, [submissions, exportGrade, exportActivity]);

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
      contents: `คุณคือครู AI ผู้เชี่ยวชาญ ประเมินวิดีโอของ "${student.name}" 
      กิจกรรม: ${student.activityType === 'Sports Day' ? 'กีฬาสี' : 'วันเด็ก'}
      ให้คะแนน 0-5 ในหัวข้อ contentAccuracy, participation, presentation, discipline
      และเขียนคำชมภาษาไทยที่อบอุ่นแบบคุณครูคุยกับลูกศิษย์ (ใช้คำว่า หนู, นะลูก, จ๊ะ)
      ส่งคืนเป็น JSON เท่านั้น`,
      config: { 
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            contentAccuracy: { type: Type.INTEGER },
            participation: { type: Type.INTEGER },
            presentation: { type: Type.INTEGER },
            discipline: { type: Type.INTEGER },
            comment: { type: Type.STRING }
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
    } catch (error) { setErrorMessage("AI ตรวจไม่สำเร็จจ้า"); } finally { setIsAutoGrading(false); }
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
            ...aiResult, totalScore: total, 
            percentage: Math.round((total / 20) * 100), status: 'Graded',
            comment: `🤖 [AI ตรวจอัตโนมัติ]: ${aiResult.comment}`, activityType: sub.activityType
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

  const renderOfficialPDF = (dataList: StudentSubmission[], subtitle: string, scoreOnly = false) => {
    const printArea = document.getElementById('print-area');
    if (!printArea) return;
    const activityName = exportActivity === 'Sports Day' ? 'กิจกรรมกีฬาสี 🏃' : 'กิจกรรมวันเด็ก 🎈';

    printArea.innerHTML = `
      <div class="print-header" style="font-family: 'Sarabun', sans-serif; text-align: center; margin-bottom: 30px;">
        <h1 style="font-size: 22pt; margin: 0; font-weight: bold;">แบบสรุปผลคะแนนวิชาสุขศึกษาและพลศึกษา</h1>
        <h2 style="font-size: 16pt; margin: 5px 0;">${activityName}</h2>
        <p style="font-size: 13pt; font-weight: bold;">${subtitle}</p>
        <p style="font-size: 11pt; color: #333; margin-top: 10px;">คุณครูผู้สอน: ${teacherName}</p>
      </div>
      <table style="width: 100%; border: 1px solid #000; border-collapse: collapse; font-family: 'Sarabun', sans-serif;">
        <thead>
          <tr style="background-color: #f1f5f9;">
            <th style="border: 1px solid #000; padding: 10px; width: 10%;">ห้อง</th>
            <th style="border: 1px solid #000; padding: 10px; width: 10%;">เลขที่</th>
            <th style="border: 1px solid #000; padding: 10px; width: 35%; text-align: left;">ชื่อ-นามสกุล</th>
            <th style="border: 1px solid #000; padding: 10px; width: 15%;">คะแนน (20)</th>
            <th style="border: 1px solid #000; padding: 10px; width: 15%;">ร้อยละ</th>
            ${!scoreOnly ? '<th style="border: 1px solid #000; padding: 10px; width: 15%; text-align: left;">สถานะ</th>' : ''}
          </tr>
        </thead>
        <tbody>
          ${dataList.map(s => `
            <tr>
              <td style="border: 1px solid #000; padding: 8px; text-align: center;">${s.room.replace('Room ', '')}</td>
              <td style="border: 1px solid #000; padding: 8px; text-align: center;">${s.studentNumber}</td>
              <td style="border: 1px solid #000; padding: 8px; text-align: left;">${s.name}</td>
              <td style="border: 1px solid #000; padding: 8px; text-align: center; font-weight: bold;">${s.review?.totalScore ?? '-'}</td>
              <td style="border: 1px solid #000; padding: 8px; text-align: center;">${s.review?.percentage ?? '-'}%</td>
              ${!scoreOnly ? `<td style="border: 1px solid #000; padding: 8px; text-align: center;">${s.review?.status === 'Graded' ? '✔️' : '⏳'}</td>` : ''}
            </tr>
          `).join('')}
        </tbody>
      </table>
      <div style="margin-top: 50px; text-align: right; padding-right: 50px; font-family: 'Sarabun', sans-serif;">
        <p>ลงชื่อ..........................................................</p>
        <p style="margin-top: 10px; font-weight: bold;">(${teacherName})</p>
      </div>
    `;
    window.print();
  };

  const PointSelector = ({ label, icon, current, onSelect }: { label: string, icon: string, current: number, onSelect: (v: number) => void }) => (
    <div className="bg-white p-4 rounded-2xl border-2 border-indigo-50 mb-4 shadow-sm">
      <div className="flex justify-between items-center mb-3">
        <span className="font-bold text-indigo-700 flex items-center gap-2"><span>{icon}</span> {label}</span>
        <span className="bg-indigo-100 text-indigo-600 px-3 py-1 rounded-full text-xs font-bold">{current}/5</span>
      </div>
      <div className="flex gap-2">
        {[0, 1, 2, 3, 4, 5].map(pt => (
          <button key={pt} onClick={() => onSelect(pt)} className={`flex-1 py-3 rounded-xl font-bold transition-all ${current === pt ? 'bg-indigo-500 text-white' : 'bg-gray-50 text-gray-400'}`}>{pt}</button>
        ))}
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {isBulkGrading && (
        <div className="fixed inset-0 z-[200] bg-indigo-900/60 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="bg-white rounded-[3rem] p-10 max-w-lg w-full text-center shadow-2xl border-8 border-indigo-50">
            <div className="text-7xl mb-6 animate-bounce">🤖</div>
            <h3 className="text-3xl font-kids text-indigo-600 mb-2">AI กำลังช่วยตรวจงาน...</h3>
            <p className="text-slate-500 font-bold mb-8">ของนักเรียน: <span className="text-indigo-500">{bulkProgress.currentName}</span></p>
            <div className="w-full bg-slate-100 h-6 rounded-full overflow-hidden mb-4 border-2 border-indigo-50">
              <div className="bg-gradient-to-r from-indigo-400 to-indigo-600 h-full transition-all duration-500" style={{ width: `${(bulkProgress.current / bulkProgress.total) * 100}%` }}></div>
            </div>
            <p className="text-sm font-black text-indigo-400">{bulkProgress.current} จาก {bulkProgress.total} งาน</p>
          </div>
        </div>
      )}

      <div className="bg-white rounded-[3rem] p-6 shadow-xl border-4 border-indigo-50">
        <div className="flex flex-col lg:flex-row justify-between items-center gap-6 mb-8">
            <div className="flex items-center gap-6">
              <div className="text-6xl bg-indigo-100 p-4 rounded-3xl shadow-inner">👩‍🏫</div>
              <div>
                  <h2 className="text-2xl font-kids text-indigo-600">จัดการคะแนน โดยคุณครู {teacherName}</h2>
                  <div className="flex gap-2 mt-1">
                    <button onClick={() => setViewMode('list')} className={`px-4 py-1 rounded-full text-xs font-bold transition-all ${viewMode === 'list' ? 'bg-indigo-500 text-white' : 'bg-indigo-50 text-indigo-400'}`}>รายการตรวจงาน</button>
                    <button onClick={() => setViewMode('summary')} className={`px-4 py-1 rounded-full text-xs font-bold transition-all ${viewMode === 'summary' ? 'bg-indigo-500 text-white' : 'bg-indigo-50 text-indigo-400'}`}>ตารางสรุปคะแนน</button>
                  </div>
              </div>
            </div>
            <button onClick={handleBulkAutoGrade} className="bg-yellow-400 text-indigo-900 px-8 py-4 rounded-2xl font-bold shadow-lg hover:bg-yellow-300 transition-all flex items-center gap-2">
                <span>🪄</span> AI ตรวจงานที่เหลือ ({pendingVisibleSubmissions.length})
            </button>
        </div>

        {/* 📊 Control Center for Summary & Export */}
        <div className="bg-emerald-50 p-6 rounded-[2.5rem] border-4 border-emerald-100 shadow-sm space-y-4">
          <h3 className="text-lg font-kids text-emerald-700 flex items-center gap-2">
            <span>📋</span> สรุปคะแนนรวมระดับชั้น (รายห้อง/เลขที่)
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-bold text-emerald-600 mb-2 ml-2">เลือกระดับชั้น</label>
              <select value={exportGrade} onChange={(e) => setExportGrade(e.target.value)} className="w-full p-3 rounded-2xl bg-white border-2 border-emerald-100 font-bold outline-none text-emerald-800">
                <option value="Prathom 5">ป.5</option>
                <option value="Prathom 6">ป.6</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-emerald-600 mb-2 ml-2">กิจกรรม</label>
              <select value={exportActivity} onChange={(e) => setExportActivity(e.target.value)} className="w-full p-3 rounded-2xl bg-white border-2 border-emerald-100 font-bold outline-none text-emerald-800">
                <option value="Sports Day">งานกีฬาสี 🏃</option>
                <option value="Children Day">งานวันเด็ก 🎈</option>
              </select>
            </div>
            <div className="md:col-span-2 flex items-end gap-2">
              <button onClick={() => renderOfficialPDF(summaryData, `สรุปคะแนนรวม ป.${exportGrade.slice(-1)}`, true)} className="flex-1 bg-emerald-600 text-white py-3 rounded-2xl font-bold text-xs hover:bg-emerald-700 shadow-md transition-all">
                พิมพ์สรุปคะแนน (PDF) 📄
              </button>
              <button onClick={() => setViewMode('summary')} className="flex-1 bg-white text-emerald-600 py-3 rounded-2xl font-bold text-xs border-2 border-emerald-200 hover:bg-emerald-100 transition-all">
                ดูตารางบนหน้าจอ 📊
              </button>
            </div>
          </div>
        </div>
      </div>

      {viewMode === 'summary' ? (
        <div className="bg-white p-8 rounded-[3rem] shadow-xl border-4 border-indigo-50 animate-in fade-in slide-in-from-bottom duration-500">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-2xl font-kids text-indigo-600">ตารางคะแนนรวม ป.${exportGrade.slice(-1)} - ${exportActivity === 'Sports Day' ? 'กีฬาสี' : 'วันเด็ก'}</h3>
            <button onClick={() => setViewMode('list')} className="text-indigo-400 font-bold hover:underline">กลับไปยังหน้ารายการ</button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-indigo-50 text-indigo-700">
                  <th className="p-4 border border-indigo-100 rounded-tl-2xl">ห้อง</th>
                  <th className="p-4 border border-indigo-100">เลขที่</th>
                  <th className="p-4 border border-indigo-100 text-left">ชื่อ-นามสกุล</th>
                  <th className="p-4 border border-indigo-100">คะแนน (20)</th>
                  <th className="p-4 border border-indigo-100 rounded-tr-2xl">ร้อยละ</th>
                </tr>
              </thead>
              <tbody>
                {summaryData.length === 0 ? (
                  <tr><td colSpan={5} className="p-10 text-center text-gray-400 italic">ไม่พบข้อมูลในเงื่อนไขที่เลือก</td></tr>
                ) : (
                  summaryData.map((s, idx) => (
                    <tr key={idx} className="hover:bg-slate-50 transition-colors">
                      <td className="p-3 border border-slate-100 text-center font-bold text-slate-500">{s.room.replace('Room ', '')}</td>
                      <td className="p-3 border border-slate-100 text-center font-bold text-slate-700">{s.studentNumber}</td>
                      <td className="p-3 border border-slate-100 text-left font-medium">{s.name}</td>
                      <td className="p-3 border border-slate-100 text-center font-black text-indigo-600">{s.review?.totalScore ?? '-'}</td>
                      <td className="p-3 border border-slate-100 text-center font-bold text-emerald-500">{s.review?.percentage ?? '-'}%</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <>
          <div className="bg-white p-4 rounded-[2.5rem] shadow-sm border-2 border-indigo-50">
              <div className="flex flex-wrap justify-center gap-3 mb-6">
                  {[{id: 'All', label: 'ทั้งหมด', icon: '📁'}, {id: 'Pending', label: 'รอตรวจ', icon: '⏳'}, {id: 'Graded', label: 'ตรวจแล้ว', icon: '✅'}].map(tab => (
                      <button key={tab.id} onClick={() => setFilterStatus(tab.id as any)} className={`px-6 py-2.5 rounded-2xl font-bold transition-all flex items-center gap-2 ${filterStatus === tab.id ? 'bg-indigo-500 text-white shadow-md' : 'text-indigo-400 hover:bg-white'}`}>
                          <span>{tab.icon}</span> {tab.label}
                      </button>
                  ))}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                      <label className="block text-[10px] font-black text-indigo-300 mb-2 ml-2 uppercase">ตัวกรองกิจกรรม</label>
                      <select value={filterActivity} onChange={(e) => setFilterActivity(e.target.value as any)} className="w-full p-3 rounded-2xl bg-white border-2 border-indigo-100 font-bold">
                          <option value="Sports Day">งานกีฬาสี 🏃</option>
                          <option value="Children Day">งานวันเด็ก 🎈</option>
                          <option value="All">ทุกกิจกรรม</option>
                      </select>
                  </div>
                  <div>
                      <label className="block text-[10px] font-black text-indigo-300 mb-2 ml-2 uppercase">ค้นหา ชื่อ/เลขที่</label>
                      <input type="text" placeholder="พิมพ์เพื่อค้นหา..." value={filterText} onChange={(e) => setFilterText(e.target.value)} className="w-full p-3 rounded-2xl bg-white border-2 border-indigo-100 outline-none font-bold"/>
                  </div>
                  <div>
                      <label className="block text-[10px] font-black text-indigo-300 mb-2 ml-2 uppercase">ระดับชั้น</label>
                      <select value={filterGrade} onChange={(e) => setFilterGrade(e.target.value)} className="w-full p-3 rounded-2xl bg-white border-2 border-indigo-100 font-bold">
                          <option value="All">ทุกชั้น</option>
                          <option value="Prathom 5">ป.5</option>
                          <option value="Prathom 6">ป.6</option>
                      </select>
                  </div>
                  <div>
                      <label className="block text-[10px] font-black text-indigo-300 mb-2 ml-2 uppercase">ห้องเรียน</label>
                      <select value={filterRoom} onChange={(e) => setFilterRoom(e.target.value)} className="w-full p-3 rounded-2xl bg-white border-2 border-indigo-100 font-bold">
                          <option value="All">ทุกห้อง</option>
                          {[1,2,3,4].map(r => <option key={r} value={`Room ${r}`}>ห้อง {r}</option>)}
                      </select>
                  </div>
              </div>
          </div>

          <div className="grid gap-4">
            {filteredSubmissions.length === 0 ? (
              <div className="text-center py-20 bg-white rounded-[3rem] border-4 border-dashed border-indigo-50 shadow-inner">
                <p className="text-7xl mb-6">🏜️</p>
                <p className="text-indigo-300 font-bold italic font-kids">ไม่พบข้อมูลที่ตรงเงื่อนไขจ้า</p>
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
                      <p className="text-[10px] font-black text-indigo-400 uppercase">เลขที่ {sub.studentNumber} | {sub.grade === 'Prathom 5' ? 'ป.5' : 'ป.6'} | {sub.room.replace('Room ','ห้อง ')}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <a href={sub.fileUrl} target="_blank" className="bg-indigo-500 text-white px-6 py-2 rounded-xl font-bold shadow-md hover:bg-indigo-600 transition-all text-sm">ดูวิดีโอ 📺</a>
                    <button onClick={() => startGrading(sub)} className={`px-6 py-2 rounded-xl font-bold shadow-md transition-all text-sm text-white ${sub.review?.status === 'Graded' ? 'bg-green-500 hover:bg-green-600' : 'bg-orange-400 hover:bg-orange-500'}`}>
                      {sub.review?.status === 'Graded' ? `ตรวจแล้ว (${sub.review.totalScore}/20)` : 'ประเมินงาน ✍️'}
                    </button>
                  </div>
                </div>
                {editingId === sub.rowId && (
                  <div className="mt-6 p-6 bg-indigo-50 rounded-[2rem] border-4 border-indigo-100 shadow-inner animate-in slide-in-from-top duration-500">
                    <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
                      <h4 className="text-lg font-kids text-indigo-700">📑 แบบประเมินรายบุคคล</h4>
                      <button onClick={handleAutoGrade} disabled={isAutoGrading} className="bg-yellow-400 text-indigo-900 px-5 py-2 rounded-xl font-black text-xs shadow-md disabled:opacity-50">
                        {isAutoGrading ? '🪄 กำลังวิเคราะห์...' : '🪄 ให้ AI ประเมินเบื้องต้น'}
                      </button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <PointSelector label="เนื้อหา/ความถูกต้อง" icon="✅" current={rubric.contentAccuracy} onSelect={(v) => updateRubricItem('contentAccuracy', v)}/>
                      <PointSelector label="ความพยายาม/ตั้งใจ" icon="🤝" current={rubric.participation} onSelect={(v) => updateRubricItem('participation', v)}/>
                      <PointSelector label="เทคนิคการนำเสนอ" icon="🎤" current={rubric.presentation} onSelect={(v) => updateRubricItem('presentation', v)}/>
                      <PointSelector label="ระเบียบวินัย" icon="📏" current={rubric.discipline} onSelect={(v) => updateRubricItem('discipline', v)}/>
                    </div>
                    <div className="mt-6">
                      <label className="block text-xs font-bold text-indigo-300 mb-2 ml-2">ความคิดเห็นจากคุณครู</label>
                      <textarea value={rubric.comment} onChange={(e) => updateRubricItem('comment', e.target.value)} className="w-full p-4 rounded-2xl h-24 border-4 border-indigo-100 outline-none text-sm shadow-inner bg-white" placeholder="เขียนคำชมเชยที่นี่นะจ๊ะ..."/>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-4 mt-6">
                      <button onClick={handleSave} disabled={saving} className="flex-1 bg-indigo-500 text-white font-kids text-xl py-4 rounded-2xl shadow-xl hover:scale-[1.01] active:scale-95 transition-all border-b-6 border-indigo-700">
                        {saving ? 'กำลังบันทึก...' : 'บันทึกคะแนนเลย! 💾'}
                      </button>
                      <button onClick={() => setEditingId(null)} className="bg-white text-gray-400 px-8 py-4 rounded-2xl border-4 border-gray-100 font-bold hover:bg-gray-50 transition-all">ยกเลิก</button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default TeacherView;
