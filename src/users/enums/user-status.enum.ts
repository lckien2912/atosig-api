export enum UserSubscriptionTier {
    FREE = 'FREE',
    BASIC = 'BASIC',
    PREMIUM = 'PREMIUM',
}

// Enum cho định danh (KYC sau này)
export enum KycStatus {
    UNVERIFIED = 'UNVERIFIED', // Chưa xác minh
    PENDING = 'PENDING',       // Đang chờ duyệt
    VERIFIED = 'VERIFIED',     // Đã xác minh
    REJECTED = 'REJECTED'      // Bị từ chối
}

export enum UserRole {
    ADMIN = 'ADMIN',
    USER = 'USER',
}