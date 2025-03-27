
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FieldValidatiomDocument } from '../schema/field-validation.shema';
import { Model } from 'mongoose';
import { FieldValidationDto } from '../dto/field-validation.dto';

@Injectable()
export class FieldValidationService {
    constructor(@InjectModel('fieldValidation')
    private readonly fieldValidationModel: Model<FieldValidatiomDocument>){}

    async upsertFieldValidation(payload){

        try{
            const pid = payload.processStateId;
            console.log(pid)
            if(!pid) throw new NotFoundException('PID not found').getResponse();
            
            let fieldValidationLog = new FieldValidationDto();

            if (Object.keys(payload)?.length > 2) {
                for (const [key, value] of Object.entries(payload)) {
                  if (value !== null) {
                    fieldValidationLog[key] = value;
                  }
                }
              }
            
            return await this.fieldValidationModel.findOneAndUpdate(
                { processStateId: pid },
                { $set: fieldValidationLog, modifiedOn:new Date() },
                { new:true, upsert: true }
            )
        }
        catch(error){
            throw error;
        }
    }

}