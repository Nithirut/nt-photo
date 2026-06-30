import { useState } from 'react';

// Protected Agency Leader club shell (rendered only after the server session
// guard passes). Shows the NT ACADEMY activity card in a "preparing" state with
// a disabled, non-navigating button (the real gallery is PR #22). Includes a
// logout action. No photos, no Drive links, no folder IDs.
export default function LeaderClub() {
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await fetch('/api/leader/logout', { method: 'POST', headers: { 'Content-Type': 'application/json' } });
    } catch (e) { /* fall through to redirect regardless */ }
    window.location.href = '/leader/login';
  };

  return (
    <main className="club-wrap">
      <style>{`
        * { box-sizing:border-box; }
        .club-wrap {
          min-height:100vh; min-height:100dvh;
          background:radial-gradient(circle at 50% 0%, #15140f 0%, #0a0a0a 62%);
          color:#f0ece4; font-family:'Sarabun',sans-serif;
          display:flex; align-items:flex-start; justify-content:center;
          padding:32px 16px calc(32px + env(safe-area-inset-bottom));
        }
        .club-card {
          width:100%; max-width:520px;
          background:linear-gradient(135deg,#1a1813,#141414);
          border:1px solid rgba(201,168,76,0.35); border-radius:20px;
          padding:26px 22px; box-shadow:0 18px 50px rgba(0,0,0,0.55);
        }
        .club-top { display:flex; align-items:center; justify-content:space-between; gap:12px; flex-wrap:wrap; }
        .club-badge { display:inline-block; font-size:11px; letter-spacing:3px; color:#c9a84c; border:1px solid rgba(201,168,76,0.5); border-radius:20px; padding:5px 12px; text-transform:uppercase; }
        .club-logout { min-height:40px; padding:8px 16px; border-radius:20px; background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.18); color:#f0ece4; font-family:'Sarabun',sans-serif; font-size:13px; cursor:pointer; }
        .club-logout:hover:not(:disabled) { border-color:#c9a84c; color:#fff; }
        .club-logout:focus-visible { outline:2px solid #c9a84c; outline-offset:2px; }
        .club-logout:disabled { opacity:0.6; cursor:not-allowed; }
        .club-word { font-family:'Playfair Display',serif; font-size:22px; font-weight:700; letter-spacing:2px; margin-top:18px; }
        .club-word span { color:#c9a84c; }
        .club-title { font-family:'Playfair Display',serif; font-size:22px; font-weight:700; margin:8px 0 2px; }
        .club-desc { font-size:13px; color:#bcb4a4; line-height:1.7; margin:10px 0 22px; }
        .activity { background:rgba(255,255,255,0.03); border:1px solid rgba(201,168,76,0.28); border-radius:16px; padding:20px 18px; }
        .activity-kicker { font-size:11px; letter-spacing:3px; color:#c9a84c; text-transform:uppercase; }
        .activity-name { font-family:'Playfair Display',serif; font-size:20px; font-weight:700; margin:6px 0 4px; }
        .activity-status { font-size:13px; color:#cfc8ba; }
        .activity-btn { margin-top:16px; min-height:48px; width:100%; border-radius:24px; border:none; background:#c9a84c; color:#1a1304; font-family:'Sarabun',sans-serif; font-size:15px; font-weight:700; cursor:pointer; text-decoration:none; display:inline-flex; align-items:center; justify-content:center; }
        .activity-btn:hover { background:#d8b95e; }
        .activity-btn:focus-visible { outline:2px solid #fff; outline-offset:2px; }
        .club-foot { margin-top:18px; font-size:11px; color:#8a8273; text-align:center; line-height:1.6; }
        @media (prefers-reduced-motion: reduce) { .club-logout { transition:none; } }
      `}</style>

      <section className="club-card" aria-labelledby="club-title">
        <div className="club-top">
          <div className="club-badge">PRIVATE ACCESS</div>
          <button type="button" className="club-logout" onClick={handleLogout} disabled={loggingOut} aria-label="ออกจากระบบ">
            {loggingOut ? 'กำลังออก…' : 'ออกจากระบบ'}
          </button>
        </div>

        <div className="club-word">NT <span>Photo</span></div>
        <h1 id="club-title" className="club-title">Agency Leader Numthong</h1>
        <p className="club-desc">พื้นที่กิจกรรมสำหรับผู้บริหารเครือนำทอง</p>

        <div className="activity" aria-labelledby="activity-name">
          <div className="activity-kicker">กิจกรรม</div>
          <div id="activity-name" className="activity-name">NT ACADEMY</div>
          <div className="activity-status">เปิดให้เข้าชมแล้ว</div>
          <a className="activity-btn" href="/leader/gallery">เข้าสู่ NT ACADEMY</a>
        </div>

        <p className="club-foot">พื้นที่ส่วนตัวสำหรับผู้บริหารเครือนำทองที่ได้รับสิทธิ์เท่านั้น</p>
      </section>
    </main>
  );
}
