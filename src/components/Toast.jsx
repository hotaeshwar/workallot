import { useState, useEffect } from 'react';
import { CheckCircle, AlertCircle, Info, AlertTriangle, X } from 'lucide-react';

let toastListener = null;

export const showToast = (message, type = 'success', duration = 3500) => {
  if (toastListener) {
    toastListener({ id: Date.now() + Math.random(), message, type, duration });
  }
};

export default function ToastContainer() {
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    toastListener = (newToast) => {
      setToasts((prev) => [...prev, newToast]);

      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== newToast.id));
      }, newToast.duration);
    };

    return () => {
      toastListener = null;
    };
  }, []);

  const removeToast = (id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-5 right-5 z-[99999] flex flex-col space-y-3 max-w-sm w-full pointer-events-none px-4 sm:px-0">
      {toasts.map((toast) => {
        const isSuccess = toast.type === 'success';
        const isError = toast.type === 'error';
        const isWarning = toast.type === 'warning';

        return (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-center justify-between p-3.5 rounded-2xl shadow-2xl border transition-all duration-300 transform translate-y-0 opacity-100 ${
              isSuccess ? 'bg-slate-900/95 border-emerald-500/40 text-white' :
              isError ? 'bg-slate-900/95 border-rose-500/40 text-white' :
              isWarning ? 'bg-slate-900/95 border-amber-500/40 text-white' :
              'bg-slate-900/95 border-indigo-500/40 text-white'
            }`}
          >
            <div className="flex items-center space-x-3 pr-2">
              <div className={`p-1.5 rounded-xl shrink-0 ${
                isSuccess ? 'bg-emerald-500/20 text-emerald-400' :
                isError ? 'bg-rose-500/20 text-rose-400' :
                isWarning ? 'bg-amber-500/20 text-amber-400' :
                'bg-indigo-500/20 text-indigo-400'
              }`}>
                {isSuccess && <CheckCircle className="h-4.5 w-4.5" />}
                {isError && <AlertCircle className="h-4.5 w-4.5" />}
                {isWarning && <AlertTriangle className="h-4.5 w-4.5" />}
                {!isSuccess && !isError && !isWarning && <Info className="h-4.5 w-4.5" />}
              </div>
              <span className="text-xs font-semibold leading-snug">{toast.message}</span>
            </div>

            <button
              onClick={() => removeToast(toast.id)}
              className="p-1 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg transition cursor-pointer shrink-0"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
