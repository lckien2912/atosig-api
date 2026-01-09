import { Controller, Get, Param } from "@nestjs/common";
import { SignalService } from "./signal.service";

@Controller("signals")
export class SignalController {
  constructor(private readonly signalService: SignalService) {}

  @Get("featured")
  getFeatured() {
    return this.signalService.getFeatured();
  }

  @Get("current")
  getCurrent() {
    return this.signalService.getCurrent();
  }

  @Get("history")
  getHistory() {
    return this.signalService.getHistory();
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.signalService.findOne(id);
  }
}
