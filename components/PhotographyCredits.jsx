// Photography Credits — NT Photo team showcase.
// Static, confirmed data only, split into two groups:
//   Lead Team  (Beer, Lookkeaw)          — larger cards, shown first.
//   Photo Team (Farland, Futamin, Home)  — smaller cards, same team look.
// Data-array driven so more photographers can be added later without touching
// the markup. Roles/credits render as premium dark-gold pill badges. No
// placeholders, no unconfirmed data.
const photographers = {
  lead: [
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
      name: 'นิธิรุจน์ จิราธีระพัฒน์',
      roles: ['Second Shooter', 'Gallery Creator'],
      credits: ['LICA Photo Team', 'NT Photo Team', 'NT866'],
    },
  ],
  team: [
    {
      key: 'farland',
      img: '/photographers/Farland_1.png',
      nickname: 'ฟาแลนด์',
      name: 'สุภาณี จันทร์ภาค',
      roles: ['Main Photographer', 'Second Shooter'],
      credits: ['NT Photo', 'Openhouse', 'Nextgen', 'Leader', 'NT1193'],
    },
    {
      key: 'futamin',
      img: '/photographers/Futamin_1.png',
      nickname: 'ฟุ๊',
      name: 'วีระเกียรติ เสวตวิวัฒน์',
      roles: ['Main Photographer', 'Candid Photographer'],
      credits: ['NT Photo', 'FA CLUB', 'NFC CLUB', 'Turn PRO', 'NT217'],
    },
    {
      key: 'home',
      img: '/photographers/Home_1.png',
      nickname: 'โฮม',
      name: 'หัชพงษ์ พาเลิศชัยวงศ์',
      roles: ['Backup Photographer', 'Second Shooter'],
      credits: ['NT Photo', 'NT350'],
    },
  ],
};

function Card({ p, tier }) {
  return (
    <article className={`pc-card ${tier}`}>
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
  );
}

export default function PhotographyCredits() {
  return (
    <section className="pc-wrap" aria-labelledby="pc-title">
      <style>{`
        .pc-wrap { background:#0a0a0a; padding:40px 16px 40px; border-top:1px solid rgba(255,255,255,0.05); }
        .pc-inner { width:100%; max-width:820px; margin:0 auto; }
        .pc-kicker { text-align:center; color:#c9a84c; font-family:'Sarabun',sans-serif; font-size:11px; letter-spacing:4px; text-transform:uppercase; }
        .pc-title { text-align:center; font-family:'Playfair Display',serif; color:#f0ece4; font-size:24px; font-weight:700; margin:6px 0 24px; }
        /* Group label above each tier (Lead Team / Photo Team). */
        .pc-group { text-align:center; color:#c9a84c; font-family:'Sarabun',sans-serif; font-size:12px; letter-spacing:3px; text-transform:uppercase; margin:0 0 14px; }
        .pc-group.second { margin-top:30px; }
        /* Flex rows center each tier and wrap gracefully: on mobile a lone last
           card (โฮม) centers itself; no horizontal overflow at any width. */
        .pc-row { display:flex; flex-wrap:wrap; justify-content:center; gap:16px; }
        .pc-card { background:linear-gradient(135deg,#1a1a1a,#141414); border:1px solid rgba(201,168,76,0.22); border-radius:14px; overflow:hidden; display:flex; flex-direction:column; }
        /* Sizes give a clear hierarchy: Lead cards are bigger than Photo Team,
           but both keep the same 4:5 shell so the team reads as one group. */
        .pc-card.lead { width:100%; max-width:260px; }
        .pc-card.team { width:calc(50% - 8px); max-width:190px; }
        @media (min-width:640px){
          .pc-card.lead { width:300px; max-width:300px; }
          .pc-card.team { width:230px; max-width:230px; }
        }
        /* 4:5 photo shell. Portrait sources ≈4:5 (Lookkeaw/Farland/Futamin) fit with
           no crop; the 2:3 sources (Beer/Home) lose small equal top/bottom margins
           only — face stays centered, head + camera preserved as far as the frame allows. */
        .pc-photo { aspect-ratio:4/5; background:#141414; position:relative; overflow:hidden; }
        .pc-photo img { position:absolute; inset:0; width:100%; height:100%; object-fit:cover; object-position:center; display:block; }
        .pc-body { padding:12px 14px 16px; }
        .pc-nick { font-family:'Playfair Display',serif; color:#c9a84c; font-weight:700; line-height:1.2; }
        .pc-card.lead .pc-nick { font-size:18px; }
        .pc-card.team .pc-nick { font-size:16px; }
        .pc-name { color:#e7dfce; font-family:'Sarabun',sans-serif; margin-top:3px; }
        .pc-card.lead .pc-name { font-size:14px; }
        .pc-card.team .pc-name { font-size:13px; }
        .pc-badges { display:flex; flex-wrap:wrap; gap:6px; }
        .pc-badges.roles { margin-top:12px; }
        .pc-badges.team { margin-top:8px; }
        .pc-badge { display:inline-flex; align-items:center; border-radius:999px; padding:4px 10px; font-family:'Sarabun',sans-serif; font-size:12px; line-height:1.35; white-space:nowrap; cursor:default; }
        .pc-card.team .pc-badge { font-size:11px; padding:3px 9px; }
        .pc-badge.role { background:rgba(201,168,76,0.12); border:1px solid rgba(201,168,76,0.55); color:#f3e6c0; font-weight:600; }
        .pc-badge.credit { background:#1c1b17; border:1px solid rgba(201,168,76,0.26); color:#cfc8ba; font-weight:400; }
        /* Subtle hover lift; disabled for reduced-motion. */
        .pc-card { transition:transform 0.25s ease, border-color 0.25s ease, box-shadow 0.25s ease; }
        .pc-card:hover { transform:translateY(-3px); border-color:#c9a84c; box-shadow:0 14px 40px rgba(201,168,76,0.18); }
        @media (prefers-reduced-motion: reduce){ .pc-card { transition:none; } .pc-card:hover { transform:none; } }
      `}</style>
      <div className="pc-inner">
        <div className="pc-kicker">Photography</div>
        <h2 id="pc-title" className="pc-title">ทีมช่างภาพ</h2>

        <div className="pc-group">Lead Team</div>
        <div className="pc-row">
          {photographers.lead.map((p) => (
            <Card key={p.key} p={p} tier="lead" />
          ))}
        </div>

        <div className="pc-group second">Photo Team</div>
        <div className="pc-row">
          {photographers.team.map((p) => (
            <Card key={p.key} p={p} tier="team" />
          ))}
        </div>
      </div>
    </section>
  );
}
