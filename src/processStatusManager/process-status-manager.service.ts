import { HttpException, HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import { ProcessManagerDocument } from './schema/process-status-manager.schema';
import { InjectModel } from '@nestjs/mongoose';
import { Model, isValidObjectId } from 'mongoose';
import { isNotEmpty } from 'class-validator';
import { CustomLogger } from 'src/loggerService/logger.service';
import { AuthenticationService } from 'src/authentication/authentication.service';
import { utilsService } from 'src/utils/utils.service';
import { KeyCloakAuthGuard } from 'src/middleware/key-cloak-auth-guard';

@Injectable()
export class ProcessStatusManagerService {
  constructor(@InjectModel('processManager')
  private readonly processModel: Model<ProcessManagerDocument>,
    private logger: CustomLogger,
    private readonly authenticationService: AuthenticationService,
    private readonly utilsService: utilsService) { }

  async upsertProcess(req, process, processId) {
    try {
      let existingRecord, alreadyExistingRecord;

      const { step, uniqueLinkId, ...rest  } = process;

      if(uniqueLinkId){
      const record = await this.processModel.findOne({ uniqueLinkId: uniqueLinkId });

      if(record)
        return {
          processId:record._id,
          status:true,
          msg:"record already exist"
        }
        const maxProcessIdentifierId = await this.utilsService.getMaxObId();

        const KCGuard:any = new KeyCloakAuthGuard();

        const authoriseUser = await KCGuard.fetchAuthUser(req).toPromise();

        if (!authoriseUser.status)
          return authoriseUser;

        const newRecord = await new this.processModel(
          {
            ...rest,
            step: parseInt(step) + 1,
            processIdentifierId: maxProcessIdentifierId + 1,
            userId: authoriseUser.userId,
            uniqueLinkId
          }).save();

        return {
          processId: newRecord.id,
          status: true,
          msg: 'process state created',
        }
    }

      if (processId && isValidObjectId(processId)) {
        alreadyExistingRecord = await this.processModel.findOne({ _id: processId });

        if (process?.thirdStageInput) {
          const modelExists = await this.processModel.exists({
            _id: processId,
            'thirdStageInput.model': { $in: process.thirdStageInput.map((obj) => obj.model) },
          });

          if (modelExists) {
            for await (const obj of process.thirdStageInput) {
              if (obj) {
                try {
                  existingRecord = await this.processModel.updateOne(
                    { _id: processId, 'thirdStageInput.model': obj.model },
                    {
                      $set: {
                        'thirdStageInput.$': obj,
                        step: parseInt(step) + 1,
                      },
                    }
                  );
                } catch (err) {
                  this.logger.log({
                    message: `Third stage creation failed`,
                    error: err,
                    status: false,
                  });
                }
              }
            }
            if (existingRecord.matchedCount === 1) {
              existingRecord = await this.processModel.findOne({ _id: processId });
            }
          }
          else {
            try {

              existingRecord = await this.processModel.findOneAndUpdate(
                { _id: processId },
                {
                  $push: {
                    thirdStageInput: {
                      $each: process.thirdStageInput,
                    },
                  },
                  $set: {
                    step: parseInt(step) + 1,
                  },
                },
                { new: true },
              );
            } catch (err) {
              this.logger.log({
                message: `Third stage insertion failed`,
                error: err,
                status: false
              });
            }
          }

          if (step === 3) {

            const stageOneDetails = existingRecord?.firstStageInput;
            const stageThreeDetails = existingRecord?.thirdStageInput;

            if (stageOneDetails && stageThreeDetails) {
              const orgModels = stageOneDetails.model;

              for await (let thirdStageDetails of stageThreeDetails) {
                const modelExist = orgModels.some((model) => model === thirdStageDetails.model);
                if (!modelExist) {
                  existingRecord = await this.processModel.findOneAndUpdate(
                    { _id: processId },
                    {
                      $pull:
                      {
                        thirdStageInput:
                        {
                          model: `${thirdStageDetails.model}`
                        }
                      }
                    },
                    { new: true }
                    // (err) => {
                    //   if (err) {
                    //     this.logger.log({
                    //       message: `Second stage deletion failed`,
                    //       error: err,
                    //       status: false
                    //     });
                    //   }
                    // }
                  );
                }
              }
            }
          }

          return {
            processId: existingRecord.id,
            status: true,
            msg: 'Process state updated',
          };
        }
        else {
          existingRecord = await this.processModel.findOneAndUpdate(
            { _id: processId },
            {
              $set: {
                ...rest,
                step: parseInt(step) + 1,
              }
            },
            { new: true }
          );

          return {
            processId: existingRecord.id,
            status: true,
            msg: 'process state updated',
          };
        }
      }
      else {
        const maxProcessIdentifierId = await this.utilsService.getMaxObId();

        const KCGuard:any = new KeyCloakAuthGuard();
        const authoriseUser:any = await KCGuard.fetchAuthUser(req).toPromise();

        if (!authoriseUser.status)
          return authoriseUser;

        const newRecord = await new this.processModel(
          {
            ...rest,
            step: parseInt(step) + 1,
            processIdentifierId: maxProcessIdentifierId + 1,
            userId: authoriseUser.userId
          }).save();

        return {
          processId: newRecord.id,
          status: true,
          msg: 'process state created',
        }
      }
    }
    catch (error) {
      this.logger.log({
        message: `Process status manager fail`,
        error: error.message,
        status: false
      });

      return {
        error: error.message,
        status: false,
        msg: 'Process status manager fail'
      }
    }
  }

  async fetchProcess(processId) {
    try {
      const processInfo = await this.processModel.findById({ _id: processId });

      return {
        stateInfo: processInfo,
        status: true,
        msg: 'Process retreive success'
      }
    } catch (error) {
      return {
        error: error.message,
        status: false,
        msg: 'Process retrieve failed'
      }
    }
  }

  async fetchActiveStage(processId) {
    try {
      const processStage = await this.processModel.findById({ _id : processId}).select('step processIdentifierId').exec();
      return {
        data:{
          id:processStage._id,
          processIdentifierId:processStage.processIdentifierId,
          step:processStage.step
        },
        status:true,
        msg:'Retrieve success'
      }
    }
    catch(error) {
      return {
        error: error.message,
        status: false,
        msg: 'Process stage not found'
      }
    }
  }

  async updateActiveStage(processData) {
    try{
      const processStage = await this.processModel.findByIdAndUpdate(
        { _id: processData.processId },
        { step: parseInt(processData.step) },
        { new: true }
      );
      return {
        msg:'stage updated successfully',
        status:true,
        data:{
          id:processStage._id,
          processIdentifierId:processStage.processIdentifierId,
          step:processStage.step
        }
      }

    }
    catch (error) {
      return {
        error:error.message,
        msg:'Update stage fail',
        status:false
      }
    }
  }

  async fetchStageWiseDetails(processId,stage){
    try {
      const processStage = await this.processModel.findById({ _id : processId}).select(`step processIdentifierId ${stage}`).exec();
      return {
        data:processStage,
        status:true,
        msg:'Retrieve success'
      }
    }
    catch(error) {
      return {
        error: error.message,
        status: false,
        msg: 'Process stage wise rerieval failed'
      }
    }
  }

  async getExcelStatus(processStateId){
    try{
      const processStage = await this.processModel.findById({ _id : processStateId}).select(`processIdentifierId firstStageInput`).exec();
      return {
        isExcelModifiedStatus:processStage.firstStageInput?.isExcelModified,
        excelSheetId:processStage.firstStageInput?.modifiedExcelSheetId || processStage.firstStageInput?.excelSheetId,
        status:true,
        processIdentifierId:processStage.processIdentifierId,
        msg:'excel status retrieve success'
      }
    }
    catch(error){
      throw new HttpException(
        {
          error: error,
          status: false,
          msg: 'excel status not found',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async updateEditedExcelStatus(processState){
    try{
      const stateOne = await this.processModel.findById({ _id : processState.processStateId}).select(`processIdentifierId firstStageInput`).exec();

      const createEditedExcelId = `edited-${stateOne.firstStageInput?.excelSheetId}`;

      if(stateOne.firstStageInput.isExcelModified){
        return {
          isExcelModifiedStatus:stateOne.firstStageInput?.isExcelModified,
          modifiedExcelSheetId:createEditedExcelId,
          processIdentifierId:stateOne.processIdentifierId,
          status:true,
          msg:'excel status already updated successfully'
        }
      }

      const processStage = await this.processModel.findByIdAndUpdate(
        processState.processStateId,
        { 
          $set: { 
          'firstStageInput.isExcelModified': true,
          'firstStageInput.modifiedExcelSheetId':createEditedExcelId
          }
        },
        { new: true }
    );
    
      return {
        isExcelModifiedStatus:processStage.firstStageInput?.isExcelModified,
        modifiedExcelSheetId:createEditedExcelId,
        processIdentifierId:processStage.processIdentifierId,
        status:true,
        msg:'excel status updated successfully'
      }
    }
    catch(error){
      throw new HttpException(
        {
          error: error,
          status: false,
          msg: 'excel id not found',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async getProcessIdentifierId(idDetails){
    try{
      return this.processModel.findOne({_id: idDetails.obId}).select('processIdentifierId').exec();
    }
    catch(error){
      throw new HttpException(
        {
          error: error,
          status: false,
          msg: 'fetch process-id failed',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
