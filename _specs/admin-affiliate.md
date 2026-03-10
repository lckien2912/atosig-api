# Admin Affiliate Management Specification

## Overview

The `AdminAffiliateModule` provides admin-only endpoints for managing affiliate users. Admins can list all affiliates with computed financial metrics, view detailed profiles, change affiliate statuses (ACTIVE/SUSPENDED/INACTIVE), and review status change audit logs.

For withdrawal request management (approve/reject/hold/revert/bulk-action), see [admin-commission.md](./admin-commission.md).
For the affiliate dashboard (KPIs, charts), see [affiliate-dashboard.md](./affiliate-dashboard.md).

---

## Architecture

```
NestJS App
└── AdminAffiliateModule
    ├── AdminAffiliateController  (/api/v1/admin/affiliates)
    │   └── @AdminOnly() — JwtAuthGuard + RolesGuard + ApiBearerAuth
    ├── AdminAffiliateService     (business logic)
    └── DTOs

Shared Entities (from other modules)
├── User                         — affiliate user profile + ref_code
├── AffiliateWithdrawalRequest   — withdrawal requests (for metrics)
└── CommissionAuditLog           — audit trail for status changes

PostgreSQL
├── users
│   ├── ref_code         — affiliate identifier
│   ├── affiliate_status — ACTIVE | SUSPENDED | INACTIVE
│   └── affiliate_tier   — INDIVIDUAL | CORP
├── affiliate_commissions
├── affiliate_withdrawal_requests
└── commission_audit_logs
```

---

## Affiliate Status Lifecycle

```
    ┌────────┐
    │ ACTIVE │◄──────────────┐
    └───┬────┘               │
        │                    │
   ┌────▼─────┐     ┌───────┴──┐
   │SUSPENDED │     │ INACTIVE │
   └────┬─────┘     └──────────┘
        │                ▲
        └────────────────┘
```

All transitions between ACTIVE, SUSPENDED, and INACTIVE are allowed (any → any), except transitioning to the current status (returns `400 Bad Request`).

### `AffiliateStatus` enum

| Value       | Meaning                          |
| ----------- | -------------------------------- |
| `ACTIVE`    | Affiliate is active and earning  |
| `SUSPENDED` | Temporarily blocked by admin     |
| `INACTIVE`  | Deactivated                      |

### `AffiliateTier` enum

| Value        | Meaning                 |
| ------------ | ----------------------- |
| `INDIVIDUAL` | Individual affiliate    |
| `CORP`       | Corporate affiliate     |

---

## HTTP Endpoints

| Method | Path | Handler | Description |
|--------|------|---------|-------------|
| GET | `/admin/affiliates` | `list()` | Paginated list with computed financial metrics |
| GET | `/admin/affiliates/:uid` | `getDetail()` | Affiliate detail with metrics, recent withdrawal requests, and status logs |
| PATCH | `/admin/affiliates/:uid/status` | `changeStatus()` | Change affiliate status (ACTIVE/SUSPENDED/INACTIVE) |
| GET | `/admin/affiliates/:uid/status-logs` | `getStatusLogs()` | Full status change audit trail |

All endpoints require `@AdminOnly()` (JWT + admin role). The `:uid` param is the affiliate's `ref_code`.

---

## DTOs

### ListAffiliatesQueryDto

| Field | Type | Validation | Default |
|-------|------|------------|---------|
| `status` | AffiliateStatus \| 'ALL' | IsOptional, IsString | — |
| `search` | string | IsOptional, IsString | — |
| `tier` | AffiliateTier | IsOptional, IsEnum | — |
| `page` | number | IsOptional, IsInt, Min(1) | `1` |
| `size` | number | IsOptional, IsInt, Min(1) | `20` |

Search matches against `email`, `phone_number`, and `ref_code` (case-insensitive ILIKE).

### ChangeStatusDto

| Field | Type | Validation |
|-------|------|------------|
| `status` | AffiliateStatus | IsEnum |
| `reason` | string | IsString, IsNotEmpty |

---

## Computed Metrics

Both `list()` and `getDetail()` return the following metrics per affiliate, computed via correlated subqueries on each request:

| Metric | Source | Computation |
|--------|--------|-------------|
| `totalInvitees` | `users` | COUNT where `ref_from = ref_code` |
| `totalCommissionEarned` | `affiliate_commissions` | SUM(amount) for the affiliate |
| `totalPaid` | `affiliate_withdrawal_requests` | SUM(total_amount) where status = PAID |
| `pendingPayment` | `affiliate_withdrawal_requests` | SUM(total_amount) where status = ACCEPTED |
| `availableToWithdraw` | `affiliate_commissions` | SUM(amount) where status = AVAILABLE |

All numeric metrics are cast from string to `Number` before response.

---

## Detail Endpoint Response

`GET /admin/affiliates/:uid` returns:

```json
{
    "id": "uuid",
    "fullName": "string",
    "email": "string",
    "phoneNumber": "string",
    "refCode": "string",
    "affiliateStatus": "ACTIVE",
    "affiliateTier": "INDIVIDUAL",
    "createdAt": "timestamp",
    "totalInvitees": 0,
    "totalCommissionEarned": 0,
    "totalPaid": 0,
    "pendingPayment": 0,
    "availableToWithdraw": 0,
    "recentRequests": [],
    "statusLogs": []
}
```

- `recentRequests` — 10 most recent `AffiliateWithdrawalRequest` records for this affiliate
- `statusLogs` — 10 most recent `CommissionAuditLog` entries with action = `STATUS_CHANGE`, including the admin's email

---

## Audit Logging

Every status change creates a `CommissionAuditLog` entry with:
- `action` — `STATUS_CHANGE`
- `affiliate_uid` — the affiliate's ref_code
- `performed_by` — admin user ID
- `note` — the reason provided by the admin
- `created_at` — timestamp

The `getStatusLogs()` endpoint returns all status change logs for an affiliate (no limit), while the detail endpoint returns only the 10 most recent.

---

## Business Rules Summary

| Rule | Enforcement |
|------|-------------|
| Only admins can access these endpoints | `@AdminOnly()` decorator (JwtAuthGuard + RolesGuard) |
| Affiliate identified by `ref_code`, not user ID | All queries filter by `ref_code` |
| Cannot set status to the current status | `400 Bad Request` if `affiliate_status === newStatus` |
| Affiliate must exist | `404 Not Found` if `ref_code` not found |
| All status changes are audit-logged | `CommissionAuditLog` entry with `STATUS_CHANGE` action |
| List search is case-insensitive | ILIKE on email, phone_number, ref_code |
| Status filter supports 'ALL' value | When status is 'ALL' or absent, no status filter applied |
| Tier filter is optional | Only applied when provided |
| Metrics are computed live per request | Correlated subqueries, no materialized/cached values |
