# Nicotine: landing page

The download page for **Nicotine**, a private, offline cigarette tracker for Android.
It's hosted free on **GitHub Pages**, and the APK is hosted free on **GitHub Releases**. No server, no database.

Live at: https://rahasistiyakofficial.github.io/Nicotine-Site/

```
docs/                     ← GitHub Pages serves this folder
├─ index.html             the page (responsive, light + dark)
├─ 404.html
├─ .nojekyll              serve files as they are
└─ assets/
   ├─ css/site.css        "Ash & Ember" tokens from the app's design.md
   ├─ js/config.js        ← download link and settings: the only file to edit
   ├─ js/main.js          download links, download count, calculator, phone demo
   ├─ js/lungs.js         the 3D breathing lungs (three.js, loaded on demand)
   └─ img/                favicon, app icon, og.png (share preview)
tool/og.html              source of og.png
```

## Go live (one time)

1. **Make the repo public.** Go to **Settings → General → Danger Zone → Change visibility → Public**.
   GitHub Pages on a free account needs a public repo, and so do public release downloads. Nothing here is secret.
2. **Turn on Pages.** Go to **Settings → Pages**. Under **Build and deployment**, pick:
   - Source: **Deploy from a branch**
   - Branch: **main**, folder: **/docs**
   - Click **Save**.
3. Wait about a minute. **Actions** shows a "pages build and deployment" run. When it's green, the site is live at the link above.

Every push to `main` updates the site automatically.

## Set the real download link

The page starts with a demo link. When the APK is ready:

1. Build it with the app repo's **Build** workflow, download the **nicotine-apk** artifact, and unzip it.
2. Rename the file to exactly `nicotine.apk`.
3. Publish it as a release here:
   ```sh
   gh release create v1.0.0 nicotine.apk --repo rahasistiyakofficial/Nicotine-Site --title "Nicotine 1.0.0" --notes "First public version."
   ```
4. In `docs/assets/js/config.js`, set:
   ```js
   downloadUrl: 'https://github.com/rahasistiyakofficial/Nicotine-Site/releases/latest/download/nicotine.apk',
   version: '1.0.0',
   ```
5. Commit and push.

**New versions:** make a new release (`v1.0.1`, …) with a file again called `nicotine.apk`, and update `version` in `config.js`. The `/latest/` link moves to the new release by itself.

> Before sharing widely, set up your own release signing key (app README → "Your own release key"). If the signing key changes between versions, people have to uninstall first, and that deletes their logs.

## Download counter

GitHub counts every download of a release file, so the counter needs no setup.

- The page adds up `download_count` for every `.apk` across all releases, and shows "Downloaded N times" once the total reaches `showCountFrom` (25) in `config.js`.
- To check it yourself:
  ```sh
  gh api repos/rahasistiyakofficial/Nicotine-Site/releases --jq '.[] | .tag_name as $t | .assets[] | "\($t)  \(.name)  \(.download_count)"'
  ```
- The demo link isn't counted. Only downloads of real release files are.
- GitHub allows 60 count lookups an hour per visitor. The page caches the number for 10 minutes, so normal visits stay well under that.

## Preview on your PC

```sh
npx http-server docs -p 5500
```

Open http://localhost:5500. A server is needed because the page's scripts are ES modules, which browsers won't load from `file://`.

## Notes

- **3D lungs:** three.js 0.170.0 loads from jsDelivr only after the page is up, and only when WebGL works and Data Saver is off. Otherwise a flat SVG lung stays in its place. It pauses when off screen and stays still with Reduce motion on. The slider changes the tint as an illustration; it isn't the app's lung-load formula.
- **Custom domain (optional):** go to Settings → Pages → Custom domain. Then update `og:url`, `og:image` and `canonical` in `index.html`, and change the `/Nicotine-Site/` links in `404.html` to `/`.
- **Share preview:** after changing `og.png`, run the link through https://developers.facebook.com/tools/debug/ and click **Scrape again**.
