import { useState, useEffect, useRef } from 'react';
import Head from 'next/head';
import { NUMTHONG_GROUP } from '../lib/ntPhotoConfig';

// User-facing load-error messages (Thai). No internal/security details are exposed.
const LOAD_ERROR_TEXT = {
  network: 'ไม่สามารถเชื่อมต่อได้ กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองใหม่',
  forbidden: 'ไม่สามารถเข้าถึงอัลบั้มนี้ได้',
  notfound: 'ไม่พบอัลบั้มหรือโฟลเดอร์นี้',
  ratelimit: 'ขณะนี้มีผู้ใช้งานจำนวนมาก กรุณารอสักครู่แล้วลองใหม่',
  server: 'ระบบไม่สามารถโหลดข้อมูลได้ในขณะนี้ กรุณาลองใหม่อีกครั้ง',
  generic: 'ไม่สามารถโหลดข้อมูลได้ กรุณาลองใหม่อีกครั้ง',
};
const errorKindFromStatus = (status) => {
  if (status === 403) return 'forbidden';
  if (status === 404) return 'notfound';
  if (status === 429) return 'ratelimit';
  if (status >= 500) return 'server';
  return 'generic';
};

const PHOTOS_PER_PAGE = 28;
const MAX_SELECT = 10;
const DL_KEY = 'nt_photo_downloaded'; // "download memory" (this device only)

// ===== Feature flag: single-group (NUMTHON) mode =====
// Set SINGLE_GROUP_MODE = false to bring back the full 4-group picker. Nothing else needs changing.
const SINGLE_GROUP_MODE = true;

const GROUPS = [
  // NT Photo is NUMTHONG-only. The NUMTHONG group (incl. its root folder ID) is
  // sourced from the central config (lib/ntPhotoConfig) so the ID lives in ONE
  // place. Legacy groups (lica/ideaplan/pednoi) remain removed to keep NT within
  // its own NUMTHONG security boundary.
  NUMTHONG_GROUP,
];

const FEATURED_GROUP = GROUPS.find(g => g.id === 'numthong');

// Custom display order for the MAIN album level only (group root).
// Folders matching a name appear first, in this order; others keep their original
// (API) order, placed after. Does NOT affect nested subfolders, POSTER cover, or downloads.
const MAIN_ALBUM_ORDER = ['Numthong Pattana', 'Phutthatham Numthong', 'FA Numthong'];

const sortMainAlbums = (list) => {
  const rank = (name) => {
    const n = (name || '').trim().toLowerCase();
    const i = MAIN_ALBUM_ORDER.findIndex(x => x.toLowerCase() === n);
    return i === -1 ? Infinity : i;
  };
  // Array.prototype.sort is stable, so equal ranks (incl. unlisted) keep original order.
  return [...list].sort((a, b) => rank(a.name) - rank(b.name));
};

export default function Gallery() {
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [path, setPath] = useState([]);        // navigation stack: folder nodes inside the group
  const [folders, setFolders] = useState([]);  // folder cards at the current level
  const [mode, setMode] = useState(null);      // 'folders' | 'photos'
  const [photos, setPhotos] = useState([]);
  const [lightbox, setLightbox] = useState(null);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(new Set());
  const [selectMode, setSelectMode] = useState(false);
  // Download Tray: mobile-safe multi-download (each download = a real user tap)
  const [trayOpen, setTrayOpen] = useState(false);
  const [trayPhotos, setTrayPhotos] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [maxAlert, setMaxAlert] = useState(false);
  const [isLineBrowser, setIsLineBrowser] = useState(false);
  // Load error (null on success). Shape: { kind } — distinct from a real empty album.
  const [loadError, setLoadError] = useState(null);
  // Monotonic request id: only the latest loadLevel call may write state (stale-response guard).
  const reqIdRef = useRef(0);
  // Last requested location so "ลองใหม่" retries the same level (path/breadcrumb preserved).
  const lastLoadRef = useRef(null);
  // Mobile breadcrumb: keep the CURRENT crumb visible inside the breadcrumb's own
  // scroller (UI only — no change to path/goToDepth navigation logic).
  const breadcrumbRef = useRef(null);
  const currentCrumbRef = useRef(null);
  const [bcFade, setBcFade] = useState({ left: false, right: false }); // edge scroll hints

  // Download memory + download size
  const [downloaded, setDownloaded] = useState(new Set());
  const [dlSize, setDlSize] = useState('full'); // 'full' | 'social'

  const totalPages = Math.ceil(photos.length / PHOTOS_PER_PAGE);
  const pageStart = (currentPage - 1) * PHOTOS_PER_PAGE;
  const pagePhotos = photos.slice(pageStart, pageStart + PHOTOS_PER_PAGE);

  // On load: restore download memory + (single mode) auto-open NUMTHON
  useEffect(() => {
    try {
      const raw = localStorage.getItem(DL_KEY);
      if (raw) setDownloaded(new Set(JSON.parse(raw)));
    } catch (e) {}
    // LINE in-app browser blocks downloads/popups/multi-download — detect it and guide
    // the user to open the page in an external browser. Viewing is never blocked.
    try {
      if (/Line\//i.test(navigator.userAgent || '')) setIsLineBrowser(true);
    } catch (e) {}
    if (SINGLE_GROUP_MODE && FEATURED_GROUP) {
      openGroup(FEATURED_GROUP);
    }
  }, []);

  // Toggle the left/right fade hints based on the breadcrumb scroll position.
  const updateBcFades = () => {
    const cont = breadcrumbRef.current;
    if (!cont) return;
    setBcFade({
      left: cont.scrollLeft > 4,
      right: cont.scrollLeft + cont.clientWidth < cont.scrollWidth - 4,
    });
  };

  // When the path/level changes, bring the CURRENT crumb into view inside the
  // breadcrumb's own horizontal scroller. Mobile/tablet only. Deferred one frame so
  // the breadcrumb has laid out; scrollIntoView with inline:'nearest' + block:'nearest'
  // scrolls only the breadcrumb scroller (never the page) and never moves focus.
  // Uses non-smooth scrolling under prefers-reduced-motion.
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    if (!window.matchMedia('(max-width: 768px)').matches) { updateBcFades(); return undefined; }
    const cur = currentCrumbRef.current;
    if (!cur) { updateBcFades(); return undefined; }
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const raf = requestAnimationFrame(() => {
      try {
        cur.scrollIntoView({ inline: 'nearest', block: 'nearest', behavior: reduce ? 'auto' : 'smooth' });
      } catch (e) {
        cur.scrollIntoView({ inline: 'nearest', block: 'nearest' });
      }
      updateBcFades();
    });
    return () => cancelAnimationFrame(raf);
  }, [path, loading, mode]);

  const markDownloaded = (ids) => {
    setDownloaded(prev => {
      const next = new Set(prev);
      ids.forEach(id => next.add(id));
      try { localStorage.setItem(DL_KEY, JSON.stringify([...next])); } catch (e) {}
      return next;
    });
  };

  // Generic nested navigation: load a folder level — show its subfolders if any, else its photos.
  // Works for unlimited depth (group → album → subfolder → subfolder → ... → photos).
  const loadLevel = async (folderId, isRoot = false) => {
    const myReq = ++reqIdRef.current;     // claim latest request
    lastLoadRef.current = { folderId, isRoot };
    setLoading(true);
    setLoadError(null);
    setMode(null);
    setFolders([]);
    setPhotos([]);
    setSelectMode(false);
    setSelected(new Set());
    setCurrentPage(1);
    setMaxAlert(false);
    const isStale = () => myReq !== reqIdRef.current; // a newer load started
    try {
      const fRes = await fetch(`/api/drive?type=folders&groupFolderId=${folderId}`);
      if (isStale()) return;
      if (!fRes.ok) { setLoadError({ kind: errorKindFromStatus(fRes.status) }); return; }
      const fData = await fRes.json();
      if (isStale()) return;
      const subs = fData.folders || [];
      if (subs.length > 0) {
        // Apply custom album order only at the main album level (group root).
        setFolders(isRoot ? sortMainAlbums(subs) : subs);
        setMode('folders');
      } else {
        const pRes = await fetch(`/api/drive?type=photos&folderId=${folderId}`);
        if (isStale()) return;
        if (!pRes.ok) { setLoadError({ kind: errorKindFromStatus(pRes.status) }); return; }
        const pData = await pRes.json();
        if (isStale()) return;
        setPhotos(pData.photos || []);
        setMode('photos');
      }
    } catch (e) {
      // Network / fetch failure (or JSON parse) — surface as an error, never a fake empty album.
      if (!isStale()) setLoadError({ kind: 'network' });
    } finally {
      if (!isStale()) setLoading(false);
    }
  };

  // "ลองใหม่": reload the SAME level. loadLevel never mutates `path`, so the
  // breadcrumb/navigation stack is preserved. Guarded against rapid re-clicks.
  const retryLoad = () => {
    if (loading) return;
    const last = lastLoadRef.current;
    if (last) loadLevel(last.folderId, last.isRoot);
  };

  const openGroup = (group) => {
    setSelectedGroup(group);
    setPath([]);
    loadLevel(group.folderId, true);
  };

  // Click any folder card at any depth — push onto the stack and load its level.
  const openNode = (folder) => {
    setPath(prev => [...prev, { id: folder.id, name: folder.name }]);
    loadLevel(folder.id);
  };

  // Breadcrumb jump: index === -1 → group root (album list); otherwise jump to path[index].
  const goToDepth = (index) => {
    if (index < 0) {
      setPath([]);
      if (selectedGroup) loadLevel(selectedGroup.folderId, true);
    } else {
      const node = path[index];
      setPath(path.slice(0, index + 1));
      loadLevel(node.id);
    }
  };

  const back = () => goToDepth(path.length - 2);

  const backToGroups = () => {
    setSelectedGroup(null);
    setPath([]);
    setFolders([]);
    setPhotos([]);
    setMode(null);
    setSelectMode(false);
    setSelected(new Set());
    setCurrentPage(1);
    setMaxAlert(false);
  };

  const toggleSelect = (photoId) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(photoId)) {
        next.delete(photoId);
        setMaxAlert(false);
      } else {
        if (next.size >= MAX_SELECT) {
          setMaxAlert(true);
          setTimeout(() => setMaxAlert(false), 2500);
          return prev;
        }
        next.add(photoId);
      }
      return next;
    });
  };

  const selectAllPage = () => {
    const pageIds = pagePhotos.map(p => p.id);
    const allSelected = pageIds.every(id => selected.has(id));
    if (allSelected) {
      setSelected(prev => {
        const next = new Set(prev);
        pageIds.forEach(id => next.delete(id));
        return next;
      });
      setMaxAlert(false);
    } else {
      setSelected(prev => {
        const next = new Set(prev);
        for (const id of pageIds) {
          if (next.size >= MAX_SELECT) {
            setMaxAlert(true);
            setTimeout(() => setMaxAlert(false), 2500);
            break;
          }
          next.add(id);
        }
        return next;
      });
    }
  };

  const cancelSelect = () => {
    setSelectMode(false);
    setSelected(new Set());
    setMaxAlert(false);
  };

  const handlePhotoTap = (photo, pageIndex) => {
    if (selectMode) {
      toggleSelect(photo.id);
    } else {
      setLightbox(pageStart + pageIndex);
    }
  };

  const triggerDownload = (photo, size) => {
    const a = document.createElement('a');
    a.href = `/api/download?fileId=${photo.id}${size === 'social' ? '&size=social' : ''}`;
    a.download = photo.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const downloadOne = (photo, size) => {
    triggerDownload(photo, size);
    markDownloaded([photo.id]);
  };

  // Open the tray with a snapshot of the current selection instead of auto-firing
  // many downloads at once (mobile browsers block everything after the first gesture,
  // and the first file opens inline instead of downloading).
  const openTray = () => {
    if (selected.size === 0) return;
    setTrayPhotos(photos.filter(p => selected.has(p.id)));
    setTrayOpen(true);
  };

  const closeTray = () => {
    setTrayOpen(false);
    setTrayPhotos([]);
  };

  const changePage = (page) => {
    if (page < 1 || page > totalPages) return;
    setCurrentPage(page);
    window.scrollTo({ top: 0 }); // jump to top of grid/album (smooth is a no-op on this page)
  };

  // Image optimization: light thumbs in grid, medium in lightbox, full original only on download
  const getThumbUrl = (photo) => `https://drive.google.com/thumbnail?id=${photo.id}&sz=w400`;
  const getViewUrl = (photo) => `https://drive.google.com/thumbnail?id=${photo.id}&sz=w1600`;

  const allPageSelected = pagePhotos.length > 0 && pagePhotos.every(p => selected.has(p.id));
  const atMax = selected.size >= MAX_SELECT;

  // Root = group landing (album list). Current folder name = last node in the path stack.
  const atRoot = selectedGroup && path.length === 0;
  const currentFolderName = path.length ? path[path.length - 1].name : null;

  const getPageNumbers = () => {
    if (totalPages <= 5) return Array.from({ length: totalPages }, (_, i) => i + 1);
    const pages = [];
    let start = Math.max(1, currentPage - 2);
    let end = Math.min(totalPages, start + 4);
    if (end - start < 4) start = Math.max(1, end - 4);
    for (let i = start; i <= end; i++) pages.push(i);
    return pages;
  };

  return (
    <>
      <Head>
        <title>{SINGLE_GROUP_MODE ? `${FEATURED_GROUP.name} Photo Gallery` : 'NT Photo'}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700&family=Sarabun:wght@300;400;600&display=swap" rel="stylesheet" />
      </Head>
      <style>{`
        @font-face { font-family:'NTLocalFont'; src:url('/fonts/NotoSansThai-Regular.ttf') format('truetype'); font-weight:400; font-style:normal; font-display:swap; }
        @font-face { font-family:'NTLocalFont'; src:url('/fonts/NotoSansThai-Bold.ttf') format('truetype'); font-weight:700; font-style:normal; font-display:swap; }
        * { margin:0; padding:0; box-sizing:border-box; }
        body { background:#0a0a0a; color:#f0ece4; font-family:'NTLocalFont','Sarabun',sans-serif; min-height:100vh; }
        .header {
          background:linear-gradient(180deg,#111 0%,transparent 100%);
          padding:24px 20px 16px; text-align:center; position:sticky; top:0; z-index:10;
          backdrop-filter:blur(12px); border-bottom:1px solid rgba(255,255,255,0.06); position:relative;
        }
        .logo { font-family:'Playfair Display',serif; font-size:24px; font-weight:700; letter-spacing:3px; }
        .logo span { color:#c9a84c; }
        .tagline { font-size:10px; color:#888; letter-spacing:4px; text-transform:uppercase; margin-top:3px; }
        /* When the tagline shows a Thai folder/event name, drop the wide Latin tracking + uppercase */
        .tagline-folder { font-size:12px; color:#cfc8ba; letter-spacing:0.2px; text-transform:none; line-height:1.5; max-width:80vw; margin:3px auto 0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
        .back-btn {
          position:absolute; left:16px; top:50%; transform:translateY(-50%);
          background:rgba(255,255,255,0.08); border:1px solid rgba(255,255,255,0.12);
          color:#f0ece4; padding:7px 14px; border-radius:20px; cursor:pointer;
          font-size:12px; font-family:'NTLocalFont','Sarabun',sans-serif;
        }
        .container { padding:18px 14px; max-width:1200px; margin:0 auto; }
        /* LINE in-app browser guidance (download is limited inside LINE) */
        .line-warning { max-width:1200px; margin:14px auto 0; padding:14px 16px; background:linear-gradient(135deg,rgba(201,168,76,0.16),rgba(201,168,76,0.06)); border:1px solid rgba(201,168,76,0.5); border-radius:14px; }
        .line-warning-title { font-family:'NTLocalFont','Sarabun',sans-serif; font-size:14px; font-weight:700; color:#c9a84c; margin-bottom:6px; }
        .line-warning-text { font-family:'NTLocalFont','Sarabun',sans-serif; font-size:13px; color:#cfc8ba; line-height:1.65; }
        .section-title { font-family:'Playfair Display',serif; font-size:13px; color:#c9a84c; letter-spacing:4px; text-transform:uppercase; margin-bottom:16px; }
        /* Breadcrumb: accessible nav + own horizontal scroll on mobile (never the whole page) */
        .breadcrumb { margin-bottom:18px; }
        .breadcrumb-list {
          list-style:none; display:flex; flex-wrap:nowrap; align-items:center; gap:6px;
          font-size:12px; line-height:1.6; overflow-x:auto; overflow-y:hidden;
          -webkit-overflow-scrolling:touch; scrollbar-width:none; padding:2px 2px 4px;
        }
        .breadcrumb-list::-webkit-scrollbar { display:none; }
        .breadcrumb-item { display:inline-flex; align-items:center; flex:none; gap:6px; }
        /* Capsule crumbs: each level is its own pill with a thin gold border. Layout
           style only — navigation logic, semantics, and aria are unchanged. */
        .crumb {
          display:inline-flex; align-items:center; gap:5px; max-width:220px;
          color:#e7dfce; background:rgba(255,255,255,0.04);
          border:1px solid rgba(201,168,76,0.45); cursor:pointer; white-space:nowrap;
          font-family:'NTLocalFont','Sarabun',sans-serif; font-size:12px; line-height:1.5;
          letter-spacing:0.2px; padding:10px 14px; min-height:44px; border-radius:16px;
          transition:border-color 0.18s ease, background-color 0.18s ease, color 0.18s ease;
        }
        .crumb-label { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:150px; }
        .crumb:hover { border-color:#c9a84c; background:rgba(201,168,76,0.12); color:#fff; text-decoration:none; }
        .crumb:focus-visible { outline:2px solid #c9a84c; outline-offset:2px; text-decoration:none; }
        /* Current level: gold-tinted fill + stronger border + bolder text (distinct by
           more than colour alone), and not interactive. */
        .crumb.current { color:#fdf6e3; cursor:default; font-weight:700; background:rgba(201,168,76,0.22); border-color:#c9a84c; }
        .crumb.current:hover { background:rgba(201,168,76,0.22); border-color:#c9a84c; text-decoration:none; }
        .crumb-sep { color:#caa84c; opacity:0.7; margin:0; flex:none; font-size:13px; }
        @media (max-width:480px){ .crumb-label { max-width:118px; } }
        .hero { text-align:center; padding:26px 16px 24px; }
        .hero-kicker { font-size:11px; letter-spacing:5px; color:#c9a84c; text-transform:uppercase; }
        .hero-title { font-family:'Playfair Display',serif; font-size:30px; font-weight:700; margin:10px 0 4px; line-height:1.2; }
        .hero-title span { color:#c9a84c; }
        .hero-divider { width:48px; height:2px; background:#c9a84c; margin:12px auto; border-radius:2px; }
        .hero-sub { font-size:14px; color:#cfc8ba; }
        .hero-help { font-size:12px; color:#9a917f; margin-top:6px; }
        .howto { max-width:440px; margin:0 auto 26px; background:linear-gradient(135deg,rgba(201,168,76,0.06),rgba(255,255,255,0.02)); border:1px solid rgba(201,168,76,0.18); border-radius:14px; padding:15px 18px; }
        .howto-title { font-family:'Playfair Display',serif; font-size:12px; letter-spacing:3px; color:#c9a84c; text-transform:uppercase; text-align:center; margin-bottom:12px; }
        .howto-list { display:flex; flex-direction:column; gap:9px; }
        .howto-item { display:flex; gap:10px; align-items:flex-start; font-size:13px; color:#cfc8ba; line-height:1.5; }
        .howto-num { flex:none; width:20px; height:20px; border-radius:50%; background:rgba(201,168,76,0.15); color:#c9a84c; font-size:11px; font-weight:700; display:flex; align-items:center; justify-content:center; margin-top:1px; }
        .howto-note { margin-top:12px; padding-top:10px; border-top:1px solid rgba(255,255,255,0.06); font-size:11px; color:#8a8372; text-align:center; line-height:1.5; }
        .welcome-header { text-align:center; padding:24px 0 28px; }
        .welcome-title { font-family:'Playfair Display',serif; font-size:24px; color:#f0ece4; margin-bottom:6px; }
        .welcome-sub { font-size:13px; color:#666; letter-spacing:1px; }
        .group-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(160px,1fr)); gap:16px; }
        .group-card {
          background:linear-gradient(135deg,#1a1a1a,#141414);
          border:1px solid rgba(255,255,255,0.08); border-radius:18px;
          padding:32px 16px 24px; text-align:center; cursor:pointer; transition:all 0.25s ease;
        }
        .group-card:hover { border-color:#c9a84c; transform:translateY(-4px); box-shadow:0 12px 40px rgba(201,168,76,0.2); }
        .group-emoji { font-size:44px; margin-bottom:12px; }
        .group-name { font-family:'Playfair Display',serif; font-size:15px; font-weight:700; color:#f0ece4; line-height:1.4; margin-bottom:6px; }
        .group-sub { font-size:10px; color:#c9a84c; letter-spacing:2px; text-transform:uppercase; }
        .folder-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(280px,1fr)); gap:18px; }
        .folder-card {
          background:linear-gradient(135deg,#1a1a1a,#141414);
          border:1px solid rgba(255,255,255,0.08); border-radius:16px;
          padding:22px 14px; text-align:center; cursor:pointer; transition:all 0.25s ease;
          aspect-ratio:4/3; display:flex; flex-direction:column; align-items:center; justify-content:center;
        }
        .folder-card:hover { border-color:#c9a84c; transform:translateY(-3px); box-shadow:0 8px 32px rgba(201,168,76,0.15); }
        .folder-icon { font-size:48px; margin-bottom:10px; }
        .folder-name { font-size:14px; font-weight:600; color:#f0ece4; line-height:1.4; }
        .folder-card.cover {
          padding:0; position:relative; aspect-ratio:4/3; overflow:hidden;
          display:flex; flex-direction:column; justify-content:flex-end;
          background:radial-gradient(circle at 50% 38%, #171717 0%, #0a0a0a 100%);
          border:1px solid rgba(201,168,76,0.38); box-shadow:0 10px 34px rgba(0,0,0,0.55);
        }
        .folder-cover-img { position:absolute; inset:0; width:100%; height:100%; object-fit:contain; }
        .folder-card.cover:hover { border-color:#c9a84c; transform:translateY(-4px); box-shadow:0 16px 46px rgba(201,168,76,0.25); }
        .folder-cover-grad { position:absolute; left:0; right:0; bottom:0; height:50%; background:linear-gradient(to top, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.5) 42%, rgba(0,0,0,0) 100%); }
        .folder-card.cover .folder-name { position:relative; z-index:1; width:100%; padding:14px; text-align:left; font-size:15px; color:#fff; text-shadow:0 1px 6px rgba(0,0,0,0.95); }
        .toolbar { display:flex; align-items:center; gap:10px; margin-bottom:14px; flex-wrap:wrap; }
        .folder-header { display:flex; align-items:center; gap:10px; flex:1; min-width:0; }
        .folder-title { font-family:'NTLocalFont','Sarabun',sans-serif; font-size:18px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .photo-count { background:rgba(201,168,76,0.2); color:#c9a84c; border-radius:20px; padding:3px 10px; font-size:11px; font-weight:600; white-space:nowrap; font-family:'NTLocalFont','Sarabun',sans-serif; }
        .select-toggle-btn {
          background:rgba(201,168,76,0.15); border:1px solid rgba(201,168,76,0.4);
          color:#c9a84c; padding:7px 14px; border-radius:20px; cursor:pointer;
          font-family:'NTLocalFont','Sarabun',sans-serif; font-size:12px; font-weight:600; white-space:nowrap;
        }
        .photo-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(150px,1fr)); gap:8px; }
        .photo-item {
          position:relative; aspect-ratio:1; border-radius:10px; overflow:hidden;
          cursor:pointer; background:#1a1a1a; border:2px solid transparent; transition:border-color 0.2s;
          user-select:none; -webkit-user-select:none;
        }
        .photo-item.selected { border-color:#c9a84c; }
        .photo-item.max-reached { opacity:0.5; }
        .photo-item img { width:100%; height:100%; object-fit:cover; transition:transform 0.3s ease, opacity 0.4s ease; opacity:0; }
        .photo-item img.loaded { opacity:1; }
        .photo-item:hover img { transform:scale(1.04); }
        .photo-circle {
          position:absolute; top:8px; right:8px; width:24px; height:24px;
          border-radius:50%; border:2px solid rgba(255,255,255,0.7); display:none; background:rgba(0,0,0,0.3);
        }
        .select-mode .photo-circle { display:block; }
        .photo-check {
          position:absolute; top:8px; right:8px; width:24px; height:24px; border-radius:50%;
          background:#c9a84c; display:none; align-items:center; justify-content:center;
          font-size:13px; font-weight:700; color:#000; border:2px solid #000;
        }
        .photo-item.selected .photo-check { display:flex; }
        .photo-item.selected .photo-circle { display:none; }
        .dl-badge {
          position:absolute; bottom:6px; right:6px;
          background:rgba(46,160,90,0.92); color:#fff; font-size:10px; font-weight:600;
          padding:2px 7px; border-radius:10px;
        }
        .photo-num { position:absolute; bottom:6px; left:6px; font-size:13px; font-weight:700; color:#fff; background:rgba(0,0,0,0.6); padding:2px 8px; border-radius:9px; line-height:1.25; text-shadow:0 1px 2px rgba(0,0,0,0.9); }
        .pagination { display:flex; align-items:center; justify-content:center; gap:6px; padding:20px 0 110px; flex-wrap:wrap; }
        .page-btn {
          width:38px; height:38px; border-radius:50%; border:1px solid rgba(255,255,255,0.15);
          background:rgba(255,255,255,0.05); color:#f0ece4; cursor:pointer;
          font-family:'NTLocalFont','Sarabun',sans-serif; font-size:13px; display:flex; align-items:center; justify-content:center; transition:all 0.2s;
        }
        .page-btn:hover:not(:disabled) { border-color:#c9a84c; color:#c9a84c; }
        .page-btn.active { background:#c9a84c; border-color:#c9a84c; color:#000; font-weight:700; }
        .page-btn:disabled { opacity:0.3; cursor:not-allowed; }
        .page-btn.arrow { font-size:18px; }
        .page-info { font-size:12px; color:#968d7b; text-align:center; margin-bottom:8px; }
        /* Top pagination controls (so users don't have to scroll to the bottom) */
        .pagination-top { display:flex; align-items:center; justify-content:space-between; gap:10px; margin-bottom:14px; }
        .page-nav-btn { background:rgba(201,168,76,0.15); border:1px solid rgba(201,168,76,0.4); color:#c9a84c; padding:8px 16px; border-radius:20px; cursor:pointer; font-family:'NTLocalFont','Sarabun',sans-serif; font-size:13px; font-weight:600; white-space:nowrap; }
        .page-nav-btn:hover:not(:disabled) { background:rgba(201,168,76,0.28); }
        .page-nav-btn:disabled { opacity:0.35; cursor:not-allowed; }
        .page-top-indicator { font-size:13px; color:#cfc8ba; font-weight:600; white-space:nowrap; }
        .max-alert {
          position:fixed; top:80px; left:50%; transform:translateX(-50%);
          background:#c9a84c; color:#000; padding:10px 20px; border-radius:24px;
          font-size:13px; font-weight:700; z-index:200; animation:fadeInOut 2.5s ease forwards; white-space:nowrap;
        }
        @keyframes fadeInOut {
          0% { opacity:0; transform:translateX(-50%) translateY(-10px); }
          15% { opacity:1; transform:translateX(-50%) translateY(0); }
          75% { opacity:1; } 100% { opacity:0; }
        }
        .select-bar {
          position:fixed; bottom:0; left:0; right:0; z-index:50;
          background:#151515; border-top:1px solid rgba(255,255,255,0.1);
          padding:10px 14px; display:flex; align-items:center; gap:10px; flex-wrap:wrap; backdrop-filter:blur(12px);
        }
        .select-info { flex:1; min-width:120px; }
        .select-count { font-size:14px; font-weight:600; color:#c9a84c; }
        .select-limit { font-size:11px; color:#666; margin-top:1px; }
        .size-toggle { display:flex; background:rgba(255,255,255,0.06); border-radius:18px; padding:3px; }
        .size-opt { border:none; background:transparent; color:#aaa; font-family:'NTLocalFont','Sarabun',sans-serif; font-size:11px; padding:6px 11px; border-radius:15px; cursor:pointer; white-space:nowrap; }
        .size-opt.active { background:#c9a84c; color:#000; font-weight:700; }
        .sel-btn {
          background:rgba(255,255,255,0.08); border:1px solid rgba(255,255,255,0.15);
          color:#f0ece4; padding:9px 14px; border-radius:20px; cursor:pointer;
          font-family:'NTLocalFont','Sarabun',sans-serif; font-size:12px; white-space:nowrap;
        }
        .sel-btn.primary { background:#c9a84c; border-color:#c9a84c; color:#000; font-weight:700; }
        .sel-btn:disabled { opacity:0.35; cursor:not-allowed; }
        .progress-overlay {
          position:fixed; inset:0; background:rgba(0,0,0,0.92); z-index:200;
          display:flex; flex-direction:column; align-items:center; justify-content:center; gap:16px;
        }
        .progress-bar-bg { width:260px; height:6px; background:#333; border-radius:3px; overflow:hidden; }
        .progress-bar-fill { height:100%; background:#c9a84c; border-radius:3px; transition:width 0.3s; }
        .lightbox {
          position:fixed; inset:0; background:rgba(0,0,0,0.96); z-index:100;
          display:flex; flex-direction:column; align-items:center; justify-content:center; padding:20px;
        }
        .lightbox-img { max-width:100%; max-height:70vh; border-radius:8px; object-fit:contain; }
        .lightbox-counter { font-size:12px; color:#666; margin-top:8px; }
        .lightbox-actions { display:flex; gap:10px; margin-top:14px; flex-wrap:wrap; justify-content:center; }
        .lb-btn {
          background:rgba(255,255,255,0.1); border:1px solid rgba(255,255,255,0.15);
          color:#f0ece4; padding:10px 20px; border-radius:24px; cursor:pointer;
          font-family:'NTLocalFont','Sarabun',sans-serif; font-size:13px; text-decoration:none; display:inline-block;
        }
        .lb-btn.primary { background:#c9a84c; border-color:#c9a84c; color:#000; font-weight:600; }
        .lightbox-close {
          position:absolute; top:16px; right:16px; background:rgba(255,255,255,0.1);
          border:none; color:#fff; width:38px; height:38px; border-radius:50%; cursor:pointer; font-size:16px;
        }
        .lightbox-nav {
          position:absolute; top:50%; transform:translateY(-50%);
          background:rgba(255,255,255,0.1); border:none; color:#fff;
          width:44px; height:44px; border-radius:50%; cursor:pointer; font-size:22px;
        }
        .lightbox-nav.prev { left:10px; }
        .lightbox-nav.next { right:10px; }
        .loading { text-align:center; padding:60px 20px; color:#666; }
        .spinner { width:34px; height:34px; border:2px solid #333; border-top-color:#c9a84c; border-radius:50%; animation:spin 0.8s linear infinite; margin:0 auto 14px; }
        @keyframes spin { to { transform:rotate(360deg); } }
        .empty { text-align:center; padding:60px 20px; color:#968d7b; font-size:14px; }
        /* Load-error state (distinct from empty) — in-content card, NT dark/gold */
        .load-error { max-width:440px; margin:34px auto; padding:26px 22px; text-align:center; background:linear-gradient(135deg,rgba(201,168,76,0.07),rgba(255,255,255,0.02)); border:1px solid rgba(201,168,76,0.24); border-radius:16px; }
        .load-error-icon { font-size:34px; margin-bottom:10px; }
        .load-error-title { font-family:'NTLocalFont','Sarabun',sans-serif; font-size:16px; font-weight:700; color:#f0ece4; margin-bottom:8px; }
        .load-error-msg { font-family:'NTLocalFont','Sarabun',sans-serif; font-size:13px; color:#cfc8ba; line-height:1.7; margin-bottom:18px; }
        .retry-btn { background:#c9a84c; border:none; color:#000; font-weight:700; font-family:'NTLocalFont','Sarabun',sans-serif; font-size:14px; padding:11px 26px; border-radius:22px; cursor:pointer; min-height:44px; }
        .retry-btn:hover:not(:disabled) { background:#d8b95e; }
        .retry-btn:disabled { opacity:0.5; cursor:not-allowed; }
        .app-footer { text-align:center; padding:26px 16px 40px; color:#8a8273; font-size:11px; letter-spacing:1px; border-top:1px solid rgba(255,255,255,0.05); margin-top:24px; }

        /* Download Tray (mobile-safe multi-download) */
        .tray-overlay { position:fixed; inset:0; background:rgba(0,0,0,0.86); z-index:150; display:flex; align-items:flex-end; justify-content:center; }
        .tray { width:100%; max-width:560px; max-height:84vh; background:#141414; border:1px solid rgba(255,255,255,0.1); border-radius:18px 18px 0 0; display:flex; flex-direction:column; overflow:hidden; }
        .tray-head { display:flex; align-items:center; justify-content:space-between; padding:16px 18px 8px; }
        .tray-title { font-family:'NTLocalFont','Sarabun',sans-serif; font-size:16px; font-weight:600; color:#f0ece4; }
        .tray-close { background:rgba(255,255,255,0.1); border:none; color:#fff; width:32px; height:32px; border-radius:50%; cursor:pointer; font-size:14px; flex:none; }
        .tray-note { padding:0 18px 12px; font-size:12px; color:#8a8372; line-height:1.5; }
        .tray-size { display:flex; align-items:center; gap:10px; padding:0 18px 12px; }
        .tray-size-label { font-size:12px; color:#aaa; }
        .tray-list { overflow-y:auto; padding:4px 12px 8px; display:flex; flex-direction:column; gap:8px; }
        .tray-item { display:flex; align-items:center; gap:12px; background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.07); border-radius:12px; padding:8px 10px; }
        .tray-thumb { width:52px; height:52px; border-radius:8px; object-fit:cover; flex:none; background:#222; }
        .tray-item-info { flex:1; min-width:0; }
        .tray-item-name { font-size:13px; color:#f0ece4; }
        .tray-item-done { font-size:11px; color:#2ea05a; margin-top:2px; }
        .tray-dl-btn { flex:none; background:#c9a84c; border:none; color:#000; font-weight:700; font-family:'NTLocalFont','Sarabun',sans-serif; font-size:12px; padding:9px 14px; border-radius:18px; cursor:pointer; white-space:nowrap; }
        .tray-dl-btn.done { background:rgba(255,255,255,0.12); color:#cfc8ba; font-weight:600; }
        .tray-foot { display:flex; gap:10px; padding:12px 18px; border-top:1px solid rgba(255,255,255,0.08); }
        .tray-foot .sel-btn { flex:1; text-align:center; }

        /* ---- Accessibility polish ---- */
        /* Visible keyboard focus for all interactive controls (does not affect mouse users) */
        button:focus-visible, a:focus-visible { outline:2px solid #c9a84c; outline-offset:2px; }
        /* iPhone safe-area: keep the fixed bars clear of the home indicator */
        @supports (padding:max(0px)) {
          .select-bar { padding-bottom:calc(10px + env(safe-area-inset-bottom)); }
          .tray-foot { padding-bottom:calc(12px + env(safe-area-inset-bottom)); }
        }
        /* Respect reduced-motion: drop animations, transitions, and hover zoom/lift */
        @media (prefers-reduced-motion: reduce) {
          *, *::before, *::after {
            animation-duration:0.001ms !important; animation-iteration-count:1 !important;
            transition-duration:0.001ms !important; scroll-behavior:auto !important;
          }
          .photo-item:hover img { transform:none; }
          .folder-card:hover, .group-card:hover, .folder-card.cover:hover { transform:none; }
          .fab-back { transition:none !important; }
        }

        /* ---- Mobile gallery navigation (breadcrumb visibility + floating back) ---- */
        /* Desktop default: floating button and fade hints are off; the header back
           button stays. Everything below only turns on at <=768px. */
        .fab-back { display:none; }
        .breadcrumb-fade { display:none; }
        @media (max-width: 768px) {
          /* Swap the hard-to-reach header back button for a thumb-friendly floating one
             (never both at once). */
          .back-btn { display:none; }
          .fab-back {
            display:inline-flex; align-items:center; gap:6px;
            position:fixed; left:16px; bottom:calc(16px + env(safe-area-inset-bottom));
            z-index:60; min-height:48px; padding:12px 18px; border-radius:26px;
            background:rgba(18,16,12,0.82); border:1px solid rgba(201,168,76,0.55);
            color:#f3ecd9; font-family:'NTLocalFont','Sarabun',sans-serif; font-size:14px; font-weight:600;
            box-shadow:0 6px 20px rgba(0,0,0,0.5); -webkit-backdrop-filter:blur(6px); backdrop-filter:blur(6px);
            cursor:pointer; transition:background-color 0.18s ease, border-color 0.18s ease, bottom 0.2s ease;
          }
          .fab-back:hover { background:rgba(30,27,20,0.9); border-color:#c9a84c; }
          .fab-back:focus-visible { outline:2px solid #c9a84c; outline-offset:2px; }
          /* Select bar (bottom:0, ~108px tall when wrapped) is open: float clear above it. */
          .fab-back.raised { bottom:calc(120px + env(safe-area-inset-bottom)); }
          /* Mobile breadcrumb: relative for fades; bigger touch text; current widest. */
          .breadcrumb { position:relative; }
          .crumb { padding:9px 12px; font-size:14px; }
          .crumb:not(.current) .crumb-label { max-width:30vw; }
          .crumb.current .crumb-label { max-width:58vw; }
          /* Light edge fades hint that the breadcrumb scrolls; never catch taps. */
          .breadcrumb-fade { display:block; position:absolute; top:0; bottom:6px; width:22px; z-index:2; pointer-events:none; }
          .breadcrumb-fade.left { left:0; background:linear-gradient(to right, #0a0a0a 30%, rgba(10,10,10,0)); }
          .breadcrumb-fade.right { right:0; background:linear-gradient(to left, #0a0a0a 30%, rgba(10,10,10,0)); }
        }
      `}</style>

      {maxAlert && <div className="max-alert">⚠️ เลือกได้สูงสุด {MAX_SELECT} รูปต่อครั้ง</div>}

      {lightbox !== null && photos[lightbox] && (
        <div className="lightbox" onClick={() => setLightbox(null)}>
          <button className="lightbox-close" aria-label="ปิด" onClick={() => setLightbox(null)}>✕</button>
          {lightbox > 0 && (
            <button className="lightbox-nav prev" aria-label="รูปก่อนหน้า" onClick={e => { e.stopPropagation(); setLightbox(lightbox - 1); }}>‹</button>
          )}
          {lightbox < photos.length - 1 && (
            <button className="lightbox-nav next" aria-label="รูปถัดไป" onClick={e => { e.stopPropagation(); setLightbox(lightbox + 1); }}>›</button>
          )}
          <img className="lightbox-img" src={getViewUrl(photos[lightbox])} alt={photos[lightbox]?.name || ''} onClick={e => e.stopPropagation()} />
          <div className="lightbox-counter">{lightbox + 1} / {photos.length}</div>
          <div className="lightbox-actions" onClick={e => e.stopPropagation()}>
            <button className="lb-btn primary" onClick={() => downloadOne(photos[lightbox], 'full')}>⬇ ขนาดเต็ม</button>
            <button className="lb-btn" onClick={() => downloadOne(photos[lightbox], 'social')}>📱 ขนาดโซเชียล</button>
          </div>
        </div>
      )}

      {trayOpen && (
        <div className="tray-overlay" onClick={closeTray}>
          <div className="tray" onClick={e => e.stopPropagation()}>
            <div className="tray-head">
              <div className="tray-title">⬇ ดาวน์โหลดทีละรูป ({trayPhotos.length})</div>
              <button className="tray-close" aria-label="ปิด" onClick={closeTray}>✕</button>
            </div>
            <div className="tray-note">แตะปุ่ม “ดาวน์โหลด” ของแต่ละรูปเพื่อบันทึก — มือถือบางรุ่นต้องกดทีละรูปเพื่อไม่ให้เบราว์เซอร์บล็อก</div>
            <div className="tray-size">
              <span className="tray-size-label">ขนาดไฟล์</span>
              <div className="size-toggle">
                <button className={`size-opt ${dlSize === 'full' ? 'active' : ''}`} onClick={() => setDlSize('full')}>ขนาดเต็ม</button>
                <button className={`size-opt ${dlSize === 'social' ? 'active' : ''}`} onClick={() => setDlSize('social')}>โซเชียล</button>
              </div>
            </div>
            <div className="tray-list">
              {trayPhotos.map((photo, i) => {
                const isDone = downloaded.has(photo.id);
                return (
                  <div key={photo.id} className="tray-item">
                    <img className="tray-thumb" src={getThumbUrl(photo)} alt={photo.name} loading="lazy" />
                    <div className="tray-item-info">
                      <div className="tray-item-name">รูปที่ {i + 1}</div>
                      {isDone && <div className="tray-item-done">✓ บันทึกแล้ว</div>}
                    </div>
                    <button className={`tray-dl-btn ${isDone ? 'done' : ''}`} onClick={() => downloadOne(photo, dlSize)}>
                      {isDone ? 'โหลดอีกครั้ง' : 'ดาวน์โหลด'}
                    </button>
                  </div>
                );
              })}
            </div>
            <div className="tray-foot">
              <button className="sel-btn" onClick={closeTray}>ปิด</button>
              <button className="sel-btn primary" onClick={() => { closeTray(); cancelSelect(); }}>เสร็จสิ้น</button>
            </div>
          </div>
        </div>
      )}

      <div className="header">
        {selectedGroup && path.length > 0 && <button className="back-btn" onClick={back}>← กลับ</button>}
        {!SINGLE_GROUP_MODE && selectedGroup && path.length === 0 && <button className="back-btn" onClick={backToGroups}>← กลับ</button>}
        <div className="logo">NT <span>Photo</span></div>
        <div className={`tagline ${currentFolderName ? 'tagline-folder' : ''}`}>
          {currentFolderName ? currentFolderName :
           (SINGLE_GROUP_MODE ? 'NUMTHONG Event Gallery' :
            selectedGroup ? selectedGroup.name : 'ภาพถ่ายกิจกรรม')}
        </div>
      </div>

      {isLineBrowser && (
        <div className="line-warning">
          <div className="line-warning-title">⚠️ คุณกำลังเปิดผ่าน LINE</div>
          <div className="line-warning-text">หากต้องการดาวน์โหลดรูป กรุณาเปิดลิงก์นี้ด้วย Chrome หรือ Safari เพื่อให้บันทึกรูปได้สมบูรณ์</div>
          <div className="line-warning-text">วิธีเปิด: กดปุ่ม ⋯ มุมขวาบนของ LINE แล้วเลือก “เปิดในเบราว์เซอร์ภายนอก”</div>
        </div>
      )}

      <div className="container">
        {!SINGLE_GROUP_MODE && !selectedGroup && (
          <>
            <div className="welcome-header">
              <div className="welcome-title">เลือกกลุ่มของคุณ</div>
              <div className="welcome-sub">เพื่อดูภาพถ่ายกิจกรรม</div>
            </div>
            <div className="group-grid">
              {GROUPS.map(group => (
                <div key={group.id} className="group-card" onClick={() => openGroup(group)}>
                  <div className="group-emoji">{group.emoji}</div>
                  <div className="group-name">{group.name}</div>
                  <div className="group-sub">ดูภาพถ่าย</div>
                </div>
              ))}
            </div>
          </>
        )}

        {selectedGroup && path.length > 0 && (
          <nav className="breadcrumb" aria-label="Breadcrumb">
            {bcFade.left && <div className="breadcrumb-fade left" aria-hidden="true" />}
            {bcFade.right && <div className="breadcrumb-fade right" aria-hidden="true" />}
            <ol className="breadcrumb-list" ref={breadcrumbRef} onScroll={updateBcFades}>
              <li className="breadcrumb-item">
                <button type="button" className="crumb" onClick={() => goToDepth(-1)}>
                  <span aria-hidden="true">🏠</span>
                  <span className="crumb-label">{SINGLE_GROUP_MODE ? FEATURED_GROUP.name : selectedGroup.name}</span>
                </button>
              </li>
              {path.map((node, i) => {
                const isCurrent = i === path.length - 1;
                return (
                  <li className="breadcrumb-item" key={node.id}>
                    <span className="crumb-sep" aria-hidden="true">›</span>
                    {isCurrent ? (
                      <span className="crumb current" aria-current="page" title={node.name} ref={currentCrumbRef}>
                        <span className="crumb-label">{node.name}</span>
                      </span>
                    ) : (
                      <button type="button" className="crumb" onClick={() => goToDepth(i)} title={node.name}>
                        <span className="crumb-label">{node.name}</span>
                      </button>
                    )}
                  </li>
                );
              })}
            </ol>
          </nav>
        )}

        {atRoot && SINGLE_GROUP_MODE && (
          <>
            <div className="hero">
              <div className="hero-kicker">นำทอง · Event Gallery</div>
              <div className="hero-title">{FEATURED_GROUP.name} <span>Photo Gallery</span></div>
              <div className="hero-divider" />
              <div className="hero-sub">รวมภาพบรรยากาศกิจกรรม</div>
              <div className="hero-help">เลือกภาพที่ต้องการ แล้วดาวน์โหลดได้ทันที</div>
            </div>
            <div className="howto">
              <div className="howto-title">วิธีใช้งาน</div>
              <div className="howto-list">
                <div className="howto-item"><span className="howto-num">1</span><span>เลือกอัลบั้มกิจกรรม</span></div>
                <div className="howto-item"><span className="howto-num">2</span><span>แตะรูปเพื่อดูภาพขนาดใหญ่</span></div>
                <div className="howto-item"><span className="howto-num">3</span><span>กด “เลือกหลายรูป” หากต้องการดาวน์โหลดหลายภาพ</span></div>
                <div className="howto-item"><span className="howto-num">4</span><span>เลือก “โซเชียล” สำหรับไฟล์เล็ก เหมาะกับ Facebook / LINE / IG</span></div>
              </div>
              <div className="howto-note">บนมือถือ บางเครื่องอาจถามยืนยันการดาวน์โหลดทีละรูป</div>
            </div>
          </>
        )}

        {selectedGroup && loading && (
          <div className="loading" role="status" aria-live="polite"><div className="spinner" aria-hidden="true"/><div>กำลังโหลด...</div></div>
        )}

        {selectedGroup && !loading && loadError && (
          <div className="load-error" role="alert">
            <div className="load-error-icon" aria-hidden="true">⚠️</div>
            <div className="load-error-title">โหลดไม่สำเร็จ</div>
            <div className="load-error-msg">{LOAD_ERROR_TEXT[loadError.kind] || LOAD_ERROR_TEXT.generic}</div>
            <button type="button" className="retry-btn" onClick={retryLoad} disabled={loading}>↻ ลองใหม่</button>
          </div>
        )}

        {selectedGroup && !loading && !loadError && mode === 'folders' && (
          <>
            <div className="section-title">{path.length === 0 ? '📁 เลือกงาน / อัลบั้ม' : '📂 เลือกหมวดหมู่'}</div>
            {folders.length === 0 ? (
              <div className="empty" role="status">⚠️ ยังไม่มีโฟลเดอร์</div>
            ) : (
              <div className="folder-grid">
                {folders.map(folder => (
                  <div key={folder.id} className={`folder-card ${folder.coverId ? 'cover' : ''}`} onClick={() => openNode(folder)}>
                    {folder.coverId ? (
                      <>
                        <img className="folder-cover-img" src={`https://drive.google.com/thumbnail?id=${folder.coverId}&sz=w800`} alt={folder.name} loading="lazy" onError={e => { e.currentTarget.style.display = 'none'; }} />
                        <div className="folder-cover-grad" />
                        <div className="folder-name">{folder.name}</div>
                      </>
                    ) : (
                      <>
                        <div className="folder-icon">{path.length === 0 ? '📸' : '📁'}</div>
                        <div className="folder-name">{folder.name}</div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {selectedGroup && !loading && !loadError && mode === 'photos' && (
          <>
            <div className="toolbar">
              <div className="folder-header">
                <div className="folder-title">{currentFolderName || (SINGLE_GROUP_MODE ? FEATURED_GROUP.name : selectedGroup.name)}</div>
                {photos.length > 0 && <span className="photo-count">{photos.length} รูป</span>}
              </div>
              {photos.length > 0 && (
                <button className="select-toggle-btn" onClick={() => selectMode ? cancelSelect() : setSelectMode(true)}>
                  {selectMode ? '✕ ยกเลิก' : '☑ เลือกหลายรูป'}
                </button>
              )}
            </div>

            {photos.length === 0 ? (
              <div className="empty" role="status">📭 ยังไม่มีภาพในอัลบั้มนี้</div>
            ) : (
              <>
                {totalPages > 1 && (
                  <div className="page-info">
                    หน้า {currentPage} / {totalPages} — รูปที่ {pageStart + 1}–{Math.min(pageStart + PHOTOS_PER_PAGE, photos.length)}
                  </div>
                )}
                {totalPages > 1 && (
                  <div className="pagination-top">
                    <button className="page-nav-btn" onClick={() => changePage(currentPage - 1)} disabled={currentPage === 1}>‹ ก่อนหน้า</button>
                    <span className="page-top-indicator">หน้า {currentPage} / {totalPages}</span>
                    <button className="page-nav-btn" onClick={() => changePage(currentPage + 1)} disabled={currentPage === totalPages}>ถัดไป ›</button>
                  </div>
                )}
                <div className={`photo-grid ${selectMode ? 'select-mode' : ''}`}>
                  {pagePhotos.map((photo, i) => {
                    const isSelected = selected.has(photo.id);
                    const isDisabled = atMax && !isSelected;
                    const isDone = downloaded.has(photo.id);
                    return (
                      <div
                        key={photo.id}
                        className={`photo-item ${isSelected ? 'selected' : ''} ${isDisabled ? 'max-reached' : ''}`}
                        onClick={() => handlePhotoTap(photo, i)}
                      >
                        <img
                          src={getThumbUrl(photo)}
                          alt={photo.name}
                          loading="lazy"
                          decoding="async"
                          onLoad={e => e.currentTarget.classList.add('loaded')}
                          onError={e => e.currentTarget.classList.add('loaded')}
                        />
                        <div className="photo-circle"/>
                        <div className="photo-check">✓</div>
                        {isDone && !selectMode && <div className="dl-badge">✓ บันทึกแล้ว</div>}
                        <div className="photo-num">{pageStart + i + 1}</div>
                      </div>
                    );
                  })}
                </div>
                {totalPages > 1 && (
                  <nav className="pagination" aria-label="แบ่งหน้า">
                    <button className="page-btn arrow" aria-label="หน้าแรก" onClick={() => changePage(1)} disabled={currentPage === 1}>«</button>
                    <button className="page-btn arrow" aria-label="หน้าก่อนหน้า" onClick={() => changePage(currentPage - 1)} disabled={currentPage === 1}>‹</button>
                    {getPageNumbers().map(n => (
                      <button key={n} className={`page-btn ${n === currentPage ? 'active' : ''}`} aria-label={`หน้า ${n}`} aria-current={n === currentPage ? 'page' : undefined} onClick={() => changePage(n)}>{n}</button>
                    ))}
                    <button className="page-btn arrow" aria-label="หน้าถัดไป" onClick={() => changePage(currentPage + 1)} disabled={currentPage === totalPages}>›</button>
                    <button className="page-btn arrow" aria-label="หน้าสุดท้าย" onClick={() => changePage(totalPages)} disabled={currentPage === totalPages}>»</button>
                  </nav>
                )}
                {totalPages <= 1 && <div style={{paddingBottom: selectMode ? 110 : 20}} />}
              </>
            )}
          </>
        )}
      </div>

      <div className="app-footer">Created by Nithirut Chirathiraphat<br/>NT 866</div>

      {/* Floating folder-back (mobile/tablet): one level up via the existing back()
          — same logic as the desktop header button. Hidden at root and while the
          Download Tray modal is open; raised above the Select bar when active. */}
      {selectedGroup && path.length > 0 && !trayOpen && (
        <button
          type="button"
          className={`fab-back ${selectMode ? 'raised' : ''}`}
          onClick={back}
          aria-label="กลับไปโฟลเดอร์ก่อนหน้า"
        >
          <span aria-hidden="true">←</span> กลับ
        </button>
      )}

      {selectMode && (
        <div className="select-bar">
          <div className="select-info">
            <div className="select-count">{selected.size > 0 ? `เลือก ${selected.size} รูป` : 'แตะรูปเพื่อเลือก'}</div>
            <div className="select-limit">{selected.size}/{MAX_SELECT} รูป</div>
          </div>
          <div className="size-toggle">
            <button className={`size-opt ${dlSize === 'full' ? 'active' : ''}`} onClick={() => setDlSize('full')}>ขนาดเต็ม</button>
            <button className={`size-opt ${dlSize === 'social' ? 'active' : ''}`} onClick={() => setDlSize('social')}>โซเชียล</button>
          </div>
          <button className="sel-btn" onClick={selectAllPage}>
            {allPageSelected ? 'ยกเลิกหน้านี้' : 'เลือกหน้านี้'}
          </button>
          <button className="sel-btn primary" onClick={openTray} disabled={selected.size === 0}>
            ⬇ บันทึก{selected.size > 0 ? ` ${selected.size}` : ''} รูป
          </button>
        </div>
      )}
    </>
  );
}
