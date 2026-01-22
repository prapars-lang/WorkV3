
import React, { useState } from 'react';
import { StudentSubmission } from '../types';

interface SubmissionFormProps {
  onSubmit: (data: StudentSubmission) => void;
}

const SubmissionForm: React.FC<SubmissionFormProps> = ({ onSubmit }) => {
  const [formData, setFormData] = useState<StudentSubmission>({
    name: '',
    studentNumber: '',
    grade: 'Prathom 5',
    room: 'Room 1',
    activityType: 'Sports Day',
    videoFile: null
  });

  const [isHovering, setIsHovering] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.studentNumber || !formData.videoFile) {
      setErrorMessage("กรุณากรอกข้อมูลให้ครบถ้วนนะจ๊ะเด็กๆ ✨");
      return;
    }
    setErrorMessage(null);
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8 animate-in zoom-in duration-500">
      {errorMessage && (
        <div className="bg-red-50 border-2 border-red-200 text-red-600 p-4 rounded-2xl font-bold animate-in shake-x duration-300">
          ⚠️ {errorMessage}
        </div>
      )}

      {/* Activity Selection Menu */}
      <div className="space-y-4">
        <label className="block text-xl font-bold text-slate-700 text-center mb-4">หนูต้องการส่งงานกิจกรรมอะไรจ๊ะ? ✨</label>
        <div className="grid grid-cols-2 gap-4">
          <button
            type="button"
            onClick={() => setFormData({...formData, activityType: 'Sports Day'})}
            className={`p-6 rounded-[2rem] border-4 transition-all flex flex-col items-center gap-3 ${
              formData.activityType === 'Sports Day' 
              ? 'bg-orange-50 border-orange-400 scale-105 shadow-xl' 
              : 'bg-white border-slate-100 opacity-60 grayscale hover:grayscale-0'
            }`}
          >
            <span className="text-5xl">🏃</span>
            <span className={`font-bold text-lg ${formData.activityType === 'Sports Day' ? 'text-orange-600' : 'text-slate-500'}`}>งานกีฬาสี</span>
          </button>
          <button
            type="button"
            onClick={() => setFormData({...formData, activityType: 'Children Day'})}
            className={`p-6 rounded-[2rem] border-4 transition-all flex flex-col items-center gap-3 ${
              formData.activityType === 'Children Day' 
              ? 'bg-cyan-50 border-cyan-400 scale-105 shadow-xl' 
              : 'bg-white border-slate-100 opacity-60 grayscale hover:grayscale-0'
            }`}
          >
            <span className="text-5xl">🎈</span>
            <span className={`font-bold text-lg ${formData.activityType === 'Children Day' ? 'text-cyan-600' : 'text-slate-500'}`}>งานวันเด็ก</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="space-y-2">
          <label className="block text-lg font-bold text-slate-700 ml-2">ชื่อ-นามสกุล 🧒</label>
          <input
            type="text"
            required
            placeholder="เช่น เด็กชายสมชาย ใจดี"
            className="w-full px-6 py-4 rounded-3xl bg-white border-4 border-indigo-50 focus:border-indigo-300 focus:ring-0 outline-none transition-all text-lg shadow-inner"
            value={formData.name}
            onChange={e => setFormData({...formData, name: e.target.value})}
          />
        </div>

        <div className="space-y-2">
          <label className="block text-lg font-bold text-slate-700 ml-2">เลขที่ 🔢</label>
          <input
            type="number"
            required
            placeholder="เช่น 15"
            className="w-full px-6 py-4 rounded-3xl bg-white border-4 border-indigo-50 focus:border-indigo-300 outline-none transition-all text-lg shadow-inner"
            value={formData.studentNumber}
            onChange={e => setFormData({...formData, studentNumber: e.target.value})}
          />
        </div>

        <div className="space-y-2">
          <label className="block text-lg font-bold text-slate-700 ml-2">ระดับชั้น 🎒</label>
          <select
            className="w-full px-6 py-4 rounded-3xl bg-white border-4 border-pink-50 focus:border-pink-300 outline-none transition-all text-lg shadow-inner appearance-none cursor-pointer"
            value={formData.grade}
            onChange={e => setFormData({...formData, grade: e.target.value})}
          >
            <option value="Prathom 5">ประถมศึกษาปีที่ 5</option>
            <option value="Prathom 6">ประถมศึกษาปีที่ 6</option>
          </select>
        </div>

        <div className="space-y-2">
          <label className="block text-lg font-bold text-slate-700 ml-2">ห้อง 🏠</label>
          <select
            className="w-full px-6 py-4 rounded-3xl bg-white border-4 border-green-50 focus:border-green-300 outline-none transition-all text-lg shadow-inner appearance-none cursor-pointer"
            value={formData.room}
            onChange={e => setFormData({...formData, room: e.target.value})}
          >
            {[1, 2, 3, 4].map(r => (
              <option key={r} value={`Room ${r}`}>ห้อง {r}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-4">
        <label className="block text-lg font-bold text-slate-700 ml-2">อัปโหลดวิดีโอ 🎥</label>
        <div 
          className={`relative border-8 border-dashed rounded-[3rem] p-12 text-center transition-all cursor-pointer ${
            isHovering || formData.videoFile ? 'border-indigo-400 bg-indigo-50' : 'border-slate-200 bg-slate-50'
          }`}
          onDragOver={e => { e.preventDefault(); setIsHovering(true); }}
          onDragLeave={() => setIsHovering(false)}
          onDrop={e => {
            e.preventDefault();
            setIsHovering(false);
            if(e.dataTransfer.files[0]) setFormData({...formData, videoFile: e.dataTransfer.files[0]});
          }}
          onClick={() => document.getElementById('file-upload')?.click()}
        >
          <input 
            id="file-upload"
            type="file" 
            accept="video/*" 
            className="hidden" 
            onChange={e => e.target.files && setFormData({...formData, videoFile: e.target.files[0]})}
          />
          <div className="text-6xl mb-4 animate-bounce">
            {formData.videoFile ? '🎬' : '📤'}
          </div>
          <p className="text-xl font-bold text-slate-600">
            {formData.videoFile ? formData.videoFile.name : 'กดตรงนี้เพื่อเลือกวิดีโอ หรือลากไฟล์มาวางได้เลย!'}
          </p>
          <p className="text-sm text-slate-400 mt-2">(รับไฟล์วิดีโอทุกประเภท ขนาดไม่เกิน 100MB นะจ๊ะ)</p>
        </div>
      </div>

      <button
        type="submit"
        className={`w-full py-6 rounded-full text-white font-kids text-3xl shadow-xl hover:shadow-2xl hover:scale-[1.02] transition-all btn-bounce border-b-8 ${
          formData.activityType === 'Sports Day' 
          ? 'bg-gradient-to-r from-orange-400 to-red-500 border-orange-700' 
          : 'bg-gradient-to-r from-cyan-400 to-blue-500 border-cyan-700'
        }`}
      >
        ส่งงาน{formData.activityType === 'Sports Day' ? 'กีฬาสี' : 'วันเด็ก'}เลย! 🚀
      </button>
    </form>
  );
};

export default SubmissionForm;
