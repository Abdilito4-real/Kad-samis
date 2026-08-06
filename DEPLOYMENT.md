# KAD-SAMIS Deployment Guide

## Prerequisites
- Node.js 18+
- npm or yarn
- Supabase account
- Docker (optional)

## Environment Setup

### 1. Local Development

Create `.env.local`:
```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_KEY=your_service_key
NEXT_PUBLIC_API_URL=http://localhost:3000
```

### 2. Database Setup

Push schema to Supabase:
```bash
npx supabase db push
```

Seed initial data:
```bash
npm run db:seed
```

### 3. Start Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Production Deployment

### Vercel (Recommended)

1. Push code to GitHub
2. Connect repository to Vercel
3. Add environment variables in Vercel dashboard
4. Deploy

```bash
vercel deploy --prod
```

### Docker

Build image:
```bash
docker build -t kad-samis:latest .
```

Run container:
```bash
docker run -p 3000:3000 \
  -e NEXT_PUBLIC_SUPABASE_URL=your_url \
  -e NEXT_PUBLIC_SUPABASE_ANON_KEY=your_key \
  -e SUPABASE_SERVICE_KEY=your_service_key \
  kad-samis:latest
```

### Traditional VPS/Server

1. Install Node.js 18+
2. Clone repository
3. Install dependencies: `npm install --production`
4. Build: `npm run build`
5. Set environment variables
6. Start: `npm run start`
7. Use PM2 for process management

PM2 setup:
```bash
npm install -g pm2
pm2 start npm --name "kad-samis" -- start
pm2 save
pm2 startup
```

## Supabase Configuration

### Create Database Policies

Run SQL migrations in Supabase SQL Editor:
```bash
npx supabase db push
```

### Storage Buckets

Create the following buckets in Supabase Storage:
- `assets` - Asset images
- `documents` - Asset documents
- `inspection-images` - Inspection photos
- `maintenance` - Maintenance documentation
- `avatars` - User profile pictures
- `contracts` - Contract files
- `reports` - Generated reports

### Enable Realtime

Enable Realtime subscriptions for:
- notifications
- maintenance_requests
- asset_transfers

## Performance Optimization

### Image Optimization
- Enable image caching in next.config.ts
- Use Next.js Image component
- Set appropriate cache headers

### Database
- Create indexes for frequently queried columns
- Archive old audit logs
- Implement caching strategy

### Frontend
- Code splitting with dynamic imports
- Lazy load modules
- Implement service worker caching

## Monitoring & Logging

### Sentry Setup (Error Tracking)

1. Create Sentry account
2. Add Sentry SDK: `npm install @sentry/nextjs`
3. Initialize in next.config.ts
4. Set SENTRY_AUTH_TOKEN

### Supabase Monitoring

- Monitor query performance
- Check RLS policy impact
- Review error logs
- Monitor storage usage

## Backup & Recovery

### Database Backups

Enable automatic backups in Supabase dashboard:
- Daily backups (7-day retention)
- Weekly backups (4-week retention)

Manual backup:
```bash
npx supabase db dump > backup_$(date +%Y%m%d).sql
```

### Disaster Recovery

- Document recovery procedures
- Test backup restoration
- Maintain offsite backups
- Document RTO/RPO requirements

## SSL/TLS Certificates

- Use Let's Encrypt for free certificates
- Auto-renewal with Certbot
- Update in web server configuration

## Maintenance

### Regular Tasks
- Monitor error logs
- Check disk space
- Update dependencies monthly
- Security patches immediately
- Database maintenance

### Health Checks
```bash
curl https://your-domain.com/api/health
```

## Security Hardening

- Enable HTTPS only
- Set secure HTTP headers
- Regular security audits
- Penetration testing
- Dependency vulnerability scanning

## Cost Optimization

- Monitor Supabase usage
- Implement query optimization
- Archive old data
- Use CDN for static assets
- Monitor API response times

## Support & Troubleshooting

For issues:
1. Check error logs in Supabase console
2. Review Next.js build output
3. Check Vercel/hosting provider logs
4. Review network requests in browser DevTools

## Contact

For deployment support, contact the development team.
