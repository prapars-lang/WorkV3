
import React, { useState, useCallback, useEffect } from 'react';
import { GoogleGenAI } from "@google/genai";
import confetti from "canvas-confetti";
import SubmissionForm from './components/SubmissionForm.tsx';
import SuccessView from './components/SuccessView.tsx';
import LoadingView from './components/LoadingView.tsx';
import TeacherView from './components/TeacherView.tsx';
import TeacherLogin from './components/TeacherLogin.tsx';
import DashboardView from './components/DashboardView.tsx';
import VideoGallery from './components/VideoGallery.tsx';
import ResultChecker from './components/ResultChecker.tsx';
import Navigation from './components/Navigation.tsx';
import { AppStatus, AppView, StudentSubmission, RubricReview } from './types.ts';

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<AppView>(AppView.STUDENT);
  const [status, setStatus] = useState<AppStatus>(AppStatus.IDLE);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [loginError, setLoginError] = useState<string>('');
  const [lastSubmissionName, setLastSubmissionName] = useState<string>('');
  const [submissions, setSubmissions] = useState<StudentSubmission[]>([]);
  const [isTeacher, setIsTeacher] = useState(false);
  const [teacherName, setTeacherName] = useState('');
  const [rubricCriteria, setRubricCriteria] = useState<any[]>([]);
  
  const gasUrl = 'https://script.google.com/macros/s/AKfycbwt_PZNAxiM5j21McfSrUts-4y_vqoF1vb0fwRHQ3PEwG9jJPH1gM7eUw1PRaxhnDdB_Q/exec';

  const fetchAPI = async (action: string, data: any = {}) => {
    try {
      const response = await fetch(gasUrl, {
        method: 'POST',
        mode: 'cors',
        body: JSON.stringify({ action, data })
      });
      return await response.json();
    } catch (e) {
      console.error("API Error:", e);
      return null;
    }
  };

  const fetchSubmissions = useCallback(async (silent = false) => {
    if (!silent) setStatus(AppStatus.LOADING_DATA);
    const res = await fetchAPI('list');
    if (res && res.success) {
      setSubmissions(res.data || []);
    }
    setStatus(AppStatus.IDLE);
  }, []);

  const fetchRubric = useCallback(async () => {
    const res = await fetchAPI('get_rubric');
    if (res && res.success) {
      setRubricCriteria(res.data || []);
    }
  }, []);

  useEffect(() => {
    fetchSubmissions();
    fetchRubric();
  }, [fetchSubmissions, fetchRubric]);

  const handleSubmit = async (data: StudentSubmission) => {
    if (!data.videoFile) return;
    setStatus(AppStatus.UPLOADING);
    setLastSubmissionName(data.name);

    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const base64Data = e.target?.result?.toString().split(',')[1];
        const res = await fetchAPI('upload', {
          ...data,
          fileData: base64Data,
          fileName: data.videoFile?.name,
          mimeType: data.videoFile?.type
        });

        if (res && res.success) {
          setStatus(AppStatus.SUCCESS);
          confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
          fetchSubmissions(true);
        } else {
          setErrorMessage(res?.message || "เกิดข้อผิดพลาดในการอัปโหลด");
          setStatus(AppStatus.ERROR);
        }
      };
      reader.readAsDataURL(data.videoFile);
    } catch (err) {
      setErrorMessage("ระบบขัดข้อง กรุณาลองใหม่อีกครั้ง");
      setStatus(AppStatus.ERROR);
    }
  };

  const handleUpdateGrade = async (rowId: number, rubricData: any) => {
    const res = await fetchAPI('grade', { rowId, ...rubricData });
    if (res && res.success) {
      fetchSubmissions(true);
      return true;
    }
    return false;
  };

  const generateAIFeedback = async (studentName: string, rubric: RubricReview) => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const prompt = `คุณเป็นคุณครูระดับประถมที่ใจดีมาก กำลังเขียนคำชมและคำแนะนำให้นักเรียนชื่อ "${studentName}" 
    ที่ได้คะแนนรวม ${rubric.totalScore}/20 จากการร่วมกิจกรรมในวิชาสุขศึกษาและพลศึกษา 
    เขียนสั้นๆ 2-3 ประโยคให้นักเรียนรู้สึกมีกำลังใจและภูมิใจในตัวเองเป็นภาษาไทย`;

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt
      });
      return response.text || "ทำได้ดีมากจ๊ะ!";
    } catch (e) {
      return "ผลงานหนูยอดเยี่ยมมากจ๊ะ ตั้งใจพัฒนาต่อไปนะ!";
    }
  };

  const handleTeacherLogin = async (user: string, pin: string) => {
    setLoginError('');
    setStatus(AppStatus.LOADING_DATA);
    const res = await fetchAPI('login', { username: user, pin: pin });
    setStatus(AppStatus.IDLE);
    
    if(res && res.success) {
      setIsTeacher(true);
      setTeacherName(res.teacherName);
      setCurrentView(AppView.TEACHER);
    } else {
      setLoginError(res?.message || "ชื่อผู้ใช้หรือรหัส PIN ไม่ถูกต้องจ้า 🔐");
    }
  };

  return (
    <div className="min-h-screen pb-12">
      {/* Dynamic Header with Pastel Gradient */}
      <header className="w-full h-[60px] bg-white/40 backdrop-blur-md border-b-2 border-white shadow-sm flex items-center px-4 md:px-8 sticky top-0 z-[100]">
        <div className="max-w-6xl mx-auto w-full flex justify-between items-center">
          <div 
            className="flex items-center gap-2 cursor-pointer group"
            onClick={() => setCurrentView(AppView.STUDENT)}
          >
            <div className="bg-white/80 p-1.5 rounded-2xl shadow-sm transform group-hover:rotate-12 transition-transform">
              <img 
                src="https://img2.pic.in.th/-23.png" 
                alt="Logo" 
                className="h-7 md:h-8 w-auto" 
              />
            </div>
            <h1 className="text-base md:text-lg font-kids font-bold text-slate-700 flex items-center gap-2">
              วิชา <span className="rainbow-text">สุขศึกษาและพลศึกษา</span>
            </h1>
          </div>
          
          <div className="flex items-center gap-3">
             <div className="hidden sm:flex items-center gap-2 bg-white/60 px-3 py-1 rounded-full border border-white/80 text-[10px] font-bold text-slate-500 uppercase">
               🏃 Health and Physical Education
             </div>
             <div className="flex gap-2">
               <span className="animate-bounce text-xl">⛹️</span>
             </div>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 mt-8">
        <div className="text-center mb-8 animate-in fade-in slide-in-from-top duration-700">
           <h2 className="text-3xl md:text-4xl font-kids text-slate-700 mb-1 drop-shadow-sm">ยินดีต้อนรับนะจ๊ะเด็กๆ! 🌈</h2>
           <p className="text-slate-500 font-bold text-sm bg-white/30 inline-block px-4 py-1 rounded-full backdrop-blur-sm">ระบบส่งงานวิชาสุขศึกษาและพลศึกษา</p>
        </div>

        <Navigation currentView={currentView} setView={setCurrentView} />

        <main className="glass-morphism rounded-[2.5rem] md:rounded-[3.5rem] p-6 md:p-12 min-h-[600px] transition-all duration-500 relative overflow-hidden">
          {currentView === AppView.STUDENT && (
            <div className="relative z-10">
              {status === AppStatus.IDLE && <SubmissionForm onSubmit={handleSubmit} />}
              {status === AppStatus.UPLOADING && <LoadingView studentName={lastSubmissionName} />}
              {status === AppStatus.SUCCESS && <SuccessView onReset={() => setStatus(AppStatus.IDLE)} />}
              {status === AppStatus.ERROR && (
                <div className="text-center p-12">
                  <div className="text-8xl mb-6 text-red-400">😢</div>
                  <h2 className="text-4xl font-kids text-red-500 mb-4">โอ๊ะโอ! มีบางอย่างผิดปกติจ้า</h2>
                  <p className="text-slate-500 mb-10 text-xl">{errorMessage}</p>
                  <button 
                    onClick={() => setStatus(AppStatus.IDLE)} 
                    className="bg-indigo-500 text-white px-12 py-5 rounded-full font-bold shadow-2xl hover:bg-indigo-600 transition-all transform hover:scale-110 active:scale-95 text-xl"
                  >
                    ลองใหมีกครั้งนะจ๊ะเด็กๆ 🔄
                  </button>
                </div>
              )}
            </div>
          )}

          {currentView === AppView.RESULT && <ResultChecker submissions={submissions} refreshData={() => fetchSubmissions(true)} />}
          {currentView === AppView.GALLERY && <VideoGallery submissions={submissions} />}
          {currentView === AppView.TEACHER_LOGIN && (
            <TeacherLogin 
              onLogin={handleTeacherLogin} 
              loginError={loginError}
            />
          )}
          {currentView === AppView.TEACHER && isTeacher && (
            <TeacherView 
              submissions={submissions} 
              teacherName={teacherName} 
              onUpdate={fetchSubmissions}
              handleUpdateGrade={handleUpdateGrade}
              rubricCriteria={rubricCriteria}
              onGenerateAIFeedback={generateAIFeedback}
            />
          )}
          {status === AppStatus.IDLE && currentView === AppView.DASHBOARD && <DashboardView submissions={submissions} />}
        </main>

        <footer className="mt-16 text-center">
          <div className="inline-flex flex-col items-center gap-3 bg-white/40 backdrop-blur-md px-10 py-5 rounded-[2rem] border-2 border-white shadow-sm">
            <p className="text-slate-500 font-bold text-sm md:text-base">
              © 2025 สุขศึกษาและพลศึกษา | Krukaihuo
            </p>
          </div>
        </footer>
      </div>
    </div>
  );
};

export default App;
