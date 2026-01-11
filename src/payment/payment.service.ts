import { Injectable, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { PaymentTransaction } from './entities/payment-transaction.entity';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { PaymentGateway, PaymentStatus, PaymentCurrency } from './enums/payment.enum';
import { UserSubscription } from '../pricing/entities/user-subscription.entity';
import { SubscriptionStatus } from '../pricing/enums/pricing.enum';
import moment from 'moment';

@Injectable()
export class PaymentService {
    private readonly logger = new Logger(PaymentService.name);

    constructor(
        @InjectRepository(PaymentTransaction)
        private paymentRepo: Repository<PaymentTransaction>,
        @InjectRepository(UserSubscription)
        private subRepo: Repository<UserSubscription>,
        private configService: ConfigService,
        private dataSource: DataSource
    ) { }

    // ==========================================
    // TẠO YÊU CẦU THANH TOÁN (Generate URL)
    // ==========================================
    async createPaymentUrl(userId: string, dto: CreatePaymentDto) {
        const sub = await this.subRepo.findOne({
            where: { id: dto.subscription_id, user_id: userId },
            relations: ['plan']
        });

        if (!sub) throw new NotFoundException('Subscription not found');
        if (sub.status === SubscriptionStatus.ACTIVE) throw new BadRequestException('Gói này đã được thanh toán rồi');

        // Generate code transaction
        const txnCode = `ATOSIG_${moment().format('YYYYMMDDHHmmss')}_${userId.substring(0, 4).toUpperCase()}`;

        const transaction = this.paymentRepo.create({
            user_id: userId,
            reference_id: sub.id,
            amount: sub.amount_paid,
            currency: dto.currency as PaymentCurrency || PaymentCurrency.VND,
            gateway: dto.gateway,
            status: PaymentStatus.PENDING,
            transaction_code: txnCode
        });

        let paymentUrl = '';
        switch (dto.gateway) {
            case PaymentGateway.VNPAY:
                paymentUrl = await this.generateVnpayUrl(transaction);
                break;
            case PaymentGateway.MOMO:
                paymentUrl = await this.generateMomoUrl(transaction);
                break;
            case PaymentGateway.STRIPE:
                paymentUrl = await this.generateStripeSession(transaction);
                break;
            default:
                paymentUrl = `http://localhost:3000/api/payment/mock-success?code=${txnCode}`; // thay trong env
        }

        transaction.payment_url = paymentUrl;
        await this.paymentRepo.save(transaction);

        return {
            payment_url: paymentUrl,
            transaction_code: txnCode
        };
    }

    // ==========================================
    // CÁC HÀM XỬ LÝ URL CỔNG THANH TOÁN (Placeholder)
    // ==========================================

    private async generateVnpayUrl(txn: PaymentTransaction): Promise<string> {
        // TODO: Điền logic VNPAY thật vào đây khi có Merchant Key
        // Cần: tmnCode, secureSecret, vnpUrl... từ ConfigService
        this.logger.log(`Generating VNPAY URL for ${txn.transaction_code}`);
        return `https://sandbox.vnpayment.vn/paymentv2/vpcpay.html?mock_param=${txn.transaction_code}`;
    }

    private async generateMomoUrl(txn: PaymentTransaction): Promise<string> {
        // TODO: Điền logic Momo thật
        return `https://test-payment.momo.vn/v2/gateway/api/create?mock=${txn.transaction_code}`;
    }

    private async generateStripeSession(txn: PaymentTransaction): Promise<string> {
        // TODO: Logic Stripe (Chuyển đổi VND -> USD nếu cần vì Stripe quốc tế ưu tiên USD)
        return `https://checkout.stripe.com/pay/mock/${txn.transaction_code}`;
    }

    // ==========================================
    // XỬ LÝ KẾT QUẢ THANH TOÁN (Webhook / IPN)
    // ==========================================

    // Hàm này được gọi khi Cổng thanh toán gọi ngược lại server mình (Server-to-Server)
    async processPaymentCallback(gateway: PaymentGateway, data: any) {
        this.logger.log(`Received Webhook from ${gateway}`, data);

        let txnCode = '';
        let isSuccess = false;
        let gatewayTxnId = '';

        if (gateway === PaymentGateway.VNPAY) {
            txnCode = data.vnp_TxnRef;
            isSuccess = data.vnp_ResponseCode === '00';
            gatewayTxnId = data.vnp_TransactionNo;
            // TODO: Cần verify checksum (secure hash) ở đây để đảm bảo an toàn
        } else if (gateway === PaymentGateway.MANUAL) {
            txnCode = data.code;
            isSuccess = true;
        }

        const transaction = await this.paymentRepo.findOne({ where: { transaction_code: txnCode } });
        if (!transaction) throw new NotFoundException('Transaction not found');

        if (transaction.status === PaymentStatus.SUCCESS) {
            return { message: 'Already processed' };
        }

        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();

        try {
            transaction.status = isSuccess ? PaymentStatus.SUCCESS : PaymentStatus.FAILED;
            transaction.gateway_transaction_id = gatewayTxnId;
            transaction.gateway_response = data;
            await queryRunner.manager.save(transaction);

            if (isSuccess) {
                const sub = await this.subRepo.findOne({
                    where: { id: transaction.reference_id },
                    relations: ['plan']
                });

                if (sub) {
                    sub.status = SubscriptionStatus.ACTIVE;
                    sub.payment_method = gateway;
                    sub.transaction_code = txnCode;

                    sub.start_date = new Date();
                    sub.end_date = moment().add(sub.plan.duration_days, 'days').toDate();

                    await queryRunner.manager.save(sub);

                    // TODO: Update User Tier ở đây hoặc trong SubscriptionService 
                    // (Bạn nên gọi hàm của SubscriptionService để tái sử dụng logic update tier)
                }
            }

            await queryRunner.commitTransaction();
            return { message: 'Success' };

        } catch (err) {
            await queryRunner.rollbackTransaction();
            this.logger.error('Error processing payment callback', err);
            throw err;
        } finally {
            await queryRunner.release();
        }
    }
}