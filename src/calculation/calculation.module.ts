import { Module } from '@nestjs/common';
import { CalculationController,WaccController } from './calculation.controller';
import { CalculationService } from './calculation.service';
import { LoggerModule } from 'src/loggerService/logger.module';
import { MongooseModule } from '@nestjs/mongoose';
import { RiskFreeRateSchema } from 'src/masters/schema/masters.schema';
import { HistoricalReturnsSchema, HistoricalBSE500ReturnsSchema, HistoricalBankNiftyReturnsSchema, HistoricalNifty50ReturnsSchema, HistoricalSensex30ReturnsSchema } from 'src/data-references/schema/data-references.schema';
import { HistoricalReturnsService } from 'src/data-references/data-references.service';
import { thirdpartyApiAggregateService } from 'src/library/thirdparty-api/thirdparty-api-aggregate.service';
import { ValuationProcessModule } from 'src/valuationProcess/valuationProcess.module';
import { FCFEAndFCFFService } from 'src/valuationProcess/fcfeAndFCFF.service';
import { IndustryModule } from 'src/industry/industry.module';
import { ProcessStatusManagerModule } from 'src/processStatusManager/process-status-manager.module';
import { SensitivityAnalysisModule } from 'src/sensitivity-analysis/sensitivity-analysis.module';
import { SensitivityAnalysisService } from 'src/sensitivity-analysis/service/sensitivity-analysis.service';
import { AuthenticationModule } from 'src/authentication/authentication.module';
import { ExcelArchiveModule } from 'src/excel-archive/excel-archive.module';
import { sensitivityAnalysisSchema } from 'src/sensitivity-analysis/schema/sensitivity-analysis.schema';

@Module({
  imports:[LoggerModule,
  MongooseModule.forFeature([ { name: 'riskFreeRate', schema: RiskFreeRateSchema },
  { name: 'historicalReturns', schema : HistoricalReturnsSchema},
  { name: 'historicalBSE500Returns', schema : HistoricalBSE500ReturnsSchema},
  { name: 'historicalBankNiftyReturns', schema : HistoricalBankNiftyReturnsSchema},
  { name: 'historicalSensex30Returns', schema : HistoricalSensex30ReturnsSchema},
  { name: 'historicalNifty50Returns', schema : HistoricalNifty50ReturnsSchema},
  { name: 'sensitivityanalysis', schema: sensitivityAnalysisSchema }],),
  ValuationProcessModule,
  IndustryModule,
  ProcessStatusManagerModule,
  SensitivityAnalysisModule,
  AuthenticationModule,
  ExcelArchiveModule
],
  controllers: [CalculationController,WaccController],
  providers: [CalculationService,HistoricalReturnsService, thirdpartyApiAggregateService, FCFEAndFCFFService, SensitivityAnalysisService],
  exports:[CalculationService]
})
export class CalculationModule {}
