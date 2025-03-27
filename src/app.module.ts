import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthenticationModule } from './authentication/authentication.module';
import { ConfigModule } from '@nestjs/config';
import { UsersModule } from './users/users.module';
import { MastersModule } from './masters/masters.module';
import { ExportResultsModule } from './exportResults/exportResults.module';
import { ValuationProcessModule } from './valuationProcess/valuationProcess.module';
import { CorsMiddleware } from './middleware/CorsMiddleware';
import { UploadController } from './excelFileServices/uploadExcel.controller';
import { IndustryModule } from './industry/industry.module';
import { ExportTemplateController } from './excelFileServices/exportTemplate.controller';
import {LoggerModule} from './loggerService/logger.module'
import { ExceptionsFilter } from './middleware/exceptions.middleware';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { DataReferencesModule } from './data-references/data-references.module';
import { CalculationModule } from './calculation//calculation.module';
import { ExcelSheetService } from './excelFileServices/uploadExcel.service';
import { ReportModule } from './report/report.module';
import { ProcessStatusManagerModule } from './processStatusManager/process-status-manager.module';
import { CiqSpModule } from './ciq-sp/ciq-sp.module';
import { ElevenUaModule } from './elevenUA/eleven-ua.module';
import { UtilsModule } from './utils/utils.module';
import { CiqElasticSearchModule } from './ciq-elastic-search/ciq-elastic-search.module';
import { ContactSalesModule } from './contact-sales/contact-sales.module';
import { FuseSearchModule } from './fuse-search/fuse-search.module';
import { EmailModule } from './email/email.module';
import { thirdpartyApiAggregateService } from './library/thirdparty-api/thirdparty-api-aggregate.service';
import { KeyCloakAuthGuard } from './middleware/key-cloak-auth-guard';
import { ExcelArchiveModule } from './excel-archive/excel-archive.module';
import { SensitivityAnalysisModule } from './sensitivity-analysis/sensitivity-analysis.module';
import { StartUpValuationModule } from './startup-valuations/start-up-valuation.module';
require('dotenv').config();

@Module({
  imports: [
    UsersModule,
    MastersModule,
    ValuationProcessModule,
    ExportResultsModule,
    AuthenticationModule,
    IndustryModule,
    LoggerModule,
    DataReferencesModule,
    CalculationModule,
    ReportModule,
    ProcessStatusManagerModule,
    ElevenUaModule,
    CiqSpModule,
    UtilsModule,
    CiqElasticSearchModule,
    ContactSalesModule,
    FuseSearchModule,
    EmailModule,
    ExcelArchiveModule,
    SensitivityAnalysisModule,
    StartUpValuationModule,
    ConfigModule.forRoot(),
    MongooseModule.forRoot(process.env.DBCONN),
  ],
  controllers: [
    AppController,
    UploadController,
    ExportTemplateController
  ], //ImportController
  providers: [
    AppService,
    ExcelSheetService,
    thirdpartyApiAggregateService,
    KeyCloakAuthGuard
  ],//ImportService
})
export class AppModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(CorsMiddleware)
      .forRoutes('*');
  }
}
