
import React, { useState, useMemo, useEffect } from 'react';
import { StudentSubmission } from '../types';

interface ResultCheckerProps {
  submissions: StudentSubmission[];
  refreshData?: () => void;
}

const ResultChecker: React.FC<ResultCheckerProps> = ({ submissions, refreshData }) => {
  const [searchName, setSearchName] = useState('');
  const [searchGrade, setSearchGrade] = useState('Prathom 5');
  const [searchRoom, setSearchRoom] = useState('Room 1');
  const [searchActivity, setSearchActivity] = useState<'Sports Day' | 'Children Day'>('Sports Day');
  const [hasSearched, setHasSearched] = useState(false);

  const result = useMemo(() => {
    if (!hasSearched) return null;
    return submissions.find(s => 
      s.name.toLowerCase().includes(searchName.toLowerCase().trim()) && 
      s.grade === searchGrade && 
      s.room === searchRoom &&
      s.activityType === searchActivity
    );
  }, [submissions, searchName, searchGrade, searchRoom, searchActivity, hasSearched]);

  useEffect(() => {
    let interval: number;
    if (hasSearched && result && !result.review && refreshData) {
      interval = window.setInterval(() => {
        refreshData();
      }, 20000);
    }
    return () => clearInterval(interval);
  }, [hasSearched, result, refreshData]);

  return (
    <div className="max-w-2xl mx-auto space-y-8 py-4">
      <div className="text-center animate-in fade-in slide-in-from-top duration-700">
        <div className="text-7xl mb-4">🔍</div>
        <h2 className="text-4xl font-kids text-yellow-600">ค้นหาคะแนนของหนู</h2>
        <p className="text-gray-500 font-bold italic">"พิมพ์ชื่อของหนูเพื่อดูผลงานและคำชมจากคุณครูนะจ๊ะ"</p>
      </div>

      <div className="bg-yellow-50 p-8 rounded-[3rem] border-4 border-yellow-200 shadow-xl space-y-6">
        <div className="space-y-4">
          <label className="block text-sm font-bold text-yellow-700 ml-2">หนูต้องการดูคะแนนของกิจกรรมอะไรจ๊ะ?</label>
          <div className="flex gap-4">
            <button 
              onClick={() => { setSearchActivity('Sports Day'); setHasSearched(false); }}
              className={`flex-1 py-3 rounded-2xl font-bold transition-all border-4 ${searchActivity === 'Sports Day' ? 'bg-orange-500 text-white border-orange-200 shadow-lg' : 'bg-white text-orange-400 border-slate-50'}`}
            >
              🏃 กีฬาสี
            </button>
            <button 
              onClick={() => { setSearchActivity('Children Day'); setHasSearched(false); }}
              className={`flex-1 py-3 rounded-2xl font-bold transition-all border-4 ${searchActivity === 'Children Day' ? 'bg-cyan-500 text-white border-cyan-200 shadow-lg' : 'bg-white text-cyan-400 border-slate-50'}`}
            >
              🎈 วันเด็ก
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4">
          <div>
            <label className="block text-sm font-bold text-yellow-700 mb-2 ml-2">พิมพ์ชื่อ-นามสกุล ของหนู 🧑‍🎓</label>
            <input 
              type="text" 
              value={searchName}
              onChange={(e) => { setSearchName(e.target.value); setHasSearched(false); }}
              className="w-full p-4 rounded-2xl bg-white border-2 border-yellow-200 outline-none text-xl font-bold text-yellow-700 focus:border-yellow-400 shadow-inner"
              placeholder="พิมพ์ชื่อของหนูที่นี่..."
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-yellow-700 mb-2 ml-2">ระดับชั้น</label>
              <select 
                value={searchGrade}
                onChange={(e) => { setSearchGrade(e.target.value); setHasSearched(false); }}
                className="w-full p-4 rounded-2xl bg-white border-2 border-yellow-200 outline-none font-bold shadow-inner"
              >
                <option value="Prathom 5">ป.5</option>
                <option value="Prathom 6">ป.6</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-bold text-yellow-700 mb-2 ml-2">ห้อง</label>
              <select 
                value={searchRoom}
                onChange={(e) => { setSearchRoom(e.target.value); setHasSearched(false); }}
                className="w-full p-4 rounded-2xl bg-white border-2 border-yellow-200 outline-none font-bold shadow-inner"
              >
                {[1,2,3,4].map(r => <option key={r} value={`Room ${r}`}>ห้อง {r}</option>)}
              </select>
            </div>
          </div>
        </div>
        <button 
          onClick={() => setHasSearched(true)}
          className={`w-full text-white font-kids text-2xl py-5 rounded-2xl shadow-xl transition-all border-b-8 active:border-b-0 active:translate-y-1 ${
            searchActivity === 'Sports Day' ? 'bg-orange-500 border-orange-700 hover:bg-orange-600' : 'bg-cyan-500 border-cyan-700 hover:bg-cyan-600'
          }`}
        >
          ค้นหาคะแนนของฉัน! ✨
        </button>
      </div>

      {hasSearched && (
        <div className="animate-in fade-in zoom-in duration-500">
          {!result ? (
            <div className="text-center p-12 bg-white rounded-[3rem] border-4 border-dashed border-gray-200">
              <p className="text-6xl mb-4">🏜️</p>
              <p className="text-xl text-gray-400 font-bold">ไม่พบข้อมูลชื่อ "{searchName}" จ้า... หนูส่งวิดีโอหรือยังจ๊ะ?</p>
            </div>
          ) : !result.review ? (
            <div className="text-center p-12 bg-blue-50 rounded-[3rem] border-4 border-blue-200">
              <p className="text-6xl mb-4">🎬</p>
              <p className="text-2xl text-blue-600 font-bold">คุณครูได้รับวิดีโอแล้ว!</p>
              <p className="text-blue-400 font-bold mt-2">กำลังรอคุณครูตรวจอยู่นะจ๊ะ ✨</p>
            </div>
          ) : (
            <div className={`bg-white p-10 rounded-[4rem] border-8 shadow-2xl relative overflow-hidden ${searchActivity === 'Sports Day' ? 'border-orange-200' : 'border-cyan-200'}`}>
              <div className="absolute top-0 right-0 p-8 text-7xl opacity-20">{searchActivity === 'Sports Day' ? '🏃' : '🎈'}</div>
              <h3 className="text-3xl font-kids text-indigo-600 mb-6">เก่งมากเลย {result.name}!</h3>
              <div className="grid grid-cols-2 gap-4 mb-8">
                <div className="bg-indigo-50 p-6 rounded-3xl text-center shadow-inner border border-indigo-100">
                  <p className="text-xs font-bold text-indigo-400 uppercase">คะแนนที่ได้</p>
                  <p className="text-5xl font-kids text-indigo-600">{result.review.totalScore}/20</p>
                </div>
                <div className="bg-indigo-50 p-6 rounded-3xl text-center shadow-inner border border-indigo-100">
                  <p className="text-xs font-bold text-indigo-400 uppercase">คิดเป็นร้อยละ</p>
                  <p className="text-5xl font-kids text-indigo-600">{result.review.percentage}%</p>
                </div>
              </div>
              <div className="space-y-4">
                <p className="text-sm font-bold text-indigo-500 uppercase tracking-widest ml-2">คำแนะนำจากคุณครู 💬</p>
                <div className="bg-yellow-50 p-8 rounded-[2rem] border-l-8 border-yellow-400 italic text-xl text-gray-700 leading-relaxed shadow-inner">
                  "{result.review.comment}"
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ResultChecker;
