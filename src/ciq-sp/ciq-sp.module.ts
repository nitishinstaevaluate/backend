import { Module } from '@nestjs/common';
import { CiqSpService } from '../ciq-sp/ciq-sp.service';
import { CiqSpController } from './ciq-sp.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { SnowflakeClientServiceService } from 'src/snowflake/snowflake-client-service.service';
import { ciqsimpleindustrySchema, ciqindustryhierarchySchema, ciqcompanystatustypeSchema, ciqcompanytypeSchema, BetaWorkingSchema } from './schema/ciq-sp.chema';
import { ProcessStatusManagerService } from 'src/processStatusManager/service/process-status-manager.service';
import { ProcessStatusManagerModule } from 'src/processStatusManager/process-status-manager.module';
import { AuthenticationService } from 'src/authentication/authentication.service';
import { CustomLogger } from 'src/loggerService/logger.service';
import { utilsService } from 'src/utils/utils.service';
import { AuthenticationModule } from 'src/authentication/authentication.module';
import { UsersModule } from 'src/users/users.module';
import { ProcessManagerSchema } from 'src/processStatusManager/schema/process-status-manager.schema';
import { JwtModule } from '@nestjs/jwt';
import { ValuationSchema } from 'src/valuationProcess/schema/valuation.schema';
import { CiqSpFinancialService } from './ciq-sp-financial.service';
import { ciqSpBetaService } from './ciq-sp-beta.service';
import { ciqSpCompanyMeanMedianService } from './ciq-sp-company-mean-median.service';
import { HistoricalBSE500ReturnsSchema, HistoricalBankNiftyReturnsSchema, HistoricalNifty50ReturnsSchema, HistoricalReturnsSchema, HistoricalSensex30ReturnsSchema } from 'src/data-references/schema/data-references.schema';
import { HistoricalReturnsService } from 'src/data-references/data-references.service';
import { DataCheckListSchema } from 'src/utils/schema/dataCheckList.schema';
import { MandateSchema } from 'src/utils/schema/mandate.schema';
import { ValuationsService } from 'src/valuationProcess/valuationProcess.service';
import { FieldValidationSchema } from 'src/processStatusManager/schema/field-validation.shema';
import { FieldValidationService } from 'src/processStatusManager/service/field-validation.service';

@Module({
  providers: [CiqSpService,SnowflakeClientServiceService,ProcessStatusManagerService,CustomLogger,AuthenticationService,utilsService, CiqSpFinancialService, ciqSpBetaService, ciqSpCompanyMeanMedianService, HistoricalReturnsService, ValuationsService, FieldValidationService],
  controllers: [CiqSpController],
  imports:[MongooseModule.forFeature([
    {name: 'ciqsimpleindustry', schema : ciqsimpleindustrySchema},
    {name: 'ciqindustryhierarchy', schema : ciqindustryhierarchySchema},
    {name:'ciqcompanystatustype', schema : ciqcompanystatustypeSchema},
    {name:'ciqcompanytype', schema : ciqcompanytypeSchema},
    {name: 'processManager', schema: ProcessManagerSchema},
    {name: 'valuation', schema: ValuationSchema},
    { name: 'historicalBSE500Returns', schema : HistoricalBSE500ReturnsSchema},
    { name: 'historicalBankNiftyReturns', schema : HistoricalBankNiftyReturnsSchema},
    { name: 'historicalSensex30Returns', schema : HistoricalSensex30ReturnsSchema},
    { name: 'historicalNifty50Returns', schema : HistoricalNifty50ReturnsSchema},
    { name: 'historicalReturns', schema : HistoricalReturnsSchema},
    { name: 'dataChecklist', schema: DataCheckListSchema },
    { name: 'mandate', schema: MandateSchema },
    { name: 'betaWorking', schema: BetaWorkingSchema },
    { name: 'fieldValidation', schema: FieldValidationSchema },
  ]),
  ProcessStatusManagerModule,
  AuthenticationModule,
  UsersModule,
  JwtModule.register({
    secret: process.env.JWT_SECRET,
    signOptions: { expiresIn: '24h' },
  })]
})
export class CiqSpModule {}