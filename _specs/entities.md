# Database Entities Reference

> Generated: 2026-03-04

---

## Table of Contents

- [users](#users)
- [verification\_codes](#verification_codes)
- [pricings](#pricings)
- [user\_subscriptions](#user_subscriptions)
- [payment\_transactions](#payment_transactions)
- [signals](#signals)
- [user\_favorites](#user_favorites)
- [companies](#companies)
- [notifications](#notifications)
- [notification\_reads](#notification_reads)
- [affiliate\_commissions](#affiliate_commissions)
- [affiliate\_withdrawal\_requests](#affiliate_withdrawal_requests)
- [affiliate\_payments](#affiliate_payments)
- [commission\_audit\_logs](#commission_audit_logs)

---

## users

Table: `users`

| Field | Type | Nullable | Default | Description |
|---|---|---|---|---|
| id | uuid | No | uuid generated | Primary key |
| full_name | varchar | No | — | User's full name |
| email | varchar | No | — | Unique email address |
| password | varchar | Yes | null | Hashed password (excluded from default SELECT) |
| avatar_url | text | Yes | null | Profile picture URL |
| phone_number | varchar | Yes | null | Contact phone number |
| kyc_status | enum | No | `UNVERIFIED` | KYC verification status (`UNVERIFIED`, `PENDING`, `VERIFIED`, `REJECTED`) |
| citizen_id | varchar | Yes | null | National citizen ID number (for KYC) |
| subscription_tier | enum | No | `FREE` | Current subscription tier (`FREE`, `BASIC`, `PREMIUM`) |
| subscription_end_date | timestamp | Yes | null | Expiration date of the active subscription |
| is_active | boolean | No | `true` | Whether the account is active |
| is_verified | boolean | No | `false` | Whether the email has been verified |
| is_locked | boolean | No | `false` | Whether the account is locked |
| is_set_pass | boolean | No | `true` | Whether the user has set a password (false for Google OAuth users) |
| status | varchar | No | `ACTIVE` | Account status string (`ACTIVE`, `INACTIVE`, `DEACTIVATED`) |
| role | enum | No | `USER` | User role (`USER`, `ADMIN`) |
| google_id | varchar | Yes | null | Google OAuth subject ID |
| avatar | varchar | Yes | null | Alternative avatar field |
| ref_code | varchar | Yes | null | Unique referral code for affiliate program |
| ref_from | varchar | Yes | null | Referral code of the user who referred this user |
| login_type | enum | No | `EMAIL` | How the user authenticates (`EMAIL`, `GOOGLE`) |
| affiliate_status | enum | No | `ACTIVE` | Affiliate program status (`ACTIVE`, `SUSPENDED`, `INACTIVE`) |
| affiliate_tier | enum | No | `INDIVIDUAL` | Affiliate tier (`INDIVIDUAL`, `CORP`) |
| created_at | timestamp | No | `CURRENT_TIMESTAMP` | Record creation time |
| updated_at | timestamp | No | `CURRENT_TIMESTAMP` | Record last update time |

---

## verification_codes

Table: `verification_codes`

| Field | Type | Nullable | Default | Description |
|---|---|---|---|---|
| id | uuid | No | uuid generated | Primary key |
| email | varchar | No | — | Target email address |
| code | varchar | No | — | 6-digit verification code (e.g. `"123456"`) |
| expires_at | timestamp | No | — | Expiration timestamp for the code |
| context_data | jsonb | Yes | null | Extra context stored alongside the code (e.g. new email for change-email flow) |
| type | enum | No | `REGISTER` | Purpose of the code (`REGISTER`, `FORGOT_PASSWORD`, `VERIFIED`, `CHANGE_PASSWORD`, `CHANGE_EMAIL`) |
| created_at | timestamp | No | auto | Record creation time |

---

## pricings

Table: `pricings`
Entity: `SubscriptionPlan`

| Field | Type | Nullable | Default | Description |
|---|---|---|---|---|
| id | uuid | No | uuid generated | Primary key |
| name | varchar(100) | No | — | Plan display name (e.g. "Gói tháng") |
| description | text | Yes | null | Marketing description |
| price | decimal(12,0) | No | — | Selling price in VND (e.g. 1990000) |
| discount_percentage | integer | Yes | `0` | Discount percentage applied to the original price |
| duration_days | enum | No | `7` | Plan duration in days (`7`, `30`, `90`) |
| tier | enum | No | `PREMIUM` | Which subscription tier this plan grants (`FREE`, `BASIC`, `PREMIUM`) |
| features | jsonb | Yes | null | Array of feature bullet points for UI display |
| is_active | boolean | No | `true` | Whether this plan is visible and purchasable |
| is_featured | boolean | No | `false` | Highlighted "Recommended" plan flag |
| created_at | timestamp | No | `CURRENT_TIMESTAMP` | Record creation time |
| updated_at | timestamp | No | `CURRENT_TIMESTAMP` | Record last update time |

---

## user_subscriptions

Table: `user_subscriptions`

| Field | Type | Nullable | Default | Description |
|---|---|---|---|---|
| id | uuid | No | uuid generated | Primary key |
| user_id | uuid | No | — | FK → `users.id` |
| plan_id | uuid | Yes | null | FK → `pricings.id` (null if manually granted by admin) |
| amount_paid | decimal(12,0) | No | — | Actual amount the user paid |
| start_date | timestamp | No | — | Subscription start date |
| end_date | timestamp | No | — | Subscription end date |
| status | enum | No | `PENDING` | Subscription status (`PENDING`, `ACTIVE`, `EXPIRED`, `CANCELLED`) |
| payment_method | varchar | Yes | null | Payment method used (`BANK_TRANSFER`, `VNPAY`, `MOMO`) |
| transaction_code | varchar | Yes | null | Transaction code from the payment gateway |
| source | enum | No | `USER` | Who created this subscription (`USER`, `ADMIN`) |
| created_at | timestamp | No | auto | Record creation time |
| updated_at | timestamp | No | auto | Record last update time |

Relations: `transactions` → `PaymentTransaction[]`

---

## payment_transactions

Table: `payment_transactions`

| Field | Type | Nullable | Default | Description |
|---|---|---|---|---|
| id | uuid | No | uuid generated | Primary key |
| user_id | uuid | No | — | FK → `users.id` |
| subscription_id | uuid | No | — | FK → `user_subscriptions.id` |
| amount | decimal(15,2) | No | — | Transaction amount |
| currency | enum | No | `VND` | Currency (`VND`, `USD`) |
| gateway | enum | No | — | Payment gateway used (`VNPAY`, `MOMO`, `STRIPE`, `PAYPAL`, `MANUAL`) |
| status | enum | No | `PENDING` | Transaction status (`PENDING`, `SUCCESS`, `FAILED`, `REFUNDED`) |
| transaction_code | varchar | No | — | Unique internal transaction code (e.g. `TXN_20260111_001`) |
| gateway_transaction_id | varchar | Yes | null | Transaction ID returned by the payment gateway |
| gateway_response | jsonb | Yes | null | Full raw response from the gateway (for debugging) |
| payment_url | varchar | Yes | null | Payment redirect URL generated by the gateway |
| created_at | timestamp | No | auto | Record creation time |
| updated_at | timestamp | No | auto | Record last update time |

---

## signals

Table: `signals`

| Field | Type | Nullable | Default | Description |
|---|---|---|---|---|
| id | uuid | No | uuid generated | Primary key |
| symbol | varchar(10) | No | — | Stock ticker symbol (e.g. `VNM`) |
| exchange | varchar(10) | No | — | Exchange name (e.g. `HOSE`) |
| price_base | decimal(10,2) | No | `0` | Base reference price |
| signal_date | date | Yes | null | Date the signal was generated |
| entry_date | date | Yes | null | Suggested entry date |
| entry_price_min | decimal(10,2) | No | — | Lower bound of the entry price range |
| entry_price_max | decimal(10,2) | Yes | `0` | Upper bound of the entry price range |
| stop_loss_price | decimal(10,2) | No | `0` | Absolute stop-loss price |
| stop_loss_pct | decimal(10,2) | No | `0` | Stop-loss as a percentage |
| tp1_price | decimal(10,2) | No | `0` | Take-profit 1 price |
| tp2_price | decimal(10,2) | No | `0` | Take-profit 2 price |
| tp3_price | decimal(10,2) | No | `0` | Take-profit 3 price |
| tp1_pct | decimal(10,2) | Yes | `0` | TP1 gain percentage |
| tp2_pct | decimal(10,2) | Yes | `0` | TP2 gain percentage |
| tp3_pct | decimal(10,2) | Yes | `0` | TP3 gain percentage |
| rr_tp1 | decimal(10,6) | Yes | `0` | Risk/reward ratio at TP1 |
| rr_tp2 | decimal(10,6) | Yes | `0` | Risk/reward ratio at TP2 |
| rr_tp3 | decimal(10,6) | Yes | `0` | Risk/reward ratio at TP3 |
| atr_pct | decimal(10,6) | Yes | `0` | Average True Range as percentage |
| recent_low | decimal(10,2) | Yes | `0` | Recent low price |
| holding_period | date | Yes | null | Suggested holding period end date |
| status | enum | No | `PENDING` | Signal lifecycle status (`PENDING`, `ACTIVE`, `CLOSED`) |
| current_price | decimal | Yes | null | Latest price updated by cronjob from SSI |
| current_change_percent | decimal(5,2) | Yes | `0` | Price change percentage vs previous update |
| is_premium | boolean | No | `true` | Whether this signal requires a premium subscription |
| is_notified | boolean | No | `false` | Whether a push notification has been sent |
| is_expired | boolean | No | `false` | Whether the signal has expired |
| tp1_hit_at | timestamp | Yes | null | Timestamp when TP1 was hit |
| tp2_hit_at | timestamp | Yes | null | Timestamp when TP2 was hit |
| tp3_hit_at | timestamp | Yes | null | Timestamp when TP3 was hit |
| sl_hit_at | timestamp | Yes | null | Timestamp when stop-loss was hit |
| highest_price | decimal | No | `0` | Highest price reached since signal activation |
| closed_at | timestamp | Yes | null | Timestamp when the signal was closed |
| created_at | timestamp | No | auto | Record creation time |
| updated_at | timestamp | No | auto | Record last update time |

---

## user_favorites

Table: `user_favorites`

| Field | Type | Nullable | Default | Description |
|---|---|---|---|---|
| id | uuid | No | uuid generated | Primary key |
| user_id | uuid | No | — | FK → `users.id` |
| signal_id | uuid | No | — | FK → `signals.id` |
| created_at | timestamp | No | auto | Timestamp when signal was favorited |

---

## companies

Table: `companies`

| Field | Type | Nullable | Default | Description |
|---|---|---|---|---|
| id | uuid | No | uuid generated | Primary key |
| symbol | varchar(50) | No | — | Stock ticker symbol |
| year | int | No | — | Fiscal year |
| quarter | int | No | — | Fiscal quarter |
| company_name | varchar(255) | Yes | null | Full company name |
| pe | decimal(18,8) | Yes | null | Price-to-Earnings ratio |
| roe | decimal(18,8) | Yes | null | Return on Equity |
| market_capitalization | decimal(30,2) | Yes | null | Market cap in VND |
| debt_to_equity_ratio | decimal(18,8) | Yes | null | Debt-to-equity ratio |
| note | text | Yes | null | Additional notes |
| roe_percent | decimal(18,8) | Yes | null | ROE as a percentage |
| exchange | varchar(100) | Yes | null | Exchange the company is listed on |
| company_profile | text | Yes | null | Company profile text |
| created_at | timestamp | No | `CURRENT_TIMESTAMP` | Record creation time |

---

## notifications

Table: `notifications`

| Field | Type | Nullable | Default | Description |
|---|---|---|---|---|
| id | uuid | No | uuid generated | Primary key |
| user_id | uuid | Yes | null | FK → `users.id` (null = broadcast to all) |
| type | enum | No | `SYSTEM` | Notification type (`SIGNAL_ACTIVE`, `SIGNAL_ENTRY`, `SIGNAL_TP_1`, `SIGNAL_TP_2`, `SIGNAL_TP_3`, `SIGNAL_SL`, `SYSTEM`, `PAYMENT`) |
| title | varchar | No | — | Notification title |
| body | varchar | No | — | Notification body text |
| metadata | jsonb | Yes | null | Extra payload data (e.g. signal ID, plan name) |
| is_read | boolean | No | `false` | Whether the notification has been read (denormalized shortcut) |
| created_at | timestamp | No | auto | Record creation time |

---

## notification_reads

Table: `notification_reads`
Unique index on (`user_id`, `notification_id`)

| Field | Type | Nullable | Default | Description |
|---|---|---|---|---|
| id | uuid | No | uuid generated | Primary key |
| user_id | uuid | No | — | FK → `users.id` |
| notification_id | uuid | No | — | FK → `notifications.id` |
| read_at | timestamp | No | auto | Timestamp when the notification was read |

---

## affiliate_commissions

Table: `affiliate_commissions`

| Field | Type | Nullable | Default | Description |
|---|---|---|---|---|
| id | uuid | No | uuid generated | Primary key |
| affiliate_uid | varchar | No | — | UID of the affiliate who earned the commission |
| amount | decimal(15,2) | No | — | Commission amount in VND |
| status | enum | No | `AVAILABLE` | Commission status (`PENDING` = on hold, `AVAILABLE` = ready to withdraw, `WITHDRAWN` = linked to a request) |
| source_order_id | varchar | Yes | null | Order/subscription ID that triggered this commission |
| level | smallint | Yes | null | Referral depth level (1 = direct, 2 = indirect) |
| withdrawal_request_id | uuid | Yes | null | FK → `affiliate_withdrawal_requests.id` |
| created_at | timestamp | No | auto | Record creation time |
| updated_at | timestamp | No | auto | Record last update time |

---

## affiliate_withdrawal_requests

Table: `affiliate_withdrawal_requests`
Index on (`affiliate_uid`, `status`)

| Field | Type | Nullable | Default | Description |
|---|---|---|---|---|
| id | uuid | No | uuid generated | Primary key |
| affiliate_uid | varchar | No | — | UID of the affiliate requesting withdrawal |
| total_amount | decimal(15,2) | No | — | Total amount requested |
| status | enum | No | `PENDING` | Request status (`PENDING`, `ACCEPTED`, `REJECTED`, `PAID`, `REVERTED`) |
| user_note | varchar | Yes | null | Note from the affiliate |
| admin_note | varchar | Yes | null | Note from the admin reviewer |
| processed_by | uuid | Yes | null | Admin user ID who processed the request |
| processed_at | timestamp | Yes | null | Timestamp when the request was processed |
| payment_id | uuid | Yes | null | FK → `affiliate_payments.id` (set when PAID) |
| hold_until | timestamp | Yes | null | Hold-until date before the request can be processed |
| created_at | timestamp | No | auto | Record creation time |
| updated_at | timestamp | No | auto | Record last update time |

---

## affiliate_payments

Table: `affiliate_payments`

| Field | Type | Nullable | Default | Description |
|---|---|---|---|---|
| id | uuid | No | uuid generated | Primary key |
| batch_name | varchar(255) | Yes | null | Human-readable batch label (e.g. "Feb 2026 batch") |
| total_amount | decimal(15,2) | No | — | Total disbursed amount across all requests in this payment |
| payment_date | timestamp | No | — | Actual payment execution date |
| payment_method | varchar(20) | No | — | Disbursement method (`BANK`, `EWALLET`, `CASH`) |
| transaction_id | varchar(255) | Yes | null | External transaction reference (bank transfer ID, etc.) |
| proof_url | varchar(500) | Yes | null | URL to payment proof document/screenshot |
| notes | text | Yes | null | Admin notes about this payment |
| created_by | varchar(36) | Yes | null | Admin user ID who created this payment record |
| created_at | timestamp | No | auto | Record creation time |

Relations: `withdrawal_requests` → `AffiliateWithdrawalRequest[]`

---

## commission_audit_logs

Table: `commission_audit_logs`

| Field | Type | Nullable | Default | Description |
|---|---|---|---|---|
| id | uuid | No | uuid generated | Primary key |
| request_id | uuid | Yes | null | FK → `affiliate_withdrawal_requests.id` |
| affiliate_uid | varchar | Yes | null | Affiliate UID affected by this log entry |
| action | varchar(20) | No | — | Action performed (e.g. `ACCEPT`, `REJECT`, `REVERT`, `PAY`) |
| performed_by | varchar(36) | Yes | null | Admin user ID who performed the action |
| note | text | Yes | null | Optional note explaining the action |
| created_at | timestamp | No | auto | Timestamp when the action was logged |
