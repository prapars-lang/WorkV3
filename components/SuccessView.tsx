
import React, { useEffect } from 'react';
import confetti from 'https://cdn.skypack.dev/canvas-confetti';

interface SuccessViewProps {
  onReset: () => void;
}

const SuccessView: React.FC<SuccessViewProps> = ({ onReset }) => {
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

  return (
    <div className="flex flex-col items-center justify-center py-10 text-center">
      <div className="text-9xl mb-8 animate-bounce">🥳</div>
      <h2 className="text-4xl font-kids text-green-600 mb-4">YOU DID IT!</h2>
      <p className="text-2xl text-gray-600 mb-10 max-w-md">
        Your video was sent successfully! Your teacher will be so happy! 🌈
      </p>
      <button 
        onClick={onReset}
        className="bg-green-500 hover:bg-green-600 text-white font-bold py-6 px-12 rounded-full text-2xl transition-all transform hover:scale-105 active:scale-95 shadow-xl border-b-8 border-green-700"
      >
        SEND ANOTHER ONE? 🔄
      </button>
    </div>
  );
};

export default SuccessView;
