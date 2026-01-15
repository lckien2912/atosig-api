import { Controller, Post, Body } from '@nestjs/common';
import { CrawlerService } from './crawler.service';

@Controller('crawler')
export class CrawlerController {
    constructor(private readonly crawlerService: CrawlerService) { }

    @Post('test-price')
    async testPrice(@Body() body: { symbol: string, price: number }) {
        return this.crawlerService.testManualTrigger(body.symbol, body.price);
    }
}