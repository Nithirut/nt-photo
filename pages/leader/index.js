import Head from 'next/head';
import LeaderClub from '../../components/LeaderClub';
import { COOKIE_NAME, verifySessionToken, buildClearCookie, isSecureRequest, parseCookies } from '../../lib/leaderSession';

// /leader — Protected Agency Leader club shell (Option B). Server-side session
// guard runs on every request: no/invalid/expired cookie → clear + redirect to
// /leader/login; valid cookie → render the shell. The access list is NOT
// re-read here (only at login); the session is the gate for protected pages.
export async function getServerSideProps({ req, res }) {
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive, nosnippet');
  const cookies = parseCookies(req.headers.cookie || '');
  const token = cookies[COOKIE_NAME];
  const payload = token ? verifySessionToken(token) : null;
  if (!payload) {
    if (token) res.setHeader('Set-Cookie', buildClearCookie({ secure: isSecureRequest(req) }));
    return { redirect: { destination: '/leader/login', permanent: false } };
  }
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
      <LeaderClub />
    </>
  );
}
