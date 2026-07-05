// Photography Credits — NT Photo team showcase.
// Static, confirmed data only: two photographers in the approved order
// (Beer, then Lookkeaw). Roles and team/credits are rendered as premium
// dark-gold badges (non-interactive). No placeholders, no unconfirmed data.
const PHOTOGRAPHERS = [
  {
    key: 'beer',
    img: '/photographers/BEER-4.png',
    nickname: 'เบียร์',
    name: 'รัชภูมิ มั่งคั่ง',
    roles: ['Main Photographer', 'Lead Photographer'],
    credits: ['NT Photo Team', 'Open House', 'NT1346'],
  },
  {
    key: 'lookkeaw',
    img: '/photographers/Lookkeaw-4.png',
    nickname: 'ลูกแก้ว',
    name: null,
    roles: ['Second Shooter', 'Gallery Creator'],
    credits: ['LICA Photo Team', 'NT Photo Team', 'NT866'],
  },
];

export default function PhotographyCredits() {
  return (
    <section className="pc-wrap" aria-labelledby="pc-title">
      <style>{`
        .pc-wrap { background:#0a0a0a; padding:48px 16px 44px; border-top:1px solid rgba(255,255,255,0.05); }
        .pc-inner { width:100%; max-width:960px; margin:0 auto; }
        .pc-kicker { text-align:center; color:#c9a84c; font-family:'Sarabun',sans-serif; font-size:11px; letter-spacing:4px; text-transform:uppercase; }
        .pc-title { text-align:center; font-family:'Playfair Display',serif; color:#f0ece4; font-size:26px; font-weight:700; margin:8px 0 28px; }
        .pc-grid { display:grid; grid-template-columns:1fr; gap:20px; }
        @media (min-width:640px){ .pc-grid { grid-template-columns:1fr 1fr; gap:24px; } }
        .pc-card { background:linear-gradient(135deg,#1a1a1a,#141414); border:1px solid rgba(201,168,76,0.22); border-radius:16px; overflow:hidden; display:flex; flex-direction:column; }
        /* 2/3 matches BEER-4 (1023x1537 ≈ 2:3) exactly → no vertical crop, camera preserved.
           Lookkeaw-4 (1122x1402 ≈ 4:5) only loses small equal side margins; subject stays centered. */
        .pc-photo { aspect-ratio:2/3; background:#141414; }
        .pc-photo img { width:100%; height:100%; object-fit:cover; object-position:center; display:block; }
        .pc-body { padding:16px 18px 20px; }
        .pc-nick { font-family:'Playfair Display',serif; color:#c9a84c; font-size:20px; font-weight:700; line-height:1.2; }
        .pc-name { color:#e7dfce; font-family:'Sarabun',sans-serif; font-size:14px; margin-top:3px; }
        /* Non-interactive badge groups. Roles read as the primary group; team/credits secondary. */
        .pc-badges { display:flex; flex-wrap:wrap; gap:6px; }
        .pc-badges.roles { margin-top:14px; }
        .pc-badges.team { margin-top:8px; }
        .pc-badge { display:inline-flex; align-items:center; border-radius:999px; padding:4px 11px; font-family:'Sarabun',sans-serif; font-size:12px; line-height:1.35; white-space:nowrap; cursor:default; }
        .pc-badge.role { background:rgba(201,168,76,0.12); border:1px solid rgba(201,168,76,0.55); color:#f3e6c0; font-weight:600; }
        .pc-badge.credit { background:#1c1b17; border:1px solid rgba(201,168,76,0.26); color:#cfc8ba; font-weight:400; }
      `}</style>
      <div className="pc-inner">
        <div className="pc-kicker">Photography</div>
        <h2 id="pc-title" className="pc-title">ทีมช่างภาพ</h2>
        <div className="pc-grid">
          {PHOTOGRAPHERS.map((p) => (
            <article className="pc-card" key={p.key}>
              <div className="pc-photo">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.img} alt={`ช่างภาพ ${p.nickname}`} loading="lazy" />
              </div>
              <div className="pc-body">
                <div className="pc-nick">{p.nickname}</div>
                {p.name && <div className="pc-name">{p.name}</div>}
                <div className="pc-badges roles" aria-label="บทบาท">
                  {p.roles.map((r) => (
                    <span className="pc-badge role" key={r}>{r}</span>
                  ))}
                </div>
                <div className="pc-badges team" aria-label="ทีม / เครดิต">
                  {p.credits.map((c) => (
                    <span className="pc-badge credit" key={c}>{c}</span>
                  ))}
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
