import { google } from 'googleapis';

async function getDriveClient() {
  const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/drive.readonly'],
  });
  return google.drive({ version: 'v3', auth });
}

export default async function handler(req, res) {
  const { type, folderId, groupFolderId } = req.query;

  try {
    const drive = await getDriveClient();

    if (type === 'folders') {
      const parentId = groupFolderId || process.env.DRIVE_FOLDER_ID;
      const response = await drive.files.list({
        q: `'${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
        fields: 'files(id, name, createdTime)',
        orderBy: 'createdTime desc',
        pageSize: 50,
      });
      const folders = response.data.files || [];

      // Album cover: if a folder contains a POSTER image, attach its fileId as coverId.
      // One batched query for all folders; wrapped in try/catch so covers never break folder listing.
      if (folders.length > 0) {
        try {
          const parentClause = folders.map(f => `'${f.id}' in parents`).join(' or ');
          const posterNames = ['POSTER.JPG','poster.jpg','Poster.jpg','POSTER.jpg','Poster.JPG','poster.JPG','POSTER.PNG','poster.png','Poster.png'];
          const nameClause = posterNames.map(n => `name='${n}'`).join(' or ');
          const posterRes = await drive.files.list({
            q: `(${parentClause}) and (${nameClause}) and mimeType contains 'image/' and trashed=false`,
            fields: 'files(id, name, parents)',
            pageSize: 100,
          });
          const coverByParent = {};
          for (const p of (posterRes.data.files || [])) {
            for (const par of (p.parents || [])) {
              if (!coverByParent[par]) coverByParent[par] = p.id;
            }
          }
          for (const f of folders) {
            if (coverByParent[f.id]) f.coverId = coverByParent[f.id];
          }
        } catch (coverErr) {
          console.error('Album cover lookup failed (continuing without covers):', coverErr);
        }
      }

      return res.status(200).json({ folders });
    }

    if (type === 'photos' && folderId) {
      // Fetch ALL photos across pages. Drive returns at most `pageSize` files per
      // request; without following nextPageToken, folders with >pageSize images were
      // silently capped (the 200-photo limit). Loop until there are no more pages.
      let allFiles = [];
      let pageToken;
      do {
        const response = await drive.files.list({
          q: `'${folderId}' in parents and (mimeType='image/jpeg' or mimeType='image/png' or mimeType='image/webp') and trashed=false`,
          fields: 'nextPageToken, files(id, name, thumbnailLink, createdTime, imageMediaMetadata/time)',
          pageSize: 1000,
          orderBy: 'createdTime desc',
          pageToken,
        });
        allFiles = allFiles.concat(response.data.files || []);
        pageToken = response.data.nextPageToken;
      } while (pageToken);

      // Exclude POSTER cover files from the gallery (case-insensitive) so they are
      // never counted or shown for download.
      const photos = allFiles.filter(p => {
        const n = (p.name || '').trim().toLowerCase();
        return n !== 'poster.jpg' && n !== 'poster.jpeg' && n !== 'poster.png';
      });

      // Sort by real capture time, oldest first (taken earlier -> shown earlier).
      // Priority: EXIF imageMediaMetadata.time -> createdTime -> name.
      // Nothing is ever dropped; photos with no usable timestamp are ordered by name,
      // after those that have one.
      const captureTs = (p) => {
        const t = p.imageMediaMetadata && p.imageMediaMetadata.time;
        if (t) {
          // EXIF DateTime format: "YYYY:MM:DD HH:MM:SS"
          const m = String(t).match(/^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/);
          if (m) return Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]);
        }
        if (p.createdTime) {
          const d = Date.parse(p.createdTime);
          if (!Number.isNaN(d)) return d;
        }
        return null;
      };
      photos.sort((a, b) => {
        const ta = captureTs(a);
        const tb = captureTs(b);
        if (ta !== null && tb !== null) {
          if (ta !== tb) return ta - tb;
        } else if (ta === null && tb !== null) {
          return 1;
        } else if (ta !== null && tb === null) {
          return -1;
        }
        return (a.name || '').localeCompare(b.name || '');
      });

      return res.status(200).json({ photos });
    }

    return res.status(400).json({ error: 'Invalid request' });

  } catch (error) {
    console.error('Drive API error:', error);
    return res.status(500).json({ error: 'Failed to connect to Google Drive' });
  }
}
