import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { StartupValuationDocument } from "../schema/startup-valuation.schema";
import { Model } from "mongoose";
import { berkusDto, managementDto, productRollOutDto, prototypeDto, soundIdeaDto, strategicRelationshipDto } from "../dto/startup-valuation.dto";
import { plainToClass } from "class-transformer";
import { validate } from "class-validator";
import { BERKUS_VALUATION_MAPPER } from "src/constants/constants";
import { convertToNumberOrZero } from "src/excelFileServices/common.methods";


@Injectable()
export class BerkusService{

    constructor(@InjectModel('startupValuation')
    private readonly startupValuationModel: Model<StartupValuationDocument>){}

    async upsert(payload){
        try{
            const pid = payload?.processStateId;

            const payloadArray = [payload.berkus];
            if(!payloadArray?.length) return await this.startupValuationModel.findOne({ processStateId: pid }).lean();

            const validBerkus = {};
            const mapBerkus = (key: string, value: any, prefix: string) => {
                validBerkus[`${prefix}.${key}`] = value;
            };

            for (const [key, value] of Object.entries(payload.berkus)) {
                mapBerkus(key, value, 'berkus');
        
                const { response, dbKey } = await this.berkusValuation(value, key);
                mapBerkus(dbKey, response, 'berkusValuation');
            }

            return await this.startupValuationModel.findOneAndUpdate(
                { processStateId: pid },
                { $set: { ...validBerkus, modifiedOn:new Date()}},
                { new:true, upsert: true }
            ).lean();
        }
        catch(error){
            throw error;
        }
    }


    async berkusValuation(data, key){
        try{
            const interpreter = (value) => {
                switch(true){
                    case 0 < value && value <= 20:
                        return 'Very Weak';
                    case 20 < value && value <= 40:
                        return 'Weak';
                    case 40 < value && value <= 60:
                        return 'Moderate';
                    case 60 < value && value <= 80:
                        return 'Strong';
                    case 80 < value && value <= 100:
                        return 'Very Strong';
                    default:
                        return '';
                }
            } 
            const staticSchema = BERKUS_VALUATION_MAPPER[key];

            const { defaultWeightage, dbKey, config} = staticSchema;
            
            let pointer = 0, total = 0;
            while(pointer < config.length){
                const doaValue = data[config[pointer]?.controlDoa];
                if(doaValue){
                    config[pointer].doa = doaValue;
                    config[pointer].weightAssign = defaultWeightage;
                    config[pointer].weightedValue = convertToNumberOrZero(doaValue) * convertToNumberOrZero(defaultWeightage)/100;
                    total = total + config[pointer].weightedValue;
                }

                if(config[pointer]?.label === 'Total'){
                    config[pointer].total = total
                    config[pointer].status = interpreter(total)
                }
                pointer++; 
            }
            return { response: config, dbKey };
        }
        catch(error){
            throw error;
        }
    }
}