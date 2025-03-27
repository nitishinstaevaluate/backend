import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { StartupValuationDocument } from "../schema/startup-valuation.schema";
import { MODEL, SCORE_CARD_VALUATION_MAPPER } from "src/constants/constants";
import { convertToNumberOrZero } from "src/excelFileServices/common.methods";

@Injectable()
export class ScoreCardService{

    constructor(@InjectModel('startupValuation')
    private readonly startupValuationModel: Model<StartupValuationDocument>){}

    async upsert(payload){
        try{
            const pid = payload?.processStateId;

            const scoreCardPayload = payload?.scoreCard;
            if(!scoreCardPayload) return await this.startupValuationModel.findOne({ processStateId: pid }).lean();

            const validScoreCard = {};
            const mapScoreCard = (key: string, value: any) => {
                validScoreCard[`${key}`] = value;
            };
            mapScoreCard(MODEL[11], scoreCardPayload);

            const scoreCardValuation = await this.scoreCardValuation(scoreCardPayload, MODEL[11]);
            mapScoreCard(scoreCardValuation.dbKey, scoreCardValuation.response);

            return await this.startupValuationModel.findOneAndUpdate(
                { processStateId: pid },
                { $set: { ...validScoreCard, modifiedOn:new Date()}},
                { new:true, upsert: true }
            ).lean();
        }
        catch(error){
            throw error;
        }
    }


    async scoreCardValuation(data, key){
        try{
            const staticSchema = SCORE_CARD_VALUATION_MAPPER[key];
            const { defaultWeightage, dbKey, config} = staticSchema;
            const hashMapTwo = {};

            for(let i = 0; i < config.length; i++){
                if(config[i]?.key){
                    hashMapTwo[config[i]?.key] = config[i];
                }
            }

            const interpreter = (value) => {
                switch (true) {
                    case value >= 0 && value <= 20:
                        return 'Very Weak';
                    case value >= 21 && value <= 40:
                        return 'Weak';
                    case value >= 41 && value <= 60:
                        return 'Moderate';
                    case value >= 61 && value <= 80:
                        return 'Strong';
                    case value >= 81 && value <= 100:
                        return 'Very Strong';
                    default:
                        return '';
                }
            }

            const totalObj = config[config.length - 1];
            let whole = 0;
            for(const parent of Object.keys(hashMapTwo)){
                let total = 0, totalSubQuestion = 0;
                for(let i = 0; i < config.length; i++){
                    if(hashMapTwo[parent]?.key && config[i]?.parent && config[i]?.parent === hashMapTwo[parent].key){
                        const doaValue = data[config[i]?.controlDoa];
                        if(doaValue !== undefined){
                            total += doaValue;
                            totalSubQuestion++;
                        }
                    }
                }
                hashMapTwo[parent].doa = (total/totalSubQuestion);
                hashMapTwo[parent].weightedValue = convertToNumberOrZero((total/totalSubQuestion)) * convertToNumberOrZero(hashMapTwo[parent].weightAssign)/100;
                hashMapTwo[parent].status = interpreter(convertToNumberOrZero((total/totalSubQuestion)) * convertToNumberOrZero(hashMapTwo[parent].weightAssign)/100);
                whole += (convertToNumberOrZero((total/totalSubQuestion)) * convertToNumberOrZero(hashMapTwo[parent].weightAssign)/100);
            }

            [totalObj.total, totalObj.status] = [whole, interpreter(whole)];
            return { response: [...Object.values(hashMapTwo), totalObj], dbKey};
        }
        catch(error){
            throw error;
        }
    }
}  