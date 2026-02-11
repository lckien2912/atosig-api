export enum SignalStatus {
  PENDING = "PENDING",
  ACTIVE = "ACTIVE",
  CLOSED = "CLOSED",
}

export enum SignalDisplayStatus {
  NO_ZONE = 0,    // Không vùng
  BUY_ZONE = 1,    // Vùng mua
  TAKE_PROFIT_1 = 2, // TP1
  TAKE_PROFIT_2 = 3, // TP2
  TAKE_PROFIT_3 = 4, // TP3
  STOP_LOSS = 5,   // Chạm cắt lỗ
}