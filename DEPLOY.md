# Nicotine landing page: deploy guide

A one-page site with a **Download for Android** button. Each tap is counted in a
Cloudflare D1 database, then the visitor is sent to the APK. Everything runs on
free plans.

```
landing/
├─ public/            the website (served as static files)
│  ├─ index.html      the page: responsive, light + dark, no build step
│  ├─ 404.html, favicon.svg, apple-touch-icon.png, og.png (share image), _headers
├─ src/worker.js      /download → count + redirect, /api/stats → total
├─ schema.sql         the D1 table
├─ wrangler.jsonc     Cloudflare config: D1 binding + DOWNLOAD_URL
└─ tool/og.html       source of og.png
```

---

## What changed from the first plan, and why

| First plan | This plan | Why |
|---|---|---|
| Cloudflare **Pages** + Pages Functions | Cloudflare **Workers with static assets** | Cloudflare now recommends Workers for new projects; Pages still works but gets few new features. Still free, still connects to GitHub. |
| Configure the build command and output dir in the dashboard | No build at all. `wrangler.jsonc` holds the folder, the DB binding and the download link | Settings live in the repo, so nothing gets lost between dashboard clicks. |
| D1 binding and download URL set in the dashboard | Both in `wrangler.jsonc` | Dashboard values get overwritten by the next deploy from the repo. One place, no surprises. |
| Host the APK somewhere | APK on **GitHub Releases**, linked as `releases/latest/download/nicotine.apk` | Cloudflare static files max out at 25 MiB. GitHub Releases is free, fast, and with `/latest/` the link **never changes** when you ship a new version. |
| One counter | One row per day (Bangladesh time) | You get the total *and* downloads per day. |
| Count every hit | Link-preview bots (Facebook, WhatsApp…), prefetches and HEAD requests aren't counted | Sharing the link on Facebook would otherwise inflate the count. |
| Count, then redirect | Redirect first, count in the background | A slow or broken database never blocks a download. |

Free plan limits, for reference: Workers 100,000 requests a day; D1 100,000 row writes and 5 million row reads a day, 5 GB storage. A download is one write.

---

## Step 0 · What you need

- A Cloudflare account (free): https://dash.cloudflare.com/sign-up
- A GitHub account. `gh` is installed and logged in on this PC as **IstiyakCPL**. If the site should live under **rahasistiyakofficial** (where the app repo is), run `gh auth login` and pick that account first.
- Node.js (already installed: v22). Wrangler, Cloudflare's CLI, runs through `npx`, so there's nothing else to install.

Open a terminal in `D:\flutter\landing` for every command below.

## Step 1 · Log in to Cloudflare

```sh
npx wrangler login
```

A browser tab opens. Click **Allow**.

## Step 2 · Create the D1 database

```sh
npx wrangler d1 create nicotine-downloads
```

It prints a block with `"database_id": "xxxxxxxx-xxxx-..."`. Open `wrangler.jsonc` and paste that id over `PASTE-YOUR-DATABASE-ID-HERE`. If Wrangler offers to add the binding to your config for you, say **no**: it's already there.

## Step 3 · Create the counter table

```sh
npx wrangler d1 execute nicotine-downloads --remote --file=schema.sql
```

Check it worked:

```sh
npx wrangler d1 execute nicotine-downloads --remote --command "SELECT name FROM sqlite_master WHERE type='table'"
```

You should see `downloads`.

## Step 4 · Try it on your PC (optional, 2 minutes)

```sh
npx wrangler d1 execute nicotine-downloads --local --file=schema.sql
npx wrangler dev
```

Open http://localhost:8787. Click **Download**: it should go to the demo link (example.com). Then open http://localhost:8787/api/stats and you'll see `{"total":1}`. Press `Ctrl+C` to stop. Local data lives in `.wrangler/` and never touches the real database.

## Step 5 · Put the site on GitHub

Make it a **separate, public** repo: the app repo is private, and a public repo can host the APK on its Releases page (Step 7). Nothing in this folder is secret. The database id is only usable with your Cloudflare login.

```sh
git init -b main
git add .
git commit -m "Nicotine landing page"
gh repo create nicotine-site --public --source=. --push
```

## Step 6 · Deploy on Cloudflare (connected to GitHub)

1. Cloudflare dashboard → **Workers & Pages** → **Create application** → **Import a repository** (Workers, not Pages).
2. Connect GitHub if asked, and pick **nicotine-site**.
3. Settings:
   - **Project name:** `nicotine`. It must match `"name"` in `wrangler.jsonc`.
   - **Build command:** leave empty.
   - **Deploy command:** `npx wrangler deploy` (the default).
   - Root directory: `/` (the default).
4. Click **Deploy**. In about a minute you get a free address like
   `https://nicotine.<your-subdomain>.workers.dev`.

From now on, every `git push` to `main` deploys automatically.

> Prefer no GitHub link? `npx wrangler deploy` from this folder does the same deploy in one command. Use one way or the other, not both.

## Step 7 · Set the real download link

The site starts with a demo link (`https://example.com/nicotine-demo.apk`). When the APK is ready:

1. Build the APK as usual: push to `development` in the app repo, wait for the **Build** run to go green, download **nicotine-apk** from the run's *Artifacts*, and unzip it.
2. Rename the file to exactly **`nicotine.apk`**.
3. Publish it as a release on the **site** repo:

   ```sh
   gh release create v1.0.0 nicotine.apk --repo <your-github-user>/nicotine-site --title "Nicotine 1.0.0" --notes "First public version."
   ```

4. In `wrangler.jsonc`, set:

   ```jsonc
   "DOWNLOAD_URL": "https://github.com/<your-github-user>/nicotine-site/releases/latest/download/nicotine.apk"
   ```

5. Commit and push. Cloudflare redeploys by itself.

**Next versions:** make a new release (`v1.0.1`, …) with a file again named `nicotine.apk`. The `/latest/` link moves to it automatically, so you never touch the site again.

> Before you share the link widely, set up your own release key (app README → "Your own release key"). Right now CI signs with a testing key that GitHub can drop after 7 unused days. If the key changes, people have to uninstall before they can update, and they lose their logs.

Any other https link works too (Google Drive direct link, Dropbox, R2). Paste it as `DOWNLOAD_URL`, then push.

## Step 8 · Test the counter and the redirect

1. Open the site on your phone. Tap **Download for Android**. The APK should start downloading.
2. Check the count:

   ```sh
   npx wrangler d1 execute nicotine-downloads --remote --command "SELECT * FROM downloads ORDER BY day DESC"
   ```

   Or open `https://nicotine.<your-subdomain>.workers.dev/api/stats`.
3. Clear your test downloads before you launch:

   ```sh
   npx wrangler d1 execute nicotine-downloads --remote --command "DELETE FROM downloads"
   ```

The page shows "Downloaded N times" under the button only once the total reaches **25**, so early numbers don't look empty. Change `SHOW_COUNT_FROM` near the bottom of `index.html`. Set it to `0` to always show the count, or to a very high number to never show it.

**Live logs**, if something looks wrong: `npx wrangler tail`, then tap Download.

## Step 9 · Share it

- Paste the link on Facebook or WhatsApp: the preview uses `og.png` (title, tagline, "Free for Android"). If Facebook shows an old preview, run the link through https://developers.facebook.com/tools/debug/ and click **Scrape again**.
- **Custom domain (optional):** buy one from any registrar (or move it to Cloudflare), then Worker → **Settings → Domains & Routes → Add → Custom domain**. HTTPS is automatic.

---

## Editing later

| Want to change | Where |
|---|---|
| Text, sections, FAQ | `public/index.html`, then push |
| Colours | the `:root` tokens at the top of `index.html` (same "Ash & Ember" values as design.md §3) |
| Share image | edit `tool/og.html`, then re-render it (below) and push |
| Download link | `DOWNLOAD_URL` in `wrangler.jsonc` |

Re-render the share image with Chrome (PowerShell):

```powershell
& "C:\Program Files\Google\Chrome\Application\chrome.exe" --headless=new --hide-scrollbars --virtual-time-budget=4000 --window-size=1200,630 --screenshot="D:\flutter\landing\public\og.png" "file:///D:/flutter/landing/tool/og.html"
```

## Troubleshooting

| Problem | Fix |
|---|---|
| Download says "The download link isn't set yet." | `DOWNLOAD_URL` is empty or not `https://`. |
| `/api/stats` gives 503 | The table is missing (redo Step 3), or `database_id` in `wrangler.jsonc` is wrong. |
| Build fails with a name mismatch | The dashboard project name and `"name"` in `wrangler.jsonc` must both be `nicotine`. |
| Count doesn't go up | Only real GET requests count. Link-preview bots, HEAD requests and prefetches are skipped on purpose. The count on the page also needs 25 first (Step 8). |
| GitHub link gives 404 | The repo must be **public**, and the release file must be named exactly `nicotine.apk`. |
