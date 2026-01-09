import { Module } from "@nestjs/common";
import { HttpModule } from "@nestjs/axios";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ScheduleModule } from "@nestjs/schedule";
import { CrawlerService } from "./crawler.service";
import { DailyTop } from "./entities/daily-top.entity";
import { DailyIndex } from "./entities/daily-index.entity";
import { DailyStock } from "./entities/daily-stock.entity";
import { Signal } from "../signal/entities/signal.entity";

@Module({
    imports: [
        HttpModule,
        ScheduleModule.forRoot(),
        TypeOrmModule.forFeature([DailyTop, DailyIndex, DailyStock, Signal]),
    ],
    providers: [CrawlerService],
})
export class CrawlerModule { }
