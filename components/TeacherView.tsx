
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
  
  // สถานะสำหรับการกรองในหน้ารายการ (List View)
  const [filterText, setFilterText] = useState('');
  const [filterGrade, setFilterGrade] = useState('All');
  const [filterRoom, setFilterRoom] = useState('All');
  const [filterActivity, setFilterActivity] = useState('All');
  const [filterStatus, setFilterStatus] = useState<'All' | 'Pending' | 'Graded'>('All');

  // สถานะสำหรับการกรองในหน้าสรุปคะแนน (Summary View)
  const [summaryGrade, setSummaryGrade] = useState('Prathom 5');
  const [summaryRoom, setSummaryRoom] = useState('All');
  const [summaryActivity, setSummaryActivity] = useState('Sports Day');

  const [rubric, setRubric] = useState<RubricReview>({
    contentAccuracy: 0, participation: 0, presentation: 0, discipline: 0,
    totalScore: 0, percentage: 0, comment: '', status: 'Pending'
  });

  const [saving, setSaving] = useState(false);
  const [isAutoGrading, setIsAutoGrading] = useState(false);

  // คำนวณจำนวนงานค้างตรวจและตรวจแล้วสำหรับปุ่ม Filter ด่วน
  const statusCounts = useMemo(() => {
    const counts = { All: 0, Pending: 0, Graded: 0 };
    submissions.forEach(s => {
      counts.All++;
      if (s.review?.status === 'Graded') counts.Graded++;
      else counts.Pending++;
    });
    return counts;
  }, [submissions]);

  // ฟังก์ชันอัปเดตคะแนนและคำนวณผลรวม
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

  // กรองข้อมูลสำหรับหน้ารายการส่งงาน (List View)
  const filteredSubmissions = useMemo(() => {
    return submissions.filter(s => {
      const searchStr = filterText.toLowerCase().trim();
      const matchesText = !searchStr || 
                         (s.name && s.name.toLowerCase().includes(searchStr)) || 
                         (s.studentNumber && s.studentNumber.toString().includes(searchStr));
      
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

  // กรองและเรียงลำดับข้อมูลสำหรับหน้าสรุปคะแนน (Summary View / PDF)
  const sortedSummaryData = useMemo(() => {
    return submissions
      .filter(s => {
        const matchesGrade = s.grade === summaryGrade;
        const matchesActivity = s.activityType === summaryActivity;
        const matchesRoom = summaryRoom === 'All' || s.room === summaryRoom;
        return matchesGrade && matchesActivity && matchesRoom;
      })
      .sort((a, b) => {
        if (a.room !== b.room) return a.room.localeCompare(b.room);
        return parseInt(a.studentNumber || '0') - parseInt(b.studentNumber || '0');
      });
  }, [submissions, summaryGrade, summaryActivity, summaryRoom]);

  // ระบบ AI ช่วยตรวจงาน
  const handleAutoGrade = async () => {
    const student = submissions.find(s => s.rowId === editingId);
    if (!student) return;
    setIsAutoGrading(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `ประเมินผลกิจกรรม "${student.activityType}" ของนักเรียน "${student.name}" (ประเมิน 0-5 คะแนนในหัวข้อ: Content Accuracy, Participation, Presentation, Discipline) และสรุปคำชมสั้นๆ เป็นภาษาไทย ส่งกลับในรูปแบบ JSON`,
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
        comment: `🤖 AI ประเมินเบื้องต้น: ${res.comment || ''}`
      }));
    } catch (e) { 
      console.error(e); 
      alert("ไม่สามารถเชื่อมต่อ AI ได้ในขณะนี้"); 
    } finally { 
      setIsAutoGrading(false); 
    }
  };

  // ฟังก์ชันบันทึกคะแนน
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

  // คอมโพเนนต์เลือกคะแนนแบบ UI
  const PointSelector = ({ label, current, onSelect }: { label: string, current: number, onSelect: (v: number) => void }) => (
    <div className="bg-white p-4 rounded-2xl border border-indigo-50 mb-3 shadow-sm hover:border-indigo-100 transition-all">
      <div className="flex justify-between items-center mb-3">
        <span className="font-bold text-indigo-700 text-xs font-kids uppercase tracking-wider">{label}</span>
        <span className="text-sm font-black text-indigo-500 bg-indigo-50 px-3 py-0.5 rounded-full">{current}/5</span>
      </div>
      <div className="flex gap-1.5">
        {[0, 1, 2, 3, 4, 5].map(pt => (
          <button 
            key={pt} 
            onClick={() => onSelect(pt)} 
            className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${current === pt ? 'bg-indigo-600 text-white shadow-lg ring-2 ring-indigo-200' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'}`}
          >
            {pt}
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* ส่วนหัวสำหรับครู (ซ่อนเมื่อพิมพ์) */}
      <div className="bg-white rounded-[2.5rem] p-6 shadow-xl border-4 border-indigo-50 no-print">
        <div className="flex flex-col lg:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-5">
            <div className="text-4xl bg-indigo-100 p-4 rounded-2xl shadow-inner transform hover:rotate-6 transition-transform">👩‍🏫</div>
            <div>
              <h2 className="text-2xl font-kids text-indigo-600">ระบบจัดการสำหรับคุณครู</h2>
              <p className="text-slate-400 font-bold text-xs uppercase tracking-widest mt-1">ยินดีต้อนรับ คุณครู {teacherName || 'Krukai'}</p>
              <div className="flex gap-2 mt-4">
                <button 
                    onClick={() => setViewMode('list')} 
                    className={`px-8 py-3 rounded-full text-sm font-bold transition-all border-b-4 ${viewMode === 'list' ? 'bg-indigo-600 text-white border-indigo-800 shadow-lg' : 'bg-indigo-50 text-indigo-400 border-indigo-100 hover:bg-indigo-100'}`}
                >
                    ตรวจงานนักเรียน 📥
                </button>
                <button 
                    onClick={() => setViewMode('summary')} 
                    className={`px-8 py-3 rounded-full text-sm font-bold transition-all border-b-4 ${viewMode === 'summary' ? 'bg-emerald-600 text-white border-emerald-800 shadow-lg' : 'bg-indigo-50 text-indigo-400 border-indigo-100 hover:bg-indigo-100'}`}
                >
                    สรุปผลคะแนน 📊
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {viewMode === 'summary' ? (
        /* --- หน้าสรุปคะแนน / พิมพ์ PDF --- */
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom duration-500">
          {/* ตัวเลือกการกรองสรุปคะแนน (ซ่อนเมื่อพิมพ์) */}
          <div className="bg-white p-8 rounded-[3rem] shadow-xl border-4 border-emerald-50 no-print">
            <div className="flex flex-col md:flex-row justify-between items-end gap-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 flex-1">
                <div className="space-y-2">
                  <label className="block text-[11px] font-black text-emerald-600 uppercase tracking-widest ml-3">เลือกระดับชั้น</label>
                  <select 
                      value={summaryGrade} 
                      onChange={e => setSummaryGrade(e.target.value)} 
                      className="w-full p-4 rounded-2xl bg-slate-50 border-2 border-emerald-100 font-bold outline-none text-emerald-700 shadow-inner appearance-none cursor-pointer focus:border-emerald-400 transition-all"
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
                      className="w-full p-4 rounded-2xl bg-slate-50 border-2 border-emerald-100 font-bold outline-none text-emerald-700 shadow-inner appearance-none cursor-pointer focus:border-emerald-400 transition-all"
                  >
                    <option value="All">ทุกห้องเรียน</option>
                    {[1, 2, 3, 4].map(r => <option key={r} value={`Room ${r}`}>ห้อง {r}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="block text-[11px] font-black text-emerald-600 uppercase tracking-widest ml-3">เลือกกิจกรรม</label>
                  <select 
                      value={summaryActivity} 
                      onChange={e => setSummaryActivity(e.target.value)} 
                      className="w-full p-4 rounded-2xl bg-slate-50 border-2 border-emerald-100 font-bold outline-none text-emerald-700 shadow-inner appearance-none cursor-pointer focus:border-emerald-400 transition-all"
                  >
                    <option value="Sports Day">งานกีฬาสี 🏃</option>
                    <option value="Children Day">งานวันเด็ก 🎈</option>
                  </select>
                </div>
              </div>
              <button 
                  onClick={() => window.print()} 
                  className="bg-slate-800 text-white px-10 py-4 rounded-2xl font-bold shadow-2xl hover:bg-black hover:scale-105 transition-all border-b-8 border-slate-900 active:border-b-0 active:translate-y-2"
              >
                  พิมพ์รายงาน PDF 📄
              </button>
            </div>
          </div>

          {/* ส่วนของตารางสรุปที่แสดงทั้งบนหน้าจอและ PDF */}
          <div className="bg-white rounded-[2.5rem] p-4 md:p-12 shadow-sm border-2 border-slate-50 overflow-hidden">
            {/* หัวกระดาษรายงาน (แสดงเฉพาะตอนพิมพ์) */}
            <div className="hidden print:block text-center border-b-4 border-black pb-8 mb-10">
              <h1 className="text-3xl font-bold font-sarabun text-black mb-2">รายงานสรุปผลคะแนนการส่งงานกิจกรรมออนไลน์</h1>
              <h2 className="text-xl font-bold font-sarabun text-black">วิชาสุขศึกษาและพลศึกษา ประจำปีการศึกษา 2568</h2>
              <div className="flex justify-between items-center text-base mt-10 font-bold font-sarabun px-6 border-2 border-slate-200 py-3 rounded-2xl">
                <p>ชั้น: {summaryGrade === 'Prathom 5' ? 'ประถมศึกษาปีที่ 5' : 'ประถมศึกษาปีที่ 6'}</p>
                <p>ห้อง: {summaryRoom === 'All' ? 'ทุกห้องเรียน' : summaryRoom.replace('Room ', '')}</p>
                <p>กิจกรรม: {summaryActivity === 'Sports Day' ? 'งานกีฬาสี 🏃' : 'งานวันเด็ก 🎈'}</p>
                <p>ครูผู้สอน: {teacherName || 'คุณครู Krukai'}</p>
              </div>
            </div>

            <div className="no-print mb-8 flex items-center justify-between border-l-8 border-emerald-500 pl-6 py-2">
               <div>
                  <h3 className="text-2xl font-kids text-slate-700 font-bold">ตารางสรุปคะแนนกิจกรรม</h3>
                  <p className="text-xs font-bold text-slate-400 mt-1 uppercase tracking-tighter">แสดงผลตามเงื่อนไขที่เลือกด้านบน</p>
               </div>
               <div className="hidden md:block">
                  <span className="bg-emerald-50 text-emerald-600 px-4 py-2 rounded-full font-black text-sm">
                    นักเรียนทั้งหมดในรายการ: {sortedSummaryData.length} คน
                  </span>
               </div>
            </div>

            <div className="overflow-x-auto rounded-[1.5rem] border-2 border-slate-100 shadow-inner">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-indigo-600 text-white print:bg-slate-100 print:text-black">
                    <th className="p-5 text-center font-bold font-sarabun border-r border-indigo-700 print:border-black">ห้อง</th>
                    <th className="p-5 text-center font-bold font-sarabun border-r border-indigo-700 print:border-black">เลขที่</th>
                    <th className="p-5 text-left font-bold font-sarabun border-r border-indigo-700 print:border-black">ชื่อ-นามสกุล</th>
                    <th className="p-5 text-center font-bold font-sarabun border-r border-indigo-700 print:border-black">คะแนน (20)</th>
                    <th className="p-5 text-center font-bold font-sarabun">ร้อยละ (%)</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedSummaryData.length === 0 ? (
                    <tr>
                        <td colSpan={5} className="p-32 text-center text-slate-300 italic font-bold text-2xl font-sarabun">ยังไม่มีข้อมูลนักเรียนในเงื่อนไขที่เลือกจ้า 🏜️</td>
                    </tr>
                  ) : (
                    sortedSummaryData.map((s, idx) => (
                      <tr key={idx} className={`border-b border-slate-100 print:border-black transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}`}>
                        <td className="p-5 text-center font-bold text-slate-500 print:text-black font-quicksand border-r border-slate-100 print:border-black">{s.room.replace('Room ', '')}</td>
                        <td className="p-5 text-center font-bold text-slate-700 print:text-black font-quicksand border-r border-slate-100 print:border-black">{s.studentNumber}</td>
                        <td className="p-5 text-left font-bold text-slate-800 print:text-black font-sarabun border-r border-slate-100 print:border-black">{s.name}</td>
                        <td className="p-5 text-center border-r border-slate-100 print:border-black">
                            <span className={`inline-block px-4 py-1.5 rounded-full font-black text-indigo-700 print:text-black ${s.review?.totalScore ? 'bg-indigo-50 shadow-sm' : ''} font-quicksand`}>
                                {s.review?.totalScore ?? '-'}
                            </span>
                        </td>
                        <td className="p-5 text-center">
                             <span className={`inline-block px-4 py-1.5 rounded-full font-bold text-emerald-600 print:text-black ${s.review?.percentage ? 'bg-emerald-50 shadow-sm' : ''} font-quicksand`}>
                                {s.review?.percentage ?? '-'}%
                             </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* ส่วนท้ายรายงานสำหรับลงชื่อ (แสดงเฉพาะตอนพิมพ์) */}
            <div className="hidden print:flex justify-around items-start mt-24 pt-16 border-t-2 border-slate-100">
              <div className="text-center w-80">
                <div className="border-b-2 border-black mb-4 h-16"></div>
                <p className="text-base font-bold font-sarabun">ลงชื่อคุณครูผู้สอน</p>
                <p className="text-sm text-slate-600 mt-2 font-bold font-sarabun">( {teacherName || 'คุณครู Krukai'} )</p>
              </div>
              <div className="text-center w-80">
                <div className="border-b-2 border-black mb-4 h-16"></div>
                <p className="text-base font-bold font-sarabun">ลงชื่อผู้ตรวจสอบ</p>
                <p className="text-sm text-slate-600 mt-2 font-bold font-sarabun">( .................................................... )</p>
              </div>
            </div>
            
            <div className="hidden print:block mt-24 text-[10px] text-right text-slate-400 font-sarabun italic font-bold">
                เอกสารนี้ถูกสร้างโดยระบบอัตโนมัติ เมื่อวันที่ {new Date().toLocaleDateString('th-TH')} เวลา {new Date().toLocaleTimeString('th-TH')}
            </div>
          </div>
        </div>
      ) : (
        /* --- หน้าตรวจงาน / รายการส่งงาน (List View) --- */
        <div className="space-y-6 animate-in fade-in slide-in-from-top duration-500">
          <div className="bg-white p-8 rounded-[3rem] shadow-xl border-4 border-indigo-50 space-y-10">
            {/* กรองตามกิจกรรมหลัก */}
            <div className="space-y-4">
              <label className="block text-sm font-black text-indigo-400 uppercase tracking-widest ml-4">เลือกกิจกรรมที่ต้องการตรวจ ✨</label>
              <div className="grid grid-cols-3 gap-4">
                <button 
                  onClick={() => setFilterActivity('All')}
                  className={`py-5 rounded-[2rem] font-bold transition-all border-b-8 flex items-center justify-center gap-3 ${filterActivity === 'All' ? 'bg-indigo-600 text-white border-indigo-800 shadow-xl scale-[1.03]' : 'bg-slate-50 text-slate-400 border-slate-200 hover:bg-slate-100'}`}
                >
                  <span className="text-2xl">🌍</span> ทั้งหมด
                </button>
                <button 
                  onClick={() => setFilterActivity('Sports Day')}
                  className={`py-5 rounded-[2rem] font-bold transition-all border-b-8 flex items-center justify-center gap-3 ${filterActivity === 'Sports Day' ? 'bg-orange-500 text-white border-orange-700 shadow-xl scale-[1.03]' : 'bg-slate-50 text-slate-400 border-slate-200 hover:bg-slate-100'}`}
                >
                  <span className="text-2xl">🏃</span> กีฬาสี
                </button>
                <button 
                  onClick={() => setFilterActivity('Children Day')}
                  className={`py-5 rounded-[2rem] font-bold transition-all border-b-8 flex items-center justify-center gap-3 ${filterActivity === 'Children Day' ? 'bg-cyan-500 text-white border-cyan-700 shadow-xl scale-[1.03]' : 'bg-slate-50 text-slate-400 border-slate-200 hover:bg-slate-100'}`}
                >
                  <span className="text-2xl">🎈</span> วันเด็ก
                </button>
              </div>
            </div>

            {/* ปุ่มกรองด่วนตามสถานะ (Pending Filter) */}
            <div className="space-y-4">
               <label className="block text-sm font-black text-indigo-400 uppercase tracking-widest ml-4">สถานะการตรวจงาน (คลิกกรองด่วน) 📑</label>
               <div className="flex gap-4 flex-wrap">
                  <button 
                    onClick={() => setFilterStatus('All')}
                    className={`px-8 py-3.5 rounded-2xl font-bold text-sm transition-all border-2 flex items-center gap-3 ${filterStatus === 'All' ? 'bg-indigo-600 border-indigo-700 text-white shadow-lg' : 'bg-white border-indigo-50 text-indigo-400 hover:bg-indigo-50'}`}
                  >
                    ดูงานทั้งหมด <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black ${filterStatus === 'All' ? 'bg-white text-indigo-600' : 'bg-indigo-50 text-indigo-400'}`}>{statusCounts.All}</span>
                  </button>
                  <button 
                    onClick={() => setFilterStatus('Pending')}
                    className={`px-8 py-3.5 rounded-2xl font-bold text-sm transition-all border-2 flex items-center gap-3 ${filterStatus === 'Pending' ? 'bg-orange-500 border-orange-600 text-white shadow-lg' : 'bg-white border-orange-50 text-orange-400 hover:bg-orange-50'}`}
                  >
                    ยังไม่ได้ตรวจ ⌛ <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black ${filterStatus === 'Pending' ? 'bg-white text-orange-600' : 'bg-orange-50 text-orange-400'}`}>{statusCounts.Pending}</span>
                  </button>
                  <button 
                    onClick={() => setFilterStatus('Graded')}
                    className={`px-8 py-3.5 rounded-2xl font-bold text-sm transition-all border-2 flex items-center gap-3 ${filterStatus === 'Graded' ? 'bg-green-500 border-green-600 text-white shadow-lg' : 'bg-white border-green-50 text-green-400 hover:bg-green-50'}`}
                  >
                    ตรวจเรียบร้อย ✅ <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black ${filterStatus === 'Graded' ? 'bg-white text-green-600' : 'bg-green-50 text-green-400'}`}>{statusCounts.Graded}</span>
                  </button>
               </div>
            </div>

            {/* ช่องค้นหาและฟิลเตอร์ละเอียด */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end pt-8 border-t-2 border-slate-50">
              <div className="md:col-span-1">
                 <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-4">ค้นหาด้วยชื่อ หรือ เลขที่</label>
                 <div className="relative">
                   <input 
                      type="text" 
                      placeholder="พิมพ์ชื่อนักเรียน..." 
                      value={filterText} 
                      onChange={e => setFilterText(e.target.value)} 
                      className="w-full p-4 pl-12 rounded-2xl bg-slate-50 border-2 border-slate-100 outline-none text-sm focus:border-indigo-400 transition-all shadow-inner font-bold text-indigo-600"
                   />
                   <span className="absolute left-4 top-4 text-slate-300">🔍</span>
                 </div>
              </div>
              <div>
                <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-4">ระดับชั้น</label>
                <select 
                    value={filterGrade} 
                    onChange={e => setFilterGrade(e.target.value)} 
                    className="w-full p-4 rounded-2xl bg-white border-2 border-slate-100 text-sm font-bold outline-none cursor-pointer hover:border-indigo-200 transition-all"
                >
                  <option value="All">ทุกระดับชั้น</option>
                  <option value="Prathom 5">ประถมศึกษาปีที่ 5</option>
                  <option value="Prathom 6">ประถมศึกษาปีที่ 6</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-4">ห้องเรียน</label>
                <select 
                    value={filterRoom} 
                    onChange={e => setFilterRoom(e.target.value)} 
                    className="w-full p-4 rounded-2xl bg-white border-2 border-slate-100 text-sm font-bold outline-none cursor-pointer hover:border-indigo-200 transition-all"
                >
                  <option value="All">ทุกห้องเรียน</option>
                  {[1, 2, 3, 4].map(r => <option key={r} value={`Room ${r}`}>ห้องเรียน {r}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* รายการแสดงวิดีโอที่ส่งมา */}
          <div className="space-y-4">
            {filteredSubmissions.length === 0 ? (
              <div className="text-center p-32 bg-white/40 rounded-[4rem] border-4 border-dashed border-slate-200 animate-pulse">
                <p className="text-8xl mb-6 grayscale opacity-20">🏜️</p>
                <p className="text-slate-400 font-bold italic text-xl font-kids">ไม่พบรายการงานที่หนูเลือกจ้า ลองปรับตัวกรองดูนะ</p>
              </div>
            ) : (
              filteredSubmissions.map((sub) => (
                <div key={sub.rowId} className={`group p-6 rounded-[3.5rem] border-4 transition-all bg-white hover:shadow-2xl hover:scale-[1.01] ${sub.review?.status === 'Graded' ? 'border-green-100 shadow-sm' : 'border-indigo-50 shadow-xl'}`}>
                  <div className="flex flex-col md:flex-row justify-between items-center gap-6">
                    <div className="flex items-center gap-6">
                      <div className={`text-4xl p-5 rounded-3xl transition-transform group-hover:rotate-12 shadow-inner ${sub.activityType === 'Sports Day' ? 'bg-orange-50' : 'bg-cyan-50'}`}>
                        {sub.activityType === 'Sports Day' ? '🏃' : '🎈'}
                      </div>
                      <div>
                        <h4 className="text-xl font-bold text-slate-800 flex items-center gap-3">
                          {sub.name} 
                          <span className="bg-indigo-50 text-indigo-500 px-3 py-0.5 rounded-full text-[10px] font-black uppercase tracking-tighter">เลขที่ {sub.studentNumber}</span>
                        </h4>
                        <div className="flex gap-2 mt-2">
                            <span className="bg-slate-100 text-slate-500 px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-widest">{sub.grade === 'Prathom 5' ? 'ป.5' : 'ป.6'} | {sub.room.replace('Room ', 'ห้อง ')}</span>
                            <span className={`px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${sub.activityType === 'Sports Day' ? 'bg-orange-100 text-orange-600' : 'bg-cyan-100 text-cyan-600'}`}>
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
                        className="bg-slate-100 text-slate-600 px-8 py-3.5 rounded-2xl font-bold text-xs hover:bg-slate-800 hover:text-white transition-all border-b-4 border-slate-200 active:border-b-0"
                      >
                        เปิดวิดีโอ 📺
                      </a>
                      <button 
                        onClick={() => { 
                            setEditingId(sub.rowId!); 
                            setRubric(sub.review || { contentAccuracy: 0, participation: 0, presentation: 0, discipline: 0, totalScore: 0, percentage: 0, comment: '', status: 'Pending' }); 
                        }} 
                        className={`px-8 py-3.5 rounded-2xl font-bold text-xs text-white transition-all border-b-8 active:border-b-0 active:translate-y-2 ${sub.review?.status === 'Graded' ? 'bg-green-500 border-green-700 shadow-md' : 'bg-indigo-500 border-indigo-700 shadow-xl animate-bounce'}`}
                      >
                        {sub.review?.status === 'Graded' ? `ตรวจแล้ว (${sub.review.totalScore}/20)` : 'ให้คะแนนนักเรียน ✍️'}
                      </button>
                    </div>
                  </div>

                  {/* แผงควบคุมการให้คะแนนแบบ Rubric */}
                  {editingId === sub.rowId && (
                    <div className="mt-8 p-10 bg-indigo-50/40 rounded-[4rem] border-4 border-indigo-100 animate-in slide-in-from-top duration-500 shadow-inner">
                      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-6">
                        <div>
                          <h5 className="font-kids text-indigo-700 text-xl font-bold">แบบประเมินผลงานนักเรียน</h5>
                          <p className="text-xs font-bold text-indigo-300 uppercase mt-1 tracking-widest">วิชาสุขศึกษาและพลศึกษา</p>
                        </div>
                        <button 
                            onClick={handleAutoGrade} 
                            disabled={isAutoGrading} 
                            className="w-full md:w-auto bg-yellow-400 text-indigo-900 px-8 py-4 rounded-3xl font-black text-xs shadow-xl hover:bg-yellow-300 hover:scale-[1.05] transition-all active:scale-95 border-b-4 border-yellow-600 flex items-center justify-center gap-2"
                        >
                          {isAutoGrading ? (
                             <>
                               <span className="animate-spin text-xl">✨</span>
                               <span>AI กำลังวิเคราะห์วิดีโอ...</span>
                             </>
                          ) : (
                             <>
                               <span className="text-xl">✨</span>
                               <span>ให้ AI ช่วยประเมินเบื้องต้น</span>
                             </>
                          )}
                        </button>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <PointSelector label="ความถูกต้องของเนื้อหา (Content)" current={rubric.contentAccuracy} onSelect={v => updateRubricItem('contentAccuracy', v)}/>
                        <PointSelector label="การมีส่วนร่วมและความตั้งใจ (Participation)" current={rubric.participation} onSelect={v => updateRubricItem('participation', v)}/>
                        <PointSelector label="เทคนิคการนำเสนอ (Presentation)" current={rubric.presentation} onSelect={v => updateRubricItem('presentation', v)}/>
                        <PointSelector label="วินัยและการตรงต่อเวลา (Discipline)" current={rubric.discipline} onSelect={v => updateRubricItem('discipline', v)}/>
                      </div>

                      <div className="mt-8">
                        <label className="block text-[11px] font-black text-indigo-400 uppercase tracking-widest mb-3 ml-6">คำชมเชยและข้อเสนอแนะจากคุณครู</label>
                        <textarea 
                            value={rubric.comment} 
                            onChange={e => setRubric({...rubric, comment: e.target.value})} 
                            className="w-full p-8 rounded-[3rem] h-36 border-4 border-indigo-50 outline-none text-base bg-white focus:border-indigo-400 transition-all shadow-inner font-bold text-slate-700 font-sarabun" 
                            placeholder="เขียนข้อความให้กำลังใจหนูๆ ตรงนี้เลยจ๊ะ..."
                        />
                      </div>

                      <div className="flex flex-col md:flex-row gap-5 mt-10">
                        <button 
                            onClick={handleSave} 
                            disabled={saving} 
                            className="flex-[2] bg-indigo-600 text-white py-6 rounded-[2.5rem] font-bold text-xl shadow-2xl hover:bg-indigo-700 transition-all border-b-8 border-indigo-900 active:border-b-0 active:translate-y-2 flex items-center justify-center gap-3"
                        >
                          {saving ? 'กำลังบันทึกข้อมูล...' : 'บันทึกและส่งคำชมให้นักเรียน ✅'}
                        </button>
                        <button 
                            onClick={() => setEditingId(null)} 
                            className="flex-1 px-10 bg-white text-slate-400 rounded-[2.5rem] border-4 border-slate-100 font-bold hover:bg-slate-50 transition-all py-6"
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
