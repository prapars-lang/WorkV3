
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

  // State สำหรับการส่งออกหรือดูสรุป
  const [summaryGrade, setSummaryGrade] = useState<string>('Prathom 5');
  const [summaryActivity, setSummaryActivity] = useState<string>('Sports Day');

  const [rubric, setRubric] = useState<RubricReview>({
    contentAccuracy: 0, participation: 0, presentation: 0, discipline: 0,
    totalScore: 0, percentage: 0, comment: '', status: 'Pending'
  });

  const [saving, setSaving] = useState(false);
  const [isAutoGrading, setIsAutoGrading] = useState(false);

  // ข้อมูลสำหรับหน้ารายการปกติ
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

  // ข้อมูลสำหรับหน้าสรุปคะแนน (เรียงห้อง > เลขที่)
  const sortedSummaryData = useMemo(() => {
    return submissions
      .filter(s => s.grade === summaryGrade && s.activityType === summaryActivity)
      .sort((a, b) => {
        // เรียงตามห้องก่อน
        if (a.room !== b.room) return a.room.localeCompare(b.room);
        // เรียงตามเลขที่แบบตัวเลข
        return parseInt(a.studentNumber || '0') - parseInt(b.studentNumber || '0');
      });
  }, [submissions, summaryGrade, summaryActivity]);

  // Fix: Added updateRubricItem to update individual numeric scores and recalculate total
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

  const runAIScore = async (student: StudentSubmission) => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `คุณคือครู AI ผู้เชี่ยวชาญ ประเมินวิดีโอของ "${student.name}" 
      กิจกรรม: ${student.activityType === 'Sports Day' ? 'กีฬาสี' : 'วันเด็ก'} 
      ประเมินคะแนน 0-5 ในหัวข้อ Accuracy, Participation, Presentation, Discipline 
      เขียนคำชมภาษาไทยที่อบอุ่น (ใช้คำว่า หนู, นะลูก, จ๊ะ) และแนะนำสิ่งที่ควรพัฒนา 1 อย่าง
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
    return JSON.parse(response.text || '{}');
  };

  const handleAutoGrade = async () => {
    const currentStudent = submissions.find(s => s.rowId === editingId);
    if (!currentStudent) return;
    setIsAutoGrading(true);
    try {
      const aiResult = await runAIScore(currentStudent);
      const total = (aiResult.contentAccuracy || 0) + (aiResult.participation || 0) + (aiResult.presentation || 0) + (aiResult.discipline || 0);
      setRubric(prev => ({ 
        ...prev, ...aiResult, totalScore: total, 
        percentage: Math.round((total / 20) * 100),
        comment: `🤖 [AI]: ${aiResult.comment || ''}`
      }));
    } catch (e) { alert("AI ขัดข้องจ้า"); } finally { setIsAutoGrading(false); }
  };

  const handleSave = async () => {
    if (!editingId) return;
    setSaving(true);
    const sub = submissions.find(s => s.rowId === editingId);
    const success = await handleUpdateGrade(editingId, { ...rubric, status: 'Graded', activityType: sub?.activityType });
    if (success) { setEditingId(null); onUpdate(); }
    setSaving(false);
  };

  const PointSelector = ({ label, icon, current, onSelect }: { label: string, icon: string, current: number, onSelect: (v: number) => void }) => (
    <div className="bg-white p-4 rounded-2xl border-2 border-indigo-50 mb-2 shadow-sm">
      <div className="flex justify-between items-center mb-2">
        <span className="font-bold text-indigo-700 text-sm flex items-center gap-2"><span>{icon}</span> {label}</span>
        <span className="bg-indigo-100 text-indigo-600 px-3 py-0.5 rounded-full text-xs font-bold">{current}/5</span>
      </div>
      <div className="flex gap-1.5">
        {[0, 1, 2, 3, 4, 5].map(pt => (
          <button key={pt} onClick={() => onSelect(pt)} className={`flex-1 py-2 rounded-xl font-bold transition-all text-sm ${current === pt ? 'bg-indigo-500 text-white' : 'bg-gray-50 text-gray-400'}`}>{pt}</button>
        ))}
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* ส่วนหัวและการสลับโหมด */}
      <div className="bg-white rounded-[2.5rem] p-6 shadow-xl border-4 border-indigo-50">
        <div className="flex flex-col lg:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-4">
            <div className="text-5xl bg-indigo-100 p-4 rounded-3xl">👩‍🏫</div>
            <div>
              <h2 className="text-xl font-kids text-indigo-600">ยินดีต้อนรับคุณครู {teacherName}</h2>
              <div className="flex gap-2 mt-2">
                <button onClick={() => setViewMode('list')} className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${viewMode === 'list' ? 'bg-indigo-500 text-white shadow-md' : 'bg-indigo-50 text-indigo-400'}`}>📥 รายการตรวจงาน</button>
                <button onClick={() => setViewMode('summary')} className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${viewMode === 'summary' ? 'bg-indigo-500 text-white shadow-md' : 'bg-indigo-50 text-indigo-400'}`}>📊 สรุปคะแนนรวม</button>
              </div>
            </div>
          </div>
          {viewMode === 'list' && (
            <button onClick={() => {/* Bulk logic */}} className="bg-yellow-400 text-indigo-900 px-6 py-3 rounded-2xl font-bold shadow-lg hover:bg-yellow-300 transition-all flex items-center gap-2">
               <span>🪄</span> ตรวจอัตโนมัติทั้งหมด ({filteredSubmissions.filter(s => s.review?.status !== 'Graded').length})
            </button>
          )}
        </div>
      </div>

      {viewMode === 'summary' ? (
        <div className="bg-white p-8 rounded-[3rem] shadow-xl border-4 border-indigo-50 animate-in fade-in duration-500">
          <div className="flex flex-col md:flex-row justify-between items-end gap-4 mb-8">
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
            <button onClick={() => window.print()} className="bg-emerald-500 text-white px-8 py-3 rounded-2xl font-bold shadow-lg hover:bg-emerald-600 transition-all">พิมพ์รายงาน PDF 📄</button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-indigo-500 text-white">
                  <th className="p-4 text-center border border-indigo-600 rounded-tl-2xl">ห้อง</th>
                  <th className="p-4 text-center border border-indigo-600">เลขที่</th>
                  <th className="p-4 text-left border border-indigo-600">ชื่อ-นามสกุล</th>
                  <th className="p-4 text-center border border-indigo-600">คะแนน (20)</th>
                  <th className="p-4 text-center border border-indigo-600 rounded-tr-2xl">ร้อยละ</th>
                </tr>
              </thead>
              <tbody>
                {sortedSummaryData.length === 0 ? (
                  <tr><td colSpan={5} className="p-10 text-center text-gray-400 italic">ไม่พบข้อมูลนักเรียนในกลุ่มนี้จ้า</td></tr>
                ) : (
                  sortedSummaryData.map((s, idx) => (
                    <tr key={idx} className="hover:bg-indigo-50 transition-colors border-b border-gray-100">
                      <td className="p-4 text-center font-bold text-slate-500">{s.room.replace('Room ', '')}</td>
                      <td className="p-4 text-center font-bold text-slate-700">{s.studentNumber}</td>
                      <td className="p-4 text-left font-medium text-slate-600">{s.name}</td>
                      <td className="p-4 text-center font-black text-indigo-600">{s.review?.totalScore ?? '-'}</td>
                      <td className="p-4 text-center font-bold text-emerald-500">{s.review?.percentage ?? '-'}%</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <p className="mt-6 text-xs text-slate-400 italic text-center">* เรียงลำดับตามห้องและเลขที่เพื่อความสะดวกในการกรอกคะแนนครับคุณครู</p>
        </div>
      ) : (
        <>
          {/* ส่วนตัวกรองรายการ */}
          <div className="bg-white p-4 rounded-[2.5rem] shadow-sm border-2 border-indigo-50 flex flex-wrap gap-4 items-center">
            <div className="flex-1 min-w-[200px]">
              <input type="text" placeholder="ค้นหาชื่อหรือเลขที่..." value={filterText} onChange={e => setFilterText(e.target.value)} className="w-full p-3 rounded-2xl bg-slate-50 border-2 border-slate-100 outline-none focus:border-indigo-300 transition-all"/>
            </div>
            <select value={filterGrade} onChange={e => setFilterGrade(e.target.value)} className="p-3 rounded-2xl bg-white border-2 border-slate-100 font-bold outline-none">
              <option value="All">ทุกชั้น</option>
              <option value="Prathom 5">ป.5</option>
              <option value="Prathom 6">ป.6</option>
            </select>
            <select value={filterRoom} onChange={e => setFilterRoom(e.target.value)} className="p-3 rounded-2xl bg-white border-2 border-slate-100 font-bold outline-none">
              <option value="All">ทุกห้อง</option>
              {[1,2,3,4].map(r => <option key={r} value={`Room ${r}`}>ห้อง {r}</option>)}
            </select>
            <div className="flex bg-slate-100 p-1 rounded-2xl">
              <button onClick={() => setFilterStatus('All')} className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${filterStatus === 'All' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-400'}`}>ทั้งหมด</button>
              <button onClick={() => setFilterStatus('Pending')} className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${filterStatus === 'Pending' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-400'}`}>รอตรวจ</button>
            </div>
          </div>

          {/* รายการตรวจงาน */}
          <div className="grid gap-4">
            {filteredSubmissions.map((sub) => (
              <div key={sub.rowId} id={`editor-${sub.rowId}`} className={`p-5 rounded-[2.5rem] border-4 transition-all bg-white ${sub.review?.status === 'Graded' ? 'border-green-100' : 'border-indigo-50 shadow-md'}`}>
                <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                  <div className="flex items-center gap-4">
                    <div className="text-3xl bg-slate-50 p-3 rounded-2xl">{sub.activityType === 'Sports Day' ? '🏃' : '🎈'}</div>
                    <div>
                      <h4 className="font-bold text-slate-700">{sub.name} <span className="text-slate-400 text-sm ml-2">เลขที่ {sub.studentNumber}</span></h4>
                      <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">{sub.grade === 'Prathom 5' ? 'ป.5' : 'ป.6'} | {sub.room.replace('Room ', 'ห้อง ')}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <a href={sub.fileUrl} target="_blank" className="bg-indigo-100 text-indigo-600 px-5 py-2 rounded-xl font-bold text-xs hover:bg-indigo-200 transition-all">ดูวิดีโอ 📺</a>
                    <button onClick={() => {
                        setEditingId(sub.rowId!);
                        setRubric(sub.review || { contentAccuracy: 0, participation: 0, presentation: 0, discipline: 0, totalScore: 0, percentage: 0, comment: '', status: 'Pending' });
                    }} className={`px-5 py-2 rounded-xl font-bold text-xs transition-all ${sub.review?.status === 'Graded' ? 'bg-green-500 text-white' : 'bg-orange-400 text-white shadow-lg hover:scale-105'}`}>
                      {sub.review?.status === 'Graded' ? `ตรวจแล้ว (${sub.review.totalScore}/20)` : 'ให้คะแนน ✍️'}
                    </button>
                  </div>
                </div>

                {editingId === sub.rowId && (
                  <div className="mt-6 p-6 bg-indigo-50 rounded-[2rem] border-4 border-indigo-100 animate-in slide-in-from-top duration-300">
                    <div className="flex justify-between items-center mb-4">
                      <h5 className="font-kids text-indigo-700">ประเมินผลงานนักเรียน</h5>
                      <button onClick={handleAutoGrade} disabled={isAutoGrading} className="bg-yellow-400 text-indigo-900 px-4 py-1.5 rounded-xl font-black text-[10px] shadow-sm hover:scale-105 transition-all">
                        {isAutoGrading ? '🪄 AI กำลังวิเคราะห์...' : '🪄 ให้ AI ช่วยประเมินเบื้องต้น'}
                      </button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4">
                      <PointSelector label="ความถูกต้องของท่าทาง" icon="✅" current={rubric.contentAccuracy} onSelect={v => updateRubricItem('contentAccuracy', v)}/>
                      <PointSelector label="ความตั้งใจ/มุ่งมั่น" icon="🤝" current={rubric.participation} onSelect={v => updateRubricItem('participation', v)}/>
                      <PointSelector label="การนำเสนอ/สื่อสาร" icon="🎤" current={rubric.presentation} onSelect={v => updateRubricItem('presentation', v)}/>
                      <PointSelector label="วินัยและการแต่งกาย" icon="📏" current={rubric.discipline} onSelect={v => updateRubricItem('discipline', v)}/>
                    </div>
                    <div className="mt-4">
                      <label className="block text-[10px] font-black text-indigo-300 mb-1 ml-2 uppercase">คำติชมภาษาไทย (AI จะช่วยร่างให้)</label>
                      <textarea value={rubric.comment} onChange={e => setRubric({...rubric, comment: e.target.value})} className="w-full p-4 rounded-2xl h-20 border-2 border-indigo-100 outline-none text-xs bg-white focus:border-indigo-300" placeholder="หนูทำได้ดีมากจ๊ะลูก..."/>
                    </div>
                    <div className="flex gap-4 mt-6">
                      <button onClick={handleSave} disabled={saving} className="flex-1 bg-indigo-500 text-white py-4 rounded-2xl font-kids text-xl shadow-lg hover:scale-[1.02] active:scale-95 transition-all border-b-4 border-indigo-700">
                        {saving ? 'กำลังบันทึก...' : 'บันทึกคะแนนเรียบร้อย! 💾'}
                      </button>
                      <button onClick={() => setEditingId(null)} className="bg-white text-slate-400 px-6 py-4 rounded-2xl font-bold border-2 border-slate-100">ยกเลิก</button>
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
