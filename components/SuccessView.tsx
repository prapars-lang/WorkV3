import React, { useEffect, useState } from 'react';
import confetti from 'https://cdn.skypack.dev/canvas-confetti';

interface SuccessViewProps {
  onReset: () => void;
  shareUrl?: string;
}

const SuccessView: React.FC<SuccessViewProps> = ({ onReset, shareUrl }) => {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    // Fire confetti when component mounts
    const duration = 3 * 1000;
    const animationEnd = Date.now() + duration;
    const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0 };

    function randomInRange(min: number, max: number) {
      return Math.random() * (max - min) + min;
    }

    const interval: any = setInterval(function() {
      const timeLeft = animationEnd - Date.now();

      if (timeLeft <= 0) {
        return clearInterval(interval);
      }

      const particleCount = 50 * (timeLeft / duration);
      // since particles fall down, start a bit higher than random
      confetti(Object.assign({}, defaults, { particleCount, origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 } }));
      confetti(Object.assign({}, defaults, { particleCount, origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 } }));
    }, 250);

    return () => clearInterval(interval);
  }, []);

  const handleShare = async () => {
    if (!shareUrl) return;

    if (navigator.share) {
      try {
        await navigator.share({
          title: 'ผลงานวิดีโอของฉัน! 🎬',
          text: 'ดูวิดีโอกิจกรรมวิชาสุขศึกษาและพลศึกษาของฉันได้ที่นี่นะจ๊ะ! 🌈',
          url: shareUrl,
        });
      } catch (err) {
        console.error('Error sharing:', err);
      }
    } else {
      // Fallback: Copy to clipboard
      try {
        await navigator.clipboard.writeText(shareUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 3000);
      } catch (err) {
        alert('คัดลอกลิงก์ไม่ได้จ้า: ' + shareUrl);
      }
    }
  };

  return (
    <div className="flex flex-col items-center justify-center py-10 text-center animate-in zoom-in duration-700">
      <div className="text-9xl mb-8 animate-bounce">🥳</div>
      <h2 className="text-5xl font-kids text-green-600 mb-4 drop-shadow-md">เก่งที่สุดเลย!</h2>
      <p className="text-2xl font-bold text-gray-600 mb-10 max-w-md leading-relaxed">
        หนูส่งวิดีโอเรียบร้อยแล้วจ๊ะ! คุณครูรอชมผลงานของหนูอยู่นะจ๊ะ 🌈✨
      </p>

      <div className="flex flex-col gap-4 w-full max-w-sm">
        {shareUrl && (
          <div className="relative">
            <button 
              onClick={handleShare}
              className="w-full bg-gradient-to-r from-pink-400 to-purple-500 hover:from-pink-500 hover:to-purple-600 text-white font-kids text-2xl py-6 px-12 rounded-[2.5rem] transition-all transform hover:scale-105 active:scale-95 shadow-xl border-b-8 border-purple-700 flex items-center justify-center gap-3"
            >
              <span className="text-3xl">🎁</span>
              <span>แชร์ผลงานให้เพื่อนดู!</span>
            </button>
            
            {copied && (
              <div className="absolute -top-12 left-1/2 transform -translate-x-1/2 bg-slate-800 text-white text-xs font-bold py-2 px-4 rounded-full shadow-lg animate-in fade-in slide-in-from-bottom-2 duration-300">
                คัดลอกลิงก์แล้วจ้า! ✅
              </div>
            )}
          </div>
        )}

        <button 
          onClick={onReset}
          className="w-full bg-white text-green-600 border-4 border-green-200 hover:bg-green-50 font-bold py-5 px-12 rounded-[2.5rem] text-xl transition-all transform hover:scale-102 active:scale-98 shadow-md"
        >
          ส่งงานกิจกรรมอื่นเพิ่ม 🔄
        </button>
      </div>

      <p className="mt-12 text-slate-400 font-bold italic text-sm">
        "ความพยายามของหนูคือความภูมิใจของคุณครูนะจ๊ะ"
      </p>
    </div>
  );
};

export default SuccessView;
