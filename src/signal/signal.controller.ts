import { Controller, Get, Param, Query } from "@nestjs/common";
import { SignalService } from "./signal.service";

@Controller("signals")
export class SignalController {
    constructor(private readonly signalService: SignalService) { }

    @Get()
    findAll(
        @Query("page") page: number = 1,
        @Query("limit") limit: number = 10,
        @Query("duration") duration?: string,
    ) {
        return this.signalService.findAll({ page, limit, duration });
    }

    @Get(":id")
    findOne(@Param("id") id: string) {
        return this.signalService.findOne(id);
    }
}
