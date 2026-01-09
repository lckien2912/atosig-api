import {
    Controller,
    Post,
    UseInterceptors,
    UploadedFile,
    BadRequestException,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { DataImportService } from "./data-import.service";
import { ApiConsumes, ApiBody } from "@nestjs/swagger";

@Controller("import")
export class DataImportController {
    constructor(private readonly dataImportService: DataImportService) { }

    @Post("signals")
    @UseInterceptors(FileInterceptor("file"))
    @ApiConsumes("multipart/form-data")
    @ApiBody({
        schema: {
            type: "object",
            properties: {
                file: {
                    type: "string",
                    format: "binary",
                },
            },
        },
    })
    async uploadCsv(@UploadedFile() file: Express.Multer.File) {
        if (!file) {
            throw new BadRequestException('File is required (param name: "file")');
        }
        await this.dataImportService.importCsv(file.buffer);
        return { message: "CSV imported successfully" };
    }
}
