'use client';

import React, { useState, useMemo } from 'react';
import { Search, X, Volume2, Bookmark, Check, Pin, BookOpen, Star, Sparkles } from 'lucide-react';
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
  lastReadIndex?: number;
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
  lastReadIndex,
}) => {
  // Quick Filter Tab: 'all' | 'bookmarks' | 'audio' | 'unread'
  const [filterType, setFilterType] = useState<'all' | 'bookmarks' | 'audio' | 'unread'>('all');

  // Extract unique eras
  const distinctEras = useMemo(
    () => Array.from(new Set(episodes.map((e) => e.era).filter(Boolean))),
    [episodes]
  );

  const episodesWithAudioCount = useMemo(
    () => episodes.filter((e) => Boolean(e.audioUrl)).length,
    [episodes]
  );

  const unreadCount = useMemo(
    () => Math.max(0, episodes.length - readEpisodes.size),
    [episodes.length, readEpisodes.size]
  );

  // Filter episodes based on Era, Search Query, and Smart Tab
  const filtered = useMemo(() => {
    return episodes
      .map((ep, originalIndex) => ({ ep, originalIndex }))
      .filter(({ ep }) => {
        // Smart tab filter
        if (filterType === 'bookmarks' && !bookmarks.has(ep.docId)) return false;
        if (filterType === 'audio' && !ep.audioUrl) return false;
        if (filterType === 'unread' && readEpisodes.has(ep.docId)) return false;

        // Era filter
        if (activeEra !== 'all' && ep.era !== activeEra) return false;

        // Search text query
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase().trim();
          const titleMatch = (ep.title || '').toLowerCase().includes(q);
          const subMatch = (ep.subtitle || '').toLowerCase().includes(q);
          const eraMatch = (ep.era || '').toLowerCase().includes(q);
          const textMatch = (ep.html || '').replace(/<[^>]+>/g, '').toLowerCase().includes(q);
          return titleMatch || subMatch || eraMatch || textMatch;
        }
        return true;
      });
  }, [episodes, filterType, activeEra, searchQuery, bookmarks, readEpisodes]);

  const readPercent = episodes.length
    ? Math.round((readEpisodes.size / episodes.length) * 100)
    : 0;

  // Helper to highlight matching search term
  const renderHighlightedTitle = (title: string) => {
    const q = searchQuery.trim();
    if (!q) return title;
    const parts = title.split(new RegExp(`(${q})`, 'gi'));
    return parts.map((part, i) =>
      part.toLowerCase() === q.toLowerCase() ? (
        <span key={i} className="search-matched-text">
          {part}
        </span>
      ) : (
        part
      )
    );
  };

  const resumeEp =
    typeof lastReadIndex === 'number' &&
    lastReadIndex >= 0 &&
    lastReadIndex < episodes.length &&
    lastReadIndex !== currentIndex
      ? episodes[lastReadIndex]
      : null;

  return (
    <>
      {/* Mobile Drawer Backdrop */}
      {isOpenMobile && (
        <div className="drawer-backdrop" onClick={onCloseMobile} />
      )}

      <aside className={`episodes-sidebar ${isOpenMobile ? 'drawer-open' : ''}`}>
        {/* Mobile Drawer Title Bar with Close Button */}
        <div className="sidebar-mobile-title-bar">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <BookOpen size={18} style={{ color: 'var(--gold)' }} />
            <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>فهرس السيرة النبوية</span>
          </div>
          <button
            type="button"
            className="sidebar-mobile-close-btn"
            onClick={onCloseMobile}
            title="إغلاق الفهرس"
          >
            <X size={18} />
          </button>
        </div>

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
                type="button"
                className="search-clear"
                onClick={() => onSearchChange('')}
                title="مسح البحث"
              >
                <X size={16} />
              </button>
            )}
          </div>

          {/* Smart Tabs Bar: All, Bookmarks, Audio, Unread */}
          <div className="sidebar-smart-tabs">
            <button
              type="button"
              className={`sidebar-tab-chip ${filterType === 'all' ? 'active' : ''}`}
              onClick={() => setFilterType('all')}
            >
              <span>الكل</span>
            </button>
            <button
              type="button"
              className={`sidebar-tab-chip ${filterType === 'bookmarks' ? 'active' : ''}`}
              onClick={() => setFilterType('bookmarks')}
            >
              <Star size={12} />
              <span>المفضلة ({bookmarks.size})</span>
            </button>
            <button
              type="button"
              className={`sidebar-tab-chip ${filterType === 'audio' ? 'active' : ''}`}
              onClick={() => setFilterType('audio')}
            >
              <Volume2 size={12} />
              <span>صوتية ({episodesWithAudioCount})</span>
            </button>
            <button
              type="button"
              className={`sidebar-tab-chip ${filterType === 'unread' ? 'active' : ''}`}
              onClick={() => setFilterType('unread')}
            >
              <BookOpen size={12} />
              <span>غير مقروءة ({unreadCount})</span>
            </button>
          </div>

          {/* Era / Series Filter Chips */}
          <div className="era-chips">
            <div
              className={`era-chip ${activeEra === 'all' ? 'active' : ''}`}
              onClick={() => onSelectEra('all')}
            >
              جميع السلاسل ({episodes.length})
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

          {/* Resume Reading Card if user has a different last read episode */}
          {resumeEp && (
            <div
              className="resume-reading-card"
              onClick={() => {
                if (typeof lastReadIndex === 'number') {
                  onSelectEpisode(lastReadIndex);
                  onCloseMobile();
                }
              }}
              title="متابعة القراءة من آخر حلقة"
            >
              <div className="resume-info">
                <BookOpen size={18} className="resume-icon" />
                <div className="resume-text-wrap">
                  <span className="resume-label">آخر ما توقفت عنده:</span>
                  <span className="resume-title">{resumeEp.title}</span>
                </div>
              </div>
              <span className="resume-action-btn">متابعة ⬅</span>
            </div>
          )}

          {/* Stats Bar */}
          <div className="sidebar-stats">
            <span>الحلقات المعروضة: <b>{filtered.length}</b></span>
            <span>المقروء: <b>{readPercent}%</b></span>
          </div>
        </div>

        {/* Episode Items List */}
        <div className="episode-list">
          {filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 10px', color: 'var(--text-muted)' }}>
              <p>لا توجد نتائج تطابق التصفية أو البحث</p>
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
                        <span className="ep-item-title">{renderHighlightedTitle(ep.title)}</span>
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
