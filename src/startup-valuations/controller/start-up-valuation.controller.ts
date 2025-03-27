import { Body, Controller, Post, UseGuards, UsePipes, ValidationPipe } from '@nestjs/common';
import { KeyCloakAuthGuard } from 'src/middleware/key-cloak-auth-guard';
import { FieldValidationDto } from 'src/processStatusManager/dto/field-validation.dto';
import { StartUpValuationService } from '../service/start-up-valuation.service';
import { StartupValuationDto } from '../dto/startup-valuation.dto';

@Controller('start-up-valuation')
export class StartUpValuationController {
    constructor(private startUpValuationService: StartUpValuationService){}

    @UseGuards(KeyCloakAuthGuard)
    @UsePipes(new ValidationPipe({ transform: true, whitelist: true}))
    @Post('upsert')
    async upsertProcessState(@Body() payload: StartupValuationDto) {
      return await this.startUpValuationService.upsertValuation(payload);
    }
}
