import '../styles/globals.css';

// Custom App: the only purpose here is to load the global stylesheet (Next.js
// allows global CSS to be imported only from _app). Behavior is otherwise the
// Next.js default — render the active page unchanged.
export default function App({ Component, pageProps }) {
  return <Component {...pageProps} />;
}
