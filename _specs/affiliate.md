# Affiliate Feature Specification

## Overview

The affiliate module implements a referral-based commission system. Users receive a unique `ref_code` at registration. When they share this code and others sign up and purchase subscriptions, the referrer earns commissions. Commission calculations and the affiliate tree are managed by an external microservice; this module acts as a client adapter, enriches responses with local user data, and owns the full commission withdrawal lifecycle locally in PostgreSQL.

---

## Architecture

```
NestJS App
└── AffiliateModule
    ├── AffiliateController  (/api/v1/affiliate)
    ├── AffiliateService     (business logic + HTTP client)
    └── DTOs / Enums

External Affiliate Microservice
└── REST API at AFFILIATE_SERVICE_URL
    ├── Users (affiliate tree)
    └── Orders (commission triggers)

PostgreSQL (local)
├── users
│   ├── ref_code  — user's unique referral code (affiliate ID)
│   └── ref_from  — referrer's ref_code at signup time
└── affiliate_withdrawals
    └── one row per commission entry; tracks AVAILABLE → REQUESTED → ACCEPTED/REJECTED lifecycle
```

All commission computation and tree management live in the external microservice. The NestJS module:

1. Syncs user creation events to the external service.
2. Forwards order events after successful payments and creates a local commission entry for the referrer.
3. Proxies read queries (overview, invitees, commissions) and enriches them with emails from the local DB.
4. Enforces access-control rules (e.g., rate changes only for direct invitees).
5. Manages commission withdrawal requests locally (request → admin approve/reject).

---

## Commission Logic

### Earning commissions

1. A new user registers via a referral link containing `?ref=<ref_code>`.
2. `ref_from` is stored on the new user; `createAffiliateUser()` registers both in the external service.
3. When the referred user subscribes and pays:
    - The payment service calls `createOrder()` with transaction details.
    - The external service calculates multi-level commissions (up to level 3) and returns them in the response's `commissions[]` array.
    - The NestJS service creates local `affiliate_withdrawals` entries for **all ancestor levels** using the external service response:
        - Reads `commissions[]` from the external service's `POST /api/v1/orders` response.
        - For each commission entry: inserts a row with `affiliate_uid`, `amount` (from external service), `level`, `status = AVAILABLE`, and `source_order_id = orderId`.
        - Skips if `amount <= 0` or if a row for `(source_order_id, affiliate_uid)` already exists (idempotent).
        - No local re-calculation — the external service handles precision with BigDecimal FLOOR.

### Requesting withdrawal

1. User calls `POST /withdrawals/request`.
2. All `AVAILABLE` rows for that user transition to `REQUESTED` in one update.
3. The response returns the count and total amount of rows moved.

### Admin processing

1. Admin reviews `GET /admin/withdrawals?status=REQUESTED`.
2. Admin calls `PATCH /admin/withdrawals/:id` with `{ status: "ACCEPTED" }` or `{ status: "REJECTED" }`.
3. On `ACCEPTED`: row is finalised; `totalWithdrawn` on the overview increases.
4. On `REJECTED`: row reverts to `AVAILABLE`; user may request again.

### Commission rates

- **Default:** Value of `AFFILIATE_DEFAULT_PERCENT` (currently 10%).
- **Override:** A referrer may call `POST /update-rate` to set a custom rate for any direct invitee (0–100%).
- Rate changes apply to future orders only (external service behaviour).

### Tree depth

The external service tracks multi-level commissions (up to level 3). Local `affiliate_withdrawals` rows are created for **all ancestor levels** that earn a commission, using the `commissions[]` array returned by the external service's order endpoint. Each row includes a `level` column indicating the ancestor's position in the referral tree (1 = direct referrer, 2 = referrer's referrer, etc.).

---

## External Service API

All requests include header `X-API-KEY: <AFFILIATE_API_KEY>`.

| Method | Path                             | Called by               | Description                          |
| ------ | -------------------------------- | ----------------------- | ------------------------------------ |
| POST   | `/api/v1/users`                  | `createAffiliateUser()` | Register user in affiliate tree      |
| POST   | `/api/v1/orders`                 | `createOrder()`         | Record purchase, trigger commissions |
| GET    | `/api/v1/users/overview/:uid`    | `getUserOverview()`     | Fetch user stats + commission rate   |
| GET    | `/api/v1/users/invitees/:uid`    | `getUserInvitees()`     | List direct children                 |
| GET    | `/api/v1/users/commissions/:uid` | `getUserCommissions()`  | List commission records              |
| POST   | `/api/v1/users/update-rate`      | `updateRate()`          | Change invitee commission rate       |

---

## Business Rules Summary

| Rule                                                        | Enforcement                                                        |
| ----------------------------------------------------------- | ------------------------------------------------------------------ |
| Every registered user gets a unique `ref_code`              | User entity, unique DB constraint                                  |
| `createAffiliateUser()` failure does not break registration | Async call after transaction commit                                |
| `createOrder()` only fires when `user.ref_code` is set      | Guard in payment service                                           |
| Commission rate updates restricted to direct invitees       | `updateRate()` validates `overview.refUid === sourceUid`           |
| Rate must be 0–100%                                         | DTO `@Min(0) @Max(100)` validation                                 |
| Pagination default date range                               | Jan 1, 2026 — today+1 day (applied if `fromDate`/`toDate` omitted) |
| Invitee list shows direct children only                     | Query parameter passed to external service                         |
| Invitee emails enriched locally                             | Batch lookup against `users.ref_code`                              |
| Commission entries created for all ancestor levels per order | `createOrder()` reads `commissions[]` from external API response   |
| Duplicate commission per (order, uid) prevented             | Composite unique index on `(source_order_id, affiliate_uid)`; existence check before insert |
| Zero-amount commissions not recorded                        | `if (commissionAmount > 0)` guard                                  |
| Withdrawal request moves ALL AVAILABLE entries              | Single `UPDATE WHERE status = AVAILABLE` per user                  |
| Cannot request withdrawal with no AVAILABLE entries         | `400 Bad Request` from `requestWithdrawal()`                       |
| Only REQUESTED entries can be processed by admin            | `400 Bad Request` if status ≠ REQUESTED in `processWithdrawal()`   |
| REJECTED entries revert to AVAILABLE (user can re-request)  | Status set to `AVAILABLE` on REJECTED                              |
| Admin-only routes protected by role                         | `RolesGuard` checks `user.role === ADMIN`                          |
| `availableToWithdraw` reflects only AVAILABLE entries       | Aggregate query excludes REQUESTED/ACCEPTED/REJECTED               |
| `totalWithdrawn` reflects only ACCEPTED entries             | Aggregate query in `getUserOverview()`                             |

---

## Q&A

### Q: Can we compute available commission as `totalCommission - claimedCommission`?

**Short answer:** Not safely — there are edge cases that make subtraction unreliable.

**Edge cases:**

1. **REQUESTED status (biggest risk):** When a user requests withdrawal, entries move `AVAILABLE → REQUESTED`. These are neither claimed (ACCEPTED) nor available. Subtraction would count them as "available", inflating what the user thinks they can withdraw.

2. **Data source mismatch:** `totalCommissions` comes from the external affiliate service, while claimed/withdrawn amounts come from the local `affiliate_withdrawals` table. If these drift out of sync (e.g., external service records a commission but local entry creation fails), the subtraction produces incorrect results.

3. **PENDING status (future use):** The enum defines `PENDING` for commissions on hold (e.g., refund window). If used later, those amounts would incorrectly appear as "available" via subtraction.

4. **REJECTED re-cycling:** When admin rejects a withdrawal, status reverts to `AVAILABLE` (not kept as REJECTED). Subtraction handles this correctly since it was never ACCEPTED, but the status flow is worth noting.

**Recommendation:** Query each bucket directly from the `affiliate_withdrawals` table instead of using subtraction. The current implementation already does this:
- `availableToWithdraw` = SUM where status = `AVAILABLE`
- `totalWithdrawn` = SUM where status = `ACCEPTED`

Adding a `claimedCommission` field follows the same pattern and avoids all edge cases above.
