export enum WithdrawalStatus {
    PENDING = 'PENDING', // Commission on hold (e.g. refund window)
    AVAILABLE = 'AVAILABLE', // Commission ready to withdraw
    WITHDRAWN = 'WITHDRAWN' // Linked to a withdrawal request
}
