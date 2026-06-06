import { useState, useEffect } from 'react';
import Head from 'next/head';

const PHOTOS_PER_PAGE = 12;
const MAX_SELECT = 10;
const DL_KEY = 'nt_photo_downloaded'; // "download memory" (this device only)

// ===== Feature flag: single-group (NUMTHON) mode =====
// Set SINGLE_GROUP_MODE = false to bring back the full 4-group picker. Nothing else needs changing.
const SINGLE_GROUP_MODE = true;

const GROUPS = [
  { id: 'lica', name: 'LICA', emoji: '🏆', folderId: '1XWC1YGcl_oCzxX0GSMcX2BiiT2xaGTO3' },
  { id: 'numthong', name: 'NUMTHONG', emoji: '⭐', folderId: '12Tq9bNbpeKTazJetxmMb9xVCBvYZRWbb' },
  { id: 'ideaplan', name: 'Ideaplan Insurance', emoji: '💡', folderId: '1A6SLm1tg1sbij4ZYRunT0anBqER17bcS' },
  { id: 'pednoi', name: 'เป็ดน้อยอินชัวรันส์', emoji: '🦆', folderId: '1rbI6ePA4BtQkbR3QtiHd4bl7tofji4V5' },
];

const FEATURED_GROUP = GROUPS.find(g => g.id === 'numthong');

export default function Home() {
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [path, setPath] = useState([]);        // navigation stack: folder nodes inside the group
  const [folders, setFolders] = useState([]);  // folder cards at the current level
  const [mode, setMode] = useState(null);      // 'folders' | 'photos'
  const [photos, setPhotos] = useState([]);
  const [lightbox, setLightbox] = useState(null);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(new Set());
  const [selectMode, setSelectMode] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [maxAlert, setMaxAlert] = useState(false);

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
    if (SINGLE_GROUP_MODE && FEATURED_GROUP) {
      openGroup(FEATURED_GROUP);
    }
  }, []);

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
  const loadLevel = async (folderId) => {
    setLoading(true);
    setMode(null);
    setFolders([]);
    setPhotos([]);
    setSelectMode(false);
    setSelected(new Set());
    setCurrentPage(1);
    setMaxAlert(false);
    try {
      const fRes = await fetch(`/api/drive?type=folders&groupFolderId=${folderId}`);
      const fData = await fRes.json();
      const subs = fData.folders || [];
      if (subs.length > 0) {
        setFolders(subs);
        setMode('folders');
      } else {
        const pRes = await fetch(`/api/drive?type=photos&folderId=${folderId}`);
        const pData = await pRes.json();
        setPhotos(pData.photos || []);
        setMode('photos');
      }
    } catch (e) {
      setPhotos([]);
      setMode('photos');
    }
    setLoading(false);
  };

  const openGroup = (group) => {
    setSelectedGroup(group);
    setPath([]);
    loadLevel(group.folderId);
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
      if (selectedGroup) loadLevel(selectedGroup.folderId);
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

  const downloadSelected = async () => {
    if (selected.size === 0) return;
    setDownloading(true);
    const selectedPhotos = photos.filter(p => selected.has(p.id));
    for (let i = 0; i < selectedPhotos.length; i++) {
      const photo = selectedPhotos[i];
      setDownloadProgress(Math.round(((i + 1) / selectedPhotos.length) * 100));
      triggerDownload(photo, dlSize);
      await new Promise(r => setTimeout(r, 800));
    }
    markDownloaded(selectedPhotos.map(p => p.id));
    setDownloading(false);
    setDownloadProgress(0);
    cancelSelect();
  };

  const changePage = (page) => {
    if (page < 1 || page > totalPages) return;
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
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
        .back-btn {
          position:absolute; left:16px; top:50%; transform:translateY(-50%);
          background:rgba(255,255,255,0.08); border:1px solid rgba(255,255,255,0.12);
          color:#f0ece4; padding:7px 14px; border-radius:20px; cursor:pointer;
          font-size:12px; font-family:'NTLocalFont','Sarabun',sans-serif;
        }
        .container { padding:18px 14px; max-width:1200px; margin:0 auto; }
        .section-title { font-family:'Playfair Display',serif; font-size:13px; color:#c9a84c; letter-spacing:4px; text-transform:uppercase; margin-bottom:16px; }

        /* Breadcrumb (nested navigation) */
        .breadcrumb { display:flex; flex-wrap:wrap; align-items:center; gap:3px; margin-bottom:18px; font-size:12px; line-height:1.6; }
        .crumb { color:#c9a84c; cursor:pointer; white-space:nowrap; }
        .crumb:hover { text-decoration:underline; }
        .crumb.current { color:#f0ece4; cursor:default; }
        .crumb.current:hover { text-decoration:none; }
        .crumb-sep { color:#555; margin:0 3px; }

        /* Premium event hero */
        .hero { text-align:center; padding:26px 16px 24px; }
        .hero-kicker { font-size:11px; letter-spacing:5px; color:#c9a84c; text-transform:uppercase; }
        .hero-title { font-family:'Playfair Display',serif; font-size:30px; font-weight:700; margin:10px 0 4px; line-height:1.2; }
        .hero-title span { color:#c9a84c; }
        .hero-divider { width:48px; height:2px; background:#c9a84c; margin:12px auto; border-radius:2px; }
        .hero-sub { font-size:14px; color:#cfc8ba; }
        .hero-help { font-size:12px; color:#7e7768; margin-top:6px; }

        /* How-to guidance card */
        .howto { max-width:440px; margin:0 auto 26px; background:linear-gradient(135deg,rgba(201,168,76,0.06),rgba(255,255,255,0.02)); border:1px solid rgba(201,168,76,0.18); border-radius:14px; padding:15px 18px; }
        .howto-title { font-family:'Playfair Display',serif; font-size:12px; letter-spacing:3px; color:#c9a84c; text-transform:uppercase; text-align:center; margin-bottom:12px; }
        .howto-list { display:flex; flex-direction:column; gap:9px; }
        .howto-item { display:flex; gap:10px; align-items:flex-start; font-size:13px; color:#cfc8ba; line-height:1.5; }
        .howto-num { flex:none; width:20px; height:20px; border-radius:50%; background:rgba(201,168,76,0.15); color:#c9a84c; font-size:11px; font-weight:700; display:flex; align-items:center; justify-content:center; margin-top:1px; }
        .howto-note { margin-top:12px; padding-top:10px; border-top:1px solid rgba(255,255,255,0.06); font-size:11px; color:#8a8372; text-align:center; line-height:1.5; }

        /* Group Selection (multi-group mode only) */
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

        /* Folder grid */
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

        /* Album cover (POSTER.JPG) — large cinematic poster card */
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

        /* Toolbar */
        .toolbar { display:flex; align-items:center; gap:10px; margin-bottom:14px; flex-wrap:wrap; }
        .folder-header { display:flex; align-items:center; gap:10px; flex:1; min-width:0; }
        .folder-title { font-family:'NTLocalFont','Sarabun',sans-serif; font-size:18px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .photo-count { background:rgba(201,168,76,0.2); color:#c9a84c; border-radius:20px; padding:3px 10px; font-size:11px; font-weight:600; white-space:nowrap; font-family:'NTLocalFont','Sarabun',sans-serif; }
        .select-toggle-btn {
          background:rgba(201,168,76,0.15); border:1px solid rgba(201,168,76,0.4);
          color:#c9a84c; padding:7px 14px; border-radius:20px; cursor:pointer;
          font-family:'NTLocalFont','Sarabun',sans-serif; font-size:12px; font-weight:600; white-space:nowrap;
        }

        /* Photo Grid */
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
        .photo-num { position:absolute; bottom:6px; left:8px; font-size:10px; color:rgba(255,255,255,0.55); }

        /* Pagination */
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
        .page-info { font-size:12px; color:#666; text-align:center; margin-bottom:8px; }

        /* Max Alert */
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

        /* Select Bar */
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

        /* Progress */
        .progress-overlay {
          position:fixed; inset:0; background:rgba(0,0,0,0.92); z-index:200;
          display:flex; flex-direction:column; align-items:center; justify-content:center; gap:16px;
        }
        .progress-bar-bg { width:260px; height:6px; background:#333; border-radius:3px; overflow:hidden; }
        .progress-bar-fill { height:100%; background:#c9a84c; border-radius:3px; transition:width 0.3s; }

        /* Lightbox */
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

        /* States */
        .loading { text-align:center; padding:60px 20px; color:#666; }
        .spinner { width:34px; height:34px; border:2px solid #333; border-top-color:#c9a84c; border-radius:50%; animation:spin 0.8s linear infinite; margin:0 auto 14px; }
        @keyframes spin { to { transform:rotate(360deg); } }
        .empty { text-align:center; padding:60px 20px; color:#555; font-size:14px; }
        .app-footer { text-align:center; padding:26px 16px 40px; color:#6b6456; font-size:11px; letter-spacing:1px; border-top:1px solid rgba(255,255,255,0.05); margin-top:24px; }
      `}</style>

      {maxAlert && <div className="max-alert">⚠️ เลือกได้สูงสุด {MAX_SELECT} รูปต่อครั้ง</div>}

      {downloading && (
        <div className="progress-overlay">
          <div style={{fontSize:36}}>⬇️</div>
          <div style={{fontSize:16,fontWeight:600}}>กำลังดาวน์โหลด {selected.size} รูป...</div>
          <div className="progress-bar-bg">
            <div className="progress-bar-fill" style={{width:`${downloadProgress}%`}} />
          </div>
          <div style={{fontSize:13,color:'#888'}}>{downloadProgress}%</div>
        </div>
      )}

      {lightbox !== null && photos[lightbox] && (
        <div className="lightbox" onClick={() => setLightbox(null)}>
          <button className="lightbox-close" onClick={() => setLightbox(null)}>✕</button>
          {lightbox > 0 && (
            <button className="lightbox-nav prev" onClick={e => { e.stopPropagation(); setLightbox(lightbox - 1); }}>‹</button>
          )}
          {lightbox < photos.length - 1 && (
            <button className="lightbox-nav next" onClick={e => { e.stopPropagation(); setLightbox(lightbox + 1); }}>›</button>
          )}
          <img className="lightbox-img" src={getViewUrl(photos[lightbox])} alt="" onClick={e => e.stopPropagation()} />
          <div className="lightbox-counter">{lightbox + 1} / {photos.length}</div>
          <div className="lightbox-actions" onClick={e => e.stopPropagation()}>
            <button className="lb-btn primary" onClick={() => downloadOne(photos[lightbox], 'full')}>⬇ ขนาดเต็ม</button>
            <button className="lb-btn" onClick={() => downloadOne(photos[lightbox], 'social')}>📱 ขนาดโซเชียล</button>
          </div>
        </div>
      )}

      <div className="header">
        {selectedGroup && path.length > 0 && <button className="back-btn" onClick={back}>← กลับ</button>}
        {!SINGLE_GROUP_MODE && selectedGroup && path.length === 0 && <button className="back-btn" onClick={backToGroups}>← กลับ</button>}
        <div className="logo">NT <span>Photo</span></div>
        <div className="tagline">
          {currentFolderName ? currentFolderName :
           (SINGLE_GROUP_MODE ? 'NUMTHONG Event Gallery' :
            selectedGroup ? selectedGroup.name : 'ภาพถ่ายกิจกรรม')}
        </div>
      </div>

      <div className="container">
        {/* Step 1: Group selection (only when multi-group mode) */}
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

        {/* Breadcrumb (shown once navigated into folders) */}
        {selectedGroup && path.length > 0 && (
          <div className="breadcrumb">
            <span className="crumb" onClick={() => goToDepth(-1)}>🏠 {SINGLE_GROUP_MODE ? FEATURED_GROUP.name : selectedGroup.name}</span>
            {path.map((node, i) => (
              <span key={node.id}>
                <span className="crumb-sep">›</span>
                <span className={`crumb ${i === path.length - 1 ? 'current' : ''}`} onClick={() => goToDepth(i)}>{node.name}</span>
              </span>
            ))}
          </div>
        )}

        {/* Hero + how-to: only on the group landing (root) */}
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

        {/* Loading a level */}
        {selectedGroup && loading && (
          <div className="loading"><div className="spinner"/><div>กำลังโหลด...</div></div>
        )}

        {/* Folder cards (albums / subfolders) — any depth */}
        {selectedGroup && !loading && mode === 'folders' && (
          <>
            <div className="section-title">{path.length === 0 ? '📁 เลือกงาน / อัลบั้ม' : '📂 เลือกหมวดหมู่'}</div>
            {folders.length === 0 ? (
              <div className="empty">⚠️ ยังไม่มีโฟลเดอร์</div>
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

        {/* Photos (leaf level) */}
        {selectedGroup && !loading && mode === 'photos' && (
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
              <div className="empty">📭 ยังไม่มีภาพในอัลบั้มนี้</div>
            ) : (
              <>
                {totalPages > 1 && (
                  <div className="page-info">
                    หน้า {currentPage} / {totalPages} — รูปที่ {pageStart + 1}–{Math.min(pageStart + PHOTOS_PER_PAGE, photos.length)}
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
                  <div className="pagination">
                    <button className="page-btn arrow" onClick={() => changePage(1)} disabled={currentPage === 1}>«</button>
                    <button className="page-btn arrow" onClick={() => changePage(currentPage - 1)} disabled={currentPage === 1}>‹</button>
                    {getPageNumbers().map(n => (
                      <button key={n} className={`page-btn ${n === currentPage ? 'active' : ''}`} onClick={() => changePage(n)}>{n}</button>
                    ))}
                    <button className="page-btn arrow" onClick={() => changePage(currentPage + 1)} disabled={currentPage === totalPages}>›</button>
                    <button className="page-btn arrow" onClick={() => changePage(totalPages)} disabled={currentPage === totalPages}>»</button>
                  </div>
                )}
                {totalPages <= 1 && <div style={{paddingBottom: selectMode ? 110 : 20}} />}
              </>
            )}
          </>
        )}
      </div>

      <div className="app-footer">Created by Nithirut Chirathiraphat<br/>NT 866</div>

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
          <button className="sel-btn primary" onClick={downloadSelected} disabled={selected.size === 0}>
            ⬇ บันทึก{selected.size > 0 ? ` ${selected.size}` : ''} รูป
          </button>
        </div>
      )}
    </>
  );
}
