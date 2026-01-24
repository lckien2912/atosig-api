import { Module } from "@nestjs/common";
import { HttpModule } from "@nestjs/axios";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ScheduleModule } from "@nestjs/schedule";
import { CrawlerService } from "./crawler.service";
import { Signal } from "../signal/entities/signal.entity";
import { NotificationsModule } from "src/notification/notifications.module";
import { CrawlerController } from "./crawler.controller";

@Module({
    imports: [
        HttpModule,
        TypeOrmModule.forFeature([Signal]),
        NotificationsModule
    ],
    controllers: [CrawlerController],
    providers: [CrawlerService],
    exports: [CrawlerService]
})
export class CrawlerModule { }
