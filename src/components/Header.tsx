'use client';

import React from 'react';
import { Palette, Type, ZoomIn, ZoomOut, Menu, Eye } from 'lucide-react';
import { SiteSettings } from '@/types';

interface HeaderProps {
  currentTheme?: string;
  onThemeCycle: () => void;
  currentFont?: string;
  onFontCycle: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onToggleDrawer: () => void;
  siteSettings?: SiteSettings;
  isFocusMode?: boolean;
  onToggleFocusMode?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  onThemeCycle,
  onFontCycle,
  onZoomIn,
  onZoomOut,
  onToggleDrawer,
  siteSettings,
  isFocusMode,
  onToggleFocusMode,
}) => {
  return (
    <header className="app-header">
      <div className="header-inner">
        <a href="/" className="brand">
          <div className="brand-emblem">
            <span style={{ fontSize: '24px' }}>🕌</span>
          </div>
          <div className="brand-info">
            <h1>{siteSettings?.siteTitle || 'قصص الأنبياء وسير الرسول'}</h1>
            <p>{siteSettings?.siteSubtitle || 'رحلة إيمانية مباركة في قصص الأنبياء وسيرة خير الأنام ﷺ'}</p>
          </div>
        </a>

        <div className="header-actions">
          {/* Focus Mode Trigger */}
          {onToggleFocusMode && (
            <button
              type="button"
              className={`btn-icon ${isFocusMode ? 'active' : ''}`}
              onClick={onToggleFocusMode}
              title="وضع القراءة الهادئة بدون تشتيت (Focus Mode)"
            >
              <Eye size={18} />
            </button>
          )}

          {/* Theme Switcher */}
          <button
            type="button"
            className="btn-icon"
            onClick={onThemeCycle}
            title="تغيير المظهر / الثيم"
          >
            <Palette size={18} />
          </button>

          {/* Font Family Switcher */}
          <button
            type="button"
            className="btn-icon"
            onClick={onFontCycle}
            title="نوع الخط"
          >
            <Type size={18} />
          </button>

          {/* Font Zoom Controls */}
          <button
            type="button"
            className="btn-icon"
            onClick={onZoomIn}
            title="تكبير الخط"
          >
            <ZoomIn size={18} />
          </button>
          <button
            type="button"
            className="btn-icon"
            onClick={onZoomOut}
            title="تصغير الخط"
          >
            <ZoomOut size={18} />
          </button>

          {/* Mobile Drawer Trigger */}
          <button
            type="button"
            className="btn-icon mobile-header-menu-btn"
            onClick={onToggleDrawer}
            title="قائمة وفهرس الحلقات"
          >
            <Menu size={18} />
          </button>
        </div>
      </div>
    </header>
  );
};

