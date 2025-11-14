# Deployment Guide

This guide covers deploying MilkStack Multi-Agent Hub to various web hosting platforms.

## Prerequisites

Before deploying, ensure you have:
- ✅ A Google Gemini API key
- ✅ Code committed to a Git repository (GitHub, GitLab, etc.)
- ✅ Successfully built the project locally (`npm run build`)

## Quick Deploy Options

### Option 1: Vercel (Recommended - Easiest)

**Best for:** Instant deployment with zero configuration

1. **Install Vercel CLI:**
   ```bash
   npm install -g vercel
   ```

2. **Deploy from your project directory:**
   ```bash
   vercel
   ```

3. **Follow the prompts:**
   - Link to your Vercel account
   - Set project name
   - Accept defaults for Vite project

4. **Set environment variable:**
   ```bash
   vercel env add GEMINI_API_KEY
   ```
   Paste your API key when prompted, select "Production"

5. **Redeploy with environment variable:**
   ```bash
   vercel --prod
   ```

**Or use Vercel Dashboard:**
1. Go to [vercel.com](https://vercel.com)
2. Click "New Project"
3. Import your GitHub repository
4. Add environment variable: `GEMINI_API_KEY`
5. Deploy!

**Your app will be live at:** `https://your-project.vercel.app`

---

### Option 2: Netlify

**Best for:** Simple deployment with great free tier

#### Via Netlify CLI:

1. **Install Netlify CLI:**
   ```bash
   npm install -g netlify-cli
   ```

2. **Build your project:**
   ```bash
   npm run build
   ```

3. **Deploy:**
   ```bash
   netlify deploy --prod
   ```

4. **Set environment variable:**
   - Go to your Netlify dashboard
   - Site settings → Environment variables
   - Add: `GEMINI_API_KEY=your_key_here`
   - Redeploy

#### Via Netlify Dashboard:

1. Go to [netlify.com](https://netlify.com)
2. Click "Add new site" → "Import an existing project"
3. Connect to your Git provider
4. Configure build settings:
   - **Build command:** `npm run build`
   - **Publish directory:** `dist`
5. Add environment variable in Site settings
6. Deploy!

**Create `netlify.toml` for automatic configuration:**
```toml
[build]
  command = "npm run build"
  publish = "dist"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

---

### Option 3: Cloudflare Pages

**Best for:** Global CDN with excellent performance

1. **Via Cloudflare Dashboard:**
   - Go to [pages.cloudflare.com](https://pages.cloudflare.com)
   - Connect your GitHub account
   - Select repository
   - Build settings:
     - **Build command:** `npm run build`
     - **Build output:** `dist`
   - Environment variables → Add `GEMINI_API_KEY`
   - Deploy!

2. **Via Wrangler CLI:**
   ```bash
   npm install -g wrangler
   npx wrangler pages deploy dist
   ```

---

### Option 4: GitHub Pages

**Best for:** Free hosting for public repositories

1. **Install gh-pages:**
   ```bash
   npm install --save-dev gh-pages
   ```

2. **Update `package.json`:**
   ```json
   {
     "scripts": {
       "predeploy": "npm run build",
       "deploy": "gh-pages -d dist"
     },
     "homepage": "https://yourusername.github.io/MilkStack-Multi-Agent-Hub"
   }
   ```

3. **Update `vite.config.ts`:**
   ```typescript
   export default defineConfig(({ mode }) => {
     const env = loadEnv(mode, '.', '');
     return {
       base: '/MilkStack-Multi-Agent-Hub/', // Replace with your repo name
       // ... rest of config
     };
   });
   ```

4. **Deploy:**
   ```bash
   npm run deploy
   ```

5. **Set up GitHub Actions for environment variables:**

   Create `.github/workflows/deploy.yml`:
   ```yaml
   name: Deploy to GitHub Pages

   on:
     push:
       branches: [ main ]
     workflow_dispatch:

   permissions:
     contents: read
     pages: write
     id-token: write

   jobs:
     build:
       runs-on: ubuntu-latest
       steps:
         - uses: actions/checkout@v4

         - name: Setup Node
           uses: actions/setup-node@v4
           with:
             node-version: '18'

         - name: Install dependencies
           run: npm ci

         - name: Build
           env:
             GEMINI_API_KEY: ${{ secrets.GEMINI_API_KEY }}
           run: npm run build

         - name: Upload artifact
           uses: actions/upload-pages-artifact@v3
           with:
             path: ./dist

     deploy:
       environment:
         name: github-pages
         url: ${{ steps.deployment.outputs.page_url }}
       runs-on: ubuntu-latest
       needs: build
       steps:
         - name: Deploy to GitHub Pages
           id: deployment
           uses: actions/deploy-pages@v4
   ```

6. **Add secret in GitHub:**
   - Repository Settings → Secrets and variables → Actions
   - New repository secret: `GEMINI_API_KEY`

---

### Option 5: Firebase Hosting

**Best for:** Integration with other Firebase services

1. **Install Firebase CLI:**
   ```bash
   npm install -g firebase-tools
   ```

2. **Login and initialize:**
   ```bash
   firebase login
   firebase init hosting
   ```

3. **Configure:**
   - Select/create Firebase project
   - Public directory: `dist`
   - Single-page app: Yes
   - Don't overwrite index.html

4. **Build and deploy:**
   ```bash
   npm run build
   firebase deploy
   ```

5. **Set environment variables:**

   Create `firebase.json`:
   ```json
   {
     "hosting": {
       "public": "dist",
       "ignore": [
         "firebase.json",
         "**/.*",
         "**/node_modules/**"
       ],
       "rewrites": [
         {
           "source": "**",
           "destination": "/index.html"
         }
       ],
       "headers": [
         {
           "source": "**",
           "headers": [
             {
               "key": "Cache-Control",
               "value": "no-cache, no-store, must-revalidate"
             }
           ]
         }
       ]
     }
   }
   ```

---

## Environment Variables Setup

### Important: API Key Security

⚠️ **SECURITY WARNING:** Your `GEMINI_API_KEY` will be exposed in the client-side code. This is inherent to browser-based apps. To protect your API key:

1. **Enable API key restrictions** in [Google AI Studio](https://makersuite.google.com/app/apikey):
   - Restrict by HTTP referrer (add your deployment domain)
   - Set usage quotas
   - Monitor usage regularly

2. **Best practice:** Consider building a backend proxy:
   ```
   Browser → Your Backend → Gemini API
   ```
   This keeps the API key server-side.

### Setting Environment Variables

Each platform handles environment variables differently:

| Platform | Method |
|----------|--------|
| **Vercel** | Dashboard → Settings → Environment Variables |
| **Netlify** | Dashboard → Site Settings → Environment Variables |
| **Cloudflare** | Dashboard → Settings → Environment Variables |
| **GitHub Pages** | Repository Settings → Secrets → Actions |
| **Firebase** | Embed in build or use Cloud Functions |

**Variable to set:**
```
GEMINI_API_KEY=your_actual_api_key_here
```

---

## Build Optimization

Before deploying, optimize your build:

1. **Update `vite.config.ts` for production:**
   ```typescript
   export default defineConfig(({ mode }) => {
     const env = loadEnv(mode, '.', '');
     return {
       build: {
         sourcemap: false,
         rollupOptions: {
           output: {
             manualChunks: {
               'react-vendor': ['react', 'react-dom'],
               'ai-vendor': ['@google/genai']
             }
           }
         }
       },
       // ... rest of config
     };
   });
   ```

2. **Analyze bundle size:**
   ```bash
   npm install --save-dev rollup-plugin-visualizer
   ```

---

## Post-Deployment Checklist

After deploying, verify:

- [ ] App loads successfully
- [ ] Can create new project
- [ ] Can send messages to agents
- [ ] GitHub repo integration works
- [ ] Folder upload works (HTTPS required)
- [ ] ZIP upload works
- [ ] Settings modal saves correctly
- [ ] localStorage persists across refreshes
- [ ] No console errors
- [ ] Mobile responsive design works

---

## Custom Domain Setup

### Vercel:
1. Dashboard → Settings → Domains
2. Add your domain
3. Update DNS records as instructed

### Netlify:
1. Site settings → Domain management
2. Add custom domain
3. Configure DNS

### Cloudflare Pages:
1. Pages project → Custom domains
2. Add domain (automatic if using Cloudflare DNS)

---

## Troubleshooting

### "API_KEY environment variable not set"
- Verify environment variable is set in platform dashboard
- Redeploy after adding variable
- Check build logs for errors

### Folder upload not working:
- Ensure site is served over HTTPS
- File System Access API only works in Chromium browsers

### Build fails:
```bash
# Clear cache and rebuild
rm -rf node_modules package-lock.json dist
npm install
npm run build
```

### localStorage issues:
- Check browser privacy settings
- Verify domain isn't blocking storage
- Test in incognito mode

---

## Performance Tips

1. **Enable compression** (most platforms do this automatically)
2. **Use CDN** (Cloudflare, Vercel, Netlify include this)
3. **Cache static assets** (configure in platform settings)
4. **Monitor Core Web Vitals** with Google PageSpeed Insights

---

## Cost Estimates

| Platform | Free Tier | Paid Plans |
|----------|-----------|------------|
| **Vercel** | 100GB bandwidth/month | From $20/month |
| **Netlify** | 100GB bandwidth/month | From $19/month |
| **Cloudflare Pages** | Unlimited bandwidth | From $20/month |
| **GitHub Pages** | Unlimited (public repos) | N/A |
| **Firebase** | 10GB storage, 360MB/day | Pay as you go |

**Most apps stay within free tier limits.**

---

## Recommended: Vercel Deployment (Step-by-Step)

For first-time deployers, here's the complete Vercel workflow:

1. **Push code to GitHub** (if not already done)

2. **Go to [vercel.com](https://vercel.com)** and sign up with GitHub

3. **Click "Add New Project"**

4. **Import your repository:**
   - Search for "MilkStack-Multi-Agent-Hub"
   - Click "Import"

5. **Configure project:**
   - Framework Preset: Vite (auto-detected)
   - Root Directory: ./
   - Build Command: `npm run build` (auto-detected)
   - Output Directory: `dist` (auto-detected)

6. **Add environment variable:**
   - Click "Environment Variables"
   - Name: `GEMINI_API_KEY`
   - Value: (paste your API key)
   - Environments: Production, Preview, Development

7. **Click "Deploy"** and wait ~2 minutes

8. **Visit your live site:**
   - URL will be: `https://milkstack-multi-agent-hub.vercel.app`
   - Or custom domain: `https://your-domain.com`

**Done!** 🎉 Your app is now live.

---

## Continuous Deployment

All platforms support automatic deployment:

- **Push to `main` branch** → Automatic production deployment
- **Push to other branches** → Preview deployments
- **Pull requests** → Preview deployments for review

Enable in platform settings or `.github/workflows/`.

---

## Support

For platform-specific issues:
- **Vercel:** [vercel.com/docs](https://vercel.com/docs)
- **Netlify:** [docs.netlify.com](https://docs.netlify.com)
- **Cloudflare:** [developers.cloudflare.com/pages](https://developers.cloudflare.com/pages)
- **GitHub Pages:** [docs.github.com/pages](https://docs.github.com/en/pages)
- **Firebase:** [firebase.google.com/docs/hosting](https://firebase.google.com/docs/hosting)
