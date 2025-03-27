import { Module } from '@nestjs/common';
import { ProcessStatusManagerService } from './service/process-status-manager.service';
import { CustomLogger } from 'src/loggerService/logger.service';
import { ProcessStatusManagerController } from './controller/process-status-manager.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { ProcessManagerSchema } from './schema/process-status-manager.schema';
import { AuthenticationService } from 'src/authentication/authentication.service';
import { AuthenticationModule } from 'src/authentication/authentication.module';
import { JwtModule } from '@nestjs/jwt';
import { UsersModule } from 'src/users/users.module';
import { utilsService } from 'src/utils/utils.service';
import { ValuationSchema } from 'src/valuationProcess/schema/valuation.schema';
import { DataCheckListSchema } from 'src/utils/schema/dataCheckList.schema';
import { MandateSchema } from 'src/utils/schema/mandate.schema';
import { ValuationsService } from 'src/valuationProcess/valuationProcess.service';
import { FieldValidationSchema } from './schema/field-validation.shema';
import { FieldValidationService } from './service/field-validation.service';
import { FieldValidationController } from './controller/field-validation.controller';
require('dotenv').config();

@Module({
  providers: [ProcessStatusManagerService,CustomLogger,AuthenticationService,utilsService, ValuationsService, FieldValidationService],
  controllers: [ProcessStatusManagerController, FieldValidationController],
  imports:[
    MongooseModule.forFeature([
      { name: 'processManager', schema: ProcessManagerSchema },
      { name: 'fieldValidation', schema: FieldValidationSchema },
    ]),
    MongooseModule.forFeature([
      { name: 'valuation', schema: ValuationSchema },
      { name: 'dataChecklist', schema: DataCheckListSchema },
      { name: 'mandate', schema: MandateSchema }
    ]),
    AuthenticationModule,
    UsersModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET,
      signOptions: { expiresIn: '24h' },
    })
  ],
  exports:[ProcessStatusManagerService]
})
export class ProcessStatusManagerModule {}
