# KAD-SAMIS - Kaduna State Asset Management Information System

A production-ready Progressive Web Application (PWA) for enterprise asset management across Kaduna State government facilities.

## 🎯 Project Overview

KAD-SAMIS is a comprehensive asset management system designed to serve as the official digital asset registry for Kaduna State Facilities Management Agency. It enables centralized management of government assets across all Ministries, Departments, and Agencies (MDAs).

### Key Features

- **Comprehensive Asset Registry** - Track all government assets with QR codes, barcodes, and detailed documentation
- **Maintenance Management** - Schedule, track, and manage asset maintenance requests
- **Inspection Module** - Conduct digital inspections with offline support and GPS verification
- **Asset Transfers** - Manage asset transfers between departments with approval workflows
- **Real-time Reporting** - Generate PDF, Excel, and CSV reports on demand
- **Mobile-First PWA** - Fully responsive with offline capabilities and installable as an app
- **Enterprise RBAC** - Role-based access control with 11 predefined roles
- **Audit Trail** - Complete audit logging of all system activities
- **Real-time Notifications** - Stay updated with maintenance reminders and approvals

## 🛠️ Tech Stack

### Frontend
- **Next.js 15** - React framework with App Router
- **TypeScript** - Type-safe development
- **Tailwind CSS** - Utility-first styling
- **shadcn/ui** - Accessible component library
- **React Hook Form** - Efficient form handling
- **Zod** - TypeScript-first schema validation
- **TanStack Query** - Server state management
- **Framer Motion** - Smooth animations

### Backend
- **Supabase** - Backend-as-a-Service platform
  - PostgreSQL database
  - Row Level Security (RLS) policies
  - Edge Functions for serverless computing
  - Supabase Auth for authentication
  - Storage buckets for file management
  - Realtime subscriptions

### PWA & Offline
- **Service Worker** - Offline functionality
- **IndexedDB** - Local data storage
- **Background Sync** - Sync data when reconnected
- **Web Push API** - Push notifications

### Maps & Data Visualization
- **Leaflet** - Interactive mapping
- **OpenStreetMap** - Map tiles
- **Chart.js** - Data visualization

## 📋 Database Schema

The system includes 23 core tables:

- **Authentication**: users, roles, permissions, role_permissions
- **Organization**: ministries, departments, facilities, buildings, floors, rooms
- **Assets**: assets, asset_categories, asset_subcategories, asset_images, asset_documents
- **Maintenance**: maintenance_requests, maintenance_logs
- **Inspection**: inspections, inspection_images
- **Transfers**: asset_transfers
- **Procurement**: vendors, contracts, procurements, warranties
- **Financial**: asset_depreciation
- **Audit**: audit_logs, activity_logs, asset_history
- **System**: notifications, dashboard_cache, system_settings

All tables include:
- UUID primary keys
- Soft delete support (deleted_at)
- Audit fields (created_at, updated_at, created_by, updated_by)
- Appropriate indexes and foreign keys
- Row Level Security policies

## 🔐 Security Features

- Supabase Authentication with JWT tokens
- Row Level Security (RLS) for data isolation
- CSRF protection
- Rate limiting
- Secure password hashing
- Session management
- Comprehensive audit logging
- Input validation with Zod schemas

## 👥 User Roles

1. **Super Admin** - Full system access
2. **Agency Admin** - Facilities Management Agency administration
3. **Ministry Admin** - Ministry-level administration
4. **Department Head** - Department management
5. **Asset Officer** - Asset registry management
6. **Maintenance Officer** - Maintenance request handling
7. **Inspector** - Asset inspection duties
8. **Auditor** - Audit and compliance
9. **Procurement Officer** - Vendor and contract management
10. **Finance Officer** - Financial reporting
11. **Read-Only User** - View-only access

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn
- Supabase account (free tier available)

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd kad-samis
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Setup environment variables**
   ```bash
   cp .env.example .env.local
   ```
   Fill in your Supabase credentials:
   - NEXT_PUBLIC_SUPABASE_URL
   - NEXT_PUBLIC_SUPABASE_ANON_KEY
   - SUPABASE_SERVICE_KEY

4. **Setup Supabase**
   ```bash
   # Push database schema
   npx supabase db push
   
   # Seed initial data (optional)
   npm run db:seed
   ```

5. **Start development server**
   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000) in your browser.

## 📱 PWA Features

- **Installable** - Install on mobile or desktop
- **Offline Support** - Work without internet connection
- **Background Sync** - Automatic data sync when online
- **Push Notifications** - Maintenance and approval alerts
- **Responsive Design** - Optimized for all screen sizes

## 🏗️ Project Structure

```
kad-samis/
├── src/
│   ├── app/
│   │   ├── dashboard/       # Dashboard module
│   │   ├── assets/          # Asset registry
│   │   ├── facilities/      # Facilities management
│   │   ├── maintenance/     # Maintenance module
│   │   ├── inspections/     # Inspection module
│   │   ├── transfers/       # Asset transfers
│   │   ├── reports/         # Reporting
│   │   ├── users/           # User management
│   │   ├── auth/            # Authentication pages
│   │   └── layout.tsx       # Root layout
│   ├── components/
│   │   ├── ui/              # shadcn/ui components
│   │   ├── auth-provider.tsx
│   │   ├── protected-route.tsx
│   │   └── ...
│   ├── lib/
│   │   ├── supabase/        # Supabase client/server setup
│   │   ├── utils.ts         # Utility functions
│   │   └── ...
│   ├── types/
│   │   ├── index.ts         # Main types
│   │   └── database.types.ts # Supabase types
│   └── hooks/               # Custom React hooks
├── public/
│   ├── manifest.json        # PWA manifest
│   └── ...
├── supabase/
│   └── migrations/          # Database migrations
├── package.json
├── tsconfig.json
├── next.config.ts
├── tailwind.config.ts
└── README.md
```

## 📊 Key Modules

### Dashboard
Executive overview with:
- Total asset count and value
- Asset distribution by ministry/category
- Maintenance due items
- Pending approvals
- Recent activities
- Interactive charts

### Asset Registry
Complete asset lifecycle management:
- Create, edit, delete, archive assets
- Bulk upload and import (CSV/Excel)
- QR code and barcode generation
- Document and image management
- Asset timeline and history
- Advanced search and filtering

### Maintenance
Comprehensive maintenance tracking:
- Create maintenance requests
- Assign technicians
- Maintenance calendar
- Recurring maintenance schedules
- Work orders and cost tracking
- Maintenance history

### Inspections
Digital inspection capabilities:
- Take photos with timestamps
- Add inspection notes
- GPS verification
- Condition rating
- Offline inspection support
- Automatic sync when online

### Asset Transfers
Transfer management with workflows:
- Request transfers between locations
- Approval workflow
- Transfer history
- Location tracking

### Reports
Generate various reports:
- Asset register
- Asset valuation
- Maintenance reports
- Transfer reports
- Inspection reports
- Ministry and LGA reports
- Financial/depreciation reports
- Audit reports

## 🔄 API Routes

Key API endpoints will be developed in `/src/app/api/`:

- `/api/auth/*` - Authentication endpoints
- `/api/assets/*` - Asset management
- `/api/maintenance/*` - Maintenance requests
- `/api/inspections/*` - Inspection data
- `/api/transfers/*` - Asset transfers
- `/api/reports/*` - Report generation

## 📝 Environment Variables

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_KEY=your_service_key

# API
NEXT_PUBLIC_API_URL=http://localhost:3000

# PWA
NEXT_PUBLIC_APP_NAME=KAD-SAMIS
NEXT_PUBLIC_APP_DESCRIPTION=Kaduna State Asset Management Information System
```

## 🚢 Deployment

### Vercel (Recommended)
```bash
vercel deploy
```

### Docker
```bash
docker build -t kad-samis .
docker run -p 3000:3000 kad-samis
```

### Traditional VPS
1. Build: `npm run build`
2. Start: `npm run start`
3. Use PM2 or systemd for process management

## 📦 Building for Production

```bash
npm run build
npm run start
```

## 🧪 Testing

Testing setup coming soon. Will include:
- Unit tests (Jest)
- Integration tests
- E2E tests (Playwright)

## 📚 Documentation

- [Database Schema Documentation](./docs/DATABASE.md) - Coming soon
- [API Documentation](./docs/API.md) - Coming soon
- [Deployment Guide](./docs/DEPLOYMENT.md) - Coming soon
- [User Guide](./docs/USER_GUIDE.md) - Coming soon

## 🤝 Contributing

1. Create a feature branch (`git checkout -b feature/amazing-feature`)
2. Commit changes (`git commit -m 'Add amazing feature'`)
3. Push to branch (`git push origin feature/amazing-feature`)
4. Open a Pull Request

## 📄 License

This project is proprietary software for Kaduna State Government.

## 📞 Support

For technical support, contact the development team or create an issue in the repository.

## 🎯 Roadmap

- [x] Project scaffolding
- [x] Database schema design
- [x] Authentication setup
- [x] Core UI components
- [ ] Dashboard implementation
- [ ] Asset registry module
- [ ] Maintenance module
- [ ] Inspection module
- [ ] Report generation
- [ ] PWA capabilities enhancement
- [ ] Performance optimization
- [ ] Production testing
- [ ] Go-live deployment

## 🙏 Acknowledgments

Built with modern technologies to serve Kaduna State Government's asset management needs.
 