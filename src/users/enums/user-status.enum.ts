export enum UserSubscriptionTier {
    FREE = 'FREE',
    BASIC = 'BASIC',
    PREMIUM = 'PREMIUM',
}

export enum DuarationDays {
    WEEK = 7,
    ONE_MONTH = 30,
    THREE_MONTH = 90,
}


// Enum cho định danh (KYC sau này)
export enum KycStatus {
    UNVERIFIED = 'UNVERIFIED', // Chưa xác minh
    PENDING = 'PENDING',       // Đang chờ duyệt
    VERIFIED = 'VERIFIED',     // Đã xác minh
    REJECTED = 'REJECTED'      // Bị từ chối
}

export enum UserStatus {
    ACTIVE = 'ACTIVE',
    INACTIVE = 'INACTIVE',
    DEACTIVATED = 'DEACTIVATED'
}
export enum UserRole {
    ADMIN = 'ADMIN',
    USER = 'USER',
}