import {
    Controller,
    Get,
    Post,
    Body,
    Patch,
    Param,
    Delete,
} from '@nestjs/common';
import { SignalService } from './signal.service';
import { CreateSignalDto } from './dto/create-signal.dto';
import { UpdateSignalDto } from './dto/update-signal.dto';

@Controller('signals')
export class SignalController {
    constructor(private readonly signalService: SignalService) { }

    @Post()
    create(@Body() createSignalDto: CreateSignalDto) {
        return this.signalService.create(createSignalDto);
    }

    @Get()
    findAll() {
        return this.signalService.findAll();
    }

    @Get(':id')
    findOne(@Param('id') id: string) {
        return this.signalService.findOne(+id);
    }

    @Patch(':id')
    update(@Param('id') id: string, @Body() updateSignalDto: UpdateSignalDto) {
        return this.signalService.update(+id, updateSignalDto);
    }

    @Delete(':id')
    remove(@Param('id') id: string) {
        return this.signalService.remove(+id);
    }
}
