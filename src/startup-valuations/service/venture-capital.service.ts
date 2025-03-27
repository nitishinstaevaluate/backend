import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { StartupValuationDocument } from "../schema/startup-valuation.schema";
import { Model } from "mongoose";
import { MODEL, VENTURE_CAPITAL_VALUATION_MAPPER } from "src/constants/constants";
import { convertToNumberOrZero } from "src/excelFileServices/common.methods";


@Injectable()
export class VentureCapitalService{

    constructor(@InjectModel('startupValuation')
    private readonly startupValuationModel: Model<StartupValuationDocument>){}

    async upsert(payload){
        try{
            const pid = payload?.processStateId;
            
            const ventureCapitalPayload = payload?.ventureCapital;
            if(!ventureCapitalPayload) return await this.startupValuationModel.findOne({ processStateId: pid }).lean();

            const validVentureCapital = {};
            const mapScoreCard = (key: string, value: any) => {
                validVentureCapital[`${key}`] = value;
            };
            mapScoreCard(MODEL[12], ventureCapitalPayload);

            const ventureCapitalValuation = await this.ventureCapitalValuation(ventureCapitalPayload, MODEL[12]);
            mapScoreCard(ventureCapitalValuation.dbKey, ventureCapitalValuation.response);

            return await this.startupValuationModel.findOneAndUpdate(
                { processStateId: pid },
                { $set: { ...validVentureCapital, modifiedOn:new Date()}},
                { new:true, upsert: true }
            ).lean();
        }
        catch(error){
            throw error;
        }
    }

    async ventureCapitalValuation(data, key){
        try{
            const staticSchema = VENTURE_CAPITAL_VALUATION_MAPPER[key];

            const { dbKey, config } = staticSchema;

            const { 
                financialPerformanceMetrics, 
                financialPerformanceMetricsSubType, 
                investmentAmount, 
                probabilityOfFailure, 
                requiredReturn, 
                targetMarginAndBenchmarking, 
                exitInvestorMultipleAndBenchmarking, 
                exitYear
            } = data;

            /**
             * Formula for Estimated Exit Value:
             * =G8*G10
             * G8 = Financial performance metrics/multiples
             * G10 = exit multiple value
             */
            const fnancePrfmnceMtrcValue = financialPerformanceMetrics === 'netMargin' ? convertToNumberOrZero(targetMarginAndBenchmarking) : convertToNumberOrZero(financialPerformanceMetricsSubType);
            config.estimatedExitValue.value = convertToNumberOrZero(fnancePrfmnceMtrcValue) * convertToNumberOrZero(exitInvestorMultipleAndBenchmarking);

            /**
             * Formula for ROI:
             * =(1+G12)^G6/(1-G11)^1/G6
             * G12 = required return
             * G6 = exit year
             * G11 = probability of failure
             */
            config.returnOnInvestment.value = (1 + (convertToNumberOrZero(requiredReturn)/100)) ** convertToNumberOrZero(exitYear) / 
                                            (1 - (convertToNumberOrZero(probabilityOfFailure)/100)) ** (1/convertToNumberOrZero(exitYear));

            config.presentValue.value = convertToNumberOrZero(config.estimatedExitValue.value) / convertToNumberOrZero(config.returnOnInvestment.value);
            config.preMoneyValue.value = convertToNumberOrZero(config.presentValue.value) - convertToNumberOrZero(investmentAmount);
            config.vcOwnership.value = (convertToNumberOrZero(investmentAmount) / convertToNumberOrZero(config.preMoneyValue.value)) * 100;

            return { response: config, dbKey}
        }
        catch(error){
            throw error;
        }
    }

}