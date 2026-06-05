import { google } from 'googleapis';

export default async function handler(req, res) {
  const { fileId, size } = req.query;
  if (!fileId) return res.status(400).json({ error: 'No fileId' });

  try {
    const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/drive.readonly'],
    });
    const drive = google.drive({ version: 'v3', auth });

    const meta = await drive.files.get({ fileId, fields: 'name,mimeType' });
    const baseName = (meta.data.name || 'photo').replace(/\.[^/.]+$/, '');

    // Social size: ~1080px JPEG via Drive thumbnail (smaller file, good for IG/FB/LINE)
    if (size === 'social') {
      const url = `https://drive.google.com/thumbnail?id=${fileId}&sz=w1080`;
      const resp = await fetch(url);
      if (!resp.ok) throw new Error('thumbnail fetch failed');
      const buf = Buffer.from(await resp.arrayBuffer());
      res.setHeader('Content-Type', 'image/jpeg');
      res.setHeader('Content-Disposition', `attachment; filename="${baseName}-social.jpg"`);
      res.setHeader('Cache-Control', 'public, max-age=3600');
      return res.send(buf);
    }

    // Full original
    const file = await drive.files.get(
      { fileId, alt: 'media' },
      { responseType: 'arraybuffer' }
    );
    res.setHeader('Content-Type', meta.data.mimeType || 'image/jpeg');
    res.setHeader('Content-Disposition', `attachment; filename="${meta.data.name}"`);
    res.send(Buffer.from(file.data));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Download failed' });
  }
}
