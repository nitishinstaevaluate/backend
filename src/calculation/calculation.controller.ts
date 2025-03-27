import { Controller,Get,Put,Post,Param, Query , Body, UseGuards, UsePipes, ValidationPipe} from '@nestjs/common';
import { CalculationService} from './calculation.service';

import { valuationWeightage, WaccDTO } from "./dto/calculation.dto";
import { AuthGuard } from '@nestjs/passport';
import { KeyCloakAuthGuard } from 'src/middleware/key-cloak-auth-guard';

@Controller('calculation')
export class CalculationController {
  constructor(private calculationService: CalculationService) { }

  @UseGuards(KeyCloakAuthGuard)
  @Post('/weightedvaluation')
  createPost(@Body() body: valuationWeightage) {
    return this.calculationService.calculateWeightedVal(body);
  }

  @UseGuards(KeyCloakAuthGuard)
  @Get('risk-free-rate/:maturityYears/:date')
  async calculateRiskFreeRate(
    @Param('maturityYears') maturityYears: string,
    @Param('date') date: string,
    ) {
    return await this.calculationService.calculateRiskFreeRate(maturityYears, date)
  }
}



//Beta Industries Controller
@Controller('coe')
export class WaccController {
  constructor(private calculationService: CalculationService) { }

  @UseGuards(KeyCloakAuthGuard)
  @Post('/adjcoe')
  async calculateAdjCoe(@Body() payload:any
  ): Promise<any> {
    return this.calculationService.adjCOE(payload);
  }

  @UseGuards(KeyCloakAuthGuard)
  @Get('/wacc')
  async findByID(
    @Query('adjustedCostOfEquity') adjustedCostOfEquity: string,
    @Query('equityProp') equityProp: string,
    @Query('costOfDebt') costOfDebt: string,
    @Query('taxRate') taxRate: string,
    @Query('debtProp') debtProp: string,
    @Query('copShareCapital') copShareCapital: string,
    @Query('prefProp') prefProp: string,
    @Query('coeMethod') coeMethod: string,
    ): Promise<any> {
    return this.calculationService.getWACC(parseFloat(adjustedCostOfEquity),parseFloat(equityProp),
    parseFloat(costOfDebt),
    parseFloat(taxRate),
    parseFloat(debtProp),
    parseFloat(copShareCapital),
    parseFloat(prefProp),
    coeMethod)
  } 
  
  @UseGuards(KeyCloakAuthGuard)
  @Post('/industryOrCompanyBasedWacc')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true}))
  async calculateWacc(@Body(ValidationPipe) payload:WaccDTO) {
    return this.calculationService.getWaccExcptTargetCapStrc(payload)
  } 

}