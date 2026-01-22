
import React from 'react';

interface LoadingViewProps {
  studentName: string;
}

const LoadingView: React.FC<LoadingViewProps> = ({ studentName }) => {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="relative w-40 h-40 mb-8">
        <div className="absolute inset-0 bg-blue-200 rounded-full animate-ping opacity-75"></div>
        <div className="relative bg-blue-500 rounded-full w-40 h-40 flex items-center justify-center shadow-inner">
          <span className="text-6xl animate-bounce">📦</span>
        </div>
      </div>
      <h2 className="text-3xl font-bold text-blue-600 mb-2">Hang tight, {studentName}!</h2>
      <p className="text-xl text-gray-500">We are sending your super cool video to the teacher... 🌬️</p>
      
      <div className="mt-8 w-full bg-gray-100 rounded-full h-4 max-w-sm overflow-hidden border-2 border-blue-100">
        <div className="bg-blue-400 h-full w-full animate-[loading_3s_ease-in-out_infinite] origin-left"></div>
      </div>
      
      <style>{`
        @keyframes loading {
          0% { transform: scaleX(0); }
          50% { transform: scaleX(0.7); }
          100% { transform: scaleX(1); }
        }
      `}</style>
    </div>
  );
};

export default LoadingView;
