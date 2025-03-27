import { Module, forwardRef } from '@nestjs/common';
import { ElevenUaService } from './eleven-ua.service';
import { ElevenUaController } from './eleven-ua.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { ElevenUaSchema } from './schema/eleven-ua.schema';
import { ExcelSheetService } from 'src/excelFileServices/uploadExcel.service';
import { ValuationsService } from 'src/valuationProcess/valuationProcess.service';
import { FCFEAndFCFFService } from 'src/valuationProcess/fcfeAndFCFF.service';
import { ValuationSchema } from 'src/valuationProcess/schema/valuation.schema';
import { IndustryService } from 'src/industry/industry.service';
import { CustomLogger } from 'src/loggerService/logger.service';
import { AuthenticationService } from 'src/authentication/authentication.service';
import { UsersService } from 'src/users/users.service';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { AuthenticationModule } from 'src/authentication/authentication.module';
import { UsersModule } from 'src/users/users.module';
import { utilsService } from 'src/utils/utils.service';
import { ProcessManagerSchema } from 'src/processStatusManager/schema/process-status-manager.schema';
import { DataCheckListSchema } from 'src/utils/schema/dataCheckList.schema';
import { MandateSchema } from 'src/utils/schema/mandate.schema';
import { thirdpartyApiAggregateService } from 'src/library/thirdparty-api/thirdparty-api-aggregate.service';
import { authenticationTokenSchema } from 'src/authentication/schema/authentication-token.schema';
import { ValuationProcessModule } from 'src/valuationProcess/valuationProcess.module';
import { ProcessStatusManagerModule } from 'src/processStatusManager/process-status-manager.module';
import { ReportModule } from 'src/report/report.module';
import { authenticationTokenService } from 'src/authentication/authentication-token.service';
import { SensitivityAnalysisService } from 'src/sensitivity-analysis/service/sensitivity-analysis.service';
import { sensitivityAnalysisSchema } from 'src/sensitivity-analysis/schema/sensitivity-analysis.schema';
import { ExcelArchiveService } from 'src/excel-archive/service/excel-archive.service';
import { ExcelArchiveSchema } from 'src/excel-archive/schema/excel-archive.schema';
import { CalculationModule } from 'src/calculation/calculation.module';

@Module({
  providers: [
    ElevenUaService,
    ExcelSheetService,
    ValuationsService,
    FCFEAndFCFFService,
    IndustryService,
    CustomLogger,
    AuthenticationService, 
    utilsService, 
    thirdpartyApiAggregateService, 
    authenticationTokenService, 
    SensitivityAnalysisService,
    ExcelArchiveService
  ],
  controllers: [ElevenUaController],
  imports:[MongooseModule.forFeature([
    { name:'ruleelevenua',schema:ElevenUaSchema },
    { name: 'valuation', schema: ValuationSchema },
    { name: 'processManager', schema: ProcessManagerSchema },
    { name: 'dataChecklist', schema: DataCheckListSchema },
    { name: 'mandate', schema: MandateSchema },
    { name: 'token', schema: authenticationTokenSchema },
    { name: 'excelArchive', schema: ExcelArchiveSchema },
    { name: 'sensitivityanalysis', schema: sensitivityAnalysisSchema }
  ]),
  UsersModule,
  ValuationProcessModule,
  ProcessStatusManagerModule,
  CalculationModule,
  forwardRef(() => ReportModule),
  JwtModule.register({
    secret: process.env.JWT_SECRET,
    signOptions: { expiresIn: '24h' },
  })
],
exports:[ElevenUaService]
})
export class ElevenUaModule {}
