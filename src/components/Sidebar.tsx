'use client';

import React from 'react';
import { Search, X, Volume2, Bookmark, Check, Pin } from 'lucide-react';
import { Episode } from '@/types';

interface SidebarProps {
  episodes: Episode[];
  currentIndex: number;
  onSelectEpisode: (index: number) => void;
  activeEra: string;
  onSelectEra: (era: string) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  bookmarks: Set<string>;
  readEpisodes: Set<string>;
  isOpenMobile: boolean;
  onCloseMobile: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  episodes,
  currentIndex,
  onSelectEpisode,
  activeEra,
  onSelectEra,
  searchQuery,
  onSearchChange,
  bookmarks,
  readEpisodes,
  isOpenMobile,
  onCloseMobile,
}) => {
  // Extract unique eras
  const distinctEras = Array.from(new Set(episodes.map((e) => e.era).filter(Boolean)));

  // Filter episodes
  const filtered = episodes
    .map((ep, originalIndex) => ({ ep, originalIndex }))
    .filter(({ ep }) => {
      if (activeEra !== 'all' && ep.era !== activeEra) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const titleMatch = (ep.title || '').toLowerCase().includes(q);
        const subMatch = (ep.subtitle || '').toLowerCase().includes(q);
        const eraMatch = (ep.era || '').toLowerCase().includes(q);
        const textMatch = (ep.html || '').replace(/<[^>]+>/g, '').toLowerCase().includes(q);
        return titleMatch || subMatch || eraMatch || textMatch;
      }
      return true;
    });

  const readPercent = episodes.length
    ? Math.round((readEpisodes.size / episodes.length) * 100)
    : 0;

  return (
    <>
      {/* Mobile Drawer Backdrop */}
      {isOpenMobile && (
        <div className="drawer-backdrop" onClick={onCloseMobile} />
      )}

      <aside className={`episodes-sidebar ${isOpenMobile ? 'drawer-open' : ''}`}>
        <div className="sidebar-header">
          {/* Search Box */}
          <div className="search-box">
            <div className="search-icon-wrapper">
              <Search size={16} />
            </div>
            <input
              type="text"
              className="search-input"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="ابحث في عناوين ونصوص السيرة..."
            />
            {searchQuery && (
              <button
                className="search-clear"
                onClick={() => onSearchChange('')}
                title="مسح البحث"
              >
                <X size={16} />
              </button>
            )}
          </div>

          {/* Era / Series Filter Chips */}
          <div className="era-chips">
            <div
              className={`era-chip ${activeEra === 'all' ? 'active' : ''}`}
              onClick={() => onSelectEra('all')}
            >
              الكل ({episodes.length})
            </div>
            {distinctEras.map((era) => {
              const count = episodes.filter((e) => e.era === era).length;
              return (
                <div
                  key={era}
                  className={`era-chip ${activeEra === era ? 'active' : ''}`}
                  onClick={() => onSelectEra(era)}
                >
                  {era} ({count})
                </div>
              );
            })}
          </div>

          {/* Stats Bar */}
          <div className="sidebar-stats">
            <span>الحلقات: <b>{episodes.length}</b></span>
            <span>المقروء: <b>{readPercent}%</b></span>
          </div>
        </div>

        {/* Episode Items List */}
        <div className="episode-list">
          {filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 10px', color: 'var(--text-muted)' }}>
              <p>لا توجد نتائج تطابق بحثك</p>
            </div>
          ) : (
            filtered.map(({ ep, originalIndex }) => {
              const isCurrent = originalIndex === currentIndex;
              const isBookmarked = bookmarks.has(ep.docId);
              const isRead = readEpisodes.has(ep.docId);

              return (
                <div
                  key={ep.docId || originalIndex}
                  className={`episode-card-item ${isCurrent ? 'active' : ''} ${ep.isPinned ? 'pinned-item' : ''}`}
                  onClick={() => {
                    onSelectEpisode(originalIndex);
                    onCloseMobile();
                  }}
                >
                  <div className="ep-item-left">
                    <div className="ep-badge-num">{originalIndex + 1}</div>
                    <div className="ep-item-meta">
                      <div className="ep-item-title-row">
                        <span className="ep-item-title">{ep.title}</span>
                        {ep.isPinned && (
                          <span title="حلقة مثبتة في الصدارة">
                            <Pin size={12} className="pin-icon-tag" />
                          </span>
                        )}
                      </div>
                      <div className="ep-item-sub">{ep.subtitle || ep.era}</div>
                    </div>
                  </div>

                  <div className="ep-item-badges">
                    {ep.audioUrl && (
                      <span title="تحتوي على تسجيل صوتي">
                        <Volume2 size={14} className="icon-badge audio" />
                      </span>
                    )}
                    {isBookmarked && (
                      <span title="في المفضلة">
                        <Bookmark size={14} className="icon-badge" style={{ color: 'var(--gold)' }} />
                      </span>
                    )}
                    {isRead && (
                      <span title="تمت قراءتها">
                        <Check size={14} className="icon-badge" style={{ color: '#10b981' }} />
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </aside>
    </>
  );
};
