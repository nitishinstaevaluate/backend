import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import {
  netWorthOfCompany,
  profitLossValues,
  ebitdaMethod,
  debtMethod,
  incomeFromOperation,
  netWorthOfComp,
  cashAndCashEquivalent,
} from 'src/excelFileServices/relativeValuation.methods';

import {
  getShareholderFunds,
} from 'src/excelFileServices/fcfeAndFCFF.method';
import {
  getYearsList,
  findAverage,
  findMedian,
  convertToNumberOrZero,
  getDateKey,
} from '../excelFileServices/common.methods';
import { columnsList } from '../excelFileServices/excelSheetConfig';
import * as XLSX from 'xlsx';
import { CustomLogger } from 'src/loggerService/logger.service';
import { GET_MULTIPLIER_UNITS, MODEL, MULTIPLES_TYPE, RATIO_TYPE, RELATIVE_PREFERENCE_RATIO } from 'src/constants/constants';
import { versionTwoNetWorthOfCompany, versionTwoProfitLossValues } from 'src/excelFileServices/v2-relative-valuation.method';
import { CIQ_COMPANY_MULTIPLES_MEAN_MEDIAN, CIQ_ELASTIC_SEARCH_FINANCIAL_SEGMENT } from 'src/library/interfaces/api-endpoints.local';
import { axiosInstance, axiosRejectUnauthorisedAgent } from 'src/middleware/axiosConfig';
import { ciqGetCompanyMeanMedianDto } from 'src/ciq-sp/dto/ciq-sp.dto';
import { authenticationTokenService } from 'src/authentication/authentication-token.service';
import { ProcessStatusManagerService } from 'src/processStatusManager/service/process-status-manager.service';
import { ValuationsService } from './valuationProcess.service';
import { PostMainValuationDto, ValuationDto } from './dto/valuations.dto';
import { ExcelArchiveService } from 'src/excel-archive/service/excel-archive.service';
@Injectable()
export class RelativeValuationService {
  constructor(private readonly customLogger: CustomLogger,
    private processStateManagerService: ProcessStatusManagerService,
    private valuationService: ValuationsService,
    private excelArchiveService: ExcelArchiveService
  ) {}
  async Relative_Valuation(
    inputs: any,
    multiples?:any,
    // companiesInfo: any,
    isRevaluationFlag?
  ): Promise<any> {
 try{
     this.customLogger.log({
      message: 'Request is entered into Relative Valuation Service.',
      userId: inputs.userId,
    });
    const multiplier = GET_MULTIPLIER_UNITS[`${inputs.reportingUnit}`];
    const ratiotypebased = inputs.type;
    const pid = inputs.processStateId;
    let companies = inputs.companies, ccmMuliple = multiples;

    const { outstandingShares, discountRateValue, processStateId} = inputs;

    const { balanceSheetData, profitLossSheetData } = await this.getSheetData(processStateId);
    const balanceSheetComputed = await this.serializeArrayObject(balanceSheetData);
    const profitLossSheetComputed = await this.serializeArrayObject(profitLossSheetData);
    const provisionalDate  = getDateKey(balanceSheetData[0]);

    if(!isRevaluationFlag){
      const valuationDetails:any = await this.processStateManagerService.fetchValuationUsingPID(pid);
      if(valuationDetails){
        const relativeValuationDetails:any = valuationDetails.modelResults.find((ele)=>{ return (ele.model === MODEL[2] || ele.model === MODEL[4]) ? ele : null });
        
        if(relativeValuationDetails) ccmMuliple = relativeValuationDetails?.valuationData?.multiples;
        
        const oldCompanyList = relativeValuationDetails?.valuationData?.companies || [];
        if(oldCompanyList.length){
          let newPointer = 0, oldPointer = 0;
          while(newPointer < companies.length){
            if(oldPointer === oldCompanyList.length){
              oldPointer = 0;
              newPointer++;
            }
            if(companies[newPointer]?.['companyId'] === oldCompanyList[oldPointer]?.['companyId']){
              companies[newPointer]['isSelected'] = !!oldCompanyList[oldPointer]['isSelected'];
            }
            oldPointer++;
          }
        }
      }
    }

    let newPeRatioAvg,newPeRatioMed, newPbRatioAvg, newPbRatioMed, newEbitdaAvg, newEbitdaMed, newSalesAvg, newSalesMed;
    
      companies.map((indCompanies)=>{
        if(indCompanies.company === 'Average'){
          newPeRatioAvg = indCompanies?.peRatio ? indCompanies.peRatio.toFixed(2) * (1-discountRateValue/100) : 0;
          newPbRatioAvg = indCompanies?.pbRatio ? indCompanies.pbRatio.toFixed(2) * (1-discountRateValue/100) : 0;
          newEbitdaAvg = indCompanies?.ebitda ? indCompanies.ebitda.toFixed(2) * (1-discountRateValue/100) : 0;
          newSalesAvg = indCompanies?.sales ? indCompanies.sales.toFixed(2) * (1-discountRateValue/100) : 0;
        }
        if(indCompanies.company === 'Median'){
          newPeRatioMed = indCompanies?.peRatio ? indCompanies.peRatio.toFixed(2) * (1-discountRateValue/100) : 0;
          newPbRatioMed = indCompanies?.pbRatio ?  indCompanies.pbRatio.toFixed(2) * (1-discountRateValue/100) : 0;
          newEbitdaMed = indCompanies?.ebitda ? indCompanies.ebitda.toFixed(2) * (1-discountRateValue/100) : 0;
          newSalesMed = indCompanies?.sales ? indCompanies.sales.toFixed(2) * (1-discountRateValue/100) : 0;
        }
      })

    // re-valuate company average and median
    if(!Object.entries(ccmMuliple || []).length) ccmMuliple = this.constructStaticMultiple();
    let selectedMultiples:any[] = Object.keys(ccmMuliple).filter(key => ccmMuliple[key]);

    let netWorth = await versionTwoNetWorthOfCompany(balanceSheetComputed,provisionalDate);

    const bookValue = netWorth * multiplier / outstandingShares;
    const pbMarketPriceAvg = netWorth * newPbRatioAvg.toFixed(2);
    const pbMarketPriceMed = netWorth * newPbRatioMed.toFixed(2);

    // Valuation based on P/E Ratio
    // version 1 starts
    // let resProfitLoss = await profitLossValues(colNum-1, worksheet1);
    // let eps = (resProfitLoss.profitLossForYear * multiplier) / outstandingShares;
    // const peMarketPriceAvg = resProfitLoss.profitLossForYear * newPeRatioAvg;
    // const peMarketPriceMed = resProfitLoss.profitLossForYear * newPeRatioMed;
    // version 1 ends
    let profitLossOfYear = await versionTwoProfitLossValues(profitLossSheetComputed, provisionalDate);
    const peMarketPriceAvg = profitLossOfYear * newPeRatioAvg.toFixed(2);
    const peMarketPriceMed = profitLossOfYear * newPeRatioMed.toFixed(2);

    // Valuation based on EV/EBITDA
    const ebitdaValue = await ebitdaMethod(profitLossSheetComputed, provisionalDate);
    const cashEquivalent = await cashAndCashEquivalent(balanceSheetComputed, provisionalDate);
    const enterpriseAvg = ebitdaValue * newEbitdaAvg.toFixed(2);
    const enterpriseMed = ebitdaValue * newEbitdaMed.toFixed(2);

    const debt = await debtMethod(balanceSheetComputed, provisionalDate);

    const ebitdaEquityAvg = enterpriseAvg - debt + cashEquivalent;
    const ebitdaEquityMed = enterpriseMed - debt + cashEquivalent;
    const ebitdaMarketPriceAvg = ebitdaEquityAvg * multiplier/ outstandingShares;
    const ebitdaMarketPriceMed = ebitdaEquityMed* multiplier / outstandingShares;

    // Valuation based on Price/Sales
    const salesValue = await incomeFromOperation(profitLossSheetComputed, provisionalDate);
    const salesEquityAvg = salesValue * newSalesAvg.toFixed(2);
    const salesEquityMed = salesValue * newSalesMed.toFixed(2);
    const salesMarketPriceAvg = salesEquityAvg / outstandingShares;
    const salesMarketPriceMed = salesEquityMed  / outstandingShares;

    let averageArray=[], medianArray=[];
    // Mapping average and median multiples
    // ** Do not change variable names from wholeAverage and wholeMedian
    // If you want to change variable names, first change average and median variables names in constant file under MULTIPLE_TYPES array
    if(selectedMultiples?.length){
      let wholeAverage = {
        pbMarketPriceAvg,
        ebitdaEquityAvg,
        salesEquityAvg,
        peMarketPriceAvg
      }
      let wholeMedian = {
        pbMarketPriceMed,
        peMarketPriceMed,
        ebitdaEquityMed,
        salesEquityMed
      }
      selectedMultiples.map((individualMultiples)=>{
        MULTIPLES_TYPE.map((constMultiples)=>{
          if(individualMultiples === constMultiples.key){
            console.log(selectedMultiples,"selected multiples")
            console.log(constMultiples.value.avg,"multiples found")
            averageArray.push(wholeAverage[constMultiples.value.avg]);
            medianArray.push(wholeMedian[constMultiples.value.med]);
          }
        })
      })
      console.log(averageArray,"average array", wholeAverage)
    }
    
    const avgPricePerShareAvg = findAverage(
    averageArray?.length ? 
    averageArray : 
      [
      pbMarketPriceAvg,
      ebitdaEquityAvg,
      salesEquityAvg,
      peMarketPriceAvg
    ]
  );
    const avgPricePerShareMed = findAverage(
    
    medianArray?.length ? 
    medianArray : 
      [
      pbMarketPriceMed,
      peMarketPriceMed,
      ebitdaEquityMed,
      salesEquityMed
    ]
  );

    const locAvg = avgPricePerShareAvg;
    const locMed = avgPricePerShareAvg;
    const finalPriceAvg = avgPricePerShareAvg - locAvg;
    const finalPriceMed = avgPricePerShareMed - locMed;
    const fairValuePerShareAvg = avgPricePerShareAvg * multiplier / outstandingShares;
    const fairValuePerShareMed = avgPricePerShareMed * multiplier / outstandingShares

    // const tentativeIssuePrice = Math.round(
    //   findAverage([finalPriceAvg, finalPriceMed]),
    // );
    let finalResult = {
      companies: companies,
      companiesInfo: '',
      // industries : industries,
      ratiotypebased : ratiotypebased,
      valuation: [
        {
          particular: 'pbRatio',
          netWorthAvg: netWorth,
          netWorthMed: netWorth,
          pbSharesAvg: outstandingShares,
          pbSharesMed: outstandingShares,
          bookValueAvg: bookValue,
          bookValueMed: bookValue,
          pbRatioAvg: newPbRatioAvg,
          pbRatioMed: newPbRatioMed,
          pbMarketPriceAvg: pbMarketPriceAvg,
          pbMarketPriceMed: pbMarketPriceMed,
        },
        {
          particular: 'peRatio',
          pat:profitLossOfYear,
          // version 1 starts
          // epsAvg: eps,
          // epsMed: eps,
          // version 1 ends
          peRatioAvg: newPeRatioAvg,
          peRatioMed: newPeRatioMed,
          peMarketPriceAvg: peMarketPriceAvg,
          peMarketPriceMed: peMarketPriceMed,
        },
        {
          particular: 'ebitda',
          ebitda: ebitdaValue,
          // ebitdaAvg: ebitdaAvg,
          // ebitdaMed: ebitdaAvg,
          evAvg: newEbitdaAvg,
          evMed: newEbitdaMed,
          enterpriseAvg: enterpriseAvg,
          enterpriseMed: enterpriseMed,
          debtAvg: debt,
          debtMed: debt,
          cashEquivalent: cashEquivalent,
          ebitdaEquityAvg: ebitdaEquityAvg,
          ebitdaEquityMed: ebitdaEquityMed,
          ebitdaSharesAvg: outstandingShares,
          ebitdaSharesMed: outstandingShares,
          ebitdaMarketPriceAvg: ebitdaMarketPriceAvg,
          ebitdaMarketPriceMed: ebitdaMarketPriceMed,
        },
        {
          particular: 'sales',
          salesAvg: salesValue,
          salesMed: salesValue,
          salesRatioAvg: newSalesAvg,
          salesRatioMed: newSalesMed,
          salesEquityAvg: salesEquityAvg,
          salesEquityMed: salesEquityMed,
          salesSharesAvg: outstandingShares,
          salesSharesMed: outstandingShares,
          salesMarketPriceAvg: salesMarketPriceAvg,
          salesMarketPriceMed: salesMarketPriceMed,
        },
        {
          particular: 'result',
          avgPricePerShareAvg: avgPricePerShareAvg,
          avgPricePerShareMed: avgPricePerShareMed,
          // averageAvg: avgPricePerShareAvg,
          // averageMed: avgPricePerShareMed,
          locAvg: locAvg,
          locMed: locMed,
          finalPriceAvg: finalPriceAvg,
          finalPriceMed: finalPriceMed,
          outstandingShares: outstandingShares,
          // outstandingShares: outstandingShares,
          fairValuePerShareAvg: fairValuePerShareAvg,
          fairValuePerShareMed:fairValuePerShareMed,

          // tentativeIssuePrice: tentativeIssuePrice,
        },
      ],
      multiples: ccmMuliple
    };
    
    finalResult = await this.factoriseResult(finalResult, selectedMultiples);
    this.customLogger.log({
      message: 'Request is sucessfully executed in Relative Valuation Service.',
      userId: inputs.userId,
    });
    return {
      result: finalResult,
      valuation: { finalPriceAvg: fairValuePerShareAvg, finalPriceMed: fairValuePerShareMed },
      msg: 'Executed Successfully',
    };
 }
 catch(error){
  throw error;
 }
  }

  async factoriseResult(data, selectedMultiple){
    const valuationData = data;
    let counter = 1, particularStruc=[];
    if(!selectedMultiple?.length){
      for await (const indStruc of MULTIPLES_TYPE){
          particularStruc.push(indStruc.particular)
      }
    }else{
      for await (const individualMultiple of selectedMultiple){
        for await (const indStruc of MULTIPLES_TYPE){
          if(individualMultiple === indStruc.key){
            particularStruc.push(indStruc.particular)
          }
        }
      }
    }
    for await (const indParticular of particularStruc){
      for await (const individualObj of valuationData.valuation){
        if( indParticular === individualObj.particular){
          individualObj['serialNo'] = counter;
        }
      }
      counter ++;
    }
    return valuationData;
  }

  async recalculateCcmValuation(payload, header){
    try{
      // Fetch entire processStateInfo
      const processStateInfo = await this.processStateManagerService.fetchProcess(payload.processStateId);
      const fourthStageDetails:any = processStateInfo.stateInfo.fourthStageInput;
      const valuationId = fourthStageDetails?.appData?.reportId;
      const valuationDate = processStateInfo.stateInfo.firstStageInput?.valuationDate;
      if(!valuationDate) return {msg: "valuation Date not found", status:false}

       let companiesList = payload.companies;
       // Firstly recalculating companies average,median based on whether they are selected or not
       const { calculatedAverage, calculatedMedian } = await this.recalculateCompanyMeanMedian(companiesList, valuationDate, header);
 
       companiesList.push(calculatedAverage, calculatedMedian)

      const otherAdjustment = convertToNumberOrZero(fourthStageDetails.data?.fourthStageInput?.appData?.otherAdj);


      // Fetch entire valuation using valuation id 
      const fetchExistingValuation = await this.valuationService.getValuationById(valuationId);

      // Send the existing valuation data and reselected companies list  for re-valuation
      const valuationRecalculatedData = await this.computeReValuation(fetchExistingValuation, companiesList, header, otherAdjustment, payload);

      return {
        status:true,
        msg:"Valuation recalculation success",
        ...valuationRecalculatedData
      }
      
    }
    catch(error){
      console.log(error,"error found")
      throw new HttpException(
        {
          error: error,
          status: false,
          msg: 'valuation recalculation failed',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async recalculateCompanyMeanMedian(companies, valuationDate, header){
    let industryAggregateList:any = [];
      for await (const individualCompanies of companies){
        if(individualCompanies.isSelected){
          industryAggregateList.push(
            {
              COMPANYID: individualCompanies.companyId
            }
          )
        }
      }

      let financialLog = new ciqGetCompanyMeanMedianDto();
      financialLog.industryAggregateList = industryAggregateList;
      financialLog.ratioType = RATIO_TYPE[0];
      financialLog.valuationDate = valuationDate;

      const headers = { 
        'Authorization':`${header.authorization}`,
        'Content-Type': 'application/json'
      }

      const companyMeanMedian = await axiosInstance.post(`${CIQ_COMPANY_MULTIPLES_MEAN_MEDIAN}`, financialLog, { httpsAgent: axiosRejectUnauthorisedAgent, headers });

      let calculatedAverage,calculatedMedian; 
      for await(const individualMeanMedian of companyMeanMedian.data.data){
        if(individualMeanMedian.company === 'Average'){
          calculatedAverage = individualMeanMedian;
        }
        if(individualMeanMedian.company === 'Median'){
          calculatedMedian = individualMeanMedian;
        }
      }

      return { calculatedAverage, calculatedMedian };
  }

  async computeReValuation(valuationBody, newCompanyList, header, otherAdjustment, body){
    try{
      // Firstly run the valuation again, using the same existing input payload
      const inputPayload = valuationBody.inputData[0];
      inputPayload.companies = newCompanyList;
      // console.log(inputPayload,"input payload found")
      // const { worksheet1, worksheet2 } = await this.fetchWorksheet(inputPayload);
      const recomputationData = await this.Relative_Valuation(inputPayload, body.multiples, true);

      // Forcefully patching the multiples selection-deselection object in the valuationData
        // recomputationData.result['multiples'] = body.multiples;

      // Replacing CCM valuation with the new one
      for await (const individualValuation of valuationBody?.modelResults){
        if(individualValuation.model === MODEL[2]){
          individualValuation.valuationData = recomputationData?.result;
          individualValuation.valuation = recomputationData?.valuation;
        }
      }
      
      const valuationWithoutInternalProps = valuationBody.toObject({ getters: true, virtuals: true });
      const { _id, ...rest} = valuationWithoutInternalProps;
      
      // Updating the CCM valuation
      await this.valuationService.createValuation(rest, _id);

      // Updating process manager 
      let mainValuationDto = new PostMainValuationDto();
      mainValuationDto.reportId = _id;
      mainValuationDto.valuationResult = valuationBody.modelResults;
      const processStateModel = {
        fourthStageInput:{
          appData: mainValuationDto,
          otherAdj: otherAdjustment,
          formFillingStatus: true
        },
        step: 4
      }
      await this.processStateManagerService.upsertProcess(this.getRequestAuth(header), processStateModel, body.processStateId);
      return mainValuationDto
    }
    catch(error){
      throw new HttpException(
        {
          error: error,
          status: false,
          msg: 're-valuation failed',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  getRequestAuth(headers){
    return {
      headers:{
         authorization:headers.authorization
       }
     } 
  }

  async fetchWorksheet(inputs){
    const valuationFileToProcess = inputs.isExcelModified === true ? inputs.modifiedExcelSheetId : inputs.excelSheetId;

    let workbook;
    try {
      workbook = XLSX.readFile(`./uploads/${valuationFileToProcess}`);
    } catch (error) {
      this.customLogger.log({
        message: `excelSheetId: ${valuationFileToProcess} not available`,
        userId: inputs.userId,
      });
      return {
        result: null,
        msg: `excelSheetId: ${valuationFileToProcess} not available`,
      };
    }

    const worksheet1 = workbook.Sheets['P&L'];
    const worksheet2 = workbook.Sheets['BS'];

    return { worksheet1, worksheet2 };
  }

  async getSheetData(processId){
    try{
      const loadExcelArchive:any = await this.excelArchiveService.fetchExcelByProcessStateId(processId);
      if(loadExcelArchive?.balanceSheetRowCount && loadExcelArchive.profitLossSheetRowCount){
        const balanceSheetData = loadExcelArchive.balanceSheetdata;
        const profitLossSheetData = loadExcelArchive.profitLossSheetdata;
        /**
         * For Relative Valuation
         * Do not need Assessment Sheet
         */
        return { profitLossSheetData, balanceSheetData };
      }
      return null;
    }
    catch(error){
      throw error;
    }
  }

  async serializeArrayObject(array){
    let excelArchive = {};
    for await (const indArchive of array){
      const {lineEntry, 'Sr no.': srNo, ...rest} = indArchive; 
      excelArchive[indArchive.lineEntry.particulars] = rest;
    }
    return excelArchive;
  }

  constructStaticMultiple(){
    const multiplesObj = {};
    MULTIPLES_TYPE.forEach((item)=>{
       multiplesObj[item.key] = true;
    })
    return multiplesObj;
  }
}
