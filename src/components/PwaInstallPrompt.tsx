'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Smartphone, Download, X, Share, PlusSquare, CheckCircle2 } from 'lucide-react';

export const PwaInstallPrompt: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const deferredPromptRef = useRef<any>(null);
  const [isStandalone, setIsStandalone] = useState<boolean>(false);
  const [isIos, setIsIos] = useState<boolean>(false);
  const [showIosModal, setShowIosModal] = useState<boolean>(false);
  const [showBanner, setShowBanner] = useState<boolean>(false);
  const [isInstalled, setIsInstalled] = useState<boolean>(false);

  useEffect(() => {
    // Check if running in standalone mode (already installed)
    const checkStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true;

    setIsStandalone(checkStandalone);

    // Detect iOS
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIos(isIosDevice);

    // Check if dismissed in this session
    const dismissed = sessionStorage.getItem('pwa_prompt_dismissed');

    // Listen for Chrome / Android / Edge / Desktop PWA install prompt
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      deferredPromptRef.current = e;
      setDeferredPrompt(e);
      if (!checkStandalone && !dismissed) {
        setShowBanner(true);
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Listen for appinstalled event
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setShowBanner(false);
      deferredPromptRef.current = null;
      setDeferredPrompt(null);
    };

    window.addEventListener('appinstalled', handleAppInstalled);

    // Custom event listener to trigger install from buttons anywhere in the app
    const handleTriggerInstall = () => {
      const promptEvent = deferredPromptRef.current;
      if (promptEvent) {
        promptEvent.prompt();
      } else if (isIosDevice) {
        setShowIosModal(true);
      } else {
        setShowBanner(true);
      }
    };
    window.addEventListener('trigger-pwa-install', handleTriggerInstall);

    // If iOS and not standalone and not dismissed, show banner after 4 seconds
    let iosTimer: NodeJS.Timeout | null = null;
    if (isIosDevice && !checkStandalone && !dismissed) {
      iosTimer = setTimeout(() => {
        setShowBanner(true);
      }, 4000);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
      window.removeEventListener('trigger-pwa-install', handleTriggerInstall);
      if (iosTimer) clearTimeout(iosTimer);
    };
  }, []);

  const handleInstallClick = async () => {
    const promptEvent = deferredPromptRef.current;
    if (promptEvent) {
      promptEvent.prompt();
      const { outcome } = await promptEvent.userChoice;
      if (outcome === 'accepted') {
        setIsInstalled(true);
        setShowBanner(false);
      }
      deferredPromptRef.current = null;
      setDeferredPrompt(null);
    } else if (isIos) {
      setShowIosModal(true);
    }
  };

  const handleDismiss = () => {
    setShowBanner(false);
    sessionStorage.setItem('pwa_prompt_dismissed', 'true');
  };

  if (isStandalone || isInstalled) {
    return null;
  }

  return (
    <>
      {/* Floating PWA Install Banner */}
      {showBanner && (
        <div className="pwa-install-banner" role="banner" aria-label="تثبيت التطبيق">
          <div className="pwa-banner-content">
            <div className="pwa-banner-icon">
              <span>🕌</span>
            </div>
            <div className="pwa-banner-text">
              <strong>تثبيت «قصص الأنبياء وسيرة الرسول»</strong>
              <p>ثبّت التطبيق على جهازك للقراءة السريعة والعمل دون إنترنت</p>
            </div>
          </div>

          <div className="pwa-banner-actions">
            <button
              type="button"
              className="pwa-install-btn"
              onClick={handleInstallClick}
            >
              <Download size={15} />
              <span>تثبيت التطبيق</span>
            </button>
            <button
              type="button"
              className="pwa-dismiss-btn"
              onClick={handleDismiss}
              title="إغلاق"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      {/* iOS Safari Instructions Modal */}
      {showIosModal && (
        <div className="modal-overlay" onClick={() => setShowIosModal(false)}>
          <div className="modal-card" style={{ maxWidth: '420px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Smartphone size={20} className="gold-text" />
                <h3>تثبيت التطبيق على iPhone و iPad</h3>
              </div>
              <button className="modal-close-btn" onClick={() => setShowIosModal(false)}>
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: '8px 0 16px', lineHeight: '1.8', fontSize: '0.94rem', color: 'var(--text-body)' }}>
              <p style={{ marginBottom: '14px' }}>
                يمكنك تثبيت الموقع كتطبيق أصيل على جهازك بخطوتين بسيطتين عبر متصفح <strong>Safari</strong>:
              </p>

              <ol style={{ paddingRight: '22px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <li style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span className="source-num-pill" style={{ width: '26px', height: '26px', fontSize: '0.75rem' }}>1</span>
                  <span>اضغط على زر المشاركة <Share size={16} style={{ display: 'inline', verticalAlign: 'middle', margin: '0 4px', color: 'var(--gold)' }} /> في أسفل شاشة Safari.</span>
                </li>
                <li style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span className="source-num-pill" style={{ width: '26px', height: '26px', fontSize: '0.75rem' }}>2</span>
                  <span>مرّر للأسفل واختر <strong>«إضافة إلى الشاشة الرئيسية»</strong> (Add to Home Screen) <PlusSquare size={16} style={{ display: 'inline', verticalAlign: 'middle', margin: '0 4px', color: 'var(--gold)' }} />.</span>
                </li>
              </ol>

              <div style={{ marginTop: '16px', padding: '12px 14px', background: 'rgba(200, 155, 60, 0.1)', border: '1px solid rgba(200, 155, 60, 0.3)', borderRadius: '8px', fontSize: '0.84rem' }}>
                💡 سيعمل التطبيق في نافذة مخصصة كاملة وبدون أشرطة المتصفح لتجربة قراءة غامرة وهادئة.
              </div>
            </div>

            <div className="modal-actions">
              <button
                type="button"
                className="btn-gold"
                style={{ width: '100%', justifyContent: 'center' }}
                onClick={() => setShowIosModal(false)}
              >
                <CheckCircle2 size={16} />
                <span>حسناً، فهمت</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
