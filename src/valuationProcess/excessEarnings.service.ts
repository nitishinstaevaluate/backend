import { Injectable } from '@nestjs/common';
import { IndustryService } from 'src/industry/industry.service';

import {
  getShareholderFunds,
  GetPAT,
  // CapitalStruc,
  // differenceAssetsLiabilities
} from 'src/excelFileServices/fcfeAndFCFF.method';
import {
  getYearsList,
  findAverage,
  findMedian,
  getDiscountingPeriod,
  calculateDaysFromDate,
  parseDate,
  getFormattedProvisionalDate,
} from '../excelFileServices/common.methods';
import { sheet1_PLObj, sheet2_BSObj, columnsList } from '../excelFileServices/excelSheetConfig';
import { CustomLogger } from 'src/loggerService/logger.service';
import { TerminalGrowthRate } from 'src/masters/schema/masters.schema';
import { GET_DATE_MONTH_YEAR_FORMAT, GET_MULTIPLIER_UNITS } from 'src/constants/constants';
const date = require('date-and-time');
@Injectable()
export class ExcessEarningsService {
  constructor(
    private readonly industryService: IndustryService,
    private readonly customLogger: CustomLogger) { }
  discountingFactorWACC: any;
  stubAdjRequired: boolean = false;
  async Excess_Earnings(
    inputs: any,
    worksheet1: any,
    worksheet2: any,
    worksheet3: any,
    // companiesInfo: any,
  ): Promise<any> {
 try{
     this.customLogger.log({
      message: 'Request is entered into Excess Earnings Model Service.',
      userId: inputs.userId,
    });
    console.log('Inside Excess Earnings');
    let adjCOE;
    const { outstandingShares, discountRateValue, valuationDate, discountingPeriod } = inputs;
    const yearsActual = await getYearsList(worksheet1);
    
    let provisionalDates = worksheet1['B1'].v
    let provDtRef = await parseDate(provisionalDates.trim());
    let diffValProv = parseInt(date.subtract(new Date(inputs.valuationDate),provDtRef).toDays()); 
    console.log('Difference in days between provisional and valuation date',diffValProv);

    // console.log('Checking years ', yearsActual);
    const years = yearsActual.slice(0,parseInt(inputs.projectionYears)+1);
    console.log('Net year ',years);
    // console.log('Checking years ', years);
    let multiplier = GET_MULTIPLIER_UNITS[`${inputs.reportingUnit}`];
    if (years === null)
      return {
        result: null,
        msg: 'Please Separate Text Label and year with comma in B1 Cell in P&L Sheet1.',
      };
    const year = new Date(valuationDate).getFullYear().toString();
    const columnIndex = years.indexOf(year);
    console.log(columnsList[columnIndex], columnIndex, year);
    let discountingPeriodValue = 0;
    const column = columnsList[columnIndex];

    const discountingPeriodObj = await getDiscountingPeriod(
      discountingPeriod
    );
    console.log(discountingPeriodObj);

    const datePayload = {
      valuationDate: new Date(inputs.valuationDate),    //since date format is in unix format
      provisionalDate: provDtRef
    }
    
      // if (diffValProv > 1) {
      //   datePayload['useProvisionalDate'] = true;    //Since we need provisional date here so adding isProvisionalDate key inside payload
      //     vdate = await calculateDaysFromDate(datePayload);
      // } else {
      //     vdate = await calculateDaysFromDate(datePayload);
      //   }
    let vdate = await calculateDaysFromDate(datePayload);
      
    // console.log('Days left ',vdate);
    // var vdayLeft = 365 - vdate;
    console.log('total days ', vdate.totalDays);
    console.log('is leap ', vdate.isLeapYear);
    if (vdate.dateDiff < vdate.totalDays) {
      this.stubAdjRequired = true;
    }



    let patAtPerpetuity = 0;
    let expectedProfitCOEAtPerpetuity = 0;
    let excessReturnAtPerpetuity = 0;
    let pvExcessReturnAtPerpetuity = 0;
    let netWorthAtPerpetuity = 0;

    if (discountingPeriodObj.result == null) return discountingPeriodObj;
    discountingPeriodValue = discountingPeriodObj.result;

    let valuation = null;
    let finalWacc = 0;
    let finalDebt = 0;
    let yearstoUse = years.slice(0, -1);
    let yearsLength = years.length;
    const yearLengthT = yearsLength - 1;
    let sumOfCashFlows = 0;
    let presentValueOfExcessReturn = 0;
    var bookValueAsOnDate = 0;

    // if (i === 0) {
      bookValueAsOnDate  = await getShareholderFunds(0, worksheet2);
    // }

    let fractionOfYearLeft = this.stubAdjRequired == true ? (vdate.dateDiff - 1) / vdate.totalDays : vdate.dateDiff / vdate.totalDays;            // Adjust based on next fiscal year
    console.log('Faction Year left ', fractionOfYearLeft);
    discountingPeriodValue = fractionOfYearLeft * discountingPeriodValue;
    console.log('Running Excess Earnings');
    const finalResult = await Promise.all(
      years.map(async (year: string, i: number) => {

        let result = {};
        let netWorth = await getShareholderFunds(i + 1, worksheet2);          // This is shareholder funds
        let pat = await GetPAT(i + 1, worksheet1);
        
        const adjustedCostOfEquity = await this.industryService.CAPM_Method(inputs);
        console.log('Net Worth',netWorth);
        adjCOE = adjustedCostOfEquity;
        console.log('adhjcoe,', adjustedCostOfEquity);
        const expectedProfitCOE = netWorth * adjustedCostOfEquity/100;
        const excessReturn = pat - expectedProfitCOE;
        // discountingPeriodValue = discountingPeriodValue * i;
        if (i === yearLengthT) {
          discountingPeriodValue = discountingPeriodValue;
        
        } else if (i === 0) {
          discountingPeriodValue = discountingPeriodValue;
        } else {
          discountingPeriodValue = discountingPeriodValue + 1;
        }

        // console.log('Discoun Val ',i," ", discountingPeriodValue);
        this.discountingFactorWACC = 1 / (1 + adjustedCostOfEquity / 100) ** (discountingPeriodValue)
        // console.log(this.discountingFactorWACC, " ",  i)
        if (i === yearLengthT) {
          const prevNetworth = await getShareholderFunds(i, worksheet2);
          const prevPAT = await GetPAT(i, worksheet1);
          patAtPerpetuity = prevPAT * (1 + parseFloat(inputs.terminalGrowthRate) / 100);
          netWorthAtPerpetuity = prevNetworth + patAtPerpetuity;
          expectedProfitCOEAtPerpetuity = netWorthAtPerpetuity * adjustedCostOfEquity / 100;
          excessReturnAtPerpetuity = (patAtPerpetuity - expectedProfitCOEAtPerpetuity) / (adjustedCostOfEquity / 100 - parseFloat(inputs.terminalGrowthRate) / 100);
          pvExcessReturnAtPerpetuity = excessReturnAtPerpetuity * this.discountingFactorWACC;
        }

        presentValueOfExcessReturn = excessReturn * this.discountingFactorWACC;
        sumOfCashFlows = presentValueOfExcessReturn + sumOfCashFlows + pvExcessReturnAtPerpetuity;

        
        // console.log('Discoun Val results ',i," ", discountingPeriodValue);
        result = {
          particulars: GET_DATE_MONTH_YEAR_FORMAT.test(year) ? `${year}` :  (i === yearLengthT) ? 'Perpetuity' : `${year}-${parseInt(year) + 1}`,
          netWorth: (i === yearLengthT) ? netWorthAtPerpetuity : netWorth,
          pat: (i === yearLengthT) ? patAtPerpetuity : pat,
          expectedProfitCOE: (i === yearLengthT) ? expectedProfitCOEAtPerpetuity : expectedProfitCOE,
          excessReturn: (i === yearLengthT) ? excessReturnAtPerpetuity : excessReturn,
          discountingPeriod: discountingPeriodValue,
          discountingFactor: this.discountingFactorWACC,
          presentValueOfExcessReturn: (i === yearLengthT) ? pvExcessReturnAtPerpetuity : presentValueOfExcessReturn,
          sumOfCashFlows: '',
          bookValue: i > 0 ? '' : bookValueAsOnDate,
          equityValue: '',
          noOfShares: i > 0 ? '' : outstandingShares,
          valuePerShare: ''
        };
        // discountingPeriodValue = discountingPeriodValue + 1;
        
        // console.log('Post results Discoun Val ', discountingPeriodValue);
        return result;
      })
    )
    finalResult[0].sumOfCashFlows = sumOfCashFlows;
    finalResult[0].equityValue = bookValueAsOnDate + sumOfCashFlows;
    finalResult[0].valuePerShare = (finalResult[0].equityValue * multiplier) / outstandingShares;       // Applying mulitplier for figures

    if (this.stubAdjRequired === true && diffValProv > 1) {
      let stubFactor = (1 + diffValProv/365) ** (adjCOE/100)-1;
      let equityValueToAdj = stubFactor * finalResult[0].equityValue;
      let keyValues = Object.entries(finalResult[0]);
      keyValues.splice(-2,0, ["stubAdjValue",equityValueToAdj]);
      keyValues.splice(-2,0, ["equityValueNew",finalResult[0].equityValue + equityValueToAdj ]);
      let newObj = Object.fromEntries(keyValues);
      finalResult[0] = newObj;
      finalResult[0].valuePerShare = ((finalResult[0].equityValue + equityValueToAdj)*multiplier)/outstandingShares;       // Applying mulitplier for figures
    }
    
    this.stubAdjRequired = false;   
    // let equityValueDate = await getFormattedProvisionalDate(new Date(provDtRef));
    const provisionalDate = provDtRef;

    const checkIfStub = finalResult.some((item,i)=>item.stubAdjValue);
    const data = await this.transformData(finalResult);
    discountingPeriodValue = 0;  
    return {
      result: finalResult,
      tableData: data.transposedResult,
      // valuation:checkIfStub ? finalResult[0].equityValueNew : finalResult[0].equityValue, //to be defined
      valuation:finalResult[0].valuePerShare, //to be defined
      columnHeader:data.columnHeader, provisionalDate,
      message: 'Valuation calcuated using excess earnings model',
      status: true
    }
 }catch(error){
  console.log("Excess Earning error:" , error)
  throw error;
 }
  }


  async transformData(data: any[]) { //only to render data on UI table
    const transformedData = [];
    const columnHeaders = data.length > 0 ? Object.keys(data[0]) : [];

    const columnIndexToRemove = columnHeaders.indexOf('particulars');
    if (columnIndexToRemove !== -1) {
      columnHeaders.splice(columnIndexToRemove, 1);
    }

    columnHeaders.unshift('particulars');
    transformedData.push(columnHeaders);

    for (const item of data) {
      const row = [];
      row.push(item.particulars);
      for (const key of columnHeaders.slice(1)) {
        row.push(item[key]);
      }
      transformedData.push(row);
    }
    const firstElements = [];
    transformedData.map(innerArray => {
      if (innerArray.length > 0) {
        firstElements.push(innerArray[0]);
      }
      });
      return {transposedResult : transformedData, columnHeader : firstElements};
  }
}

