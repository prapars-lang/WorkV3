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
  
  // 🔍 สถานะการกรองสำหรับหน้ารายการ (List View)
  const [filterText, setFilterText] = useState('');
  const [filterGrade, setFilterGrade] = useState('All');
  const [filterRoom, setFilterRoom] = useState('All');
  const [filterActivity, setFilterActivity] = useState('All');
  const [filterStatus, setFilterStatus] = useState<'All' | 'Pending' | 'Graded'>('All');

  // 📊 สถานะการกรองสำหรับหน้าสรุปผล/พิมพ์รายงาน (Summary View) - สำคัญมาก
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

  // คำนวณสถิติเบื้องต้น
  const statusCounts = useMemo(() => {
    const counts = { All: 0, Pending: 0, Graded: 0 };
    submissions.forEach(s => {
      counts.All++;
      if (s.review?.status === 'Graded') counts.Graded++;
      else counts.Pending++;
    });
    return counts;
  }, [submissions]);

  // ฟังก์ชันอัปเดตคะแนนรูบริค
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

  // ✅ ลอจิกการกรองสำหรับหน้าตารางสรุป (Summary View) - ประมวลผลอย่างจริงจัง
  const sortedSummaryData = useMemo(() => {
    return submissions
      .filter(s => {
        // กรองระดับชั้น (ต้องตรงกันเป๊ะ)
        const matchesGrade = s.grade.trim() === summaryGrade.trim();
        
        // กรองประเภทกิจกรรม (ต้องตรงกันเป๊ะ)
        const matchesActivity = s.activityType.trim() === summaryActivity.trim();
        
        // กรองห้องเรียน (ถ้าเป็น All ให้ผ่านหมด ถ้าเลือกห้องต้องตรงกัน)
        const matchesRoom = summaryRoom === 'All' || s.room.trim() === summaryRoom.trim();
        
        return matchesGrade && matchesActivity && matchesRoom;
      })
      .sort((a, b) => {
        // 1. เรียงตามห้องเรียนก่อน (Room 1, Room 2...)
        if (a.room !== b.room) return a.room.localeCompare(b.room);
        
        // 2. ถ้าห้องเดียวกัน ให้เรียงตามเลขที่นักเรียน (แปลงเป็นตัวเลขเพื่อความถูกต้อง)
        const numA = parseInt(a.studentNumber) || 0;
        const numB = parseInt(b.studentNumber) || 0;
        return numA - numB;
      });
  }, [submissions, summaryGrade, summaryActivity, summaryRoom]);

  // ✅ ลอจิกการกรองสำหรับหน้ารายการ (List View)
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

  // AI ตรวจงาน
  const handleAutoGrade = async (studentId?: number) => {
    const id = studentId || editingId;
    const student = submissions.find(s => s.rowId === id);
    if (!student) return null;
    
    setIsAutoGrading(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `วิเคราะห์วิดีโอกิจกรรม "${student.activityType}" ของนักเรียน "${student.name}" และประเมินคะแนน 0-5 ใน 4 หัวข้อ ส่งกลับเป็น JSON`,
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
      return null;
    } finally { 
      setIsAutoGrading(false); 
    }
  };

  const handleBatchAI = async () => {
    const pendingList = filteredSubmissions.filter(s => s.review?.status !== 'Graded');
    if (pendingList.length === 0) return alert("ไม่มีงานที่ยังไม่ได้ตรวจในรายการปัจจุบันจ้า ✨");
    if (!confirm(`ต้องการให้ AI ช่วยตรวจงานจำนวน ${pendingList.length} รายการ ใช่หรือไม่?`)) return;
    
    setBatchProcessing(true);
    for (const student of pendingList) {
        const aiResult = await handleAutoGrade(student.rowId);
        if (aiResult) {
            await handleUpdateGrade(student.rowId!, { ...aiResult, status: 'Graded', activityType: student.activityType });
        }
    }
    setBatchProcessing(false);
    onUpdate();
    alert(`ตรวจสำเร็จเรียบร้อยแล้วจ๊ะ! 🎉`);
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
    <div className="bg-white p-4 rounded-2xl border border-indigo-50 mb-3 shadow-sm hover:border-indigo-200 transition-all">
      <div className="flex justify-between items-center mb-3">
        <span className="font-bold text-indigo-700 text-xs font-kids uppercase tracking-wide">{label}</span>
        <span className="text-sm font-black text-indigo-500 bg-indigo-50 px-3 py-0.5 rounded-full">{current}/5</span>
      </div>
      <div className="flex gap-1.5">
        {[0, 1, 2, 3, 4, 5].map(pt => (
          <button 
            key={pt} 
            onClick={() => onSelect(pt)} 
            className={`flex-1 py-2 rounded-xl text-sm font-black transition-all ${current === pt ? 'bg-indigo-500 text-white shadow-lg scale-105' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'}`}
          >
            {pt}
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* 🛠️ ส่วนหัวและการเลือกโหมด (ซ่อนตอนพิมพ์) */}
      <div className="bg-white rounded-[2.5rem] p-6 shadow-xl border-4 border-indigo-50 no-print">
        <div className="flex flex-col lg:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-5">
            <div className="text-5xl bg-indigo-50 p-4 rounded-[2rem] shadow-inner">👩‍🏫</div>
            <div>
              <h2 className="text-2xl font-kids text-slate-700 font-bold">แผงควบคุมคุณครู: <span className="text-indigo-600">{teacherName || 'Krukai'}</span></h2>
              <div className="flex gap-3 mt-3">
                <button 
                    onClick={() => setViewMode('list')} 
                    className={`px-8 py-2.5 rounded-2xl text-xs font-black transition-all border-b-4 ${viewMode === 'list' ? 'bg-indigo-600 text-white border-indigo-800 shadow-md scale-105' : 'bg-indigo-50 text-indigo-400 border-indigo-100 hover:bg-indigo-100'}`}
                >
                    ตรวจงานนักเรียน 📥
                </button>
                <button 
                    onClick={() => setViewMode('summary')} 
                    className={`px-8 py-2.5 rounded-2xl text-xs font-black transition-all border-b-4 ${viewMode === 'summary' ? 'bg-emerald-600 text-white border-emerald-800 shadow-md scale-105' : 'bg-emerald-50 text-emerald-600 border-emerald-100 hover:bg-emerald-100'}`}
                >
                    ตารางสรุปคะแนน & พิมพ์รายงาน 📊
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {viewMode === 'summary' ? (
        /* --- 📊 โหมดตารางสรุปผลคะแนน / พิมพ์รายงาน --- */
        <div className="animate-in fade-in slide-in-from-bottom duration-500">
          <div className="bg-white p-8 rounded-[3rem] shadow-2xl border-4 border-emerald-50 mb-8 no-print">
            <div className="flex items-center gap-3 mb-8 border-l-8 border-emerald-500 pl-6">
                <div>
                    <h3 className="text-2xl font-kids text-slate-700 font-bold">ตัวกรองรายงานสรุปผลคะแนน</h3>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">กำหนดค่าเพื่อแสดงผลในตารางรายงานด้านล่าง</p>
                </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-3">
                <label className="block text-[11px] font-black text-emerald-600 uppercase tracking-tighter ml-2">1. เลือกระดับชั้น</label>
                <select 
                    value={summaryGrade} 
                    onChange={e => setSummaryGrade(e.target.value)} 
                    className="w-full p-4 rounded-2xl bg-slate-50 border-2 border-emerald-100 font-bold outline-none text-emerald-700 cursor-pointer shadow-inner focus:border-emerald-400 transition-all"
                >
                  <option value="Prathom 5">ประถมศึกษาปีที่ 5</option>
                  <option value="Prathom 6">ประถมศึกษาปีที่ 6</option>
                </select>
              </div>
              <div className="space-y-3">
                <label className="block text-[11px] font-black text-emerald-600 uppercase tracking-tighter ml-2">2. เลือกห้องเรียน</label>
                <select 
                    value={summaryRoom} 
                    onChange={e => setSummaryRoom(e.target.value)} 
                    className="w-full p-4 rounded-2xl bg-slate-50 border-2 border-emerald-100 font-bold outline-none text-emerald-700 cursor-pointer shadow-inner focus:border-emerald-400 transition-all"
                >
                  <option value="All">แสดงทุกห้องเรียน (รวมสายชั้น)</option>
                  {[1, 2, 3, 4].map(r => <option key={r} value={`Room ${r}`}>ห้องเรียน {r}</option>)}
                </select>
              </div>
              <div className="space-y-3">
                <label className="block text-[11px] font-black text-emerald-600 uppercase tracking-tighter ml-2">3. เลือกประเภทกิจกรรม</label>
                <select 
                    value={summaryActivity} 
                    onChange={e => setSummaryActivity(e.target.value)} 
                    className="w-full p-4 rounded-2xl bg-white border-2 border-emerald-100 font-bold outline-none text-emerald-700 cursor-pointer shadow-inner focus:border-emerald-400 transition-all"
                >
                  <option value="Sports Day">กิจกรรมงานกีฬาสี 🏃</option>
                  <option value="Children Day">กิจกรรมงานวันเด็ก 🎈</option>
                </select>
              </div>
            </div>

            <div className="mt-10 pt-6 border-t-2 border-slate-50 flex justify-end gap-4">
                <button 
                    onClick={() => window.print()} 
                    className="bg-slate-800 text-white px-10 py-5 rounded-2xl font-black text-sm shadow-xl hover:bg-black transition-all transform hover:scale-105 border-b-8 border-slate-950 active:border-b-0 active:translate-y-2"
                >
                    บันทึกเป็น PDF / สั่งพิมพ์รายงาน 🖨️
                </button>
            </div>
          </div>

          {/* 📄 ส่วนรายงานสำหรับพิมพ์ (A4 Print Area) */}
          <div className="bg-white rounded-[3.5rem] p-6 md:p-16 shadow-inner border border-slate-100 print-table-section">
            {/* Header รายงาน (แสดงเฉพาะตอนพิมพ์) */}
            <div className="hidden print:block text-center border-b-[3pt] border-black pb-10 mb-12">
              <h1 className="text-4xl font-bold font-sarabun text-black mb-3">รายงานสรุปผลคะแนนการประเมินกิจกรรมออนไลน์</h1>
              <h2 className="text-2xl font-bold font-sarabun text-black">กลุ่มสาระการเรียนรู้สุขศึกษาและพลศึกษา ประจำปีการศึกษา 2568</h2>
              <div className="grid grid-cols-2 gap-4 mt-12 text-lg font-bold font-sarabun px-8 py-5 border-2 border-black rounded-3xl text-left">
                <p>ระดับชั้น: {summaryGrade === 'Prathom 5' ? 'ประถมศึกษาปีที่ 5' : 'ประถมศึกษาปีที่ 6'}</p>
                <p>ห้อง: {summaryRoom === 'All' ? 'ทุกห้องเรียน' : summaryRoom.replace('Room ', '')}</p>
                <p>กิจกรรม: {summaryActivity === 'Sports Day' ? 'งานกีฬาสี 🏃' : 'งานวันเด็ก 🎈'}</p>
                <p>ครูผู้สอน: {teacherName || 'คุณครู Krukai'}</p>
              </div>
            </div>

            {/* ส่วนหัวในหน้าจอปกติ */}
            <div className="no-print mb-8 flex items-center justify-between bg-slate-50 px-8 py-4 rounded-3xl">
               <h3 className="text-xl font-kids text-indigo-600 font-bold">พรีวิวตารางรายงานผลคะแนน</h3>
               <span className="text-xs font-black text-slate-400 uppercase">ตรวจพบข้อมูล {sortedSummaryData.length} รายการ</span>
            </div>

            {/* ตารางข้อมูลหลัก */}
            <div className="overflow-hidden rounded-[2rem] border-2 border-slate-200 print:border-black">
              <table className="w-full border-collapse font-sarabun text-base">
                <thead>
                  <tr className="bg-slate-800 text-white print:bg-slate-100 print:text-black">
                    <th className="p-5 text-center font-bold border-r border-slate-700 print:border-black" style={{ width: '80px' }}>ห้อง</th>
                    <th className="p-5 text-center font-bold border-r border-slate-700 print:border-black" style={{ width: '80px' }}>เลขที่</th>
                    <th className="p-5 text-left font-bold border-r border-slate-700 print:border-black">ชื่อ - นามสกุล นักเรียน</th>
                    <th className="p-5 text-center font-bold border-r border-slate-700 print:border-black" style={{ width: '150px' }}>คะแนนเต็ม (20)</th>
                    <th className="p-5 text-center font-bold" style={{ width: '120px' }}>ร้อยละ (%)</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedSummaryData.length === 0 ? (
                    <tr>
                        <td colSpan={5} className="p-32 text-center text-slate-300 italic font-bold text-2xl bg-slate-50/30">
                            ไม่มีข้อมูลนักเรียนที่ตรงตามเงื่อนไขที่เลือกจ้า 🏜️
                        </td>
                    </tr>
                  ) : (
                    sortedSummaryData.map((s, idx) => (
                      <tr key={idx} className={`border-b border-slate-100 print:border-black transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'}`}>
                        <td className="p-5 text-center font-bold text-slate-500 print:text-black border-r border-slate-100 print:border-black">{s.room.replace('Room ', '')}</td>
                        <td className="p-5 text-center font-bold text-slate-800 print:text-black border-r border-slate-100 print:border-black">{s.studentNumber}</td>
                        <td className="p-5 text-left font-bold text-slate-900 print:text-black border-r border-slate-100 print:border-black">{s.name}</td>
                        <td className="p-5 text-center border-r border-slate-100 print:border-black">
                            <span className={`inline-block px-5 py-1.5 rounded-2xl font-black text-xl ${s.review?.totalScore ? 'bg-indigo-50 text-indigo-700 print:bg-transparent print:text-black' : 'text-slate-300'}`}>
                                {s.review?.totalScore ?? '-'}
                            </span>
                        </td>
                        <td className="p-5 text-center">
                             <span className={`inline-block px-5 py-1.5 rounded-2xl font-black text-lg ${s.review?.percentage ? 'bg-emerald-50 text-emerald-600 print:bg-transparent print:text-black' : 'text-slate-300'}`}>
                                {s.review?.percentage ?? '-'}%
                             </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* ส่วนลงนาม (แสดงเฉพาะตอนพิมพ์) */}
            <div className="hidden print:grid grid-cols-2 gap-20 mt-32 pt-20 border-t-2 border-slate-100">
              <div className="text-center">
                <div className="border-b-2 border-black mb-5 h-20 w-80 mx-auto"></div>
                <p className="text-xl font-bold font-sarabun text-black">ลงชื่อ ครูผู้สอน</p>
                <p className="text-lg text-slate-700 mt-2 font-bold font-sarabun">( {teacherName || 'คุณครู Krukai'} )</p>
              </div>
              <div className="text-center">
                <div className="border-b-2 border-black mb-5 h-20 w-80 mx-auto"></div>
                <p className="text-xl font-bold font-sarabun text-black">ลงชื่อ ผู้รับรองข้อมูล (หัวหน้าสายชั้น)</p>
                <p className="text-lg text-slate-700 mt-2 font-bold font-sarabun">( ................................................................ )</p>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* --- 📥 โหมดรายการส่งงาน (List View) --- */
        <div className="space-y-6 animate-in slide-in-from-top duration-500 no-print">
          {/* ส่วนสถิติและเครื่องมือ AI */}
          <div className="bg-white p-8 rounded-[3rem] shadow-xl border-4 border-indigo-50 space-y-8 no-print">
            <div className="flex flex-col md:flex-row justify-between items-center gap-6">
                <div className="space-y-4 flex-1 w-full">
                    <label className="block text-sm font-black text-indigo-400 uppercase tracking-widest ml-3">สถิติจำนวนงานปัจจุบัน 📊</label>
                    <div className="grid grid-cols-4 gap-4">
                        <div className="bg-slate-50 p-5 rounded-3xl text-center border border-slate-100 shadow-sm">
                            <p className="text-[10px] font-black text-slate-400 uppercase mb-1">ทั้งหมด</p>
                            <p className="text-3xl font-black text-slate-700">{statusCounts.All}</p>
                        </div>
                        <div className="bg-indigo-50 p-5 rounded-3xl text-center border border-indigo-100 shadow-sm">
                            <p className="text-[10px] font-black text-indigo-400 uppercase mb-1">รอตรวจ</p>
                            <p className="text-3xl font-black text-indigo-600">{statusCounts.Pending}</p>
                        </div>
                        <div className="bg-green-50 p-5 rounded-3xl text-center border border-green-100 shadow-sm">
                            <p className="text-[10px] font-black text-green-400 uppercase mb-1">ตรวจแล้ว</p>
                            <p className="text-3xl font-black text-green-600">{statusCounts.Graded}</p>
                        </div>
                        <div className="bg-yellow-50 p-5 rounded-3xl text-center border border-yellow-100 shadow-sm">
                            <p className="text-[10px] font-black text-yellow-500 uppercase mb-1">คุณภาพ</p>
                            <p className="text-3xl font-black text-yellow-600">✨</p>
                        </div>
                    </div>
                </div>
                <button 
                    onClick={handleBatchAI}
                    disabled={batchProcessing}
                    className={`px-12 py-10 rounded-[2.5rem] font-black text-sm text-white transition-all shadow-2xl border-b-[10px] active:border-b-0 active:translate-y-2 flex flex-col items-center gap-3 ${batchProcessing ? 'bg-slate-400 border-slate-600' : 'bg-gradient-to-br from-yellow-400 to-orange-500 border-orange-700 animate-pulse hover:animate-none'}`}
                >
                    {batchProcessing ? (
                        <>⌛ กำลังตรวจกลุ่ม...</>
                    ) : (
                        <><span className="text-3xl">🚀</span> AI ตรวจงานที่ค้างทั้งหมด</>
                    )}
                </button>
            </div>

            {/* ส่วนการคัดกรองรายการ (Filter Controls) */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end pt-10 border-t-2 border-slate-50">
              <div className="md:col-span-1">
                 <label className="block text-[10px] font-black text-slate-400 uppercase mb-3 ml-3 tracking-widest">🔍 ค้นหา</label>
                 <input 
                    type="text" 
                    placeholder="ชื่อหรือเลขที่..." 
                    value={filterText} 
                    onChange={e => setFilterText(e.target.value)} 
                    className="w-full p-4 rounded-2xl bg-slate-50 border-2 border-slate-100 outline-none text-sm font-bold text-indigo-600 shadow-inner focus:border-indigo-300 transition-all"
                 />
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-3 ml-3 tracking-widest">กิจกรรม</label>
                <select 
                    value={filterActivity} 
                    onChange={e => setFilterActivity(e.target.value)} 
                    className="w-full p-4 rounded-2xl bg-white border-2 border-slate-100 text-xs font-bold outline-none cursor-pointer hover:border-indigo-200 transition-all shadow-sm"
                >
                  <option value="All">ทุกกิจกรรม</option>
                  <option value="Sports Day">งานกีฬาสี 🏃</option>
                  <option value="Children Day">งานวันเด็ก 🎈</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-3 ml-3 tracking-widest">ระดับชั้น</label>
                <select 
                    value={filterGrade} 
                    onChange={e => setFilterGrade(e.target.value)} 
                    className="w-full p-4 rounded-2xl bg-white border-2 border-slate-100 text-xs font-bold outline-none cursor-pointer hover:border-indigo-200 transition-all shadow-sm"
                >
                  <option value="All">ทุกระดับชั้น</option>
                  <option value="Prathom 5">ป.5</option>
                  <option value="Prathom 6">ป.6</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-3 ml-3 tracking-widest">ห้องเรียน</label>
                <select 
                    value={filterRoom} 
                    onChange={e => setFilterRoom(e.target.value)} 
                    className="w-full p-4 rounded-2xl bg-white border-2 border-slate-100 text-xs font-bold outline-none cursor-pointer hover:border-indigo-200 transition-all shadow-sm"
                >
                  <option value="All">ทุกห้องเรียน</option>
                  {[1, 2, 3, 4].map(r => <option key={r} value={`Room ${r}`}>ห้อง {r}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-3 ml-3 tracking-widest">สถานะ</label>
                <select 
                    value={filterStatus} 
                    onChange={e => setFilterStatus(e.target.value as any)} 
                    className="w-full p-4 rounded-2xl bg-white border-2 border-slate-100 text-xs font-bold outline-none cursor-pointer hover:border-indigo-200 transition-all shadow-sm"
                >
                  <option value="All">งานทั้งหมด</option>
                  <option value="Pending">⌛ รอตรวจ</option>
                  <option value="Graded">✅ ตรวจแล้ว</option>
                </select>
              </div>
            </div>
          </div>

          {/* รายการการ์ดนักเรียน */}
          <div className="space-y-4 no-print">
            {filteredSubmissions.length === 0 ? (
              <div className="text-center p-32 bg-white/40 rounded-[4rem] border-4 border-dashed border-slate-200 no-print">
                <p className="text-7xl mb-6 grayscale opacity-20">🏜️</p>
                <p className="text-xl text-gray-400 font-bold italic">ไม่พบรายการงานที่หนูๆ ส่งมาตามเงื่อนไขจ้า...</p>
              </div>
            ) : (
              filteredSubmissions.map((sub) => (
                <div key={sub.rowId} className={`group p-8 rounded-[3.5rem] border-4 transition-all bg-white hover:scale-[1.01] shadow-lg hover:shadow-2xl no-print ${sub.review?.status === 'Graded' ? 'border-green-100' : 'border-indigo-50'}`}>
                  <div className="flex flex-col md:flex-row justify-between items-center gap-8">
                    <div className="flex items-center gap-8">
                      <div className={`text-5xl p-6 rounded-[2.5rem] shadow-inner ${sub.activityType === 'Sports Day' ? 'bg-orange-50 text-orange-400' : 'bg-cyan-50 text-cyan-400'}`}>
                        {sub.activityType === 'Sports Day' ? '🏃' : '🎈'}
                      </div>
                      <div>
                        <h4 className="text-2xl font-bold text-slate-800 flex items-center gap-3">
                            {sub.name} 
                            <span className="text-indigo-500 text-sm font-kids bg-indigo-50 px-4 py-1 rounded-full border border-indigo-100 shadow-sm">เลขที่ {sub.studentNumber}</span>
                        </h4>
                        <div className="flex gap-3 mt-3">
                            <span className="bg-slate-100 text-slate-500 px-5 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest">{sub.grade === 'Prathom 5' ? 'ป.5' : 'ป.6'} | {sub.room.replace('Room ', 'ห้อง ')}</span>
                            <span className={`px-5 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest ${sub.activityType === 'Sports Day' ? 'bg-orange-100 text-orange-600' : 'bg-cyan-100 text-cyan-600'}`}>
                                {sub.activityType === 'Sports Day' ? 'งานกีฬาสี' : 'งานวันเด็ก'}
                            </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-4">
                      <a 
                        href={sub.fileUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="bg-slate-800 text-white px-10 py-4 rounded-2xl font-black text-xs hover:bg-black transition-all border-b-8 border-slate-950 flex items-center gap-2"
                      >
                        <span className="text-xl">📺</span> เปิดวิดีโอ
                      </a>
                      <button 
                        onClick={() => { 
                            setEditingId(sub.rowId!); 
                            setRubric(sub.review || { contentAccuracy: 0, participation: 0, presentation: 0, discipline: 0, totalScore: 0, percentage: 0, comment: '', status: 'Pending' }); 
                        }} 
                        className={`px-10 py-4 rounded-2xl font-black text-xs text-white transition-all border-b-8 active:border-b-0 active:translate-y-2 ${sub.review?.status === 'Graded' ? 'bg-green-500 border-green-700 shadow-lg' : 'bg-indigo-500 border-indigo-700 shadow-xl'}`}
                      >
                        {sub.review?.status === 'Graded' ? `ตรวจแล้ว (${sub.review.totalScore}/20)` : 'ให้คะแนนนักเรียน ✍️'}
                      </button>
                    </div>
                  </div>

                  {/* แบบฟอร์มการให้คะแนนแบบ Pop-out */}
                  {editingId === sub.rowId && (
                    <div className="mt-10 p-10 bg-indigo-50/50 rounded-[4rem] border-4 border-indigo-100 animate-in zoom-in duration-300 shadow-inner">
                      <div className="flex flex-col md:flex-row justify-between items-center mb-10 gap-4">
                        <div className="flex items-center gap-3">
                            <span className="text-3xl">📝</span>
                            <h5 className="font-kids text-indigo-700 text-2xl font-bold uppercase tracking-tight">รูบริคการประเมินกิจกรรม</h5>
                        </div>
                        <button 
                            onClick={() => handleAutoGrade()} 
                            disabled={isAutoGrading} 
                            className="bg-yellow-400 text-indigo-900 px-10 py-5 rounded-[2rem] font-black text-sm shadow-xl hover:bg-yellow-300 hover:scale-[1.05] transition-all border-b-8 border-yellow-600 active:border-b-0 active:translate-y-1"
                        >
                          {isAutoGrading ? '✨ AI กำลังวิเคราะห์งาน...' : '✨ ให้ AI ช่วยแนะนำคะแนน'}
                        </button>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <PointSelector label="ความถูกต้องของเนื้อหา" current={rubric.contentAccuracy} onSelect={v => updateRubricItem('contentAccuracy', v)}/>
                        <PointSelector label="ความตั้งใจและการมีส่วนร่วม" current={rubric.participation} onSelect={v => updateRubricItem('participation', v)}/>
                        <PointSelector label="เทคนิคการนำเสนอวิดีโอ" current={rubric.presentation} onSelect={v => updateRubricItem('presentation', v)}/>
                        <PointSelector label="วินัยและการส่งงานตามเวลา" current={rubric.discipline} onSelect={v => updateRubricItem('discipline', v)}/>
                      </div>

                      <div className="mt-10">
                        <label className="block text-[11px] font-black text-indigo-400 uppercase tracking-widest mb-4 ml-6">ความเห็นและคำแนะนำจากคุณครู 💬</label>
                        <textarea 
                            value={rubric.comment} 
                            onChange={e => setRubric({...rubric, comment: e.target.value})} 
                            className="w-full p-10 rounded-[3.5rem] h-40 border-4 border-indigo-50 outline-none text-lg bg-white focus:border-indigo-400 transition-all shadow-inner font-bold font-sarabun" 
                            placeholder="เขียนข้อความให้กำลังใจหนูๆ ที่นี่เลยจ๊ะ..."
                        />
                      </div>

                      <div className="flex gap-5 mt-12">
                        <button 
                            onClick={handleSave} 
                            disabled={saving} 
                            className="flex-[3] bg-indigo-600 text-white py-8 rounded-[3rem] font-black text-2xl shadow-2xl hover:bg-indigo-700 transition-all border-b-[12px] border-indigo-900 active:border-b-0 active:translate-y-2 flex items-center justify-center gap-4"
                        >
                          <span className="text-4xl">✅</span> {saving ? 'กำลังบันทึก...' : 'ยืนยันและบันทึกคะแนน'}
                        </button>
                        <button 
                            onClick={() => setEditingId(null)} 
                            className="flex-1 px-12 bg-white text-slate-400 rounded-[3rem] border-4 border-slate-100 font-black hover:bg-slate-50 transition-all"
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
