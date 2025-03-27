import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { StartupValuationDocument } from "../schema/startup-valuation.schema";
import { MODEL, RISK_FACTOR_VALUATION_MAPPER } from "src/constants/constants";
import { convertToNumberOrZero } from "src/excelFileServices/common.methods";

@Injectable()
export class RiskFactorService{

    constructor(@InjectModel('startupValuation')
    private readonly startupValuationModel: Model<StartupValuationDocument>){}

    async upsert(payload){
        try{
            const pid = payload?.processStateId;

            const riskFactorPayload = payload?.riskFactor;
            if(!riskFactorPayload) return await this.startupValuationModel.findOne({ processStateId: pid }).lean();

            const validRiskFactor = {};
            const mapRiskFactor = (key: string, value: any) => {
                validRiskFactor[`${key}`] = value;
            };
            mapRiskFactor(MODEL[10], riskFactorPayload);

            const riskFactorValuation = await this.riskFactorValuation(riskFactorPayload, MODEL[10]);
            mapRiskFactor(riskFactorValuation.dbKey, riskFactorValuation.response);

            return await this.startupValuationModel.findOneAndUpdate(
                { processStateId: pid },
                { $set: { ...validRiskFactor, modifiedOn:new Date()}},
                { new:true, upsert: true }
            ).lean();
        }
        catch(error){
            throw error;
        }
    }


    async riskFactorValuation(data, key){
        try{
            const interpreter = (value, key?) => {
                if (key === 'Total') {
                    switch (true) {
                        case -24 <= value && value <= -16:
                            return 'Very High Risk';
                        case -15 <= value && value <= -1:
                            return 'High Risk';
                        case 0 <= value && value <= 7:
                            return 'Medium to High Risk';
                        case 8 <= value && value <= 15:
                            return 'Moderate Risk';
                        case 16 <= value && value <= 24:
                            return 'Low Risk';
                        default:
                            return '';
                    }
                }
            
                switch (value) {
                    case 2:
                        return 'Extremely Positive';
                    case 1:
                        return 'Positive';
                    case 0:
                        return 'Neutral';
                    case -1:
                        return 'Negative';
                    case -2:
                        return 'Extremely Negative';
                    default:
                        return '';
                }
            }

            const staticSchema = RISK_FACTOR_VALUATION_MAPPER[key];

            const { dbKey, config} = staticSchema;
            
            let pointer = 0, total = 0;
            while(pointer < config.length){
                const coeffValue = data[config[pointer]?.controlRFCoeff];
                if(coeffValue !== undefined){
                    config[pointer].riskFactorCoeff = coeffValue;
                    config[pointer].status = interpreter(coeffValue);
                    total = total + convertToNumberOrZero(coeffValue);
                }

                if(config[pointer]?.label === 'Total') config[pointer].total = total;
                pointer++; 
            }
            
            config[config.length - 1].status = interpreter(config[config.length - 1].total, config[config.length - 1].label);
            return { response: config, dbKey };
        }
        catch(error){
            throw error;
        }
    }
}