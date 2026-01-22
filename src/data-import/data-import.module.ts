import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { DataImportService } from "./data-import.service";
import { DataImportController } from "./data-import.controller";
import { Signal } from "../signal/entities/signal.entity";
import { Company } from "src/company/entities/company.entity";

@Module({
  imports: [TypeOrmModule.forFeature([Signal, Company])],
  controllers: [DataImportController],
  providers: [DataImportService],
})
export class DataImportModule { }
