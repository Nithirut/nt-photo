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
      const response = await drive.files.list({
        q: `'${folderId}' in parents and (mimeType='image/jpeg' or mimeType='image/png' or mimeType='image/webp') and trashed=false`,
        fields: 'files(id, name, thumbnailLink, createdTime)',
        pageSize: 200,
        orderBy: 'createdTime desc',
      });
      // Exclude POSTER cover files from the gallery (case-insensitive) so they are
      // never counted or shown for download.
      const photos = (response.data.files || []).filter(p => {
        const n = (p.name || '').trim().toLowerCase();
        return n !== 'poster.jpg' && n !== 'poster.jpeg' && n !== 'poster.png';
      });
      return res.status(200).json({ photos });
    }

    return res.status(400).json({ error: 'Invalid request' });

  } catch (error) {
    console.error('Drive API error:', error);
    return res.status(500).json({ error: 'Failed to connect to Google Drive' });
  }
}
