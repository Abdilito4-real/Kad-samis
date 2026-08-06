# KAD-SAMIS Setup Instructions

## Quick Start (5 minutes)

### 1. Prerequisites
- Node.js 18+ installed
- npm/yarn package manager
- Supabase account (free tier OK)

### 2. Install & Run

```bash
# Install dependencies (2-3 minutes)
npm install --legacy-peer-deps

# Create environment file
cp .env.example .env.local

# Add your Supabase credentials to .env.local

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Initial Setup

### Step 1: Setup Supabase Account

1. Create account at [supabase.com](https://supabase.com)
2. Create new project
3. Get credentials from Project Settings → API
4. Copy to `.env.local`:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_KEY`

### Step 2: Setup Database

1. Run database migration:
```bash
npx supabase db push
```

2. (Optional) Seed initial data:
```bash
npm run db:seed
```

### Step 3: Create Storage Buckets

In Supabase console → Storage:
- Create `assets` bucket
- Create `documents` bucket
- Create `inspection-images` bucket
- Create `avatars` bucket
- Create `maintenance` bucket

### Step 4: Setup Authentication

In Supabase console → Authentication:
1. Enable Email/Password auth
2. Configure redirect URLs
3. Set password requirements if needed

### Step 5: Create Test User

In Supabase console → SQL Editor, run:
```sql
-- Note: Create user via Auth UI first, then set role
UPDATE users SET role_id = (SELECT id FROM roles WHERE name = 'asset_officer') 
WHERE email = 'your_email@example.com';
```

## Development Workflow

### Run Development Server
```bash
npm run dev
```

### Build for Production
```bash
npm run build
npm run start
```

### Type Checking
```bash
npm run type-check
```

### Code Formatting
```bash
npm run format
```

### Linting
```bash
npm run lint
```

## Project Structure

```
src/
├── app/           # Next.js App Router pages
├── components/    # Reusable React components
├── lib/          # Utility functions & Supabase clients
├── hooks/        # Custom React hooks
├── types/        # TypeScript type definitions
├── schemas/      # Zod validation schemas
└── services/     # API services

public/           # Static assets & PWA files
supabase/         # Database migrations & seed data
```

## Common Tasks

### Add New Page
1. Create folder under `src/app/[module]/`
2. Add `layout.tsx` and `page.tsx`
3. Update sidebar navigation in `dashboard-sidebar.tsx`

### Add New Component
1. Create in `src/components/`
2. Export and use in pages
3. Use existing UI components from `shadcn/ui`

### Add Database Table
1. Create migration in `supabase/migrations/`
2. Run: `npx supabase db push`
3. Generate types: `npx supabase gen types`

### Connect Component to Database
1. Use `useAuth()` hook for user context
2. Use TanStack Query for data fetching
3. Use Supabase client from `lib/supabase/client.ts`

## Troubleshooting

### Dependencies Issue
```bash
# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm install --legacy-peer-deps
```

### Environment Variables Not Loading
- Ensure `.env.local` exists
- Restart dev server after changes
- Use `NEXT_PUBLIC_` prefix for browser access

### Supabase Connection Error
- Verify URL and keys in `.env.local`
- Check Supabase project is active
- Verify network connectivity

### Database Migration Failed
- Check SQL syntax in migration file
- Ensure Supabase project is running
- Check user has necessary permissions

### Build Errors
```bash
npm run type-check  # Check TypeScript
npm run lint        # Check linting
npm run build       # Full build test
```

## Next Steps

1. **Configure Supabase**
   - Setup authentication
   - Create initial users
   - Setup storage buckets

2. **Customize Branding**
   - Update logo/favicon
   - Customize colors in CSS
   - Update app metadata

3. **Add Data**
   - Import ministries
   - Add departments
   - Load initial assets

4. **Test Features**
   - Login functionality
   - Create/edit assets
   - Generate reports

5. **Deploy**
   - Choose hosting (Vercel recommended)
   - Setup custom domain
   - Configure monitoring

## Resources

- [Next.js Documentation](https://nextjs.org/docs)
- [Supabase Documentation](https://supabase.com/docs)
- [Tailwind CSS](https://tailwindcss.com/docs)
- [React Hook Form](https://react-hook-form.com/)
- [shadcn/ui Components](https://ui.shadcn.com/)

## Need Help?

Check the documentation files:
- `README.md` - Project overview
- `DEPLOYMENT.md` - Deployment guide
- `API.md` - API documentation

Or create an issue in the repository.

## Development Tips

- Use TypeScript for type safety
- Follow existing component patterns
- Use existing UI components
- Run tests before committing
- Keep commits atomic and descriptive
- Document complex logic with comments

Happy coding! 🚀
