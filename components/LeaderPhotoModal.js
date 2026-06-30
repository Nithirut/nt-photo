import { useEffect, useRef } from 'react';

// Full-image view for one NT ACADEMY photo. Loads the ORIGINAL via the
// protected, session-checked image endpoint and offers a single-photo download
// (Content-Disposition handled server-side). No Drive URL / file ID is exposed.
export default function LeaderPhotoModal({ token, name, onClose }) {
  const closeRef = useRef(null);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    if (closeRef.current) closeRef.current.focus();
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (!token) return null;
  const src = `/api/leader/image/${encodeURIComponent(token)}`;
  const dl = `/api/leader/download/${encodeURIComponent(token)}`;

  return (
    <div
      className="lpm-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="ดูภาพขนาดใหญ่"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <style>{`
        .lpm-overlay {
          position:fixed; inset:0; z-index:50;
          background:rgba(5,5,5,0.92);
          display:flex; flex-direction:column;
          padding:calc(12px + env(safe-area-inset-top)) 12px calc(12px + env(safe-area-inset-bottom));
        }
        .lpm-bar { display:flex; align-items:center; justify-content:flex-end; gap:10px; }
        .lpm-btn {
          min-height:44px; padding:8px 16px; border-radius:22px;
          font-family:'Sarabun',sans-serif; font-size:14px; cursor:pointer;
          border:1px solid rgba(255,255,255,0.18); background:rgba(255,255,255,0.06); color:#f0ece4;
        }
        .lpm-btn.dl { background:#c9a84c; color:#1a1304; border:none; font-weight:700; text-decoration:none; display:inline-flex; align-items:center; }
        .lpm-btn:focus-visible, .lpm-btn.dl:focus-visible { outline:2px solid #fff; outline-offset:2px; }
        .lpm-stage { flex:1; display:flex; align-items:center; justify-content:center; min-height:0; margin-top:10px; }
        .lpm-img { max-width:100%; max-height:100%; object-fit:contain; border-radius:8px; }
      `}</style>

      <div className="lpm-bar">
        <a className="lpm-btn dl" href={dl} download>ดาวน์โหลด</a>
        <button type="button" className="lpm-btn" ref={closeRef} onClick={onClose} aria-label="ปิด">ปิด</button>
      </div>
      <div className="lpm-stage">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="lpm-img" src={src} alt={name || 'NT ACADEMY photo'} />
      </div>
    </div>
  );
}
