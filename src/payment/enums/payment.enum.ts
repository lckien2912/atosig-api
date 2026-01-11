export enum PaymentGateway {
    VNPAY = 'VNPAY',
    MOMO = 'MOMO',
    STRIPE = 'STRIPE', // Quốc tế
    PAYPAL = 'PAYPAL', // Quốc tế
    MANUAL = 'MANUAL'  // Chuyển khoản tay (Duyệt thủ công)
}

export enum PaymentStatus {
    PENDING = 'PENDING',   // Đang chờ thanh toán
    SUCCESS = 'SUCCESS',   // Thành công
    FAILED = 'FAILED',     // Thất bại
    REFUNDED = 'REFUNDED'  // Đã hoàn tiền
}

export enum PaymentCurrency {
    VND = 'VND',
    USD = 'USD'
}