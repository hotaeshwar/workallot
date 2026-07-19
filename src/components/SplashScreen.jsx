import { useState, useEffect } from 'react';

export default function SplashScreen({ onFinish }) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const startTime = Date.now();
    const duration = 3000; // 3 seconds

    const timer = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const pct = Math.min(100, Math.floor((elapsed / duration) * 100));
      setProgress(pct);

      if (pct >= 100) {
        clearInterval(timer);
        setTimeout(() => {
          if (onFinish) onFinish();
        }, 150);
      }
    }, 30);

    return () => clearInterval(timer);
  }, [onFinish]);

  return (
    <div className="fixed inset-0 z-[999999] flex flex-col items-center justify-center bg-white text-slate-900 font-sans overflow-hidden select-none">
      {/* Background Soft Glow Orbs */}
      <div className="absolute top-1/4 left-1/3 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl animate-pulse"></div>
      <div className="absolute bottom-1/4 right-1/3 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl animate-pulse"></div>

      <div className="relative z-10 flex flex-col items-center max-w-sm w-full px-6 space-y-6 text-center">
        {/* Company Logo in White Card */}
        <div className="relative p-5 bg-white border border-slate-200/80 rounded-3xl shadow-xl shadow-indigo-500/10 transform transition duration-500 hover:scale-105">
          <img
            src="/LOGO.png"
            alt="Building India Digital"
            className="h-20 sm:h-24 md:h-28 w-auto object-contain drop-shadow-md"
          />
        </div>

        {/* Company Title & Portal Tagline */}
        <div className="space-y-1">
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-black tracking-tight text-slate-900">
            BUILDING INDIA DIGITAL
          </h1>
          <p className="text-xs sm:text-sm font-extrabold text-indigo-600 tracking-widest uppercase">
            Work Allocator Portal
          </p>
        </div>

        {/* 3-Second Animated Buffer Progress Bar */}
        <div className="w-full space-y-2 pt-4">
          <div className="w-full bg-slate-100 border border-slate-200 rounded-full h-3 overflow-hidden p-0.5 shadow-inner">
            <div
              className="h-full bg-gradient-to-r from-indigo-600 via-purple-600 to-emerald-500 rounded-full transition-all duration-100 ease-out shadow-sm"
              style={{ width: `${progress}%` }}
            ></div>
          </div>

          <div className="flex justify-between items-center text-xs font-mono text-slate-500">
            <span className="font-semibold text-slate-600">Loading Portal...</span>
            <span className="font-extrabold text-indigo-600">{progress}%</span>
          </div>
        </div>
      </div>
    </div>
  );
}
