# PercuVoice Trainer

Vite + React app for creating percussion solfege practice exercises with SVG notation, browser playback, and PNG/WAV/ZIP export.

## Current Behavior

- One parsed exercise generates one notation image and one audio file.
- Accent markers (`>`) are preserved and rendered visibly in the SVG.
- Visual notation keeps uppercase labels: `DUM`, `TA`, `TI`.
- Spoken playback uses Spanish-friendly phonetic text for `DUM`, `TA`, and `TI`.
- PNG, WAV, and ZIP export are supported in the browser.

## Local Development

Prerequisites:

- Node.js 20 or newer
- npm

Install dependencies:

```bash
npm install
```

Run the local dev server:

```bash
npm run dev
```

Build for production:

```bash
npm run build
```

Preview the production build locally:

```bash
npm run preview
```

## Deploy To Vercel

This project is a standard Vite/React static app. Vercel can deploy it directly from a GitHub repository.

Recommended Vercel settings:

- Framework Preset: `Vite`
- Build Command: `npm run build`
- Output Directory: `dist`
- Install Command: `npm install`

No serverless functions are required for the current app behavior.

## Push To GitHub

From the project folder:

```bash
git init
git add .
git commit -m "Prepare PercuVoice Trainer for Vercel deployment"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPOSITORY.git
git push -u origin main
```

Replace `YOUR_USERNAME` and `YOUR_REPOSITORY` with your GitHub account and repository name.
