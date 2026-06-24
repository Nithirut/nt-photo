import Gallery from '../components/Gallery';

// PR-A (route foundation): `/` still renders the existing Gallery, so there is no
// visible change at the root. The Gallery implementation now lives in the shared
// component components/Gallery.jsx, used by both `/` and `/gallery`. The Homepage
// UI is introduced in a later PR; the root page is NOT switched to a homepage here.
export default function HomePage() {
  return <Gallery />;
}
