import { useState, useEffect, useCallback } from 'react';
import LeaderPhotoModal from './LeaderPhotoModal';

// Protected NT ACADEMY gallery grid. Fetches opaque photo tokens from the
// session-guarded API, lazy-loads grid thumbnails through the protected image
// proxy, and opens the original in a modal. No Drive URL / folder ID / file ID
// ever appears client-side. On 401 it bounces to the login page.
const PAGE_SIZE = 30;

export default function LeaderGallery() {
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [nextOffset, setNextOffset] = useState(0);
  const [status, setStatus] = useState('loading'); // loading | ready | error | loadingMore
  const [active, setActive] = useState(null); // {token,name}
  const [loggingOut, setLoggingOut] = useState(false);

  const loadPage = useCallback(async (offset) => {
    setStatus(offset === 0 ? 'loading' : 'loadingMore');
    try {
      const res = await fetch(`/api/leader/photos?offset=${offset}&limit=${PAGE_SIZE}`, { headers: { Accept: 'application/json' } });
      if (res.status === 401) { window.location.href = '/leader/login'; return; }
      if (!res.ok) { setStatus('error'); return; }
      const data = await res.json();
      setItems((prev) => (offset === 0 ? data.items : prev.concat(data.items)));
      setTotal(data.total || 0);
      setNextOffset(data.nextOffset);
      setStatus('ready');
    } catch (e) {
      setStatus('error');
    }
  }, []);

  useEffect(() => { loadPage(0); }, [loadPage]);

  const handleLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try { await fetch('/api/leader/logout', { method: 'POST', headers: { 'Content-Type': 'application/json' } }); } catch (e) {}
    window.location.href = '/leader/login';
  };

  return (
    <main className="gal-wrap">
      <style>{`
        .gal-wrap { min-height:100vh; min-height:100dvh; color:#f0ece4; font-family:'Sarabun',sans-serif;
          background:radial-gradient(circle at 50% 0%, #15140f 0%, #0a0a0a 62%);
          padding:20px 16px calc(28px + env(safe-area-inset-bottom)); }
        .gal-inner { width:100%; max-width:1280px; margin:0 auto; }
        .gal-top { display:flex; align-items:center; justify-content:space-between; gap:12px; flex-wrap:wrap; }
        .gal-actions { display:flex; gap:10px; }
        .gal-btn { min-height:40px; padding:8px 14px; border-radius:20px; font-family:'Sarabun',sans-serif; font-size:13px; cursor:pointer;
          border:1px solid rgba(255,255,255,0.18); background:rgba(255,255,255,0.06); color:#f0ece4; text-decoration:none; display:inline-flex; align-items:center; }
        .gal-btn:hover:not(:disabled) { border-color:#c9a84c; color:#fff; }
        .gal-btn:focus-visible { outline:2px solid #c9a84c; outline-offset:2px; }
        .gal-badge { display:inline-block; font-size:11px; letter-spacing:3px; color:#c9a84c; border:1px solid rgba(201,168,76,0.5); border-radius:20px; padding:4px 12px; text-transform:uppercase; }
        .gal-word { font-family:'Playfair Display',serif; font-size:20px; font-weight:700; letter-spacing:2px; margin-top:14px; }
        .gal-word span { color:#c9a84c; }
        .gal-title { font-family:'Playfair Display',serif; font-size:22px; font-weight:700; margin:6px 0 2px; }
        .gal-count { font-size:13px; color:#bcb4a4; margin:2px 0 16px; }
        .gal-grid { display:grid; grid-template-columns:repeat(2,1fr); gap:10px; }
        @media (min-width:640px){ .gal-grid { grid-template-columns:repeat(3,1fr); } }
        @media (min-width:1024px){ .gal-grid { grid-template-columns:repeat(4,1fr); } }
        @media (min-width:1440px){ .gal-grid { grid-template-columns:repeat(5,1fr); } }
        .gal-cell { position:relative; aspect-ratio:1/1; border:none; padding:0; border-radius:12px; overflow:hidden;
          background:#1a1813; cursor:pointer; }
        .gal-cell:focus-visible { outline:2px solid #c9a84c; outline-offset:2px; }
        .gal-cell img { width:100%; height:100%; object-fit:cover; display:block; }
        .gal-skel { aspect-ratio:1/1; border-radius:12px; background:linear-gradient(100deg,#161512,#211f18,#161512); background-size:200% 100%; animation:galsk 1.3s ease-in-out infinite; }
        @keyframes galsk { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
        @media (prefers-reduced-motion: reduce){ .gal-skel { animation:none; } }
        .gal-state { padding:40px 8px; text-align:center; color:#bcb4a4; font-size:14px; line-height:1.7; }
        .gal-more { display:flex; justify-content:center; margin-top:20px; }
        .gal-more .gal-btn { min-height:48px; padding:12px 28px; background:#c9a84c; color:#1a1304; border:none; font-weight:700; font-size:15px; }
      `}</style>

      <div className="gal-inner">
        <div className="gal-top">
          <div>
            <div className="gal-badge">PRIVATE ACCESS</div>
            <div className="gal-word">NT <span>Photo</span></div>
          </div>
          <div className="gal-actions">
            <a className="gal-btn" href="/leader">กลับหน้าหลัก</a>
            <button type="button" className="gal-btn" onClick={handleLogout} disabled={loggingOut} aria-label="ออกจากระบบ">
              {loggingOut ? 'กำลังออก…' : 'ออกจากระบบ'}
            </button>
          </div>
        </div>

        <h1 className="gal-title">Agency Leader Numthong — NT ACADEMY</h1>
        <p className="gal-count">
          {status === 'ready' || status === 'loadingMore'
            ? `แสดง ${items.length} จาก ${total} ภาพ`
            : status === 'loading' ? 'กำลังโหลดภาพ…' : ' '}
        </p>

        {status === 'loading' && (
          <div className="gal-grid" aria-hidden="true">
            {Array.from({ length: 12 }).map((_, i) => <div key={i} className="gal-skel" />)}
          </div>
        )}

        {status === 'error' && (
          <div className="gal-state" role="alert">
            โหลดแกลเลอรีไม่สำเร็จ กรุณาลองใหม่อีกครั้ง<br />
            <button type="button" className="gal-btn" style={{ marginTop: 12 }} onClick={() => loadPage(0)}>ลองใหม่</button>
          </div>
        )}

        {(status === 'ready' || status === 'loadingMore') && items.length === 0 && (
          <div className="gal-state">ยังไม่มีภาพในแกลเลอรีนี้</div>
        )}

        {(status === 'ready' || status === 'loadingMore') && items.length > 0 && (
          <div className="gal-grid">
            {items.map((it) => (
              <button
                key={it.token}
                type="button"
                className="gal-cell"
                onClick={() => setActive(it)}
                aria-label={`เปิดภาพ ${it.name || ''}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/api/leader/image/${encodeURIComponent(it.token)}?size=thumb`} alt={it.name || 'NT ACADEMY photo'} loading="lazy" />
              </button>
            ))}
          </div>
        )}

        {(status === 'ready' || status === 'loadingMore') && nextOffset != null && (
          <div className="gal-more">
            <button type="button" className="gal-btn" disabled={status === 'loadingMore'} onClick={() => loadPage(nextOffset)}>
              {status === 'loadingMore' ? 'กำลังโหลด…' : 'โหลดเพิ่ม'}
            </button>
          </div>
        )}
      </div>

      {active && <LeaderPhotoModal token={active.token} name={active.name} onClose={() => setActive(null)} />}
    </main>
  );
}
