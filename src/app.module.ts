import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { SignalModule } from "./signal/signal.module";
import { DataImportModule } from "./data-import/data-import.module";
import { CrawlerModule } from "./crawler/crawler.module";

import { AuthModule } from "./auth/auth.module";
import { UsersModule } from "./users/user.module";
import { DataSource } from "typeorm";
import { PricingModule } from "./pricing/pricing.module";
import { PaymentModule } from "./payment/payment.module";
import { NotificationsModule } from "./notification/notifications.module";
import { MailModule } from "./mail/mail.module";
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from "path";
import { ProfileModule } from "./profile/profile.module";
import { MarketModule } from "./market/market.module";

@Module({
  imports: [
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', 'uploads'),
      serveRoot: '/uploads',
    }),
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: "postgres",
        host: config.get<string>("DB_HOST"),
        port: config.get<number>("DB_PORT"),
        username: config.get<string>("DB_USERNAME"),
        password: config.get<string>("DB_PASSWORD"),
        database: config.get<string>("DB_DATABASE"),
        autoLoadEntities: true,
        synchronize: false,
        logging: true,
      }),
    }),
    SignalModule,
    CrawlerModule,
    DataImportModule,
    UsersModule,
    PricingModule,
    PaymentModule,
    NotificationsModule,
    MailModule,
    AuthModule,
    ProfileModule,
    MarketModule
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {
  constructor(private dataSource: DataSource) { }
}
