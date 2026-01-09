import { Column } from "typeorm";

export class SignalFinancials {
  @Column("decimal")
  intrinsic_value: number;

  @Column("decimal")
  target_price: number;

  @Column()
  market_cap: string;

  @Column("decimal")
  pe_ratio: number;

  @Column()
  roe: string;

  @Column("decimal")
  debt_to_equity: number;
}
