import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { SignalService } from "./signal.service";
import { SignalController } from "./signal.controller";
import { Signal } from "./entities/signal.entity";

@Module({
  imports: [TypeOrmModule.forFeature([Signal])],
  controllers: [SignalController],
  providers: [SignalService],
})
export class SignalModule {}
