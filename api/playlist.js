export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-admin-password');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
  const GITHUB_OWNER = process.env.GITHUB_OWNER;
  const GITHUB_REPO = process.env.GITHUB_REPO;
  const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

  const fileUrl = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/playlist.json`;

  // 1. GET Request: Read Current Playlist
  if (req.method === 'GET') {
    try {
      const response = await fetch(fileUrl, {
        headers: {
          'Authorization': `Bearer ${GITHUB_TOKEN}`,
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'VIRU-Radio-App'
        }
      });

      if (!response.ok) {
        return res.status(response.status).json({ error: 'Failed to fetch playlist from GitHub' });
      }

      const data = await response.json();
      const content = Buffer.from(data.content, 'base64').toString('utf-8');
      const playlist = JSON.parse(content);

      return res.status(200).json({ playlist, sha: data.sha });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // 2. POST Request: Save New Playlist to GitHub Repo
  if (req.method === 'POST') {
    const clientPassword = req.headers['x-admin-password'] || req.body.password;

    // Verify Password
    if (!clientPassword || clientPassword !== ADMIN_PASSWORD) {
      return res.status(401).json({ error: 'වැරදි Password එකක්! Access Denied.' });
    }

    const { playlist } = req.body;
    if (!playlist || !Array.isArray(playlist)) {
      return res.status(400).json({ error: 'Invalid playlist data' });
    }

    try {
      // Get current file SHA first (Required by GitHub API to update existing file)
      const getFile = await fetch(fileUrl, {
        headers: {
          'Authorization': `Bearer ${GITHUB_TOKEN}`,
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'VIRU-Radio-App'
        }
      });

      const fileData = await getFile.json();
      const sha = fileData.sha;

      // Commit updated playlist.json to GitHub
      const updatedContent = Buffer.from(JSON.stringify(playlist, null, 2)).toString('base64');

      const commitRes = await fetch(fileUrl, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${GITHUB_TOKEN}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
          'User-Agent': 'VIRU-Radio-App'
        },
        body: JSON.stringify({
          message: 'Update playlist.json via VIRU Radio Admin Panel',
          content: updatedContent,
          sha: sha
        })
      });

      if (!commitRes.ok) {
        const errData = await commitRes.json();
        return res.status(commitRes.status).json({ error: errData.message });
      }

      return res.status(200).json({ success: true, message: 'Playlist එක සාර්ථකව GitHub එකේ Save වුණා!' });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(405).json({ error: 'Method Not Allowed' });
}
