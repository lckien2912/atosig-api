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
├── affiliate_withdrawals
│   └── one row per commission entry; tracks AVAILABLE → WITHDRAWN lifecycle
│       Fields: id, affiliate_uid, amount, status, source_order_id, level,
│               withdrawal_request_id (FK), created_at, updated_at
└── affiliate_withdrawal_requests
    └── one row per withdrawal request batch; tracks PENDING → ACCEPTED/REJECTED lifecycle
        Fields: id, affiliate_uid, total_amount, status, user_note, admin_note,
                processed_by, processed_at, created_at, updated_at
```

All commission computation and tree management live in the external microservice. The NestJS module:

1. Syncs user creation events to the external service.
2. Forwards order events after successful payments and creates local commission entries for all ancestors.
3. Proxies read queries (overview, invitees, commissions) and enriches them with local user data (email, phone, active subscription package).
4. Enforces access-control rules (e.g., rate changes only for direct invitees).
5. Manages commission withdrawal requests locally (user requests → admin approve/reject).

---

## Commission Logic

### Earning commissions

1. A new user registers via a referral link containing `?ref=<ref_code>`.
2. `ref_from` is stored on the new user; `createAffiliateUser()` registers both in the external service.
   - Before registering, the service verifies the referrer exists via `getUserOverview(refUid)`. If not found, the request is sent without `refUid`.
3. When the referred user subscribes and pays:
    - The payment service calls `createOrder()` with transaction details.
    - The external service calculates multi-level commissions (up to level 3) and returns them in the response's `commissions[]` array.
    - The NestJS service creates local `affiliate_withdrawals` entries for **all ancestor levels** using the external service response:
        - Reads `commissions[]` from the external service's `POST /api/v1/orders` response.
        - For each commission entry: inserts a row with `affiliate_uid`, `amount` (from external service), `level`, `status = AVAILABLE`, and `source_order_id = orderId`.
        - Skips if `amount <= 0` or if a row for `(source_order_id, affiliate_uid)` already exists (idempotent — checked via a pre-query before insert).
        - No local re-calculation — the external service handles precision with BigDecimal FLOOR.
        - Commission creation failures are caught and logged without propagating (does not fail the order response).

### Requesting withdrawal

1. User calls `POST /withdrawals/request` with an optional `note`.
2. All `AVAILABLE` commission entries for that user are fetched; if none exist, `400 Bad Request` is returned.
3. An `affiliate_withdrawal_requests` record is created with `status = PENDING`, `total_amount` (sum of all available commissions), and `user_note`.
4. All linked `affiliate_withdrawals` entries are updated to `status = WITHDRAWN` and linked via `withdrawal_request_id`.
5. The response returns the created withdrawal request object.

### Admin processing

1. Admin reviews `GET /admin/withdrawals?status=PENDING` (or any status filter).
2. Admin calls `PATCH /admin/withdrawals/:id` with `{ status: "ACCEPTED" | "REJECTED", admin_note?: string }`.
   - The `id` refers to an `affiliate_withdrawal_requests` row, not an individual commission entry.
3. On `ACCEPTED`: request status is set to `ACCEPTED`; `totalWithdrawn` on the overview increases (reflects WITHDRAWN commissions linked to ACCEPTED requests).
4. On `REJECTED`: request status is set to `REJECTED`; all linked `affiliate_withdrawals` revert to `status = AVAILABLE` and `withdrawal_request_id` is cleared — user may request again.
5. `400 Bad Request` is returned if the request status is not `PENDING`.

### Commission rates

- **Default:** Value of `AFFILIATE_DEFAULT_PERCENT` (currently 10%).
- **Override:** A referrer may call `POST /update-rate` to set a custom rate for any direct invitee (0–100%).
- Rate changes apply to future orders only (external service behaviour).

### Tree depth

The external service tracks multi-level commissions (up to level 3). Local `affiliate_withdrawals` rows are created for **all ancestor levels** that earn a commission, using the `commissions[]` array returned by the external service's order endpoint. Each row includes a `level` column indicating the ancestor's position in the referral tree (1 = direct referrer, 2 = referrer's referrer, etc.).

---

## Withdrawal Status Enums

### `WithdrawalStatus` (on `affiliate_withdrawals`)

| Value       | Meaning                                                       |
| ----------- | ------------------------------------------------------------- |
| `PENDING`   | Commission on hold (e.g. refund window) — not yet withdrawable |
| `AVAILABLE` | Commission ready to withdraw                                  |
| `WITHDRAWN` | Linked to a withdrawal request                                |

### `WithdrawalRequestStatus` (on `affiliate_withdrawal_requests`)

| Value      | Meaning                                        |
| ---------- | ---------------------------------------------- |
| `PENDING`  | Waiting for admin review                       |
| `ACCEPTED` | Admin approved; funds should be transferred    |
| `REJECTED` | Admin rejected; linked commissions reverted    |

---

## External Service API

All requests include header `X-API-KEY: <AFFILIATE_API_KEY>`.

| Method | Path                             | Called by               | Description                          |
| ------ | -------------------------------- | ----------------------- | ------------------------------------ |
| POST   | `/api/v1/users`                  | `createAffiliateUser()` | Register user in affiliate tree      |
| POST   | `/api/v1/orders`                 | `createOrder()`         | Record purchase, trigger commissions |
| GET    | `/api/v1/users/overview/:uid`    | `getUserOverview()`     | Fetch user stats + commission rate   |
| GET    | `/api/v1/users/invitees/:uid`    | `getUserInvitees()`     | List invitees (paginated)            |
| GET    | `/api/v1/users/commissions/:uid` | `getUserCommissions()`  | List commission records              |
| POST   | `/api/v1/users/update-rate`      | `updateRate()`          | Change invitee commission rate       |

---

## HTTP Endpoints

All routes are under `/api/v1/affiliate` and require a valid JWT (`JwtAuthGuard`).

| Method | Path                        | Guard                       | Description                                      |
| ------ | --------------------------- | --------------------------- | ------------------------------------------------ |
| GET    | `/overview`                 | JwtAuthGuard                | User's affiliate overview (falls back to defaults if not found in external service) |
| GET    | `/invitees`                 | JwtAuthGuard                | Paginated invitee list with email/phone/package  |
| GET    | `/commissions`              | JwtAuthGuard                | Paginated commission history                     |
| POST   | `/update-rate`              | JwtAuthGuard                | Update commission rate for a direct invitee      |
| POST   | `/withdrawals/request`      | JwtAuthGuard                | Request withdrawal of all AVAILABLE commissions  |
| GET    | `/withdrawals`              | JwtAuthGuard                | User's own withdrawal request history            |
| GET    | `/admin/withdrawals`        | JwtAuthGuard + RolesGuard   | All withdrawal requests (admin only)             |
| PATCH  | `/admin/withdrawals/:id`    | JwtAuthGuard + RolesGuard   | Accept or reject a withdrawal request (admin only) |

---

## Invitee List Filtering

`GET /invitees` supports two query paths depending on active filters:

**Path A — local filtering** (when `search` or `package` is provided):
- Fetches up to 1000 invitees from the external service.
- Enriches each with local `email`, `phone_number`, and active subscription `package` (plan name).
- Applies `search` filter against invitee `uid`, `email`, and `phone_number`.
- Applies `package` filter against the active subscription plan name.
- Paginates the filtered results locally.

**Path B — external pagination** (no `search` or `package`):
- Delegates `page` and `size` directly to the external service.
- Enriches the page of results with local `email`, `phone`, and `package`.
- Returns pagination metadata from the external service response.

Both paths support `level`, `fromDate`, and `toDate` as pass-through params to the external service.

---

## Business Rules Summary

| Rule                                                                | Enforcement                                                                                  |
| ------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Every registered user gets a unique `ref_code`                      | User entity, unique DB constraint                                                            |
| `createAffiliateUser()` failure does not break registration         | Async call after transaction commit                                                          |
| `createOrder()` only fires when `user.ref_code` is set              | Guard in payment service                                                                     |
| Referrer existence verified before `createAffiliateUser()`          | `getUserOverview(refUid)` called; `refUid` omitted if not found                              |
| Commission rate updates restricted to direct invitees               | `updateRate()` validates `targetOverview.refUid === sourceUid`                               |
| Rate must be 0–100%                                                 | DTO `@Min(0) @Max(100)` validation                                                           |
| Pagination default date range                                       | Jan 1, 2026 — today+1 day (applied if `fromDate`/`toDate` omitted)                          |
| Invitee list shows direct children only by default                  | Query parameter passed to external service                                                   |
| Invitee responses enriched locally                                  | Batch lookup for `email`, `phone`, and active subscription `package`                         |
| Commission entries created for all ancestor levels per order        | `createOrder()` reads `commissions[]` from external API response                             |
| Duplicate commission per (order, uid) prevented                     | Pre-insert existence check against `affiliate_withdrawals` by `source_order_id`              |
| Zero-amount commissions not recorded                                | `if (amount > 0)` guard                                                                      |
| Commission creation errors do not fail the order response           | Wrapped in inner try/catch; error is logged only                                             |
| Withdrawal request moves ALL AVAILABLE entries atomically           | Fetches all AVAILABLE, creates request, updates all to WITHDRAWN in one batch                |
| Withdrawal request includes user note                               | Optional `note` field in `CreateWithdrawalRequestDto`                                        |
| Cannot request withdrawal with no AVAILABLE entries                 | `400 Bad Request` from `requestWithdrawal()`                                                 |
| Only PENDING requests can be processed by admin                     | `400 Bad Request` if status ≠ PENDING in `processWithdrawal()`                               |
| REJECTED entries revert to AVAILABLE (user can re-request)          | Status set to `AVAILABLE` and `withdrawal_request_id` cleared on REJECTED                    |
| Admin-only routes protected by role                                 | `RolesGuard` checks `user.role === ADMIN`                                                    |
| `availableToWithdraw` reflects only AVAILABLE commission entries    | SUM query on `affiliate_withdrawals` where `status = AVAILABLE`                              |
| `totalWithdrawn` reflects commissions linked to ACCEPTED requests   | SUM query on `affiliate_withdrawals` where `status = WITHDRAWN` joined to request `status = ACCEPTED` |
| Overview falls back to empty defaults if user not found externally  | Controller returns zero-value object when service returns null                               |
