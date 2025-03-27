import { Body, Controller, Get, Param, Post, Put, Query, Req, UseGuards, UsePipes, ValidationPipe } from '@nestjs/common';
import { CiqSpService } from './ciq-sp.service';
import { AuthGuard } from '@nestjs/passport';
import { betaWorkingDto, ciqGetCompanyMeanMedianDto, ciqGetFinancialDto, ciqGetMarketBetaDto, ciqGetStockBetaDto } from './dto/ciq-sp.dto';
import { axiosInstance } from 'src/middleware/axiosConfig';
import { CIQ_ELASTIC_SEARCH_CRITERIA } from 'src/library/interfaces/api-endpoints.local';
import { KeyCloakAuthGuard } from 'src/middleware/key-cloak-auth-guard';

@Controller('ciq-sp')
export class CiqSpController {

    constructor(private capitalIqAndSPService: CiqSpService){}
    
  // https://localhost:3000/ciq-sp/hierarchy-based-industry-list
  @UseGuards(KeyCloakAuthGuard)
  @Get('hierarchy-based-industry-list')
  async getSPHierarchyBasedIndustry() {
    return this.capitalIqAndSPService.fetchSPHierarchyBasedIndustry();
  }

  // https://localhost:3000/ciq-sp/sp-industry-list
  @UseGuards(KeyCloakAuthGuard)
  @Get('sp-industry-list')
  async getAllSPIndustry() {
    return this.capitalIqAndSPService.fetchAllSPIndustry();
  }

  // https://localhost:3000/ciq-sp/sp-industry-list/search?
  @UseGuards(KeyCloakAuthGuard)
  @Get('sp-industry-list/search')
  async getSPIndustryListByName(
    @Query('industry') industry: string,
    @Query('location') location: string,
  ) {
    return this.capitalIqAndSPService.fetchSPIndustryListByName(industry,location);
  }

  // https://localhost:3000/ciq-sp/hierarchy-based-level-four-industry/:descriptor
  @UseGuards(KeyCloakAuthGuard)
  @Get('hierarchy-based-level-four-industry/:descriptor')
  async getSPLevelFourIndustryBasedList(
    @Param('descriptor') descriptor: string,
  ) {
    return this.capitalIqAndSPService.fetchSPLevelFourIndustryBasedList(descriptor);
  }

  // https://localhost:3000/ciq-sp/sp-level-four-industry-list
  @UseGuards(KeyCloakAuthGuard)
  @Post('sp-level-four-industry-list')
  async getSPIndustryListByLevelFourIndustries(@Body() levelFourIndustry:any, @Req() req) {
    // return this.capitalIqAndSPService.fetchSPIndustryListByLevelFourIndustries(levelFourIndustry);
    return this.capitalIqAndSPService.fetchListedCompanyListDetails(levelFourIndustry, req);
  }

  // https://localhost:3000/ciq-sp/sp-company-status-type
  @UseGuards(KeyCloakAuthGuard)
  @Get('sp-company-status-type')
  async getSPCompanyStatusType() {
    return this.capitalIqAndSPService.fetchSPCompanyStatusType();
  }

  // https://localhost:3000/ciq-sp/sp-company-type
  @UseGuards(KeyCloakAuthGuard)
  @Get('sp-company-type')
  async getSPCompanyType() {
    return this.capitalIqAndSPService.fetchSPCompanyType();
  }

  // https://localhost:3000/ciq-sp/calculate-sp-beta-aggregate
  @UseGuards(KeyCloakAuthGuard)
  @Post('calculate-sp-beta-aggregate')
  async calculateSpBetaAggregate(@Body(ValidationPipe) payload: ciqGetMarketBetaDto) {
    return this.capitalIqAndSPService.calculateBetaAggregate(payload)
  }

  // https://localhost:3000/ciq-sp/calculate-sp-stock-beta
  @UseGuards(KeyCloakAuthGuard)
  @Post('calculate-sp-stock-beta')
  async calculateSpStockBeta(@Body(ValidationPipe) payload: ciqGetStockBetaDto) {
    return this.capitalIqAndSPService.calculateStockBeta(payload)
  }

  // https://localhost:3000/ciq-sp/calculate-sp-companies-mean-median
  @UseGuards(KeyCloakAuthGuard)
  @Post('calculate-sp-companies-mean-median')
  async calculateSPCompaniesMeanMedianRatio(@Body(ValidationPipe) payload: ciqGetCompanyMeanMedianDto) {
    return this.capitalIqAndSPService.calculateCompaniesMeanMedianRatio(payload)
  }

  // https://localhost:3000/ciq-sp/calculate-sp-financial-data
  @UseGuards(KeyCloakAuthGuard)
  @Post('calculate-sp-financial-data')
  async calculateSPFinancialData(@Body(ValidationPipe) payload: ciqGetFinancialDto) {
    return this.capitalIqAndSPService.calculateFinancialData(payload)
  }

  // https://localhost:3000/ciq-sp/beta-working
  @UseGuards(KeyCloakAuthGuard)
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true}))
  @Put('beta-working')
  async upsertBetaWorking(@Body() payload: betaWorkingDto) {
    return this.capitalIqAndSPService.upsertBetaWorking(payload)
  }

  // https://localhost:3000/ciq-sp/fetch-beta-working
  @UseGuards(KeyCloakAuthGuard)
  @Get('fetch-beta-working/:processId')
  async fetchBetaWorking(@Param() processId: any) {
    return this.capitalIqAndSPService.getBetaWorking(processId);
  }

  // https://localhost:3000/ciq-sp/clone-beta-working
  @UseGuards(KeyCloakAuthGuard)
  @Post('clone-beta-working')
  async replicateBetaWorking(@Body() payload: any) {
    return this.capitalIqAndSPService.cloneBetaWorking(payload);
  }
}