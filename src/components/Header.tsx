'use client';

import React from 'react';
import { Palette, Type, ZoomIn, ZoomOut, Plus, Menu } from 'lucide-react';
import { ThemeType, FontType } from '@/types';

interface HeaderProps {
  currentTheme: ThemeType;
  onThemeCycle: () => void;
  currentFont: FontType;
  onFontCycle: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onOpenAddModal: () => void;
  onToggleDrawer: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  onThemeCycle,
  onFontCycle,
  onZoomIn,
  onZoomOut,
  onOpenAddModal,
  onToggleDrawer,
}) => {
  return (
    <header className="app-header">
      <div className="header-inner">
        <a href="#" className="brand">
          <div className="brand-emblem">
            <span style={{ fontSize: '24px' }}>🕌</span>
          </div>
          <div className="brand-info">
            <h1>السيرة النبوية الشريفة</h1>
            <p>رحلة تفاعلية مباركة في سيرة خير الأنام ﷺ</p>
          </div>
        </a>

        <div className="header-actions">
          {/* Theme Switcher */}
          <button
            className="btn-icon"
            onClick={onThemeCycle}
            title="تغيير المظهر / الثيم"
          >
            <Palette size={18} />
          </button>

          {/* Font Family Switcher */}
          <button
            className="btn-icon"
            onClick={onFontCycle}
            title="نوع الخط"
          >
            <Type size={18} />
          </button>

          {/* Font Zoom Controls */}
          <button
            className="btn-icon"
            onClick={onZoomIn}
            title="تكبير الخط"
          >
            <ZoomIn size={18} />
          </button>
          <button
            className="btn-icon"
            onClick={onZoomOut}
            title="تصغير الخط"
          >
            <ZoomOut size={18} />
          </button>

          {/* Add Episode Button */}
          <button
            className="btn-gold"
            onClick={onOpenAddModal}
            title="إضافة حلقة جديدة"
          >
            <Plus size={18} />
            <span>حلقة جديدة</span>
          </button>

          {/* Mobile Drawer Trigger */}
          <button
            className="btn-icon"
            id="mobileMenuBtn"
            onClick={onToggleDrawer}
            title="قائمة الحلقات"
            style={{ display: 'none' }}
          >
            <Menu size={18} />
          </button>
        </div>
      </div>
    </header>
  );
};
