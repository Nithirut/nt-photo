import { useState, useEffect } from 'react';
import Head from 'next/head';

export default function Home() {
  const [folders, setFolders] = useState([]);
  const [selectedFolder, setSelectedFolder] = useState(null);
  const [photos, setPhotos] = useState([]);
  const [lightbox, setLightbox] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingFolders, setLoadingFolders] = useState(true);

  useEffect(() => {
    fetch('/api/drive?type=folders')
      .then(r => r.json())
      .then(data => {
        setFolders(data.folders || []);
        setLoadingFolders(false);
      })
      .catch(() => setLoadingFolders(false));
  }, []);

  const openFolder = async (folder) => {
    setSelectedFolder(folder);
    setPhotos([]);
    setLoading(true);
    const res = await fetch(`/api/drive?type=photos&folderId=${folder.id}`);
    const data = await res.json();
    setPhotos(data.photos || []);
    setLoading(false);
  };

  const getImageUrl = (photo) => {
    return `https://drive.google.com/thumbnail?id=${photo.id}&sz=w800`;
  };

  const getDownloadUrl = (photo) => {
    return `https://drive.google.com/uc?export=download&id=${photo.id}`;
  };

  const getFullUrl = (photo) => {
    return `https://drive.google.com/uc?export=view&id=${photo.id}`;
  };

  return (
    <>
      <Head>
        <title>NT Photo — นำทอง</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700&family=Sarabun:wght@300;400;600&display=swap" rel="stylesheet" />
      </Head>

      <style>{`
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          background: #0a0a0a;
          color: #f0ece4;
          font-family: 'Sarabun', sans-serif;
          min-height: 100vh;
        }
        .header {
          background: linear-gradient(180deg, #111 0%, transparent 100%);
          padding: 32px 20px 24px;
          text-align: center;
          position: sticky;
          top: 0;
          z-index: 10;
          backdrop-filter: blur(12px);
          border-bottom: 1px solid rgba(255,255,255,0.06);
        }
        .logo {
          font-family: 'Playfair Display', serif;
          font-size: 28px;
          font-weight: 700;
          letter-spacing: 3px;
          color: #f0ece4;
        }
        .logo span { color: #c9a84c; }
        .tagline {
          font-size: 12px;
          color: #888;
          letter-spacing: 4px;
          text-transform: uppercase;
          margin-top: 4px;
        }
        .back-btn {
          position: absolute;
          left: 20px;
          top: 50%;
          transform: translateY(-50%);
          background: rgba(255,255,255,0.08);
          border: 1px solid rgba(255,255,255,0.12);
          color: #f0ece4;
          padding: 8px 16px;
          border-radius: 20px;
          cursor: pointer;
          font-size: 13px;
          font-family: 'Sarabun', sans-serif;
        }
        .back-btn:hover { background: rgba(255,255,255,0.14); }
        .container { padding: 24px 16px; max-width: 1200px; margin: 0 auto; }
        .section-title {
          font-family: 'Playfair Display', serif;
          font-size: 14px;
          color: #c9a84c;
          letter-spacing: 4px;
          text-transform: uppercase;
          margin-bottom: 20px;
        }
        .folder-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
          gap: 14px;
        }
        .folder-card {
          background: linear-gradient(135deg, #1a1a1a, #141414);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 16px;
          padding: 24px 16px;
          text-align: center;
          cursor: pointer;
          transition: all 0.25s ease;
        }
        .folder-card:hover {
          border-color: #c9a84c;
          transform: translateY(-3px);
          background: linear-gradient(135deg, #1e1e1e, #181818);
          box-shadow: 0 8px 32px rgba(201,168,76,0.15);
        }
        .folder-icon { font-size: 36px; margin-bottom: 10px; }
        .folder-name {
          font-size: 13px;
          font-weight: 600;
          color: #f0ece4;
          line-height: 1.4;
        }
        .photo-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
          gap: 8px;
        }
        .photo-item {
          position: relative;
          aspect-ratio: 1;
          border-radius: 10px;
          overflow: hidden;
          cursor: pointer;
          background: #1a1a1a;
        }
        .photo-item img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          transition: transform 0.3s ease;
        }
        .photo-item:hover img { transform: scale(1.05); }
        .photo-overlay {
          position: absolute;
          inset: 0;
          background: linear-gradient(to top, rgba(0,0,0,0.6) 0%, transparent 60%);
          opacity: 0;
          transition: opacity 0.3s;
          display: flex;
          align-items: flex-end;
          justify-content: center;
          padding-bottom: 10px;
        }
        .photo-item:hover .photo-overlay { opacity: 1; }
        .photo-overlay-icon { font-size: 20px; }
        .folder-header {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 20px;
        }
        .folder-title {
          font-family: 'Playfair Display', serif;
          font-size: 20px;
          color: #f0ece4;
        }
        .photo-count {
          background: rgba(201,168,76,0.2);
          color: #c9a84c;
          border-radius: 20px;
          padding: 3px 12px;
          font-size: 12px;
          font-weight: 600;
        }
        .loading {
          text-align: center;
          padding: 60px 20px;
          color: #666;
        }
        .spinner {
          width: 36px; height: 36px;
          border: 2px solid #333;
          border-top-color: #c9a84c;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
          margin: 0 auto 16px;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        .empty {
          text-align: center;
          padding: 60px 20px;
          color: #555;
          font-size: 14px;
        }

        /* LIGHTBOX */
        .lightbox {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.95);
          z-index: 100;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 20px;
        }
        .lightbox-img {
          max-width: 100%;
          max-height: 75vh;
          border-radius: 8px;
          object-fit: contain;
        }
        .lightbox-actions {
          display: flex;
          gap: 12px;
          margin-top: 20px;
        }
        .lb-btn {
          background: rgba(255,255,255,0.1);
          border: 1px solid rgba(255,255,255,0.15);
          color: #f0ece4;
          padding: 10px 24px;
          border-radius: 24px;
          cursor: pointer;
          font-family: 'Sarabun', sans-serif;
          font-size: 14px;
          text-decoration: none;
          display: inline-block;
        }
        .lb-btn.primary {
          background: #c9a84c;
          border-color: #c9a84c;
          color: #000;
          font-weight: 600;
        }
        .lightbox-close {
          position: absolute;
          top: 20px;
          right: 20px;
          background: rgba(255,255,255,0.1);
          border: none;
          color: #fff;
          width: 40px; height: 40px;
          border-radius: 50%;
          cursor: pointer;
          font-size: 18px;
        }
        .lightbox-nav {
          position: absolute;
          top: 50%;
          transform: translateY(-50%);
          background: rgba(255,255,255,0.1);
          border: none;
          color: #fff;
          width: 44px; height: 44px;
          border-radius: 50%;
          cursor: pointer;
          font-size: 20px;
        }
        .lightbox-nav.prev { left: 12px; }
        .lightbox-nav.next { right: 12px; }
      `}</style>

      {/* LIGHTBOX */}
      {lightbox !== null && photos[lightbox] && (
        <div className="lightbox" onClick={() => setLightbox(null)}>
          <button className="lightbox-close" onClick={() => setLightbox(null)}>✕</button>
          {lightbox > 0 && (
            <button className="lightbox-nav prev" onClick={e => { e.stopPropagation(); setLightbox(lightbox - 1); }}>‹</button>
          )}
          {lightbox < photos.length - 1 && (
            <button className="lightbox-nav next" onClick={e => { e.stopPropagation(); setLightbox(lightbox + 1); }}>›</button>
          )}
          <img
            className="lightbox-img"
            src={getFullUrl(photos[lightbox])}
            alt={photos[lightbox].name}
            onClick={e => e.stopPropagation()}
          />
          <div className="lightbox-actions" onClick={e => e.stopPropagation()}>
            <a className="lb-btn primary" href={getDownloadUrl(photos[lightbox])} download>
              ⬇ ดาวน์โหลด
            </a>
            <button className="lb-btn" onClick={() => setLightbox(null)}>ปิด</button>
          </div>
        </div>
      )}

      {/* HEADER */}
      <div className="header" style={{ position: 'relative' }}>
        {selectedFolder && (
          <button className="back-btn" onClick={() => { setSelectedFolder(null); setPhotos([]); }}>
            ← กลับ
          </button>
        )}
        <div className="logo">NT <span>Photo</span></div>
        <div className="tagline">นำทอง — ภาพถ่ายกิจกรรม</div>
      </div>

      <div className="container">
        {/* FOLDER LIST */}
        {!selectedFolder && (
          <>
            <div className="section-title">📁 เลือกงาน / อัลบั้ม</div>
            {loadingFolders ? (
              <div className="loading">
                <div className="spinner"></div>
                <div>กำลังโหลด...</div>
              </div>
            ) : folders.length === 0 ? (
              <div className="empty">⚠️ ยังไม่มีอัลบั้ม</div>
            ) : (
              <div className="folder-grid">
                {folders.map(folder => (
                  <div key={folder.id} className="folder-card" onClick={() => openFolder(folder)}>
                    <div className="folder-icon">📸</div>
                    <div className="folder-name">{folder.name}</div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* PHOTO GRID */}
        {selectedFolder && (
          <>
            <div className="folder-header">
              <div className="folder-title">{selectedFolder.name}</div>
              {photos.length > 0 && (
                <span className="photo-count">{photos.length} รูป</span>
              )}
            </div>
            {loading ? (
              <div className="loading">
                <div className="spinner"></div>
                <div>กำลังโหลดภาพ...</div>
              </div>
            ) : photos.length === 0 ? (
              <div className="empty">📭 ไม่มีภาพในอัลบั้มนี้</div>
            ) : (
              <div className="photo-grid">
                {photos.map((photo, i) => (
                  <div key={photo.id} className="photo-item" onClick={() => setLightbox(i)}>
                    <img
                      src={getImageUrl(photo)}
                      alt={photo.name}
                      loading="lazy"
                    />
                    <div className="photo-overlay">
                      <span className="photo-overlay-icon">🔍</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
