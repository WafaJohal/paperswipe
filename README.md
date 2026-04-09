# PaperSwipe

A personal academic paper feed — swipe through new papers, build a reading stack, export BibTeX. Syncs across all your devices via GitHub Gist.

## Files

```
index.html   — app shell (structure only)
styles.css   — CHRI-branded styling
app.js       — all application logic
```

## Deploy to GitHub Pages (5 minutes)

```bash
# 1. Create repo and push
git init
git add index.html styles.css app.js README.md
git commit -m "init paperswipe"
gh repo create paperswipe --public --push --source=.

# 2. Enable GitHub Pages
# Go to: github.com/YOUR_USERNAME/paperswipe
# Settings → Pages → Branch: main → Save
# Your app will be live at: https://YOUR_USERNAME.github.io/paperswipe
```

## Set up Gist Sync (cross-device)

**Step 1 — Create a secret Gist**
1. Go to https://gist.github.com
2. Filename: `paperswipe-data.json`
3. Content: `{"stack":[],"seen":[]}`
4. Click **Create secret gist**
5. Copy the Gist ID from the URL: `gist.github.com/YOUR_USERNAME/THIS_PART`

**Step 2 — Create a Personal Access Token**
1. Go to https://github.com/settings/tokens
2. Generate new token (classic)
3. Scopes: tick **gist** only
4. Copy the token (starts with `ghp_`)

**Step 3 — Connect in the app**
1. Open your deployed app
2. Click ⚙ Settings → scroll to **Gist Sync**
3. Paste your token and Gist ID
4. Click **Connect**

The token is stored in `localStorage` on each device — it never touches the repo. Do this once per device (phone, laptop, etc.) and your stack stays in sync.

## ⚠️ Security note

- **Never commit your token to the repo**
- The Gist is "secret" (unlisted) but not encrypted — don't store sensitive content
- Revoke the token at any time from https://github.com/settings/tokens

## Keyboard shortcuts

| Key | Action |
|-----|--------|
| `←` or `A` | Skip paper |
| `→` or `D` | Save as must-read |
| `M` | Save as maybe |
| `Space` | Open detail modal |
| `U` | Undo last action |
| `R` | Refresh feed |
| `S` | Force sync to Gist |

## Data model (Gist JSON)

```json
{
  "stack": [ { "id": "...", "title": "...", "tier": "must", ... } ],
  "seen":  [ "paper-id-1", "paper-id-2" ],
  "profile": { "keywords": [...], "categories": [...], "venues": [...] },
  "updatedAt": "2025-01-01T00:00:00Z"
}
```
