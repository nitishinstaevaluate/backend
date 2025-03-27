import { Module } from '@nestjs/common';
import { SensitivityAnalysisService } from './service/sensitivity-analysis.service';
import { MongooseModule } from '@nestjs/mongoose';
import { sensitivityAnalysisSchema } from './schema/sensitivity-analysis.schema';
import { ValuationsService } from 'src/valuationProcess/valuationProcess.service';
import { ValuationSchema } from 'src/valuationProcess/schema/valuation.schema';
import { ProcessStatusManagerService } from 'src/processStatusManager/service/process-status-manager.service';
import { ProcessManagerSchema } from 'src/processStatusManager/schema/process-status-manager.schema';
import { utilsService } from 'src/utils/utils.service';
import { CustomLogger } from 'src/loggerService/logger.service';
import { AuthenticationService } from 'src/authentication/authentication.service';
import { UsersModule } from 'src/users/users.module';
import { JwtModule } from '@nestjs/jwt';
import { DataCheckListSchema } from 'src/utils/schema/dataCheckList.schema';
import { MandateSchema } from 'src/utils/schema/mandate.schema';
import { SensitivityAnalysisController } from './controller/sensitivity-analysis.controller';
import { ProcessStatusManagerModule } from 'src/processStatusManager/process-status-manager.module';
import { FieldValidationService } from 'src/processStatusManager/service/field-validation.service';
import { FieldValidationSchema } from 'src/processStatusManager/schema/field-validation.shema';

@Module({
  providers: [SensitivityAnalysisService, ValuationsService, ProcessStatusManagerService, CustomLogger, AuthenticationService, utilsService, FieldValidationService],
  imports:[MongooseModule.forFeature(
    [
        { name: 'sensitivityanalysis', schema: sensitivityAnalysisSchema },
        { name: 'valuation', schema: ValuationSchema },
        { name: 'processManager', schema: ProcessManagerSchema },
        { name: 'dataChecklist', schema: DataCheckListSchema },
        { name: 'mandate', schema: MandateSchema },
        { name: 'fieldValidation', schema: FieldValidationSchema },
    ]),
    UsersModule,
    JwtModule.register({
        secret: process.env.JWT_SECRET,
        signOptions: { expiresIn: '24h' },
      })],
      controllers:[SensitivityAnalysisController]
})
export class SensitivityAnalysisModule {}
