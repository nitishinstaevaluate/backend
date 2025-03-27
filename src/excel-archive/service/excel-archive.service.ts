import { Injectable, NotFoundException } from '@nestjs/common';
import { ExcelArchiveDocument } from '../schema/excel-archive.schema';
import { Model } from 'mongoose';
import { InjectModel } from '@nestjs/mongoose';
import { catchError } from 'rxjs';
import { ExcelArchiveDto } from '../dto/excel-archive.dto';

@Injectable()
export class ExcelArchiveService {
    constructor(@InjectModel('excelArchive')
    private readonly excelArchiveModel: Model<ExcelArchiveDocument>){}

    async upsertExcel(payload){
        try{
            const id = payload?.processStateId;
            const {sheetUploaded, ...rest} = payload;
            if(id){
                const excelArchiveExist = await this.excelArchiveModel.findOne({processStateId: id});
                if(excelArchiveExist){
                    return await this.excelArchiveModel.findOneAndUpdate(
                        { processStateId: id },
                        {
                          $set: {
                            ...rest,
                            modifiedOn: new Date()
                          },
                          $push: {
                            sheetUploaded: {
                              $each: [sheetUploaded],
                            }
                          },
                        },
                        { new:true }
                    ).exec();
                }
                else{
                    return await new this.excelArchiveModel(payload).save();
                }
            }
            else{
                throw new NotFoundException({msg:'Record not found', status:false, description:"Id found to be incorrect"})
            }
        }
        catch(error){
            throw error;
        }
    }

    async fetchExcelByProcessStateId(id){
        try{
            if(id){
                const excelArchiveExist = await this.excelArchiveModel.findOne({processStateId: id});
                if(excelArchiveExist){
                    return excelArchiveExist;
                }
                else{
                    return false;
                }
            }
            else{
                return false;
            }
        }
        catch(error){
            throw error;
        }
    }

    async removeExcelByProcessId(id){
        try{
            if(id){
                const excelArchiveExist = await this.excelArchiveModel.findOne({processStateId: id});
                if(excelArchiveExist){
                    const deleteResult = await this.excelArchiveModel.deleteOne({ processStateId: id });
                    if (deleteResult.deletedCount > 0) {
                      return true;
                    } else {
                      return false;
                    }
                }
                else{
                    return false;
                }
            }
            else{
                return false;
            }
        }
        catch(error){
            throw error;
        }
    }

    async removeCashFlowByProcessStateId(id){
        try{
            if(id){
                const excelArchiveExist = await this.excelArchiveModel.findOne({processStateId: id});
                const cashFlowRowCount = excelArchiveExist?.cashFlowSheetRowCount || 0;
                if(cashFlowRowCount){
                    await this.excelArchiveModel.findOneAndUpdate(
                        { processStateId: id },
                        {
                            $set:{
                                cashFlowSheetRowCount:0,
                                cashFlowSheetdata:[],
                                modifiedOn: new Date()
                            }
                        }
                    );
                      return true;
                }
                else{
                    return true;
                }
            }
            else{
                return false;
            }
        }
        catch(error){
            throw error;
        }
    }

    async removeAssessmentOfWCbyProcessStateId(id){
        try{
            if(id){
                const excelArchiveExist = await this.excelArchiveModel.findOne({processStateId: id});
                const assessmentRowCount = excelArchiveExist?.assessmentSheetRowCount || 0;
                if(assessmentRowCount){
                    await this.excelArchiveModel.findOneAndUpdate(
                        { processStateId: id },
                        {
                            $set:{
                                assessmentSheetRowCount: 0,
                                assessmentSheetData: [],
                                modifiedOn: new Date()
                            }
                        }
                    );
                      return true;
                }
                else{
                    return true;
                }
            }
            else{
                return false;
            }
        }
        catch(error){
            throw error;
        }
    }
}
