# Admin Commission Management Specification

## Overview

The `AdminCommissionModule` provides admin-only endpoints for managing affiliate withdrawal requests. It extends the basic admin routes in `AffiliateController` with a dedicated controller offering expanded capabilities: listing, detail view, approve/reject/hold/release-hold/revert/bulk-action, and full audit logging.

For affiliate **user** management (status changes, affiliate metrics), see [admin-affiliate.md](./admin-affiliate.md).

---

## Architecture

```
NestJS App
└── AdminCommissionModule
    ├── AdminCommissionController  (/api/v1/admin/commissions)
    │   └── @AdminOnly() — JwtAuthGuard + RolesGuard + ApiBearerAuth
    ├── AdminCommissionService     (business logic)
    └── DTOs / Enums

Shared Entities (from AffiliateModule)
├── AffiliateWithdrawalRequest  — withdrawal request lifecycle
├── AffiliateCommission         — individual commission entries
└── CommissionAuditLog          — audit trail for admin actions

PostgreSQL
├── affiliate_withdrawal_requests
│   └── + payment_id (uuid nullable), hold_until (timestamp nullable)
├── affiliate_commissions
└── commission_audit_logs (new)
    └── id, request_id (FK), affiliate_uid, action, performed_by, note, created_at
```

---

## Withdrawal Request Lifecycle

```
                    ┌──────────┐
                    │ PENDING  │
                    └────┬─────┘
                   ╱     │      ╲
                  ╱      │       ╲
           ┌─────▼──┐ ┌─▼──────┐ ┌▼────────┐
           │ACCEPTED│ │REJECTED│ │  HOLD    │
           └───┬────┘ └───┬────┘ └────┬─────┘
               │          │           │
          ┌────▼───┐  ┌───▼────┐  ┌───▼─────┐
          │  PAID  │  │REVERTED│  │ PENDING  │
          │(final) │  │(final) │  │(release) │
          └────────┘  └────────┘  └─────────┘
               │
          ┌────▼────┐
          │REVERTED │
          │(final)  │
          └─────────┘
```

### State transitions

| From | To | Action | Conditions |
|------|----|--------|------------|
| PENDING | ACCEPTED | approve | — |
| PENDING | REJECTED | reject | Commissions reverted to AVAILABLE |
| PENDING | HOLD | hold | Optional `hold_until` date |
| HOLD | PENDING | release-hold | Clears `hold_until` |
| ACCEPTED | PAID | mark-paid | External payment confirmation |
| ACCEPTED | REVERTED | revert | Before PAID only; commissions reverted to AVAILABLE |
| REJECTED | REVERTED | revert | Commissions reverted to AVAILABLE |

Terminal states: **PAID**, **REVERTED**

---

## HTTP Endpoints

| Method | Path | Handler | Description |
|--------|------|---------|-------------|
| GET | `/admin/commissions` | `list()` | Paginated list with status/date/search filters |
| GET | `/admin/commissions/:id` | `getDetail()` | Single request with commissions + audit trail |
| PATCH | `/admin/commissions/:id/approve` | `approve()` | PENDING → ACCEPTED |
| PATCH | `/admin/commissions/:id/reject` | `reject()` | PENDING → REJECTED |
| PATCH | `/admin/commissions/:id/hold` | `hold()` | PENDING → HOLD |
| PATCH | `/admin/commissions/:id/release-hold` | `releaseHold()` | HOLD → PENDING |
| PATCH | `/admin/commissions/:id/revert` | `revert()` | ACCEPTED/REJECTED → REVERTED |
| POST | `/admin/commissions/bulk-action` | `bulkAction()` | Batch approve/reject/hold |

All endpoints require `@AdminOnly()` (JWT + admin role).

---

## DTOs

### ListWithdrawalRequestsQueryDto

| Field | Type | Validation | Default |
|-------|------|------------|---------|
| `status` | WithdrawalRequestFilterStatus | IsOptional, IsEnum | `ALL` |
| `affiliateUid` | string | IsOptional, IsString | — |
| `search` | string | IsOptional, IsString | — |
| `fromDate` | string | IsOptional, IsDateString | — |
| `toDate` | string | IsOptional, IsDateString | — |
| `page` | number | IsOptional, IsNumber, Min(1) | `1` |
| `size` | number | IsOptional, IsNumber, Min(5), Max(100) | `20` |

### ProcessWithdrawalRequestDto

| Field | Type | Validation |
|-------|------|------------|
| `adminNote` | string | IsOptional, IsString |
| `holdUntil` | string | IsOptional, IsDateString |

### BulkActionDto

| Field | Type | Validation |
|-------|------|------------|
| `ids` | string[] | IsArray, ArrayMinSize(1), ArrayMaxSize(100), IsUUID each |
| `action` | BulkActionType | IsEnum (APPROVE, REJECT, HOLD) |
| `reason` | string | IsString, IsNotEmpty |

---

## Audit Logging

Every admin action creates a `CommissionAuditLog` entry with:
- `request_id` — FK to the withdrawal request
- `affiliate_uid` — the affiliate's ref_code
- `action` — one of: `APPROVE`, `REJECT`, `HOLD`, `RELEASE`, `REVERT`, `AUTO_APPROVE`, `MARK_PAID`
- `performed_by` — admin user ID
- `note` — optional admin note
- `created_at` — timestamp

The audit trail is included in the detail endpoint response.

---

## Bulk Operations

The `POST /admin/commissions/bulk-action` endpoint processes multiple withdrawal requests:

- Accepts up to 100 request IDs per call
- Supported actions: `APPROVE`, `REJECT`, `HOLD`
- Each request is processed independently
- Returns success/failure counts with per-item error details
- A shared `reason` is applied as `admin_note` to all processed requests
- Each successful action creates an individual audit log entry

---

## Business Rules Summary

| Rule | Enforcement |
|------|-------------|
| Only admins can access these endpoints | `@AdminOnly()` decorator (JwtAuthGuard + RolesGuard) |
| State transitions are forward-only | Service validates current status before transition |
| PAID and REVERTED are terminal states | No transitions allowed from these states |
| Revert allowed on ACCEPTED (before PAID) | Service checks status is ACCEPTED, not PAID |
| Revert allowed on REJECTED | Service checks status is REJECTED |
| Reject reverts commissions to AVAILABLE | Commission status updated in same transaction |
| Revert reverts commissions to AVAILABLE | Commission status updated in same transaction |
| Hold can set optional expiry date | `hold_until` column on withdrawal request |
| Release-hold clears expiry and returns to PENDING | `hold_until` set to null |
| All actions are audit-logged | CommissionAuditLog entry created for every action |
| Bulk operations are capped at 100 items | DTO validation with ArrayMaxSize(100) |
