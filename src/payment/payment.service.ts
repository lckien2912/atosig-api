import { Injectable, BadRequestException, NotFoundException, Logger, InternalServerErrorException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { PaymentTransaction } from './entities/payment-transaction.entity';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { PaymentGateway, PaymentStatus, PaymentCurrency } from './enums/payment.enum';
import { UserSubscription } from '../pricing/entities/user-subscription.entity';
import { SubscriptionStatus } from '../pricing/enums/pricing.enum';
import moment from 'moment';
import * as crypto from 'crypto';
import axios from 'axios';
import { NotificationsService } from 'src/notification/notifications.service';
import { NotificationType } from 'src/notification/enums/notification.enum';

@Injectable()
export class PaymentService {
    private readonly logger = new Logger(PaymentService.name);

    constructor(
        @InjectRepository(PaymentTransaction)
        private paymentRepo: Repository<PaymentTransaction>,
        @InjectRepository(UserSubscription)
        private subRepo: Repository<UserSubscription>,
        private configService: ConfigService,
        private readonly notiService: NotificationsService,
        private dataSource: DataSource
    ) { }

    // ==========================================
    // TẠO YÊU CẦU THANH TOÁN (Generate URL)
    // ==========================================
    async createPaymentUrl(userId: string, dto: CreatePaymentDto, ipAddr: string) {
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
            subscription_id: sub.id,
            amount: sub.amount_paid,
            currency: dto.currency as PaymentCurrency || PaymentCurrency.VND,
            gateway: dto.gateway,
            status: PaymentStatus.PENDING,
            transaction_code: txnCode
        });

        let paymentUrl = '';
        const clientIp = ipAddr === '::1' ? '127.0.0.1' : ipAddr;

        switch (dto.gateway) {
            case PaymentGateway.VNPAY:
                paymentUrl = await this.generateVnpayUrl(transaction, clientIp);
                break;
            case PaymentGateway.MOMO:
                paymentUrl = await this.generateMomoUrl(transaction);
                break;
            // case PaymentGateway.STRIPE:
            //     paymentUrl = await this.generateStripeSession(transaction);
            //     break;
            default:
                paymentUrl = `${this.configService.get('APP_URL')}:${this.configService.get('PORT')}/api/payment/mock-success?code=${txnCode}`;
        }

        transaction.payment_url = paymentUrl;
        await this.paymentRepo.save(transaction);

        return {
            payment_url: paymentUrl,
            transaction_code: txnCode
        };
    }

    // ==========================================
    // XỬ LÝ IPN (WEBHOOK)
    // ==========================================
    async processPaymentCallback(gateway: PaymentGateway, data: any) {
        this.logger.log(`IPN Received from ${gateway}`, data);

        let txnCode = '';
        let isSuccess = false;
        let gatewayTxnId = '';

        if (gateway === PaymentGateway.VNPAY) {
            const secureHash = data['vnp_SecureHash'];

            const vnp_Params = { ...data };
            delete vnp_Params['vnp_SecureHash'];
            delete vnp_Params['vnp_SecureHashType'];

            // create signature
            const { signed } = this.signVnpayParams(vnp_Params);

            if (secureHash !== signed) {
                this.logger.error('VNPAY Checksum Failed');
                return { RspCode: '97', Message: 'Checksum failed' };
            }

            txnCode = vnp_Params['vnp_TxnRef'];
            gatewayTxnId = vnp_Params['vnp_TransactionNo'];
            isSuccess = vnp_Params['vnp_ResponseCode'] === '00';

        } else if (gateway === PaymentGateway.MOMO) {
            const { partnerCode, orderId, requestId, amount, orderInfo, orderType, transId, resultCode, message, payType, responseTime, extraData, signature } = data;
            const accessKey = this.configService.get<string>('MOMO_ACCESS_KEY');
            const secretKey = this.configService.get<string>('MOMO_SECRET_KEY') ?? '';

            const rawSignature = `accessKey=${accessKey}&amount=${amount}&extraData=${extraData}&message=${message}&orderId=${orderId}&orderInfo=${orderInfo}&orderType=${orderType}&partnerCode=${partnerCode}&payType=${payType}&requestId=${requestId}&responseTime=${responseTime}&resultCode=${resultCode}&transId=${transId}`;

            const checkSignature = crypto.createHmac('sha256', secretKey)
                .update(rawSignature)
                .digest('hex');

            if (signature !== checkSignature) {
                this.logger.error('Momo Checksum Failed');
                return { status: 400, message: 'Invalid Signature' };
            }

            txnCode = orderId;
            gatewayTxnId = transId.toString();
            isSuccess = resultCode === 0;

        } else if (gateway === PaymentGateway.MANUAL) {
            txnCode = data.code;
            isSuccess = true;
        }

        // update db
        return this.updateTransactionStatus(txnCode, gatewayTxnId, isSuccess, gateway, data);
    }

    // ==========================================
    // CHECK RETURN URL (UI)
    // ==========================================
    checkReturnUrl(vnp_Params: any) {
        const secureHash = vnp_Params['vnp_SecureHash'];

        const vnp_Params_Check = { ...vnp_Params };
        delete vnp_Params_Check['vnp_SecureHash'];
        delete vnp_Params_Check['vnp_SecureHashType'];

        const { signed } = this.signVnpayParams(vnp_Params_Check);

        if (secureHash === signed) {
            return {
                isSuccess: vnp_Params['vnp_ResponseCode'] === '00',
                isValid: true,
                message: vnp_Params['vnp_ResponseCode'] === '00' ? 'Giao dịch thành công' : 'Giao dịch thất bại'
            };
        } else {
            return {
                isSuccess: false,
                isValid: false,
                message: 'Chữ ký không hợp lệ'
            };
        }
    }

    private signVnpayParams(params: any) {
        const secretKey = this.configService.get<string>('VNP_HASH_SECRET');
        if (!secretKey) throw new InternalServerErrorException('VNP_HASH_SECRET is not configured');

        const sortedKeys = Object.keys(params).sort();
        const queryParams: string[] = [];

        sortedKeys.forEach(key => {
            const value = params[key];
            if (value !== null && value !== undefined && value.toString() !== '') {
                const encodedKey = encodeURIComponent(key);
                const encodedValue = encodeURIComponent(String(value)).replace(/%20/g, "+");
                queryParams.push(`${encodedKey}=${encodedValue}`);
            }
        });

        const signData = queryParams.join('&');
        const hmac = crypto.createHmac('sha512', secretKey);
        const signed = hmac.update(Buffer.from(signData, 'utf-8')).digest('hex');

        return {
            query: signData,
            signed: signed
        };
    }


    async generateVnpayUrl(txn: PaymentTransaction, ipAddr: string): Promise<string> {
        const tmnCode = this.configService.get<string>('VNP_TMN_CODE');
        const vnpUrl = this.configService.get<string>('VNP_URL');
        const returnUrl = this.configService.get<string>('VNP_RETURN_URL');

        const date = new Date();
        const createDate = moment(date).format('YYYYMMDDHHmmss');
        const amount = txn.amount * 100;

        const vnp_Params = {
            vnp_Version: '2.1.0',
            vnp_Command: 'pay',
            vnp_TmnCode: tmnCode,
            vnp_Locale: 'vn',
            vnp_CurrCode: 'VND',
            vnp_TxnRef: txn.transaction_code,
            vnp_OrderInfo: `Thanh toan don hang ${txn.transaction_code}`,
            vnp_OrderType: 'other',
            vnp_Amount: Math.floor(amount),
            vnp_ReturnUrl: returnUrl,
            vnp_IpAddr: ipAddr,
            vnp_CreateDate: createDate,
        };

        const { query, signed } = this.signVnpayParams(vnp_Params);

        return `${vnpUrl}?${query}&vnp_SecureHash=${signed}`;
    }

    private async updateTransactionStatus(txnCode: string, gatewayTxnId: string, isSuccess: boolean, gateway: PaymentGateway, rawData: any) {
        const transaction = await this.paymentRepo.findOne({ where: { transaction_code: txnCode } });

        if (!transaction) {
            if (gateway === PaymentGateway.VNPAY) return { RspCode: '01', Message: 'Order not found' };
            throw new NotFoundException('Transaction not found');
        }

        if (transaction.status === PaymentStatus.SUCCESS && isSuccess) {
            if (gateway === PaymentGateway.VNPAY) return { RspCode: '00', Message: 'Confirm Success' };
            return { message: 'Already processed' };
        }

        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();

        try {
            transaction.status = isSuccess ? PaymentStatus.SUCCESS : PaymentStatus.FAILED;
            transaction.gateway_transaction_id = gatewayTxnId;
            transaction.gateway_response = rawData;
            await queryRunner.manager.save(transaction);

            if (isSuccess) {
                const sub = await this.subRepo.findOne({
                    where: { id: transaction.subscription_id },
                    relations: ['plan']
                });

                if (sub) {
                    sub.status = SubscriptionStatus.ACTIVE;
                    sub.payment_method = gateway;
                    sub.transaction_code = txnCode;
                    sub.start_date = new Date();

                    if (sub.plan && sub.plan.duration_days) {
                        sub.end_date = moment().add(sub.plan.duration_days, 'days').toDate();
                    } else {
                        sub.end_date = moment().add(30, 'days').toDate();
                    }

                    await queryRunner.manager.save(sub);

                    // call noti
                    await this.notiService.broadcastFromAdmin({
                        title: 'Thanh toán thành công!',
                        body: `Gói ${sub.plan?.name || 'VIP'} đã được kích hoạt. Hạn dùng đến ${moment(sub.end_date).format('DD/MM/YYYY')}.`,
                        type: NotificationType.SYSTEM,
                        user_id: transaction.user_id,
                        metadata: {
                            transaction_code: txnCode,
                            amount: transaction.amount
                        }
                    });
                    this.logger.log(`User subscription ${sub.id} activated.`);
                }
            }

            await queryRunner.commitTransaction();

            if (gateway === PaymentGateway.VNPAY) return { RspCode: '00', Message: 'Confirm Success' };

            return { message: 'Success' };

        } catch (err) {
            await queryRunner.rollbackTransaction();
            this.logger.error('Error processing payment callback', err);
            if (gateway === PaymentGateway.VNPAY) return { RspCode: '99', Message: 'Unknow error' };
            throw err;
        } finally {
            await queryRunner.release();
        }
    }

    async generateMomoUrl(txn: PaymentTransaction): Promise<string> {
        const partnerCode = this.configService.get<string>('MOMO_PARTNER_CODE');
        const accessKey = this.configService.get<string>('MOMO_ACCESS_KEY');
        const secretKey = this.configService.get<string>('MOMO_SECRET_KEY') ?? '';
        const endpoint = this.configService.get<string>('MOMO_ENDPOINT') ?? '';
        const appUrl = this.configService.get<string>('APP_URL_FE');
        const redirectUrl = this.configService.get<string>('MOMO_RETURN_URL');

        const ipnUrl = `${appUrl}/api/payment/momo/ipn`;

        const requestId = txn.transaction_code;
        const orderId = txn.transaction_code;
        const orderInfo = `Thanh toan don hang ${orderId}`;
        const amount = Math.floor(txn.amount).toString();
        const requestType = 'captureWallet';
        const extraData = '';

        const rawSignature = `accessKey=${accessKey}&amount=${amount}&extraData=${extraData}&ipnUrl=${ipnUrl}&orderId=${orderId}&orderInfo=${orderInfo}&partnerCode=${partnerCode}&redirectUrl=${redirectUrl}&requestId=${requestId}&requestType=${requestType}`;

        const signature = crypto.createHmac('sha256', secretKey)
            .update(rawSignature)
            .digest('hex');

        const requestBody = {
            partnerCode,
            partnerName: "Test Momo",
            storeId: "MomoTestStore",
            requestId,
            amount,
            orderId,
            orderInfo,
            redirectUrl,
            ipnUrl,
            lang: 'vi',
            requestType,
            autoCapture: true,
            extraData,
            signature
        };

        try {
            const response = await axios.post(endpoint, requestBody);

            if (response.data && response.data.resultCode === 0) {
                return response.data.payUrl;
            } else {
                this.logger.error('Momo Error:', response.data);
                throw new BadRequestException(`Momo Error: ${response.data.message}`);
            }
        } catch (error) {
            this.logger.error('Call Momo API failed', error);
            throw new InternalServerErrorException('Cannot connect to Momo Gateway');
        }
    }


}