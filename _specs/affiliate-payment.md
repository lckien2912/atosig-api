# Affiliate Payment Management Specification

## Overview

The `AffiliatePaymentModule` provides admin-only endpoints for processing affiliate commission payments. It handles batch payment creation (linking approved withdrawal requests to a payment record), proof-of-payment file uploads, and payment listing/detail views. This module acts as the payment execution layer between approved withdrawal requests and actual disbursement.

For withdrawal request management (approve/reject/hold/revert), see [admin-commission.md](./admin-commission.md).
For affiliate user management, see [admin-affiliate.md](./admin-affiliate.md).

---

## Architecture

```
NestJS App
└── AffiliatePaymentModule
    ├── AffiliatePaymentController  (/api/v1/admin/payments)
    │   └── @AdminOnly() — JwtAuthGuard + RolesGuard + ApiBearerAuth
    ├── AffiliatePaymentService     (business logic)
    └── DTOs
        ├── CreatePaymentBatchDto
        └── ListPaymentsQueryDto

Shared Entities (from AffiliateModule)
├── AffiliatePayment             — payment batch record
├── AffiliateWithdrawalRequest   — linked withdrawal requests
└── CommissionAuditLog           — audit trail

PostgreSQL
├── affiliate_payments
│   └── id, batch_name, total_amount, payment_date, payment_method,
│       transaction_id, proof_url, notes, created_by, created_at
├── affiliate_withdrawal_requests
│   └── + payment_id (FK to affiliate_payments)
└── commission_audit_logs
```

---

## Payment Flow

```
┌──────────┐     createBatch()      ┌──────────────────┐
│ ACCEPTED │ ─────────────────────► │ PAID (terminal)  │
│ requests │                        │ + payment record │
└──────────┘                        └────────┬─────────┘
                                             │
                                     uploadProof()
                                             │
                                    ┌────────▼─────────┐
                                    │ PAID + proof_url  │
                                    └──────────────────┘
```

Only withdrawal requests in `ACCEPTED` status can be included in a payment batch. Creating a batch transitions all linked requests to `PAID` (terminal state).

---

## HTTP Endpoints

| Method | Path | Handler | Description |
|--------|------|---------|-------------|
| POST | `/admin/payments/batch` | `createBatch()` | Create payment batch linking approved withdrawal requests |
| POST | `/admin/payments/:id/proof` | `uploadProof()` | Upload payment proof file (image/PDF) |
| GET | `/admin/payments` | `list()` | Paginated payment list with filters |
| GET | `/admin/payments/:id` | `getDetail()` | Payment detail with linked withdrawal requests |

All endpoints require `@AdminOnly()` (JWT + admin role).

---

## DTOs

### CreatePaymentBatchDto

| Field | Type | Validation | Default |
|-------|------|------------|---------|
| `withdrawalRequestIds` | string[] | IsArray, ArrayMinSize(1), ArrayMaxSize(200), IsUUID each | — (required) |
| `paymentDate` | string | IsDateString | — (required) |
| `paymentMethod` | PaymentMethod | IsEnum | — (required) |
| `transactionId` | string | IsOptional, MaxLength(255) | — |
| `notes` | string | IsOptional, MaxLength(500) | — |
| `batchName` | string | IsOptional | auto-generated |

### ListPaymentsQueryDto

| Field | Type | Validation | Default |
|-------|------|------------|---------|
| `paymentMethod` | PaymentMethod | IsOptional, IsEnum | — |
| `fromDate` | string | IsOptional, IsDateString | — |
| `toDate` | string | IsOptional, IsDateString | — |
| `page` | number | IsOptional, IsNumber, Min(1) | `1` |
| `size` | number | IsOptional, IsNumber, Min(5), Max(100) | `20` |

---

## Enums

### PaymentMethod

| Value | Meaning |
|-------|---------|
| `BANK` | Bank transfer |
| `EWALLET` | E-wallet payment |
| `CASH` | Cash payment |

---

## Batch Creation Logic

`POST /admin/payments/batch` performs the following in a single transaction:

1. Loads all withdrawal requests by the provided IDs.
2. Validates all IDs exist — throws `400 Bad Request` if any ID is not found.
3. Validates all requests have status `ACCEPTED` — throws `400 Bad Request` if any request is not in the correct status.
4. Calculates `total_amount` as the sum of all request amounts.
5. Creates an `AffiliatePayment` record with:
   - `batch_name` — from DTO or auto-generated from current date
   - `total_amount`, `payment_date`, `payment_method`, `transaction_id`, `notes`
   - `created_by` — admin user ID
6. Updates each withdrawal request:
   - `status` → `PAID`
   - `payment_id` → new payment ID
   - `processed_at` → current timestamp
   - `processed_by` → admin user ID
7. Creates a `CommissionAuditLog` entry for each request with action `MARK_PAID`.
8. Returns `{ payment, updatedRequestsCount }`.

---

## Proof Upload

`POST /admin/payments/:id/proof` accepts a file upload:

| Constraint | Value |
|------------|-------|
| Allowed MIME types | `image/jpeg`, `image/png`, `application/pdf` |
| Max file size | 10 MB |
| Storage path | `./uploads/payment-proofs/{paymentId}/{originalFilename}` |

- Payment must exist — throws `404 Not Found` if not found.
- File is required — throws `400 Bad Request` if missing.
- Updates `payment.proof_url` with the relative file path.
- Returns `{ proofUrl }`.

---

## Detail Endpoint Response

`GET /admin/payments/:id` returns:

```json
{
    "id": "uuid",
    "batchName": "string",
    "totalAmount": 0,
    "paymentDate": "timestamp",
    "paymentMethod": "BANK",
    "transactionId": "string|null",
    "proofUrl": "string|null",
    "notes": "string|null",
    "createdBy": { "id": "uuid", "email": "string" },
    "createdAt": "timestamp",
    "items": [
        {
            "requestId": "uuid",
            "affiliateUid": "string",
            "affiliateEmail": "string|null",
            "affiliatePhone": "string|null",
            "amount": 0
        }
    ]
}
```

- `items` — all withdrawal requests linked to this payment, with affiliate contact details joined from `users` table.
- `createdBy` — admin who created the batch, joined from `users` table.

---

## List Endpoint Response

`GET /admin/payments` returns paginated results:

- Each payment includes a `requestCount` (number of linked withdrawal requests) computed via subquery.
- Includes creator email joined from `users` table.
- Ordered by `created_at DESC`.

---

## Audit Logging

Each withdrawal request transitioned to `PAID` during batch creation generates a `CommissionAuditLog` entry:

- `action` — `MARK_PAID`
- `request_id` — FK to the withdrawal request
- `affiliate_uid` — the affiliate's ref_code
- `performed_by` — admin user ID
- `note` — includes the batch name

---

## Business Rules Summary

| Rule | Enforcement |
|------|-------------|
| Only admins can access these endpoints | `@AdminOnly()` decorator (JwtAuthGuard + RolesGuard) |
| Only ACCEPTED requests can be batched for payment | Service validates status before processing |
| All provided request IDs must exist | `400 Bad Request` if any ID is not found |
| Batch creation is transactional | All updates happen in a single DB transaction |
| PAID is a terminal state | No further transitions allowed after payment |
| Batch name auto-generated if not provided | Uses current date to generate name |
| Proof upload restricted to images and PDFs | MIME type validation (jpeg, png, pdf) |
| Proof file size capped at 10 MB | Size validation before storage |
| Payment batch capped at 200 items | DTO validation with ArrayMaxSize(200) |
| Every payment action is audit-logged | CommissionAuditLog entry per request with MARK_PAID action |
