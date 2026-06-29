import Head from 'next/head';
import LeaderLogin from '../../components/LeaderLogin';

// Private area. Keep search engines out at the HTTP layer (X-Robots-Tag) in
// addition to the <meta name="robots"> below — belt and suspenders.
export async function getServerSideProps({ res }) {
  res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive, nosnippet');
  return { props: {} };
}

export default function LeaderLoginPage() {
  return (
    <>
      <Head>
        <title>Login for Agency Leader Numthong</title>
        <meta name="robots" content="noindex, nofollow, noarchive, nosnippet" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <link
          href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700&family=Sarabun:wght@300;400;600&display=swap"
          rel="stylesheet"
        />
      </Head>
      <LeaderLogin />
    </>
  );
}
