import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { IndustryService } from 'src/industry/industry.service';
import  {
  DepAndAmortisation,
  OtherNonCashItemsMethod,
  OtherNonCashItemsMethodNext,
  ChangeInNCA,
  CostOfDebt,
  ProportionOfDebt,
  ProportionOfEquity,
  POPShareCapital,
  CapitalStructure,
  POPShareCapitalLabelPer,
  getShareholderFunds,
  fcfeTerminalValue,
  fcffTerminalValue,
  capitalStructureComputation,
  v2otherNonOperatingAssetsComputation,
  v2interestAdjustedTaxes,
  v2changeInNcaFromAssessment,
  v2DeferredTaxAssets,
  v2changeInFixedAsset,
  v2GetDebtAsOnDate,
  v2CashEquivalents,
  v2SurplusAssets,
  v2ChangeInBorrowings,
  v2NetOperatingAssetsFromAssessment,
  v2PatComputation,
  // differenceAssetsLiabilities
} from '../excelFileServices/fcfeAndFCFF.method';
import { getYearsList, calculateDaysFromDate,getCellValue,getDiscountingPeriod,searchDate, parseDate, getFormattedProvisionalDate, calculateDateDifference, convertToNumberOrZero, getRequestAuth, extractYearsFromKeys, getDateKey } from '../excelFileServices/common.methods';
import { sheet1_PLObj, sheet2_BSObj ,columnsList} from '../excelFileServices/excelSheetConfig';
import { CustomLogger } from 'src/loggerService/logger.service';
import { BALANCE_SHEET, EXCEL_CONVENTION, GET_DATE_MONTH_YEAR_FORMAT, GET_MULTIPLIER_UNITS, MODEL } from 'src/constants/constants';
import { any } from 'joi';
import { async } from 'rxjs';
import { transformData } from 'src/report/report-common-functions';
import { terminalValueWorkingService } from './terminal-value-working.service';
import { ProcessStatusManagerService } from 'src/processStatusManager/service/process-status-manager.service';
import { ValuationsService } from './valuationProcess.service';
import * as XLSX from 'xlsx';
import e from 'express';
import { PostDcfValuationDto, PostMainValuationDto } from './dto/valuations.dto';
import { SensitivityAnalysisService } from 'src/sensitivity-analysis/service/sensitivity-analysis.service';
import { authenticationTokenService } from 'src/authentication/authentication-token.service';
import { ExcelArchiveService } from 'src/excel-archive/service/excel-archive.service';
const date = require('date-and-time');

@Injectable()
export class FCFEAndFCFFService {
  constructor(
    private readonly industryService: IndustryService,
    private readonly customLogger: CustomLogger,
    private readonly processManagerService: ProcessStatusManagerService,
    private readonly valuationService: ValuationsService,
    private readonly terminalYearWorkingService: terminalValueWorkingService,
    private readonly sensitivityAnalysisService: SensitivityAnalysisService,
    private readonly authenticationTokenService: authenticationTokenService,
    private readonly excelArchiveService: ExcelArchiveService
  ) {}

  //Common Method for FCFE and FCFF Methods
  
  discountingPeriodObj : any;
  discountingFactorWACC : any;
  stubAdjRequired:boolean = false;
  // async FCFEAndFCFF_Common(
  //   inputs: any,
  //   worksheet1: any,
  //   worksheet2: any,
  //   worksheet3: any,
  // ): Promise<any> {
  //   try{
  //   this.customLogger.log({
  //     message: 'Request is entered into FCFEAndFCFF Service.',
  //     userId: inputs.userId,
  //   });
  //   const { outstandingShares, discountingPeriod, popShareCapitalType } =
  //     inputs;
  //     // console.log(inputs);
  //     // discountingPeriodValue:number: 0;
  //     let equityValue = 0;
  //     let adjCOE;
  //     let adjustedCostOfEquity;
  //     let multiplier = GET_MULTIPLIER_UNITS[`${inputs.reportingUnit}`];
  //     let discountingPeriodValue = 0;
      
  //   const yearsActual = await getYearsList(worksheet1);
    
  //   let provisionalDates = worksheet1['B1'].v
  //   // console.log(' Valuation Date ', inputs.valuationDate)
  //   // console.log('Provisional Date ', provisionalDates);
  //   // console.log(typeof(provisionalDates),'a','a',provisionalDates.trim());
  //   // console.log(typeof('02-01-2015'));
  //   // let provDtRef = date.parse(provisionalDates.trim(), 'DD-MM-YYYY');
  //   let  provDtRef = parseDate(provisionalDates.trim());
  //   // console.log(provDtRef,"prov date",typeof provDtRef);
  //   let diffValProv = parseInt(date.subtract(new Date(inputs.valuationDate),provDtRef).toDays()); 
  //   console.log('Difference in days between provisional and valuation date',diffValProv);

  //   // const provStr = provisionalDates.split(",");
    
  //   // let provDtRef = new date(provisionalDates);
  //   // console.log('Provisional Dates ', provDtRef);
  //   // console.log(provStr.slice(-1).trim());
    
  //   const years = yearsActual.slice(0,parseInt(inputs.projectionYears)+1);
  //   console.log('Net year ',years);
  //   if (years === null)
  //     return {
  //       result: null,
  //       msg: 'Please Separate Text Label and year with comma in B1 Cell in P&L Sheet1.',
  //     };
  //   const discountingPeriodObj = await getDiscountingPeriod(
  //     discountingPeriod
  //   );
    
  //     //c------ Start Sample ----------//
  //   // const valuationDate = new Date(inputs.valuationDate);
  //   // let updDate = date.addDays(valuationDate,1)
  //   // console.log('Valuation Date ', updDate);

  //   // const valuationMonth = updDate.getMonth();
  //   // console.log('Month ',valuationMonth);

  //   //c------ End Sample ----------//
  //   const datePayload = {
  //     valuationDate: new Date(inputs.valuationDate),    //since date format is in unix format
  //     provisionalDate: provDtRef
  //   }
  //   let vdate;
  //   if (diffValProv > 1) {
  //       datePayload['useProvisionalDate'] = true;    //Since we need provisional date here so adding isProvisionalDate key inside payload
  //       vdate = await calculateDaysFromDate(datePayload);
  //   } else {
  //       vdate = await calculateDaysFromDate(datePayload);
  //   }

  //   // console.log('Days left ',vdate);
  //   // var vdayLeft = 365 - vdate;
  //   const monthToCheckProv = provDtRef.getMonth() === 0 || provDtRef.getMonth() === 1 || provDtRef.getMonth() === 2;
  //   let provAdjYears:Array<string> = [], counter = 0;
  //   if (!vdate.isProvisionalYearFull && monthToCheckProv) {
  //     for await (const indYear of yearsActual){
  //       if(counter === 0){
  //         provAdjYears.push(`${+indYear-1}`)
  //       }
  //       provAdjYears.push(indYear);
  //       counter++;
  //     }
  //     console.log(provAdjYears,"provisional adjusted years--->120")
  //   }



  //   console.log('total days ',vdate.totalDays);
  //   console.log('is leap ',vdate.isLeapYear);
  //   if (diffValProv > 1 || vdate.dateDiff < vdate.totalDays ) {
  //   // if (vdate.dateDiff < vdate.totalDays) {
  //     this.stubAdjRequired = true;
  //   }
  //   console.log('Which period, is STUB needed?',this.stubAdjRequired);
  //   // vdayLeft = vdayLeft <= 1 ? 365 : vdayLeft;

  //   console.log('Days left in financial year ', vdate.dateDiff);
  //   // if (vday <= 90) {
  //   //   vdayLeft = 90 - vday;
  //   // } else {
  //   //   vdayLeft = 365 - vday - 90;
  //   // }
    
  //   if (popShareCapitalType === 'DFBS_PC') {
  //     const popShareCapitalValue = await POPShareCapitalLabelPer(0, worksheet2);
  //     if (popShareCapitalValue > 100)
  //       return {
  //         result: null,
  //         msg: 'Invalid: Preference Share Capital % value.',
  //       };
  //   }
    
  //   if (discountingPeriodObj.result == null) return discountingPeriodObj;
  //   discountingPeriodValue = discountingPeriodObj.result;
  //   // console.log('Discoun Val ',discountingPeriod,discountingPeriodValue );

  //   console.log('Discoun Val ',discountingPeriodValue);
    
  //   let fractionOfYearLeft = this.stubAdjRequired == true ? (vdate.dateDiff-1)/ vdate.totalDays: vdate.dateDiff/vdate.totalDays;            // Adjust based on next fiscal year
  //   console.log('Faction Year left ', fractionOfYearLeft);
  //   discountingPeriodValue = fractionOfYearLeft * discountingPeriodValue;      // To be used as in WACC Calc next
  //   console.log('discountingPeriodValue ',discountingPeriodValue);
  //   let valuation = null;
  //   let finalWacc = 0;
  //   let finalDebt = 0;
  //   let yearstoUse = years.slice(0, -1);
  //   let yearsLength = years.length;
  //   const yearLengthT = yearsLength - 1;
  //   let sumOfCashFlows = 0;
  //   // let debtAsOnDate = 0;
  //   let calculatedWacc = 0;
  //   let capitalStruc;
    
  //   // console.log(yearsLength);
  //   const finalResult = await Promise.all(
  //     years.map(async (year: string, i: number) => {
        
  //       let changeInNCA = null;
  //       let deferredTaxAssets = null;
  //       let changeInBorrowingsVal = 0;
  //       let addInterestAdjTaxes = 0;
  //       let addInterestAdjustedTaxesStub = 0;
  //       let result = {};
  //       // let fcff = 0;
  //       let fcfeValueAtTerminalRate = 0;
  //       let fcffValueAtTerminalRate = 0;
  //       let netOperatingAssets;
  //       let netOperatingAssetsInit = 0;
  //       // let equityValue =0;
  //       let presentFCFF = 0;
        
  //       //Get PAT value

  //       // console.log('discountingPeriodValue ',discountingPeriodValue);
  //       // For mid year calculation need nextPAT,depAndAmortisationNext

  //       // console.log("Value of i ",i);
  //       const patNext = await getCellValue(
  //         worksheet1,
  //         `${columnsList[i+1] + sheet1_PLObj.patRow}`,
  //       );
  //       const depAndAmortisationNext = await getCellValue(
  //         worksheet1,
  //         `${columnsList[i+1] + sheet1_PLObj.depAndAmortisationRow}`,
  //       );

  //       let pat = await GetPAT(i+1, worksheet1);
  //       let patOld = await GetPAT(i,worksheet1);
  //       pat = i === 0 && this.stubAdjRequired == true && vdate.isProvisionalYearFull == false  ? pat-patOld : pat;
  //       // if (pat !== null) pat = pat;
  //       // pat = i === 0 ? patNext - pat:pat;
  //       console.log('PAT ',pat);
  //       //Get Depn and Amortisation value
  //       let depAndAmortisation = await DepAndAmortisation(i+1, worksheet1);
  //       let depAndAmortisationOld = await DepAndAmortisation(i, worksheet1);

  //       // netOperatingAssets = await differenceAssetsLiabilities(i,worksheet3);
  //       // const netOperatingDifference = i === 0 ? 0 : netOperatingAssets-netOperatingAssetsInit;
  //       // netOperatingAssetsInit = netOperatingAssets;   // Storing past value to get difference
        

  //       depAndAmortisation = i === 0 && this.stubAdjRequired == true && vdate.isProvisionalYearFull == false  ? depAndAmortisation - depAndAmortisationOld:depAndAmortisation;

  //       //Get Oher Non Cash items Value
  //       let otherNonCashItems = await OtherNonCashItemsMethod(i+1, worksheet1);
  //       let otherNonCashItemsOld = await OtherNonCashItemsMethodNext(i, worksheet1);
  //       otherNonCashItems = i === 0 && this.stubAdjRequired == true && vdate.isProvisionalYearFull == false ? otherNonCashItems - otherNonCashItemsOld : otherNonCashItems;
  //       const changeInNCAValue = await ChangeInNCA(i, worksheet2,worksheet3);
  //       changeInNCA = changeInNCAValue;

  //       const deferredTaxAssetsValue = await DeferredTaxAssets(i, worksheet2);
  //       deferredTaxAssets =  deferredTaxAssetsValue;
        
  //       var changeInFixedAssets = await ChangeInFixedAssets(i, worksheet2);
  //       // if (i===0) {
  //       adjustedCostOfEquity = await this.industryService.CAPM_Method(inputs);
  //       adjCOE = adjustedCostOfEquity;        // To be used outside block;
  //       console.log("Adjusted COE ",adjustedCostOfEquity );
  //       // }
  //       // console.log('Change in Net Fixed Assets ', changeInFixedAssets);
        
  //       // console.log('disc ', discountingPeriodValue);
  //       // var ndiscountingPeriodValue = discountingPeriodValue + 1
       


        
  //       // console.log('WACC Value - ',this.discountingFactorWACC);
  //       // if (i === 0)        // Control from here not to print next set of values
  //                                                                      // old code ->     discountingFactorValue * fcff;
        
  //       // console.log('out disc ', discountingPeriodValue);
  //       // const sumOfCashFlows = 1000000; //presentFCFF;                                                     // To be checked
  //       let debtAsOnDate = await GetDebtAsOnDate(i, worksheet2);
  //       const cashEquivalents = await CashEquivalents(i, worksheet2);
  //       const surplusAssets = await SurplusAssets(i, worksheet2);
  //       changeInBorrowingsVal = await changeInBorrowings(i, worksheet2);
  //       // console.log('Borrowings, ',changeInBorrowingsVal);
  //       addInterestAdjTaxes = await interestAdjustedTaxes(i,worksheet1,inputs.taxRate);
  //       addInterestAdjustedTaxesStub = await interestAdjustedTaxesWithStubPeriod(i,worksheet1,inputs.taxRate);
  //       addInterestAdjTaxes = i === 0 && this.stubAdjRequired == true && vdate.isProvisionalYearFull == false  ? addInterestAdjustedTaxesStub:addInterestAdjTaxes;
        
      
  //       // if (i === 0 && inputs.model.includes('FCFF')){      // optimize code not to run this block multiple times
  //       // Adding i = 0 check is causing discounting period to work incorrectly in first column
        
  //       const shareholderFunds = await getShareholderFunds(0,worksheet2);
        
  //         capitalStruc = await CapitalStruc(0,worksheet2,shareholderFunds,inputs);
        
  //       console.log(capitalStruc);
  //       calculatedWacc = adjustedCostOfEquity/100 * capitalStruc.equityProp + (parseFloat(inputs.costOfDebt)/100)*(1-parseFloat(inputs.taxRate)/100)*capitalStruc.debtProp + parseFloat(inputs.copShareCapital)/100 * capitalStruc.prefProp;
  //       // finalWacc = calculatedWacc;
  //       // console.log(debtAsOnDate,"debt as on date fcff")  
  //       // finalDebt = debtAsOnDate;
  //     // }
  //       console.log('WACC Calculat- ',i,' ',calculatedWacc);
  //       const otherAdj = parseFloat(inputs.otherAdj);                                                       // ValidateHere
  //       //formula: =+B16-B17+B18+B19+B20
  //       // console.log('out disc ', discountingPeriodValue);

        
  //       let netCashFlow =0 ;
  //       if (inputs.model.includes('FCFE')) {
          
  //         netCashFlow = pat + depAndAmortisation + otherNonCashItems + changeInNCA + deferredTaxAssets + changeInBorrowingsVal;
  //       } else {
  //         netCashFlow = pat + depAndAmortisation + otherNonCashItems + changeInNCA + deferredTaxAssets  + addInterestAdjTaxes;
  //       }
          
  //       changeInFixedAssets = changeInFixedAssets - depAndAmortisation;
  //       const fcff = netCashFlow + changeInFixedAssets ;    
  //       console.log("Value at ",fcff,' ',i, ' ', yearLengthT);
  //       // Calculate wacc for FCFF
  //       // =+D22*D30+D26*(1-D7)*D29+D24*D31

  //       // this.calculatedWacc = adjustedCostOfEquity * capitalStruc.equityProp + (inputs.costOfDebt/100)*(1-inputs.taxRate/100)*capitalStruc.debtProp + inputs.copShareCapital/100 * capitalStruc.prefProp

  //       if  (i === yearLengthT && inputs.model.includes('FCFE')) {                                // Valuation data
  //       fcfeValueAtTerminalRate = await fcfeTerminalValue(valuation,inputs.terminalGrowthRate,adjustedCostOfEquity)
  //       console.log('ter val ',fcfeValueAtTerminalRate,' ', valuation);
  //       // console.log('fcfe ter ', fcfeValueAtTerminalRate)
  //       discountingPeriodValue = discountingPeriodValue - 1;
  //       } else if (i === yearLengthT && inputs.model.includes('FCFF')) {  
  //         fcfeValueAtTerminalRate = await fcffTerminalValue(valuation,inputs.terminalGrowthRate, finalWacc)
  //         discountingPeriodValue = discountingPeriodValue - 1;
  //       }
  //       // console.log('Term - ',fcffValueAtTerminalRate);
        
  //       if (i === 0) {                      // 
  //       finalWacc = calculatedWacc;
  //       finalDebt = debtAsOnDate;
  //       }

  //       // console.log('discountingPeriodValue ',discountingPeriodValue);
  //         // console.log('Final Deb ',finalDebt);
  //       if (inputs.model.includes('FCFE')) {
  //         // changeInBorrowingsVal = await changeInBorrowings(i, worksheet2);
  //         if (i === yearLengthT) {
  //           // Do nothing
  //         } else {
  //         this.discountingFactorWACC = 1/ (1+adjustedCostOfEquity/100) ** (discountingPeriodValue)
  //         }
  //         console.log('Disc COE ', this.discountingFactorWACC)
         
  //       } else if (inputs.model.includes('FCFF')) {
  //         // addInterestAdjTaxes = await interestAdjustedTaxes(i,worksheet1,inputs.taxRate);
  //         if (i === yearLengthT) {
  //           // Do nothing
  //         } else {
  //         this.discountingFactorWACC = 1/ (1+finalWacc) ** (discountingPeriodValue)
  //         }
  //         console.log('Disc WACC ', this.discountingFactorWACC)
        
  //       } 
  //       valuation = fcff;
        
  //       // console.log('Disounting factor ',this.discountingFactorWACC,' ',fcff)
  //       if  (i === yearLengthT){
  //         // if (inputs.model === 'FCFE') {
  //         //   presentFCFF = this.discountingFactorWACC * fcfeValueAtTerminalRate
  //         // } else {
  //           presentFCFF = this.discountingFactorWACC * fcfeValueAtTerminalRate
          
  //       } else {
  //         presentFCFF = this.discountingFactorWACC * fcff
  //       }
  //       console.log("Present FCFF ",presentFCFF);
  //       sumOfCashFlows = presentFCFF + sumOfCashFlows;
  //       console.log('Sum of cash flow ',i, ' ' ,sumOfCashFlows, 'Eq ',cashEquivalents, 'Surpla ', surplusAssets,'Other ', otherAdj);
  //       if  (i === 0) {                     // To be run for first instance only
  //         equityValue =
  //         // sumOfCashFlows +
  //         // debtAsOnDate +
  //         cashEquivalents +
  //         surplusAssets +
  //         otherAdj;
  //       }
  //       // equityValue = equityValue + sumOfCashFlows;
  //       // const valuePerShare = equityValue / outstandingShares;
  //       if (inputs.model.includes('FCFE')) {
  //       result = {
  //         particulars: GET_DATE_MONTH_YEAR_FORMAT.test(year) ? `${year}` :  (i === yearLengthT) ?'Terminal Value':`${year}-${parseInt(year)+1}`,
  //         pat: (i === yearLengthT) ?'':pat,
  //         depAndAmortisation: (i === yearLengthT) ?'':depAndAmortisation,
  //         onCashItems: (i === yearLengthT) ?'':otherNonCashItems,
  //         nca: (i === yearLengthT) ?'':changeInNCA,
  //         changeInBorrowings: (i === yearLengthT) ?'':changeInBorrowingsVal,
  //         defferedTaxAssets: (i === yearLengthT) ?'':deferredTaxAssets,
  //         netCashFlow: (i === yearLengthT) ?'':netCashFlow,
  //         fixedAssets: (i === yearLengthT) ?'':changeInFixedAssets,
  //         fcff: (i === yearLengthT) ?fcfeValueAtTerminalRate:fcff,
  //         discountingPeriod: discountingPeriodValue,
  //         discountingFactor: this.discountingFactorWACC,
  //         presentFCFF: presentFCFF,
  //         sumOfCashFlows: '',
  //         // debtOnDate: i> 0?'':finalDebt,
  //         cashEquivalents: i> 0?'':cashEquivalents,
  //         surplusAssets: i> 0?'':surplusAssets,
  //         otherAdj: i> 0?'':otherAdj,
  //         equityValue: '',
  //         noOfShares: i> 0?'':outstandingShares,
  //         valuePerShare: '',
  //         // totalFlow: this.discountingFactorWACC + i
  //       }; 
  //     } else if (inputs.model.includes('FCFF')) {
  //       result = {
  //         particulars: GET_DATE_MONTH_YEAR_FORMAT.test(year) ? `${year}` :  (i === yearLengthT) ?'Terminal Value':`${year}-${parseInt(year)+1}`,
  //         pat: (i === yearLengthT) ?'':pat,
  //         addInterestAdjTaxes: (i === yearLengthT) ?'':addInterestAdjTaxes,
  //         depAndAmortisation: (i === yearLengthT) ?'':depAndAmortisation,
  //         onCashItems: (i === yearLengthT) ?'':otherNonCashItems,
  //         nca: (i === yearLengthT) ?'':changeInNCA,
  //         defferedTaxAssets: (i === yearLengthT) ?'':deferredTaxAssets,
  //         netCashFlow: (i === yearLengthT) ?'':netCashFlow,
  //         fixedAssets: (i === yearLengthT) ?'':changeInFixedAssets,
  //         fcff: (i === yearLengthT) ?fcfeValueAtTerminalRate:fcff,
  //         discountingPeriod: discountingPeriodValue,
  //         discountingFactor: this.discountingFactorWACC,
  //         presentFCFF: presentFCFF,
  //         sumOfCashFlows: '',
  //         debtOnDate: i> 0?'':finalDebt,
  //         cashEquivalents: i> 0?'':cashEquivalents,
  //         surplusAssets: i> 0?'':surplusAssets,
  //         otherAdj: i> 0?'':otherAdj,
  //         equityValue: '',
  //         noOfShares: i> 0?'':outstandingShares,
  //         valuePerShare: '',
  //       }; 
  //     }
  //       discountingPeriodValue = discountingPeriodValue + 1;    
  //       // console.log(result);
  //       return result;
  //     }),
  //   );
    
  //   // let lastElement = finalResult.slice(-1);
  //   finalResult[0].sumOfCashFlows = sumOfCashFlows;
  //   finalResult[0].equityValue = inputs.model.includes('FCFE')? equityValue + sumOfCashFlows:equityValue + sumOfCashFlows - finalDebt;
  //   finalResult[0].valuePerShare = (finalResult[0].equityValue*multiplier)/outstandingShares;       // Applying mulitplier for figures
  //   // delete finalResult[0].totalFlow;                        // Remove to avoid showing up in display
    
  //   if (this.stubAdjRequired === true && diffValProv > 1) {
  //     // console.log("gar ",diffValProv);
  //     let stubFactor = (1 + diffValProv/365) ** (adjCOE/100)-1;

  //     // console.log(stubFactor);
  //     let equityValueToAdj = stubFactor * finalResult[0].equityValue;
  //     console.log('Stub Factor ',stubFactor);
  //     let keyValues = Object.entries(finalResult[0]);
  //     keyValues.splice(-2,0, ["stubAdjValue",equityValueToAdj]);
  //     keyValues.splice(-2,0, ["equityValueNew",finalResult[0].equityValue + equityValueToAdj ]);
  //     let newObj = Object.fromEntries(keyValues);
  //     finalResult[0] = newObj;
  //     finalResult[0].valuePerShare = ((finalResult[0].equityValue + equityValueToAdj)*multiplier)/outstandingShares;       // Applying mulitplier for figures
  //     // console.log('new EPV ',((finalResult[0].equityValue + equityValueToAdj)*100000)/outstandingShares);
  //   }

  //   // let equityValueDate = await getFormattedProvisionalDate(new Date(provDtRef));
  //   const provisionalDate = provDtRef;
    
  //   this.stubAdjRequired = false;                              // Resetting to default;
  //   const checkIfStub = finalResult.some((item,i)=>item.stubAdjValue);
  //   const data = await this.transformData(finalResult);
  //   return { result: finalResult, tableData:data.transposedResult, valuation:checkIfStub? finalResult[0].equityValueNew :finalResult[0].equityValue,columnHeader:data.columnHeader,provisionalDate,
  //     msg: 'Executed Successfully' };
  // }catch(error){
  //   console.log(error)
  //   throw  error;
  // }
  // }

  async fcfeAndFcffValuation(body:any){
    try{
      const dataInputs = body.inputs;
      // const worksheet1 = body.worksheet1;
      // const worksheet2 = body.worksheet2;

      const processId = dataInputs?.processStateId;

      const {balanceSheetData, profitLossSheetData, assessmentSheetData} = await this.getSheetData(processId);
      const yearsList = extractYearsFromKeys(balanceSheetData[0]);
      const getProvDate = getDateKey(balanceSheetData[0]);
      const { outstandingShares } = dataInputs;
      let multiplier = GET_MULTIPLIER_UNITS[`${dataInputs.reportingUnit}`];

      const  costOfEquity =  await this.computeCostOfEquity(dataInputs, balanceSheetData);

      // const yearsActual = await getYearsList(worksheet2);

      // let provisionalDates = worksheet1['B1'].v || worksheet2['B1'].v;
      let  provDtRef = parseDate(getProvDate.trim());
      console.log(provDtRef,"provisional date")

      const decodeValuationDate =  new Date(dataInputs.valuationDate);    //Since valuation date is in unix time stamp, we need to convert it into readable date format which is eg. 2023-03-30T18:30:00.000Z
      console.log(decodeValuationDate, "valuation date")

      const isStubRequired = await this.isStubRequired(provDtRef, decodeValuationDate); //checking if stub is required or not
      console.log(isStubRequired, "stub required")

      let totalDaysDifferenceStubAdjustment, totalDaysDifferenceDiscountingFactor;

      if(isStubRequired){
        totalDaysDifferenceStubAdjustment = await this.subtractProvisionalDateByValuationDate(provDtRef, decodeValuationDate); //calculating number of days from provisional date - valuation date difference
        console.log(totalDaysDifferenceStubAdjustment," total days difference in stub adjustment")
      }

    const isDiscountingFactorAdjustmentRequired = await this.isDiscountingFactorRequired(provDtRef);  //checking if discountingFactorAdjustment is required or not
    if(isDiscountingFactorAdjustmentRequired){
      totalDaysDifferenceDiscountingFactor = await this.subtractValuationDateByFincancialYearEndDate(decodeValuationDate, provDtRef);   //calculating number of days from valuation date - financial year end date difference
    }
    console.log(isDiscountingFactorAdjustmentRequired," discounting factor required")

    const checkPartialFinancialYear = await this.checkPartialFinancialYear(provDtRef);  //checking if the provisional year is partial or not, if partial then implementing the subtraction of first and second columns logic below

    console.log(checkPartialFinancialYear,"partial financial year")

    const years = yearsList.slice(0,parseInt(dataInputs.projectionYears)+1);

    const aggregateBody = {
      years,
      ...body,
      isStubRequired,
      totalDaysDifferenceStubAdjustment,
      isDiscountingFactorAdjustmentRequired,
      totalDaysDifferenceDiscountingFactor,
      checkPartialFinancialYear,
      provDtRef,
      balanceSheetData,
      profitLossSheetData,
      assessmentSheetData
    }

    const resultAggregate:any = await this.assessValuation(aggregateBody); //calculating whole aggregate 
    
    
    if (isStubRequired && totalDaysDifferenceStubAdjustment > 1) { //based on the above conditions, calculating stub
      let stubFactor = (1 + totalDaysDifferenceStubAdjustment/365) ** (costOfEquity/100)-1;
      let equityValueToAdj = stubFactor * resultAggregate.resultArray[0].equityValue;
      
      // let equityValueToAdj = +resultAggregate[0].equityValue  * (Math.pow(1 + ((costOfEquity/100)/ 365), totalDaysDifferenceStubAdjustment ) - 1); // Confirmation pending 
      console.log('Stub Factor ',stubFactor);
      let keyValues = Object.entries(resultAggregate.resultArray[0]);
      keyValues.splice(-2,0, ["stubAdjValue",equityValueToAdj]);
      keyValues.splice(-2,0, ["equityValueNew",resultAggregate.resultArray[0].equityValue + equityValueToAdj ]);
      let newObj = Object.fromEntries(keyValues);
      resultAggregate.resultArray[0] = newObj;
      resultAggregate.resultArray[0].valuePerShare = ((resultAggregate.resultArray[0].equityValue + equityValueToAdj)*multiplier)/outstandingShares;       // Applying mulitplier for figures
    }
    
      const provisionalDate = provDtRef;                          // Resetting to default;
      const checkIfStub = resultAggregate.resultArray.some((item,i)=>item.stubAdjValue);
      const data = await this.transformData(resultAggregate.resultArray);
      return {
        result: resultAggregate.resultArray, tableData:data.transposedResult, 
        // valuation:checkIfStub? resultAggregate.resultArray[0].equityValueNew :resultAggregate.resultArray[0].equityValue,
        valuation:resultAggregate.resultArray[0].valuePerShare,
        columnHeader:data.columnHeader,provisionalDate,
        terminalValueWorking:resultAggregate.terminalValueWorking,
        msg: 'Executed Successfully' 
      };
    }
    catch(error){
      console.log(error,"error ---> 552")
      throw new HttpException(
        {
          error: error,
          status: false,
          msg: 'valuation computation failed',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
    }

    async computeCostOfEquity(inputs, balanceSheetData){
      let costOfEquity = 0 
      if(inputs?.model?.includes('FCFE')){
        costOfEquity = await this.industryService.CAPM_Method(inputs);
      }
      else if(inputs?.model?.includes('FCFF')){
        const adcoe = await this.industryService.CAPM_Method(inputs);
        const provisionalDate = getDateKey(balanceSheetData[0]);
        const balanceSheetComputed = await this.serializeArrayObject(balanceSheetData);
        const capitalStruc = await capitalStructureComputation(provisionalDate, balanceSheetComputed, inputs);
        const calculateWaccPayload = {
          adjustedCostOfEquity:adcoe,
          capitalStruc,
          costOfDebt: inputs.costOfDebt,
          taxRate: inputs.taxRate,
          copShareCapital: inputs.copShareCapital
        }
        const wacc = await this.calculateWacc(calculateWaccPayload);
        costOfEquity = wacc ? wacc * 100 : 0;
      }
      return costOfEquity;
    }

    async checkPartialFinancialYear(provisionalDate:any){
      const cleanProvisionalDate = new Date(provisionalDate);

      const provisionalMonth = cleanProvisionalDate.getMonth() + 1; // Since months are zero-based (0-Jan, 1-Feb, ..., 11-Dec)
      const provisionalDay = cleanProvisionalDate.getDate();

      // Check if not equal to 31st March
      if (provisionalMonth !== 3 || provisionalDay !== 31) { // March is month index 2
          return true; // Return true indicating partial financial year
      } else {
          return false; // Return false indicating full financial year
      }
    }

    async subtractProvisionalDateByValuationDate(provisionalDate:any, valuationDate:any){
      const cleanProvisionalDate:any = new Date(provisionalDate);
      const cleanValuationDate:any = new Date(valuationDate);

       const differenceInMilliseconds = cleanValuationDate - cleanProvisionalDate;

       // Convert the difference to days (divide by milliseconds in a day)
      const differenceInDays = differenceInMilliseconds / (1000 * 60 * 60 * 24);

      return differenceInDays;
    }

    async subtractValuationDateByFincancialYearEndDate(valuationDate:any, provisionalDate:any){
      const cleanValuationDate:any = new Date(valuationDate);
      const cleanProvisionalDate:any = new Date(provisionalDate);
  
      // End of the financial year (31st March of the financial year)
      const fiscalYearEnd:any = await this.computeFinancialYearEndDate(cleanProvisionalDate); //computing financial year

      const differenceInMilliseconds =  fiscalYearEnd - cleanValuationDate;
  
      // Convert the difference to days (divide by milliseconds in a day)
      const differenceInDays = differenceInMilliseconds / (1000 * 60 * 60 * 24);
  
      return differenceInDays;
    }

    async computeFinancialYearEndDate(provisionalDate){    //Always pass provisioanl date it will give you  only financial year
      const cleanProvisionalDate = new Date(provisionalDate);

      const provisionalYear = cleanProvisionalDate.getFullYear();

      const provisionalBasedFinancialYear = new Date(provisionalYear, 2, 31);

      const currentYear = new Date().getFullYear();
      const currentFinancialDate = new Date(currentYear, 2, 31);

      const fiscalYearEnd:any = new Date(currentYear, 2, 31); // March is month index 2

      return cleanProvisionalDate <= fiscalYearEnd ? provisionalBasedFinancialYear : currentFinancialDate; 
    }

    async isStubRequired(provisionalDate, valuationDate){
      const cleanValuationDate = new Date(valuationDate);
      const cleanProvisionalDate = new Date(provisionalDate);

      return cleanValuationDate.getTime() > cleanProvisionalDate.getTime();
    }

    async isDiscountingFactorRequired(provisionalDate){
      const cleanProvisionalDate = new Date(provisionalDate);

      const provisionalDay = cleanProvisionalDate.getDate();
      const provisionalMonth = cleanProvisionalDate.getMonth() + 1; // Since months are zero-based (0-Jan, 1-Feb, ..., 11-Dec)

      // Compare with 31st March 2023
      return !(provisionalMonth === 3 && provisionalDay === 31);    //Since we need to check if provisional date is of 31st if the provisional date is equal to 31st, march 2023 then discounting adjustment factor is applicable
    }

    async recalculatePat(index,keysToProcess, profitLossData, operationRequired?){
      if(operationRequired){
        let pat = await v2PatComputation(keysToProcess[index+1], profitLossData);
        let patOld = await v2PatComputation(keysToProcess[index],profitLossData);
        return pat-patOld;
      }
      else{
        return await v2PatComputation(keysToProcess[index], profitLossData);
      }
    }

    async recalculateDepnAndAmortisation(index, keysToProcess, profitLossData, operationRequired?){
      if(operationRequired){
        let depAndAmortisation = await DepAndAmortisation(keysToProcess[index+1], profitLossData);
        let DepAndAmortisationOld = await DepAndAmortisation(keysToProcess[index],profitLossData);
        return depAndAmortisation-DepAndAmortisationOld;
      }
      else{
        return await DepAndAmortisation(keysToProcess[index], profitLossData);
      }
    }

    async recalculateOtherNonCashItems(index, keysToProcess,  profitLossData, operationRequired?){
      if(operationRequired){
        let otherNonCashItem = await v2otherNonOperatingAssetsComputation(keysToProcess[index+1], profitLossData);
        let otherNonCashItemOld = await v2otherNonOperatingAssetsComputation(keysToProcess[index],profitLossData);
        return otherNonCashItem-otherNonCashItemOld;
      }
      else{
        return await v2otherNonOperatingAssetsComputation(keysToProcess[index], profitLossData);
      }
    }

    async recalculateInterestAdjustedTaxes(index, keysToProcess,  profitLossData, taxRate, operationRequired?){
      if(operationRequired){
        let otherNonCashItem = await v2interestAdjustedTaxes(keysToProcess[index+1], profitLossData);
        let otherNonCashItemOld = await v2interestAdjustedTaxes(keysToProcess[index],profitLossData);
        return (otherNonCashItem-otherNonCashItemOld) * (1 - parseFloat(taxRate) / 100);
      }
      else{
        return (await v2interestAdjustedTaxes(keysToProcess[index], profitLossData)) * 
        (1 - parseFloat(taxRate) / 100);
      }
    }

    async calculateWacc(waccPayload){
      return waccPayload.adjustedCostOfEquity/100 * waccPayload.capitalStruc.equityProp + 
          (
            parseFloat(waccPayload.costOfDebt)/100)*(1-parseFloat(waccPayload.taxRate)/100
          )
          *
          waccPayload.capitalStruc.debtProp + parseFloat(waccPayload.copShareCapital)/100 
          * waccPayload.capitalStruc.prefProp;
    }

    async assessValuation(aggregatePayload){
      try{
        const { outstandingShares, discountingPeriod } = aggregatePayload.inputs;
        let multiplier = GET_MULTIPLIER_UNITS[`${aggregatePayload.inputs.reportingUnit}`];
        let counter = 0, debtOnIndexZero, discountingFactorWacc, secondLastFcfe = 0, sumOfCashFlows = 0, equityValue = 0,terminalDiscountingPeriod;      //This will act as index inside for loop;
        const years = aggregatePayload.years;
        // const worksheet1 = aggregatePayload.worksheet1;
        // const worksheet2 = aggregatePayload.worksheet2;
        // const worksheet3 = aggregatePayload.worksheet3;
        const balanceSheetData = aggregatePayload.balanceSheetData;
        const profitLossSheetData = aggregatePayload.profitLossSheetData;
        const assessmentSheetData = aggregatePayload.assessmentSheetData;
        const sortedData = Object.keys(balanceSheetData[0]).sort((a, b) => (/\d{2}-\d{2}-\d{4}/.test(a) ? -1 : 1)).reduce((acc, key) => ({ ...acc, [key]: balanceSheetData[0][key] }), {});
        const keysToProcess = Object.keys(sortedData).filter((key,index) => key !== 'lineEntry' && index !== 2);
        const profitLossComputed = await this.serializeArrayObject(profitLossSheetData);
        const balanceSheetComputed = await this.serializeArrayObject(balanceSheetData);
        const assessmentComputed = await this.serializeArrayObject(assessmentSheetData);

        const costOfEquity = await this.computeCostOfEquity(aggregatePayload.inputs, balanceSheetData);
        // const adjustedCostOfEquity = await this.industryService.CAPM_Method(aggregatePayload.inputs);
        // // const shareholderFunds = await getShareholderFunds(0,worksheet2);
        // const capitalStruc = await CapitalStruc(0,worksheet2,shareholderFunds,aggregatePayload.inputs);
        const otherAdj = parseFloat(aggregatePayload.inputs.otherAdj) || 0; 
        // const calculateWaccPayload = {
        //   adjustedCostOfEquity,
        //   capitalStruc,
        //   costOfDebt: aggregatePayload.inputs.costOfDebt,
        //   taxRate: aggregatePayload.inputs.taxRate,
        //   copShareCapital: aggregatePayload.inputs.copShareCapital
        // }

        // const calculatedWacc = await this.calculateWacc(calculateWaccPayload);

        const yearLength = years.length - 1;
        let resultArray = [];
        console.log(years,"years")

        const datePayload = {
          valuationDate: new Date(aggregatePayload.inputs.valuationDate),    //since date format is in unix format
          provisionalDate: aggregatePayload.provDtRef
        };
        
        let vdate = await calculateDaysFromDate(datePayload);
        // if (aggregatePayload.totalDaysDifferenceStubAdjustment > 1) {
        //   datePayload['useProvisionalDate'] = true;    //Since we need provisional date here so adding isProvisionalDate key inside payload
        // } else {
        //     vdate = await calculateDaysFromDate(datePayload);
        // }

        const discountingPeriodObj = await getDiscountingPeriod(discountingPeriod);
      
        // calculating fraction of year : if provisional date is 31st,March, use 1 else use the totalDaysDifferenceDiscountingFactor/totalDays  
        const fractionOfYearLeft = aggregatePayload.isDiscountingFactorAdjustmentRequired ? vdate.dateDiff/vdate.totalDays : 1;
    
        console.log(fractionOfYearLeft,"date difference ---->688")
        console.log(aggregatePayload.totalDaysDifferenceDiscountingFactor,"total date difference ---->689", discountingPeriodObj.result)
        let discountingPeriodValue = fractionOfYearLeft * discountingPeriodObj.result;

        let terminalValueWorking, pvTerminalValue,pat, depAndAmortisation, otherNonCashItems, changeInBorrowing, fcff, addInterestAdjTaxes, netCashFlow;
        for await (const individualYear of years){    //Use for await, map is not to be used, map handles large loads of data incorrectly 
            let  changeInNca, deferredTaxAssets, 
            changeInFixedAssets, debtAsOnDate, cashEquivalents, surplusAssets,  
            fcfeValueAtTerminalRate,
            presentFCFF,terminalValuePat,terminalValueDepAndAmortisation,terminalValueNca,
            terminalValueChangeInBorrowings, terminalValueAddInterestAdjTaxes;

            //  In this if condition itself we are recalculating all the values
            if(counter === 0 && aggregatePayload.checkPartialFinancialYear){    //checking if the the provisional date is not 31st,March
              pat  = await this.recalculatePat(counter, keysToProcess, profitLossComputed, true);
              depAndAmortisation = await this.recalculateDepnAndAmortisation(counter, keysToProcess,  profitLossComputed, true);
              otherNonCashItems = await this.recalculateOtherNonCashItems(counter, keysToProcess, profitLossComputed, true);
              addInterestAdjTaxes = await this.recalculateInterestAdjustedTaxes(counter, keysToProcess, profitLossComputed, aggregatePayload?.inputs?.taxRate, true);
            }
            else if(counter !== yearLength){
              pat  = await this.recalculatePat(counter+1, keysToProcess, profitLossComputed);
              depAndAmortisation = await this.recalculateDepnAndAmortisation(counter+1, keysToProcess,  profitLossComputed);
              otherNonCashItems = await this.recalculateOtherNonCashItems(counter+1, keysToProcess, profitLossComputed);
              addInterestAdjTaxes = await this.recalculateInterestAdjustedTaxes(counter+1, keysToProcess, profitLossComputed, aggregatePayload?.inputs?.taxRate);
            }

            if(counter !== yearLength){
              changeInNca =  await v2changeInNcaFromAssessment(keysToProcess[counter+1], assessmentComputed);
            }
            
            deferredTaxAssets = await v2DeferredTaxAssets(keysToProcess[counter], balanceSheetComputed, keysToProcess);
            
            changeInFixedAssets =  - (await v2changeInFixedAsset(keysToProcess[counter], balanceSheetComputed, profitLossComputed, keysToProcess) + depAndAmortisation);  //Since formula for changeInFixedAssets =  -(closing value - opening value + depnAndAmortisation) - As per discussions with sonal  02-03-2024

            debtAsOnDate = await v2GetDebtAsOnDate(keysToProcess[counter], balanceSheetComputed);

            if(counter === 0){
              debtOnIndexZero = debtAsOnDate; 
              surplusAssets = await v2SurplusAssets(keysToProcess[counter], balanceSheetComputed);
              cashEquivalents = await v2CashEquivalents(keysToProcess[counter], balanceSheetComputed);
            }
            changeInBorrowing = await v2ChangeInBorrowings(keysToProcess[counter], balanceSheetComputed, keysToProcess);

            if (aggregatePayload.inputs.model.includes('FCFE')) {
              netCashFlow = pat + depAndAmortisation + otherNonCashItems + changeInNca + deferredTaxAssets + changeInBorrowing; // Removed Deferred tax
            } else {
              netCashFlow = pat + depAndAmortisation + otherNonCashItems + changeInNca + deferredTaxAssets + addInterestAdjTaxes;
            }

            // const differenceInFixedAssetAndDepnAndAmortisation = changeInFixedAssets;
            // console.log(depAndAmortisation,"depn and amortisation", differenceInFixedAssetAndDepnAndAmortisation)
            if(counter !== yearLength){
              fcff = changeInFixedAssets + netCashFlow ;
            }
    
            if  (counter === yearLength && aggregatePayload.inputs.model.includes('FCFE')) {
              console.log(secondLastFcfe,"")
              fcfeValueAtTerminalRate = await fcfeTerminalValue(secondLastFcfe, aggregatePayload.inputs.terminalGrowthRate,costOfEquity)
              // discountingPeriodValue = discountingPeriodValue - 1;
            } 
            else if (counter === yearLength && aggregatePayload.inputs.model.includes('FCFF')) {
              fcfeValueAtTerminalRate = await fcffTerminalValue(secondLastFcfe, aggregatePayload.inputs.terminalGrowthRate, costOfEquity)
              // discountingPeriodValue = discountingPeriodValue - 1;
            }


            if(discountingPeriod  !== yearLength){    //Forcing discounting period value in terminal value column to be  
              terminalDiscountingPeriod = discountingPeriodValue-1;
            }

            // if (aggregatePayload.inputs.model.includes('FCFE')) {
              if (counter !== yearLength){
                discountingFactorWacc = 1/ (1+costOfEquity/100) ** (discountingPeriodValue)
              }
              console.log('Disc COE ', discountingFactorWacc)
             
            // } 
            // else if (aggregatePayload.inputs.model.includes('FCFF')) {
            //   if (counter !== yearLength){
            //     discountingFactorWacc = 1/ (1+calculatedWacc) ** (discountingPeriodValue)
            //   }
            //   console.log('Disc WACC ', discountingFactorWacc)
            
            // } 

            if(counter === yearLength){
                presentFCFF = discountingFactorWacc * fcfeValueAtTerminalRate;
                pvTerminalValue = presentFCFF;
                console.log(pat,"pat found")
                // calculating PAT
                terminalValuePat = pat * (1 + (aggregatePayload.inputs.terminalGrowthRate/100));
                
                // calculating Dept and Amortisation
                terminalValueDepAndAmortisation = depAndAmortisation * (1 + (aggregatePayload.inputs.terminalGrowthRate/100));
                
                // calculating Changes In NCA
                const netOperatingAssets = await v2NetOperatingAssetsFromAssessment(keysToProcess[counter], assessmentComputed);
                const terminalValueNetOperatingAsset = netOperatingAssets * (1 + (aggregatePayload.inputs.terminalGrowthRate/100));
                terminalValueNca = netOperatingAssets - terminalValueNetOperatingAsset;

                // calculating Change in Borrowings
                terminalValueChangeInBorrowings = changeInBorrowing - (changeInBorrowing * (1 + (aggregatePayload.inputs.terminalGrowthRate/100)));
                
                // calculating add:Interest
                // As per Nitish, in case of Pat based terminal value, keep it zero
                // terminalValueAddInterestAdjTaxes = addInterestAdjTaxes - (addInterestAdjTaxes * (1 + (aggregatePayload.inputs.terminalGrowthRate/100)));
                terminalValueChangeInBorrowings = 0;
            } else {
              presentFCFF = discountingFactorWacc * fcff
              sumOfCashFlows = presentFCFF + sumOfCashFlows;
            }


            if  (counter === 0) {                     // To be run for first instance only
              equityValue = cashEquivalents + surplusAssets + otherAdj;
            }

            const isFCFE = aggregatePayload.inputs.model.includes('FCFE');
            const isFCFF = aggregatePayload.inputs.model.includes('FCFF');
            let  result;
            if(counter !== yearLength){
               result = {
                particulars: GET_DATE_MONTH_YEAR_FORMAT.test(individualYear) ? `${individualYear}` : (counter === yearLength ? 'Terminal Value' : `${individualYear}-${parseInt(individualYear) + 1}`),
                pat: counter === yearLength ? '' : pat,
                addInterestAdjTaxes:counter === yearLength ?'':addInterestAdjTaxes,
                depAndAmortisation: counter === yearLength ? '' : depAndAmortisation,
                onCashItems: counter === yearLength ? '' : otherNonCashItems,
                nca: counter === yearLength ? '' : changeInNca,
                changeInBorrowings: counter === yearLength ? '' : changeInBorrowing,
                defferedTaxAssets: counter === yearLength ? '' : deferredTaxAssets,
                netCashFlow: counter === yearLength ? '' : netCashFlow,
                fixedAssets: counter === yearLength ? '' : changeInFixedAssets,
                fcff: counter === yearLength ? fcfeValueAtTerminalRate:fcff,
                discountingPeriod:counter === yearLength ? terminalDiscountingPeriod :  discountingPeriodValue,
                discountingFactor: discountingFactorWacc,
                presentFCFF: presentFCFF,
                sumOfCashFlows: '',
                pvTerminalValue: '',
                debtOnDate: counter > 0 ? '' : debtOnIndexZero,
                cashEquivalents: counter > 0 ? '' : cashEquivalents,
                surplusAssets: counter > 0 ? '' : surplusAssets,
                otherAdj: counter > 0 ? '' : otherAdj,
                equityValue: '',
                noOfShares: counter > 0 ? '' : outstandingShares,
                valuePerShare: '',
            };
           
            if (isFCFF) {
              delete result.changeInBorrowings; // If not needed for FCFF
            }
            
            if (isFCFE) {
              delete result.debtOnDate; // If not needed for FCFE
              delete result.addInterestAdjTaxes; // If not needed for FCFE
            }
            }
            else{
              let totalNetCashFlow
              if(isFCFE){
                totalNetCashFlow = convertToNumberOrZero(terminalValuePat) + 
                convertToNumberOrZero(terminalValueDepAndAmortisation) + 
                convertToNumberOrZero(otherNonCashItems) + 
                convertToNumberOrZero(terminalValueNca) + 
                convertToNumberOrZero(terminalValueChangeInBorrowings);
              }else{
                totalNetCashFlow = convertToNumberOrZero(terminalValuePat) + 
                convertToNumberOrZero(terminalValueAddInterestAdjTaxes) + 
                convertToNumberOrZero(terminalValueDepAndAmortisation) + 
                convertToNumberOrZero(otherNonCashItems) + 
                convertToNumberOrZero(terminalValueNca)
                // convertToNumberOrZero(terminalValueChangeInBorrowings);
              }
              terminalValueWorking = {
                particulars: 'Terminal Value',
                pat: terminalValuePat,
                addInterestAdjTaxes:terminalValueAddInterestAdjTaxes,
                depAndAmortisation: terminalValueDepAndAmortisation,
                onCashItems: otherNonCashItems,
                nca: terminalValueNca,
                changeInBorrowings: terminalValueChangeInBorrowings,
                defferedTaxAssets: 0,
                netCashFlow: totalNetCashFlow,
                fixedAssets: -terminalValueDepAndAmortisation,
                fcff: totalNetCashFlow + convertToNumberOrZero(-terminalValueDepAndAmortisation),
                discountingPeriod: terminalDiscountingPeriod,
                discountingFactor: discountingFactorWacc,
                presentFCFF: presentFCFF,
                finalYearfreeCashFlow: fcff,
                terminalValueBasedOnLastYear:fcfeValueAtTerminalRate,
                explicitYear: `${parseInt(individualYear)-1}-${parseInt(individualYear)}`
              }
              // As per Nitish, for FCFF change in borrowings should not be applied
              if(isFCFF){
                delete terminalValueWorking.changeInBorrowing;
              }
            }
            if(counter === 0 && !discountingPeriodObj.isFullPrd){
              /**
               * Applicable only for Mid period
               */
              discountingPeriodValue = discountingPeriodValue * 2 + 0.5;
            }
            else{
              discountingPeriodValue = discountingPeriodValue + 1;
            }
            
            secondLastFcfe = fcff; 
            if(result){
              resultArray.push(result);
            }
            counter++;
          }
          // Using static substitution 
          resultArray[0]['sumOfCashFlows'] = sumOfCashFlows;
          resultArray[0]['pvTerminalValue'] = pvTerminalValue;
          resultArray[0].equityValue = aggregatePayload.inputs.model.includes('FCFE')? equityValue + sumOfCashFlows + pvTerminalValue:equityValue + sumOfCashFlows + pvTerminalValue - debtOnIndexZero;
          resultArray[0].valuePerShare = (resultArray[0].equityValue*multiplier)/outstandingShares;
          return {resultArray,terminalValueWorking};
        }
        catch(error){
        console.log(error,"error")
        return {
          error:error,
          status:false,
          msg:"aggregate calculation failed"
        }
      }
    }
  
  async transformData(data: any[]) { //only to render data on UI table
   try{
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
   catch(error){
    console.log(error,"tranform data failed")
    return {
      msg:'Failed to transform',
      status:false,
      error:error.message
    }
   }
  }

  async recalculateValuePerShare(payload, headers){
    try{
      const processId = payload?.processId; 
      const type = payload?.type;
      const useReportIdFromSA = payload?.useReportIdFromSA || false;
      const updateByValuationId = payload?.updateByValuationId || null;
      const updateTerminalSelectionAndPrimarySAvaluation = payload?.updateTerminalSelectionAndPrimarySAvaluation || false;
      const { profitLossSheetData, balanceSheetData, assessmentSheetData } = await this.getSheetData(processId);

      const fourthStageDetails:any = await this.processManagerService.fetchStageWiseDetails(processId, 'fourthStageInput');
      const sensitivityAnalysisId = fourthStageDetails.data?.fourthStageInput?.sensitivityAnalysisId;
      let reportId:any;
      reportId = fourthStageDetails.data?.fourthStageInput?.appData?.reportId;

      const role = {
        role: ['sensitivityAnalysis']
      }
       const  request  = {
          headers : {
            authorization: headers.authorization
          }
        }
      const hasAccess = await  this.authenticationTokenService.entityAccess(role, request);
      if(useReportIdFromSA && hasAccess){
       const SAreportDetails =  await this.fetchValuationIdFromSA(sensitivityAnalysisId);
       reportId = SAreportDetails?.reportId;
      }

      if(hasAccess && updateByValuationId && updateByValuationId !== '' && updateByValuationId !== 'null'){
        reportId = updateByValuationId;
      }

      const terminalYearBase:any = await this.terminalYearWorkingService.computeTerminalValue(processId, reportId);
      const otherAdjustment = convertToNumberOrZero(fourthStageDetails.data?.fourthStageInput?.otherAdj);

      const valuation:any = await this.valuationService.getValuationById(reportId);

      const inputs:any = valuation.inputData[0];
      let multiplier = GET_MULTIPLIER_UNITS[`${inputs.reportingUnit}`];

      let dcfValuationArray, dcfIndex;
      valuation.modelResults.map((indValuations, index)=>{
        if(indValuations.model === MODEL[0] || indValuations.model === MODEL[1]){
          dcfValuationArray = indValuations;
          dcfIndex = index;
        }
      });
      const terminalYearWorking = dcfValuationArray.terminalYearWorking;
      let entireValuationArray = dcfValuationArray.valuationData;
      const firstElement = dcfValuationArray.valuationData[0];

      // Based on terminal value type
      // Recalculating only present value of terminal value
      // Keeping all the other line items as it is
      if(type === 'tvPatBased'){
        firstElement.pvTerminalValue = terminalYearBase.terminalValueWorking.pvTerminalValue;
      }
      else{
        firstElement.pvTerminalValue = terminalYearWorking.presentFCFF;
      }
      
      firstElement.equityValue = inputs.model.includes('FCFE') ? (firstElement.sumOfCashFlows + firstElement.pvTerminalValue + firstElement.cashEquivalents + otherAdjustment + firstElement.surplusAssets) : (firstElement.sumOfCashFlows + firstElement.pvTerminalValue + firstElement.cashEquivalents - firstElement.debtOnDate + firstElement.surplusAssets + otherAdjustment);
      firstElement.valuePerShare = (firstElement.equityValue*multiplier)/inputs.outstandingShares;

      const {isStubRequired, totalDaysDifferenceStubAdjustment, provisionalDate} = await this.fetchStubAdjustment(inputs, balanceSheetData);
      if (isStubRequired && totalDaysDifferenceStubAdjustment > 1) { //based on the above conditions, calculating stub
        const costOfEquity = await this.computeCostOfEquity(inputs, balanceSheetData);
        let stubFactor = (1 + totalDaysDifferenceStubAdjustment/365) ** (costOfEquity/100)-1;
        let equityValueToAdj = stubFactor * firstElement.equityValue;
        
        firstElement.stubAdjValue = equityValueToAdj
        firstElement.equityValueNew = firstElement.equityValue + equityValueToAdj;
        firstElement.valuePerShare = ((firstElement.equityValue + equityValueToAdj) * multiplier)/inputs.outstandingShares;       // Applying mulitplier for figures
      }

      entireValuationArray.shift();
      entireValuationArray.unshift(firstElement);

      const valuationWithoutInternalProps = valuation.toObject({ getters: true, virtuals: true });

      const { _id, ...rest } = valuationWithoutInternalProps;

      if(updateByValuationId){
        const SAreportDetails = await this.sensitivityAnalysisService.fetchPrimaryValuationId(sensitivityAnalysisId);
        await this.sensitivityAnalysisService.upsertSecondaryValuationByReportId(SAreportDetails?.valuationId);
        await this.sensitivityAnalysisService.removeSecondaryValuationByReportId(sensitivityAnalysisId, updateByValuationId);
      }
      // Updating the DCF valuation
      await this.valuationService.createValuation(rest, _id);
    
      //  Prepare return block
      const transformValuation:any = await this.transformData(entireValuationArray);

     let dcfValuationDto = new PostDcfValuationDto();
     dcfValuationDto.model = inputs.model.includes('FCFE') ? MODEL[0] : MODEL[1];
     dcfValuationDto.valuationData = transformValuation.transposedResult;
    //  dcfValuationDto.valuation = isStubRequired? firstElement.equityValueNew : firstElement.equityValue;
     dcfValuationDto.valuation = firstElement.valuePerShare;
     dcfValuationDto.terminalYearWorking = terminalYearWorking;
     dcfValuationDto.columnHeader = transformValuation.columnHeader;
     dcfValuationDto.provisionalDate = provisionalDate;

     valuation.modelResults.splice(dcfIndex, 1, dcfValuationDto);

     let mainValuationDto = new PostMainValuationDto();
     mainValuationDto.reportId = _id;
     mainValuationDto.valuationResult=valuation.modelResults;

    //  Updating the process manager service
    const processStateModel ={
      fourthStageInput:{
        appData: mainValuationDto,
        otherAdj: otherAdjustment,
        formFillingStatus: true,
        sensitivityAnalysisId
      },
      step: 4
    }
    
    await this.processManagerService.upsertProcess(this.getRequestAuth(headers), processStateModel, processId);
    await this.processManagerService.updateTerminalSelectionType(processId, type);

    if(updateByValuationId){
      await this.processManagerService.updateTerminalGrowthRate(processId, inputs?.terminalGrowthRate)
    }

    if(updateTerminalSelectionAndPrimarySAvaluation && hasAccess){
      await this.updateTerminalSectionAndPrimaryValuation(sensitivityAnalysisId, mainValuationDto.reportId, type);
    }
    return  {
      ...mainValuationDto,
      message:'Request Successful',
      success:true
    }
    }
    catch(error){
      throw error
    }
  }

  async recalculateValuePerShareForSA(payload, headers){
    try{
      const processId = payload?.processId; 
      const type = payload?.type;
      const updateByValuationId = payload?.updateByValuationId || null;

      const fourthStageDetails:any = await this.processManagerService.fetchStageWiseDetails(processId, 'fourthStageInput');

      const terminalYearBase:any = await this.terminalYearWorkingService.computeTerminalValue(processId, updateByValuationId);
      const otherAdjustment = convertToNumberOrZero(fourthStageDetails.data?.fourthStageInput?.otherAdj);
      const mainValuationDto = await this.computeRevaluation(updateByValuationId, type, terminalYearBase, otherAdjustment, processId);
    
    return  {
      ...mainValuationDto,
      message:'Request Successful',
      success:true
    }
    }
    catch(error){
      throw error
    }
  }


  async updateTerminalSectionAndPrimaryValuation(SAid, valuationId, terminalSelectionType){
    try{
      await this.sensitivityAnalysisService.updateSATerminalSelection(SAid, terminalSelectionType);
      await this.sensitivityAnalysisService.upsertPrimaryValuationByReportId(valuationId);
    }
    catch(error){
      throw error;
    }
  }

  // Use this incase wants to run Revaluation of any model
  // async revaluationProcess(processId, header){
  //   try{
  //     const firstStageDetails:any = await this.processManagerService.fetchStageWiseDetails(processId, 'firstStageInput');
  //     const thirdStageDetails:any = await this.processManagerService.fetchStageWiseDetails(processId, 'thirdStageInput');
  //     const fourthStageDetails:any = await this.processManagerService.fetchStageWiseDetails(processId, 'fourthStageInput');

  //     let input:any = {};
  //     input = {
  //       // inputs:{
  //         ...firstStageDetails.data.firstStageInput, 
  //         otherAdj: fourthStageDetails?.data?.fourthStageInput.otherAdj
  //       // }
  //     }
  //     for await (const indResponse of thirdStageDetails.data.thirdStageInput){
  //       const {model , ...rest} = indResponse;
  //       input = {
  //         ...input, 
  //         ...rest
  //       };
  //     }

  //     const headers = { 
  //       'Authorization':`${header.authorization}`,
  //       'Content-Type': 'application/json'
  //     }
  //     console.log(input,"input")
  //     const valuationRepostData =  await axiosInstance.post(VALUATION_PROCESS_V1,input, { httpsAgent: axiosRejectUnauthorisedAgent, headers });
  //     return valuationRepostData?.data;
  //   }
  //   catch(error){
  //     throw error;
  //   }
  // }

  async fetchValuationIdFromSA(SAid){
    try{
      const SAdata = await this.sensitivityAnalysisService.fetchActiveSAvaluationId(SAid);
      return {reportId: SAdata.valuationId};
    }
    catch(error){
      throw error;
    }
  }

  async insertValuation(payload, headers){
    try{
      const reportId = payload?.reportId;
      const processId = payload?.processId;
      const terminalSelectionType = payload?.terminalSelectionType;
      const initialValuationId = payload?.reportId;
      if(reportId){
        const payload = {
          processId, 
          type: terminalSelectionType,
          valuationId:initialValuationId
        }
        const updatedValuationId = await this.recalculateInsertedNewValuation(payload);

        await this.sensitivityAnalysisService.upsertSecondaryValuationByReportId(updatedValuationId.reportId);
        return true;

      }
    }
    catch(error){
      throw error;
    }
  }

  async recalculateInsertedNewValuation(payload){
    try{
      const processId = payload?.processId; 
      const type = payload?.type;
      const valuationId  = payload?.valuationId;
      const fourthStageDetails:any = await this.processManagerService.fetchStageWiseDetails(processId, 'fourthStageInput');

      const terminalYearBase:any = await this.terminalYearWorkingService.computeTerminalValue(processId, valuationId);
      const otherAdjustment = convertToNumberOrZero(fourthStageDetails.data?.fourthStageInput?.otherAdj);

      const mainValuationDto = await this.computeRevaluation(valuationId, type, terminalYearBase, otherAdjustment, processId);

    return  {
      ...mainValuationDto,
      message:'Request Successful',
      success:true
    }
    }
    catch(error){
      throw error
    }
  }

  async computeRevaluation(valuationId, type, terminalYearBase, otherAdjustment, processId){
   try{
    const valuation:any = await this.valuationService.getValuationById(valuationId);
    const { profitLossSheetData, balanceSheetData, assessmentSheetData } = await this.getSheetData(processId);

    const inputs:any = valuation.inputData[0];
    let multiplier = GET_MULTIPLIER_UNITS[`${inputs.reportingUnit}`];

    let dcfValuationArray, dcfIndex;
    valuation.modelResults.map((indValuations, index)=>{
      if(indValuations.model === MODEL[0] || indValuations.model === MODEL[1]){
        dcfValuationArray = indValuations;
        dcfIndex = index;
      }
    });
    const terminalYearWorking = dcfValuationArray.terminalYearWorking;
    let entireValuationArray = dcfValuationArray.valuationData;
    const firstElement = dcfValuationArray.valuationData[0];

    // Based on terminal value type
    // Recalculating only present value of terminal value
    // Keeping all the other line items as it is
    if(type === 'tvPatBased'){
      firstElement.pvTerminalValue = terminalYearBase.terminalValueWorking.pvTerminalValue;
    }
    else{
      firstElement.pvTerminalValue = terminalYearWorking.presentFCFF;
    }
    
    firstElement.equityValue = inputs.model.includes('FCFE') ? (firstElement.sumOfCashFlows + firstElement.pvTerminalValue + firstElement.cashEquivalents + otherAdjustment + firstElement.surplusAssets) : (firstElement.sumOfCashFlows + firstElement.pvTerminalValue + firstElement.cashEquivalents - firstElement.debtOnDate + firstElement.surplusAssets + otherAdjustment);
    firstElement.valuePerShare = (firstElement.equityValue*multiplier)/inputs.outstandingShares;

    const {isStubRequired, totalDaysDifferenceStubAdjustment, provisionalDate} = await this.fetchStubAdjustment(inputs, balanceSheetData);
    if (isStubRequired && totalDaysDifferenceStubAdjustment > 1) { //based on the above conditions, calculating stub
      const costOfEquity = await this.computeCostOfEquity(inputs, balanceSheetData);
      let stubFactor = (1 + totalDaysDifferenceStubAdjustment/365) ** (costOfEquity/100)-1;
      let equityValueToAdj = stubFactor * firstElement.equityValue;
      
      firstElement.stubAdjValue = equityValueToAdj
      firstElement.equityValueNew = firstElement.equityValue + equityValueToAdj;
      firstElement.valuePerShare = ((firstElement.equityValue + equityValueToAdj) * multiplier)/inputs.outstandingShares;       // Applying mulitplier for figures
    }

    entireValuationArray.shift();
    entireValuationArray.unshift(firstElement);


    const valuationWithoutInternalProps = valuation.toObject({ getters: true, virtuals: true });

    const { id,_id, ...rest } = valuationWithoutInternalProps;

    // Updating the DCF valuation
    const newReportId = await this.valuationService.createValuation(rest);
  
    //  Prepare return block
    const transformValuation:any = await this.transformData(entireValuationArray);

   let dcfValuationDto = new PostDcfValuationDto();
   dcfValuationDto.model = inputs.model.includes('FCFE') ? MODEL[0] : MODEL[1];
   dcfValuationDto.valuationData = transformValuation.transposedResult;
  //  dcfValuationDto.valuation = isStubRequired? firstElement.equityValueNew : firstElement.equityValue;
   dcfValuationDto.valuation = firstElement.valuePerShare;
   dcfValuationDto.terminalYearWorking = terminalYearWorking;
   dcfValuationDto.columnHeader = transformValuation.columnHeader;
   dcfValuationDto.provisionalDate = provisionalDate;

   valuation.modelResults.splice(dcfIndex, 1, dcfValuationDto);

   let mainValuationDto = new PostMainValuationDto();
   mainValuationDto.reportId = newReportId;
   mainValuationDto.valuationResult=valuation.modelResults;
   return mainValuationDto
   }
   catch(error){
    throw error;
   }
  }

  getRequestAuth(headers){
    return {
      headers:{
         authorization:headers.authorization
       }
     } 
  }

  async fetchStubAdjustment(inputs, balanceSheetData){
    // const valuationFileToProcess = inputs.isExcelModified === true ? inputs.modifiedExcelSheetId : inputs.excelSheetId;

    // let workbook;
    // try {
    //   workbook = XLSX.readFile(`./uploads/${valuationFileToProcess}`);
    // } catch (error) {
    //   this.customLogger.log({
    //     message: `excelSheetId: ${valuationFileToProcess} not available`,
    //     userId: inputs.userId,
    //   });
    //   return {
    //     result: null,
    //     msg: `excelSheetId: ${valuationFileToProcess} not available`,
    //   };
    // }

    // const worksheet1 = workbook.Sheets['P&L'];
    // const worksheet2 = workbook.Sheets['BS'];

    // let provisionalDates = worksheet1['B1'].v || worksheet2['B1'].v;
    let provisionalDates = getDateKey(balanceSheetData[0])

    let  provDtRef = parseDate(provisionalDates.trim());

    const decodeValuationDate =  new Date(inputs.valuationDate);  

    const isStubRequired = await this.isStubRequired(provDtRef, decodeValuationDate);

    let totalDaysDifferenceStubAdjustment;

    if(isStubRequired){
      totalDaysDifferenceStubAdjustment = await this.subtractProvisionalDateByValuationDate(provDtRef, decodeValuationDate);
    }
    return { isStubRequired, totalDaysDifferenceStubAdjustment, provisionalDate: new Date(provDtRef) };
  }
  //Get DiscountingFactor based on Industry based Calculations.
  // async getDiscountingFactor(
  //   inputs: any,
  //   i: number,
  //   worksheet1: any,
  //   worksheet2: any,
  // ): Promise<any> {
  //   const {
  //     model,
  //     popShareCapitalType,
  //     costOfDebtType,
  //     costOfDebt,
  //     capitalStructureType,
  //   } = inputs;
  //   let discountingFactor = null;
  //   let capitalStruc: any;
  //   if (model.includes('FCFE')) {
  //     const res = await this.industryService.getFCFEDisFactor(inputs);
  //     if (res.result === null) return res;

  //     discountingFactor = res.result;             //ValidateHere
  //   } else if (model.includes('FCFF')) {
  //     let costOfDebtValue = null;
  //     if (costOfDebtType === 'Use_Interest_Rate') costOfDebtValue = costOfDebt;
  //     else if (costOfDebtType === 'Finance_Cost')
  //       costOfDebtValue = await CostOfDebt(i, worksheet1, worksheet2); //We need to use formula
  //     let capitalStructure = 0;
  //     if (capitalStructureType === 'Company_Based')
  //       capitalStructure = await CapitalStructure(i, worksheet2);
  //       capitalStruc = await CapitalStruc(i,worksheet2,0);
  //       console.log(capitalStruc.debtProp);
  //     const proportionOfDebt = await ProportionOfDebt(i, worksheet2); //We need to use formula
  //     const proportionOfEquity = await ProportionOfEquity(i, worksheet2); // We need to use fomula
  //     let popShareCapitalValue = null;
  //     if (popShareCapitalType === 'CFBS')
  //       popShareCapitalValue = await POPShareCapital(i, worksheet2);
  //     //We need to use formula
  //     else if (popShareCapitalType === 'DFBS_PC')
  //       popShareCapitalValue = await POPShareCapitalLabelPer(i, worksheet2); //We need to get label % value.

  //     const res = await this.industryService.getFCFFDisFactor(inputs, {
  //       costOfDebt: costOfDebtValue,
  //       capitalStructure: capitalStructure,
  //       proportionOfDebt: proportionOfDebt,
  //       proportionOfEquity: proportionOfEquity,
  //       popShareCapital: popShareCapitalValue,
  //     });
  //     if (res.result === null) return res;

  //     discountingFactor = res.result;
  //     // discountingFactorWACC =  1/(1+ res.result) ^ discountingPeriodObj.result;
  //   }
  //   return {
  //     result: discountingFactor,
  //     msg: 'discountingFactor get Successfully.',
  //   };
  // }
  async getSheetData(processId, specificSheetData?){
    try{
      const loadExcelArchive:any = await this.excelArchiveService.fetchExcelByProcessStateId(processId);
      if(specificSheetData){
        return {[EXCEL_CONVENTION[specificSheetData].EAkey]: loadExcelArchive[EXCEL_CONVENTION[specificSheetData].EAkey]}
      }
      if(loadExcelArchive?.balanceSheetRowCount && loadExcelArchive?.profitLossSheetRowCount){
        const balanceSheetData = loadExcelArchive.balanceSheetdata;
        const profitLossSheetData = loadExcelArchive.profitLossSheetdata;
        const assessmentSheetData = loadExcelArchive.assessmentSheetData;
        return {balanceSheetData, profitLossSheetData, assessmentSheetData};
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
}