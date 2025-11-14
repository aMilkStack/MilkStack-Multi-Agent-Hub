# Quick Deploy Guide

Choose your deployment method and follow the steps:

## 🚀 Fastest: Vercel (2 minutes)

```bash
# Install Vercel CLI
npm install -g vercel

# Deploy
vercel

# Set API key
vercel env add GEMINI_API_KEY

# Deploy to production
vercel --prod
```

**Or use GUI:** [vercel.com/new](https://vercel.com/new) → Import repository → Add `GEMINI_API_KEY` → Deploy

---

## 🌐 Easy: Netlify (3 minutes)

```bash
# Install Netlify CLI
npm install -g netlify-cli

# Build and deploy
npm run build
netlify deploy --prod
```

**Or drag & drop:** Build locally (`npm run build`), then drag `dist/` folder to [app.netlify.com/drop](https://app.netlify.com/drop)

**Then:** Add `GEMINI_API_KEY` in Site Settings → Environment Variables → Redeploy

---

## ⚡ Fast: Cloudflare Pages (2 minutes)

**Via Dashboard:**
1. Go to [dash.cloudflare.com](https://dash.cloudflare.com)
2. Pages → Create a project
3. Connect to Git → Select repository
4. Build settings:
   - Build command: `npm run build`
   - Build output: `dist`
5. Environment variables → Add `GEMINI_API_KEY`
6. Deploy!

---

## 💎 Free: GitHub Pages (5 minutes)

1. **Enable GitHub Pages:**
   - Repository Settings → Pages
   - Source: GitHub Actions

2. **Add secret:**
   - Settings → Secrets and variables → Actions
   - New secret: `GEMINI_API_KEY` = your_key

3. **Push to main branch:**
   ```bash
   git push origin main
   ```

4. **Wait for deployment:**
   - Actions tab → Watch workflow
   - Site will be live at: `https://yourusername.github.io/MilkStack-Multi-Agent-Hub`

**Note:** GitHub Actions workflow is already configured in `.github/workflows/deploy.yml`

---

## Configuration Files Included

All deployment configs are ready to use:

- ✅ `netlify.toml` - Netlify configuration
- ✅ `vercel.json` - Vercel configuration
- ✅ `firebase.json` - Firebase configuration
- ✅ `.github/workflows/deploy.yml` - GitHub Actions workflow

---

## After Deployment

**Test these features:**
- [ ] Create new project
- [ ] Send message to agents
- [ ] GitHub repo integration
- [ ] Folder upload (Chrome/Edge only, HTTPS required)
- [ ] ZIP upload
- [ ] Settings persistence

**Security:** Restrict your Gemini API key to your deployed domain in [Google AI Studio](https://makersuite.google.com/app/apikey)

---

## Troubleshooting

**"Environment variable not set"**
→ Add `GEMINI_API_KEY` in platform dashboard and redeploy

**Build fails**
→ Check build logs, ensure `npm install` completes successfully

**Folder upload doesn't work**
→ Must be HTTPS (all platforms provide this) and Chrome/Edge browser

---

## Need More Details?

See [DEPLOYMENT.md](./DEPLOYMENT.md) for comprehensive deployment documentation.
