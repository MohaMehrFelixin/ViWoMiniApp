# MiniViWo Admin Panel - Complete Technical Specification

## Table of Contents

1. [Overview & Vision](#1-overview--vision)
2. [Architecture](#2-architecture)
3. [Data Model & Entity Management](#3-data-model--entity-management)
4. [Admin API Specification](#4-admin-api-specification)
5. [Authentication & Authorization](#5-authentication--authorization)
6. [UI/UX Design](#6-uiux-design)
7. [Dashboard & Analytics](#7-dashboard--analytics)
8. [Creative Features & Innovations](#8-creative-features--innovations)
9. [Implementation Phases](#9-implementation-phases)
10. [Tech Stack](#10-tech-stack)
11. [Conflict Audit: Current System vs. Admin Panel](#11-conflict-audit-current-system-vs-admin-panel)
12. [Production System Changes (April 2026)](#12-production-system-changes-april-2026)

---

## 1. Overview & Vision

### What This Is

A full-power admin panel for the MiniViWo welfare distribution system. This panel gives operators **complete visibility and control** over every entity in the system: households, members, coupons, allocations, redemptions, distribution centers, volunteers, distributors, power bank swaps, KYC management, and system configuration.

### Role Hierarchy (10 Levels)

The admin panel uses a **10-level organizational hierarchy**. Higher levels inherit all permissions of levels below them. Levels 6-8 (Supervisors) can create and manage users at levels below them within their scope.

```
Level 10  CEO
  |
Level 9   CTO / COO
  |
Level 8   Regional Director
  |
Level 7   Senior Supervisor
  |
Level 6   Supervisor
  |
Level 5   Operations Manager
  |
Level 4   KYC Officer
  |
Level 3   Distribution Manager
  |
Level 2   Field Agent
  |
Level 1   Viewer (Auditor)
```

| Level | Role | Scope | Key Responsibilities | Can Manage Roles Below |
|:-----:|------|-------|----------------------|:----------------------:|
| **10** | **CEO** | Global, unrestricted | Full system ownership. Can modify anything, delete any entity, change system settings, manage all users including CTOs. Emergency overrides. The only role that can promote someone to Level 9. | All (1-9) |
| **9** | **CTO / COO** | Global, all modules | System architecture decisions, allocation engine configuration, API rate limits, security settings, bulk operations, data exports. Can create Regional Directors and below. | 1-8 |
| **8** | **Regional Director** | Scoped to assigned province(s) | Oversees all operations within assigned provinces. Can view/edit all entities within their region. Manages Senior Supervisors and below in their region. Approves escalated disputes. | 1-7 (within region) |
| **7** | **Senior Supervisor** | Scoped to assigned province(s) | Manages day-to-day operations. Reviews and approves volunteer/distributor applications. Handles dispute resolution. Can create Supervisors, Officers, and Managers. | 1-6 (within region) |
| **6** | **Supervisor** | Scoped to assigned province(s) | Front-line team lead. Assigns tasks to Officers/Managers/Agents. Reviews KYC submissions in bulk. Monitors center performance. Can create Field Agents. | 1-2 (within region) |
| **5** | **Operations Manager** | All entities, read + write (no delete) | Allocation adjustments, household management, member updates, redemption monitoring, center stock management. Cannot manage admin users. | None |
| **4** | **KYC Officer** | KYC + Members + Volunteers | Reviews/approves/rejects KYC submissions. Verifies member identities. Reviews volunteer applications. Read-only on other entities. | None |
| **3** | **Distribution Manager** | Centers + Redemptions + Power Banks + Distributors | Manages distribution centers (full CRUD). Updates stock levels. Monitors redemptions at their centers. Reviews distributor applications. | None |
| **2** | **Field Agent** | Limited write on assigned entities | Data entry: register households, add members, update center stock on-site. Can flag issues but not resolve them. Read-only on analytics. | None |
| **1** | **Viewer (Auditor)** | Read-only on everything | Compliance review, data exports, audit trail inspection. Cannot modify any entity. Used for external auditors, oversight bodies, and reporting roles. | None |

### Current System Entities (from codebase)

These are the **verified** entities that exist in the running system today:

| Entity | DB Table | Go Model | Frontend Type |
|--------|----------|----------|---------------|
| Household | `households` | `model.Household` | `Household` |
| Household Member | `household_members` | `model.HouseholdMember` | `HouseholdMember` |
| Coupon Allocation | `coupon_allocations` | `model.CouponAllocation` | `CategoryBalance` |
| Coupon Redemption | `coupon_redemptions` | `model.CouponRedemption` | `CouponRedemption` |
| Distribution Center | `distribution_centers` | `model.DistributionCenter` | `DistributionCenter` |
| Power Bank Swap | `power_bank_swaps` | `model.PowerBankSwap` | `PowerBankSwap` |
| Volunteer | *frontend-only store* | *N/A* | `useVolunteerStore` |
| Distributor | *frontend-only store* | *N/A* | `useDistributorStore` |

---

## 2. Architecture

### Deployment Model

```
                    +------------------+
                    |   Admin SPA      |
                    |  (React + Vite)  |
                    +--------+---------+
                             |
                    +--------v---------+
                    |  Admin API       |
                    |  /api/v1/admin/* |
                    |  (Go, same bin)  |
                    +--------+---------+
                             |
              +--------------+--------------+
              |              |              |
      +-------v--+   +------v---+   +------v---+
      | PostgreSQL|   |  Redis   |   | S3/Minio |
      | (existing)|   |(existing)|   | (new)    |
      +-----------+   +----------+   +----------+
```

### Key Decision: Same Binary, Separate Route Group

The admin API lives in the **same Go binary** as the existing coupon API. This avoids:
- Duplicate database connections
- Model drift between services
- Deployment complexity

The admin routes are mounted under `/api/v1/admin/*` with their own authentication middleware (JWT-based, not Telegram initData).

### New Backend Packages

```
backend/
  internal/
    admin/
      handler/
        admin_handler.go        # HTTP handlers
        routes.go               # Route registration
      service/
        admin_service.go        # Business logic
        audit_service.go        # Audit trail logging
        export_service.go       # CSV/Excel exports
        stats_service.go        # Dashboard statistics
      repository/
        admin_repo.go           # Admin-specific queries
        audit_repo.go           # Audit log persistence
      middleware/
        jwt_auth.go             # JWT authentication
        rbac.go                 # Role-based access control
      model/
        admin.go                # Admin user model
        audit.go                # Audit log model
        roles.go                # Role definitions
```

### New Frontend App

```
admin/
  src/
    app/
      App.tsx                   # Admin SPA entry
      router.tsx                # Admin routes
    pages/
      DashboardPage.tsx         # Overview dashboard
      HouseholdsPage.tsx        # Household CRUD
      HouseholdDetailPage.tsx   # Single household view
      MembersPage.tsx           # Member management
      AllocationsPage.tsx       # Allocation management
      RedemptionsPage.tsx       # Redemption monitoring
      CentersPage.tsx           # Distribution center CRUD
      CenterDetailPage.tsx      # Single center view
      PowerBanksPage.tsx        # Power bank swap tracking
      VolunteersPage.tsx        # Volunteer management
      DistributorsPage.tsx      # Distributor management
      KycPage.tsx               # KYC review queue
      NoticesPage.tsx            # Notice banner management (CRUD, reorder)
      UsersPage.tsx             # Admin user management
      AuditPage.tsx             # Audit trail viewer
      SettingsPage.tsx          # System configuration (rate limits, telegram, allocation)
      LoginPage.tsx             # Admin login
    components/
      DataTable.tsx             # Reusable sortable/filterable table
      DetailPanel.tsx           # Slide-over detail view
      StatCard.tsx              # Dashboard metric card
      Chart.tsx                 # Chart wrapper
      FilterBar.tsx             # Table filter controls
      StatusBadge.tsx           # Entity status badges
      ActionMenu.tsx            # Row action dropdown
      BulkActions.tsx           # Multi-select operations
      AuditTimeline.tsx         # Chronological audit log
      MapView.tsx               # Center/household geo view
      ExportButton.tsx          # Data export trigger
    store/
      useAuthStore.ts           # Admin auth state
      useAdminStore.ts          # Admin panel state
    api/
      admin.ts                  # Admin API client
    lib/
      permissions.ts            # RBAC helpers
      constants.ts              # Admin constants
```

---

## 3. Data Model & Entity Management

### 3.1 New Database Tables

#### `admin_users`

```sql
CREATE TABLE admin_users (
    id              BIGINT PRIMARY KEY,
    -- Identity (same KYC model as regular users)
    national_code   VARCHAR(10) UNIQUE NOT NULL,
    full_name       VARCHAR(200) NOT NULL,
    phone           VARCHAR(15) NOT NULL,           -- for OTP delivery
    birth_date      DATE,
    gender          VARCHAR(10),                    -- male, female, other
    address         VARCHAR(500),
    -- Hierarchy
    role_level      INT NOT NULL DEFAULT 1,         -- 1 (viewer) to 10 (CEO)
    role_title      VARCHAR(50) NOT NULL DEFAULT 'viewer',
    province_codes  TEXT[] DEFAULT '{}',             -- regional scope (empty = global for L9-10)
    parent_admin_id BIGINT REFERENCES admin_users(id), -- who created/manages this user
    -- Status
    status          VARCHAR(20) NOT NULL DEFAULT 'active',
    last_login      TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_admin_users_role ON admin_users(role_level);
CREATE INDEX idx_admin_users_parent ON admin_users(parent_admin_id);
CREATE INDEX idx_admin_users_province ON admin_users USING GIN(province_codes);
CREATE INDEX idx_admin_users_national_code ON admin_users(national_code);
-- role_title values: ceo(10), cto(9), coo(9), regional_director(8),
--   senior_supervisor(7), supervisor(6), operations_manager(5),
--   kyc_officer(4), distribution_manager(3), field_agent(2), viewer(1)
```

#### `audit_logs`

```sql
CREATE TABLE audit_logs (
    id          BIGINT PRIMARY KEY,
    admin_id    BIGINT REFERENCES admin_users(id),
    action      VARCHAR(50) NOT NULL,   -- create, update, delete, approve, reject, export
    entity_type VARCHAR(50) NOT NULL,   -- household, member, allocation, redemption, center, etc.
    entity_id   BIGINT,
    old_value   JSONB,
    new_value   JSONB,
    ip_address  INET,
    user_agent  VARCHAR(500),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_logs_admin ON audit_logs(admin_id, created_at DESC);
CREATE INDEX idx_audit_logs_action ON audit_logs(action, created_at DESC);
```

#### `volunteers` (persist what's currently frontend-only)

```sql
CREATE TABLE volunteers (
    id              BIGINT PRIMARY KEY,
    household_id    BIGINT REFERENCES households(id),
    member_id       BIGINT REFERENCES household_members(id),
    specialty       VARCHAR(100),       -- from VOLUNTEER_SPECIALTIES or custom:*
    status          VARCHAR(20) NOT NULL DEFAULT 'pending',
    verified_at     TIMESTAMPTZ,
    verified_by     BIGINT REFERENCES admin_users(id),
    notes           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- Status: pending, approved, rejected, suspended
```

#### `distributors` (persist what's currently frontend-only)

```sql
CREATE TABLE distributors (
    id              BIGINT PRIMARY KEY,
    household_id    BIGINT REFERENCES households(id),
    store_address   VARCHAR(500) NOT NULL,
    store_desc      TEXT,
    status          VARCHAR(20) NOT NULL DEFAULT 'pending',
    verified_at     TIMESTAMPTZ,
    verified_by     BIGINT REFERENCES admin_users(id),
    notes           TEXT,
    lat             DOUBLE PRECISION,
    lng             DOUBLE PRECISION,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- Status: pending, approved, rejected, suspended
```

#### `system_settings`

```sql
CREATE TABLE system_settings (
    key         VARCHAR(100) PRIMARY KEY,
    value       JSONB NOT NULL,
    updated_by  BIGINT REFERENCES admin_users(id),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- Keys: allocation_base_amounts, location_multipliers, kyc_tier_factors,
--        special_flag_multipliers, weekly_release_pcts, rate_limits, etc.
```

### 3.2 Entity CRUD Operations

For every existing entity, the admin panel provides:

#### Households

| Operation | Description |
|-----------|-------------|
| **List** | Paginated, filterable by status/kyc_tier/location/province, searchable by code/telegram_id |
| **View** | Full detail + members + allocations + redemption history + audit trail |
| **Update** | Edit status (active/suspended/pending), kyc_tier, address, location_segment |
| **Suspend** | Set status=suspended, block all redemptions |
| **Reactivate** | Set status=active, resume redemptions |
| **Recalculate** | Trigger allocation recalculation (calls `AllocationService.CalculateAndIssue`) |
| **Export** | CSV/Excel of filtered household data |

#### Household Members

| Operation | Description |
|-----------|-------------|
| **List** | All members across households, filterable by age_group/gender/special_flags |
| **View** | Full member detail + household context |
| **Update** | Edit full_name, relationship, special_flags, kyc_verified |
| **Verify KYC** | Set kyc_verified=true, triggers allocation recalculation |
| **Remove** | Soft-delete member, triggers reallocation |
| **Bulk Verify** | Multi-select KYC verification |

#### Coupon Allocations

| Operation | Description |
|-----------|-------------|
| **List** | All allocations, filterable by category/status/cycle |
| **View** | Allocation detail + linked redemptions |
| **Adjust** | Manually adjust total_amount (with audit reason) |
| **Expire** | Force-expire an allocation |
| **Bulk Recalculate** | Recalculate allocations for filtered set of households |

#### Coupon Redemptions

| Operation | Description |
|-----------|-------------|
| **List** | All redemptions, filterable by status/category/center/date range |
| **View** | Full redemption detail + QR data + household + center |
| **Resolve Dispute** | Accept dispute (reverse redemption) or reject dispute |
| **Reverse** | Admin-initiated reversal (credits amount back) |
| **Export** | CSV of filtered redemption data |

#### Distribution Centers

| Operation | Description |
|-----------|-------------|
| **List** | All centers, filterable by status/type/province |
| **Create** | Add new center with full details |
| **Update** | Edit all fields: name, address, lat/lng, categories, operating_hours, status |
| **Update Stock** | Update stock_status JSONB per category |
| **Deactivate** | Set status=closed |
| **Map View** | Geospatial view of all centers with status coloring |

#### Power Bank Swaps

| Operation | Description |
|-----------|-------------|
| **List** | All swaps, filterable by status/center/date |
| **View** | Swap detail + household + center |
| **Override Status** | Admin can force any status transition |
| **Cancel** | Force-cancel any swap regardless of current status |

#### Volunteers

| Operation | Description |
|-----------|-------------|
| **Queue** | Pending volunteer applications |
| **Approve/Reject** | Review and decide on applications |
| **List** | All volunteers, filterable by specialty/status |
| **Update** | Edit specialty, status, notes |
| **Suspend** | Temporarily disable volunteer |

#### Distributors

| Operation | Description |
|-----------|-------------|
| **Queue** | Pending distributor applications |
| **Approve/Reject** | Review store details, decide on applications |
| **List** | All distributors, filterable by status |
| **Update** | Edit store details, status, notes |
| **Suspend** | Temporarily disable distributor |

---

## 4. Admin API Specification

### Base Path: `/api/v1/admin`

### Authentication Endpoints

```
POST   /auth/request-otp        # Send OTP to admin's phone by national code
POST   /auth/verify-otp         # Verify OTP, create session
POST   /auth/logout             # Invalidate session
GET    /auth/me                 # Current admin profile + role + scope
```

### Dashboard

```
GET    /dashboard/stats         # Aggregate statistics
GET    /dashboard/activity      # Recent activity feed
GET    /dashboard/alerts        # System alerts (low stock, disputes, etc.)
```

### Households

```
GET    /households                          # List (paginated, filterable)
GET    /households/:id                      # Detail view
PUT    /households/:id                      # Update fields
POST   /households/:id/suspend              # Suspend household
POST   /households/:id/reactivate           # Reactivate household
POST   /households/:id/recalculate          # Trigger allocation recalc
GET    /households/:id/members              # List members
GET    /households/:id/allocations          # List allocations
GET    /households/:id/redemptions          # List redemptions
GET    /households/:id/audit                # Audit trail
GET    /households/export                   # CSV export
```

### Members

```
GET    /members                             # List all (paginated, filterable)
GET    /members/:id                         # Detail view
PUT    /members/:id                         # Update fields
POST   /members/:id/verify-kyc             # Mark KYC verified
DELETE /members/:id                         # Soft-delete
POST   /members/bulk-verify                 # Bulk KYC verification
```

### Allocations

```
GET    /allocations                         # List (paginated, filterable)
GET    /allocations/:id                     # Detail view
PUT    /allocations/:id/adjust              # Adjust amount (with reason)
POST   /allocations/:id/expire              # Force expire
POST   /allocations/bulk-recalculate        # Bulk recalculate
```

### Redemptions

```
GET    /redemptions                         # List (paginated, filterable)
GET    /redemptions/:id                     # Detail view
POST   /redemptions/:id/resolve-dispute     # Accept or reject dispute
POST   /redemptions/:id/reverse             # Admin reversal
GET    /redemptions/export                  # CSV export
```

### Distribution Centers

```
GET    /centers                             # List (paginated, filterable)
POST   /centers                             # Create new center
GET    /centers/:id                         # Detail view
PUT    /centers/:id                         # Update fields
PUT    /centers/:id/stock                   # Update stock status
DELETE /centers/:id                         # Deactivate
GET    /centers/map                         # GeoJSON for map view
```

### Power Bank Swaps

```
GET    /powerbanks                          # List (paginated, filterable)
GET    /powerbanks/:id                      # Detail view
PUT    /powerbanks/:id/status               # Override status
POST   /powerbanks/:id/cancel               # Force cancel
```

### Volunteers

```
GET    /volunteers                          # List (paginated, filterable)
GET    /volunteers/queue                    # Pending applications
GET    /volunteers/:id                      # Detail view
POST   /volunteers/:id/approve              # Approve
POST   /volunteers/:id/reject               # Reject
PUT    /volunteers/:id                      # Update
```

### Distributors

```
GET    /distributors                        # List (paginated, filterable)
GET    /distributors/queue                  # Pending applications
GET    /distributors/:id                    # Detail view
POST   /distributors/:id/approve            # Approve
POST   /distributors/:id/reject             # Reject
PUT    /distributors/:id                    # Update
```

### Admin Users

```
GET    /users                               # List admin users
POST   /users                               # Create admin user
GET    /users/:id                           # View admin user
PUT    /users/:id                           # Update admin user
DELETE /users/:id                           # Deactivate admin user
```

### Audit Logs

```
GET    /audit                               # List (paginated, filterable by entity/action/admin/date)
GET    /audit/export                        # CSV export
```

### Notices (NEW — added to support production notice system)

```
GET    /notices                             # List all notices
POST   /notices                             # Create notice
PUT    /notices/:id                         # Update notice
DELETE /notices/:id                         # Delete notice
POST   /notices/reorder                     # Reorder notices
```

Notice object schema (stored in Redis `app:notices` as JSON array):

```json
{
  "id": "n1",
  "text": "English notice text",
  "text_fa": "متن اطلاعیه فارسی",
  "type": "info | warning | promo",
  "link": "https://optional-url.com",
  "active": true,
  "created_at": "2026-04-07T00:00:00Z",
  "created_by": 12345
}
```

Admin writes to Redis via backend API. Frontend Mini App reads via `GET /api/v1/coupon/notices` (public, rate-limited, no auth required).

### System Settings

```
GET    /settings                            # List all settings
PUT    /settings/:key                       # Update setting value
GET    /settings/allocation-config          # Current allocation parameters
PUT    /settings/allocation-config          # Update allocation parameters
GET    /settings/rate-limits                # Current rate limit config
PUT    /settings/rate-limits                # Update rate limits
GET    /settings/telegram                   # Telegram bot config status
```

### Common Query Parameters

All list endpoints support:

| Param | Type | Description |
|-------|------|-------------|
| `page` | int | Page number (default: 1) |
| `limit` | int | Items per page (default: 25, max: 100) |
| `sort` | string | Field to sort by (e.g., `created_at`, `-created_at` for DESC) |
| `search` | string | Full-text search across relevant fields |
| `status` | string | Filter by status |
| `from` | ISO date | Created after date |
| `to` | ISO date | Created before date |

---

## 5. Authentication & Authorization

### OTP Authentication

```
POST /api/v1/admin/auth/request-otp
Body: { "national_code": "0012345678" }
Response: { "message": "OTP sent", "expires_in": 120 }

POST /api/v1/admin/auth/verify-otp
Body: { "national_code": "0012345678", "otp": "583912" }
Response: { "session_token": "...", "expires_at": "...", "admin": { ... } }

All subsequent requests:
Authorization: Session <session_token>

POST /api/v1/admin/auth/logout
Response: { "message": "session invalidated" }

GET /api/v1/admin/auth/me
Response: { admin user profile + role + scope }
```

- OTP: 6-digit, 2-minute TTL, max 3 attempts per code
- OTP delivery: SMS to registered phone number
- Sessions: stored in Redis, 8-hour TTL, sliding expiry on activity
- Rate limit: max 5 OTP requests per national code per hour
- No passwords anywhere in the system

### RBAC Permission Matrix (10-Level Hierarchy)

**Legend**: C = Create, R = Read, U = Update, D = Delete, `*` = full CRUD, `-` = no access, `(s)` = scoped to assigned region

| Resource | L10 CEO | L9 CTO/COO | L8 Regional Dir | L7 Sr. Supervisor | L6 Supervisor | L5 Ops Manager | L4 KYC Officer | L3 Dist. Manager | L2 Field Agent | L1 Viewer |
|----------|:-------:|:----------:|:---------------:|:-----------------:|:-------------:|:--------------:|:--------------:|:----------------:|:--------------:|:---------:|
| **Dashboard** | * | * | R(s) | R(s) | R(s) | R | R | R | R | R |
| **Households** | * | * | *(s) | RU(s) | RU(s) | RU | R | R | CRU | R |
| **Members** | * | * | *(s) | RU(s) | RU(s) | RU | RU | R | CRU | R |
| **Allocations** | * | * | RU(s) | RU(s) | R(s) | RU | R | R | R | R |
| **Redemptions** | * | * | *(s) | RU(s) | R(s) | RU | R | RU | R | R |
| **Centers** | * | * | *(s) | RU(s) | R(s) | RU | R | * | RU | R |
| **Power Banks** | * | * | *(s) | RU(s) | R(s) | RU | R | RU | R | R |
| **Volunteers** | * | * | *(s) | *(s) | RU(s) | RU | RU | R | R | R |
| **Distributors** | * | * | *(s) | *(s) | R(s) | RU | R | RU | R | R |
| **Notices** | * | * | *(s) | CRU(s) | CRU(s) | CRU | - | - | - | R |
| **Admin Users** | * | CRU(1-8) | CRU(1-7)(s) | CRU(1-6)(s) | CRU(1-2)(s) | - | - | - | - | R |
| **Audit Logs** | * | R | R(s) | R(s) | R(s) | R | R | R | R | R |
| **Settings** | * | RW | R | R | - | R | - | - | - | R |
| **Export** | Y | Y | Y(s) | Y(s) | Y(s) | Y | Y | Y | - | Y |
| **Bulk Ops** | Y | Y | Y(s) | Y(s) | Y(s) | Y | Y | - | - | - |

### Hierarchy Rules

#### Delegation & Scope

1. **Downward-only management**: A user at level N can only create/edit/deactivate users at levels 1 through N-1. No lateral or upward management.
2. **Regional scoping** (levels 6-8): Supervisors and Directors are assigned to one or more `province_code` values. They can only see and manage entities within those provinces. CEO (10) and CTO/COO (9) are global.
3. **Scope inheritance**: When a Supervisor creates a Field Agent, that agent inherits the same regional scope (or a subset of it).
4. **Escalation path**: Issues that exceed a role's authority are escalated up the chain. Example: a Field Agent flags a fraudulent household, the Supervisor reviews, and if needed escalates to the Regional Director.

#### Role Assignment Rules

| Assigner Level | Can Assign Roles | Constraints |
|:--------------:|-----------------|-------------|
| 10 (CEO) | All roles (1-9) | No restrictions |
| 9 (CTO/COO) | Levels 1-8 | Cannot create another CTO/COO |
| 8 (Regional Dir) | Levels 1-7 | Only within assigned provinces |
| 7 (Sr. Supervisor) | Levels 1-6 | Only within assigned provinces |
| 6 (Supervisor) | Levels 1-2 | Only within assigned provinces |
| 5 and below | None | Cannot manage admin users |

#### Conflict Resolution

- If two admins edit the same entity simultaneously, **last-write-wins** with a warning showing the previous editor's name and timestamp.
- If a lower-level admin's action is overridden by a higher-level admin, both actions are recorded in the audit log with a `superseded_by` reference.
- A suspended admin's pending approvals are automatically reassigned to their direct supervisor.

### Database Schema for Hierarchy

```sql
-- Updated admin_users table with hierarchy support
CREATE TABLE admin_users (
    id              BIGINT PRIMARY KEY,
    email           VARCHAR(255) UNIQUE NOT NULL,
    password        VARCHAR(255) NOT NULL,          -- bcrypt hash
    full_name       VARCHAR(200) NOT NULL,
    role_level      INT NOT NULL DEFAULT 1,         -- 1-10
    role_title      VARCHAR(50) NOT NULL DEFAULT 'viewer',
    province_codes  TEXT[] DEFAULT '{}',             -- regional scope (empty = global)
    parent_admin_id BIGINT REFERENCES admin_users(id), -- who created this user
    status          VARCHAR(20) NOT NULL DEFAULT 'active',
    last_login      TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_admin_users_role ON admin_users(role_level);
CREATE INDEX idx_admin_users_parent ON admin_users(parent_admin_id);
CREATE INDEX idx_admin_users_province ON admin_users USING GIN(province_codes);

-- Role titles mapped to levels
-- 10: ceo
-- 9:  cto, coo
-- 8:  regional_director
-- 7:  senior_supervisor
-- 6:  supervisor
-- 5:  operations_manager
-- 4:  kyc_officer
-- 3:  distribution_manager
-- 2:  field_agent
-- 1:  viewer
```

### API Endpoints for Hierarchy Management

```
GET    /admin/users/hierarchy               # Tree view of org chart
GET    /admin/users/:id/subordinates        # Direct reports of a user
POST   /admin/users/:id/transfer            # Transfer subordinates to another admin
PUT    /admin/users/:id/scope               # Update province_codes scope
GET    /admin/users/by-province/:code       # All admins in a province
```

### UI: Organization Chart View

Admins at level 6+ see an **org chart** page showing their downline hierarchy:

```
                        [CEO - Ahmad]
                       /             \
              [CTO - Sara]        [COO - Reza]
              /          \                    \
    [Dir Tehran]    [Dir Isfahan]        [Dir Shiraz]
     /       \           |                    |
 [Sr.Sup]  [Sr.Sup]  [Sr.Sup]           [Sr.Sup]
  / | \      / \        |                  / \
[S] [S] [S] [S] [S]   [S]              [S]  [S]
 |   |       |          |                |
[FA] [FA]   [FA]       [FA]            [FA]
```

- Click any node to view that admin's profile and their scope
- Drag-and-drop to reassign subordinates between supervisors at the same level
- Color-coded by status: green = active, gray = inactive, red = suspended

---

## 6. UI/UX Design

### Design System

- **Framework**: React 19 + TypeScript + Tailwind CSS
- **Component Library**: shadcn/ui (matches the glass-morphism aesthetic of existing app, highly customizable)
- **Charts**: Recharts (lightweight, React-native)
- **Tables**: TanStack Table v8 (sorting, filtering, pagination, virtual scroll)
- **Maps**: React-Leaflet (same as existing frontend)
- **Icons**: Lucide React (consistent, tree-shakeable)
- **Theme**: Dark-first (matching existing Telegram Mini App dark mode), with light mode toggle

### Layout Structure

```
+----------------------------------------------------------+
|  Logo   |  Search (Cmd+K)  |  Alerts  |  Lang  |  User  |
+----+-----------------------------------------------------+
|    |                                                      |
| S  |  Page Content                                        |
| I  |                                                      |
| D  |  +--StatCards Row----------------------------------+ |
| E  |  | Total HH | Active | Redemptions | Disputes     | |
| B  |  +---------------------------------------------+  | |
| A  |                                                      |
| R  |  +--DataTable / Content--------------------------+  |
|    |  |                                               |  |
| D  |  |  FilterBar                                    |  |
| a  |  |  [Status v] [Category v] [Date Range] [Search]| |
| s  |  |                                               |  |
| h  |  |  Sortable rows with inline actions            |  |
| b  |  |  ...                                          |  |
| o  |  |  Pagination                                   |  |
| a  |  +-----------------------------------------------+  |
| r  |                                                      |
| d  |                                                      |
+----+------------------------------------------------------+
```

### Sidebar Navigation

```
Dashboard
---
Households
  Members
Allocations
Redemptions
---
Distribution Centers
Power Banks
---
Volunteers
Distributors
KYC Review
---
Notices
Admin Users
Audit Trail
Settings
```

### Key UI Patterns

#### 1. Data Tables (primary interaction pattern)

Every list page uses the same DataTable component:
- Column sorting (click header)
- Multi-column filtering (dropdown + text input)
- Full-text search
- Row selection (checkbox) for bulk actions
- Inline status badges with color coding
- Row hover reveals quick actions (view, edit, suspend)
- Click row to open detail panel (slide-over from right)
- Pagination with page size selector

#### 2. Detail Panel (slide-over)

When clicking an entity:
- 70% width slide-over panel from right
- Tabbed interface: Overview | Related Data | Audit Trail
- Inline editing with save/cancel
- Action buttons at top (Suspend, Approve, Recalculate, etc.)
- Audit timeline at bottom

#### 3. Status Badges

| Status | Color | Usage |
|--------|-------|-------|
| active/open/approved | Green | Healthy state |
| pending | Yellow/Amber | Awaiting action |
| suspended/closed | Red | Blocked state |
| expired/exhausted | Gray | Completed state |
| disputed | Orange | Needs attention |

#### 4. Command Palette (Cmd+K)

Global search across all entities:
- Type household code, member name, center name, swap code
- Quick navigation to any page
- Quick actions: "Suspend household HH-...", "Approve volunteer #..."

#### 5. Responsive Behavior

- **Desktop** (1280px+): Full sidebar + table + detail panel
- **Tablet** (768-1279px): Collapsible sidebar, table fills width, detail panel is modal
- **Mobile** (< 768px): Bottom navigation, card-based lists instead of tables

### Page-Specific Designs

#### Dashboard Page

```
+--Row 1: Key Metrics--------------------------------------+
| [Total Households: 12,450] [Active Allocations: 48,200]  |
| [Today's Redemptions: 3,218] [Open Disputes: 14]         |
+--Row 2: Charts-------------------------------------------+
| [Redemptions/Day Line Chart]  [Category Distribution Pie] |
+--Row 3: Attention Needed---------------------------------+
| [Pending KYC: 23]  [Low Stock Centers: 5]  [Disputes: 14]|
+--Row 4: Recent Activity----------------------------------+
| Timeline of recent admin actions and system events        |
+-----------------------------------------------------------+
```

#### KYC Review Page

```
+--Queue View (Kanban-style)-------------------------------+
| [Pending (23)]      [Under Review (5)]   [Completed (148)]|
|  Card: Name          Card: Name           Card: Name      |
|  National Code       National Code        Status: Approved |
|  Submitted: 2h ago   Reviewer: Admin1     Reviewed: 1d ago|
|  [Review ->]         [Approve] [Reject]                   |
+-----------------------------------------------------------+
```

#### Map View (Centers Page)

```
+--Full-width map with overlay controls--------------------+
|  [Filter: Status v] [Category v]                         |
|                                                          |
|  Interactive Leaflet map with:                           |
|  - Color-coded center markers (green=open, red=closed)   |
|  - Click marker: popup with center details + quick edit  |
|  - Heatmap toggle: redemption density overlay            |
|  - Draw tool: select region for bulk operations          |
|                                                          |
+-----------------------------------------------------------+
```

---

## 7. Dashboard & Analytics

### Real-Time Metrics (Redis-backed)

| Metric | Source | Refresh |
|--------|--------|---------|
| Total Households | `SELECT COUNT(*) FROM households` | 5 min |
| Active Households | `WHERE status='active'` | 5 min |
| Today's Redemptions | `WHERE created_at >= TODAY` | 30 sec |
| Today's Redemption Value | `SUM(amount) WHERE created_at >= TODAY` | 30 sec |
| Open Disputes | `WHERE status='disputed'` | 1 min |
| Pending KYC | `WHERE kyc_verified=false` | 1 min |
| Low Stock Centers | `WHERE status='low_stock'` | 1 min |
| Active Power Bank Swaps | `WHERE status IN ('pending','ready','picked_up')` | 1 min |

### Charts

1. **Redemptions Over Time** - Line chart, daily/weekly/monthly aggregation, per-category breakdown
2. **Category Distribution** - Pie/donut chart of total allocation amounts by category
3. **Redemption Heatmap** - Calendar heatmap showing daily redemption intensity
4. **Center Utilization** - Bar chart of redemptions per center
5. **KYC Funnel** - Funnel showing conversion: registered -> KYC submitted -> verified -> active
6. **Geographic Distribution** - Choropleth map of households by province
7. **Allocation vs. Redemption** - Stacked area chart showing issuance vs. usage rates
8. **Weekly Release Tracking** - 4-bar chart per week showing 35/25/25/15 release vs actual usage

### Alerts System

Automated alerts pushed to dashboard:

| Alert | Trigger | Severity |
|-------|---------|----------|
| Low Stock | Center stock below 20% in any category | Warning |
| Dispute Spike | >10 disputes in 1 hour | Critical |
| Unusual Redemption | Single household >5 redemptions in 1 hour | Warning |
| Center Offline | No redemptions at a center for 24h | Info |
| Allocation Exhausted | >100 households hit 0 balance | Warning |
| System Health | PostgreSQL or Redis health check fails | Critical |

---

## 8. Creative Features & Innovations

### 8.1 Smart Allocation Simulator

An interactive tool where admins can **simulate** changes to allocation parameters before applying them:

- Adjust base amounts, multipliers, weekly release percentages
- See projected impact: "This change affects 3,200 households, increases food allocation by 12%"
- Side-by-side comparison: current vs. proposed
- Dry-run button that calculates without persisting
- If approved, applies changes with one click

### 8.2 Fraud Detection Dashboard

Visual anomaly detection:

- **Velocity checks**: Highlight households with unusually rapid redemptions
- **Geographic anomalies**: Household in Tehran redeeming in Isfahan
- **Pattern matching**: Same national codes appearing across multiple households
- **Time-based**: Redemptions at unusual hours (3 AM)
- Color-coded risk scores on household list view

### 8.3 Live Operations Map

Real-time map that shows:

- Animated dots for redemptions as they happen (WebSocket feed)
- Center capacity gauges overlaid on markers
- Household density heatmap
- Click a region to see aggregated stats
- Time slider to replay activity over past 24h/7d

### 8.4 Bulk Operations Workbench

A dedicated page for mass operations:

- Upload CSV to bulk-register households
- Bulk KYC verification from uploaded document
- Bulk allocation adjustments with preview
- Batch center stock updates
- All with undo capability (within 5 minute window)

### 8.5 Natural Language Search

Instead of complex filters, admins can type:

- "Households in Tehran with suspended status"
- "Redemptions over 50kg food this week"
- "Centers with low water stock"

Parsed into structured queries with a confirmation step.

### 8.6 Configurable Allocation Engine (UI)

Move the hardcoded allocation constants from Go code into admin-configurable settings:

| Setting | Current Value | Configurable |
|---------|--------------|-------------|
| Base amounts per age group | Hardcoded in `allocation_service.go` | `system_settings` table |
| Special flag multipliers | pregnant: food 1.25x, etc. | `system_settings` table |
| Location multipliers | Tehran 0.80x, urban 1.00x, rural 1.20x | `system_settings` table |
| KYC tier factors | digital 1.0x, semi 0.85x, full 0.70x | `system_settings` table |
| Weekly release pcts | [35, 25, 25, 15] | `system_settings` table |
| QR expiry duration | 10 minutes | `system_settings` table |
| Geosearch radius | 50km | `system_settings` table |

Admin UI provides a form with sliders and number inputs to adjust these in real-time.

### 8.7 Audit Replay

Click any audit log entry to see a visual diff:
- Before/after side-by-side of the changed entity
- JSON diff highlighting
- Link to the admin who made the change
- One-click revert button (where safe)

---

## 9. Implementation Phases

### Phase 1: Foundation (Week 1-2)

**Goal**: Admin can log in and see data.

- [ ] Database migrations: `admin_users`, `audit_logs`, `system_settings`
- [ ] JWT auth middleware (`jwt_auth.go`, `rbac.go`)
- [ ] Admin user CRUD (seed super admin)
- [ ] Admin API scaffolding with route registration
- [ ] Admin frontend scaffolding (Vite + React + Tailwind + shadcn/ui)
- [ ] Login page
- [ ] Dashboard page with basic stats (read-only queries)
- [ ] Sidebar navigation

### Phase 2: Core CRUD (Week 3-4)

**Goal**: Full read/write on all existing entities.

- [ ] Households: list, detail, update, suspend/reactivate
- [ ] Members: list, detail, update, KYC verify
- [ ] Allocations: list, detail, adjust, expire
- [ ] Redemptions: list, detail, dispute resolution, reversal
- [ ] Distribution Centers: full CRUD, stock management
- [ ] Power Bank Swaps: list, detail, status override
- [ ] DataTable component with sorting/filtering/pagination
- [ ] Detail panel (slide-over) component
- [ ] Audit trail logging on every write operation

### Phase 3: Volunteers & Distributors (Week 5)

**Goal**: Persist and manage volunteer/distributor data.

- [ ] Database migrations: `volunteers`, `distributors`
- [ ] Backend CRUD + approval workflows
- [ ] Volunteer queue + review page
- [ ] Distributor queue + review page
- [ ] Update existing KYC flow to POST to backend (not just localStorage)

### Phase 4: Analytics & Polish (Week 6-7)

**Goal**: Dashboard charts, exports, advanced features.

- [ ] Dashboard charts (Recharts)
- [ ] Real-time stats (Redis-cached)
- [ ] CSV/Excel export endpoints
- [ ] Alerts system
- [ ] Command palette (Cmd+K)
- [ ] Responsive design pass
- [ ] Bulk operations page
- [ ] Map view for centers

### Phase 5: Advanced Features (Week 8+)

**Goal**: Smart features and optimizations.

- [ ] Allocation simulator
- [ ] Fraud detection indicators
- [ ] Configurable allocation engine (system_settings UI)
- [ ] Audit replay with visual diff
- [ ] Natural language search (optional)
- [ ] Live operations map with WebSocket

---

## 10. Tech Stack

### Backend (additions to existing Go service)

| Component | Choice | Reason |
|-----------|--------|--------|
| Auth | JWT (golang-jwt/jwt/v5) | Standard, stateless, works with SPA |
| Password hashing | bcrypt | Industry standard |
| RBAC | Custom middleware | Simple role check, no complex policy engine needed |
| Audit | Custom table + service | Full control over what's logged |
| Export | encoding/csv + excelize | CSV native, Excel via library |

### Frontend (new SPA)

| Component | Choice | Reason |
|-----------|--------|--------|
| Framework | React 19 + TypeScript | Same as existing app, shared knowledge |
| Build | Vite | Same as existing app |
| Styling | Tailwind CSS 4 | Same as existing app |
| Components | shadcn/ui | Unstyled primitives, full control, excellent DX |
| Tables | TanStack Table v8 | Best React table library, handles all requirements |
| Charts | Recharts | Simple, declarative, React-native |
| Forms | React Hook Form + Zod | Type-safe validation |
| State | Zustand | Same as existing app |
| HTTP | Ky | Same as existing app |
| Maps | React-Leaflet | Same as existing app |
| Date | date-fns + jalaali-js | Shamsi calendar support (same as existing) |
| i18n | react-i18next | Same as existing app, fa/en support |

### Infrastructure

| Component | Choice | Reason |
|-----------|--------|--------|
| Hosting | Same server as main app | Single deployment |
| Static files | Embedded in Go binary or nginx | Admin SPA served as static files |
| Sessions | Redis (existing) | Token blacklist + rate limiting |
| File storage | S3/Minio | KYC documents, exports (future) |

---

## 11. Conflict Audit: Current System vs. Admin Panel

A full audit of the existing codebase reveals **critical gaps and conflicts** that must be resolved before the admin panel can function. The current system was built exclusively for household users via Telegram. Admin operations require substantial changes.

### 11.1 Critical Conflicts (Must Fix Before Admin)

#### CONFLICT 1: Admin Staff Authentication — National Code + OTP

Admin staff use the **same KYC identity model** as regular users. Authentication is simply **national code + OTP** (sent via SMS). No passwords, no JWT, no extra complexity.

| Aspect | Regular Users | Admin Staff |
|--------|--------------|-------------|
| **Identity** | National code (from KYC) | National code (from KYC) |
| **Auth method** | Telegram initData | National code + SMS OTP |
| **Entry point** | Telegram Mini App | Admin panel web app |
| **Session** | Telegram session | Server-side session (Redis) |
| **Role** | Household user | Assigned admin level (1-10) |

**Auth flow**:
1. Admin enters national code
2. Backend verifies national code exists in `admin_users`
3. Backend sends OTP to admin's registered phone via SMS
4. Admin enters OTP
5. Backend validates OTP, creates session in Redis, returns session token
6. All subsequent requests carry session token

| File | What's Needed |
|------|---------------|
| `backend/internal/config/config.go` | Add SMS provider config + session TTL |
| `backend/cmd/server/main.go` | Mount admin routes under `/api/v1/admin/*` with session auth middleware |

**Resolution**: Add OTP + session middleware for admin routes. User routes under `/api/v1/coupon/*` stay on Telegram auth unchanged. Same identity model, no passwords to manage.

#### CONFLICT 2: Volunteer & Distributor Data — Frontend-Only (localStorage)

| Store | Data Stored | Backend Persistence |
|-------|-------------|:-------------------:|
| `useVolunteerStore.ts` | isVolunteer, specialty | NONE |
| `useDistributorStore.ts` | isDistributor, storeAddress, storeDescription, status | NONE |

**Impact**: Admin panel cannot see, approve, or reject volunteer/distributor applications because the data never reaches the server. User logout destroys all application data permanently.

**Resolution**: Create `volunteers` and `distributors` backend tables (already specified in doc Section 3.1). Add API endpoints for applications. Frontend submits to backend instead of only writing to localStorage.

#### CONFLICT 3: KYC Completion — Cached Locally, Not Reversible

| Store | Issue |
|-------|-------|
| `useKycStore.ts` | `completed: true` persisted in localStorage. No backend verification status. |
| `KycFlow.tsx` | Calls `registerHousehold()` (sends national_code + address), but birth_date, gender, full_name stay in localStorage only. |

**Impact**: If admin detects fraud and needs to force re-verification, the user's frontend still shows `completed: true`. Admin cannot reset KYC status from the backend because the backend doesn't track KYC completion status.

**Resolution**: Add `kyc_status` field to `households` table (pending/verified/rejected/expired). Frontend must check backend status on load, not just localStorage. Admin can set `kyc_status = 'rejected'` to force re-verification.

#### CONFLICT 4: Distribution Centers — Backend is READ-ONLY

| File | Operations Available |
|------|---------------------|
| `backend/internal/coupon/repository/distribution_repo.go` | `GetByID()`, `GetNearby()` — that's it |

**Impact**: Admin cannot create, update, delete, or change stock status of any distribution center. Centers are seeded via SQL migration only.

**Resolution**: Add `Create()`, `Update()`, `UpdateStatus()`, `UpdateStock()`, `Delete()` to `DistributionRepository`. Add corresponding service and handler methods.

#### CONFLICT 5: No Audit Trail Infrastructure

| What's Missing | Impact |
|---------------|--------|
| No `audit_logs` table | Cannot track who changed what |
| No `updated_by` column on any table | Cannot attribute changes to admins |
| No `suspension_reason` on households | Cannot explain why household was blocked |
| No `dispute_resolution` on redemptions | Cannot document how disputes were resolved |

**Resolution**: Migration to add `updated_by`, `admin_notes` columns to `households`, `coupon_redemptions`, `distribution_centers`. Create `audit_logs` table. All admin write operations log to audit trail.

### 11.2 High-Priority Gaps (Block Core Admin Functions)

#### GAP 1: Missing Repository CRUD Operations

| Repository | Has | Missing for Admin |
|-----------|-----|-------------------|
| `household_repo.go` | Create, Get, AddMember, UpdateKYCTier | **UpdateStatus**, UpdateAddress, Search, BulkUpdate, DeleteMember, UpdateMember, GetPaginated |
| `allocation_repo.go` | CreateBatch, Get, DeductBalance | **AdjustAmount**, GetAll, UpdateStatus, ReverseDeduction, GetByDateRange |
| `redemption_repo.go` | Create, Get, UpdateStatus | **GetByStatus**, GetByCenter, BulkUpdateStatus, CountByStatus, AddAdminNotes |
| `distribution_repo.go` | GetByID, GetNearby | **Create**, **Update**, **Delete**, UpdateStock, GetAll, GetByProvince |
| `powerbank_repo.go` | Create, Get, UpdateStatus, PickUp, Return | **AdminForceStatus**, GetByStatus, GetByCenter, BulkUpdate |

#### GAP 2: Missing Service Methods

| Service | Missing Methods |
|---------|----------------|
| `HouseholdService` | SuspendHousehold, ReactivateHousehold, UpdateAddress, RemoveMember, BulkUpdateStatus |
| `AllocationService` | OverrideAllocation, PauseAllocations, RecalculateFromConfig (config is hardcoded) |
| `RedemptionService` | ResolveDispute, ReverseRedemption, BulkReverse |
| `DistributionService` | CreateCenter, UpdateCenter, UpdateStock, DeactivateCenter |
| `PowerBankService` | AdminForceStatus, AdminCancel (with reason) |

#### GAP 3: Hardcoded Allocation Constants

All allocation formulas in `allocation_service.go` are hardcoded Go constants:

```
Lines 37-66:  baseAllocations map (per age group × category)
Lines 68-78:  specialFlagMultipliers (pregnant, chronic, etc.)
Lines 80-84:  locationSegmentMultipliers (Tehran/urban/rural)
Lines 86-90:  kycTierFactors (digital/semi/full)
Line 258:     WeeklyReleasePcts = [4]int{35, 25, 25, 15}
```

**Impact**: Admin cannot adjust allocation formulas without redeploying the Go binary. The admin doc specifies a `system_settings` table and a configurable allocation engine, but the current code reads from hardcoded maps.

**Resolution**: Move constants to `system_settings` table. `AllocationService` loads config from DB on startup and caches in Redis. Admin updates config via API, which invalidates cache.

### 11.3 Medium-Priority Gaps

| Gap | Current State | Admin Needs |
|-----|--------------|-------------|
| **No dispute resolution logic** | `DisputeRedemption()` only sets `status='disputed'` | Need `ResolveDispute()` that either reverses (credits back) or rejects dispute |
| **No redemption reversal** | `RedemptionStatusReversed` constant exists but no implementation | Need `ReverseRedemption()` that credits allocation back via DB transaction |
| **No member removal** | Members can be added but never deleted | Admin needs soft-delete with reallocation trigger |
| **Household fetch is single-user** | `GET /household` returns current user's data only | Admin needs `GET /admin/households?search=&page=` across all users |
| **Scanner uses mock data** | ~~`ScannerPage.tsx` uses `MOCK_QR_PAYLOADS`~~ **RESOLVED** — now uses real camera QR scanning via html5-qrcode + real API calls | Provider QR format management needed in admin |
| **No notification system** | No way to communicate with households | Admin needs to send messages (KYC rejected, application approved, etc.) |
| **Types are weak** | `status: string` instead of union types | Admin panel needs strict typing for all entity states |

### 11.4 Conflict Resolution Roadmap

This maps directly to the implementation phases in Section 9, but reorders based on conflict severity:

```
Week 1: Fix CONFLICT 1 (Auth) + CONFLICT 5 (Audit) + GAP 1 partial (repos)
         → JWT middleware, admin_users table, audit_logs table
         → Add UpdateStatus/UpdateAddress to household repo
         → Add Create/Update/Delete to distribution repo

Week 2: Fix CONFLICT 2 (Volunteer/Distributor persistence) + CONFLICT 3 (KYC)
         → volunteers/distributors tables + API endpoints
         → Add kyc_status to households, backend KYC check
         → Update frontend stores to sync from backend

Week 3: Fix CONFLICT 4 (Center CRUD) + GAP 2 (service methods)
         → Full center management service
         → Dispute resolution + reversal logic
         → Household suspend/reactivate

Week 4: Fix GAP 3 (Hardcoded allocations)
         → system_settings table
         → AllocationConfigService loads from DB
         → Admin UI to adjust parameters

Week 5+: Medium gaps + advanced features
         → Member management, bulk operations
         → Notification system, provider management
         → Type hardening, mock removal
```

### 11.5 Database Migration Plan

A single migration file to add all missing columns and tables:

```sql
-- 004_admin_panel_support.sql

-- 1. Admin users (with 10-level hierarchy)
CREATE TABLE admin_users ( ... );  -- See Section 5

-- 2. Audit logs
CREATE TABLE audit_logs ( ... );   -- See Section 3.1

-- 3. Volunteers (persist from frontend)
CREATE TABLE volunteers ( ... );   -- See Section 3.1

-- 4. Distributors (persist from frontend)
CREATE TABLE distributors ( ... ); -- See Section 3.1

-- 5. System settings (configurable allocation engine)
CREATE TABLE system_settings ( ... ); -- See Section 3.1

-- 6. Add admin tracking columns to existing tables
ALTER TABLE households
    ADD COLUMN updated_by BIGINT,
    ADD COLUMN suspension_reason VARCHAR(500),
    ADD COLUMN suspended_at TIMESTAMPTZ,
    ADD COLUMN admin_notes TEXT,
    ADD COLUMN kyc_status VARCHAR(20) NOT NULL DEFAULT 'pending';

ALTER TABLE coupon_redemptions
    ADD COLUMN dispute_reason VARCHAR(1000),
    ADD COLUMN dispute_resolved_by BIGINT,
    ADD COLUMN dispute_resolution VARCHAR(1000),
    ADD COLUMN admin_notes TEXT;

ALTER TABLE distribution_centers
    ADD COLUMN managed_by BIGINT,
    ADD COLUMN last_modified_by BIGINT,
    ADD COLUMN deactivated_at TIMESTAMPTZ;

ALTER TABLE coupon_allocations
    ADD COLUMN updated_by BIGINT,
    ADD COLUMN is_paused BOOLEAN DEFAULT FALSE,
    ADD COLUMN pause_reason VARCHAR(500);

ALTER TABLE power_bank_swaps
    ADD COLUMN admin_notes TEXT,
    ADD COLUMN forced_by BIGINT;
```

---

## Appendix: Current System Constants Reference

These are the verified values from `backend/internal/coupon/service/allocation_service.go`:

### Base Allocations Per Age Group (Monthly)

| Age Group | Water(L) | Food(kg) | Fuel | Hygiene | Medical | Energy |
|-----------|----------|----------|------|---------|---------|--------|
| Infant 0-6m | 30 | 8 | 0 | 10 | 5 | 0 |
| Infant 6-23m | 45 | 12 | 0 | 8 | 4 | 0 |
| Child 2-4 | 60 | 15 | 0 | 6 | 3 | 0 |
| Child 5-11 | 90 | 20 | 0 | 5 | 2 | 1 |
| Teen 12-17 | 120 | 25 | 0 | 5 | 2 | 1 |
| Adult 18-59 | 150 | 30 | 15 | 5 | 2 | 2 |
| Senior 60-64 | 120 | 25 | 15 | 6 | 4 | 2 |
| Elderly 65+ | 100 | 20 | 15 | 8 | 6 | 2 |

### Multipliers

| Factor | Values |
|--------|--------|
| **Location** | Tehran: 0.80x, Urban: 1.00x, Rural: 1.20x |
| **KYC Tier** | Digital: 1.00x, Semi-offline: 0.85x, Full-offline: 0.70x |
| **Pregnant** | Food: 1.25x, Medical: 1.50x |
| **Chronic** | Medical: 14.00x |
| **Sanitary** | Hygiene: 6.00x |
| **Disability** | Medical: 1.50x |
| **Newborn** | Food: 1.30x |

### Weekly Release Schedule

| Week 1 | Week 2 | Week 3 | Week 4 |
|--------|--------|--------|--------|
| 35% | 25% | 25% | 15% |

---

## 12. Production System Changes (April 2026)

> This section documents all changes made to the production codebase that affect the admin panel spec. These changes were implemented as part of a comprehensive security/quality audit and production deployment.

### 12.1 Deployment Infrastructure (NEW)

The system is now deployed on AWS EC2 with CI/CD:

| Component | Details |
|-----------|---------|
| **Server** | EC2 `35.171.47.212`, Amazon Linux 2023 |
| **Domain** | `viwoapp.com` / `www.viwoapp.com` (SSL via Let's Encrypt) |
| **Deployment** | Docker Compose (`docker-compose.prod.yml`) — PostgreSQL 16, Redis 7, Go backend, Nginx frontend |
| **CI/CD** | GitHub Actions (`.github/workflows/deploy.yml`) — auto-deploys on push to `main` |
| **Reverse Proxy** | Nginx — `/` → frontend (port 3000), `/api/` → backend (port 8080) |

**Admin panel deployment**: The admin SPA should be built as a separate Docker service (or embedded in the same Nginx container) and served under `/admin/` path. The admin API routes (`/api/v1/admin/*`) are mounted in the same Go binary.

### 12.2 Security Changes Affecting Admin Panel

#### Finnotech KYC Errors Now Have Proper HTTP Status Codes

All KYC errors were changed from `fmt.Errorf` (which returned HTTP 500 for everything) to `ClassifiedError` structs with proper HTTP status codes:

| Error | HTTP Status | Error Code |
|-------|:-----------:|------------|
| OTP rate limit exceeded | 429 | `OTP_RATE_LIMIT` |
| OTP session expired | 410 | `OTP_EXPIRED` |
| Invalid OTP code | 422 | `OTP_INVALID` |
| Max OTP attempts reached | 429 | `OTP_MAX_ATTEMPTS` |
| Shahkar mismatch | 422 | `SHAHKAR_MISMATCH` |
| NID verification failed | 422 | `NID_VERIFICATION_FAILED` |
| Service unavailable | 503 | `SERVICE_UNAVAILABLE` |
| Session mismatch | 403 | `SESSION_MISMATCH` |
| KYC not configured | 503 | `KYC_NOT_CONFIGURED` |

**Admin panel impact**: The KYC Review page should display these error codes and their meanings. The admin should be able to see why a user's KYC failed (shahkar mismatch vs NID failure vs rate limited).

#### KYC Sessions Bound to Telegram User ID

`VerifyOTP` and `VerifyIdentity` now validate that `session.TelegramUserID == callerTelegramUserID`. This prevents session hijacking where one user could verify another user's OTP.

**Admin panel impact**: KYC Review page should show the linked Telegram user ID for each verification attempt.

#### Identity Verification Enforced Before Registration

The frontend KYC flow now calls `verifyIdentity` (Shahkar + NID) before `registerHousehold`. The `handleEnterApp` sets `identityVerified: true`.

**Admin panel impact**: The household detail view should show `identity_verified` status. Admin should be able to manually override this for offline-verified users.

#### Atomic OTP Rate Limiting

OTP rate limiting now uses Redis `TxPipeline` (INCR + EXPIRE in single round-trip) instead of separate GET + INCR. Prevents race condition that could bypass rate limits.

**Admin panel impact**: Rate limit settings should be exposed in System Settings page:

| Setting | Current Value | Configurable |
|---------|:------------:|:------------:|
| OTP max sends per mobile | 3 per 5 min | `system_settings` |
| OTP max verify attempts | 3 | `system_settings` |
| OTP session TTL | 5 min | `system_settings` |
| QR generation rate limit | 3/sec burst 5 | `system_settings` |
| Redeem rate limit | 1/sec burst 3 | `system_settings` |
| Notices rate limit | 5/sec burst 10 | `system_settings` |

#### Redis Session Write Errors Now Checked

All `redis.Set` calls in KYC service now check `.Err()` and return `ErrServiceUnavailable` on failure. Previously, Redis write failures were silently ignored, leading to orphaned sessions.

#### Household Ownership Verified on Redeem

`HandleRedeemCoupon` now calls `requireHousehold` and verifies `qr.HouseholdID == household.ID`. Prevents cross-household QR redemption.

**Admin panel impact**: Fraud Detection dashboard should flag any redeem attempts where household ID mismatched (these now return 403 instead of silently succeeding).

#### Bot Token Validation

- Config rejects empty `TELEGRAM_BOT_TOKEN` in production (`config.go`)
- Auth middleware rejects all requests when bot token is empty (`telegram_auth.go`)
- HMAC comparison now uses raw bytes instead of hex strings (timing-safe)

#### Telegram Auth — No Dev Bypass

The `TelegramAuth` middleware no longer accepts a development environment parameter. All requests must have valid Telegram `initData` signed with the bot token. No fallback to hardcoded user IDs.

**Admin panel impact**: Admin panel uses its own JWT/session auth — completely separate from Telegram auth. No conflict.

### 12.3 New System Components

#### Notices System (Redis-backed)

A new notice banner system was added for crisis communications:

| Component | Details |
|-----------|---------|
| **Backend endpoint** | `GET /api/v1/coupon/notices` — public, rate-limited (5/sec), no auth |
| **Storage** | Redis key `app:notices` — JSON array of notice objects |
| **Frontend** | `NoticeBanner.tsx` — auto-rotating carousel with swipe support |
| **Notice schema** | `{ id, text, text_fa, type: "info"|"warning"|"promo", link? }` |

**Admin panel requirement**: Dedicated **Notices Management** page where admins can:
- Create, edit, delete notices with bilingual text (English + Farsi)
- Set notice type (info/warning/promo) — affects banner color
- Reorder notices (drag-and-drop)
- Preview how the notice looks in the Mini App
- Set active/inactive status
- Backend writes the JSON array to Redis `app:notices` on every change

#### Frontend Error Extraction Utility

A shared `extractErrorMessage()` utility (`frontend/src/lib/api-error.ts`) now reads the backend's structured `{ error: { code, message } }` response body from `ky` HTTPErrors. The admin panel should use the same utility.

#### QR Display Page Route

The `/qr` route (`QRDisplayPage`) is now registered and accessible from the Category Detail page via a "Generate QR" button. The flow is: Category → Generate QR (API call) → Show QR code with countdown timer.

**Admin panel impact**: Redemption monitoring should show the generate→redeem two-step flow, including QR nonce, expiry time, and whether the QR was redeemed or expired.

### 12.4 Updated Conflict Status

| Conflict from Section 11 | Status | Notes |
|--------------------------|--------|-------|
| CONFLICT 1: Admin Auth | **UNCHANGED** — Still needs implementation | OTP + session auth for admin routes |
| CONFLICT 2: Volunteer/Distributor localStorage | **UNCHANGED** — Still frontend-only | Backend tables needed |
| CONFLICT 3: KYC not reversible | **PARTIALLY RESOLVED** — `verifyIdentity` now enforced | Still need `kyc_status` column on households |
| CONFLICT 4: Centers READ-ONLY | **UNCHANGED** — Still needs CRUD | Backend repo methods needed |
| CONFLICT 5: No audit trail | **UNCHANGED** — Still needs implementation | Tables + middleware needed |
| GAP: Scanner mock data | **RESOLVED** — Real camera QR scanning + real API calls | ✅ |
| GAP: Missing repo CRUD | **UNCHANGED** — Still needs admin-specific queries | Backend repo methods needed |
| GAP: Hardcoded allocations | **UNCHANGED** — Constants still in Go code | Need `system_settings` table |

### 12.5 New Admin Panel Pages (additions to Section 6)

#### Notices Management Page

```
+--Notices Management--------------------------------------+
|  [+ Add Notice]                                          |
|                                                          |
|  Draggable list:                                         |
|  ┌─ Notice #1 ─────────────────────────────────────────┐|
|  │ [≡] [info ▾] English text here                       │|
|  │              متن فارسی اینجا                          │|
|  │     [Link: https://...]  [Active ✓]  [Edit] [Delete] │|
|  └──────────────────────────────────────────────────────┘|
|  ┌─ Notice #2 ─────────────────────────────────────────┐|
|  │ [≡] [warning ▾] Another notice                       │|
|  │              ...                                     │|
|  └──────────────────────────────────────────────────────┘|
|                                                          |
|  Preview:                                                |
|  ┌─ Mobile Preview ────────────────────────────────────┐|
|  │  [●] Current notice text rotating...    ● ○ ○       │|
|  └──────────────────────────────────────────────────────┘|
+-----------------------------------------------------------+
```

#### Rate Limits & Telegram Settings Page (addition to Settings)

```
+--System Settings: Rate Limits----------------------------+
|                                                          |
|  API Rate Limits (per user):                             |
|  QR Generation:    [3] req/sec   Burst: [5]              |
|  Redemption:       [1] req/sec   Burst: [3]              |
|  KYC OTP Send:     [3] req/sec   Burst: [3]              |
|  Write Operations: [5] req/sec   Burst: [5]              |
|  Notices (public): [5] req/sec   Burst: [10]             |
|                                                          |
|  OTP Settings:                                           |
|  Max sends per mobile:  [3] per [5] minutes              |
|  Max verify attempts:   [3]                              |
|  Session TTL:           [5] minutes                      |
|                                                          |
|  Telegram Bot:                                           |
|  Bot Username: @ViWoMiniBot                              |
|  Bot ID: 8693627825                                      |
|  Status: ● Connected                                     |
|                                                          |
|  [Save Changes]                                          |
+-----------------------------------------------------------+
```

### 12.6 Updated Implementation Phases

The original phases (Section 9) remain valid. Add these items to the existing phases:

**Phase 1 additions:**
- [ ] Add `NoticesPage.tsx` to admin frontend
- [ ] Admin API endpoints for notices CRUD (write to Redis `app:notices`)
- [ ] Rate limits settings page (read/write `system_settings`)
- [ ] Telegram bot status display in Settings

**Phase 2 additions:**
- [ ] KYC Review page should display `ClassifiedError` codes and meanings
- [ ] Household detail should show `identity_verified` flag
- [ ] Redemption detail should show QR nonce, generate/redeem timestamps, household ownership check result

**Phase 3 additions:**
- [ ] Volunteer/Distributor backend persistence (tables exist in spec, not yet migrated)
- [ ] Update KYC flow to POST volunteer/distributor data to backend instead of localStorage

**Phase 4 additions:**
- [ ] Fraud Detection should flag household ownership mismatch attempts (403 on redeem)
- [ ] Alert for `KYC_NOT_CONFIGURED` errors (Finnotech integration down)
