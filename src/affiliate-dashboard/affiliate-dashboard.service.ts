import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { WithdrawalRequestStatus } from 'src/affiliate/enums/withdrawal-request-status.enum';
import { AffiliateStatus } from 'src/users/enums/user-status.enum';
import { SubscriptionStatus } from 'src/pricing/enums/pricing.enum';
import { DashboardQueryDto } from './dto';

@Injectable()
export class AffiliateDashboardService {
    constructor(private readonly dataSource: DataSource) {}

    async getKPIs(query: DashboardQueryDto) {
        const { fromDate, toDate } = query;

        const [
            [{ count: totalActiveAffiliates }],
            [{ count: totalInvitees }],
            [{ sum: totalCommissionPaid }],
            [{ accepted: totalCommissionAccepted, pending: totalCommissionPending, count: totalRequests }]
        ] = await Promise.all([
            this.dataSource.query(`SELECT COUNT(*)::int AS count FROM users WHERE affiliate_status = '${AffiliateStatus.ACTIVE}' AND ref_code IS NOT NULL`),
            this.dataSource.query(`SELECT COUNT(*)::int AS count FROM users WHERE ref_from IS NOT NULL AND created_at >= $1 AND created_at <= $2`, [fromDate, toDate]),
            this.dataSource.query(
                `SELECT COALESCE(SUM(total_amount), 0)::numeric AS sum FROM affiliate_withdrawal_requests WHERE status = '${WithdrawalRequestStatus.PAID}' AND processed_at >= $1 AND processed_at <= $2`,
                [fromDate, toDate]
            ),
            this.dataSource.query(
                `SELECT
                    COALESCE(SUM(CASE WHEN status = '${WithdrawalRequestStatus.ACCEPTED}' THEN total_amount ELSE 0 END), 0)::numeric AS accepted,
                    COALESCE(SUM(CASE WHEN status = '${WithdrawalRequestStatus.PENDING}' THEN total_amount ELSE 0 END), 0)::numeric AS pending,
                    COUNT(*)::int AS count
                FROM affiliate_withdrawal_requests
                WHERE created_at >= $1 AND created_at <= $2`,
                [fromDate, toDate]
            )
        ]);

        return {
            totalActiveAffiliates,
            totalInvitees,
            totalCommissionPaid: Number(totalCommissionPaid),
            totalCommissionAccepted: Number(totalCommissionAccepted),
            totalCommissionPending: Number(totalCommissionPending),
            totalRequests
        };
    }

    async getCharts(query: DashboardQueryDto) {
        const { fromDate, toDate, granularity } = query;

        const [commissionOverTime, top10Affiliates, packageDistribution] = await Promise.all([
            this.dataSource.query(
                `SELECT
                    date_trunc($1, processed_at) AS date,
                    COALESCE(SUM(total_amount), 0)::numeric AS total,
                    COALESCE(SUM(CASE WHEN status = '${WithdrawalRequestStatus.PAID}' THEN total_amount ELSE 0 END), 0)::numeric AS paid
                FROM affiliate_withdrawal_requests
                WHERE status IN ('${WithdrawalRequestStatus.ACCEPTED}', '${WithdrawalRequestStatus.PAID}')
                    AND processed_at >= $2 AND processed_at <= $3
                GROUP BY date_trunc($1, processed_at)
                ORDER BY date`,
                [granularity, fromDate, toDate]
            ),
            this.dataSource.query(
                `SELECT
                    awr.affiliate_uid AS "affiliateUid",
                    u.email,
                    SUM(awr.total_amount)::numeric AS "totalCommission"
                FROM affiliate_withdrawal_requests awr
                JOIN users u ON u.ref_code = awr.affiliate_uid
                WHERE awr.status IN ('${WithdrawalRequestStatus.ACCEPTED}', '${WithdrawalRequestStatus.PAID}')
                    AND awr.created_at >= $1 AND awr.created_at <= $2
                GROUP BY awr.affiliate_uid, u.email
                ORDER BY "totalCommission" DESC
                LIMIT 10`,
                [fromDate, toDate]
            ),
            this.dataSource.query(
                `SELECT
                    p.name AS package,
                    COUNT(*)::int AS count
                FROM user_subscriptions us
                JOIN pricings p ON p.id = us.plan_id
                WHERE us.status = '${SubscriptionStatus.ACTIVE}'
                    AND us.created_at >= $1 AND us.created_at <= $2
                GROUP BY p.name`,
                [fromDate, toDate]
            )
        ]);

        return {
            commissionOverTime: commissionOverTime.map(row => ({
                date: row.date,
                total: Number(row.total),
                paid: Number(row.paid)
            })),
            top10Affiliates: top10Affiliates.map(row => ({
                ...row,
                totalCommission: Number(row.totalCommission)
            })),
            packageDistribution
        };
    }
}
