import React, { useState, useMemo } from 'react';
import { GoogleGenAI, Type } from "@google/genai";
import { StudentSubmission, RubricReview } from '../types';

interface TeacherViewProps {
  submissions: StudentSubmission[];
  onUpdate: () => void;
  handleUpdateGrade: (rowId: number, rubricData: any) => Promise<boolean>;
  rubricCriteria: any[];
  teacherName: string;
  onGenerateAIFeedback: (studentName: string, rubric: RubricReview) => Promise<string>;
}

const TeacherView: React.FC<TeacherViewProps> = ({ submissions, onUpdate, handleUpdateGrade, teacherName }) => {
  const [viewMode, setViewMode] = useState<'list' | 'summary'>('list');
  const [editingId, setEditingId] = useState<number | null>(null);
  
  // 🔍 กรองสำหรับหน้ารายการ (List View)
  const [filterText, setFilterText] = useState('');
  const [filterGrade, setFilterGrade] = useState('All');
  const [filterRoom, setFilterRoom] = useState('All');
  const [filterActivity, setFilterActivity] = useState('All');
  const [filterStatus, setFilterStatus] = useState<'All' | 'Pending' | 'Graded'>('All');

  // 📊 กรองสำหรับหน้าสรุปผล (Summary View)
  const [summaryGrade, setSummaryGrade] = useState('Prathom 5');
  const [summaryRoom, setSummaryRoom] = useState('All');
  const [summaryActivity, setSummaryActivity] = useState('Sports Day');

  const [rubric, setRubric] = useState<RubricReview>({
    contentAccuracy: 0, participation: 0, presentation: 0, discipline: 0,
    totalScore: 0, percentage: 0, comment: '', status: 'Pending'
  });

  const [saving, setSaving] = useState(false);
  const [isAutoGrading, setIsAutoGrading] = useState(false);
  const [batchProcessing, setBatchProcessing] = useState(false);

  // คำนวณจำนวนงาน
  const statusCounts = useMemo(() => {
    const counts = { All: 0, Pending: 0, Graded: 0 };
    submissions.forEach(s => {
      counts.All++;
      if (s.review?.status === 'Graded') counts.Graded++;
      else counts.Pending++;
    });
    return counts;
  }, [submissions]);

  // ลอจิกการคำนวณคะแนน
  const updateRubricItem = (key: string, value: number) => {
    setRubric(prev => {
      const next = { ...prev, [key]: value } as any;
      const total = (Number(next.contentAccuracy) || 0) + 
                    (Number(next.participation) || 0) + 
                    (Number(next.presentation) || 0) + 
                    (Number(next.discipline) || 0);
      return {
        ...next,
        totalScore: total,
        percentage: Math.round((total / 20) * 100)
      };
    });
  };

  // ✅ ระบบกรองความแม่นยำสูง (List View)
  const filteredSubmissions = useMemo(() => {
    return submissions.filter(s => {
      const searchStr = filterText.toLowerCase().trim();
      const matchesText = !searchStr || 
                         (s.name && s.name.toLowerCase().includes(searchStr)) || 
                         (s.studentNumber && s.studentNumber.toString().trim() === searchStr);
      
      const matchesGrade = filterGrade === 'All' || s.grade.trim() === filterGrade.trim();
      const matchesRoom = filterRoom === 'All' || s.room.trim() === filterRoom.trim();
      const matchesActivity = filterActivity === 'All' || s.activityType.trim() === filterActivity.trim();
      
      const isGraded = s.review?.status === 'Graded';
      const matchesStatus = filterStatus === 'All' || 
                           (filterStatus === 'Graded' && isGraded) || 
                           (filterStatus === 'Pending' && !isGraded);
                           
      return matchesText && matchesGrade && matchesRoom && matchesActivity && matchesStatus;
    });
  }, [submissions, filterText, filterGrade, filterRoom, filterActivity, filterStatus]);

  // ✅ ระบบกรองสำหรับตารางสรุป/พิมพ์ (Summary View)
  const sortedSummaryData = useMemo(() => {
    return submissions
      .filter(s => {
        const matchesGrade = s.grade.trim() === summaryGrade.trim();
        const matchesActivity = s.activityType.trim() === summaryActivity.trim();
        const matchesRoom = summaryRoom === 'All' || s.room.trim() === summaryRoom.trim();
        return matchesGrade && matchesActivity && matchesRoom;
      })
      .sort((a, b) => {
        if (a.room !== b.room) return a.room.localeCompare(b.room);
        return parseInt(a.studentNumber || '0') - parseInt(b.studentNumber || '0');
      });
  }, [submissions, summaryGrade, summaryActivity, summaryRoom]);

  // 🤖 AI ตรวจงานคนเดียว
  const handleAutoGrade = async (studentId?: number) => {
    const id = studentId || editingId;
    const student = submissions.find(s => s.rowId === id);
    if (!student) return null;
    
    setIsAutoGrading(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `วิเคราะห์วิดีโอชื่อกิจกรรม "${student.activityType}" ของนักเรียน "${student.name}" (ให้คะแนน 0-5 ในหัวข้อ Accuracy, Participation, Presentation, Discipline) และเขียนคำชมสั้นๆ ภาษาไทย ส่งกลับเป็น JSON`,
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
            required: ['contentAccuracy', 'participation', 'presentation', 'discipline', 'comment']
          }
        }
      });
      const res = JSON.parse(response.text || '{}');
      const total = (res.contentAccuracy || 0) + (res.participation || 0) + (res.presentation || 0) + (res.discipline || 0);
      const result = { 
        ...res, 
        totalScore: total, 
        percentage: Math.round((total / 20) * 100),
        comment: `🤖 AI ประเมิน: ${res.comment || ''}`
      };
      
      if (!studentId) setRubric(prev => ({ ...prev, ...result }));
      return result;
    } catch (e) { 
      console.error(e); 
      return null;
    } finally { 
      setIsAutoGrading(false); 
    }
  };

  // 🤖 AI ตรวจงานแบบกลุ่ม (Batch)
  const handleBatchAI = async () => {
    const pendingList = filteredSubmissions.filter(s => s.review?.status !== 'Graded');
    if (pendingList.length === 0) {
        alert("ไม่มีงานที่ยังไม่ได้ตรวจในรายการปัจจุบันจ้า ✨");
        return;
    }
    
    if (!confirm(`ต้องการให้ AI ตรวจงานที่เหลือจำนวน ${pendingList.length} รายการ ใช่หรือไม่?`)) return;
    
    setBatchProcessing(true);
    let successCount = 0;
    
    for (const student of pendingList) {
        const aiResult = await handleAutoGrade(student.rowId);
        if (aiResult) {
            // เมื่อตรวจแบบกลุ่ม จะมีการส่งข้อมูลไปบันทึก และกระตุ้น Notification ในฝั่ง GAS
            await handleUpdateGrade(student.rowId!, { ...aiResult, status: 'Graded', activityType: student.activityType });
            successCount++;
        }
    }
    
    setBatchProcessing(false);
    onUpdate();
    alert(`ตรวจสำเร็จ ${successCount} รายการเรียบร้อยแล้วจ๊ะ! 🎉`);
  };

  const handleSave = async () => {
    if (!editingId) return;
    setSaving(true);
    const sub = submissions.find(s => s.rowId === editingId);
    const success = await handleUpdateGrade(editingId, { ...rubric, status: 'Graded', activityType: sub?.activityType });
    if (success) { 
        setEditingId(null); 
        onUpdate(); 
    }
    setSaving(false);
  };

  const PointSelector = ({ label, current, onSelect }: { label: string, current: number, onSelect: (v: number) => void }) => (
    <div className="bg-white p-3 rounded-xl border border-indigo-50 mb-2 shadow-sm">
      <div className="flex justify-between items-center mb-2">
        <span className="font-bold text-indigo-700 text-[11px] font-kids">{label}</span>
        <span className="text-[11px] font-bold text-indigo-400 bg-indigo-50 px-2 rounded-full">{current}/5</span>
      </div>
      <div className="flex gap-1">
        {[0, 1, 2, 3, 4, 5].map(pt => (
          <button 
            key={pt} 
            onClick={() => onSelect(pt)} 
            className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${current === pt ? 'bg-indigo-500 text-white shadow-md' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'}`}
          >
            {pt}
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* 🛠️ Teacher Navigation (Hidden in Print) */}
      <div className="bg-white rounded-[2.5rem] p-6 shadow-xl border-4 border-indigo-50 no-print">
        <div className="flex flex-col lg:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-4">
            <div className="text-4xl bg-indigo-100 p-3 rounded-2xl">👩‍🏫</div>
            <div>
              <h2 className="text-xl font-kids text-indigo-600">จัดการข้อมูลคุณครู: {teacherName || 'Krukai'}</h2>
              <div className="flex gap-2 mt-2">
                <button 
                    onClick={() => setViewMode('list')} 
                    className={`px-6 py-2 rounded-full text-xs font-bold transition-all border-b-4 ${viewMode === 'list' ? 'bg-indigo-600 text-white border-indigo-800 shadow-md' : 'bg-indigo-50 text-indigo-400 border-indigo-100 hover:bg-indigo-100'}`}
                >
                    ตรวจงานนักเรียน 📥
                </button>
                <button 
                    onClick={() => setViewMode('summary')} 
                    className={`px-6 py-2 rounded-full text-xs font-bold transition-all border-b-4 ${viewMode === 'summary' ? 'bg-emerald-600 text-white border-emerald-800 shadow-md' : 'bg-indigo-50 text-indigo-400 border-indigo-100 hover:bg-indigo-100'}`}
                >
                    ตารางสรุปคะแนน 📊
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {viewMode === 'summary' ? (
        /* --- 📊 สรุปผลคะแนน / พิมพ์รายงาน --- */
        <div className="animate-in fade-in duration-500">
          <div className="bg-white p-6 rounded-[2.5rem] shadow-lg border-4 border-emerald-50 mb-6 no-print filter-controls">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
              <div className="space-y-2">
                <label className="block text-[11px] font-black text-emerald-600 uppercase tracking-widest ml-3">เลือกระดับชั้น</label>
                <select 
                    value={summaryGrade} 
                    onChange={e => setSummaryGrade(e.target.value)} 
                    className="w-full p-4 rounded-2xl bg-slate-50 border-2 border-emerald-100 font-bold outline-none text-emerald-700 cursor-pointer shadow-inner"
                >
                  <option value="Prathom 5">ประถมศึกษาปีที่ 5</option>
                  <option value="Prathom 6">ประถมศึกษาปีที่ 6</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="block text-[11px] font-black text-emerald-600 uppercase tracking-widest ml-3">เลือกห้องเรียน</label>
                <select 
                    value={summaryRoom} 
                    onChange={e => setSummaryRoom(e.target.value)} 
                    className="w-full p-4 rounded-2xl bg-slate-50 border-2 border-emerald-100 font-bold outline-none text-emerald-700 cursor-pointer shadow-inner"
                >
                  <option value="All">ทุกห้องเรียน (พิมพ์รวมทั้งสายชั้น)</option>
                  {[1, 2, 3, 4].map(r => <option key={r} value={`Room ${r}`}>ห้องเรียน {r}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <label className="block text-[11px] font-black text-emerald-600 uppercase tracking-widest ml-3">เลือกกิจกรรม</label>
                <select 
                    value={summaryActivity} 
                    onChange={e => setSummaryActivity(e.target.value)} 
                    className="w-full p-4 rounded-2xl bg-slate-50 border-2 border-emerald-100 font-bold outline-none text-emerald-700 cursor-pointer shadow-inner"
                >
                  <option value="Sports Day">งานกีฬาสี 🏃</option>
                  <option value="Children Day">งานวันเด็ก 🎈</option>
                </select>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
                <button 
                    onClick={() => { setSummaryRoom('All'); setTimeout(() => window.print(), 300); }} 
                    className="bg-emerald-600 text-white px-8 py-4 rounded-2xl font-bold shadow-xl hover:bg-emerald-700 transition-all border-b-8 border-emerald-800 active:border-b-0 active:translate-y-2"
                >
                    พิมพ์รายงานรวมทั้งสายชั้น 📄
                </button>
                <button 
                    onClick={() => window.print()} 
                    className="bg-slate-800 text-white px-8 py-4 rounded-2xl font-bold shadow-xl hover:bg-black transition-all border-b-8 border-slate-900 active:border-b-0 active:translate-y-2"
                >
                    พิมพ์เฉพาะที่เลือก (PDF) 🖨️
                </button>
            </div>
          </div>

          {/* 📄 Report Section (A4 Print Ready) */}
          <div className="bg-white rounded-[2.5rem] p-4 md:p-12 shadow-sm border-2 border-slate-50 print-table-section">
            <div className="hidden print:block text-center border-b-4 border-black pb-8 mb-10">
              <h1 className="text-3xl font-bold font-sarabun text-black mb-2">รายงานสรุปผลคะแนนการส่งงานกิจกรรมออนไลน์</h1>
              <h2 className="text-xl font-bold font-sarabun text-black">วิชาสุขศึกษาและพลศึกษา ประจำปีการศึกษา 2568</h2>
              <div className="flex justify-between items-center text-sm mt-10 font-bold font-sarabun px-6 border-2 border-slate-200 py-3 rounded-2xl">
                <p>ชั้น: {summaryGrade === 'Prathom 5' ? 'ประถมศึกษาปีที่ 5' : 'ประถมศึกษาปีที่ 6'}</p>
                <p>ห้อง: {summaryRoom === 'All' ? 'ทุกห้องเรียน' : summaryRoom.replace('Room ', '')}</p>
                <p>กิจกรรม: {summaryActivity === 'Sports Day' ? 'งานกีฬาสี 🏃' : 'งานวันเด็ก 🎈'}</p>
                <p>ครูผู้สอน: {teacherName || 'คุณครู Krukai'}</p>
              </div>
            </div>

            <div className="no-print mb-8 flex items-center justify-between border-l-8 border-emerald-500 pl-6 py-2">
               <div>
                  <h3 className="text-2xl font-kids text-slate-700 font-bold">ตารางสรุปคะแนนนักเรียน</h3>
                  <p className="text-xs font-bold text-slate-400 mt-1 uppercase tracking-tighter">แสดงข้อมูลตรงตามเงื่อนไขที่เลือกด้านบน</p>
               </div>
            </div>

            <div className="overflow-x-auto rounded-[1.5rem] border border-slate-100 shadow-inner">
              <table className="w-full border-collapse font-sarabun">
                <thead>
                  <tr className="bg-indigo-600 text-white print:bg-slate-100 print:text-black">
                    <th className="p-4 text-center font-bold border-r border-indigo-700 print:border-black">ห้อง</th>
                    <th className="p-4 text-center font-bold border-r border-indigo-700 print:border-black">เลขที่</th>
                    <th className="p-4 text-left font-bold border-r border-indigo-700 print:border-black">ชื่อ-นามสกุล</th>
                    <th className="p-4 text-center font-bold border-r border-indigo-700 print:border-black">คะแนน (20)</th>
                    <th className="p-4 text-center font-bold">ร้อยละ (%)</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedSummaryData.length === 0 ? (
                    <tr>
                        <td colSpan={5} className="p-24 text-center text-slate-300 italic font-bold text-xl">ไม่มีข้อมูลในเงื่อนไขที่เลือกจ้า 🏜️</td>
                    </tr>
                  ) : (
                    sortedSummaryData.map((s, idx) => (
                      <tr key={idx} className={`border-b border-slate-100 print:border-black transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}`}>
                        <td className="p-4 text-center font-bold text-slate-500 print:text-black border-r border-slate-50 print:border-black">{s.room.replace('Room ', '')}</td>
                        <td className="p-4 text-center font-bold text-slate-700 print:text-black border-r border-slate-50 print:border-black">{s.studentNumber}</td>
                        <td className="p-4 text-left font-bold text-slate-800 print:text-black border-r border-slate-50 print:border-black">{s.name}</td>
                        <td className="p-4 text-center border-r border-slate-50 print:border-black">
                            <span className={`inline-block px-3 py-1 rounded-full font-black text-indigo-700 print:text-black ${s.review?.totalScore ? 'bg-indigo-50' : ''}`}>
                                {s.review?.totalScore ?? '-'}
                            </span>
                        </td>
                        <td className="p-4 text-center">
                             <span className={`inline-block px-3 py-1 rounded-full font-bold text-emerald-600 print:text-black ${s.review?.percentage ? 'bg-emerald-50' : ''}`}>
                                {s.review?.percentage ?? '-'}%
                             </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="hidden print:flex justify-around items-start mt-24 pt-16 border-t-2 border-slate-100">
              <div className="text-center w-72">
                <div className="border-b-2 border-black mb-4 h-16"></div>
                <p className="text-base font-bold">ลงชื่อครูผู้สอน</p>
                <p className="text-sm text-slate-600 mt-1 font-bold">( {teacherName || 'คุณครู Krukai'} )</p>
              </div>
              <div className="text-center w-72">
                <div className="border-b-2 border-black mb-4 h-16"></div>
                <p className="text-base font-bold">ลงชื่อผู้ตรวจสอบ</p>
                <p className="text-sm text-slate-600 mt-1 font-bold">( .................................................... )</p>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* --- 📥 รายการส่งงาน (List View) --- */
        <div className="space-y-6 animate-in slide-in-from-top duration-500 no-print">
          <div className="bg-white p-8 rounded-[3rem] shadow-xl border-4 border-indigo-50 space-y-8">
            <div className="flex flex-col md:flex-row justify-between items-center gap-6">
                <div className="space-y-4 flex-1 w-full">
                    <label className="block text-sm font-black text-indigo-400 uppercase tracking-widest ml-3">เลือกงานแยกตามกิจกรรม ✨</label>
                    <div className="grid grid-cols-3 gap-3">
                        {['All', 'Sports Day', 'Children Day'].map(act => (
                            <button 
                                key={act}
                                onClick={() => setFilterActivity(act)}
                                className={`py-4 rounded-2xl font-bold transition-all border-b-8 ${filterActivity === act ? 'bg-indigo-600 text-white border-indigo-800 shadow-xl' : 'bg-slate-50 text-slate-400 border-slate-200'}`}
                            >
                                {act === 'All' ? 'ทั้งหมด' : act === 'Sports Day' ? 'กีฬาสี 🏃' : 'วันเด็ก 🎈'}
                            </button>
                        ))}
                    </div>
                </div>
                <button 
                    onClick={handleBatchAI}
                    disabled={batchProcessing}
                    className={`px-10 py-8 rounded-[2rem] font-black text-sm text-white transition-all shadow-2xl border-b-8 active:border-b-0 active:translate-y-2 flex flex-col items-center gap-2 ${batchProcessing ? 'bg-slate-400 border-slate-600' : 'bg-gradient-to-br from-yellow-400 to-orange-500 border-orange-700 animate-pulse hover:animate-none'}`}
                >
                    {batchProcessing ? (
                        <>⌛ กำลังตรวจกลุ่ม...</>
                    ) : (
                        <>🚀 ตรวจที่เหลือด้วย AI ทั้งหมด</>
                    )}
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end pt-8 border-t-2 border-slate-50">
              <div className="md:col-span-1">
                 <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-3">ค้นหาชื่อหรือเลขที่</label>
                 <input 
                    type="text" 
                    placeholder="ค้นหาที่นี่จ๊ะ..." 
                    value={filterText} 
                    onChange={e => setFilterText(e.target.value)} 
                    className="w-full p-4 rounded-2xl bg-slate-50 border-2 border-slate-100 outline-none text-sm font-bold text-indigo-600 shadow-inner"
                 />
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-3">ระดับชั้น</label>
                <select 
                    value={filterGrade} 
                    onChange={e => setFilterGrade(e.target.value)} 
                    className="w-full p-4 rounded-2xl bg-white border-2 border-slate-100 text-xs font-bold outline-none cursor-pointer"
                >
                  <option value="All">ทุกระดับชั้น</option>
                  <option value="Prathom 5">ประถมศึกษาปีที่ 5</option>
                  <option value="Prathom 6">ประถมศึกษาปีที่ 6</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-3">ห้องเรียน</label>
                <select 
                    value={filterRoom} 
                    onChange={e => setFilterRoom(e.target.value)} 
                    className="w-full p-4 rounded-2xl bg-white border-2 border-slate-100 text-xs font-bold outline-none cursor-pointer"
                >
                  <option value="All">ทุกห้องเรียน</option>
                  {[1, 2, 3, 4].map(r => <option key={r} value={`Room ${r}`}>ห้องเรียน {r}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-3">สถานะตรวจงาน</label>
                <select 
                    value={filterStatus} 
                    onChange={e => setFilterStatus(e.target.value as any)} 
                    className="w-full p-4 rounded-2xl bg-white border-2 border-slate-100 text-xs font-bold outline-none cursor-pointer"
                >
                  <option value="All">ดูงานทั้งหมด ({statusCounts.All})</option>
                  <option value="Pending">⌛ รอตรวจ ({statusCounts.Pending})</option>
                  <option value="Graded">✅ ตรวจแล้ว ({statusCounts.Graded})</option>
                </select>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            {filteredSubmissions.length === 0 ? (
              <div className="text-center p-24 bg-white/40 rounded-[4rem] border-4 border-dashed border-slate-200">
                <p className="text-6xl mb-4 grayscale opacity-20">🏜️</p>
                <p className="text-xl text-gray-400 font-bold italic">ไม่พบงานที่ค้นหาจ้า หนูส่งงานหรือยังจ๊ะ?</p>
              </div>
            ) : (
              filteredSubmissions.map((sub) => (
                <div key={sub.rowId} className={`group p-6 rounded-[3.5rem] border-4 transition-all bg-white hover:scale-[1.01] shadow-sm hover:shadow-xl ${sub.review?.status === 'Graded' ? 'border-green-100' : 'border-indigo-50'}`}>
                  <div className="flex flex-col md:flex-row justify-between items-center gap-6">
                    <div className="flex items-center gap-6">
                      <div className={`text-4xl p-5 rounded-3xl ${sub.activityType === 'Sports Day' ? 'bg-orange-50' : 'bg-cyan-50'}`}>
                        {sub.activityType === 'Sports Day' ? '🏃' : '🎈'}
                      </div>
                      <div>
                        <h4 className="text-xl font-bold text-slate-800">{sub.name} <span className="text-indigo-400 text-sm ml-2 font-kids bg-indigo-50 px-3 py-0.5 rounded-full">เลขที่ {sub.studentNumber}</span></h4>
                        <div className="flex gap-2 mt-2">
                            <span className="bg-slate-100 text-slate-500 px-4 py-1 rounded-full text-[10px] font-black uppercase">{sub.grade === 'Prathom 5' ? 'ป.5' : 'ป.6'} | {sub.room.replace('Room ', 'ห้อง ')}</span>
                            <span className={`px-4 py-1 rounded-full text-[10px] font-black uppercase ${sub.activityType === 'Sports Day' ? 'bg-orange-100 text-orange-600' : 'bg-cyan-100 text-cyan-600'}`}>
                                {sub.activityType === 'Sports Day' ? 'กีฬาสี' : 'วันเด็ก'}
                            </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-4">
                      <a 
                        href={sub.fileUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="bg-slate-100 text-slate-600 px-8 py-3.5 rounded-2xl font-bold text-xs hover:bg-slate-800 hover:text-white transition-all border-b-4 border-slate-200"
                      >
                        เปิดวิดีโอ 📺
                      </a>
                      <button 
                        onClick={() => { 
                            setEditingId(sub.rowId!); 
                            setRubric(sub.review || { contentAccuracy: 0, participation: 0, presentation: 0, discipline: 0, totalScore: 0, percentage: 0, comment: '', status: 'Pending' }); 
                        }} 
                        className={`px-8 py-3.5 rounded-2xl font-bold text-xs text-white transition-all border-b-8 active:border-b-0 active:translate-y-2 ${sub.review?.status === 'Graded' ? 'bg-green-500 border-green-700' : 'bg-indigo-500 border-indigo-700 shadow-xl'}`}
                      >
                        {sub.review?.status === 'Graded' ? `ตรวจแล้ว (${sub.review.totalScore}/20)` : 'ให้คะแนนนักเรียน ✍️'}
                      </button>
                    </div>
                  </div>

                  {editingId === sub.rowId && (
                    <div className="mt-8 p-10 bg-indigo-50/40 rounded-[4rem] border-4 border-indigo-100 animate-in slide-in-from-top duration-500 shadow-inner">
                      <div className="flex justify-between items-center mb-8">
                        <h5 className="font-kids text-indigo-700 text-xl font-bold">เกณฑ์การประเมินกิจกรรม</h5>
                        <button 
                            onClick={() => handleAutoGrade()} 
                            disabled={isAutoGrading} 
                            className="bg-yellow-400 text-indigo-900 px-8 py-4 rounded-3xl font-black text-xs shadow-xl hover:bg-yellow-300 hover:scale-[1.05] transition-all border-b-4 border-yellow-600"
                        >
                          {isAutoGrading ? '✨ AI กำลังวิเคราะห์วิดีโอ...' : '✨ ให้ AI ช่วยประเมินเบื้องต้น'}
                        </button>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <PointSelector label="ความถูกต้องของเนื้อหา" current={rubric.contentAccuracy} onSelect={v => updateRubricItem('contentAccuracy', v)}/>
                        <PointSelector label="การมีส่วนร่วมและความตั้งใจ" current={rubric.participation} onSelect={v => updateRubricItem('participation', v)}/>
                        <PointSelector label="เทคนิคการนำเสนอ" current={rubric.presentation} onSelect={v => updateRubricItem('presentation', v)}/>
                        <PointSelector label="วินัยและการตรงต่อเวลา" current={rubric.discipline} onSelect={v => updateRubricItem('discipline', v)}/>
                      </div>

                      <div className="mt-8">
                        <label className="block text-[11px] font-black text-indigo-400 uppercase tracking-widest mb-3 ml-6">คำแนะนำจากคุณครู 💬</label>
                        <textarea 
                            value={rubric.comment} 
                            onChange={e => setRubric({...rubric, comment: e.target.value})} 
                            className="w-full p-8 rounded-[3rem] h-36 border-4 border-indigo-50 outline-none text-base bg-white focus:border-indigo-400 transition-all shadow-inner font-bold font-sarabun" 
                            placeholder="เขียนความประทับใจให้หนูๆ ตรงนี้เลยจ๊ะ..."
                        />
                      </div>

                      <div className="flex gap-4 mt-10">
                        <button 
                            onClick={handleSave} 
                            disabled={saving} 
                            className="flex-[2] bg-indigo-600 text-white py-6 rounded-[2.5rem] font-bold text-xl shadow-2xl hover:bg-indigo-700 transition-all border-b-8 border-indigo-900 active:border-b-0 active:translate-y-2"
                        >
                          {saving ? 'กำลังบันทึก...' : 'บันทึกคะแนน ✅'}
                        </button>
                        <button 
                            onClick={() => setEditingId(null)} 
                            className="flex-1 px-10 bg-white text-slate-400 rounded-[2.5rem] border-4 border-slate-100 font-bold hover:bg-slate-50 transition-all"
                        >
                            ยกเลิก
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default TeacherView;