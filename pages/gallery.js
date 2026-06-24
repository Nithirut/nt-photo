import Gallery from '../components/Gallery';

// `/gallery` renders the same shared Gallery component as `/` (single source of
// truth: components/Gallery.jsx). No behavior difference from the root route.
export default function GalleryPage() {
  return <Gallery />;
}
