import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { MarketController } from './market.controller';
import { MarketService } from './market.service';

@Module({
    imports: [
        HttpModule,
        ConfigModule
    ],
    controllers: [MarketController],
    providers: [MarketService],
    exports: [MarketService]
})
export class MarketModule { }