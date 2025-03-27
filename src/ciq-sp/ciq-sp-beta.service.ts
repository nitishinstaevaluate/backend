import { HttpException, HttpStatus, Injectable, NotFoundException } from "@nestjs/common";
import { MNEMONIC_ENUMS, MNEMONICS_ARRAY, BETA_TYPE, BETA_SUB_TYPE, MNEMONICS_ARRAY_5 } from "src/constants/constants";
import { convertToNumberOrZero, convertToNumberOrOne } from "src/excelFileServices/common.methods";
import { iqCreateStructure, extractValues, calculateMean, calculateMedian, ciqStockBetaCreateStructure } from "./ciq-common-functions";
import { BetaWorkingDocument } from "./schema/ciq-sp.chema";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { betaWorkingDto } from "./dto/ciq-sp.dto";


@Injectable()
export class ciqSpBetaService {
  constructor(
    @InjectModel('betaWorking') 
    private readonly betaWorkingModel: Model<BetaWorkingDocument>){}
    //#region beta calculation starts
      async createBetaPayloadStructure(data){
        try{

            const finalPayload = [];

            for await (const mnemonic of MNEMONICS_ARRAY) {
                const payload = await iqCreateStructure(data, mnemonic);
                finalPayload.push(...payload.data);
            }

            return {inputRequests:finalPayload};
        }
        catch(error){
            return {
                error:error,
                status:false,
                msg:"beta payload creation failed"
            }
        }
      }

      async baseBetaWorking(data:any){
        return data.industryAggregateList.map((elements,index)=>{    //creating base for beta storing beta workings/calculations
          return {
              companyId:elements.COMPANYID,
              companyName:elements.COMPANYNAME,
              counter:index+1
            }
          })
      }
  
      async calculateBetaAggregate(axiosBetaResponse, taxRate, betSubType, betaType, betaWorking) {
        try {
          if (!axiosBetaResponse.data) {
            throw new NotFoundException({
              message: 'Axios beta list not found',
              status: false,
            });
          }
  
          const result = {};
          let maxLength = 0
          for await (const betaDetails of axiosBetaResponse.data.GDSSDKResponse) {
            if (!betaDetails.ErrMsg) {
              for await (const mnemonic of MNEMONICS_ARRAY) {
                if (betaDetails.Headers.includes(mnemonic)) {
                  result[mnemonic] = result[mnemonic] || [];
                  result[mnemonic].push(...await extractValues(betaDetails, mnemonic));
  
                  const currentLength = result[mnemonic].length;
                  if (currentLength > maxLength) {
                    maxLength = currentLength;
                  }
                }
              }
            }
            else{
              result[betaDetails.Mnemonic] = [];
            }
          }
          
          const getDebtToCapitalAndMarketValue = await  this.calculateDebtToCapitalAndEquityToCapital(result, maxLength, betaWorking); // calculating debt to capital (8) and equity to capital (10)
          
          const calculateAdjstdBetaByMarshallBlume = await this.calculateAdjustedBeta(result,maxLength);  //calculating adjusted beta using marshal blume formula

          if(betaType === BETA_TYPE[0]){    //For relevered scenario
            const unleveredBetaDetails = await this.calculateUnleveredBeta(   //Calculating unlevered beta first
                  calculateAdjstdBetaByMarshallBlume, 
                  getDebtToCapitalAndMarketValue.calculateTotalDebtToCapital, 
                  getDebtToCapitalAndMarketValue.calculateTotalEquityToCapital, 
                  getDebtToCapitalAndMarketValue.betaCalculations, 
                  taxRate, maxLength
                );

            const releveredBetaDetails = await this.calculateReleveredBeta(   //Calculating relevered beta
                  unleveredBetaDetails.unleveredBeta, 
                  getDebtToCapitalAndMarketValue.calculateTotalDebtToCapital, 
                  getDebtToCapitalAndMarketValue.calculateTotalEquityToCapital, 
                  unleveredBetaDetails.betaCalculations, 
                  taxRate, maxLength
                );

            const betaWorkingsMeanMedianMetric = await this.calculateBetaWorkingMetric(releveredBetaDetails.betaCalculations, maxLength);   //calculating beta workings - mean and median
                  
            return {
                beta:await this.calculateBetaMetric(releveredBetaDetails.releveredBeta,  betSubType, maxLength),  // mean/average or median computation
                deRatio: await this.calculateBetaMetric(releveredBetaDetails.deRatio, betSubType, maxLength),    //mean/average or median computation
                coreBetaWorking: releveredBetaDetails.betaCalculations,
                betaMeanMedianWorking: betaWorkingsMeanMedianMetric.betaCalculations
              };
          }
          else{     // For unlevered scenario
            const unleveredBetaDetails = await this.calculateUnleveredBeta(   //Calculating unlevered beta
                calculateAdjstdBetaByMarshallBlume,
                getDebtToCapitalAndMarketValue.calculateTotalDebtToCapital, 
                getDebtToCapitalAndMarketValue.calculateTotalEquityToCapital, 
                getDebtToCapitalAndMarketValue.betaCalculations, 
                taxRate, 
                maxLength
              );

            const betaWorkingsMeanMedianMetric = await this.calculateBetaWorkingMetric(unleveredBetaDetails.betaCalculations, maxLength);    //calculating beta workings - mean and median
            
            return {
              beta: await this.calculateBetaMetric(unleveredBetaDetails.unleveredBeta,  betSubType, maxLength), // mean/average or median computation
              deRatio: await this.calculateBetaMetric(unleveredBetaDetails.deRatio, betSubType, maxLength),  //mean/average or median computation
              coreBetaWorking: unleveredBetaDetails.betaCalculations,
              betaMeanMedianWorking: betaWorkingsMeanMedianMetric.betaCalculations
            };
          }
          
        } 
        catch (error) {
          console.error(error);
          return {
            error: error,
            msg: "Error while fetching data from axios",
            status: false,
          };
        }
      }
  
      async calculateBetaWorkingMetric(betaWorkings, maxLength) {
    
        const betaCalculations = [];
        
        for await (const betaType of BETA_SUB_TYPE) {
            const betaCalculation = {
                betaType: betaType,
                debtToCapital: await this.calculateBetaMetric(betaWorkings.map(element => element.debtToCapital), betaType, maxLength),
                equityToCapital: await this.calculateBetaMetric(betaWorkings.map(element => element.equityToCapital), betaType, maxLength),
                leveredBeta: betaWorkings[0]?.leveredBeta ? await this.calculateBetaMetric(betaWorkings.map(element => element.leveredBeta), betaType, maxLength) : '',
                unleveredBeta: await this.calculateBetaMetric(betaWorkings.map(element => element.unleveredBeta), betaType, maxLength)
            };
    
            betaCalculations.push(betaCalculation);
        }
      
        return { betaCalculations };
    }
      async calculateBetaMetric(data, method, maxLength) {
        try{
          const result = (method === BETA_SUB_TYPE[0])
          ? await calculateMean(data, maxLength)
          : await calculateMedian(data);
      
          return result;
        }
        catch(error){
          return {
            error:error,
            status:false,
            msg:"beta median/mean calculation failed"
          }
        }
      };
  
      async calculateAdjustedBeta(result,maxLength){
        try{
          // Adjusted beta with Marshall Blume formula ( Ba = 0.371+0.635*Bh)
          let adjustedBetaArray = [];
  
          for (let i = 0; i < maxLength; i++){
            adjustedBetaArray.push(
              result[MNEMONIC_ENUMS.IQ_BETA][i] ? 
              (0.371 + 0.635 * result[MNEMONIC_ENUMS.IQ_BETA][i]) //Using only unadjusted beta ( last 5 yrs data ) 
              : 0
            )
          }
          return adjustedBetaArray;
        }
        catch(error){
          return {
            error:error,
            status:false,
            msg:"Adjusted beta calculation failed"
          }
        }
      }
      async calculateUnleveredBeta(adjustedBeta, debtToCapital, equityToCapital, betaWorking, taxRate, maxLength){
        try{
          // Be4 = M12/(1+(1-L12)*J12/K12)

          let unleveredBeta = [], deRatio = [], betaCalculations:any[]=[];
          for (let i = 0; i < maxLength; i++){
            unleveredBeta.push(adjustedBeta[i] / (1 + (1 - taxRate) * debtToCapital[i]/equityToCapital[i]));
            betaCalculations.push(
              {
                ...betaWorking[i],
                unleveredBeta:unleveredBeta[i]
              }
            );
            deRatio.push(debtToCapital[i]/equityToCapital[i]);  //calculating de ratio
          }
          return { unleveredBeta, deRatio, betaCalculations };
        }
        catch(error){
          return {
            error:error,
            status:false,
            msg:"Beta unlever calculation for beta failed"
          }
        }
      }
  
      async calculateReleveredBeta(betaUnleveredArray,debtToCapital, equityToCapital, betaWorking, taxRate, maxLength){
        try{
          // Relevered Equity Beta = Be4 * (1 + (1-Tax Rate) * Debt to Equity)
          let releveredBeta = [], deRatio = [], betaCalculations:any[] = [];
          for (let i = 0; i < maxLength; i++){
            releveredBeta.push(betaUnleveredArray[i] * (1 + (1 - taxRate) * debtToCapital[i]/equityToCapital[i]));

            betaCalculations.push(
              {
                ...betaWorking[i],
                leveredBeta:releveredBeta[i]
              }
            )

            deRatio.push(debtToCapital[i]/equityToCapital[i]);  //calculating de ratio
          }
          return { releveredBeta, deRatio, betaCalculations };
        }
        catch(error){
          return {
            error:error,
            msg:"Beta relever calculation for beta failed"
          }
        }
      }
  
      async calculateDebtToCapitalAndEquityToCapital(result ,maxLength, betaWorking){
        try{
          let calculateTotalDebtInCurrentLiabilities = [], calculateTotalLongTermDebt = [], calculateTotalBookValue = [], 
            calculateTotalMarketValueOfEquity = [], calculateTotalMarketValueOfCapital = [], calculateTotalDebtToCapital = [], calculateTotalEquityToCapital = [], betaCalculations:any[] = [];
  
          for (let i = 0; i < maxLength; i++){
  
            // calculate debt in current liabilities
            calculateTotalDebtInCurrentLiabilities.push(
              convertToNumberOrZero(result[MNEMONIC_ENUMS.IQ_CURRENT_PORT][i]) + 
              convertToNumberOrZero(result[MNEMONIC_ENUMS.IQ_ST_DEBT][i]) + 
              convertToNumberOrZero(result[MNEMONIC_ENUMS.IQ_FIN_DIV_DEBT_CURRENT][i]) - 
              convertToNumberOrZero(result[MNEMONIC_ENUMS.IQ_CURRENT_PORTION_LEASE_LIABILITIES][i])
            ) 
  
            // calculate long term debt
            calculateTotalLongTermDebt.push(
              convertToNumberOrZero(result[MNEMONIC_ENUMS.IQ_LT_DEBT][i]) +
              convertToNumberOrZero(result[MNEMONIC_ENUMS.IQ_CAPITAL_LEASES][i]) +
              convertToNumberOrZero(result[MNEMONIC_ENUMS.IQ_FIN_DIV_DEBT_LT][i]) -
              convertToNumberOrZero(result[MNEMONIC_ENUMS.IQ_LT_PORTION_LEASE_LIABILITIES][i])
            )
  
            // calculate total book value of debt
            calculateTotalBookValue.push(
              convertToNumberOrZero(calculateTotalDebtInCurrentLiabilities[i]) + 
              convertToNumberOrZero(calculateTotalLongTermDebt[i])
            )
  
            // calculate total market value of equity 
            calculateTotalMarketValueOfEquity.push(
              convertToNumberOrZero(result[MNEMONIC_ENUMS.IQ_DILUT_WEIGHT][i]) *
              convertToNumberOrZero(result[MNEMONIC_ENUMS.IQ_CLOSEPRICE][i])
            )
  
            // calculate total market value of capital
            calculateTotalMarketValueOfCapital.push(
              calculateTotalBookValue[i] + 
              convertToNumberOrZero(result[MNEMONIC_ENUMS.IQ_PREF_EQUITY][i]) + 
              calculateTotalMarketValueOfEquity[i]
            )
  
            // calculate debt to capital
            calculateTotalDebtToCapital.push(
              (
                (
                  calculateTotalBookValue[i] + convertToNumberOrZero(result[MNEMONIC_ENUMS.IQ_PREF_EQUITY][i])
                ) / calculateTotalMarketValueOfCapital[i]
              ) * 100
            )
  
            // calculate equity to capital
            calculateTotalEquityToCapital.push(
              (calculateTotalMarketValueOfEquity[i] / calculateTotalMarketValueOfCapital[i]) * 100
            )
            
            betaCalculations.push(
              {
                ...betaWorking[i],
                totalBookValueOfDebt: calculateTotalBookValue[i], 
                totalBookValueOfPreferredEquity: convertToNumberOrZero(result[MNEMONIC_ENUMS.IQ_PREF_EQUITY][i]), 
                totalMarketValueOfEquity: calculateTotalMarketValueOfEquity[i],
                totalMarketValueOfCapital: calculateTotalMarketValueOfCapital[i],
                debtToCapital: calculateTotalDebtToCapital[i],
                equityToCapital: calculateTotalEquityToCapital[i]

              })
          }
  
          return {
            calculateTotalDebtToCapital,
            calculateTotalEquityToCapital,
            betaCalculations
          }
        }
        catch(error){
          return {
            error:error,
            status:false,
            msg:"calculation failed for debt to capital and market value functions"
          }
        }
      }
      //#endregion beta calculation ends

      //#region stock beta calculation starts
      async createStockBetaPayloadStructure(data){
        try{
          const finalPayload = [];

          const payload = await ciqStockBetaCreateStructure(data, MNEMONIC_ENUMS.IQ_BETA);
          finalPayload.push(payload);

          return {inputRequests:finalPayload};
        }
        catch(error){
          return {
            error:error,
            status:false,
            msg:"Stock beta payload creation failed"
          }
        }
      }

      async calculateStockBeta(axiosStockBetaResponse){
        try{
          if (!axiosStockBetaResponse.data) {
            throw new NotFoundException({
              message: 'Axios response not found',
              status: false,
            });
          }

          let result, isStockBetaPositive = true, value;
          for await (const details of axiosStockBetaResponse.data.GDSSDKResponse) {
            if (!details.ErrMsg) {
                if (details.Headers.includes(MNEMONIC_ENUMS.IQ_BETA)) {
                  [result] = await extractValues(details, MNEMONIC_ENUMS.IQ_BETA);
                  details.Rows.map((innerBetaRows: any) => {
                    const betaValue = +innerBetaRows?.Row[0];
                    if(`${betaValue}`.includes('-')){
                      isStockBetaPositive = false;
                      value = betaValue
                    }
                });
                  break;
                }
            }
          }

          return { result, isStockBetaPositive, value };
        }
        catch(error){
          return {
            error:error,
            status:false,
            msg:"Stock beta calculation failed"
          }
        }
      }
      //#endregion stock beta calculation ends

      //#region Beta working starts
      async upsertBetaWorkingAggregate(payload:betaWorkingDto){
        try{
          const existingBetaWorking = await this.betaWorkingModel.findOne({processIdentifierId:payload.processIdentifierId});

          if (existingBetaWorking) {
            const updatedRecord = await this.betaWorkingModel.findOneAndUpdate(
                { processIdentifierId: payload.processIdentifierId },
                {
                    $set: {
                       ...payload
                    },
                },
                { new: true },
            ).exec();
            return {
              processIdentifierId: updatedRecord.processIdentifierId,
              status:true,
              msg:"Updated beta working success"
            }
          }

          const newRecord = await this.betaWorkingModel.create(payload);
          return {
            processIdentifierId: newRecord.processIdentifierId,
            status:true,
            msg:"new beta working inserted success"
          }
        }
        catch(error){
          throw new HttpException(
            {
              error: error,
              status: false,
              msg: 'beta working aggregate upsertion failed',
            },
            HttpStatus.INTERNAL_SERVER_ERROR,
          );
        }
      }

      async getBetaWorkingAggregate(id){
        try{
          const response = await this.betaWorkingModel
                              .findOne({processIdentifierId: id})
                              .select('coreBetaWorking betaMeanMedianWorking processIdentifierId')
                              .exec();
          return {
            data:response,
            status:true,
            msg:"Beta working found"
          }
        }
        catch(error){
          throw new HttpException(
            {
              error: error,
              status: false,
              msg: 'beta working record not found',
            },
            HttpStatus.NOT_FOUND,
          );
        }
      }
      //#endregion Beta working ends

      async cloneBetaWorkingAggregate(payload){
        try{
          const oldPID = payload.oldPID;
          const newPID = payload.newPID;

          const oldProcess:any = await this.getBetaWorkingAggregate(oldPID);
          if(!oldProcess?.data) return;

          const { _id, createdAt, updatedAt, processIdentifierId, ...rest } = oldProcess.data.toObject();
      
          return await new this.betaWorkingModel({ ...rest, processIdentifierId: newPID }).save()
        }
        catch(error){
          throw error;
        }
      }
}