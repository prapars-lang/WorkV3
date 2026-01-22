
import React, { useState, useMemo } from 'react';
import { StudentSubmission } from '../types';

interface VideoGalleryProps {
  submissions: StudentSubmission[];
}

type SortOption = 'latest' | 'oldest' | 'score-high' | 'score-low';

const VideoGallery: React.FC<VideoGalleryProps> = ({ submissions }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [gradeFilter, setGradeFilter] = useState('All');
  const [roomFilter, setRoomFilter] = useState('All');
  const [activityFilter, setActivityFilter] = useState('All');
  const [sortBy, setSortBy] = useState<SortOption>('latest');

  const processedSubmissions = useMemo(() => {
    let result = [...submissions];

    // 1. Filtering
    result = result.filter(sub => {
      const matchesSearch = sub.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                           sub.studentNumber.includes(searchTerm);
      const matchesGrade = gradeFilter === 'All' || sub.grade === gradeFilter;
      const matchesRoom = roomFilter === 'All' || sub.room === roomFilter;
      const matchesActivity = activityFilter === 'All' || sub.activityType === activityFilter;
      return matchesSearch && matchesGrade && matchesRoom && matchesActivity;
    });

    // 2. Sorting
    result.sort((a, b) => {
      if (sortBy === 'latest') return (b.rowId || 0) - (a.rowId || 0);
      if (sortBy === 'oldest') return (a.rowId || 0) - (b.rowId || 0);
      if (sortBy === 'score-high') {
        const scoreA = a.review?.totalScore ?? -1;
        const scoreB = b.review?.totalScore ?? -1;
        return scoreB - scoreA;
      }
      if (sortBy === 'score-low') {
        const scoreA = a.review?.totalScore ?? 100;
        const scoreB = b.review?.totalScore ?? 100;
        return scoreA - scoreB;
      }
      return 0;
    });

    return result;
  }, [submissions, searchTerm, gradeFilter, roomFilter, activityFilter, sortBy]);

  return (
    <div className="space-y-10">
      <div className="text-center">
        <h2 className="text-4xl font-kids text-pink-500 mb-2">โรงภาพยนตร์กิจกรรมโรงเรียน 🎬</h2>
        <p className="text-gray-500 font-bold">รวมผลงานวิดีโอสุดเจ๋งจากเพื่อนๆ!</p>
      </div>

      {/* Control Center */}
      <div className="bg-pink-50/50 p-6 rounded-[2.5rem] border-4 border-pink-100/50 shadow-sm space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="relative">
            <label className="block text-xs font-bold text-pink-400 uppercase mb-2 ml-2">ค้นหาเพื่อนๆ</label>
            <input 
              type="text" 
              placeholder="ชื่อหรือเลขที่..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full p-3 pl-10 rounded-2xl bg-white border-2 border-pink-100 focus:border-pink-400 outline-none font-bold text-pink-600 transition-all shadow-sm"
            />
            <span className="absolute left-3 top-[38px] text-pink-300 text-lg">🔍</span>
          </div>

          <div>
            <label className="block text-xs font-bold text-pink-400 uppercase mb-2 ml-2">ประเภทกิจกรรม</label>
            <select 
              value={activityFilter}
              onChange={(e) => setActivityFilter(e.target.value)}
              className="w-full p-3 rounded-2xl bg-white border-2 border-pink-100 outline-none font-bold text-gray-600 cursor-pointer hover:border-pink-300 transition-all shadow-sm"
            >
              <option value="All">ทุกกิจกรรม</option>
              <option value="Sports Day">งานกีฬาสี 🏃</option>
              <option value="Children Day">งานวันเด็ก 🎈</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-pink-400 uppercase mb-2 ml-2">เรียงลำดับ</label>
            <select 
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="w-full p-3 rounded-2xl bg-white border-2 border-pink-100 outline-none font-bold text-gray-600 cursor-pointer hover:border-pink-300 transition-all shadow-sm"
            >
              <option value="latest">ส่งล่าสุด 🆕</option>
              <option value="oldest">ส่งแรกๆ ⏳</option>
              <option value="score-high">คะแนนสูงสุด ⭐</option>
              <option value="score-low">คะแนนน้อยสุด 📉</option>
            </select>
          </div>
        </div>
      </div>

      {processedSubmissions.length === 0 ? (
        <div className="text-center py-20 bg-pink-50/30 rounded-[3rem] border-4 border-dashed border-pink-100 flex flex-col items-center justify-center">
          <p className="text-8xl mb-6 grayscale opacity-50">🏜️</p>
          <p className="text-2xl text-pink-300 font-bold italic mb-2">
            ไม่พบวิดีโอที่คุณค้นหา...
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {processedSubmissions.map((sub, idx) => {
            const isTopStar = sub.review && sub.review.totalScore >= 18;
            const isGraded = sub.review?.status === 'Graded';
            const isSports = sub.activityType === 'Sports Day';
            
            return (
              <div 
                key={sub.rowId || idx} 
                className={`group relative bg-white rounded-[2.5rem] overflow-hidden shadow-xl border-4 transition-all hover:-translate-y-3 hover:shadow-2xl flex flex-col ${
                  isTopStar ? 'border-yellow-300 ring-4 ring-yellow-100' : 'border-pink-100 hover:border-pink-300'
                }`}
              >
                {/* Badge for Activity Type */}
                <div className={`absolute top-4 left-4 z-10 px-4 py-1.5 rounded-full text-[10px] font-bold shadow-lg flex items-center gap-1 ${
                  isSports ? 'bg-orange-500 text-white' : 'bg-cyan-500 text-white'
                }`}>
                  {isSports ? '🏃 กีฬาสี' : '🎈 วันเด็ก'}
                </div>

                {isGraded && (
                  <div className="absolute top-4 right-4 z-10 bg-white/90 backdrop-blur-sm text-pink-600 px-3 py-1.5 rounded-2xl text-sm font-black shadow-md border border-pink-100">
                    {sub.review?.totalScore}/20 🏆
                  </div>
                )}

                <div className={`${isTopStar ? 'bg-yellow-400' : isSports ? 'bg-orange-400' : 'bg-cyan-400'} h-40 flex items-center justify-center relative overflow-hidden shrink-0`}>
                  <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle,white_1px,transparent_1px)] bg-[length:10px_10px]"></div>
                  <span className="text-6xl group-hover:scale-125 transition-transform duration-700 ease-out">
                    {isTopStar ? '🌟' : isSports ? '🏃' : '🎈'}
                  </span>
                </div>

                <div className="p-6 text-center flex-grow flex flex-col">
                  <h3 className="text-xl font-bold text-gray-800 mb-1 truncate px-2">{sub.name}</h3>
                  <div className="flex justify-center gap-2 mb-4">
                    <span className="bg-blue-100 text-blue-600 px-3 py-0.5 rounded-xl text-[10px] font-bold">
                      {sub.grade === 'Prathom 5' ? 'ป.5' : 'ป.6'}
                    </span>
                    <span className="bg-green-100 text-green-600 px-3 py-0.5 rounded-xl text-[10px] font-bold">
                      {sub.room.replace('Room ', 'ห้อง ')}
                    </span>
                  </div>

                  {isGraded && sub.review?.comment && (
                    <div className="mb-6 p-4 bg-indigo-50/50 rounded-2xl border-2 border-indigo-100/50 text-xs text-slate-600 italic relative text-left line-clamp-3">
                       <span className="text-indigo-400 font-bold not-italic block mb-1 text-[10px] uppercase tracking-wider">💌 ข้อความจากคุณครู:</span>
                       "{sub.review.comment}"
                    </div>
                  )}

                  <div className="mt-auto">
                    <a 
                      href={sub.fileUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className={`inline-block w-full text-white font-kids text-lg py-3 rounded-2xl shadow-lg transition-all border-b-8 active:border-b-0 active:translate-y-2 active:shadow-none ${
                        isTopStar ? 'bg-yellow-500 hover:bg-yellow-600 border-yellow-700' : 
                        isSports ? 'bg-orange-500 hover:bg-orange-600 border-orange-700' :
                        'bg-cyan-500 hover:bg-cyan-600 border-cyan-700'
                      }`}
                    >
                      เปิดดูวิดีโอ 📺
                    </a>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default VideoGallery;
