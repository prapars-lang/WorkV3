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

  // Function to update individual rubric items and calculate totals
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

  // List View Filter Logic
  const filteredSubmissions = useMemo(() => {
    return submissions.filter(s => {
      const matchesText = s.name.toLowerCase().includes(filterText.toLowerCase()) || 
                         s.studentNumber.includes(filterText);
      const matchesGrade = filterGrade === 'All' || s.grade === filterGrade;
      const matchesRoom = filterRoom === 'All' || s.room === filterRoom;
      const matchesActivity = filterActivity === 'All' || s.activityType === filterActivity;
      const matchesStatus = filterStatus === 'All' || 
                           (filterStatus === 'Graded' && s.review?.status === 'Graded') || 
                           (filterStatus === 'Pending' && s.review?.status !== 'Graded');
      return matchesText && matchesGrade && matchesRoom && matchesActivity && matchesStatus;
    });
  }, [submissions, filterText, filterGrade, filterRoom, filterActivity, filterStatus]);

  // Summary View Logic (Numeric sort by Room then Student Number)
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
        contents: `ประเมินคะแนน 0-5 กิจกรรม "${student.activityType}" ของ "${student.name}" โดยพิจารณาจากหัวข้อ Content, Participation, Presentation, Discipline และเขียนคำชมภาษาไทยที่อบอุ่นสั้นๆ ส่งคืนเป็น JSON เท่านั้น`,
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
            }
          }
        }
      });
      const res = JSON.parse(response.text || '{}');
      const total = (res.contentAccuracy || 0) + (res.participation || 0) + (res.presentation || 0) + (res.discipline || 0);
      setRubric(prev => ({ 
        ...prev, ...res, 
        totalScore: total, 
        percentage: Math.round((total / 20) * 100),
        comment: `🤖 AI: ${res.comment || ''}`
      }));
    } catch (e) { console.error(e); alert("AI ขัดข้องจ้า"); } finally { setIsAutoGrading(false); }
  };

  const handleSave = async () => {
    if (!editingId) return;
    setSaving(true);
    const sub = submissions.find(s => s.rowId === editingId);
    const success = await handleUpdateGrade(editingId, { ...rubric, status: 'Graded', activityType: sub?.activityType });
    if (success) { setEditingId(null); onUpdate(); }
    setSaving(false);
  };

  const PointSelector = ({ label, current, onSelect }: { label: string, current: number, onSelect: (v: number) => void }) => (
    <div className="bg-white p-3 rounded-xl border border-indigo-50 mb-2 shadow-sm">
      <div className="flex justify-between items-center mb-2">
        <span className="font-bold text-indigo-700 text-[11px]">{label}</span>
        <span className="text-[11px] font-bold text-indigo-400 bg-indigo-50 px-2 rounded-full">{current}/5</span>
      </div>
      <div className="flex gap-1">
        {[0, 1, 2, 3, 4, 5].map(pt => (
          <button key={pt} onClick={() => onSelect(pt)} className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${current === pt ? 'bg-indigo-500 text-white shadow-md' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'}`}>{pt}</button>
        ))}
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Teacher Header */}
      <div className="bg-white rounded-[2.5rem] p-6 shadow-xl border-4 border-indigo-50 no-print">
        <div className="flex flex-col lg:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-4">
            <div className="text-4xl bg-indigo-100 p-3 rounded-2xl transform hover:rotate-12 transition-transform">👩‍🏫</div>
            <div>
              <h2 className="text-xl font-kids text-indigo-600">จัดการข้อมูลโดยคุณครู {teacherName}</h2>
              <div className="flex gap-2 mt-2">
                <button onClick={() => setViewMode('list')} className={`px-5 py-2 rounded-full text-xs font-bold transition-all border-b-4 ${viewMode === 'list' ? 'bg-indigo-500 text-white border-indigo-700 shadow-md' : 'bg-indigo-50 text-indigo-400 border-indigo-100 hover:bg-indigo-100'}`}>รายการตรวจงาน 📥</button>
                <button onClick={() => setViewMode('summary')} className={`px-5 py-2 rounded-full text-xs font-bold transition-all border-b-4 ${viewMode === 'summary' ? 'bg-emerald-500 text-white border-emerald-700 shadow-md' : 'bg-indigo-50 text-indigo-400 border-indigo-100 hover:bg-indigo-100'}`}>ตารางสรุปคะแนน 📊</button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {viewMode === 'summary' ? (
        /* SUMMARY VIEW (Optimized for Printing) */
        <div className="bg-white p-8 rounded-[3rem] shadow-xl border-4 border-indigo-50 animate-in fade-in duration-500 glass-morphism">
          <div className="flex flex-col md:flex-row justify-between items-end gap-4 mb-8 no-print">
            <div className="flex gap-4 flex-wrap">
              <div>
                <label className="block text-[10px] font-black text-indigo-300 mb-1 ml-2 uppercase tracking-widest">ระดับชั้น</label>
                <select value={summaryGrade} onChange={e => setSummaryGrade(e.target.value)} className="p-3 rounded-2xl bg-indigo-50 border-2 border-indigo-100 font-bold outline-none text-indigo-700 shadow-sm">
                  <option value="Prathom 5">ป.5</option>
                  <option value="Prathom 6">ป.6</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-black text-indigo-300 mb-1 ml-2 uppercase tracking-widest">กิจกรรม</label>
                <select value={summaryActivity} onChange={e => setSummaryActivity(e.target.value)} className="p-3 rounded-2xl bg-indigo-50 border-2 border-indigo-100 font-bold outline-none text-indigo-700 shadow-sm">
                  <option value="Sports Day">งานกีฬาสี 🏃</option>
                  <option value="Children Day">งานวันเด็ก 🎈</option>
                </select>
              </div>
            </div>
            <button onClick={() => window.print()} className="bg-indigo-600 text-white px-8 py-3 rounded-2xl font-bold shadow-lg hover:bg-indigo-700 hover:scale-105 transition-all border-b-4 border-indigo-800 active:border-b-0 active:translate-y-1">พิมพ์สรุปคะแนน (PDF) 📄</button>
          </div>

          <div className="print-content">
            {/* Header for Print only */}
            <div className="hidden print:block mb-8 text-center border-b-2 border-black pb-4">
              <h1 className="text-2xl font-bold mb-1">แบบสรุปคะแนนผลการเรียนกิจกรรม</h1>
              <h2 className="text-xl font-bold mb-2">วิชาสุขศึกษาและพลศึกษา ประจำปีการศึกษา 2568</h2>
              <div className="flex justify-between items-center text-sm font-bold mt-4">
                <span>ชั้น: {summaryGrade === 'Prathom 5' ? 'ประถมศึกษาปีที่ 5' : 'ประถมศึกษาปีที่ 6'}</span>
                <span>กิจกรรม: {summaryActivity === 'Sports Day' ? 'กีฬาสี 🏃' : 'วันเด็ก 🎈'}</span>
                <span>ครูผู้สอน: {teacherName}</span>
              </div>
              <p className="text-[10px] text-right mt-2 text-slate-400">ข้อมูล ณ วันที่ {new Date().toLocaleDateString('th-TH')} เวลา {new Date().toLocaleTimeString('th-TH')}</p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-indigo-500 text-white print:bg-gray-100 print:text-black">
                    <th className="p-4 border border-indigo-600 print:border-black text-center font-bold">ห้อง</th>
                    <th className="p-4 border border-indigo-600 print:border-black text-center font-bold">เลขที่</th>
                    <th className="p-4 border border-indigo-600 print:border-black text-left font-bold">ชื่อ-นามสกุล</th>
                    <th className="p-4 border border-indigo-600 print:border-black text-center font-bold">คะแนนรวม (20)</th>
                    <th className="p-4 border border-indigo-600 print:border-black text-center font-bold">ร้อยละ (%)</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedSummaryData.length === 0 ? (
                    <tr><td colSpan={5} className="p-10 text-center text-slate-400 italic font-bold">ไม่พบข้อมูลในเงื่อนไขที่เลือกจ้า</td></tr>
                  ) : (
                    sortedSummaryData.map((s, idx) => (
                      <tr key={idx} className="hover:bg-indigo-50 transition-colors border-b border-slate-100 print:border-black">
                        <td className="p-3 border border-slate-200 print:border-black text-center font-bold text-slate-500 print:text-black">{s.room.replace('Room ', '')}</td>
                        <td className="p-3 border border-slate-200 print:border-black text-center font-bold text-slate-700 print:text-black">{s.studentNumber}</td>
                        <td className="p-3 border border-slate-200 print:border-black text-left font-medium text-slate-600 print:text-black">{s.name}</td>
                        <td className="p-3 border border-slate-200 print:border-black text-center font-black text-indigo-600 print:text-black">{s.review?.totalScore ?? '-'}</td>
                        <td className="p-3 border border-slate-200 print:border-black text-center font-bold text-emerald-500 print:text-black">{s.review?.percentage ?? '-'}%</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Footer for Print only */}
            <div className="hidden print:flex justify-between items-center mt-12 px-10">
              <div className="text-center w-64">
                <div className="border-b border-black mb-1 h-8"></div>
                <p className="text-sm font-bold">ผู้รายงาน</p>
                <p className="text-xs">(...................................................)</p>
              </div>
              <div className="text-center w-64">
                <div className="border-b border-black mb-1 h-8"></div>
                <p className="text-sm font-bold">ผู้ตรวจรับรอง</p>
                <p className="text-xs">(...................................................)</p>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* LIST VIEW (Restored Original Filtering Style) */
        <div className="grid gap-6">
          {/* Big Activity Selectors (Original Style) */}
          <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border-2 border-indigo-50 space-y-6">
            <div className="space-y-2">
              <label className="block text-xs font-black text-indigo-300 uppercase tracking-widest ml-2">เลือกกิจกรรมที่ต้องการตรวจ ✨</label>
              <div className="grid grid-cols-3 gap-3">
                <button 
                  onClick={() => setFilterActivity('All')}
                  className={`py-3 rounded-2xl font-bold transition-all border-b-4 flex items-center justify-center gap-2 ${filterActivity === 'All' ? 'bg-indigo-500 text-white border-indigo-700 shadow-md scale-105' : 'bg-slate-50 text-slate-400 border-slate-200 hover:bg-slate-100'}`}
                >
                  <span className="text-xl">🌟</span> ทั้งหมด
                </button>
                <button 
                  onClick={() => setFilterActivity('Sports Day')}
                  className={`py-3 rounded-2xl font-bold transition-all border-b-4 flex items-center justify-center gap-2 ${filterActivity === 'Sports Day' ? 'bg-orange-400 text-white border-orange-600 shadow-md scale-105' : 'bg-slate-50 text-slate-400 border-slate-200 hover:bg-slate-100'}`}
                >
                  <span className="text-xl">🏃</span> กีฬาสี
                </button>
                <button 
                  onClick={() => setFilterActivity('Children Day')}
                  className={`py-3 rounded-2xl font-bold transition-all border-b-4 flex items-center justify-center gap-2 ${filterActivity === 'Children Day' ? 'bg-cyan-400 text-white border-cyan-600 shadow-md scale-105' : 'bg-slate-50 text-slate-400 border-slate-200 hover:bg-slate-100'}`}
                >
                  <span className="text-xl">🎈</span> วันเด็ก
                </button>
              </div>
            </div>

            {/* Sub-Filters */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end pt-4 border-t border-slate-50">
              <div className="md:col-span-1">
                 <label className="block text-[10px] font-black text-indigo-300 uppercase tracking-widest mb-1 ml-2">ค้นหาชื่อ/เลขที่</label>
                 <input type="text" placeholder="พิมพ์ตรงนี้จ๊ะ..." value={filterText} onChange={e => setFilterText(e.target.value)} className="w-full p-3 rounded-2xl bg-slate-50 border-2 border-slate-100 outline-none text-sm focus:border-indigo-300 transition-all shadow-inner"/>
              </div>
              <div>
                <label className="block text-[10px] font-black text-indigo-300 uppercase tracking-widest mb-1 ml-2">ชั้นเรียน</label>
                <select value={filterGrade} onChange={e => setFilterGrade(e.target.value)} className="w-full p-3 rounded-2xl bg-white border-2 border-slate-100 text-xs font-bold outline-none cursor-pointer">
                  <option value="All">ทุกชั้นเรียน</option>
                  <option value="Prathom 5">ป.5</option>
                  <option value="Prathom 6">ป.6</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-black text-indigo-300 uppercase tracking-widest mb-1 ml-2">ห้อง</label>
                <select value={filterRoom} onChange={e => setFilterRoom(e.target.value)} className="w-full p-3 rounded-2xl bg-white border-2 border-slate-100 text-xs font-bold outline-none cursor-pointer">
                  <option value="All">ทุกห้อง</option>
                  {[1, 2, 3, 4].map(r => <option key={r} value={`Room ${r}`}>ห้อง {r}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-black text-indigo-300 uppercase tracking-widest mb-1 ml-2">สถานะ</label>
                <select value={filterStatus} onChange={e => setFilterStatus(e.target.value as any)} className="w-full p-3 rounded-2xl bg-white border-2 border-slate-100 text-xs font-bold outline-none cursor-pointer">
                  <option value="All">สถานะทั้งหมด</option>
                  <option value="Pending">⏳ รอตรวจ</option>
                  <option value="Graded">✅ ตรวจแล้ว</option>
                </select>
              </div>
            </div>
          </div>

          {/* Submission List */}
          <div className="grid gap-4">
            {filteredSubmissions.length === 0 ? (
              <div className="text-center p-20 bg-white/50 rounded-[3rem] border-4 border-dashed border-slate-100">
                <p className="text-6xl mb-4 grayscale opacity-30">🏜️</p>
                <p className="text-slate-400 font-bold italic">ไม่พบผลงานที่หนูเลือกจ้า...</p>
              </div>
            ) : (
              filteredSubmissions.map((sub) => (
                <div key={sub.rowId} className={`group p-5 rounded-[2.5rem] border-4 transition-all bg-white hover:scale-[1.01] ${sub.review?.status === 'Graded' ? 'border-green-100 shadow-sm' : 'border-indigo-50 shadow-md'}`}>
                  <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                    <div className="flex items-center gap-4">
                      <div className={`text-3xl p-3 rounded-2xl transition-transform group-hover:rotate-12 ${sub.activityType === 'Sports Day' ? 'bg-orange-50' : 'bg-cyan-50'}`}>
                        {sub.activityType === 'Sports Day' ? '🏃' : '🎈'}
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-700">{sub.name} <span className="text-slate-400 text-xs ml-2">เลขที่ {sub.studentNumber}</span></h4>
                        <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">{sub.grade === 'Prathom 5' ? 'ป.5' : 'ป.6'} | {sub.room.replace('Room ', 'ห้อง ')}</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <a href={sub.fileUrl} target="_blank" className="bg-indigo-100 text-indigo-600 px-5 py-2.5 rounded-xl font-bold text-xs hover:bg-indigo-200 transition-all border-b-2 border-indigo-200">ดูวิดีโอ 📺</a>
                      <button onClick={() => { setEditingId(sub.rowId!); setRubric(sub.review || { contentAccuracy: 0, participation: 0, presentation: 0, discipline: 0, totalScore: 0, percentage: 0, comment: '', status: 'Pending' }); }} className={`px-5 py-2.5 rounded-xl font-bold text-xs text-white transition-all border-b-4 active:border-b-0 active:translate-y-1 ${sub.review?.status === 'Graded' ? 'bg-green-500 border-green-700' : 'bg-orange-400 border-orange-600 shadow-lg'}`}>
                        {sub.review?.status === 'Graded' ? `ตรวจแล้ว (${sub.review.totalScore}/20)` : 'ให้คะแนน ✍️'}
                      </button>
                    </div>
                  </div>

                  {editingId === sub.rowId && (
                    <div className="mt-4 p-6 bg-indigo-50/50 rounded-[2.5rem] border-2 border-indigo-100 animate-in slide-in-from-top duration-300">
                      <div className="flex justify-between items-center mb-6">
                        <h5 className="font-kids text-indigo-700 text-sm">เกณฑ์การประเมินผลงาน</h5>
                        <button onClick={handleAutoGrade} disabled={isAutoGrading} className="bg-yellow-400 text-indigo-900 px-4 py-2 rounded-xl font-black text-[10px] shadow-md hover:bg-yellow-300 hover:scale-105 transition-all active:scale-95 border-b-2 border-yellow-600">
                          {isAutoGrading ? '🪄 AI กำลังวิเคราะห์...' : '🪄 ให้ AI ช่วยประเมินเบื้องต้น'}
                        </button>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4">
                        <PointSelector label="ความถูกต้องของท่าทาง" current={rubric.contentAccuracy} onSelect={v => updateRubricItem('contentAccuracy', v)}/>
                        <PointSelector label="ความมุ่งมั่นตั้งใจ" current={rubric.participation} onSelect={v => updateRubricItem('participation', v)}/>
                        <PointSelector label="การนำเสนอ/สื่อสาร" current={rubric.presentation} onSelect={v => updateRubricItem('presentation', v)}/>
                        <PointSelector label="วินัยและการแต่งกาย" current={rubric.discipline} onSelect={v => updateRubricItem('discipline', v)}/>
                      </div>
                      <div className="mt-4">
                        <label className="block text-[10px] font-black text-indigo-300 uppercase tracking-widest mb-1 ml-2">คำชมจากคุณครู (หนูๆ รออ่านอยู่นะจ๊ะ)</label>
                        <textarea value={rubric.comment} onChange={e => setRubric({...rubric, comment: e.target.value})} className="w-full p-4 rounded-2xl h-24 border-2 border-indigo-100 outline-none text-xs bg-white focus:border-indigo-400 transition-all shadow-inner" placeholder="เขียนคำชมที่นี่ หรือให้ AI ช่วยร่างให้ได้นะจ๊ะ..."/>
                      </div>
                      <div className="flex gap-3 mt-6">
                        <button onClick={handleSave} disabled={saving} className="flex-1 bg-indigo-600 text-white py-4 rounded-2xl font-bold text-base shadow-xl hover:bg-indigo-700 transition-all border-b-4 border-indigo-900 active:border-b-0 active:translate-y-1">
                          {saving ? 'กำลังบันทึกคะแนน...' : 'บันทึกคะแนนเรียบร้อย ✅'}
                        </button>
                        <button onClick={() => setEditingId(null)} className="px-8 bg-white text-slate-400 rounded-2xl border-2 border-slate-100 font-bold hover:bg-slate-50 transition-all">ยกเลิก</button>
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