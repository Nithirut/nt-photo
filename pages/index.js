import { useState, useEffect } from 'react';
import Head from 'next/head';

export default function Home() {
  const [folders, setFolders] = useState([]);
  const [selectedFolder, setSelectedFolder] = useState(null);
  const [photos, setPhotos] = useState([]);
  const [lightbox, setLightbox] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingFolders, setLoadingFolders] = useState(true);
  const [selected, setSelected] = useState(new Set());
  const [selectMode, setSelectMode] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);

  useEffect(() => {
    fetch('/api/drive?type=folders')
      .then(r => r.json())
      .then(data => { setFolders(data.folders || []); setLoadingFolders(false); })
      .catch(() => setLoadingFolders(false));
  }, []);

  const openFolder = async (folder) => {
    setSelectedFolder(folder);
    setPhotos([]);
    setSelected(new Set());
    setSelectMode(false);
    setLoading(true);
    const res = await fetch(`/api/drive?type=photos&folderId=${folder.id}`);
    const data = await res.json();
    setPhotos(data.photos || []);
    setLoading(false);
  };

  const toggleSelect = (photoId) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(photoId) ? next.delete(photoId) : next.add(photoId);
      return next;
    });
  };

  const selectAll = () => {
    if (selected.size === photos.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(photos.map(p => p.id)));
    }
  };

  const cancelSelect = () => {
    setSelectMode(false);
    setSelected(new Set());
  };

  const handlePhotoTap = (photo, index) => {
    if (selectMode) {
      toggleSelect(photo.id);
    } else {
      setLightbox(index);
    }
  };

  const downloadSelected = async () => {
  if (selected.size === 0) return;
  setDownloading(true);
  const selectedPhotos = photos.filter(p => selected.has(p.id));

  for (let i = 0; i < selectedPhotos.length; i++) {
    const photo = selectedPhotos[i];
    setDownloadProgress(Math.round(((i + 1) / selectedPhotos.length) * 100));
    const a = document.createElement('a');
    a.href = `/api/download?fileId=${photo.id}`;
    a.download = photo.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    // รอ 800ms ระหว่างแต่ละรูป ไม่งั้น browser บล็อก
    await new Promise(r => setTimeout(r, 800));
  }

  setDownloading(false);
  setDownloadProgress(0);
  cancelSelect();
};

  const getImageUrl = (photo) => `https://drive.google.com/thumbnail?id=${photo.id}&sz=w800`;
  const getDownloadUrl = (photo) => `/api/download?fileId=${photo.id}`;
  const getFullUrl = (photo) => `https://drive.google.com/uc?export=view&id=${photo.id}`;

  return (
    <>
      <Head>
        <title>NT Photo — นำทอง</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700&family=Sarabun:wght@300;400;600&display=swap" rel="stylesheet" />
      </Head>
      <style>{`
        * { margin:0; padding:0; box-sizing:border-box; }
        body { background:#0a0a0a; color:#f0ece4; font-family:'Sarabun',sans-serif; min-height:100vh; }
        .header {
          background:linear-gradient(180deg,#111 0%,transparent 100%);
          padding:28px 20px 20px; text-align:center; position:sticky; top:0; z-index:10;
          backdrop-filter:blur(12px); border-bottom:1px solid rgba(255,255,255,0.06);
        }
        .logo { font-family:'Playfair Display',serif; font-size:26px; font-weight:700; letter-spacing:3px; }
        .logo span { color:#c9a84c; }
        .tagline { font-size:11px; color:#888; letter-spacing:4px; text-transform:uppercase; margin-top:3px; }
        .back-btn {
          position:absolute; left:16px; top:50%; transform:translateY(-50%);
          background:rgba(255,255,255,0.08); border:1px solid rgba(255,255,255,0.12);
          color:#f0ece4; padding:7px 14px; border-radius:20px; cursor:pointer;
          font-size:12px; font-family:'Sarabun',sans-serif;
        }
        .container { padding:20px 14px; max-width:1200px; margin:0 auto; }
        .section-title { font-family:'Playfair Display',serif; font-size:13px; color:#c9a84c; letter-spacing:4px; text-transform:uppercase; margin-bottom:16px; }
        .folder-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(150px,1fr)); gap:12px; }
        .folder-card {
          background:linear-gradient(135deg,#1a1a1a,#141414);
          border:1px solid rgba(255,255,255,0.08); border-radius:14px;
          padding:22px 14px; text-align:center; cursor:pointer; transition:all 0.25s ease;
        }
        .folder-card:hover { border-color:#c9a84c; transform:translateY(-3px); box-shadow:0 8px 32px rgba(201,168,76,0.15); }
        .folder-icon { font-size:32px; margin-bottom:8px; }
        .folder-name { font-size:13px; font-weight:600; color:#f0ece4; line-height:1.4; }
        .toolbar { display:flex; align-items:center; gap:10px; margin-bottom:14px; flex-wrap:wrap; }
        .folder-header { display:flex; align-items:center; gap:10px; flex:1; }
        .folder-title { font-family:'Playfair Display',serif; font-size:18px; }
        .photo-count { background:rgba(201,168,76,0.2); color:#c9a84c; border-radius:20px; padding:3px 10px; font-size:11px; font-weight:600; }
        .select-toggle-btn {
          background:rgba(201,168,76,0.15); border:1px solid rgba(201,168,76,0.4);
          color:#c9a84c; padding:7px 14px; border-radius:20px; cursor:pointer;
          font-family:'Sarabun',sans-serif; font-size:12px; font-weight:600;
        }
        .photo-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(150px,1fr)); gap:8px; padding-bottom:90px; }
        .photo-item {
          position:relative; aspect-ratio:1; border-radius:10px; overflow:hidden;
          cursor:pointer; background:#1a1a1a; border:2px solid transparent; transition:border-color 0.2s;
          user-select:none; -webkit-user-select:none;
        }
        .photo-item.selected { border-color:#c9a84c; }
        .photo-item img { width:100%; height:100%; object-fit:cover; transition:transform 0.3s ease; }
        .photo-item:hover img { transform:scale(1.04); }
        .photo-circle {
          position:absolute; top:8px; right:8px; width:24px; height:24px;
          border-radius:50%; border:2px solid rgba(255,255,255,0.7);
          display:none;
        }
        .select-mode .photo-circle { display:block; }
        .photo-check {
          position:absolute; top:8px; right:8px; width:24px; height:24px; border-radius:50%;
          background:#c9a84c; display:flex; align-items:center; justify-content:center;
          font-size:13px; font-weight:700; color:#000; border:2px solid #000; display:none;
        }
        .photo-item.selected .photo-check { display:flex; }
        .photo-item.selected .photo-circle { display:none; }
        .select-bar {
          position:fixed; bottom:0; left:0; right:0; z-index:50;
          background:#151515; border-top:1px solid rgba(255,255,255,0.1);
          padding:14px 16px; display:flex; align-items:center; gap:10px;
          backdrop-filter:blur(12px);
        }
        .select-count { font-size:14px; font-weight:600; color:#c9a84c; flex:1; }
        .sel-btn {
          background:rgba(255,255,255,0.08); border:1px solid rgba(255,255,255,0.15);
          color:#f0ece4; padding:9px 16px; border-radius:20px; cursor:pointer;
          font-family:'Sarabun',sans-serif; font-size:13px;
        }
        .sel-btn.primary { background:#c9a84c; border-color:#c9a84c; color:#000; font-weight:700; }
        .sel-btn:disabled { opacity:0.4; cursor:not-allowed; }
        .progress-overlay {
          position:fixed; inset:0; background:rgba(0,0,0,0.9); z-index:200;
          display:flex; flex-direction:column; align-items:center; justify-content:center; gap:16px;
        }
        .progress-bar-bg { width:260px; height:6px; background:#333; border-radius:3px; overflow:hidden; }
        .progress-bar-fill { height:100%; background:#c9a84c; border-radius:3px; transition:width 0.3s; }
        .lightbox {
          position:fixed; inset:0; background:rgba(0,0,0,0.95); z-index:100;
          display:flex; flex-direction:column; align-items:center; justify-content:center; padding:20px;
        }
        .lightbox-img { max-width:100%; max-height:75vh; border-radius:8px; object-fit:contain; }
        .lightbox-actions { display:flex; gap:10px; margin-top:16px; }
        .lb-btn {
          background:rgba(255,255,255,0.1); border:1px solid rgba(255,255,255,0.15);
          color:#f0ece4; padding:10px 22px; border-radius:24px; cursor:pointer;
          font-family:'Sarabun',sans-serif; font-size:13px; text-decoration:none; display:inline-block;
        }
        .lb-btn.primary { background:#c9a84c; border-color:#c9a84c; color:#000; font-weight:600; }
        .lightbox-close {
          position:absolute; top:16px; right:16px; background:rgba(255,255,255,0.1);
          border:none; color:#fff; width:38px; height:38px; border-radius:50%; cursor:pointer; font-size:16px;
        }
        .lightbox-nav {
          position:absolute; top:50%; transform:translateY(-50%);
          background:rgba(255,255,255,0.1); border:none; color:#fff;
          width:40px; height:40px; border-radius:50%; cursor:pointer; font-size:20px;
        }
        .lightbox-nav.prev { left:10px; }
        .lightbox-nav.next { right:10px; }
        .loading { text-align:center; padding:60px 20px; color:#666; }
        .spinner { width:34px; height:34px; border:2px solid #333; border-top-color:#c9a84c; border-radius:50%; animation:spin 0.8s linear infinite; margin:0 auto 14px; }
        @keyframes spin { to { transform:rotate(360deg); } }
        .empty { text-align:center; padding:60px 20px; color:#555; font-size:14px; }
      `}</style>

      {downloading && (
        <div className="progress-overlay">
          <div style={{fontSize:36}}>📦</div>
          <div style={{fontSize:16,fontWeight:600}}>กำลังบีบอัดรูปภาพ...</div>
          <div className="progress-bar-bg">
            <div className="progress-bar-fill" style={{width:`${downloadProgress}%`}} />
          </div>
          <div style={{fontSize:13,color:'#888'}}>{downloadProgress}% — {selected.size} รูป</div>
        </div>
      )}

      {lightbox !== null && photos[lightbox] && (
        <div className="lightbox" onClick={() => setLightbox(null)}>
          <button className="lightbox-close" onClick={() => setLightbox(null)}>✕</button>
          {lightbox > 0 && <button className="lightbox-nav prev" onClick={e=>{e.stopPropagation();setLightbox(lightbox-1);}}>‹</button>}
          {lightbox < photos.length-1 && <button className="lightbox-nav next" onClick={e=>{e.stopPropagation();setLightbox(lightbox+1);}}>›</button>}
          <img className="lightbox-img" src={getFullUrl(photos[lightbox])} alt="" onClick={e=>e.stopPropagation()} />
          <div className="lightbox-actions" onClick={e=>e.stopPropagation()}>
            <a className="lb-btn primary" href={getDownloadUrl(photos[lightbox])} download>⬇ ดาวน์โหลด</a>
            <button className="lb-btn" onClick={()=>setLightbox(null)}>ปิด</button>
          </div>
        </div>
      )}

      <div className="header" style={{position:'relative'}}>
        {selectedFolder && (
          <button className="back-btn" onClick={()=>{setSelectedFolder(null);setPhotos([]);cancelSelect();}}>← กลับ</button>
        )}
        <div className="logo">NT <span>Photo</span></div>
        <div className="tagline">นำทอง — ภาพถ่ายกิจกรรม</div>
      </div>

      <div className="container">
        {!selectedFolder && (
          <>
            <div className="section-title">📁 เลือกงาน / อัลบั้ม</div>
            {loadingFolders ? (
              <div className="loading"><div className="spinner"/><div>กำลังโหลด...</div></div>
            ) : folders.length === 0 ? (
              <div className="empty">⚠️ ยังไม่มีอัลบั้ม</div>
            ) : (
              <div className="folder-grid">
                {folders.map(folder => (
                  <div key={folder.id} className="folder-card" onClick={()=>openFolder(folder)}>
                    <div className="folder-icon">📸</div>
                    <div className="folder-name">{folder.name}</div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {selectedFolder && (
          <>
            <div className="toolbar">
              <div className="folder-header">
                <div className="folder-title">{selectedFolder.name}</div>
                {photos.length > 0 && <span className="photo-count">{photos.length} รูป</span>}
              </div>
              {photos.length > 0 && !loading && (
                <button className="select-toggle-btn" onClick={()=>selectMode?cancelSelect():setSelectMode(true)}>
                  {selectMode ? '✕ ยกเลิก' : '☑ เลือกรูป'}
                </button>
              )}
            </div>

            {loading ? (
              <div className="loading"><div className="spinner"/><div>กำลังโหลดภาพ...</div></div>
            ) : photos.length === 0 ? (
              <div className="empty">📭 ไม่มีภาพในอัลบั้มนี้</div>
            ) : (
              <div className={`photo-grid ${selectMode?'select-mode':''}`}>
                {photos.map((photo,i) => (
                  <div
                    key={photo.id}
                    className={`photo-item ${selected.has(photo.id)?'selected':''}`}
                    onClick={()=>handlePhotoTap(photo,i)}
                  >
                    <img src={getImageUrl(photo)} alt={photo.name} loading="lazy" />
                    <div className="photo-circle"/>
                    <div className="photo-check">✓</div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {selectMode && (
        <div className="select-bar">
          <div className="select-count">
            {selected.size > 0 ? `เลือก ${selected.size} รูป` : 'แตะรูปเพื่อเลือก'}
          </div>
          <button className="sel-btn" onClick={selectAll}>
            {selected.size === photos.length ? 'ยกเลิกทั้งหมด' : 'เลือกทั้งหมด'}
          </button>
          <button className="sel-btn primary" onClick={downloadSelected} disabled={selected.size===0}>
            ⬇ โหลด {selected.size > 0 ? `${selected.size} รูป` : ''}
          </button>
        </div>
      )}
    </>
  );
}
