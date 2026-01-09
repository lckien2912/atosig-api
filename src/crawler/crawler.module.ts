import { Module } from "@nestjs/common";
import { HttpModule } from "@nestjs/axios";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ScheduleModule } from "@nestjs/schedule";
import { CrawlerService } from "./crawler.service";
import { Signal } from "../signal/entities/signal.entity";

@Module({
    imports: [
        HttpModule,
        ScheduleModule.forRoot(),
        TypeOrmModule.forFeature([Signal])
    ],
    providers: [CrawlerService],
    exports: [CrawlerService]
})
export class CrawlerModule { }
