import {
    Body,
      Controller,
      Get,
      Param,
      Query,
      Put,
      UseGuards,
      Request,
      ParseIntPipe,
      Post,
      Req
    } from '@nestjs/common';
import { ProcessStatusManagerService } from '../service/process-status-manager.service';
import { AuthGuard } from '@nestjs/passport';
import { ProcessStatusManagerDTO } from '../dto/process-status-manager.dto';
import { utilsService } from 'src/utils/utils.service';
import { KeyCloakAuthGuard } from 'src/middleware/key-cloak-auth-guard';
import { Roles } from 'src/middleware/decorator/roles.decorator';

@Controller('process-status-manager')
export class ProcessStatusManagerController {
    constructor(private processStatusManagerService:ProcessStatusManagerService,
      private readonly utilsService:utilsService){}

    @UseGuards(KeyCloakAuthGuard)
    @Put('instantiateProcess')
    async upsertProcessState(
        @Request() req,
        @Body() process: ProcessStatusManagerDTO,
        @Query('processId') processId?: string
        ) {
      return await this.processStatusManagerService.upsertProcess(req,process,processId);
    }

    @UseGuards(KeyCloakAuthGuard)
    @Get('retrieveProcess/:processId')
    async fetchProcessState(
        @Param('processId') processId?: string
        ) {
      return await this.processStatusManagerService.fetchProcess(processId);
    }

    @UseGuards(KeyCloakAuthGuard)
    @Get('retrieveStage/:processId')
    async fetchActiveStage(
        @Param('processId') processId?: string
        ) {
      return await this.processStatusManagerService.fetchActiveStage(processId);
    }
    
    @UseGuards(KeyCloakAuthGuard)
    @Put('updateStage')
    async updateActiveStage(
      @Body() processStage:any
        ) {
      return await this.processStatusManagerService.updateActiveStage(processStage);
    }

    // @UseGuards(KeyCloakAuthGuard)
    @UseGuards(KeyCloakAuthGuard)
    // @Roles('account_owner')
    @Get('paginate')
    async getPaginatedValuations(
      @Request() req,
      @Query('page', ParseIntPipe) page: number = 1,
      @Query('pageSize', ParseIntPipe) pageSize: number = 10,
      @Query('query') query: string | undefined
    ) :Promise<any>{
      return this.utilsService.paginateValuationByUserId(page,pageSize, req,query);
    }

    @UseGuards(KeyCloakAuthGuard)
    @Get('retrieve-particular-stage/filter')
    async getStageWiseDetails(
        @Query('processId') processId?: string,
        @Query('stageDetails') stageDetails?: string,
        ) {
      return await this.processStatusManagerService.fetchStageWiseDetails(processId, stageDetails);
    }

    @UseGuards(KeyCloakAuthGuard)
    @Get('excel-status/:processStateId')
    async fetchExcelStatus(
      @Param('processStateId') processStateId: string,
    ) {
      return await this.processStatusManagerService.getExcelStatus(processStateId);
    }

    @UseGuards(KeyCloakAuthGuard)
    @Put('update-edited-excel-status/:processStateId')
    async updateEditedExcelStatus(
      @Param() processStateId:any
        ) {
      return await this.processStatusManagerService.updateEditedExcelStatus(processStateId);
    }

    @UseGuards(KeyCloakAuthGuard)
    @Get('fetch-process-identifier-id/:obId')
    async fetchProcessIdentifierId(@Param() obId: any){
      return await this.processStatusManagerService.getProcessIdentifierId(obId);
    }

    @UseGuards(KeyCloakAuthGuard)
    @Post('clone-lead')
    async cloneLead(@Body() payload: any, @Req() request:any){
      return await this.processStatusManagerService.createClone(payload, request);
    }
}