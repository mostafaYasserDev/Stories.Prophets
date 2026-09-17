'use client';

import React, { useState, useMemo, useEffect } from 'react';
import {
  Search,
  X,
  Volume2,
  Bookmark,
  Check,
  Pin,
  BookOpen,
  Star,
  Layers,
  ChevronDown,
} from 'lucide-react';
import { Episode, Series } from '@/types';
import { normalizeArabicText } from '@/lib/errorHandler';

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
  seriesList?: Series[];
}

interface SeriesGroup {
  key: string;
  id: string;
  title: string;
  description?: string;
  order: number;
  isPinned: boolean;
  episodes: { ep: Episode; originalIndex: number }[];
  totalCount: number;
  readCount: number;
  audioCount: number;
  hasActiveEpisode: boolean;
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
  seriesList,
}) => {
  // Quick Filter Tab: 'all' | 'bookmarks' | 'audio' | 'unread'
  const [filterType, setFilterType] = useState<'all' | 'bookmarks' | 'audio' | 'unread'>('all');

  // Set of expanded series keys
  const [expandedSeries, setExpandedSeries] = useState<Set<string>>(new Set());

  // Distinct Eras for top quick filter chips
  const distinctEras = useMemo(() => {
    if (seriesList && seriesList.length > 0) {
      return seriesList.map((s) => s.title);
    }
    const set = new Set<string>();
    episodes.forEach((e) => {
      if (e.era && e.era.trim()) set.add(e.era.trim());
    });
    return Array.from(set);
  }, [episodes, seriesList]);

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
    const q = searchQuery.toLowerCase().trim();
    const hasSearch = q.length > 0;
    const normActiveEra = activeEra !== 'all' ? normalizeArabicText(activeEra) : null;

    return episodes
      .map((ep, originalIndex) => ({ ep, originalIndex }))
      .filter(({ ep }) => {
        // Smart tab filter
        if (filterType === 'bookmarks' && !bookmarks.has(ep.docId)) return false;
        if (filterType === 'audio' && !ep.audioUrl) return false;
        if (filterType === 'unread' && readEpisodes.has(ep.docId)) return false;

        // Era filter with Arabic normalization
        if (normActiveEra && normalizeArabicText(ep.era) !== normActiveEra) {
          return false;
        }

        // Search text query
        if (hasSearch) {
          const titleMatch = (ep.title || '').toLowerCase().includes(q);
          const subMatch = (ep.subtitle || '').toLowerCase().includes(q);
          const eraMatch = (ep.era || '').toLowerCase().includes(q);
          const textMatch = (ep.html || '').replace(/<[^>]+>/g, '').toLowerCase().includes(q);
          return titleMatch || subMatch || eraMatch || textMatch;
        }
        return true;
      });
  }, [episodes, filterType, activeEra, searchQuery, bookmarks, readEpisodes]);

  // Group episodes into Series Groups
  const seriesGroups = useMemo(() => {
    const groupsMap = new Map<string, SeriesGroup>();

    // Pre-populate with seriesList metadata if available
    if (seriesList && seriesList.length > 0) {
      seriesList.forEach((s, idx) => {
        const key = normalizeArabicText(s.title);
        groupsMap.set(key, {
          key,
          id: s.id,
          title: s.title,
          description: s.description,
          order: typeof s.order === 'number' ? s.order : idx + 1,
          isPinned: Boolean(s.isPinned),
          episodes: [],
          totalCount: 0,
          readCount: 0,
          audioCount: 0,
          hasActiveEpisode: false,
        });
      });
    }

    // Populate total counts from all episodes
    episodes.forEach((ep, originalIndex) => {
      const eraTitle = (ep.era && ep.era.trim()) || 'فصول السيرة';
      const key = normalizeArabicText(eraTitle);

      if (!groupsMap.has(key)) {
        groupsMap.set(key, {
          key,
          id: ep.seriesId || key,
          title: eraTitle,
          description: '',
          order: 1000 + groupsMap.size,
          isPinned: Boolean(ep.isPinned),
          episodes: [],
          totalCount: 0,
          readCount: 0,
          audioCount: 0,
          hasActiveEpisode: false,
        });
      }

      const grp = groupsMap.get(key)!;
      grp.totalCount += 1;
      if (readEpisodes.has(ep.docId)) grp.readCount += 1;
      if (ep.audioUrl) grp.audioCount += 1;
      if (originalIndex === currentIndex) grp.hasActiveEpisode = true;
    });

    // Populate filtered episodes into the groups
    filtered.forEach((item) => {
      const eraTitle = (item.ep.era && item.ep.era.trim()) || 'فصول السيرة';
      const key = normalizeArabicText(eraTitle);
      const grp = groupsMap.get(key);
      if (grp) {
        grp.episodes.push(item);
      }
    });

    // Only return groups that have matching episodes in current filter/search
    const result = Array.from(groupsMap.values()).filter((g) => g.episodes.length > 0);

    // Sort by order asc, then pinned, then title
    result.sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      return a.order - b.order;
    });

    return result;
  }, [episodes, seriesList, filtered, readEpisodes, currentIndex]);

  // Keep active episode's series expanded
  useEffect(() => {
    if (episodes[currentIndex]) {
      const eraTitle = (episodes[currentIndex].era && episodes[currentIndex].era.trim()) || 'فصول السيرة';
      const currentKey = normalizeArabicText(eraTitle);
      setExpandedSeries((prev) => {
        if (prev.has(currentKey)) return prev;
        const next = new Set(prev);
        next.add(currentKey);
        return next;
      });
    }
  }, [currentIndex, episodes]);

  // Auto-expand all matching groups when search or filter tab is active
  useEffect(() => {
    if (searchQuery.trim() || filterType !== 'all' || activeEra !== 'all') {
      const matchingKeys = seriesGroups.map((g) => g.key);
      setExpandedSeries(new Set(matchingKeys));
    }
  }, [searchQuery, filterType, activeEra, seriesGroups]);

  // Toggle single series
  const toggleSeries = (key: string) => {
    setExpandedSeries((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  // Toggle expand all / collapse all
  const allExpanded =
    seriesGroups.length > 0 && seriesGroups.every((g) => expandedSeries.has(g.key));

  const toggleAllSeries = () => {
    if (allExpanded) {
      setExpandedSeries(new Set());
    } else {
      setExpandedSeries(new Set(seriesGroups.map((g) => g.key)));
    }
  };

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
              title="الحلقات المحفوظة بالمفضلة"
            >
              <Star size={13} />
              <span>المفضلة</span>
              {bookmarks.size > 0 && <span className="tab-count-badge">{bookmarks.size}</span>}
            </button>
            <button
              type="button"
              className={`sidebar-tab-chip ${filterType === 'audio' ? 'active' : ''}`}
              onClick={() => setFilterType('audio')}
              title="الحلقات ذات التسجيل الصوتي"
            >
              <Volume2 size={13} />
              <span>صوتية</span>
              {episodesWithAudioCount > 0 && <span className="tab-count-badge">{episodesWithAudioCount}</span>}
            </button>
            <button
              type="button"
              className={`sidebar-tab-chip ${filterType === 'unread' ? 'active' : ''}`}
              onClick={() => setFilterType('unread')}
              title="الحلقات غير المقروءة"
            >
              <BookOpen size={13} />
              <span>لم تقرأ</span>
              {unreadCount > 0 && <span className="tab-count-badge">{unreadCount}</span>}
            </button>
          </div>

          {/* Era / Series Filter Chips */}
          <div className="era-chips">
            <button
              type="button"
              className={`era-chip ${activeEra === 'all' ? 'active' : ''}`}
              onClick={() => onSelectEra('all')}
            >
              <span>كل السلاسل</span>
              <span className="era-chip-count">{episodes.length}</span>
            </button>
            {distinctEras.map((era) => {
              const count = episodes.filter(
                (e) => normalizeArabicText(e.era) === normalizeArabicText(era)
              ).length;
              return (
                <button
                  key={era}
                  type="button"
                  className={`era-chip ${activeEra === era ? 'active' : ''}`}
                  onClick={() => onSelectEra(era)}
                >
                  <span>{era}</span>
                  <span className="era-chip-count">{count}</span>
                </button>
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

          {/* Stats & Expand/Collapse All Bar */}
          <div className="sidebar-stats">
            <span>الحلقات المعروضة: <b>{filtered.length}</b></span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              {seriesGroups.length > 1 && (
                <button
                  type="button"
                  className="sidebar-expand-all-btn"
                  onClick={toggleAllSeries}
                  title={allExpanded ? 'طي جميع السلاسل' : 'توسيع جميع السلاسل'}
                >
                  {allExpanded ? 'طي الكل' : 'توسيع الكل'}
                </button>
              )}
              <span>المقروء: <b>{readPercent}%</b></span>
            </div>
          </div>
        </div>

        {/* Collapsible Series & Episode List */}
        <div className="episode-list">
          {seriesGroups.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 10px', color: 'var(--text-muted)' }}>
              <p>لا توجد نتائج تطابق التصفية أو البحث</p>
            </div>
          ) : (
            seriesGroups.map((group) => {
              const isExpanded = expandedSeries.has(group.key);

              return (
                <div
                  key={group.key}
                  className={`sidebar-series-group ${isExpanded ? 'expanded' : ''} ${group.hasActiveEpisode ? 'contains-active' : ''}`}
                >
                  {/* Collapsible Series Header Card */}
                  <button
                    type="button"
                    className={`sidebar-series-header ${isExpanded ? 'expanded' : ''} ${group.hasActiveEpisode ? 'contains-active' : ''}`}
                    onClick={() => toggleSeries(group.key)}
                    aria-expanded={isExpanded}
                    title={`انقر لـ ${isExpanded ? 'طي' : 'فتح'} ${group.title}`}
                  >
                    <div className="series-header-main">
                      <div className="series-icon-badge">
                        <Layers size={15} />
                      </div>
                      <div className="series-info-text">
                        <div className="series-title-row">
                          <span className="series-title">{group.title}</span>
                          {group.isPinned && (
                            <span title="سلسلة مثبتة">
                              <Pin size={11} className="pin-icon-tag" />
                            </span>
                          )}
                        </div>
                        <div className="series-meta-row">
                          <span className="series-count-pill">{group.totalCount} حلقة</span>
                          {group.readCount > 0 && (
                            <span className="series-read-pill">
                              {group.readCount}/{group.totalCount} مقروءة
                            </span>
                          )}
                          {group.audioCount > 0 && (
                            <span
                              className="series-audio-pill"
                              title={`${group.audioCount} حلقة صوتية`}
                            >
                              <Volume2 size={11} />
                              {group.audioCount}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="series-header-actions">
                      {group.totalCount > 0 && group.readCount > 0 && (
                        <span className="series-percent-badge">
                          {Math.round((group.readCount / group.totalCount) * 100)}%
                        </span>
                      )}
                      <div className={`series-chevron-wrapper ${isExpanded ? 'rotated' : ''}`}>
                        <ChevronDown size={16} />
                      </div>
                    </div>
                  </button>

                  {/* Collapsible Episodes Container */}
                  {isExpanded && (
                    <div className="sidebar-series-episodes">
                      {group.episodes.map(({ ep, originalIndex }) => {
                        const isCurrent = originalIndex === currentIndex;
                        const isBookmarked = bookmarks.has(ep.docId);
                        const isRead = readEpisodes.has(ep.docId);

                        return (
                          <div
                            key={ep.docId || originalIndex}
                            className={`episode-card-item nested-in-series ${isCurrent ? 'active' : ''} ${ep.isPinned ? 'pinned-item' : ''}`}
                            onClick={() => {
                              onSelectEpisode(originalIndex);
                              onCloseMobile();
                            }}
                          >
                            <div className="ep-item-left">
                              <div className="ep-badge-num">{originalIndex + 1}</div>
                              <div className="ep-item-meta">
                                <div className="ep-item-title-row">
                                  <span className="ep-item-title">
                                    {renderHighlightedTitle(ep.title)}
                                  </span>
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
                                  <Bookmark
                                    size={14}
                                    className="icon-badge"
                                    style={{ color: 'var(--gold)' }}
                                  />
                                </span>
                              )}
                              {isRead && (
                                <span title="تمت قراءتها">
                                  <Check
                                    size={14}
                                    className="icon-badge"
                                    style={{ color: '#10b981' }}
                                  />
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </aside>
    </>
  );
};
