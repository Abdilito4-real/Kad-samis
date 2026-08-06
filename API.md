# KAD-SAMIS API Documentation

## Base URL
```
http://localhost:3000/api (Development)
https://kad-samis.vercel.app/api (Production)
```

## Authentication
All protected endpoints require:
```header
Authorization: Bearer {jwt_token}
```

## Response Format
```json
{
  "success": true,
  "data": {...},
  "error": null,
  "message": "Success"
}
```

## Error Handling
```json
{
  "success": false,
  "data": null,
  "error": "ERROR_CODE",
  "message": "Human readable error message"
}
```

## Endpoints

### Authentication

#### POST /api/auth/login
Login user
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

#### POST /api/auth/register
Register new user
```json
{
  "email": "user@example.com",
  "password": "password123",
  "firstName": "John",
  "lastName": "Doe"
}
```

#### POST /api/auth/logout
Logout current user

#### GET /api/auth/me
Get current user profile

### Assets

#### GET /api/assets
List all assets with pagination
```
GET /api/assets?page=1&limit=20&status=active
```

#### GET /api/assets/:id
Get asset details

#### POST /api/assets
Create new asset
```json
{
  "name": "Dell Laptop",
  "categoryId": "uuid",
  "manufacturer": "Dell",
  "purchasePrice": 150000
}
```

#### PUT /api/assets/:id
Update asset

#### DELETE /api/assets/:id
Delete asset (soft delete)

#### POST /api/assets/:id/restore
Restore deleted asset

#### POST /api/assets/bulk-import
Bulk import assets from CSV

#### GET /api/assets/:id/qr-code
Generate QR code for asset

#### GET /api/assets/:id/barcode
Generate barcode for asset

### Maintenance

#### GET /api/maintenance
List maintenance requests

#### POST /api/maintenance
Create maintenance request
```json
{
  "assetId": "uuid",
  "description": "Repair needed",
  "priority": "high"
}
```

#### PUT /api/maintenance/:id
Update maintenance request

#### GET /api/maintenance/:id/logs
Get maintenance logs

#### POST /api/maintenance/:id/logs
Add maintenance log entry

### Inspections

#### GET /api/inspections
List inspections

#### POST /api/inspections
Create inspection
```json
{
  "assetId": "uuid",
  "condition": "good",
  "notes": "Asset in good condition",
  "latitude": 10.5,
  "longitude": 7.4
}
```

#### POST /api/inspections/:id/images
Upload inspection images

### Transfers

#### GET /api/transfers
List asset transfers

#### POST /api/transfers
Create transfer request
```json
{
  "assetId": "uuid",
  "fromBuildingId": "uuid",
  "toBuildingId": "uuid",
  "reason": "Relocation"
}
```

#### PUT /api/transfers/:id
Update transfer status
```json
{
  "status": "approved"
}
```

### Reports

#### POST /api/reports/asset-register
Generate asset register report
```json
{
  "format": "pdf",
  "filters": {
    "status": "active"
  }
}
```

#### POST /api/reports/maintenance
Generate maintenance report

#### POST /api/reports/transfer
Generate transfer report

### Users

#### GET /api/users
List users (admin only)

#### POST /api/users
Create user (admin only)

#### PUT /api/users/:id
Update user

#### DELETE /api/users/:id
Delete user

### System

#### GET /api/system/health
System health check

#### GET /api/system/stats
System statistics

## Error Codes

- `AUTH_REQUIRED` - Authentication required
- `FORBIDDEN` - Access denied
- `NOT_FOUND` - Resource not found
- `VALIDATION_ERROR` - Input validation failed
- `DATABASE_ERROR` - Database operation failed
- `FILE_UPLOAD_ERROR` - File upload failed
- `RATE_LIMIT_EXCEEDED` - Too many requests

## Rate Limiting

- Default: 100 requests per 15 minutes per IP
- Authenticated: 500 requests per 15 minutes
- Increase limits contact: support@kad-samis.kg.gov.ng

## Pagination

```
?page=1&limit=20&sort=created_at&order=desc
```

Response includes:
```json
{
  "data": [...],
  "pagination": {
    "total": 100,
    "page": 1,
    "limit": 20,
    "pages": 5
  }
}
```

## Filtering

```
GET /api/assets?status=active&category=VEH&ministry_id=uuid
```

## Webhooks

Webhooks available for:
- Asset created/updated/deleted
- Maintenance request status changes
- Inspection completed
- Transfer approved/rejected

Configure in Settings → Webhooks

## API Versioning

Current version: v1

Future versions will be available at:
```
/api/v1/...
/api/v2/...
```

## SDK/Libraries

- JavaScript/TypeScript: `npm install kad-samis-sdk`
- Python: `pip install kad-samis`
- Java: Coming soon

## Support

API documentation: https://docs.kad-samis.kg.gov.ng
Status page: https://status.kad-samis.kg.gov.ng
Support: support@kad-samis.kg.gov.ng
