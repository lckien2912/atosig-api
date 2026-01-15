export enum NotificationType {
    SIGNAL_ACTIVE = 'SIGNAL_ACTIVE',
    SIGNAL_ENTRY = 'SIGNAL_ENTRY', // Tín hiệu mua mới
    SIGNAL_TP_1 = 'SIGNAL_TP_1',       // Đạt Take Profit 1
    SIGNAL_TP_2 = 'SIGNAL_TP_2',       // Đạt Take Profit 2
    SIGNAL_TP_3 = 'SIGNAL_TP_3',       // Đạt Take Profit 3
    SIGNAL_SL = 'SIGNAL_SL',       // Chạm Stop Loss
    SYSTEM = 'SYSTEM',              // Thông báo hệ thống
    PAYMENT = 'PAYMENT'             // Nạp rút tiền
}