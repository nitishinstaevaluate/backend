import {
    Controller,
    Body,
    UseGuards,
    Put,
    Query,
    Request,
  } from '@nestjs/common';
import { ElevenUaService } from './eleven-ua.service';
import { AuthGuard } from '@nestjs/passport';
import { ElevenUaDTO } from './dto/eleven-ua.dto';
import { utilsService } from 'src/utils/utils.service';
import { KeyCloakAuthGuard } from 'src/middleware/key-cloak-auth-guard';

@Controller('eleven-ua')
export class ElevenUaController {
    constructor(private readonly elevenUaService:ElevenUaService,
      private utilsService: utilsService
      ){}

    @UseGuards(KeyCloakAuthGuard)
    @Put('init-elevenUa-valuation')
    async initElevenUaValuation(
        @Request() req,
        @Body() elevenUaData: ElevenUaDTO,
        @Query('ruleElevenUaId') elevenUaid?: string | undefined
        ) {
      return await this.elevenUaService.upsertProcess(req,elevenUaData,elevenUaid);
    }
}
