
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
  
  // Filtering States
  const [filterText, setFilterText] = useState('');
  const [filterGrade, setFilterGrade] = useState('All');
  const [filterRoom, setFilterRoom] = useState('All');
  const [filterActivity, setFilterActivity] = useState('All');
  const [filterStatus, setFilterStatus] = useState<'All' | 'Pending' | 'Graded'>('All');

  // Summary View States
  const [summaryGrade, setSummaryGrade] = useState('Prathom 5');
  const [summaryActivity, setSummaryActivity] = useState('Sports Day');

  const [rubric, setRubric] = useState<RubricReview>({
    contentAccuracy: 0, participation: 0, presentation: 0, discipline: 0,
    totalScore: 0, percentage: 0, comment: '', status: 'Pending'
  });

  const [saving, setSaving] = useState(false);
  const [isAutoGrading, setIsAutoGrading] = useState(false);

  // Update rubric items and calculate totals
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

  // Filtering for List View
  const filteredSubmissions = useMemo(() => {
    return submissions.filter(s => {
      const matchesText = s.name.toLowerCase().includes(filterText.toLowerCase()) || 
                         (s.studentNumber && s.studentNumber.toString().includes(filterText));
      const matchesGrade = filterGrade === 'All' || s.grade === filterGrade;
      const matchesRoom = filterRoom === 'All' || s.room === filterRoom;
      const matchesActivity = filterActivity === 'All' || s.activityType === filterActivity;
      const matchesStatus = filterStatus === 'All' || 
                           (filterStatus === 'Graded' && s.review?.status === 'Graded') || 
                           (filterStatus === 'Pending' && s.review?.status !== 'Graded');
      return matchesText && matchesGrade && matchesRoom && matchesActivity && matchesStatus;
    });
  }, [submissions, filterText, filterGrade, filterRoom, filterActivity, filterStatus]);

  // Filtering for Summary/Print View
  const sortedSummaryData = useMemo(() => {
    return submissions
      .filter(s => s.grade === summaryGrade && s.activityType === summaryActivity)
      .sort((a, b) => {
        if (a.room !== b.room) return a.room.localeCompare(b.room);
        return parseInt(a.studentNumber || '0') - parseInt(b.studentNumber || '0');
      });
  }, [submissions, summaryGrade, summaryActivity]);

  const handleAutoGrade = async () => {
    const student = submissions.find(s => s.rowId === editingId);
    if (!student) return;
    setIsAutoGrading(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `ประเมินผลกิจกรรม "${student.activityType}" ของนักเรียน "${student.name}" (ปะเมิน 0-5 คะแนนในหัวข้อ: Content, Participation, Presentation, Discipline) และสรุปคำชมสั้นๆ เป็นภาษาไทย ส่งกลับในรูปแบบ JSON`,
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
      setRubric(prev => ({ 
        ...prev, ...res, 
        totalScore: total, 
        percentage: Math.round((total / 20) * 100),
        comment: `🤖 AI ประเมิน: ${res.comment || ''}`
      }));
    } catch (e) { 
      console.error(e); 
      alert("AI ไม่สามารถเชื่อมต่อได้ในขณะนี้จ้า"); 
    } finally { 
      setIsAutoGrading(false); 
    }
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
      {/* Teacher Navigation & Header */}
      <div className="bg-white rounded-[2.5rem] p-6 shadow-xl border-4 border-indigo-50 no-print">
        <div className="flex flex-col lg:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-4">
            <div className="text-4xl bg-indigo-100 p-3 rounded-2xl transform hover:rotate-12 transition-transform">👩‍🏫</div>
            <div>
              <h2 className="text-xl font-kids text-indigo-600">จัดการข้อมูลโดยคุณครู {teacherName || 'Krukai'}</h2>
              <div className="flex gap-2 mt-2">
                <button 
                    onClick={() => setViewMode('list')} 
                    className={`px-6 py-2 rounded-full text-xs font-bold transition-all border-b-4 ${viewMode === 'list' ? 'bg-indigo-600 text-white border-indigo-800 shadow-md' : 'bg-indigo-50 text-indigo-400 border-indigo-100 hover:bg-indigo-100'}`}
                >
                    รายการส่งงาน 📥
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
        /* SUMMARY VIEW / PRINT LAYOUT */
        <div className="bg-white/80 backdrop-blur-md p-6 md:p-10 rounded-[3rem] shadow-xl border-4 border-white animate-in fade-in duration-500">
          {/* Controls - Hidden in Print */}
          <div className="flex flex-col md:flex-row justify-between items-end gap-6 mb-10 no-print">
            <div className="flex gap-4 flex-wrap w-full md:w-auto">
              <div className="space-y-2 flex-1 md:flex-none">
                <label className="block text-[11px] font-black text-indigo-400 uppercase tracking-widest ml-3">เลือกระดับชั้น</label>
                <select 
                    value={summaryGrade} 
                    onChange={e => setSummaryGrade(e.target.value)} 
                    className="w-full p-4 pr-10 rounded-2xl bg-white border-2 border-indigo-100 font-bold outline-none text-indigo-600 shadow-sm appearance-none cursor-pointer focus:border-indigo-400 transition-all"
                >
                  <option value="Prathom 5">ประถมศึกษาปีที่ 5</option>
                  <option value="Prathom 6">ประถมศึกษาปีที่ 6</option>
                </select>
              </div>
              <div className="space-y-2 flex-1 md:flex-none">
                <label className="block text-[11px] font-black text-indigo-400 uppercase tracking-widest ml-3">เลือกกิจกรรม</label>
                <select 
                    value={summaryActivity} 
                    onChange={e => setSummaryActivity(e.target.value)} 
                    className="w-full p-4 pr-10 rounded-2xl bg-white border-2 border-indigo-100 font-bold outline-none text-indigo-600 shadow-sm appearance-none cursor-pointer focus:border-indigo-400 transition-all"
                >
                  <option value="Sports Day">งานกีฬาสี 🏃</option>
                  <option value="Children Day">งานวันเด็ก 🎈</option>
                </select>
              </div>
            </div>
            <button 
                onClick={() => window.print()} 
                className="w-full md:w-auto bg-slate-800 text-white px-10 py-4 rounded-2xl font-bold shadow-2xl hover:bg-black hover:scale-105 transition-all border-b-8 border-slate-900 active:border-b-0 active:translate-y-2"
            >
                พิมพ์รายงานคะแนน (PDF) 📄
            </button>
          </div>

          <div className="print-area bg-white rounded-[2rem] p-4 md:p-8 border border-slate-100 shadow-inner">
            {/* Header for PDF only */}
            <div className="hidden print:block mb-10 text-center border-b-4 border-slate-800 pb-8">
              <h1 className="text-3xl font-bold text-slate-900 mb-2 Sarabun tracking-tight">แบบสรุปผลคะแนนการส่งงานกิจกรรม</h1>
              <h2 className="text-xl font-bold text-slate-700 Sarabun">วิชาสุขศึกษาและพลศึกษา ประจำปีการศึกษา 2568</h2>
              <div className="flex justify-between items-center text-sm mt-8 font-bold text-slate-600 px-4">
                <p className="bg-slate-100 px-4 py-1 rounded-full">ชั้น: {summaryGrade === 'Prathom 5' ? 'ประถมศึกษาปีที่ 5' : 'ประถมศึกษาปีที่ 6'}</p>
                <p className="bg-slate-100 px-4 py-1 rounded-full">กิจกรรม: {summaryActivity === 'Sports Day' ? 'กีฬาสี 🏃' : 'วันเด็ก 🎈'}</p>
                <p className="bg-slate-100 px-4 py-1 rounded-full">คุณครูผู้สอน: {teacherName || 'Krukai'}</p>
              </div>
            </div>

            {/* Visual Table Header for Screen */}
            <div className="no-print mb-6 flex items-center gap-3">
               <div className="w-2 h-8 bg-emerald-500 rounded-full"></div>
               <h3 className="text-xl font-kids text-slate-700 font-bold">ตารางสรุปผลคะแนนแยกตามห้อง</h3>
            </div>

            <div className="overflow-x-auto rounded-[1.5rem] border-2 border-slate-50 shadow-sm overflow-hidden">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-indigo-600 text-white print:bg-slate-100 print:text-black">
                    <th className="p-4 border-b border-indigo-700 print:border-black text-center font-kids text-sm font-bold tracking-wider">ห้อง</th>
                    <th className="p-4 border-b border-indigo-700 print:border-black text-center font-kids text-sm font-bold tracking-wider">เลขที่</th>
                    <th className="p-4 border-b border-indigo-700 print:border-black text-left font-kids text-sm font-bold tracking-wider">ชื่อ-นามสกุล</th>
                    <th className="p-4 border-b border-indigo-700 print:border-black text-center font-kids text-sm font-bold tracking-wider">คะแนนรวม (20)</th>
                    <th className="p-4 border-b border-indigo-700 print:border-black text-center font-kids text-sm font-bold tracking-wider">ร้อยละ (%)</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedSummaryData.length === 0 ? (
                    <tr>
                        <td colSpan={5} className="p-20 text-center text-slate-300 italic font-bold text-xl">ยังไม่พบข้อมูลในเงื่อนไขที่เลือกจ้า 🏜️</td>
                    </tr>
                  ) : (
                    sortedSummaryData.map((s, idx) => (
                      <tr key={idx} className={`hover:bg-indigo-50/50 transition-colors border-b border-slate-100 print:border-black ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}`}>
                        <td className="p-4 border-r border-slate-50 print:border-black text-center font-bold text-slate-500 print:text-black font-quicksand">{s.room.replace('Room ', '')}</td>
                        <td className="p-4 border-r border-slate-50 print:border-black text-center font-bold text-slate-700 print:text-black font-quicksand">{s.studentNumber}</td>
                        <td className="p-4 border-r border-slate-50 print:border-black text-left font-bold text-slate-800 print:text-black Sarabun">{s.name}</td>
                        <td className="p-4 border-r border-slate-50 print:border-black text-center">
                            <span className={`inline-block px-3 py-1 rounded-full font-black text-indigo-700 print:text-black ${s.review?.totalScore ? 'bg-indigo-50' : ''} font-quicksand`}>
                                {s.review?.totalScore ?? '-'}
                            </span>
                        </td>
                        <td className="p-4 text-center">
                             <span className={`inline-block px-3 py-1 rounded-full font-bold text-emerald-600 print:text-black ${s.review?.percentage ? 'bg-emerald-50' : ''} font-quicksand`}>
                                {s.review?.percentage ?? '-'}%
                             </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Print Footer with Signatures */}
            <div className="hidden print:flex justify-around items-start mt-24 pt-10">
              <div className="text-center w-72">
                <div className="border-b-2 border-slate-300 mb-2 h-12"></div>
                <p className="text-sm font-bold Sarabun">ลงชื่อคุณครูผู้สอน</p>
                <p className="text-xs text-slate-500 mt-2 Sarabun font-bold">( {teacherName || 'คุณครู Krukai'} )</p>
              </div>
              <div className="text-center w-72">
                <div className="border-b-2 border-slate-300 mb-2 h-12"></div>
                <p className="text-sm font-bold Sarabun">ลงชื่อผู้ตรวจสอบ</p>
                <p className="text-xs text-slate-500 mt-2 Sarabun font-bold">( .................................................... )</p>
              </div>
            </div>
            
            <div className="hidden print:block mt-24 text-[10px] text-right text-slate-400 Sarabun italic font-bold">
                พิมพ์โดยระบบส่งงานวิชาสุขศึกษาและพลศึกษาออนไลน์ เมื่อวันที่ {new Date().toLocaleDateString('th-TH')} เวลา {new Date().toLocaleTimeString('th-TH')}
            </div>
          </div>
        </div>
      ) : (
        /* LIST VIEW / GRADING AREA */
        <div className="grid gap-6">
          {/* Main Activity Selectors (Restore High Visibility Style) */}
          <div className="bg-white p-8 rounded-[3rem] shadow-sm border-2 border-indigo-50 space-y-8">
            <div className="space-y-4">
              <label className="block text-sm font-black text-indigo-400 uppercase tracking-widest ml-3">เลือกดูงานแยกตามกิจกรรม ✨</label>
              <div className="grid grid-cols-3 gap-4">
                <button 
                  onClick={() => setFilterActivity('All')}
                  className={`py-4 rounded-3xl font-bold transition-all border-b-8 flex items-center justify-center gap-3 ${filterActivity === 'All' ? 'bg-indigo-600 text-white border-indigo-800 shadow-xl scale-105' : 'bg-slate-50 text-slate-400 border-slate-200 hover:bg-slate-100'}`}
                >
                  <span className="text-2xl">🌍</span> ทั้งหมด
                </button>
                <button 
                  onClick={() => setFilterActivity('Sports Day')}
                  className={`py-4 rounded-3xl font-bold transition-all border-b-8 flex items-center justify-center gap-3 ${filterActivity === 'Sports Day' ? 'bg-orange-500 text-white border-orange-700 shadow-xl scale-105' : 'bg-slate-50 text-slate-400 border-slate-200 hover:bg-slate-100'}`}
                >
                  <span className="text-2xl">🏃</span> กีฬาสี
                </button>
                <button 
                  onClick={() => setFilterActivity('Children Day')}
                  className={`py-4 rounded-3xl font-bold transition-all border-b-8 flex items-center justify-center gap-3 ${filterActivity === 'Children Day' ? 'bg-cyan-500 text-white border-cyan-700 shadow-xl scale-105' : 'bg-slate-50 text-slate-400 border-slate-200 hover:bg-slate-100'}`}
                >
                  <span className="text-2xl">🎈</span> วันเด็ก
                </button>
              </div>
            </div>

            {/* Detailed Filters Area */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-end pt-8 border-t-2 border-slate-50">
              <div className="md:col-span-1">
                 <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-3">ค้นหา (ชื่อ / เลขที่)</label>
                 <input 
                    type="text" 
                    placeholder="ค้นหาที่นี่จ๊ะ..." 
                    value={filterText} 
                    onChange={e => setFilterText(e.target.value)} 
                    className="w-full p-4 rounded-2xl bg-slate-50 border-2 border-slate-100 outline-none text-sm focus:border-indigo-400 transition-all shadow-inner font-bold"
                 />
              </div>
              <div>
                <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-3">ระดับชั้น</label>
                <select 
                    value={filterGrade} 
                    onChange={e => setFilterGrade(e.target.value)} 
                    className="w-full p-4 rounded-2xl bg-white border-2 border-slate-100 text-xs font-bold outline-none cursor-pointer hover:border-indigo-200 appearance-none bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20width%3D%2220%22%20height%3D%2220%22%20viewBox%3D%220%200%2020%2020%22%20fill%3D%22none%22%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%3E%3Cpath%20d%3D%22M5%207L10%2012L15%207%22%20stroke%3D%22%236366F1%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22/%3E%3C/svg%3E')] bg-[length:1.25rem] bg-[right_1rem_center] bg-no-repeat pr-10"
                >
                  <option value="All">ทุกระดับชั้น</option>
                  <option value="Prathom 5">ป.5</option>
                  <option value="Prathom 6">ป.6</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-3">ห้องเรียน</label>
                <select 
                    value={filterRoom} 
                    onChange={e => setFilterRoom(e.target.value)} 
                    className="w-full p-4 rounded-2xl bg-white border-2 border-slate-100 text-xs font-bold outline-none cursor-pointer hover:border-indigo-200 appearance-none bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20width%3D%2220%22%20height%3D%2220%22%20viewBox%3D%220%200%2020%2020%22%20fill%3D%22none%22%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%3E%3Cpath%20d%3D%22M5%207L10%2012L15%207%22%20stroke%3D%22%236366F1%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22/%3E%3C/svg%3E')] bg-[length:1.25rem] bg-[right_1rem_center] bg-no-repeat pr-10"
                >
                  <option value="All">ทุกห้องเรียน</option>
                  {[1, 2, 3, 4].map(r => <option key={r} value={`Room ${r}`}>ห้อง {r}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-3">สถานะตรวจงาน</label>
                <select 
                    value={filterStatus} 
                    onChange={e => setFilterStatus(e.target.value as any)} 
                    className="w-full p-4 rounded-2xl bg-white border-2 border-slate-100 text-xs font-bold outline-none cursor-pointer hover:border-indigo-200 appearance-none bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20width%3D%2220%22%20height%3D%2220%22%20viewBox%3D%220%200%2020%2020%22%20fill%3D%22none%22%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%3E%3Cpath%20d%3D%22M5%207L10%2012L15%207%22%20stroke%3D%22%236366F1%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22/%3E%3C/svg%3E')] bg-[length:1.25rem] bg-[right_1rem_center] bg-no-repeat pr-10"
                >
                  <option value="All">ดูทั้งหมด</option>
                  <option value="Pending">⌛ ยังไม่ตรวจ</option>
                  <option value="Graded">✅ ตรวจแล้ว</option>
                </select>
              </div>
            </div>
          </div>

          {/* Submissions List Content */}
          <div className="grid gap-6">
            {filteredSubmissions.length === 0 ? (
              <div className="text-center p-24 bg-white/40 rounded-[4rem] border-4 border-dashed border-slate-100">
                <p className="text-7xl mb-6 grayscale opacity-20">🏜️</p>
                <p className="text-slate-400 font-bold italic text-xl font-kids">ไม่พบข้อมูลงานที่เลือกจ้า คุณครูลองปรับเงื่อนไขดูนะ</p>
              </div>
            ) : (
              filteredSubmissions.map((sub) => (
                <div key={sub.rowId} className={`group p-6 rounded-[3rem] border-4 transition-all bg-white hover:scale-[1.01] ${sub.review?.status === 'Graded' ? 'border-green-100 shadow-sm' : 'border-indigo-50 shadow-xl'}`}>
                  <div className="flex flex-col md:flex-row justify-between items-center gap-6">
                    <div className="flex items-center gap-6">
                      <div className={`text-4xl p-4 rounded-3xl transition-transform group-hover:rotate-12 ${sub.activityType === 'Sports Day' ? 'bg-orange-50' : 'bg-cyan-50'}`}>
                        {sub.activityType === 'Sports Day' ? '🏃' : '🎈'}
                      </div>
                      <div>
                        <h4 className="text-lg font-bold text-slate-800">{sub.name} <span className="text-slate-400 text-sm ml-2 font-kids">เลขที่ {sub.studentNumber}</span></h4>
                        <div className="flex gap-2 mt-1">
                            <span className="bg-indigo-50 text-indigo-500 px-3 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest">{sub.grade === 'Prathom 5' ? 'ป.5' : 'ป.6'} | {sub.room.replace('Room ', 'ห้อง ')}</span>
                            <span className={`px-3 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest ${sub.activityType === 'Sports Day' ? 'bg-orange-100 text-orange-600' : 'bg-cyan-100 text-cyan-600'}`}>
                                {sub.activityType === 'Sports Day' ? 'กีฬาสี' : 'วันเด็ก'}
                            </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <a 
                        href={sub.fileUrl} 
                        target="_blank" 
                        className="bg-slate-100 text-slate-600 px-6 py-3 rounded-2xl font-bold text-xs hover:bg-slate-200 transition-all border-b-4 border-slate-200"
                      >
                        ชมวิดีโอ 📺
                      </a>
                      <button 
                        onClick={() => { 
                            setEditingId(sub.rowId!); 
                            setRubric(sub.review || { contentAccuracy: 0, participation: 0, presentation: 0, discipline: 0, totalScore: 0, percentage: 0, comment: '', status: 'Pending' }); 
                        }} 
                        className={`px-6 py-3 rounded-2xl font-bold text-xs text-white transition-all border-b-8 active:border-b-0 active:translate-y-2 ${sub.review?.status === 'Graded' ? 'bg-green-500 border-green-700' : 'bg-orange-500 border-orange-700 shadow-xl'}`}
                      >
                        {sub.review?.status === 'Graded' ? `ตรวจแล้ว (${sub.review.totalScore}/20)` : 'ให้คะแนนเลย ✍️'}
                      </button>
                    </div>
                  </div>

                  {/* Grading Rubric Drawer */}
                  {editingId === sub.rowId && (
                    <div className="mt-8 p-8 bg-indigo-50/40 rounded-[3rem] border-4 border-indigo-100 animate-in slide-in-from-top duration-500">
                      <div className="flex justify-between items-center mb-8">
                        <h5 className="font-kids text-indigo-700 text-base">เกณฑ์การประเมินวิชาสุขศึกษาและพลศึกษา</h5>
                        <button 
                            onClick={handleAutoGrade} 
                            disabled={isAutoGrading} 
                            className="bg-yellow-400 text-indigo-900 px-6 py-3 rounded-2xl font-black text-[11px] shadow-xl hover:bg-yellow-300 hover:scale-105 transition-all active:scale-95 border-b-4 border-yellow-600"
                        >
                          {isAutoGrading ? '✨ AI กำลังวิเคราะห์ผลงาน...' : '✨ ให้ AI ช่วยประเมินเบื้องต้น'}
                        </button>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <PointSelector label="ความถูกต้องของท่าทาง (Content)" current={rubric.contentAccuracy} onSelect={v => updateRubricItem('contentAccuracy', v)}/>
                        <PointSelector label="ความพยายามและตั้งใจ (Participation)" current={rubric.participation} onSelect={v => updateRubricItem('participation', v)}/>
                        <PointSelector label="การสื่อสารและนำเสนอ (Presentation)" current={rubric.presentation} onSelect={v => updateRubricItem('presentation', v)}/>
                        <PointSelector label="วินัยและการแต่งกาย (Discipline)" current={rubric.discipline} onSelect={v => updateRubricItem('discipline', v)}/>
                      </div>

                      <div className="mt-6">
                        <label className="block text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-2 ml-4">คำแนะนำและคำชมจากคุณครู</label>
                        <textarea 
                            value={rubric.comment} 
                            onChange={e => setRubric({...rubric, comment: e.target.value})} 
                            className="w-full p-5 rounded-[2rem] h-28 border-2 border-indigo-100 outline-none text-sm bg-white focus:border-indigo-500 transition-all shadow-inner font-bold" 
                            placeholder="เขียนความประทับใจให้หนูๆ หน่อยนะจ๊ะ..."
                        />
                      </div>

                      <div className="flex gap-4 mt-8">
                        <button 
                            onClick={handleSave} 
                            disabled={saving} 
                            className="flex-1 bg-indigo-600 text-white py-5 rounded-[2rem] font-bold text-lg shadow-2xl hover:bg-indigo-700 transition-all border-b-8 border-indigo-900 active:border-b-0 active:translate-y-2"
                        >
                          {saving ? 'กำลังบันทึกข้อมูล...' : 'บันทึกคะแนนและส่งคำชม ✅'}
                        </button>
                        <button 
                            onClick={() => setEditingId(null)} 
                            className="px-10 bg-white text-slate-400 rounded-[2rem] border-2 border-slate-100 font-bold hover:bg-slate-50 transition-all"
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
