# Affiliate Dashboard Specification

## Overview

The `AffiliateDashboardModule` provides admin-only endpoints for affiliate program analytics. It exposes two endpoints: KPIs (aggregate metrics) and charts (time-series and distribution data). All queries are date-range filtered and use raw SQL against PostgreSQL.

For affiliate user management, see [admin-affiliate.md](./admin-affiliate.md).
For withdrawal request management, see [admin-commission.md](./admin-commission.md).

---

## Architecture

```
NestJS App
└── AffiliateDashboardModule
    ├── AffiliateDashboardController  (/api/v1/admin/dashboard/affiliate)
    │   └── @AdminOnly() — JwtAuthGuard + RolesGuard + ApiBearerAuth
    ├── AffiliateDashboardService     (business logic, raw SQL)
    └── DTOs / Enums
        ├── DashboardQueryDto
        └── Granularity enum (DAY | WEEK | MONTH)

PostgreSQL (read-only queries)
├── users                          — affiliate counts
├── affiliate_withdrawal_requests  — commission sums, request counts
├── user_subscriptions             — package distribution
└── pricings                       — plan names
```

---

## HTTP Endpoints

| Method | Path | Handler | Description |
|--------|------|---------|-------------|
| GET | `/admin/dashboard/affiliate/kpis` | `getKPIs()` | Aggregate KPI metrics for the date range |
| GET | `/admin/dashboard/affiliate/charts` | `getCharts()` | Time-series and distribution chart data |

All endpoints require `@AdminOnly()` (JWT + admin role).

---

## DTOs

### DashboardQueryDto

| Field | Type | Validation | Default |
|-------|------|------------|---------|
| `fromDate` | string | IsDateString | — (required) |
| `toDate` | string | IsDateString | — (required) |
| `granularity` | Granularity | IsOptional, IsEnum | `DAY` |

### Granularity enum

| Value   | SQL function        |
| ------- | ------------------- |
| `day`   | `date_trunc('day')` |
| `week`  | `date_trunc('week')`|
| `month` | `date_trunc('month')`|

---

## KPI Metrics

`GET /admin/dashboard/affiliate/kpis` returns 6 aggregate metrics computed via 4 SQL queries:

| Metric | Source Table | Filter | Computation |
|--------|-------------|--------|-------------|
| `totalActiveAffiliates` | `users` | `affiliate_status = ACTIVE AND ref_code IS NOT NULL` | COUNT (no date filter) |
| `totalInvitees` | `users` | `ref_from IS NOT NULL AND created_at` in range | COUNT |
| `totalCommissionPaid` | `affiliate_withdrawal_requests` | `status = PAID AND processed_at` in range | SUM(total_amount) |
| `totalCommissionAccepted` | `affiliate_withdrawal_requests` | `status = ACCEPTED AND created_at` in range | SUM(total_amount) via CASE WHEN |
| `totalCommissionPending` | `affiliate_withdrawal_requests` | `status = PENDING AND created_at` in range | SUM(total_amount) via CASE WHEN |
| `totalRequests` | `affiliate_withdrawal_requests` | `created_at` in range | COUNT via CASE WHEN |

The ACCEPTED, PENDING, and total count metrics are consolidated into a single query using `CASE WHEN` expressions.

---

## Chart Data

`GET /admin/dashboard/affiliate/charts` returns three datasets:

### commissionOverTime

Time-series bucketed by `granularity` (day/week/month):

| Field | Description |
|-------|-------------|
| `date` | Truncated timestamp bucket |
| `total` | SUM of total_amount for ACCEPTED + PAID requests |
| `paid` | SUM of total_amount for PAID requests only |

Filtered by `processed_at` in date range. Only includes ACCEPTED and PAID statuses.

### top10Affiliates

Top 10 affiliates by total commission:

| Field | Description |
|-------|-------------|
| `affiliateUid` | Affiliate's ref_code |
| `email` | Affiliate's email (joined from users) |
| `totalCommission` | SUM of total_amount for ACCEPTED + PAID requests |

Filtered by `created_at` in date range. Ordered DESC by totalCommission, limited to 10.

### packageDistribution

Active subscription distribution by plan:

| Field | Description |
|-------|-------------|
| `package` | Pricing plan name |
| `count` | Number of active subscriptions |

Filtered by `user_subscriptions.status = ACTIVE` and `created_at` in date range.

---

## Business Rules Summary

| Rule | Enforcement |
|------|-------------|
| Only admins can access these endpoints | `@AdminOnly()` decorator (JwtAuthGuard + RolesGuard) |
| Date range is required | `@IsDateString()` validation on `fromDate` and `toDate` |
| Granularity defaults to DAY | DTO default value |
| `totalActiveAffiliates` is not date-filtered | Reflects current state regardless of date range |
| PAID commission uses `processed_at` for date filtering | Reflects when payment was actually processed |
| ACCEPTED/PENDING commissions use `created_at` for date filtering | Reflects when request was submitted |
| Numeric values cast from PostgreSQL | `::numeric` cast + `Number()` in service layer |
