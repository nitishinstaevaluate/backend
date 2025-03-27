import { Body, Controller, Put, UseGuards, UsePipes, ValidationPipe } from '@nestjs/common';
import { ExcelArchiveService } from '../service/excel-archive.service';
import { KeyCloakAuthGuard } from 'src/middleware/key-cloak-auth-guard';
import { ExcelArchiveDto } from '../dto/excel-archive.dto';

@Controller('excel-archive')
export class ExcelArchiveController {
    constructor(private readonly excelArchiveService: ExcelArchiveService){}

    // https://localhost:3000/excel-archive/upsert-excel
    @UseGuards(KeyCloakAuthGuard)
    @UsePipes(new ValidationPipe({ transform: true, whitelist: true}))
    @Put('upsert-excel')
    async upsertBetaWorking(@Body() payload: ExcelArchiveDto) {
        return this.excelArchiveService.upsertExcel(payload)
    }
}
