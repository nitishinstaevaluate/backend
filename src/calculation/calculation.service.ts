import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { date } from 'joi';
import { Model } from 'mongoose';
import { formatDateToMMDDYYYY } from 'src/ciq-sp/ciq-common-functions';
import { COST_OF_EQUITY_METHOD, EXCEL_CONVENTION } from 'src/constants/constants';
import { HistoricalReturnsService } from 'src/data-references/data-references.service';
import { convertToNumberOrZero, getDateKey } from 'src/excelFileServices/common.methods';
import { CapitalStruc, capitalStructureComputation, getShareholderFunds } from 'src/excelFileServices/fcfeAndFCFF.method';
import { thirdpartyApiAggregateService } from 'src/library/thirdparty-api/thirdparty-api-aggregate.service';
import { CustomLogger } from 'src/loggerService/logger.service';
import { RiskFreeRateDocument } from 'src/masters/schema/masters.schema';
import { FCFEAndFCFFService } from 'src/valuationProcess/fcfeAndFCFF.service';
import * as XLSX from 'xlsx';

// @Injectable()
// export class CalculationService {}

// Indian Treasury Yield Service
@Injectable()
export class CalculationService {
  constructor(
    // @InjectModel('indianTreasuryYield')
    // private readonly indianTresauryYieldModel: Model<IndianTreasuryYieldDocument>
    @InjectModel('riskFreeRate')
    private readonly riskFreeRateModel: Model<RiskFreeRateDocument>,
    private customLogger: CustomLogger,
    private historicalReturnsService: HistoricalReturnsService,
    private thirdpartyApiService: thirdpartyApiAggregateService,
    private fcfeService: FCFEAndFCFFService
  ) { }

  async adjCOE(payload): Promise<any> {
    let adjustedCostOfEquity = 0, costOfEquity = 0;   

    const { riskFreeRate, expMarketReturn, beta, riskPremium, coeMethod, industryRiskPremium, sizePremium } = payload;

    const fieldNotFound = (field) =>{
       return {
        result: {
          coe: 0,
          adjCOE: 0,
          method: coeMethod
        },
        message: `${field} not found`,
        status: false
      }
    }
    if(coeMethod === COST_OF_EQUITY_METHOD.capm.key){
      if(!beta) return fieldNotFound('beta');
      if(!expMarketReturn) return fieldNotFound('expMarketReturn');
      if(!riskFreeRate) return fieldNotFound('riskFreeRate');

      costOfEquity = convertToNumberOrZero(riskFreeRate) + (convertToNumberOrZero(expMarketReturn) - convertToNumberOrZero(riskFreeRate)) * convertToNumberOrZero(beta);
      adjustedCostOfEquity = costOfEquity + convertToNumberOrZero(riskPremium);
    }
    else if(coeMethod === COST_OF_EQUITY_METHOD.buildUpCapm.key){
      if(!sizePremium) return fieldNotFound('sizePremium');
      if(!industryRiskPremium) return fieldNotFound('industryRiskPremium');
      if(!expMarketReturn) return fieldNotFound('expMarketReturn');
      if(!riskFreeRate) return fieldNotFound('riskFreeRate');

      costOfEquity = convertToNumberOrZero(riskFreeRate) + 
      (
        convertToNumberOrZero(expMarketReturn) - convertToNumberOrZero(riskFreeRate)
      ) + 
      convertToNumberOrZero(industryRiskPremium) + convertToNumberOrZero(sizePremium);

      adjustedCostOfEquity = costOfEquity + convertToNumberOrZero(riskPremium);
    }
    return {
      result: {
        coe: costOfEquity ,
        adjCOE: adjustedCostOfEquity ,
        method: coeMethod
      },
      message: 'Cost of equity calculated',
      status: true
    }
  }

    async getWACC(adjustedCostOfEquity,equityProp,
      costOfDebt,taxRate,
      debtProp,copShareCapital,prefProp,coeMethod): Promise<any> {
      //WACC based on CAPM Method
      const calculatedWacc = 
          adjustedCostOfEquity/100 * equityProp + (costOfDebt/100)*(1-taxRate/100)*debtProp + copShareCapital/100 * prefProp;
      return {
        result: {
          wacc: calculatedWacc * 100,
          adjCOE: adjustedCostOfEquity ,
          method: coeMethod
        },
        message: 'Calculated WACC',
        status: true
      }
    }
    async getWaccExcptTargetCapStrc(waccPayload): Promise<any> {
      let modifiedCapitalStructure;
      if(waccPayload.type === 'Target_Based'){
        modifiedCapitalStructure = waccPayload.capitalStructure;
      }else{
        modifiedCapitalStructure = {
          deRatio:waccPayload.deRatio
        }
      }
      const payload = {
        capitalStructureType:waccPayload.type,
        capitalStructure:modifiedCapitalStructure
      }

      const capitalStruc:any = await this.capitalStructureComputation(waccPayload.processStateId, payload);

      let calculatedWacc = convertToNumberOrZero(waccPayload.adjCoe)/100 * capitalStruc.equityProp + (convertToNumberOrZero(waccPayload.costOfDebt)/100)*(1-convertToNumberOrZero(waccPayload.taxRate)/100)*capitalStruc.debtProp + convertToNumberOrZero(waccPayload.copShareCapital)/100 * capitalStruc.prefProp;

   return {
        result: {
          wacc: calculatedWacc*100,
          adjCOE:convertToNumberOrZero(waccPayload.adjCoe),
          capitalStructure:capitalStruc
        },
        message: 'Calculated WACC',
        status: true
      }
    }

    async capitalStructureComputation(processId, payload){
      const excelData:any = await this.fcfeService.getSheetData(processId, EXCEL_CONVENTION.BS.key);
      const provisionalDate = getDateKey(excelData.balanceSheetdata[0]);
      const balanceSheetComputed = await this.serializeArrayObject(excelData.balanceSheetdata);
      return await capitalStructureComputation(provisionalDate, balanceSheetComputed, payload);
    }

    async serializeArrayObject(array){
      let excelArchive = {};
      for await (const indArchive of array){
        const {lineEntry, 'Sr no.': srNo, ...rest} = indArchive; 
        excelArchive[indArchive.lineEntry.particulars] = rest;
      }
      return excelArchive;
    }

    async calculateWeightedVal(valuationInput) {
      try{

      let weightedVal = 0;
      const weightedModel = [];
      
      valuationInput.results.map((resp) => {
        if (resp.model){
          weightedVal = weightedVal + (convertToNumberOrZero(resp.value) * parseFloat(resp.weightage)/100);
          weightedModel.push(
            {
              model : resp.model,
              indicatedValue : resp.value,
              weight : parseFloat(resp.weightage)/100,
              weightedValue : parseFloat(resp.value) * parseFloat(resp.weightage)/100, 
            }
          )
        }

      })
      
      return {
        result :{
            weightedVal : weightedVal,
            modelValue : weightedModel 
        },
        message: 'Weighted valuation results',
        status: true
      }
      }
      catch(error){
        return {
          error: error.message,
          message: 'Unable to calculate final value.',
          status: false
        }
      }
   }

   async calculateRiskFreeRate(maturityYears, date){
    try{
      const maturityYrs = parseInt(maturityYears);

      const newAsOnDate = (date/1000 + 24*60*60) * 1000;
      let valuationDate = new Date(newAsOnDate);

      const details:any = await this.riskFreeRateModel.findOne({ 'date': { "$lte": new Date(valuationDate)},'beta0': { $ne: null }}).sort({ "date": -1 }).exec();

      const riskFreeRate =
        details.beta0 +
        (details.beta1 + details.beta2) *
          ((1 - Math.exp(-maturityYrs / details.tau1)) /
            (maturityYrs / details.tau1)) -
        details.beta2 * Math.exp(-maturityYrs / details.tau1) +
        details.beta3 *
          ((1 - Math.exp(-maturityYrs / details.tau2)) /
            (maturityYrs / details.tau2)) -
        details.beta3 * Math.exp(-maturityYrs / details.tau2);

       return {
        riskFreeRate,
        status:true,
        msg:"Risk-free rate calculation success"
       }
      
    }
    catch(error){
      throw new HttpException(
        {
          error: error,
          status: false,
          msg: 'Risk-free rate calculation failed',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
   }
}
