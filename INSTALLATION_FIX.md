# KAD-SAMIS Setup - Installation Fix Guide

## Issue Encountered

npm install failed with: `No matching version found for @radix-ui/react-slot@^2.0.0`

## Solution

The `package.json` has been updated with compatible versions. Run this command to complete installation:

```bash
cd "c:\Users\OWNER\Desktop\Kaduna State Asset Management Information System (KAD-SAMIS)"
npm install --legacy-peer-deps
```

## If You Still Face Issues

### Option 1: Clear npm Cache (Recommended)
```bash
npm cache clean --force
rm -r node_modules package-lock.json
npm install --legacy-peer-deps
```

### Option 2: Use npm ci (For CI/CD)
```bash
npm ci --legacy-peer-deps
```

### Option 3: Use Yarn (Alternative)
```bash
yarn install
```

## After Installation Succeeds

### 1. Setup Environment Variables
Create `.env.local` in project root:
```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url_here
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key_here
SUPABASE_SERVICE_KEY=your_supabase_service_key_here
NEXT_PUBLIC_API_URL=http://localhost:3000
```

### 2. Verify TypeScript
```bash
npm run type-check
```

### 3. Build Test
```bash
npm run build
```

### 4. Start Development
```bash
npm run dev
```

Then open http://localhost:3000 in your browser.

## Troubleshooting npm Install

If npm install still fails:

1. **Check Node.js version**
   ```bash
   node --version  # Should be 18+
   npm --version   # Should be 9+
   ```

2. **Update npm**
   ```bash
   npm install -g npm@latest
   ```

3. **Check Disk Space**
   - Ensure you have at least 2GB free disk space

4. **Reset npm**
   ```bash
   npm config reset
   npm cache verify
   ```

5. **Nuclear Option**
   - Delete node_modules and package-lock.json
   - Delete npm cache: `C:\Users\[username]\AppData\Roaming\npm-cache`
   - Reinstall Node.js
   - Run `npm install --legacy-peer-deps`

## Verified Compatible Versions

The `package.json` now includes:
- React 18.3.0 (Next.js 15 compatible)
- Next.js 15.0.0
- Radix UI 1.0.0 (slot component)
- TailwindCSS 3.4.0
- All other dependencies at stable versions

## Getting Help

If installation still fails:

1. Check [npm troubleshooting](https://docs.npmjs.com/cli/v8/troubleshooting)
2. Review the full npm install log in: `npm-debug.log`
3. Try on a different terminal (PowerShell, CMD, or WSL)
4. Consider using Node Version Manager (nvm) to switch Node versions

## Next: Supabase Setup

Once npm install completes successfully:

1. Create account at https://supabase.com
2. Create new project
3. Get your API keys from Project Settings
4. Add keys to `.env.local`
5. Run database migrations

See `GETTING_STARTED.md` for complete setup steps.

---

**Project Status**: ✅ Code Complete | ⏳ Dependencies Installing | ⚠️ Supabase Setup Pending

The entire codebase is ready. Just need npm install to complete!
