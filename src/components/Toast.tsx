'use client';

import React from 'react';
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';

export interface ToastMessage {
  id: string;
  title?: string;
  text: string;
  type: 'success' | 'error' | 'info' | 'warning';
}

interface ToastProps {
  toasts: ToastMessage[];
  onClose?: (id: string) => void;
}

export const Toast: React.FC<ToastProps> = ({ toasts, onClose }) => {
  if (!toasts || toasts.length === 0) return null;

  return (
    <div className="toast-container" role="region" aria-label="الإشعارات والتنبيهات">
      {toasts.map((t) => (
        <div key={t.id} className={`toast ${t.type}`} role="alert">
          <div className="toast-icon-wrap">
            {t.type === 'success' && <CheckCircle2 size={20} />}
            {t.type === 'error' && <AlertCircle size={20} />}
            {t.type === 'warning' && <AlertTriangle size={20} />}
            {t.type === 'info' && <Info size={20} />}
          </div>

          <div className="toast-content">
            {t.title && <h4 className="toast-title">{t.title}</h4>}
            <p className="toast-text">{t.text}</p>
          </div>

          {onClose && (
            <button
              type="button"
              className="toast-close-btn"
              onClick={() => onClose(t.id)}
              aria-label="إغلاق التنبيه"
            >
              <X size={15} />
            </button>
          )}
        </div>
      ))}
    </div>
  );
};
