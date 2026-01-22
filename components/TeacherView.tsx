
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
  const [filterText, setFilterText] = useState('');
  const [filterGrade, setFilterGrade] = useState('All');
  const [filterRoom, setFilterRoom] = useState('All');
  const [filterActivity, setFilterActivity] = useState('All');
  const [filterStatus, setFilterStatus] = useState<'All' | 'Pending' | 'Graded'>('All');

  const [summaryGrade, setSummaryGrade] = useState('Prathom 5');
  const [summaryActivity, setSummaryActivity] = useState('Sports Day');

  const [rubric, setRubric] = useState<RubricReview>({
    contentAccuracy: 0, participation: 0, presentation: 0, discipline: 0,
    totalScore: 0, percentage: 0, comment: '', status: 'Pending'
  });

  const [saving, setSaving] = useState(false);
  const [isAutoGrading, setIsAutoGrading] = useState(false);

  // ฟังก์ชันอัปเดตคะแนนแยกหัวข้อ
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

  // กรองข้อมูลสำหรับหน้ารายการปกติ
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

  // กรองข้อมูลสำหรับหน้าสรุปคะแนน (เรียง ห้อง > เลขที่)
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
        contents: `ประเมินคะแนน 0-5 กิจกรรม "${student.activityType}" ของ "${student.name}" (Content, Participation, Presentation, Discipline) และเขียนคำชมภาษาไทยสั้นๆ อบอุ่นเป็น JSON เท่านั้น`,
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
      setRubric(prev => ({ ...prev, ...res, totalScore: total, percentage: Math.round((total / 20) * 100) }));
    } catch (e) { console.error(e); } finally { setIsAutoGrading(false); }
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
    <div className="bg-white p-3 rounded-xl border border-indigo-50 mb-2">
      <div className="flex justify-between items-center mb-2">
        <span className="font-bold text-indigo-700 text-xs">{label}</span>
        <span className="text-xs font-bold text-indigo-400">{current}/5</span>
      </div>
      <div className="flex gap-1">
        {[0, 1, 2, 3, 4, 5].map(pt => (
          <button key={pt} onClick={() => onSelect(pt)} className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${current === pt ? 'bg-indigo-500 text-white shadow-md' : 'bg-gray-50 text-gray-400'}`}>{pt}</button>
        ))}
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-[2.5rem] p-6 shadow-xl border-4 border-indigo-50 no-print">
        <div className="flex flex-col lg:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-4">
            <div className="text-4xl bg-indigo-100 p-3 rounded-2xl">👩‍🏫</div>
            <div>
              <h2 className="text-xl font-kids text-indigo-600">จัดการข้อมูลโดยคุณครู {teacherName}</h2>
              <div className="flex gap-2 mt-2">
                <button onClick={() => setViewMode('list')} className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${viewMode === 'list' ? 'bg-indigo-500 text-white shadow-md' : 'bg-indigo-50 text-indigo-400'}`}>รายการตรวจงาน</button>
                <button onClick={() => setViewMode('summary')} className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${viewMode === 'summary' ? 'bg-indigo-500 text-white shadow-md' : 'bg-indigo-50 text-indigo-400'}`}>ตารางสรุปคะแนน</button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {viewMode === 'summary' ? (
        <div className="bg-white p-8 rounded-[3rem] shadow-xl border-4 border-indigo-50 animate-in fade-in duration-500">
          <div className="flex flex-col md:flex-row justify-between items-end gap-4 mb-8 no-print">
            <div className="flex gap-4 flex-wrap">
              <div>
                <label className="block text-[10px] font-black text-indigo-300 mb-1 ml-2 uppercase">ระดับชั้น</label>
                <select value={summaryGrade} onChange={e => setSummaryGrade(e.target.value)} className="p-3 rounded-2xl bg-indigo-50 border-2 border-indigo-100 font-bold outline-none text-indigo-700">
                  <option value="Prathom 5">ป.5</option>
                  <option value="Prathom 6">ป.6</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-black text-indigo-300 mb-1 ml-2 uppercase">กิจกรรม</label>
                <select value={summaryActivity} onChange={e => setSummaryActivity(e.target.value)} className="p-3 rounded-2xl bg-indigo-50 border-2 border-indigo-100 font-bold outline-none text-indigo-700">
                  <option value="Sports Day">งานกีฬาสี 🏃</option>
                  <option value="Children Day">งานวันเด็ก 🎈</option>
                </select>
              </div>
            </div>
            <button onClick={() => window.print()} className="bg-indigo-600 text-white px-8 py-3 rounded-2xl font-bold shadow-lg hover:bg-indigo-700 transition-all">พิมพ์สรุปคะแนน (PDF) 📄</button>
          </div>

          <div className="overflow-x-auto">
            <div className="text-center mb-6 hidden print:block">
              <h1 className="text-2xl font-bold">แบบสรุปคะแนนกิจกรรมวิชาสุขศึกษาและพลศึกษา</h1>
              <p className="text-lg">ชั้น {summaryGrade === 'Prathom 5' ? 'ประถมศึกษาปีที่ 5' : 'ประถมศึกษาปีที่ 6'} | {summaryActivity === 'Sports Day' ? 'กิจกรรมกีฬาสี 🏃' : 'กิจกรรมวันเด็ก 🎈'}</p>
            </div>
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-indigo-500 text-white">
                  <th className="p-4 border border-indigo-600 text-center rounded-tl-2xl">ห้อง</th>
                  <th className="p-4 border border-indigo-600 text-center">เลขที่</th>
                  <th className="p-4 border border-indigo-600 text-left">ชื่อ-นามสกุล</th>
                  <th className="p-4 border border-indigo-600 text-center">คะแนน (20)</th>
                  <th className="p-4 border border-indigo-600 text-center rounded-tr-2xl">ร้อยละ</th>
                </tr>
              </thead>
              <tbody>
                {sortedSummaryData.length === 0 ? (
                  <tr><td colSpan={5} className="p-10 text-center text-gray-400 italic">ไม่พบข้อมูลในเงื่อนไขที่เลือก</td></tr>
                ) : (
                  sortedSummaryData.map((s, idx) => (
                    <tr key={idx} className="hover:bg-indigo-50 transition-colors border-b border-gray-100">
                      <td className="p-3 border border-gray-200 text-center font-bold text-slate-500">{s.room.replace('Room ', '')}</td>
                      <td className="p-3 border border-gray-200 text-center font-bold text-slate-700">{s.studentNumber}</td>
                      <td className="p-3 border border-gray-200 text-left font-medium text-slate-600">{s.name}</td>
                      <td className="p-3 border border-gray-200 text-center font-black text-indigo-600">{s.review?.totalScore ?? '-'}</td>
                      <td className="p-3 border border-gray-200 text-center font-bold text-emerald-500">{s.review?.percentage ?? '-'}%</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="grid gap-4">
          {/* Combined Filters for List View */}
          <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border-2 border-indigo-50 space-y-4">
            <div className="flex flex-col md:flex-row gap-4 items-center">
              <div className="flex-1 w-full relative">
                 <input type="text" placeholder="ค้นหาชื่อ หรือ เลขที่..." value={filterText} onChange={e => setFilterText(e.target.value)} className="w-full p-3 pl-10 rounded-2xl bg-slate-50 border-2 border-slate-100 outline-none text-sm focus:border-indigo-300 transition-all"/>
                 <span className="absolute left-3 top-3 text-slate-300">🔍</span>
              </div>
              <div className="flex gap-2 w-full md:w-auto">
                <select value={filterActivity} onChange={e => setFilterActivity(e.target.value)} className="flex-1 md:flex-none p-3 rounded-2xl bg-white border-2 border-slate-100 text-sm font-bold outline-none cursor-pointer">
                  <option value="All">กิจกรรมทั้งหมด</option>
                  <option value="Sports Day">🏃 กีฬาสี</option>
                  <option value="Children Day">🎈 วันเด็ก</option>
                </select>
                <select value={filterStatus} onChange={e => setFilterStatus(e.target.value as any)} className="flex-1 md:flex-none p-3 rounded-2xl bg-white border-2 border-slate-100 text-sm font-bold outline-none cursor-pointer">
                  <option value="All">สถานะทั้งหมด</option>
                  <option value="Pending">⏳ รอตรวจ</option>
                  <option value="Graded">✅ ตรวจแล้ว</option>
                </select>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-50">
               <div className="flex items-center gap-2">
                 <span className="text-[10px] font-black text-indigo-300 uppercase tracking-widest">ระดับชั้น:</span>
                 <div className="flex bg-slate-100 p-1 rounded-xl">
                   {['All', 'Prathom 5', 'Prathom 6'].map(g => (
                     <button key={g} onClick={() => setFilterGrade(g)} className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all ${filterGrade === g ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400'}`}>
                       {g === 'All' ? 'ทั้งหมด' : g === 'Prathom 5' ? 'ป.5' : 'ป.6'}
                     </button>
                   ))}
                 </div>
               </div>
               <div className="flex items-center gap-2 ml-auto">
                 <span className="text-[10px] font-black text-indigo-300 uppercase tracking-widest">ห้อง:</span>
                 <select value={filterRoom} onChange={e => setFilterRoom(e.target.value)} className="bg-transparent text-[10px] font-bold text-slate-600 outline-none cursor-pointer">
                    <option value="All">ทุกห้อง</option>
                    {[1, 2, 3, 4].map(r => <option key={r} value={`Room ${r}`}>ห้อง {r}</option>)}
                 </select>
               </div>
            </div>
          </div>

          {/* Submission List */}
          <div className="grid gap-4">
            {filteredSubmissions.length === 0 ? (
              <div className="text-center p-20 bg-white rounded-[3rem] border-4 border-dashed border-slate-100">
                <p className="text-5xl mb-4">🔍</p>
                <p className="text-slate-400 font-bold italic">ไม่พบข้อมูลงานที่หนูตามหาจ้า...</p>
              </div>
            ) : (
              filteredSubmissions.map((sub) => (
                <div key={sub.rowId} className={`p-5 rounded-[2.5rem] border-4 transition-all bg-white ${sub.review?.status === 'Graded' ? 'border-green-100' : 'border-indigo-50 shadow-md'}`}>
                  <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                    <div className="flex items-center gap-4">
                      <div className="text-3xl bg-slate-50 p-3 rounded-2xl">{sub.activityType === 'Sports Day' ? '🏃' : '🎈'}</div>
                      <div>
                        <h4 className="font-bold text-slate-700">{sub.name} <span className="text-slate-400 text-xs ml-2">เลขที่ {sub.studentNumber}</span></h4>
                        <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">{sub.grade === 'Prathom 5' ? 'ป.5' : 'ป.6'} | {sub.room.replace('Room ', 'ห้อง ')}</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <a href={sub.fileUrl} target="_blank" className="bg-indigo-100 text-indigo-600 px-4 py-2 rounded-xl font-bold text-xs hover:bg-indigo-200 transition-all">วิดีโอ 📺</a>
                      <button onClick={() => { setEditingId(sub.rowId!); setRubric(sub.review || { contentAccuracy: 0, participation: 0, presentation: 0, discipline: 0, totalScore: 0, percentage: 0, comment: '', status: 'Pending' }); }} className={`px-4 py-2 rounded-xl font-bold text-xs text-white transition-all transform hover:scale-105 ${sub.review?.status === 'Graded' ? 'bg-green-500' : 'bg-orange-400 shadow-lg'}`}>
                        {sub.review?.status === 'Graded' ? `${sub.review.totalScore}/20` : 'ให้คะแนน ✍️'}
                      </button>
                    </div>
                  </div>

                  {editingId === sub.rowId && (
                    <div className="mt-4 p-5 bg-indigo-50 rounded-[2rem] border-2 border-indigo-100 animate-in slide-in-from-top duration-300">
                      <div className="flex justify-between items-center mb-4">
                        <h5 className="font-bold text-indigo-700 text-sm">ประเมินผลงาน</h5>
                        <button onClick={handleAutoGrade} disabled={isAutoGrading} className="bg-yellow-400 text-indigo-900 px-3 py-1 rounded-lg font-bold text-[10px] shadow-sm hover:bg-yellow-300">
                          {isAutoGrading ? '🪄 AI กำลังตรวจ...' : '🪄 AI ช่วยตรวจ'}
                        </button>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4">
                        <PointSelector label="ความถูกต้อง" current={rubric.contentAccuracy} onSelect={v => updateRubricItem('contentAccuracy', v)}/>
                        <PointSelector label="ความตั้งใจ" current={rubric.participation} onSelect={v => updateRubricItem('participation', v)}/>
                        <PointSelector label="การนำเสนอ" current={rubric.presentation} onSelect={v => updateRubricItem('presentation', v)}/>
                        <PointSelector label="ระเบียบวินัย" current={rubric.discipline} onSelect={v => updateRubricItem('discipline', v)}/>
                      </div>
                      <textarea value={rubric.comment} onChange={e => setRubric({...rubric, comment: e.target.value})} className="w-full p-3 rounded-xl h-20 border border-indigo-100 outline-none text-xs mt-2 bg-white" placeholder="พิมพ์คำชมจากคุณครูที่นี่ หรือให้ AI ช่วยร่างให้นะจ๊ะ..."/>
                      <div className="flex gap-2 mt-4">
                        <button onClick={handleSave} disabled={saving} className="flex-1 bg-indigo-500 text-white py-3 rounded-xl font-bold text-sm shadow-md hover:bg-indigo-600 transition-all">{saving ? 'กำลังบันทึก...' : 'บันทึกคะแนนเรียบร้อย ✅'}</button>
                        <button onClick={() => setEditingId(null)} className="px-6 bg-white text-slate-400 rounded-xl border border-slate-100 text-sm hover:bg-slate-50 transition-all">ยกเลิก</button>
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
