import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { DataImportService } from "./data-import.service";
import { DataImportController } from "./data-import.controller";
import { Signal } from "../signal/entities/signal.entity";

@Module({
  imports: [TypeOrmModule.forFeature([Signal])],
  controllers: [DataImportController],
  providers: [DataImportService],
})
export class DataImportModule {}
