import Head from 'next/head';

// /leader — Protected Leader Club (Option B). The real club is NOT enabled yet:
// it awaits the owner-provided passcode.txt and a real session. There is no
// session to verify, so this renders ONLY a locked placeholder with no NT
// ACADEMY content. When sessions exist, getServerSideProps will verify the
// HttpOnly session cookie here and redirect unauthenticated visitors to
// /leader/login (and the protected gallery + download APIs will require it).
export async function getServerSideProps({ res }) {
  res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive, nosnippet');
  return { props: {} };
}

export default function LeaderHomePage() {
  return (
    <>
      <Head>
        <title>Agency Leader Numthong — Private</title>
        <meta name="robots" content="noindex, nofollow, noarchive, nosnippet" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <link
          href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700&family=Sarabun:wght@300;400;600&display=swap"
          rel="stylesheet"
        />
      </Head>
      <main className="leader-locked-wrap">
        <style>{`
          * { box-sizing:border-box; }
          .leader-locked-wrap {
            min-height:100vh; min-height:100dvh;
            background:radial-gradient(circle at 50% 0%, #15140f 0%, #0a0a0a 62%);
            color:#f0ece4; font-family:'Sarabun',sans-serif;
            display:flex; align-items:center; justify-content:center;
            padding:24px 16px calc(24px + env(safe-area-inset-bottom));
          }
          .leader-locked-card {
            width:100%; max-width:460px; text-align:center;
            background:linear-gradient(135deg,#1a1813,#141414);
            border:1px solid rgba(201,168,76,0.35); border-radius:20px;
            padding:30px 22px; box-shadow:0 18px 50px rgba(0,0,0,0.55);
          }
          .leader-locked-badge {
            display:inline-block; font-size:11px; letter-spacing:3px; color:#c9a84c;
            border:1px solid rgba(201,168,76,0.5); border-radius:20px; padding:5px 12px; text-transform:uppercase;
          }
          .leader-locked-word { font-family:'Playfair Display',serif; font-size:22px; font-weight:700; letter-spacing:2px; margin-top:16px; }
          .leader-locked-word span { color:#c9a84c; }
          .leader-locked-title { font-family:'Playfair Display',serif; font-size:20px; font-weight:700; margin:10px 0 2px; }
          .leader-locked-sub { font-size:13px; letter-spacing:4px; color:#c9a84c; text-transform:uppercase; }
          .leader-locked-text { font-size:13px; color:#bcb4a4; line-height:1.7; margin:14px 0 20px; }
          .leader-locked-btn {
            display:inline-block; min-height:48px; line-height:24px; padding:12px 24px;
            border-radius:24px; background:#c9a84c; color:#1a1304; font-weight:700;
            font-size:15px; text-decoration:none;
          }
          .leader-locked-btn:focus-visible { outline:2px solid #ffffff; outline-offset:2px; }
        `}</style>
        <section className="leader-locked-card" aria-labelledby="leader-locked-title">
          <div className="leader-locked-badge">PRIVATE ACCESS</div>
          <div className="leader-locked-word">NT <span>Photo</span></div>
          <h1 id="leader-locked-title" className="leader-locked-title">Agency Leader Numthong</h1>
          <div className="leader-locked-sub">NT ACADEMY</div>
          <p className="leader-locked-text">พื้นที่นี้เป็นส่วนตัวสำหรับผู้นำหน่วยที่ได้รับสิทธิ์ กรุณาเข้าสู่ระบบเพื่อดำเนินการต่อ</p>
          <a className="leader-locked-btn" href="/leader/login">เข้าสู่ระบบ</a>
        </section>
      </main>
    </>
  );
}
