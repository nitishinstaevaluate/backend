import { Injectable } from "@nestjs/common";
import { formatDateHyphenToDDMMYYYY, convertToNumberOrZero, convertUnixTimestampToQuarterAndYear } from "src/excelFileServices/common.methods";
import { CIQ_ELASTIC_SEARCH_FINANCIAL_SEGMENT, CIQ_ELASTIC_SEARCH_PRICE_EQUITY, CIQ_FINANCIAL_SEGMENT } from "src/library/interfaces/api-endpoints.local";
import { axiosInstance, axiosRejectUnauthorisedAgent } from "src/middleware/axiosConfig";
import * as fs from 'fs';
import * as puppeteer from 'puppeteer';
import hbs = require('handlebars');
import { AuthenticationService } from "src/authentication/authentication.service";
import { convertEpochToPlusOneDate, convertToRomanNumeral, customRound, formatDate, formatPositiveAndNegativeValues } from "./report-common-functions";
import { ALL_MODELS, BETA_FROM, CAPITAL_STRUCTURE_TYPE, COST_OF_EQUITY_METHOD, EXPECTED_MARKET_RETURN_HISTORICAL_TYPE, EXPECTED_MARKET_RETURN_TYPE, GET_MULTIPLIER_UNITS, INCOME_APPROACH, MARKET_PRICE_APPROACH, MODEL, MODEL_ASC_ORDER, MULTIPLES_TYPE, NATURE_OF_INSTRUMENT, NET_ASSET_VALUE_APPROACH, RELATIVE_PREFERENCE_RATIO, REPORTING_UNIT, REPORT_BETA_TYPES, REPORT_LINE_ITEM, REPORT_PURPOSE } from "src/constants/constants";
import { thirdpartyApiAggregateService } from "src/library/thirdparty-api/thirdparty-api-aggregate.service";
import { ReportService } from "./report.service";
import { terminalValueWorkingService } from "src/valuationProcess/terminal-value-working.service";
import { ProcessStatusManagerService } from "src/processStatusManager/service/process-status-manager.service";
import { formatDateToMMDDYYYY, isNotRuleElevenUaAndNav } from "src/ciq-sp/ciq-common-functions";
import { ciqGetFinancialDto } from "src/ciq-sp/dto/ciq-sp.dto";
import { HistoricalReturnsService } from "src/data-references/data-references.service";
import { financialHelperService } from "./helpers/financial-helpers.service";
import { CalculationService } from "src/calculation/calculation.service";
require('dotenv').config()
import * as converter from 'number-to-words';
import { navReportService } from "./nav-report.service";


@Injectable()
export class sebiReportService {

    navAnnexureSerialNo = 'I';
    dcfAnnexureSerialNo = 'I';
    marketApproachAnnexureSerialNo = 'I';
    constructor(private authenticationService:AuthenticationService,
      private thirdPartyApiAggregateService:thirdpartyApiAggregateService,
    private terminalValueWorkingService: terminalValueWorkingService,
    private processStateManagerService: ProcessStatusManagerService,
    private historicalReturnsService:HistoricalReturnsService,
    private financialHelperService: financialHelperService,
    private calculationService: CalculationService,
    private navReportService: navReportService){}

    async computeSEBIReport(htmlPath, pdfFilePath, request, valuationResult, reportDetails){
        try{
          const companyId = valuationResult.inputData[0].companyId;
          const companyName = valuationResult.inputData[0].company;
          const valuationDate = valuationResult.inputData[0].valuationDate;

          let terminalYearWorkings;
          if(valuationResult.inputData[0].model.includes(MODEL[0]) || valuationResult.inputData[0].model.includes(MODEL[1])){
            terminalYearWorkings = await this.terminalValueWorkingService.computeTerminalValue(reportDetails.processStateId);
          }
          const allProcessStageDetails = await this.processStateManagerService.fetchProcess(reportDetails.processStateId);
    
          if(isNotRuleElevenUaAndNav(valuationResult.inputData[0].model)){
            const financialSegmentDetails = await this.getFinancialSegment(reportDetails, valuationResult, request);
            this.financialHelperService.loadFinancialTableHelper(financialSegmentDetails, valuationResult, allProcessStageDetails);
          }

          let getCapitalStructure;
          if(valuationResult.inputData[0].model.includes(MODEL[1])){
            const taxRate = valuationResult.inputData[0].taxRate.includes('%') ? parseFloat(valuationResult.inputData[0].taxRate.replace("%", "")) : valuationResult.inputData[0].taxRate;
            const waccPayload = {
              adjCoe:+valuationResult.inputData[0].adjustedCostOfEquity,
              costOfDebt:+valuationResult.inputData[0].costOfDebt,
              copShareCapital:+valuationResult.inputData[0].copShareCapital,
              deRatio:+valuationResult.inputData[0].capitalStructure.deRatio,
              type:valuationResult.inputData[0].capitalStructureType,
              taxRate:taxRate,
              capitalStructure:valuationResult.inputData[0].capitalStructure,
              processStateId:valuationResult.processStateId
            }
             getCapitalStructure = await this.calculationService.getWaccExcptTargetCapStrc(waccPayload);
          }
          
           this.loadSebiHelpers(valuationResult, reportDetails, allProcessStageDetails, terminalYearWorkings, getCapitalStructure);
    
          const htmlContent = fs.readFileSync(htmlPath, 'utf8');
          const template = hbs.compile(htmlContent);
          const html = template(valuationResult);
    
          return await this.generateSebiReport(html, pdfFilePath, companyName);
        }
        catch(error){
          console.log(error)
          return {
            error:error,
            status:false,
            msg:"Sebi report generation failed"
          }
        }
      }

      async computeSEBIpreviewReport(reportDetails, valuationResult, response, request, docFilePath, htmlFilePath, pdfFilePath){
        try{
          let pdf
          const companyId = valuationResult.inputData[0].companyId;
          const companyName = valuationResult.inputData[0].company;
          const valuationDate = valuationResult.inputData[0].valuationDate;

          let terminalYearWorkings;
          if(valuationResult.inputData[0].model.includes(MODEL[0]) || valuationResult.inputData[0].model.includes(MODEL[1])){
            terminalYearWorkings = await this.terminalValueWorkingService.computeTerminalValue(reportDetails.processStateId);
          }
          const allProcessStageDetails = await this.processStateManagerService.fetchProcess(reportDetails.processStateId);

          if(reportDetails.fileName){
            const convertDocxToSfdt = await this.thirdPartyApiAggregateService.convertDocxToSyncfusionDocumentFormat(docFilePath,true)
      
            response.send(convertDocxToSfdt);
      
            return {
              msg: "Preview Success",
              status: true,
            };
          }
         
          if(isNotRuleElevenUaAndNav(valuationResult.inputData[0].model)){
            const financialSegmentDetails = await this.getFinancialSegment(reportDetails, valuationResult, request);
            this.financialHelperService.loadFinancialTableHelper(financialSegmentDetails, valuationResult, allProcessStageDetails);
          }
      
          let getCapitalStructure;
          if(valuationResult.inputData[0].model.includes(MODEL[1])){
            const taxRate = valuationResult.inputData[0].taxRate.includes('%') ? parseFloat(valuationResult.inputData[0].taxRate.replace("%", "")) : valuationResult.inputData[0].taxRate;
            const waccPayload = {
              adjCoe:+valuationResult.inputData[0].adjustedCostOfEquity,
              costOfDebt:+valuationResult.inputData[0].costOfDebt,
              copShareCapital:+valuationResult.inputData[0].copShareCapital,
              deRatio:+valuationResult.inputData[0].capitalStructure.deRatio,
              type:valuationResult.inputData[0].capitalStructureType,
              taxRate:taxRate,
              capitalStructure:valuationResult.inputData[0].capitalStructure,
              processStateId:valuationResult.processStateId
            }
             getCapitalStructure = await this.calculationService.getWaccExcptTargetCapStrc(waccPayload);
          }

          this.loadSebiHelpers(valuationResult, reportDetails, allProcessStageDetails, terminalYearWorkings, getCapitalStructure);
      
          if (valuationResult.modelResults.length > 0) {
              const htmlContent = fs.readFileSync(htmlFilePath, 'utf8');
              const template = hbs.compile(htmlContent);
              const html = template(valuationResult);
      
              
              pdf = await this.generateSebiReport(html, pdfFilePath, companyName);
              await this.thirdPartyApiAggregateService.convertPdfToDocx(pdfFilePath,docFilePath)
              
              const convertDocxToSfdt = await this.thirdPartyApiAggregateService.convertDocxToSyncfusionDocumentFormat(docFilePath)
      
              response.send(convertDocxToSfdt);
      
              return {
                  msg: "Preview Success",
                  status: true,
              };
          } else {
              console.log("Data not found");
              return {
                  msg: "No data found for report preview",
                  status: false
              };
          }
        }
        catch(error){
          return{
            error:error,
            status:false,
            msg:"Sebi report preview failed"
          }
        }
      }

      async generateSebiReport(htmlContent: any, pdfFilePath: string, companyName) {
        const browser = await puppeteer.launch({
          headless:"new",
          executablePath: process.env.PUPPETEERPATH
        });
        const page = await browser.newPage();

        try {
          const contenread = await page.setContent(htmlContent);
          const pdf = await page.pdf({
            path: pdfFilePath,
            format: 'A4' as puppeteer.PaperFormat,
            displayHeaderFooter: true,
            printBackground: true,
            margin: {
              top: "35px",
              right: "0px",
              bottom: "0px",
              left: "0px"
          },
          headerTemplate:`<table width="100%" border="0" cellspacing="0" cellpadding="0">
          <tr>
          <td style="width:100%;">
            <table border="0" cellspacing="0" cellpadding="0" style="height: 20px;width:100% !important;padding-left:3%;padding-right:3%">
              <tr>
                <td style=" border-bottom: 1px solid #bbccbb !important;font-size: 13px; height: 5px;width:100% !important;text-align:right;font-size:12px;font-family:Georgia, 'Times New Roman', Times, serif;"><i>Valuation of equity shares of ${companyName}</i></td>
              </tr>
              <tr>
                <td style="font-size: 11px">&nbsp;</td>
              </tr>
            </table>
          </td>
        </tr></table>`,
            footerTemplate: `<div style="width:100%;padding-left:3%;padding-right:3%">
            <hr style="border:1px solid #bbccbb">
            <h1 style="text-indent: 0pt;text-align: center;font-size:11px;color:#5F978E;"><span style="float: left;padding-right: 3%;font-size:12px;font-family:Georgia, 'Times New Roman', Times, serif;"> <i>Privileged &amp; confidential</i> </span><span style="font-weight:400 !important;float:right;font-size:12px;font-family:Georgia, 'Times New Roman', Times, serif;">Page <span class="pageNumber"></span> </span></span></h1>
            </div>`,
          });

          return pdf;
        } catch (error) {
          console.error('Error generating PDF:', error);
        } finally {
          await browser.close();
         
        }
      }

      

      async loadSebiHelpers(valuationResult, reportDetails, allProcessStageDetails, terminalYearWorkings, getCapitalStructure){
        try{
          hbs.registerHelper('reportDate',()=>{
            if(reportDetails.registeredValuerDetails[0]) 
                return  formatDate(new Date(reportDetails.reportDate));
            return '';
          })

          hbs.registerHelper('marketPriceMethodAnnexureSerialNo',()=>{
            if(valuationResult.inputData[0].model) 
                return convertToRomanNumeral(valuationResult.inputData[0].model.length - 1, true);
            return 'I';
          })
    
          hbs.registerHelper('companyName',()=>{
            if(valuationResult.inputData[0].company)
              return valuationResult.inputData[0].company;
            return '';
          })
    
          hbs.registerHelper('sharePriceDataF40', ()=>{
            let sharePriceDetails = [];
            valuationResult.modelResults.map((response)=>{
              if(response.model === MODEL[7] && response.valuationData?.sharePriceLastNinetyDays){
               sharePriceDetails = response.valuationData.sharePriceLastNinetyDays;
              }
            })
            const first40Elements = sharePriceDetails.slice(0, 40);
            return first40Elements
          })

          hbs.registerHelper('sharePriceDataF10', ()=>{
            let sharePriceDetails = [];
            valuationResult.modelResults.map((response)=>{
              if(response.model === MODEL[7] && response.valuationData?.sharePriceLastTenDays){
               sharePriceDetails = response.valuationData.sharePriceLastTenDays;
              }
            })
            return sharePriceDetails;
          })
          
          hbs.registerHelper('sharePriceDataN40', ()=>{
            let sharePriceDetails = [];
            valuationResult.modelResults.map((response)=>{
              if(response.model === MODEL[7] && response.valuationData?.sharePriceLastNinetyDays){
               sharePriceDetails = response.valuationData.sharePriceLastNinetyDays;
              }
            })
            const next40Elements = sharePriceDetails.slice(40, 80);
            return next40Elements
          })
          hbs.registerHelper('sharePriceDataN40Length', ()=>{
            let sharePriceDetails = [];
            valuationResult.modelResults.map((response)=>{
              if(response.model === MODEL[7] && response.valuationData?.sharePriceLastNinetyDays){
               sharePriceDetails = response.valuationData.sharePriceLastNinetyDays;
              }
            })
            const next40Elements = sharePriceDetails.slice(40, 80);
            return next40Elements?.length ? true : false;
          })
          hbs.registerHelper('sharePriceDataRemaining', ()=>{
            let sharePriceDetails = [];
            valuationResult.modelResults.map((response)=>{
              if(response.model === MODEL[7] && response.valuationData?.sharePriceLastNinetyDays){
               sharePriceDetails = response.valuationData.sharePriceLastNinetyDays;
              }
            })
            const remainingElements = sharePriceDetails.slice(80);
            return remainingElements
          })
          hbs.registerHelper('sharePriceDataRemainingLength', ()=>{
            let sharePriceDetails = [];
            valuationResult.modelResults.map((response)=>{
              if(response.model === MODEL[7] && response.valuationData?.sharePriceLastNinetyDays){
               sharePriceDetails = response.valuationData.sharePriceLastNinetyDays;
              }
            })
            const remainingElements = sharePriceDetails.slice(80);
            return remainingElements?.length ? true : false;
          })

          hbs.registerHelper('strdate',()=>{
            if(valuationResult.inputData[0].valuationDate)
              return formatDate(new Date(valuationResult.inputData[0].valuationDate));
            return '';
          })

          hbs.registerHelper('provisionalDate',()=>{
            const provisionalDate = formatDate(new Date(valuationResult.provisionalDate));

            if(provisionalDate)
              return provisionalDate;
            return '';
          })

          hbs.registerHelper('relevantDate',()=>{
            if(valuationResult.inputData[0].valuationDate)
              return convertEpochToPlusOneDate(new Date(valuationResult.inputData[0].valuationDate));
            return '';
          })

          hbs.registerHelper('riskFreeRate',()=>{
            if(valuationResult.inputData[0]) 
                return valuationResult.inputData[0].riskFreeRate;
            return '';
          })

          hbs.registerHelper('beta',()=>{
            if(valuationResult.inputData[0]) 
                return valuationResult.inputData[0]?.beta?.toFixed(2);
            return '';
          })

          hbs.registerHelper('betaName',()=>{
            if(valuationResult.inputData[0].betaType)
              return REPORT_BETA_TYPES[`${valuationResult.inputData[0].betaType}`];
            return '';
          })

          hbs.registerHelper('companyRiskPremium',()=>{
            if(valuationResult.inputData[0]) 
                return valuationResult.inputData[0]?.riskPremium;
            return '';
          })

          hbs.registerHelper('industryRiskPremium',()=>{
            if(valuationResult.inputData[0]) 
                return valuationResult.inputData[0]?.industryRiskPremium;
            return '';
          })
    
          hbs.registerHelper('sizePremium',()=>{
            if(valuationResult.inputData[0]) 
                return valuationResult.inputData[0]?.sizePremium;
            return '';
          })

          hbs.registerHelper('costOfEquity',()=>{
            if(valuationResult.inputData[0]) 
                return formatPositiveAndNegativeValues(valuationResult.inputData[0].costOfEquity);
            return '';
          })
          hbs.registerHelper('adjustedCostOfEquity',()=>{
            if(valuationResult.inputData[0]) 
                return formatPositiveAndNegativeValues(valuationResult.inputData[0]?.adjustedCostOfEquity);
            return '';
          })
          hbs.registerHelper('wacc',()=>{
            if(valuationResult.inputData[0] && valuationResult.inputData[0].model.includes(MODEL[1])) 
                return formatPositiveAndNegativeValues(valuationResult.inputData[0]?.wacc);
            return '0';
          })
          // hbs.registerHelper('deRatio',()=>{
          //   if(valuationResult.inputData[0] && valuationResult.inputData[0].model.includes(MODEL[1])) 
          //       return valuationResult.inputData[0]?.wacc?.toFixed(2);
          //   return '0';
          // })

          hbs.registerHelper('equityOrDebt', (proportion)=>{
           return this.computeProportions(valuationResult, proportion, getCapitalStructure);
          })

          hbs.registerHelper('calculateWeightedProportion', (basis)=>{
            const proportion = this.computeProportions(valuationResult, basis, getCapitalStructure);
            if(basis === 'equity'){
              const adjCoe = convertToNumberOrZero(valuationResult.inputData[0].adjustedCostOfEquity) || 0;
              return (convertToNumberOrZero(adjCoe) * convertToNumberOrZero(proportion)/100).toFixed(2);
            }
            else{
              const postCostOfDebt = this.calculateCostOfDebt(valuationResult) || 0;
              return (convertToNumberOrZero(postCostOfDebt) * convertToNumberOrZero(proportion)/100).toFixed(2)
            }
          })
          
          hbs.registerHelper('costOfDebt',()=>{
            if(valuationResult.inputData[0] && valuationResult.inputData[0].model.includes(MODEL[1])) 
                return parseFloat(valuationResult.inputData[0]?.costOfDebt)?.toFixed(2);
            return '0';
          })

          hbs.registerHelper('costOfDebtMultipliedTaxRate',()=>{
            if(valuationResult.inputData[0] && valuationResult.inputData[0].model.includes(MODEL[1])) 
                return (convertToNumberOrZero(valuationResult.inputData[0]?.costOfDebt) * convertToNumberOrZero(this.fetchTotalTaxRate(valuationResult))/100).toFixed(2);
            return '0';
          })
          hbs.registerHelper('taxRate',()=>{
            if(valuationResult.inputData[0] ) 
                return this.fetchTotalTaxRate(valuationResult);
            return '0';
          })

          hbs.registerHelper('capitalStructureType', ()=>{
            const capitalStructureType = getCapitalStructure.result.capitalStructure.capitalStructureType;
            if(capitalStructureType){
              return CAPITAL_STRUCTURE_TYPE[`${capitalStructureType}`];
            }
            return '';
          })

          hbs.registerHelper('postCostOfDebt',()=>{
            if(valuationResult.inputData[0].model.includes(MODEL[1])){
              return this.calculateCostOfDebt(valuationResult);
            } 
            return '0';
          })

          hbs.registerHelper('riskFreeRateYears',()=>{
            if(valuationResult.inputData[0].riskFreeRateYears){
              return valuationResult.inputData[0].riskFreeRateYears;
            }
            return '';
          })

          hbs.registerHelper('formatValue',(value)=>{
            return formatPositiveAndNegativeValues(value);
          })

          hbs.registerHelper('isListedCompany',()=>{
            if(valuationResult.inputData)
              return valuationResult.inputData[0]?.companyId ? true : false;
          })
    
          hbs.registerHelper('updateDateFormat',(val)=>{
            return formatDateHyphenToDDMMYYYY(val);
          })
    
          hbs.registerHelper('totalRevenue',(vwap,volume)=>{
            return formatPositiveAndNegativeValues((convertToNumberOrZero(vwap) * convertToNumberOrZero(volume)));
          })

          hbs.registerHelper('vwap90DaysNSE',()=>{
            let vwapLastNinetyDays = 0;
            valuationResult.modelResults.map((response)=>{
              if(response.model === MODEL[7] && response.valuationData?.vwapLastNinetyDays){
                vwapLastNinetyDays = response.valuationData.vwapLastNinetyDays?.VWAPNSE;
              }
            })
            return vwapLastNinetyDays;
          })
          hbs.registerHelper('vwap90DaysBSE',()=>{
            let vwapLastNinetyDays = 0;
            valuationResult.modelResults.map((response)=>{
              if(response.model === MODEL[7] && response.valuationData?.vwapLastNinetyDays){
                vwapLastNinetyDays = response.valuationData.vwapLastNinetyDays?.VWAPBSE;
              }
            })
            return vwapLastNinetyDays;
          })
  
          hbs.registerHelper('vwap10DaysNSE',()=>{
            let vwapLastTenDays = 0;
            valuationResult.modelResults.map((response)=>{
              if(response.model === MODEL[7] && response.valuationData?.vwapLastTenDays){
                vwapLastTenDays = response.valuationData.vwapLastTenDays?.VWAPNSE;
              }
            })
            return vwapLastTenDays;
          })
          hbs.registerHelper('vwap10DaysBSE',()=>{
            let vwapLastTenDays = 0;
            valuationResult.modelResults.map((response)=>{
              if(response.model === MODEL[7] && response.valuationData?.vwapLastTenDays){
                vwapLastTenDays = response.valuationData.vwapLastTenDays?.VWAPBSE;
              }
            })
            return vwapLastTenDays;
          })
  
          hbs.registerHelper('floorPriceVwapNSE',()=>{
            let valuePerShare = 0;
            valuationResult.modelResults.map((response)=>{
              if(response.model === MODEL[7]){
                valuePerShare = response?.valuation.valuePerShareNse;
              }
            })
            return valuePerShare;
          })
          hbs.registerHelper('floorPriceVwapBSE',()=>{
            let valuePerShare = 0;
            valuationResult.modelResults.map((response)=>{
              if(response.model === MODEL[7]){
                valuePerShare = response?.valuation.valuePerShareBse;
              }
            })
            return valuePerShare;
          })

          hbs.registerHelper('isBetaFromAd',()=>{
            const betaFrom = valuationResult.inputData[0].formTwoData?.betaFrom || BETA_FROM.CAPITALIQ;
            if(
              betaFrom === BETA_FROM.ASWATHDAMODARAN
            ){
              return true;
            }
            return false;
          })

          hbs.registerHelper('registeredValuerName',()=>{
            if(reportDetails.registeredValuerDetails[0]) 
                return  reportDetails.registeredValuerDetails[0].registeredValuerName
            return '';
          })

          hbs.registerHelper('companyInfo',()=>{
            if(reportDetails.companyInfo){
              return reportDetails.companyInfo;
            }
            return '';
          })
    
          hbs.registerHelper('registeredValuerAddress',()=>{
            if(reportDetails.registeredValuerDetails[0]) 
                return reportDetails.registeredValuerDetails[0].registeredValuerGeneralAddress
            return '';
          })
          hbs.registerHelper('registeredValuerCorporateAddress',()=>{
            if(reportDetails.registeredValuerDetails[0]) 
                return  reportDetails.registeredValuerDetails[0].registeredValuerCorporateAddress ? reportDetails.registeredValuerDetails[0].registeredValuerCorporateAddress : reportDetails.registeredValuerDetails[0].registeredValuerGeneralAddress;
            return '';
          })
    
          hbs.registerHelper('registeredValuerEmailId',()=>{
            if(reportDetails.registeredValuerDetails[0]) 
                return  reportDetails.registeredValuerDetails[0].registeredValuerEmailId; 
            return '';
          })
    
          hbs.registerHelper('registeredValuerMobileNumber',()=>{
            if(reportDetails.registeredValuerDetails[0]) 
                return  reportDetails.registeredValuerDetails[0].registeredValuerMobileNumber; 
            return '';
          })
          hbs.registerHelper('registeredValuerIbbiId',()=>{
            if(reportDetails.registeredValuerDetails[0]) 
                return  reportDetails.registeredValuerDetails[0].registeredValuerIbbiId; 
            return '';
          })
          hbs.registerHelper('registeredValuerQualifications',()=>{
            if(reportDetails.registeredValuerDetails[0]) 
                return  reportDetails.registeredValuerDetails[0].registeredValuerQualifications; 
            return '';
          })
          hbs.registerHelper('registeredValuerCopNo',()=>{
            if(reportDetails.registeredValuerDetails[0]) {
              return  reportDetails.registeredValuerDetails[0]?.copNo
            }
            return '';
          })
          hbs.registerHelper('appointingAuthorityName',()=>{
            if(reportDetails.appointeeDetails[0]) 
                return  reportDetails.appointeeDetails[0].appointingAuthorityName; 
            return '';
          })
          hbs.registerHelper('dateOfAppointment',()=>{
            if(reportDetails)
                return formatDate(new Date(reportDetails.appointeeDetails[0].dateOfAppointment));
            return '';
          })
          hbs.registerHelper('dateOfIncorporation',()=>{
            if(reportDetails.appointeeDetails[0])
                return formatDate(new Date(reportDetails.dateOfIncorporation));
            return '';
          })
          hbs.registerHelper('cinNumber',()=>{
            if(reportDetails)
                return reportDetails.cinNumber
            return '';
          })
          hbs.registerHelper('companyAddress',()=>{
            if(reportDetails)
                return reportDetails.companyAddress;
            return '';
          })

          hbs.registerHelper('natureOfInstrument',()=>{
            if(reportDetails)
              return NATURE_OF_INSTRUMENT[`${reportDetails.natureOfInstrument}`];
            return '';
          })
          
          hbs.registerHelper('expectedMarketReturn',()=>{
            if(valuationResult.inputData[0]?.expMarketReturnSubType){
              return EXPECTED_MARKET_RETURN_TYPE[`${valuationResult.inputData[0].expMarketReturnSubType}`];
            }
            else{
              return '';
            }
          })
          hbs.registerHelper('expectedMarketReturnSource',()=>{
            const inputData = valuationResult.inputData[0];
            const expectedMarketReturnType = valuationResult.inputData[0]?.expMarketReturnType; 
            if(inputData && expectedMarketReturnType !== 'Analyst_Consensus_Estimates'){
              return EXPECTED_MARKET_RETURN_HISTORICAL_TYPE[`${valuationResult.inputData[0].expMarketReturnType}`]?.label;
            }
            else if(inputData && expectedMarketReturnType === 'Analyst_Consensus_Estimates'){
              return 'Analyst Consensus Estimates';
            }
            else {
              return '';
            }
          })

          hbs.registerHelper('expMarketReturn',()=>{
            if(valuationResult.inputData[0]) 
                return valuationResult.inputData[0]?.expMarketReturn.toFixed(2);
            return '';
          })

          hbs.registerHelper('reportSection',()=>{
            let outputObject = {};
            let letterIndex = 97; // this is the ascii code start
            for (const key in reportDetails.reportSection) {
                let element;
                if (letterIndex > 97) {
                  element = ` ${reportDetails.reportSection[key]}`;
                } else {
                  element = `${reportDetails.reportSection[key]}`;
                }
                outputObject[element] = key;
                letterIndex++;
            }
            return `${Object.keys(outputObject)}`;
          })
  
          hbs.registerHelper('reportPurpose',()=>{
            if(reportDetails?.reportPurpose)
              return `${REPORT_PURPOSE[`${reportDetails?.reportPurpose}`]}`;
            return '';
          })

          hbs.registerHelper('isSection165',()=>{
            if(reportDetails.reportSection.includes(`165 - SEBI (Issue of Capital and Disclosure Requirements) Regulations, 2018`)){
              return true;
            }
            return false;
          })

          hbs.registerHelper('bse500Value',()=>{
            if(valuationResult.inputData[0])
              return formatPositiveAndNegativeValues(valuationResult.inputData[0]?.bse500Value);
            return '-';
          })

          hbs.registerHelper('displayValuationHeader',()=>{
            let modelArray = [];
            let string;
          if(valuationResult.modelResults){
              valuationResult.modelResults.map((result)=>{
                modelArray.push(result.model);
              })
            }
          return this.generateString(modelArray, reportDetails);
          })

          hbs.registerHelper('selectedMultipleLabel',()=>{
            let  multiples, selectedMultiples = [], finalMultiplesArray = [];
            valuationResult.modelResults.map((data)=>{
              if(data.model === MODEL[2] || data.model === MODEL[4]){
                multiples = data.valuationData?.multiples;
              }
            })
            if(multiples){
              // if multiples exist then take those multiples which are selected by user   
              let multiplesArray = Object.keys(multiples).filter(key => multiples[key]);
              multiplesArray.map((indMulitple)=>{
                MULTIPLES_TYPE.map((multipleStruc)=>{
                  if(multipleStruc.key === indMulitple){
                    selectedMultiples.push(multipleStruc.label);
                  }
                })
              })
            }
            else{
              // If multiples does not exist, take all the default multiples from array
              MULTIPLES_TYPE.map((multipleStru)=>{
                 selectedMultiples.push(multipleStru.label)
               }
              );
            }

            // Replacing EV/S with P/S
            const priceToSalesMultipleIndex = selectedMultiples.indexOf('EV/S');
            if(priceToSalesMultipleIndex !== -1){
              selectedMultiples.splice(priceToSalesMultipleIndex, 1, 'P/S')
            }

            const filteredMultiples = selectedMultiples.filter(method => method !== null);
      
            const lastElementIndex = filteredMultiples.length - 1;
            if (lastElementIndex >= 1) {
              const allElementsExcptLast = filteredMultiples.slice(0, -1).join(', ');
              finalMultiplesArray.push(`${allElementsExcptLast} and ${filteredMultiples[lastElementIndex]}`);
            }
          
            const string = finalMultiplesArray.length ? finalMultiplesArray : selectedMultiples.join(', ');
            return string;
          })

          hbs.registerHelper('displayWeightsAssigned',()=>{  
            let weights = [], weightageArray = [];
            let blankInitiation:any = new Array(MODEL_ASC_ORDER.length).fill(false);
            if(valuationResult.inputData[0]?.model?.length > 1){
              reportDetails?.modelWeightageValue?.modelValue.map(
                (data)=>{
                  const frmtWght = formatPositiveAndNegativeValues(convertToNumberOrZero(data.weight) * 100); 
                  const wghtage = data.weight && frmtWght !== '-' ? frmtWght : 0;
                if(
                  data.model === MODEL[0] ||
                  data.model === MODEL[1] || 
                  data.model === MODEL[5] || 
                  data.model === MODEL[2] || 
                  data.model === MODEL[4] || 
                  (
                    data.model === MODEL[7] && 
                    (
                      reportDetails.reportSection.includes("166(A) - SEBI (Issue of Capital and Disclosure Requirements) Regulations, 2018") && 
                      reportDetails.reportSection.length === 1
                    )
                  )
                ){
                  blankInitiation.splice(MODEL_ASC_ORDER.indexOf(data.model), 1, `${wghtage}%`)
                }
              })
              blankInitiation = blankInitiation.filter(_wght => {return _wght})
            }
            else{
              // If only one model is there, keep default as 100% 
            blankInitiation = new Array().push('100%');
            }
            if(blankInitiation.length > 1){
              const lastElement = blankInitiation[blankInitiation.length - 1];
              const otherElement = blankInitiation.slice(0, -1).join(', ');
              weightageArray.push(`${otherElement} and ${lastElement}`);
            }
            else{
              weightageArray.push(blankInitiation);
            }

          return weightageArray;
          })

          hbs.registerHelper('loadAnnexureLabelsOnly', ()=>{
          const model = valuationResult.inputData[0].model;
          const companyName = valuationResult.inputData[0].company;

          const entireModelsStructure = [...NET_ASSET_VALUE_APPROACH, ...INCOME_APPROACH , ...MARKET_PRICE_APPROACH];
          let formatisedModelOrderwise = [];
          for (let singleModelStructure of entireModelsStructure){
            for (let singleModelSelected of model){
              if(singleModelStructure === singleModelSelected){
                formatisedModelOrderwise.push(singleModelStructure);
              }
            }
          }

          // Using orderwise model as per sebi report [NAV --> DCF --> MARKET_APPROACH]
          let counter = 0, labelArray = [];
          for (const indModel of formatisedModelOrderwise){
            if(indModel === MODEL[5]){
              this.navAnnexureSerialNo = convertToRomanNumeral(counter,true);
              labelArray.push(`
                  <p style="padding-top: 4pt;text-indent: 0pt;line-height: 140%;text-align: left;padding-bottom:5pt;">
                  <span class="s18">
                    Annexure ${this.navAnnexureSerialNo}: 
                  </span>
                  <span class="s17">
                    Determination of value per equity shares of 
                  </span>
                  <span class="s19">
                    ${companyName}
                  </span>
                  <span class="s17"> 
                    using Net Asset Value method;
                  </span>
                </p>
              `)
            }
            if(indModel === MODEL[0] || indModel === MODEL[1]){
              this.dcfAnnexureSerialNo = convertToRomanNumeral(counter,true);
              labelArray.push(` 
                <p style="padding-top: 4pt;text-indent: 0pt;line-height: 140%;text-align: left;padding-bottom:5pt;">
                  <span class="s18">
                    Annexure ${this.dcfAnnexureSerialNo}: 
                  </span>
                  <span class="s17">
                    Determination of value per equity shares of 
                  </span>
                  <span class="s19">
                    ${companyName}
                  </span>
                  <span class="s17"> 
                    using Discounted Cash Flow method;
                  </span>
                </p>
              `)
            }
            if(indModel === MODEL[2] || indModel === MODEL[4]){
              this.marketApproachAnnexureSerialNo = convertToRomanNumeral(counter,true);
              labelArray.push(` 
               <p style="text-indent: 0pt;line-height: 115%;text-align: left;line-height: 140%;padding-bottom:5pt;">
                  <span class="s18">
                    Annexure ${this.marketApproachAnnexureSerialNo}:
                  </span>
                  <span class="s17">
                    Determination of value per equity share of 
                  </span>
                  <span class="s19">
                    ${companyName}
                  </span>
                  <span class="s17"> 
                    using Comparable Companies method
                  </span>
                </p>
              `)
            }
            counter ++;
          }
            return labelArray.join('');
          })

          hbs.registerHelper('projectedYear',()=>{
            const finalYearColumn = valuationResult.modelResults;
            let finalProjYear;
            finalYearColumn.map((elements)=>{
              if(elements.model === MODEL[0] || elements.model === MODEL[1]){
                finalProjYear = elements.valuationData[elements.valuationData.length - 1].particulars || '24-25';
              }
            })
            if(finalProjYear)
              return `20${finalProjYear.split('-')[0]}-${finalProjYear.split('-')[1]}`;
            return '2028';
          })

          hbs.registerHelper('terminalGrowthRate',()=>{
            if(valuationResult.inputData[0]) 
                return valuationResult.inputData[0]?.terminalGrowthRate;
            return '0';
          })


          hbs.registerHelper('currencyUnit',()=>{
            if(valuationResult.inputData[0].currencyUnit)
              return valuationResult.inputData[0].currencyUnit;
            return 'INR';
          })

          hbs.registerHelper('reportingUnit',()=>{
            if(valuationResult.inputData[0].reportingUnit)
              return valuationResult.inputData[0].reportingUnit === REPORTING_UNIT.ABSOLUTE ? '' : valuationResult.inputData[0].reportingUnit;
            return 'Lakhs';
          })

          hbs.registerHelper('modelIncludes', (value, options) => {
            const approaches = {
                'INCOME_APPROACH': INCOME_APPROACH,
                'NET_ASSET_VALUE_APPROACH': NET_ASSET_VALUE_APPROACH,
                'MARKET_PRICE_APPROACH': MARKET_PRICE_APPROACH
            };
        
            const approachModels = approaches[value];
            if (approachModels) {
              const found = valuationResult.modelResults.some(response => {
                  return approachModels.includes(response.model);
              });
      
              if (found) {
                  return options.fn(this);
              } else {
                  return '';
              }
            }
        });

        // hbs.registerHelper('netAssetValue',()=>{
        //   let navData = [];
        //   valuationResult.modelResults.forEach((result)=>{
        //     if(result.model === MODEL[5]){
        //       navData = Object.values(result.valuationData);
        //      const firmValueInd = navData.findIndex((item:any)=>item.fieldName === 'Firm Value');
        //      const netCurrentAssetInd = navData.findIndex((item:any)=>item.fieldName === 'Net Current Assets');
        //      const emptyObj={ //push this empty object to have empty td between two td tags
        //         fieldName:'',
        //         // type:'',
        //         bookValue:'',
        //         fairValue:''
        //       }
        //      navData.splice(firmValueInd,0,emptyObj);
        //      navData.splice(netCurrentAssetInd,0,emptyObj);

        //      navData = navData.map((indNav)=>{
        //       return {
        //         fieldName:indNav.fieldName,
        //         // type:indNav.type === 'book_value' ? 'Book Value' : indNav.type === 'market_value' ? 'Market Value' : indNav.type,
        //         bookValue:indNav?.bookValue === null ? null : indNav?.bookValue === 0 || indNav?.bookValue ? formatPositiveAndNegativeValues(indNav.bookValue) : indNav?.bookValue,
        //         fairValue:indNav?.fairValue === 0 || indNav?.fairValue ? formatPositiveAndNegativeValues(indNav.fairValue) : indNav.value  === 0 || indNav?.value ? formatPositiveAndNegativeValues(indNav.value): indNav?.value
        //       }
        //      })
        //     }
        //   })
        //   return navData;
        // })

        hbs.registerHelper('iterateNAVData', () => {
          let navData = [];
            valuationResult.modelResults.forEach((result)=>{
                if(result.model === MODEL[5]){
                    navData = Object.values(result.valuationData);
                }
            })
            return this.navReportService.navTableStructure(navData, 28);
        })

        hbs.registerHelper('checkHead',(txt,val)=>{
          if(typeof txt === 'number' && val === 'srNo'){
            return true;
          }
          if(txt === '' && val === 'particular'){
            return true;
          }
          if(txt.includes('Value per share') && val === 'onlyValuePerShare'){
            return true
          }
          return false
        })

        hbs.registerHelper('checkSubHead',(txt,val)=>{
          if(typeof txt === 'number' && val === 'srNo'){
            return true;
          }
          if(txt === '' && val === 'particular'){
            return true;
          }

          if( txt === 'Equity Value' || txt === 'Firm Value'|| txt === 'Net Current Assets' || txt === 'Non Current Assets' || txt === 'Non Current Assets' || txt ===  'Total Non Current Assets'   )
          {
            return true;
          }
          return false
        })

        hbs.registerHelper('faceValue',()=>{
          if(valuationResult?.inputData[0]?.faceValue){
              return `${valuationResult.inputData[0].faceValue}/-`;
          }
          return '10/-'
        })
        hbs.registerHelper('faceValueToWords',()=>{
            if(valuationResult?.inputData[0]?.faceValue){
                return `Rupees ${converter.toWords(valuationResult.inputData[0].faceValue)} Only`;
            }
            return 'Rupees Ten Only'
        })

        hbs.registerHelper('isValuePerShareNegative',(modelName)=>{
          modelName = modelName.split(',');
          let isNegativeValuePerShare = false;
               modelName.flatMap((models) => {
                  valuationResult.modelResults.flatMap((response) => {
                  if (response.model === models && models === 'NAV') {
                      const bookValue = response?.valuationData?.valuePerShare?.bookValue || 0;
                      const faceValue = valuationResult.inputData[0]?.faceValue || 0;
                      if(bookValue < 0){
                          isNegativeValuePerShare = true
                      }
                  }
                  });
              });
              return isNegativeValuePerShare;
          })

          hbs.registerHelper('isValuePerLessThanFairValue',(modelName)=>{
            modelName = modelName.split(',');
            let lessThanFairValue = false;
                 modelName.flatMap((models) => {
                    valuationResult.modelResults.flatMap((response) => {
                    if (response.model === models && models === 'NAV') {
                        const fairValue = response?.valuationData?.valuePerShare?.fairValue || 0;
                        const faceValue = valuationResult.inputData[0]?.faceValue || 0;
                        if(fairValue < faceValue){
                            lessThanFairValue = true;
                        }
                    }
                    });
                });
                return lessThanFairValue;
             
            })

          hbs.registerHelper('checkIfFcff',()=>{
            let isFcff = false;
            if(valuationResult.modelResults){
              valuationResult.modelResults.map((result)=>{
    
                if(result.model === MODEL[1]){
                  isFcff = true;
                }
              })
            }
            return isFcff;
          })
          hbs.registerHelper('valuationLengthGreater',()=>{
            let boolValuationLength = false;
            valuationResult.modelResults.forEach((result)=>{
              if(result.model === 'FCFE'){
                if(result.valuationData.length > 4)
                  boolValuationLength = true;
              }
              else if(result.model === 'FCFF'){
                if(result.valuationData.length > 4)
                  boolValuationLength = true;
              }
              else if(result.model === 'Excess_Earnings'){
                if(result.valuationData.length > 4)
                  boolValuationLength = true;
              }
            })
            return boolValuationLength;
          })

          hbs.registerHelper('projectionResultTableHeader',()=>{
            let headers=[];
            valuationResult.modelResults.map((response)=>{
              if(response.model === MODEL[0] || response.model === MODEL[1]){
                
                // map all the column headers for pdf
                 headers = response?.valuationData.map((columnHeader)=>{
                  if(columnHeader?.particulars){
                    return {columnHeader:columnHeader.particulars}
                  }
                })
                headers.unshift({columnHeader:'Particulars'});
                headers.push({columnHeader:'Terminal Period'});
              }
            })
            return headers;
          })

          hbs.registerHelper('PAT', () => {
            let arrayPAT = [];
            const terminalValueType = allProcessStageDetails.stateInfo?.fifthStageInput?.terminalValueSelectedType ||  'tvCashFlowBased';
            let boolTvCashFlowBased = terminalValueType === 'tvCashFlowBased';    //Checking for default condition
            valuationResult.modelResults.forEach((result)=>{
              if(result.model === 'FCFE'){
                const terminalYearPat = result.terminalYearWorking.pat;
                result.valuationData.map((response:any)=>{              
                  const patValue = formatPositiveAndNegativeValues(response?.pat);
                  arrayPAT.push({fcfePat:patValue});
                })
                arrayPAT.unshift({fcfePat:"PAT"});
                if(!boolTvCashFlowBased){
                  arrayPAT.push({fcfePat: formatPositiveAndNegativeValues(terminalYearPat)});
                }
              }
              else if(result.model === 'FCFF'){
                const terminalYearPat = result.terminalYearWorking.pat;
                result.valuationData.map((response:any)=>{
                  const patValue = formatPositiveAndNegativeValues(response?.pat);
                  arrayPAT.push({fcffPat:patValue})
                })
                arrayPAT.unshift({fcffPat:"PAT"});
                if(!boolTvCashFlowBased){
                  arrayPAT.push({fcffPat: formatPositiveAndNegativeValues(terminalYearPat)});
                }
              }
              else if(result.model === 'Excess_Earnings'){
                result.valuationData.map((response:any)=>{
                  const patValue = formatPositiveAndNegativeValues(response?.pat);
                  arrayPAT.push({excessEarningPat:patValue})
                })
                arrayPAT.unshift({excessEarningPat:"PAT"});
              }
            })
            return arrayPAT;
          });
          
          hbs.registerHelper('FCFF', () => {
            let arrayfcff = [];
            const terminalValueType = allProcessStageDetails.stateInfo?.fifthStageInput?.terminalValueSelectedType ||  'tvCashFlowBased';
            let boolTvCashFlowBased = terminalValueType === 'tvCashFlowBased';    //Checking for default condition
            valuationResult.modelResults.forEach((result)=>{
              if(result.model === 'FCFF'){
                const terminalValueFcffBasedOnPat = result.terminalYearWorking.fcff;
                const terminalValueFcffBasedOnLastYear = result.terminalYearWorking.terminalValueBasedOnLastYear;
                result.valuationData.map((response:any)=>{
                  const fcffValue = formatPositiveAndNegativeValues(response.fcff);
                  arrayfcff.push({fcff:fcffValue})
                })
                arrayfcff.unshift({fcff:"FCFF"});
                if(!boolTvCashFlowBased){
                  arrayfcff.push({fcff:formatPositiveAndNegativeValues(terminalValueFcffBasedOnPat)});
                }else{
                  arrayfcff.push({fcff:formatPositiveAndNegativeValues(terminalValueFcffBasedOnLastYear)});
                }
              }
            })
            return arrayfcff;
          });
    
          hbs.registerHelper('depAndAmortisation', () => {
            let arraydepAndAmortisation = [];
            const terminalValueType = allProcessStageDetails.stateInfo?.fifthStageInput?.terminalValueSelectedType ||  'tvCashFlowBased';
            let boolTvCashFlowBased = terminalValueType === 'tvCashFlowBased';    //Checking for default condition
            valuationResult.modelResults.forEach((result)=>{
              if(result.model === 'FCFE'){
                const terminalYearDepnAndAmortisation = result.terminalYearWorking.depAndAmortisation;
                result.valuationData.map((response:any)=>{
                  const depAndAmortisation = formatPositiveAndNegativeValues(response?.depAndAmortisation);
                  arraydepAndAmortisation.push({fcfeDepAmortisation:depAndAmortisation})
                })
                arraydepAndAmortisation.unshift({fcfeDepAmortisation:"Depn. and Amortn."});
                if(!boolTvCashFlowBased){
                  arraydepAndAmortisation.push({fcfeDepAmortisation:formatPositiveAndNegativeValues(terminalYearDepnAndAmortisation)});
                }
              }
              else if (result.model === 'FCFF'){
                const terminalYearDepnAndAmortisation = result.terminalYearWorking.depAndAmortisation;
                result.valuationData.map((response:any)=>{
                 const depAndAmortisation = formatPositiveAndNegativeValues(response.depAndAmortisation)
                  arraydepAndAmortisation.push({fcffDepAmortisation:depAndAmortisation})
                })
                arraydepAndAmortisation.unshift({fcffDepAmortisation:"Depn. and Amortn."});
                if(!boolTvCashFlowBased){
                  arraydepAndAmortisation.push({fcffDepAmortisation:formatPositiveAndNegativeValues(terminalYearDepnAndAmortisation)});
                }
              }
            })
            return arraydepAndAmortisation;
          });
    
          hbs.registerHelper('InterestAdjTaxes', () => {
            let arrayaddInterestAdjTaxes = [];
            const terminalValueType = allProcessStageDetails.stateInfo?.fifthStageInput?.terminalValueSelectedType ||  'tvCashFlowBased';
            let boolTvCashFlowBased = terminalValueType === 'tvCashFlowBased';    //Checking for default condition
            valuationResult.modelResults.forEach((result)=>{
              if(result.model === 'FCFE'){
                const terminalValueInterestAdjTax = result.terminalYearWorking.addInterestAdjTaxes;
                result.valuationData.map((response:any)=>{
                  const addInterestAdjTaxesValue = formatPositiveAndNegativeValues(response?.addInterestAdjTaxes);
                  arrayaddInterestAdjTaxes.push({fcfeAddInterestAdjTaxes:addInterestAdjTaxesValue})
                })
                arrayaddInterestAdjTaxes.unshift({fcfeAddInterestAdjTaxes:"Add: Interest Adjusted Taxes"});
                if(!boolTvCashFlowBased){
                  arrayaddInterestAdjTaxes.push({fcfeAddInterestAdjTaxes:formatPositiveAndNegativeValues(terminalValueInterestAdjTax)})
                }
              }
              else if(result.model === 'FCFF'){
                const terminalValueInterestAdjTax = result.terminalYearWorking.addInterestAdjTaxes;
                result.valuationData.map((response:any)=>{
                  const addInterestAdjTaxesValue = formatPositiveAndNegativeValues(response?.addInterestAdjTaxes);
                  arrayaddInterestAdjTaxes.push({fcffAddInterestAdjTaxes:addInterestAdjTaxesValue})
                })
                arrayaddInterestAdjTaxes.unshift({fcffAddInterestAdjTaxes:"Add: Interest Adjusted Taxes"});
                if(!boolTvCashFlowBased){
                  arrayaddInterestAdjTaxes.push({fcffAddInterestAdjTaxes:formatPositiveAndNegativeValues(terminalValueInterestAdjTax)})
                }
              }
            })
            return arrayaddInterestAdjTaxes;
          });
    
          hbs.registerHelper('nonCashItem', () => {
            let arrayonCashItems = [];
            const terminalValueType = allProcessStageDetails.stateInfo?.fifthStageInput?.terminalValueSelectedType ||  'tvCashFlowBased';
            let boolTvCashFlowBased = terminalValueType === 'tvCashFlowBased';    //Checking for default condition
            valuationResult.modelResults.forEach((result)=>{
              if(result.model === 'FCFE'){
                result.valuationData.map((response:any)=>{
                 const nonCashItem = formatPositiveAndNegativeValues(response?.onCashItems)
                  arrayonCashItems.push({fcfeOnCashItems:nonCashItem})
                })
                arrayonCashItems.unshift({fcfeOnCashItems:"Other Non Cash items"});
                if(!boolTvCashFlowBased){
                  arrayonCashItems.push({fcfeOnCashItems:'-'})    //Purposely pushing empty object since for terminal year column non cash item is 0
                }
              }
              else if(result.model === 'FCFF'){
                result.valuationData.map((response:any)=>{
                  const nonCashItem = formatPositiveAndNegativeValues(response?.onCashItems)
    
                  arrayonCashItems.push({fcffOnCashItems:nonCashItem})
                })
                arrayonCashItems.unshift({fcffOnCashItems:"Other Non Cash items"});
                if(!boolTvCashFlowBased){
                  arrayonCashItems.push({fcffOnCashItems:'-'})    //Purposely pushing empty object since for terminal year column non cash item is 0
                }
              }
            })
            return arrayonCashItems;
          });
    
          hbs.registerHelper('NCA', () => {
            let arrayNca = [];
            const terminalValueType = allProcessStageDetails.stateInfo?.fifthStageInput?.terminalValueSelectedType ||  'tvCashFlowBased';
            let boolTvCashFlowBased = terminalValueType === 'tvCashFlowBased';    //Checking for default condition
            valuationResult.modelResults.forEach((result)=>{
              if(result.model === 'FCFE'){
                const terminalValueNca = result.terminalYearWorking.nca;
                result.valuationData.map((response:any)=>{
                  const ncaValue = formatPositiveAndNegativeValues(response?.nca);
                  arrayNca.push({fcfeNca:ncaValue})
                })
                arrayNca.unshift({fcfeNca:"Change in NCA"});
                if(!boolTvCashFlowBased){
                  arrayNca.push({fcfeNca:formatPositiveAndNegativeValues(terminalValueNca)})
                }
              }
              else if(result.model === 'FCFF'){
                const terminalValueNca = result.terminalYearWorking.nca;
                result.valuationData.map((response:any)=>{
                  const ncaValue = formatPositiveAndNegativeValues(response?.nca);
                  arrayNca.push({fcffNca:ncaValue})
                })
                arrayNca.unshift({fcffNca:"Change in NCA"});
                if(!boolTvCashFlowBased){
                  arrayNca.push({fcffNca:formatPositiveAndNegativeValues(terminalValueNca)})
                }
              }
            })
            return arrayNca;
          });
    
          hbs.registerHelper('defferTaxAssets', () => {
            let arraydefferedTaxAssets = [];
            const terminalValueType = allProcessStageDetails.stateInfo?.fifthStageInput?.terminalValueSelectedType ||  'tvCashFlowBased';
            let boolTvCashFlowBased = terminalValueType === 'tvCashFlowBased';    //Checking for default condition
            valuationResult.modelResults.forEach((result)=>{
              if(result.model === 'FCFE'){
                const terminalValueDeferredTaxAsset = result.terminalYearWorking.defferedTaxAssets;
                result.valuationData.map((response:any)=>{
                  const deferredTaxValue = formatPositiveAndNegativeValues(response?.defferedTaxAssets);
                  arraydefferedTaxAssets.push({fcfeDefferedTaxAssets:deferredTaxValue})
                })
                arraydefferedTaxAssets.unshift({fcfeDefferedTaxAssets:"Add/Less: Deferred Tax Assets(Net)"});
                if(!boolTvCashFlowBased){
                  arraydefferedTaxAssets.push({fcfeDefferedTaxAssets:formatPositiveAndNegativeValues(terminalValueDeferredTaxAsset)});
                }
              }
              else if(result.model === 'FCFF'){
                const terminalValueDeferredTaxAsset = result.terminalYearWorking.defferedTaxAssets;
                result.valuationData.map((response:any)=>{
                  const deferredTaxValue = formatPositiveAndNegativeValues(response?.defferedTaxAssets);
                  arraydefferedTaxAssets.push({fcffDefferedTaxAssets:deferredTaxValue})
                })
                arraydefferedTaxAssets.unshift({fcffDefferedTaxAssets:"Add/Less: Deferred Tax Assets(Net)"});
                if(!boolTvCashFlowBased){
                  arraydefferedTaxAssets.push({fcffDefferedTaxAssets:formatPositiveAndNegativeValues(terminalValueDeferredTaxAsset)});
                }
              }
            })
            return arraydefferedTaxAssets;
          });
    
          hbs.registerHelper('changeInBorrowing', () => {
            let arrayChangeInBorrowings = [];
            const terminalValueType = allProcessStageDetails.stateInfo?.fifthStageInput?.terminalValueSelectedType ||  'tvCashFlowBased';
            let boolTvCashFlowBased = terminalValueType === 'tvCashFlowBased';    //Checking for default condition
            valuationResult.modelResults.forEach((result)=>{
              if(result.model === 'FCFE'){
                const terminalValueChangeInBorrowings = result.terminalYearWorking.changeInBorrowings;
                result.valuationData.map((response:any)=>{
                  const changeInBorrowingValue = formatPositiveAndNegativeValues(response?.changeInBorrowings);
                  arrayChangeInBorrowings.push({changeInBorrowings:changeInBorrowingValue})
                })
                arrayChangeInBorrowings.unshift({changeInBorrowings:"Change in Borrowings"});
                if(!boolTvCashFlowBased){
                  arrayChangeInBorrowings.push({changeInBorrowings:formatPositiveAndNegativeValues(terminalValueChangeInBorrowings)});
                }
              }
            })
            return arrayChangeInBorrowings;
          });
    
          hbs.registerHelper('netCshFlow', () => {
            let arrayNetCashFlow = [];
            const terminalValueType = allProcessStageDetails.stateInfo?.fifthStageInput?.terminalValueSelectedType ||  'tvCashFlowBased';
            let boolTvCashFlowBased = terminalValueType === 'tvCashFlowBased';    //Checking for default condition
            valuationResult.modelResults.forEach((result)=>{
              if(result.model === 'FCFE'){
                const terminalValueNetCashFlow = result.terminalYearWorking.netCashFlow;
                result.valuationData.map((response:any)=>{
                  const netCashFlowValue = formatPositiveAndNegativeValues(response?.netCashFlow);
                  arrayNetCashFlow.push({fcfeNetCashFlow:netCashFlowValue})
                })
                arrayNetCashFlow.unshift({fcfeNetCashFlow:"Net Cash Flow"});
                if(!boolTvCashFlowBased){
                  arrayNetCashFlow.push({fcfeNetCashFlow:formatPositiveAndNegativeValues(terminalValueNetCashFlow)});
                }
              }
              if(result.model === 'FCFF'){
                const terminalValueNetCashFlow = result.terminalYearWorking.netCashFlow;
                result.valuationData.map((response:any)=>{
                  const netCashFlowValue = formatPositiveAndNegativeValues(response?.netCashFlow);
                  arrayNetCashFlow.push({fcffNetCashFlow:netCashFlowValue})
                })
                arrayNetCashFlow.unshift({fcffNetCashFlow:"Net Cash Flow"});
                if(!boolTvCashFlowBased){
                  arrayNetCashFlow.push({fcffNetCashFlow:formatPositiveAndNegativeValues(terminalValueNetCashFlow)});
                }
              }
            })
            return arrayNetCashFlow;
          });
    
          hbs.registerHelper('fxdCshFlow', () => {
            let arrayFixedAssets = [];
            const terminalValueType = allProcessStageDetails.stateInfo?.fifthStageInput?.terminalValueSelectedType ||  'tvCashFlowBased';
            let boolTvCashFlowBased = terminalValueType === 'tvCashFlowBased';    //Checking for default condition
            valuationResult.modelResults.forEach((result)=>{
              if(result.model === 'FCFE'){
                const terminalValueFixedAssets = result.terminalYearWorking.fixedAssets;
                result.valuationData.map((response:any)=>{
                  const fixedAssetsValue = formatPositiveAndNegativeValues(response?.fixedAssets);
                  arrayFixedAssets.push({fcfeFixedAssets:fixedAssetsValue})
                })
                arrayFixedAssets.unshift({fcfeFixedAssets:"Change in fixed assets"});
                if(!boolTvCashFlowBased){
                  arrayFixedAssets.push({fcfeFixedAssets:formatPositiveAndNegativeValues(terminalValueFixedAssets)});
                }
              }
              else if(result.model === 'FCFF'){
                const terminalValueFixedAssets = result.terminalYearWorking.fixedAssets;
                result.valuationData.map((response:any)=>{
                  const fixedAssetsValue = formatPositiveAndNegativeValues(response?.fixedAssets);
                  arrayFixedAssets.push({fcffFixedAssets:fixedAssetsValue})
                })
                arrayFixedAssets.unshift({fcffFixedAssets:"Change in fixed assets"});
                if(!boolTvCashFlowBased){
                  arrayFixedAssets.push({fcffFixedAssets:formatPositiveAndNegativeValues(terminalValueFixedAssets)});
                }
              }
            })
            return arrayFixedAssets;
          });
          
          hbs.registerHelper('FCFE', () => {
            let arrayfcff = [];
            const terminalValueType = allProcessStageDetails.stateInfo?.fifthStageInput?.terminalValueSelectedType ||  'tvCashFlowBased';
            let boolTvCashFlowBased = terminalValueType === 'tvCashFlowBased';    //Checking for default condition
            valuationResult.modelResults.forEach((result)=>{
              if(result.model === 'FCFE'){
                const terminalValueFcffBasedOnPat = result.terminalYearWorking.fcff;
                const terminalValueFcffBasedOnLastYear = result.terminalYearWorking.terminalValueBasedOnLastYear;
                result.valuationData.map((response:any)=>{
                  const fcffValue = formatPositiveAndNegativeValues(response?.fcff);
                  arrayfcff.push({fcff:fcffValue})
                })
                arrayfcff.unshift({fcff:"FCFE"});
                if(!boolTvCashFlowBased){
                  arrayfcff.push({fcff:formatPositiveAndNegativeValues(terminalValueFcffBasedOnPat)});
                }else{
                  arrayfcff.push({fcff:formatPositiveAndNegativeValues(terminalValueFcffBasedOnLastYear)});
                }
              }
            })
            return arrayfcff;
          });
          
          hbs.registerHelper('discPeriod', () => {
            let arrayDiscountingPeriod = [];
            const terminalValueType = allProcessStageDetails.stateInfo?.fifthStageInput?.terminalValueSelectedType ||  'tvCashFlowBased';
            let boolTvCashFlowBased = terminalValueType === 'tvCashFlowBased';    //Checking for default condition
            valuationResult.modelResults.forEach((result)=>{
              if(result.model === 'FCFE'){
                const terminalValueDiscountingPeriod = result.terminalYearWorking.discountingPeriod;
                result.valuationData.map((response:any)=>{
                  const discountingPeriodValue = formatPositiveAndNegativeValues(response?.discountingPeriod);
                  arrayDiscountingPeriod.push({fcfeDiscountingPeriod:discountingPeriodValue})
                })
                arrayDiscountingPeriod.unshift({fcfeDiscountingPeriod:"Discounting Period"});
                if(boolTvCashFlowBased){
                  arrayDiscountingPeriod.push({fcfeDiscountingPeriod:formatPositiveAndNegativeValues(terminalValueDiscountingPeriod)});
                }
              }
              else if(result.model === 'FCFF'){
                const terminalValueDiscountingPeriod = result.terminalYearWorking.discountingPeriod;
                result.valuationData.map((response:any)=>{
                  const discountingPeriodValue = formatPositiveAndNegativeValues(response?.discountingPeriod);
                  arrayDiscountingPeriod.push({fcffDiscountingPeriod:discountingPeriodValue})
                })
                arrayDiscountingPeriod.unshift({fcffDiscountingPeriod:"Discounting Period"});
                if(boolTvCashFlowBased){
                  arrayDiscountingPeriod.push({fcffDiscountingPeriod:formatPositiveAndNegativeValues(terminalValueDiscountingPeriod)});
                }
              }
              else if(result.model === 'Excess_Earnings'){
                result.valuationData.map((response:any)=>{
                  const discountingPeriodValue = formatPositiveAndNegativeValues(response?.discountingPeriod);
                  arrayDiscountingPeriod.push({excessEarningDiscountingPeriod:discountingPeriodValue})
                })
                arrayDiscountingPeriod.unshift({excessEarningDiscountingPeriod:"Discounting Period"});
              }
            })
            return arrayDiscountingPeriod;
          });
          
          hbs.registerHelper('discFactor', () => {
            let arrayDiscountingFactor = [];
            const terminalValueType = allProcessStageDetails.stateInfo?.fifthStageInput?.terminalValueSelectedType ||  'tvCashFlowBased';
            let boolTvCashFlowBased = terminalValueType === 'tvCashFlowBased';    //Checking for default condition
            valuationResult.modelResults.forEach((result)=>{
              if(result.model === 'FCFE'){
                const terminalValueDiscountingFactor = result.terminalYearWorking.discountingFactor;
                result.valuationData.map((response:any)=>{
                  const discountingFactorValue = formatPositiveAndNegativeValues(response?.discountingFactor);
                  arrayDiscountingFactor.push({fcfeDiscountingFactor:discountingFactorValue})
                })
                arrayDiscountingFactor.unshift({fcfeDiscountingFactor:"Discounting Factor"});
                if(boolTvCashFlowBased){
                  arrayDiscountingFactor.push({fcfeDiscountingFactor:formatPositiveAndNegativeValues(terminalValueDiscountingFactor)});
                }
              }
              else if(result.model === 'FCFF'){
                const terminalValueDiscountingFactor = result.terminalYearWorking.discountingFactor;
                result.valuationData.map((response:any)=>{
                  const discountingFactorValue = formatPositiveAndNegativeValues(response?.discountingFactor);
                  arrayDiscountingFactor.push({fcffDiscountingFactor:discountingFactorValue})
                })
                arrayDiscountingFactor.unshift({fcffDiscountingFactor:"Discounting Factor"});
                if(boolTvCashFlowBased){
                  arrayDiscountingFactor.push({fcffDiscountingFactor:formatPositiveAndNegativeValues(terminalValueDiscountingFactor)});
                }
              }
              else if(result.model === 'Excess_Earnings'){
                result.valuationData.map((response:any)=>{
                  const discountingFactorValue = formatPositiveAndNegativeValues(response?.discountingFactor);
                  arrayDiscountingFactor.push({excessEarningDiscountingFactor:discountingFactorValue})
                })
                arrayDiscountingFactor.unshift({excessEarningDiscountingFactor:"Discounting Factor"});
              }
            })
            return arrayDiscountingFactor;
          });
          
          hbs.registerHelper('prsntFCFF', () => {
            let arrayPresentFCFF = [];
            const terminalValueType = allProcessStageDetails.stateInfo?.fifthStageInput?.terminalValueSelectedType ||  'tvCashFlowBased';
            let boolTvCashFlowBased = terminalValueType === 'tvCashFlowBased';    //Checking for default condition
            valuationResult.modelResults.forEach((result)=>{
              if(result.model === 'FCFE'){
                const terminalValuePresentFCFFBasedOnPat = terminalYearWorkings?.terminalValueWorking?.pvTerminalValue || 0;
                const terminalValuePresentFCFFBasedOnLastYear = result.terminalYearWorking.presentFCFF || 0;
                result.valuationData.map((response:any)=>{
                  const presentFCFFValue = formatPositiveAndNegativeValues(response?.presentFCFF);
                  arrayPresentFCFF.push({fcfePresentFCFF:presentFCFFValue})
                })
                arrayPresentFCFF.unshift({fcfePresentFCFF:result?.model === 'FCFF' ? "Present Value of FCFF" : "Present Value of FCFE"});
                // if(!boolTvCashFlowBased){
                  //   arrayPresentFCFF.push({fcfePresentFCFF:formatPositiveAndNegativeValues(terminalValuePresentFCFFBasedOnPat)});
                  // }
                  // else{
                if(boolTvCashFlowBased){
                  arrayPresentFCFF.push({fcfePresentFCFF:formatPositiveAndNegativeValues(terminalValuePresentFCFFBasedOnLastYear)});
                }
              }
              else if(result.model === 'FCFF'){
                const terminalValuePresentFCFFBasedOnPat = terminalYearWorkings?.terminalValueWorking?.pvTerminalValue || 0;
                const terminalValuePresentFCFFBasedOnLastYear = result.terminalYearWorking.presentFCFF || 0;
                result.valuationData.map((response:any)=>{
                  const presentFCFFValue = formatPositiveAndNegativeValues(response?.presentFCFF);
                  arrayPresentFCFF.push({fcffPresentFCFF:presentFCFFValue})
                })
                arrayPresentFCFF.unshift({fcffPresentFCFF:result?.model === 'FCFF' ? "Present Value of FCFF" : "Present Value of FCFE"});
                // if(!boolTvCashFlowBased){
                  //   arrayPresentFCFF.push({fcffPresentFCFF:formatPositiveAndNegativeValues(terminalValuePresentFCFFBasedOnPat)});
                  // }
                  // else{
                if(boolTvCashFlowBased){
                  arrayPresentFCFF.push({fcffPresentFCFF:formatPositiveAndNegativeValues(terminalValuePresentFCFFBasedOnLastYear)});
                }
              }
            })
            return arrayPresentFCFF;
          });
          
          hbs.registerHelper('debtDate', () => {
            let arrayDebtOnDate = [];
            valuationResult.modelResults.forEach((result)=>{
              if(result.model === 'FCFE'){
                result.valuationData.map((response:any)=>{
                  const debtOnDateValue = formatPositiveAndNegativeValues(response?.debtOnDate);
                  arrayDebtOnDate.push({fcfeDebtOnDate:debtOnDateValue})
                })
                arrayDebtOnDate.unshift({fcfeDebtOnDate:"Less: Debt as on Date"});
              }
              else if(result.model === 'FCFF'){
                result.valuationData.map((response:any)=>{
                  const debtOnDateValue = formatPositiveAndNegativeValues(response?.debtOnDate);
                  arrayDebtOnDate.push({fcffDebtOnDate:debtOnDateValue})
                })
                arrayDebtOnDate.unshift({fcffDebtOnDate:"Less: Debt as on Date"});
              }
            })
            return arrayDebtOnDate;
          });
    
          hbs.registerHelper('hasDebtDate', () => {
            let hasDebt = false;
            valuationResult.modelResults.forEach((result)=>{
              if(result.model === 'FCFE'){
                hasDebt = result.valuationData.some((response:any)=>response.debtOnDate);
              }
              else if(result.model === 'FCFF'){
                hasDebt = result.valuationData.some((response:any)=>response.debtOnDate);
              }
            })
            return hasDebt;
          });
          
          hbs.registerHelper('sumCashFlow', () => {
            let arraySumOfCashFlows = [];
            valuationResult.modelResults.forEach((result)=>{
              if(result.model === 'FCFE'){
                result.valuationData.map((response:any)=>{
                  const sumOfCashFlowsValue = formatPositiveAndNegativeValues(response?.sumOfCashFlows);
                  arraySumOfCashFlows.push({fcfeSumOfCashFlows:sumOfCashFlowsValue})
                })
                arraySumOfCashFlows.unshift({fcfeSumOfCashFlows:"Sum of Discounted Cash Flows (Explicit Period)"});
              }
              else if(result.model === 'FCFF'){
                result.valuationData.map((response:any)=>{
                  const sumOfCashFlowsValue = formatPositiveAndNegativeValues(response?.sumOfCashFlows);
                  arraySumOfCashFlows.push({fcffSumOfCashFlows:sumOfCashFlowsValue})
                })
                arraySumOfCashFlows.unshift({fcffSumOfCashFlows:"Sum of Discounted Cash Flows (Explicit Period)"});
              }
              else if(result.model === 'Excess_Earnings'){
                result.valuationData.map((response:any)=>{
                  const sumOfCashFlowsValue = formatPositiveAndNegativeValues(response?.sumOfCashFlows);
                  arraySumOfCashFlows.push({excessEarningSumOfCashFlows:sumOfCashFlowsValue})
                })
                arraySumOfCashFlows.unshift({excessEarningSumOfCashFlows:"Sum of Discounted Cash Flows"});
              }
            })
            return arraySumOfCashFlows;
          });
    
          hbs.registerHelper('prsntValOfTerminalVal', () => {
            let arrayPvTerminalValue = [];
            valuationResult.modelResults.forEach((result)=>{
              if(result.model === 'FCFE'){
                result.valuationData.map((response:any)=>{
                  const pvTerminalValue = formatPositiveAndNegativeValues(response?.pvTerminalValue);
                  arrayPvTerminalValue.push({fcfePvTerminalVal:pvTerminalValue})
                })
                arrayPvTerminalValue.unshift({fcfePvTerminalVal:"Present Value of Terminal Value"});
              }
              else if(result.model === 'FCFF'){
                result.valuationData.map((response:any)=>{
                  const pvTerminalValue = formatPositiveAndNegativeValues(response?.pvTerminalValue);
                  arrayPvTerminalValue.push({fcffPvTerminalVal:pvTerminalValue})
                })
                arrayPvTerminalValue.unshift({fcffPvTerminalVal:"Present Value of Terminal Value"});
              }
            })
            return arrayPvTerminalValue;
          });
          
          hbs.registerHelper('cashEquvlnt', () => {
            let arrayCashEquivalents = [];
            valuationResult.modelResults.forEach((result)=>{
              if(result.model === 'FCFE'){
                result.valuationData.map((response:any)=>{
                  const cashEquivalentsValue = formatPositiveAndNegativeValues(response?.cashEquivalents);
                  arrayCashEquivalents.push({fcfeCashEquivalents:cashEquivalentsValue})
                })
                arrayCashEquivalents.unshift({fcfeCashEquivalents:"Add: Cash & Cash Equivalents"});
              }
              else if(result.model === 'FCFF'){
                result.valuationData.map((response:any)=>{
                  const cashEquivalentsValue = formatPositiveAndNegativeValues(response?.cashEquivalents);
                  arrayCashEquivalents.push({fcffCashEquivalents:cashEquivalentsValue})
                })
                arrayCashEquivalents.unshift({fcffCashEquivalents:"Add: Cash & Cash Equivalents"});
              }
            })
            return arrayCashEquivalents;
          });
          
          hbs.registerHelper('surplusAsset', () => {
            let arraySurplusAssets = [];
            valuationResult.modelResults.forEach((result)=>{
              if(result.model === 'FCFE'){
                result.valuationData.map((response:any)=>{
                  const surplusAssetsValue = formatPositiveAndNegativeValues(response?.surplusAssets);
                  arraySurplusAssets.push({fcfeSurplusAssets:surplusAssetsValue})
                })
                arraySurplusAssets.unshift({fcfeSurplusAssets:"Add: Surplus Assets/Investments"});
              }
              else if(result.model === 'FCFF'){
                result.valuationData.map((response:any)=>{
                  const surplusAssetsValue = formatPositiveAndNegativeValues(response?.surplusAssets);
                  arraySurplusAssets.push({fcffSurplusAssets:surplusAssetsValue})
                })
                arraySurplusAssets.unshift({fcffSurplusAssets:"Add: Surplus Assets/Investments"});
              }
            })
            return arraySurplusAssets;
          });
    
          hbs.registerHelper('hasSurplusAssets', () => {
            let hasSurplus = false;
            valuationResult.modelResults.forEach((result)=>{
              if(result.model === 'FCFE'){
                hasSurplus = result.valuationData.some((response:any)=>response.surplusAssets);
              }
              else if(result.model === 'FCFF'){
                hasSurplus = result.valuationData.some((response:any)=>response.surplusAssets);
              }
            })
            return hasSurplus;
          });
          
          hbs.registerHelper('otherAdjustment', () => {
            let arrayOtherAdj = [];
            valuationResult.modelResults.forEach((result)=>{
              if(result.model === 'FCFE'){
                result.valuationData.map((response:any)=>{
                  const otherAdjValue = formatPositiveAndNegativeValues(response?.otherAdj);
                  arrayOtherAdj.push({fcfeOtherAdj:otherAdjValue})
                })
                arrayOtherAdj.unshift({fcfeOtherAdj:"Add/Less: Other Adjustments(if any)"});
              }
              else if(result.model === 'FCFF'){
                result.valuationData.map((response:any)=>{
                  const otherAdjValue = formatPositiveAndNegativeValues(response?.otherAdj);
                  arrayOtherAdj.push({fcffOtherAdj:otherAdjValue})
                })
                arrayOtherAdj.unshift({fcffOtherAdj:"Add/Less: Other Adjustments(if any)"});
              }
            })
            return arrayOtherAdj;
          });
    
          hbs.registerHelper('hasOtherAdjustment', () => {
            let hasOtherAdj = false;
            valuationResult.modelResults.forEach((result)=>{
              if(result.model === 'FCFE'){
                hasOtherAdj = result.valuationData.some((response:any)=>response.otherAdj);
                
              }
              else if(result.model === 'FCFF'){
                hasOtherAdj = result.valuationData.some((response:any)=>response.otherAdj);
              }
            })
            return hasOtherAdj;
          });
    
          hbs.registerHelper('eqtValue', () => {
            let checkiIfStub = false;
            
            let arrayEquityValue = [];
            valuationResult.modelResults.forEach((result)=>{
              if(Array.isArray(result.valuationData) && result.valuationData?.some(obj => obj.hasOwnProperty('stubAdjValue'))){
                checkiIfStub=true;
              }
              if(result.model === 'FCFE'){
                result.valuationData.map((response:any)=>{
                  const equityValue = formatPositiveAndNegativeValues(response?.equityValue);
                  arrayEquityValue.push({fcfeEquityValue:equityValue})
                })
                if(checkiIfStub){
                  // arrayEquityValue.unshift({fcfeEquityValue:`Equity Value as on ${result.valuationData[0].particulars}`});
                  arrayEquityValue.unshift({fcfeEquityValue:`Equity Value as on ${formatDate(new Date(valuationResult.provisionalDate))}`});
                }
                else{
                  arrayEquityValue.unshift({fcfeEquityValue:`Equity Value as on ${formatDate(new Date(valuationResult.inputData[0].valuationDate))}`});
                }
              }
              else if(result.model === 'FCFF'){
                result.valuationData.map((response:any)=>{
                  const equityValue = formatPositiveAndNegativeValues(response?.equityValue);
                  arrayEquityValue.push({fcffEquityValue:equityValue})
                })
                if(checkiIfStub){
                  // arrayEquityValue.unshift({fcffEquityValue:`Equity Value as on ${result.valuationData[0].particulars}`});
                  arrayEquityValue.unshift({fcffEquityValue:`Equity Value as on ${formatDate(new Date(valuationResult.provisionalDate))}`});
                }
                else{
                  arrayEquityValue.unshift({fcffEquityValue:`Equity Value as on ${formatDate(new Date(valuationResult.inputData[0].valuationDate))}`});
                }
              }
              else if(result.model === 'Excess_Earnings'){
                result.valuationData.map((response:any)=>{
                  const equityValue = formatPositiveAndNegativeValues(response?.equityValue);
                  arrayEquityValue.push({excessEarningEquityValue:equityValue})
                })
                if(checkiIfStub){
                  // arrayEquityValue.unshift({excessEarningEquityValue:`Equity Value as on ${result.valuationData[0].particulars}`});
                  arrayEquityValue.unshift({excessEarningEquityValue:`Equity Value as on ${formatDate(new Date(valuationResult.provisionalDate))}`});
                }
                else{
                  arrayEquityValue.unshift({excessEarningEquityValue:`Equity Value as on ${formatDate(new Date(valuationResult.inputData[0].valuationDate))}`});
                }
              }
            })
            return arrayEquityValue;
          });
    
          hbs.registerHelper('stubValue',()=>{
            let arrayStubValue = [];
            valuationResult.modelResults.forEach((result)=>{
              if(result.model === MODEL[0]){
                result.valuationData.map((response:any)=>{
                  const stubAdjValue = formatPositiveAndNegativeValues(response?.stubAdjValue);
                  arrayStubValue.push({fcfeStubAdjValue:stubAdjValue})
                })
                arrayStubValue.unshift({fcfeStubAdjValue:"Add:Stub Period Adjustment"});
              }
              else if (result.model === MODEL[1]){
                result.valuationData.map((response:any)=>{
                  const stubAdjValue = formatPositiveAndNegativeValues(response?.stubAdjValue);
                  arrayStubValue.push({fcffStubAdjValue:stubAdjValue})
                })
                arrayStubValue.unshift({fcffStubAdjValue:"Add:Stub Period Adjustment"});
              }
              else if (result.model ===MODEL[3]){
                result.valuationData.map((response:any)=>{
                  const stubAdjValue = formatPositiveAndNegativeValues(response?.stubAdjValue);
                  arrayStubValue.push({excessEarnStubAdjValue:stubAdjValue})
                })
                arrayStubValue.unshift({excessEarnStubAdjValue:"Add:Stub Period Adjustment"});
              }
            })
            return arrayStubValue;
          })

          hbs.registerHelper('provisionalEquityValue',()=>{
            let arrayProvisionalVal = [];
            valuationResult.modelResults.forEach((result)=>{
              if(result.model === MODEL[0]){
                result.valuationData.map((response:any)=>{
                  const equityValueNew = formatPositiveAndNegativeValues(response?.equityValueNew);
                  arrayProvisionalVal.push({fcfeequityValueNew:equityValueNew})
                })
                arrayProvisionalVal.unshift({fcfeequityValueNew:`Equity Value as on ${formatDate(new Date(valuationResult.inputData[0].valuationDate))}`});
              }
              else if (result.model === MODEL[1]){
                result.valuationData.map((response:any)=>{
                  const equityValueNew = formatPositiveAndNegativeValues(response?.equityValueNew);
                  arrayProvisionalVal.push({fcffequityValueNew:equityValueNew})
                })
                arrayProvisionalVal.unshift({fcffequityValueNew:`Equity Value as on ${formatDate(new Date(valuationResult.inputData[0].valuationDate))}`});
              }
              else if (result.model ===MODEL[3]){
                result.valuationData.map((response:any)=>{
                  const equityValueNew = formatPositiveAndNegativeValues(response?.equityValueNew);
                  arrayProvisionalVal.push({excessEarnequityValueNew:equityValueNew})
                })
                arrayProvisionalVal.unshift({excessEarnequityValueNew:`Equity Value as on ${formatDate(new Date(valuationResult.inputData[0].valuationDate))}`});
              }
            })
            return arrayProvisionalVal;
          })

          hbs.registerHelper('shares', () => {
            let arrayNoOfShares = [];
            valuationResult.modelResults.forEach((result)=>{
              if(result.model === 'FCFE'){
                result.valuationData.map((response:any)=>{
                  const noOfSharesValue = formatPositiveAndNegativeValues(response?.noOfShares);
                  arrayNoOfShares.push({fcfeNoOfShares:noOfSharesValue})
                })
                arrayNoOfShares.unshift({fcfeNoOfShares:"No. of o/s Shares"});
              }
              else if(result.model === 'FCFF'){
                result.valuationData.map((response:any)=>{
                  const noOfSharesValue = formatPositiveAndNegativeValues(response?.noOfShares);
                  arrayNoOfShares.push({fcffNoOfShares:noOfSharesValue})
                })
                arrayNoOfShares.unshift({fcffNoOfShares:"No. of o/s Shares"});
              }
              else if(result.model === 'Excess_Earnings'){
                result.valuationData.map((response:any)=>{
                  const noOfSharesValue = formatPositiveAndNegativeValues(response?.noOfShares);
                  arrayNoOfShares.push({excessEarningNoOfShares:noOfSharesValue})
                })
                arrayNoOfShares.unshift({excessEarningNoOfShares:"No. of o/s Shares"});
              }
            })
            return arrayNoOfShares;
          });
          
          hbs.registerHelper('valuePrShare', () => {
            let arrayValuePerShare = [];
            valuationResult.modelResults.forEach((result)=>{
              if(result.model === 'FCFE'){
                result.valuationData.map((response:any)=>{
                  const valuePerShare = formatPositiveAndNegativeValues(response?.valuePerShare);
                  arrayValuePerShare.push({fcfeValuePerShare:valuePerShare})
                })
                arrayValuePerShare.unshift({fcfeValuePerShare:`Value per Share (${valuationResult.inputData[0].currencyUnit})`});
              }
              else if(result.model === 'FCFF'){
                result.valuationData.map((response:any)=>{
                  const valuePerShare = formatPositiveAndNegativeValues(response?.valuePerShare);
                  arrayValuePerShare.push({fcffValuePerShare:valuePerShare})
                })
                arrayValuePerShare.unshift({fcffValuePerShare:`Value per Share (${valuationResult.inputData[0].currencyUnit})`});
              }
              else if(result.model === 'Excess_Earnings'){
                result.valuationData.map((response:any)=>{
                  const valuePerShare = formatPositiveAndNegativeValues(response?.valuePerShare);
                  arrayValuePerShare.push({excessEarningValuePerShare:valuePerShare})
                })
                arrayValuePerShare.unshift({excessEarningValuePerShare:`Value per Share (${valuationResult.inputData[0].currencyUnit})`});
              }
            })
            return arrayValuePerShare;
          });

          hbs.registerHelper('ifEquityValProvisional',(options)=>{
            let checkiIfprovisional = false;
            valuationResult.modelResults.forEach((result)=>{
              if(Array.isArray(result.valuationData) && result.valuationData?.some(obj => obj.hasOwnProperty('equityValueNew'))){
                checkiIfprovisional = true;
              }
            })
                if(checkiIfprovisional){
                  return options.fn(this)
                }
                else{
                  return options.inverse(this);
                }
            })

          hbs.registerHelper('ifStub',(options)=>{
            let checkIfStub = false;
              valuationResult.modelResults.forEach((result)=>{
                if(Array.isArray(result.valuationData) && result.valuationData?.some(obj => obj.hasOwnProperty('stubAdjValue'))){
                  checkIfStub = true;
                }
              })
                if(checkIfStub){
                  return options.fn(this)
                }
                else{
                  return options.inverse(this);
                }
            })
    
          hbs.registerHelper('checkTerminalValueType',()=>{
            const terminalValueType = allProcessStageDetails.stateInfo?.fifthStageInput?.terminalValueSelectedType ||  'tvCashFlowBased';
            let boolTvCashFlowBased = terminalValueType === 'tvCashFlowBased'; 
            return boolTvCashFlowBased;
          })

          hbs.registerHelper('ifZero', function (value, options) {
            if(value === 0 ){
              return options.fn(this);
            }
            else if(typeof value === 'string'){
              if(value ===''){
                return options.inverse(this);
              }
              else{
                return options.fn(this);
              }
            }
          });

          hbs.registerHelper('isLineItemCheck',(value)=>{
            if(`${value}`.includes('Equity Value as on')){
              return false;
            }
            if(`${value}`.includes('Value per Share ')){
              return false
            }
              if(REPORT_LINE_ITEM.includes(`${value}`))
                return false;
              return true;
          })


          hbs.registerHelper('calculateColspan',()=>{
            let colspan;
            valuationResult.modelResults.map((response)=>{
              if(response.model === MODEL[0] || response.model === MODEL[1]){
                colspan = response?.valuationData.length + 1;     //Adding one here since we remove terminal year working from the valuation array, and re-add in the above helper somewhere at the top
              }
            })
            return colspan + 1;  //add one since column starts from particulars
          })

          hbs.registerHelper('containsPsSelectionAndEvbitdaSelection',()=>{
            let selection = false;
            if(valuationResult?.modelResults){
              valuationResult.modelResults.map((data)=>{
                if(data.model === MODEL[2]){
                  const multiples = data.valuationData?.multiples;
                  if(!multiples || (multiples?.psSelection || multiples?.evEbitdaSelection)){
                    selection = true
                  }
                }
              })
            }
            return selection;
          })

          hbs.registerHelper('checkPreferenceRatio',()=>{
            if( valuationResult.inputData[0].preferenceRatioSelect === RELATIVE_PREFERENCE_RATIO[1])
              return true;
            return false;
          })
  
          hbs.registerHelper('containsPsSelection',()=>{
            let selection = false;
            if(valuationResult?.modelResults){
              valuationResult.modelResults.map((data)=>{
                if(data.model === MODEL[2]){
                  const multiples = data.valuationData?.multiples;
                  if(!multiples || multiples?.psSelection){
                    selection = true
                  }
                }
              })
            }
            return selection;
          })
  
          hbs.registerHelper('containsEvbitdaSelection',()=>{
            let selection = false;
            if(valuationResult?.modelResults){
              valuationResult.modelResults.map((data)=>{
                if(data.model === MODEL[2]){
                  const multiples = data.valuationData?.multiples;
                  if(!multiples || multiples?.evEbitdaSelection){
                    selection = true
                  }
                }
              })
            }
            return selection;
          })
  
          hbs.registerHelper('containsPbSelection',()=>{
            let selection = false;
            if(valuationResult?.modelResults){
              valuationResult.modelResults.map((data)=>{
                if(data.model === MODEL[2]){
                  const multiples = data.valuationData?.multiples;
                  if(!multiples || multiples?.pbSelection){
                    selection = true
                  }
                }
              })
            }
            return selection;
          })
  
          hbs.registerHelper('containsPeSelection',()=>{
            let selection = false;
            if(valuationResult?.modelResults){
              valuationResult.modelResults.map((data)=>{
                if(data.model === MODEL[2]){
                  const multiples = data.valuationData?.multiples;
                  if(!multiples || multiples?.peSelection){
                    selection = true
                  }
                }
              })
            }
            return selection;
          })

          hbs.registerHelper('notContainsPsAndEbitdaSelection',()=>{
            let selection = false;
            if(valuationResult?.modelResults){
              valuationResult.modelResults.map((data)=>{
                if(data.model === MODEL[2]){
                  const multiples = data.valuationData?.multiples;
                  if(multiples && (!multiples.psSelection && !multiples.evEbitdaSelection)){
                    selection = true;
                  }
                }
              })
            }
            return selection;
          })

          hbs.registerHelper('priceToSalesRatioCalculation',()=>{
            let sales, psRatio, equityVal, outstandingShares, valPerShare, totalPriceToSalesRatio:any=[];
            if(valuationResult?.modelResults){
              valuationResult.modelResults.map((data)=>{
                if(data.model === MODEL[2] || data.model === MODEL[4]){
                  data.valuationData.valuation.map((valuationDetails)=>{
                    const multiples = data.valuationData?.multiples;
                    const muliplesArray = Object.values(multiples).filter((x=> x));
                    if(valuationDetails.particular === 'sales'){
                      sales = {
                        particular:'Sales of company',
                        avg:formatPositiveAndNegativeValues(valuationDetails.salesAvg),
                        med:formatPositiveAndNegativeValues(valuationDetails.salesMed)
                      }
  
                      psRatio = {
                        particular:'P/S Ratio',
                        avg: formatPositiveAndNegativeValues(valuationDetails.salesRatioAvg),
                        med: formatPositiveAndNegativeValues(valuationDetails.salesRatioMed)
                      }
  
                      equityVal = {
                        particular:'Value of Equity',
                        avg:formatPositiveAndNegativeValues(valuationDetails.salesEquityAvg),
                        med:formatPositiveAndNegativeValues(valuationDetails.salesEquityMed)
                      }
  
                      totalPriceToSalesRatio.push(sales,psRatio,equityVal);
                      if(muliplesArray?.length === 1){
                        outstandingShares = {
                          particular:'Outstanding Shares',
                          avg:formatPositiveAndNegativeValues(valuationDetails.salesSharesAvg),
                          med:formatPositiveAndNegativeValues(valuationDetails.salesSharesAvg)
                        }
                        valPerShare = {
                          particular:'Value Per Share',
                          avg:formatPositiveAndNegativeValues(data.valuation.finalPriceAvg),
                          med:formatPositiveAndNegativeValues(data.valuation.finalPriceMed)
                        }
                        totalPriceToSalesRatio.push(outstandingShares, valPerShare);
                      }
                    }
                  })
                }
              })
            }
            return totalPriceToSalesRatio;
          })

          hbs.registerHelper('peRatioCalculation',()=>{
            let pat, eps, marketPrice,  outstandingShares, valPerShare, totalPeRatio:any = [];
            if(valuationResult?.modelResults){
              valuationResult.modelResults.map((data)=>{
                if(data.model === MODEL[2] || data.model === MODEL[4]){
                data.valuationData.valuation.map((valuationDetails)=>{
                  const multiples = data.valuationData?.multiples;
                  const muliplesArray = Object.values(multiples).filter((x=> x));
                    if(valuationDetails.particular === 'peRatio'){
                      pat = {
                        particular:'Profit after Taxes',
                        avg:formatPositiveAndNegativeValues(valuationDetails.pat),
                        med:formatPositiveAndNegativeValues(valuationDetails.pat)
                      }
  
                      eps = {
                        particular:'P/E Ratio of Industry',
                        avg: formatPositiveAndNegativeValues(valuationDetails.peRatioAvg),
                        med: formatPositiveAndNegativeValues(valuationDetails.peRatioMed)
                      }
  
                      marketPrice = {
                        particular:'Fair Value of Equity',
                        avg:formatPositiveAndNegativeValues(valuationDetails.peMarketPriceAvg),
                        med:formatPositiveAndNegativeValues(valuationDetails.peMarketPriceMed)
                      }
  
                      totalPeRatio.push(pat,eps,marketPrice);
                      if(muliplesArray?.length === 1){
                        outstandingShares = {
                          particular:'Outstanding Shares',
                          avg:formatPositiveAndNegativeValues(valuationResult.inputData[0]?.outstandingShares),
                          med:formatPositiveAndNegativeValues(valuationResult.inputData[0]?.outstandingShares)
                        }
                        valPerShare = {
                          particular:'Value Per Share',
                          avg:formatPositiveAndNegativeValues(data.valuation.finalPriceAvg),
                          med:formatPositiveAndNegativeValues(data.valuation.finalPriceMed)
                        }
                        totalPeRatio.push(outstandingShares, valPerShare);
                      }
                    }
                  })
                }
              })
            }
            return totalPeRatio;
          })
  
          hbs.registerHelper('pbRatioCalculation',()=>{
            let networth, pbShares, equityVal, outstandingShares, valPerShare, totalPbRatio:any = [];
            if(valuationResult?.modelResults){
              valuationResult.modelResults.map((data)=>{
                if(data.model === MODEL[2] || data.model === MODEL[4]){
                  data.valuationData.valuation.map((valuationDetails)=>{
                    const multiples = data.valuationData?.multiples;
                    const muliplesArray = Object.values(multiples).filter((x=> x));  
                    if(valuationDetails.particular === 'pbRatio'){
                      networth = {
                        particular:'Net Worth of Company',
                        avg:formatPositiveAndNegativeValues(valuationDetails.netWorthAvg),
                        med:formatPositiveAndNegativeValues(valuationDetails.netWorthMed)
                      }
                      pbShares = {
                        particular:'P/B Ratio of Industry',
                        avg: formatPositiveAndNegativeValues(valuationDetails.pbRatioAvg),
                        med: formatPositiveAndNegativeValues(valuationDetails.pbRatioMed)
                      }
  
                      equityVal = {
                        particular:'Fair Value of Equity',
                        avg:formatPositiveAndNegativeValues(valuationDetails.pbMarketPriceAvg),
                        med:formatPositiveAndNegativeValues(valuationDetails.pbMarketPriceMed)
                      }
  
                      totalPbRatio.push(networth,pbShares,equityVal);
                      if(muliplesArray?.length === 1){
                        outstandingShares = {
                          particular:'Outstanding Shares',
                          avg:formatPositiveAndNegativeValues(valuationDetails.pbSharesAvg),
                          med:formatPositiveAndNegativeValues(valuationDetails.pbSharesAvg)
                        }
                        valPerShare = {
                          particular:'Value Per Share',
                          avg:formatPositiveAndNegativeValues(data.valuation.finalPriceAvg),
                          med:formatPositiveAndNegativeValues(data.valuation.finalPriceMed)
                        }
                        totalPbRatio.push(outstandingShares, valPerShare);
                      }
                    }
                  })
                }
              })
            }
            return totalPbRatio;
          })
          
          hbs.registerHelper('evEbitaRatioCalculation',()=>{
            let ebitda, evEbitda, enterpriseVal, debtVal, equityVal, outstandingShares, valPerShare, totalEvEbitdaRatio:any = [], cashEquivalent;
            if(valuationResult?.modelResults){
              valuationResult.modelResults.map((data)=>{
                if(data.model === MODEL[2] || data.model === MODEL[4]){
                  data.valuationData.valuation.map((valuationDetails)=>{
                    const multiples = data.valuationData?.multiples;
                    const muliplesArray = Object.values(multiples).filter((x=> x));  
                    if(valuationDetails.particular === 'ebitda'){
                      ebitda = {
                        particular:'EBITDA',
                        avg:formatPositiveAndNegativeValues(valuationDetails.ebitda),
                        med:formatPositiveAndNegativeValues(valuationDetails.ebitda)
                      }
  
                      evEbitda = {
                        particular:'EV/EBITDA',
                        avg: formatPositiveAndNegativeValues(valuationDetails.evAvg),
                        med: formatPositiveAndNegativeValues(valuationDetails.evMed)
                      }
  
                      enterpriseVal = {
                        particular:'Enterprise Value',
                        avg:formatPositiveAndNegativeValues(valuationDetails.enterpriseAvg),
                        med:formatPositiveAndNegativeValues(valuationDetails.enterpriseMed)
                      }
  
                      debtVal = {
                        particular:'Less : Value of Debt',
                        avg:formatPositiveAndNegativeValues(valuationDetails.debtAvg),
                        med:formatPositiveAndNegativeValues(valuationDetails.debtMed)
                      }
                      cashEquivalent = {
                        particular:'Cash and cash equivalent',
                        avg:formatPositiveAndNegativeValues(valuationDetails.cashEquivalent),
                        med:formatPositiveAndNegativeValues(valuationDetails.cashEquivalent)
                      }
                      equityVal = {
                        particular:'Value of Equity',
                        avg:formatPositiveAndNegativeValues(valuationDetails.ebitdaEquityAvg),
                        med:formatPositiveAndNegativeValues(valuationDetails.ebitdaEquityMed)
                      }
                      totalEvEbitdaRatio.push(ebitda,evEbitda,enterpriseVal,debtVal,cashEquivalent,equityVal);
                      if(muliplesArray?.length === 1){
                        outstandingShares = {
                          particular:'Outstanding Shares',
                          avg:formatPositiveAndNegativeValues(valuationDetails.ebitdaSharesAvg),
                          med:formatPositiveAndNegativeValues(valuationDetails.ebitdaSharesAvg)
                        }
                        valPerShare = {
                          particular:'Value Per Share',
                          avg:formatPositiveAndNegativeValues(data.valuation.finalPriceAvg),
                          med:formatPositiveAndNegativeValues(data.valuation.finalPriceMed)
                        }
                        totalEvEbitdaRatio.push(outstandingShares, valPerShare);
                      }
                    }
                  })
                }
              })
            }
            return totalEvEbitdaRatio;
          })

          hbs.registerHelper('weightedAvgValuePrShare',()=>{
            const ccmMetricType = allProcessStageDetails.stateInfo?.fifthStageInput?.ccmVPStype || 'average';

            let evSales:any=[],evEbitda:any=[],priceToBookValue:any=[],priceToEarnings:any=[],avgValuePerShare:any=[],totalWeightedAvgValuePrShare:any=[],outstandingShares:any=[], total:any=[],sumOfWeightedValue=0;
            if(valuationResult?.modelResults){
              valuationResult.modelResults.map((data)=>{
                if(data.model === MODEL[2] || data.model === MODEL[4]){
                  const multiples = data.valuationData?.multiples;
                  let selectedMultiples, totalAverage;
                  if(multiples){
                    selectedMultiples = Object.keys(multiples).filter(key => multiples[key]);
                     totalAverage = convertToNumberOrZero(100/selectedMultiples.length).toFixed(2);
                  }
                  data.valuationData.valuation.map((valuationDetails)=>{
                    if(valuationDetails.particular === 'sales' && (!multiples ? true : multiples?.psSelection)){
                      const salesEquity = ccmMetricType === 'average' ? valuationDetails.salesEquityAvg : valuationDetails.salesEquityMed;
                      evSales = {
                        particular:'Value as per P/Sales',
                        fairValOfEquity:formatPositiveAndNegativeValues(salesEquity), // only for calculating average
                        weights:`${totalAverage ? totalAverage : 25}%`,
                        weightedVal:formatPositiveAndNegativeValues(((totalAverage ? totalAverage : 25) * (salesEquity))/100),  //only for calculating average
                      }
                      sumOfWeightedValue += ((totalAverage ? totalAverage : 25) * (salesEquity))/100;
                      totalWeightedAvgValuePrShare.push(evSales);
                    }
                    if(valuationDetails.particular === 'ebitda' && (!multiples ? true : multiples?.evEbitdaSelection)){
                      const evEbitdaVal = ccmMetricType === 'average' ? valuationDetails.ebitdaEquityAvg : valuationDetails.ebitdaEquityMed;
                      evEbitda = {
                        particular:'Value as per EV/EBITDA',
                        fairValOfEquity: formatPositiveAndNegativeValues(evEbitdaVal), //only for calculating average
                        weights:`${totalAverage ? totalAverage : 25}%`,
                        weightedVal:formatPositiveAndNegativeValues(((totalAverage ? totalAverage : 25) * (evEbitdaVal))/100) //only for calculating average
                      }
                      
                      sumOfWeightedValue += ((totalAverage ? totalAverage : 25) * (evEbitdaVal))/100;
                      totalWeightedAvgValuePrShare.push(evEbitda);
                    }
                    
                    if(valuationDetails.particular === 'pbRatio' && (!multiples ? true : multiples?.pbSelection)){
                      const pbRatioVal = ccmMetricType === 'average' ? valuationDetails.pbMarketPriceAvg : valuationDetails.pbMarketPriceMed;
                      priceToBookValue = {
                        particular:'Value as per P/BV',
                        fairValOfEquity:formatPositiveAndNegativeValues(pbRatioVal), //only for calculating average
                        weights:`${totalAverage ? totalAverage : 25}%`,
                        weightedVal:formatPositiveAndNegativeValues(((totalAverage ? totalAverage : 25) * (pbRatioVal))/100) //only for calculating average
                      }
                      sumOfWeightedValue += ((totalAverage ? totalAverage : 25) * (pbRatioVal))/100;
                      totalWeightedAvgValuePrShare.push(priceToBookValue);
                    }
                    
                    if(valuationDetails.particular === 'peRatio' && (!multiples ? true : multiples?.peSelection)){
                      const peSelectionVal = ccmMetricType === 'average' ? valuationDetails.peMarketPriceAvg : valuationDetails.peMarketPriceMed;
                      priceToEarnings = {
                        particular:'Value as per P/E',
                        fairValOfEquity:formatPositiveAndNegativeValues(peSelectionVal), //only for calculating average
                        weights:`${totalAverage ? totalAverage : 25}%`,
                        weightedVal:formatPositiveAndNegativeValues(((totalAverage ? totalAverage : 25) * (peSelectionVal))/100) //only for calculating average
                      }
                      sumOfWeightedValue += ((totalAverage ? totalAverage : 25) * (peSelectionVal))/100;
                      totalWeightedAvgValuePrShare.push(priceToEarnings);
                    }
                    if(valuationDetails.particular === 'result'){
                      const equityVal = ccmMetricType === 'average' ? valuationDetails.fairValuePerShareAvg : valuationDetails.fairValuePerShareMed;
                      avgValuePerShare = {
                        particular:`Value per Share (${valuationResult.inputData[0].currencyUnit})`,
                        fairValOfEquity:'', //selected fair value of equity for average calculation
                        weights:'',
                        weightedVal: formatPositiveAndNegativeValues(equityVal) //selected fair value of equity for average calculation
                      }
                     
                      outstandingShares = {
                        particular:`No. of outstanding shares`,
                        fairValOfEquity:'', //selected fair value of equity for average calculation
                        weights:'',
                        weightedVal: formatPositiveAndNegativeValues(valuationResult.inputData[0].outstandingShares) //selected fair value of equity for average calculation
                      }
                    }
  
                  })
                }
              })
              total = {
                particular:`Total weighted average`,
                fairValOfEquity:'', 
                weights:'',
                weightedVal: formatPositiveAndNegativeValues(sumOfWeightedValue)
              }
              totalWeightedAvgValuePrShare.push(total,outstandingShares,avgValuePerShare);
            }
            return totalWeightedAvgValuePrShare;
          })


          hbs.registerHelper('checkIfTotalOrOutstandingShares',(particular,stringToCheck)=>{
            if(stringToCheck === 'Total weighted average' && particular.includes('Total weighted average') || stringToCheck === 'No. of outstanding shares' && particular.includes('No. of outstanding shares')){
              return true;
            }
            return false;
          })

          hbs.registerHelper('checkIfValuePerShare',(particular,stringToCheck)=>{
            if(stringToCheck === 'Value per Share' && particular.includes('Value per Share')){
              return true;
            }
            return false;
          })

          hbs.registerHelper('getParticularValuePerShare',(model)=>{
            const ccmMetricType = allProcessStageDetails.stateInfo?.fifthStageInput?.ccmVPStype || 'average';

            if(valuationResult.inputData[0].model.length){
              let formattedValues;
              formattedValues = valuationResult.inputData[0].model.flatMap((models) => {
                return valuationResult.modelResults.flatMap((response) => {
                  if (
                    response.model === models &&
                    (models === MODEL[2] || models === MODEL[4]) &&
                    model === 'MARKET_PRICE_APPROACH'
                  ) {
                    const innerFormatted = response?.valuationData.valuation
                      .filter((innerValuationData) => innerValuationData.particular === 'result')
                      .map((innerValuationData) => {
                        const formattedNumber = ccmMetricType === 'average' ? innerValuationData.fairValuePerShareAvg : innerValuationData.fairValuePerShareMed;
                        return `${formatPositiveAndNegativeValues(formattedNumber)}/-`;
                      });
                    return innerFormatted || [];
                  }
                  if (
                    response.model === models && 
                    (models === MODEL[0] || models === MODEL[1]) &&
                    model === 'INCOME_APPROACH'
                  ) {
                    const formattedNumber = response?.valuationData[0]?.valuePerShare;
                    return `${formatPositiveAndNegativeValues(formattedNumber)}/-`;
                  }
                  if (
                    response.model === models && 
                    models === MODEL[5] && 
                    model === 'NET_ASSET_VALUE_APPROACH'
                  ) {
                    const formattedNumber = response?.valuationData?.valuePerShare?.bookValue;
                    return `${formatPositiveAndNegativeValues(formattedNumber)}/-`;
                  }
                  return [];
                });
              });
              return formattedValues[0]
            }
          })

          hbs.registerHelper('dcfModel',()=>{
            if(valuationResult.inputData[0] && (valuationResult.inputData[0]?.model.includes(MODEL[0]) || valuationResult.inputData[0]?.model.includes(MODEL[1]))){
              return true;
            }
            return false;
          })
          for (const indResponse of valuationResult?.modelResults){
                
          }

          // hbs.registerHelper('weightedAverageWorking',()=>{
          //   if(valuationResult.inputData[0].model.length){
          //     let computedArray = [], dcfApproachWeight:any = 100, marketApproachWeight:any = 100, navApproachWeight:any = 100, marketPriceWeight: any = 100;
          //     if(valuationResult.inputData[0].model.length > 1){
          //       reportDetails?.modelWeightageValue?.modelValue.map(
          //         (data)=>{
                    
          //         if(data.model === MODEL[0] || data.model === MODEL[1]){
          //           dcfApproachWeight = convertToNumberOrZero(data.weight) * 100;
          //           }
          //         if(data.model === MODEL[5]){
          //           navApproachWeight = convertToNumberOrZero(data.weight) * 100;
          //         }
          //         if(data.model === MODEL[2] || data.model === MODEL[4]){
          //           marketApproachWeight = convertToNumberOrZero(data.weight) * 100;
          //         }
          //         if(data.model === MODEL[7] && (reportDetails.reportSection.includes("166(A) - SEBI (Issue of Capital and Disclosure Requirements) Regulations, 2018") && reportDetails.reportSection.length === 1)){
          //           marketPriceWeight = convertToNumberOrZero(data.weight) * 100;
          //         }
          //       })
          //     }
          //     const modelArray = valuationResult.inputData[0].model;

          //     valuationResult.modelResults.map((response)=>{
          //       // Calculate weightage for CCM
          //       if(
          //         (
          //           response.model === MODEL[2] || 
          //           response.model === MODEL[4]
          //         ) && 
          //         this.checkModelExist(MODEL[2],modelArray)
          //       ){
          //         let marketApproachValuePerShare = 0;
          //         response?.valuationData.valuation.map((marketApproachValuation)=>{
          //           if(marketApproachValuation.particular === 'result'){
          //             marketApproachValuePerShare = marketApproachValuation.fairValuePerShareAvg;
          //           }
          //         })

          //         computedArray.push(
          //           {
          //             approach: 'Market Approach',
          //             method: `${ALL_MODELS[`${response.model}`]} Method`,
          //             valuePerShare: formatPositiveAndNegativeValues(marketApproachValuePerShare),
          //             weights: marketApproachWeight.toFixed(2),
          //             weightedValue: formatPositiveAndNegativeValues(convertToNumberOrZero(marketApproachValuePerShare) * marketApproachWeight/100)
          //           }
          //         )
          //       }

          //       // Calculate weightage for DCF
          //       if(
          //         (
          //           response.model === MODEL[0] || 
          //           response.model === MODEL[1]
          //         ) && 
          //         (
          //           this.checkModelExist(MODEL[0], modelArray) || 
          //           this.checkModelExist(MODEL[1], modelArray)
          //         )
          //       ){
          //         let incomeApproachValuePerShare = response?.valuationData[0]?.valuePerShare || 0;
          //         computedArray.push(
          //           {
          //             approach: 'Income Approach',
          //             method: `${ALL_MODELS[`${response.model}`]} Method`,
          //             valuePerShare: formatPositiveAndNegativeValues(incomeApproachValuePerShare),
          //             weights: dcfApproachWeight.toFixed(2),
          //             weightedValue: formatPositiveAndNegativeValues(convertToNumberOrZero(incomeApproachValuePerShare) * dcfApproachWeight/100)
          //           }
          //         )
          //       }

          //       // Calculate weightage for NAV
          //       if(response.model === MODEL[5] && this.checkModelExist(MODEL[5], modelArray)){
          //         let navApproachValuePerShare = response?.valuationData?.valuePerShare?.bookValue || 0;
          //         computedArray.push(
          //           {
          //             approach: 'Cost Approach',
          //             method: `${ALL_MODELS[`${response.model}`]} Method`,
          //             valuePerShare: formatPositiveAndNegativeValues(navApproachValuePerShare),
          //             weights: navApproachWeight.toFixed(2),
          //             weightedValue: formatPositiveAndNegativeValues(convertToNumberOrZero(navApproachValuePerShare) * navApproachWeight/100)
          //           }
          //         )
          //       }

          //       // Calculate weightage for Market Price Approach Method
          //       if(response.model == MODEL[7] && 
          //         this.checkModelExist(MODEL[7], modelArray) && 
          //         (
          //           reportDetails.reportSection.includes("166(A) - SEBI (Issue of Capital and Disclosure Requirements) Regulations, 2018") && 
          //           reportDetails.reportSection.length === 1
          //         )
          //       ){
          //         let marketPriceValuePerShare = response?.valuation || 0;
          //         computedArray.push(
          //           {
          //             approach: 'Market Price Approach',
          //             method: `${ALL_MODELS[`${response.model}`]} Method`,
          //             valuePerShare: formatPositiveAndNegativeValues(marketPriceValuePerShare),
          //             weights: marketPriceWeight.toFixed(2),
          //             weightedValue: formatPositiveAndNegativeValues(convertToNumberOrZero(marketPriceValuePerShare) * marketPriceWeight/100)
          //           }
          //         )
          //       }
          //     })
          //     return computedArray;
          //   }
          // })

          hbs.registerHelper('weightedAverageWorking', () => {
            const ccmMetricType = allProcessStageDetails.stateInfo?.fifthStageInput?.ccmVPStype || 'average';

            if (!valuationResult?.inputData[0]?.model.length) return [];
          
            const computedArray = [];
            const modelArray = valuationResult.inputData[0].model;
          
            let dcfApproachWeight = 100;
            let marketApproachWeight = 100;
            let navApproachWeight = 100;
            let marketPriceWeight = 100;
          
            // Extract weightages based on model
            if (modelArray.length > 1) {
              reportDetails?.modelWeightageValue?.modelValue.forEach(data => {
                const weight = convertToNumberOrZero(data.weight) * 100;
                switch (data.model) {
                  case MODEL[0]:
                  case MODEL[1]:
                    dcfApproachWeight = weight;
                    break;
                  case MODEL[5]:
                    navApproachWeight = weight;
                    break;
                  case MODEL[2]:
                  case MODEL[4]:
                    marketApproachWeight = weight;
                    break;
                  case MODEL[7]:
                    if (reportDetails.reportSection.includes("166(A) - SEBI (Issue of Capital and Disclosure Requirements) Regulations, 2018") && reportDetails.reportSection.length === 1) {
                      marketPriceWeight = weight;
                    }
                    break;
                }
              });
            }
          
            const vwapType = allProcessStageDetails.stateInfo?.fifthStageInput?.vwapType;
            // Function to calculate weighted value and add to computedArray
            const addWeightedValue = (approach, method, valuePerShare, weight) => {
              const weightedValue = convertToNumberOrZero(valuePerShare) * weight / 100;
              computedArray.push({
                apprch:approach,
                method: (method === MODEL[0] || method === MODEL[1]) ? 'Discounted Cash Flow Method' :`${ALL_MODELS[method]} Method`,
                valPrShre: formatPositiveAndNegativeValues(valuePerShare),
                wghts: weight.toFixed(2),
                wghtdVal: weightedValue ? formatPositiveAndNegativeValues(weightedValue) : 0
              });
            };
          
            valuationResult.modelResults.forEach(response => {
              const model = response.model;
          
              // Market Approach Calculation
              if ((model === MODEL[2] || model === MODEL[4]) && this.checkModelExist(MODEL[2], modelArray)) {
                const marketApproachValuation = response?.valuationData?.valuation?.find(val => val.particular === 'result');
                const marketApproachValuePerShare = ccmMetricType === 'average' ? (marketApproachValuation?.fairValuePerShareAvg || 0) : (marketApproachValuation?.fairValuePerShareMed || 0) ;
                addWeightedValue('Market Approach', model, marketApproachValuePerShare, marketApproachWeight);
              }
          
              // DCF Approach Calculation
              if ((model === MODEL[0] || model === MODEL[1]) && (this.checkModelExist(MODEL[0], modelArray) || this.checkModelExist(MODEL[1], modelArray))) {
                const incomeApproachValuePerShare = response?.valuationData?.[0]?.valuePerShare || 0;
                addWeightedValue('Income Approach', model, incomeApproachValuePerShare, dcfApproachWeight);
              }
          
              // NAV Approach Calculation
              if (model === MODEL[5] && this.checkModelExist(MODEL[5], modelArray)) {
                const navApproachValuePerShare = response?.valuationData?.valuePerShare?.fairValue || 0;
                addWeightedValue('Cost Approach', model, navApproachValuePerShare, navApproachWeight);
              }
          
              // Market Price Approach Calculation
              if (model === MODEL[7] && this.checkModelExist(MODEL[7], modelArray)) {
                const isSEBI = reportDetails.reportSection.includes("166(A) - SEBI (Issue of Capital and Disclosure Requirements) Regulations, 2018") && reportDetails.reportSection.length === 1;
                if (isSEBI) {
                  const marketPriceValuePerShare = vwapType === 'vwapNse' ? (response?.valuation?.valuePerShareNse || 0) : (response?.valuation?.valuePerShareBse || 0);
                  addWeightedValue('Market Price Approach', model, marketPriceValuePerShare, marketPriceWeight);
                }
              }
            });
          
            return computedArray;
          });
          

          hbs.registerHelper('combinedValuePerShare',(bool)=>{
            const ccmMetricType = allProcessStageDetails.stateInfo?.fifthStageInput?.ccmVPStype || 'average';

            if(valuationResult.inputData[0].model.length === 1){
              let formattedValues;
              formattedValues = valuationResult.inputData[0].model.flatMap((models) => {
                return valuationResult.modelResults.flatMap((response) => {
                  if (
                    response.model === models &&
                    (models === MODEL[2] || models === MODEL[4])
                  ) {
                    const innerFormatted = response?.valuationData.valuation
                      .filter((innerValuationData) => innerValuationData.particular === 'result')
                      .map((innerValuationData) => {
                        const formattedNumber = ccmMetricType === 'average' ? innerValuationData.fairValuePerShareAvg : innerValuationData.fairValuePerShareMed;
                        return `${formatPositiveAndNegativeValues(bool === 'true' ? customRound(formattedNumber) : formattedNumber)}/-`;
                      });
                    return innerFormatted || [];
                  }
                  if (response.model === models && models !== 'NAV') {
                    const formattedNumber = response?.valuationData[0]?.valuePerShare;
                    return `${formatPositiveAndNegativeValues(bool === 'true' ? customRound(formattedNumber) : formattedNumber)}/-`;
                  }
                  if (response.model === models && models === 'NAV') {
                    const formattedNumber = response?.valuationData?.valuePerShare?.bookValue;
                    return `${formatPositiveAndNegativeValues(bool === 'true' ? customRound(formattedNumber) : formattedNumber)}/-`;
                  }
                  return [];
                });
              });
              return formattedValues[0] ? formattedValues[0] : 0;
            }
            else {
              if(reportDetails?.modelWeightageValue){
                // const equityValue = reportDetails.modelWeightageValue.weightedVal;
                // const outstandingShares = valuationResult.inputData[0].outstandingShares;
                // const finalValue =  Math.floor(equityValue*GET_MULTIPLIER_UNITS[`${valuationResult?.inputData[0]?.reportingUnit}`]/outstandingShares).toLocaleString('en-IN'); // use muliplier
                const finalValue = formatPositiveAndNegativeValues(bool === 'true' ? customRound(reportDetails.modelWeightageValue.weightedVal) : reportDetails.modelWeightageValue.weightedVal);
                return `${finalValue && finalValue !== '-' ? finalValue :  0}/-`
              }
            }
          })

          hbs.registerHelper('marketApproachHeaderCheck',(value)=>{
            if(value === 'Value of Equity' || value === 'Enterprise Value' || value === 'Fair Value of Equity'){
              return true;
            }
            return false;
          })

          hbs.registerHelper('calculatePostDiscountColspan',()=>{
            let colspan;
            valuationResult.modelResults.map((response)=>{
              if(response.model === MODEL[2] || response.model === MODEL[4]){
                const multiples = response.valuationData?.multiples;
                if(multiples){
                  colspan = Object.keys(multiples).filter(key => multiples[key])?.length;
                }
                else{
                  colspan = 4
                }
              }
            })
            return colspan;
          })

          hbs.registerHelper('vwapTypeCheck', (requestedType)=>{
            const vwapType = allProcessStageDetails.stateInfo?.fifthStageInput?.vwapType;
            if(vwapType){
              if(vwapType === requestedType) return true;
              return false;
            }
            return false;
          })

          hbs.registerHelper('isCapm', ()=>{
            return valuationResult.inputData[0].coeMethod === COST_OF_EQUITY_METHOD.capm.key;
          })
  
          hbs.registerHelper('costOfEquityMethodStrings',(parameter)=>{
            const capmMethod = valuationResult.inputData[0].coeMethod === COST_OF_EQUITY_METHOD.capm.key;
            switch(parameter){            
              case 'coeBase1':
                return capmMethod ? 'Capital Asset Pricing Model (CAP-M)' : 'Build-up Method';
              case 'coeBase2':
                return capmMethod ? 'CAP-M model' : 'Build-up Method';
              case 'coeBase3':
                return capmMethod ? 'Rf + β (Rmp) + α' : 'Rf + Rmp + γirp + δsp + α';
            }
          })

          hbs.registerHelper('ccmVPSMetricCheck', (requestedType)=>{
            const ccmMetricType = allProcessStageDetails.stateInfo?.fifthStageInput?.ccmVPStype || 'average';
              if(ccmMetricType){
                if(ccmMetricType === requestedType) return true;
                return false;
              }
              return false;
          })

          hbs.registerHelper('moreThanOneMultiple', () => {
            let multiples = [], selectedMultiples = [];
            valuationResult.modelResults.map((data)=>{
              if(data.model === MODEL[2] || data.model === MODEL[4]){
                multiples = data.valuationData?.multiples;
              }
            })
  
            if(multiples){
              // if multiples exist then take those multiples which are selected by user   
              let multiplesArray = Object.keys(multiples).filter(key => multiples[key]);
              multiplesArray.map((indMulitple)=>{
                MULTIPLES_TYPE.map((multipleStruc)=>{
                  if(multipleStruc.key === indMulitple){
                    selectedMultiples.push(multipleStruc.label);
                  }
                })
              })
            }
            else{
              // If multiples does not exist, take all the default multiples from array
              MULTIPLES_TYPE.map((multipleStru)=>{
                 selectedMultiples.push(multipleStru.label);
               }
              );
            }
  
            return selectedMultiples.length > 1;
          })
        }
        catch(error){
          console.log(error,"sebi helper error")
          return {
            error:error,
            status:false,
            msg:"Sebi helpers failure"
          }
        }
      }


      generateString(modelArray, reportDetails) {
        const methods = {
          DCF: "Discounted Cash Flow Method (‘DCF’)",
          CCM: "Comparable Company Multiple Method (‘CCM’)",
          NAV: "Net Asset Value Method (‘NAV’)",
          MarketPrice: "Market Price Method",
        };
      
        let selectedMethods = [], finalArray = [];
      
        if (reportDetails.reportSection.includes("165 - SEBI (Issue of Capital and Disclosure Requirements) Regulations, 2018")) {
          selectedMethods = [
            modelArray.includes(MODEL[0]) || modelArray.includes(MODEL[1]) ? methods.DCF : null,
            modelArray.includes(MODEL[5]) ? methods.NAV : null,
            (modelArray.includes(MODEL[2]) || modelArray.includes(MODEL[4])) ? methods.CCM : null,
          ];
        } else if (reportDetails.reportSection.includes("166(A) - SEBI (Issue of Capital and Disclosure Requirements) Regulations, 2018") && reportDetails.reportSection.length === 1) {
          selectedMethods = [
            modelArray.includes(MODEL[0]) || modelArray.includes(MODEL[1]) ? methods.DCF : null,
            modelArray.includes(MODEL[5]) ? methods.NAV : null,
            (modelArray.includes(MODEL[2]) || modelArray.includes(MODEL[4])) ? methods.CCM : null,
            methods.MarketPrice,
          ];
        }
      
        const filteredMethods = selectedMethods.filter(method => method !== null);
      
        const lastElementIndex = filteredMethods.length - 1;
        if (lastElementIndex >= 1) {
          const allElementsExcptLast = filteredMethods.slice(0, -1).join(', ');
          finalArray.push(`${allElementsExcptLast} and ${filteredMethods[lastElementIndex]}`);
        }
      
        const string = finalArray.length ? finalArray : filteredMethods.join(', ');
      
        return string;
      }

      async getFinancialSegment(reportDetails, valuationResult, request){
        try{
          const fetchStageThreeDetails = await this.processStateManagerService.fetchStageWiseDetails(reportDetails.processStateId,'thirdStageInput');
    
          let industryList = [];
          let companyMeanMedian = [];
          if(fetchStageThreeDetails.data){
            fetchStageThreeDetails.data.thirdStageInput.map((stateThreeDetails:any)=>{
              if(stateThreeDetails.model === MODEL[2]){
                stateThreeDetails?.companies.map((companyDetails:any,i:number)=>{
                  if(companyDetails.companyId){
                    industryList.push({COMPANYID:companyDetails.companyId,COMPANYNAME:companyDetails.company});
                    companyMeanMedian.push(companyDetails);
                  } 
                })
              }
            })
          }
    
          const getHistoricalData:any = await this.historicalReturnsService.getHistoricalBSE500Date(valuationResult.inputData[0].valuationDate);
          const date = formatDateToMMDDYYYY(getHistoricalData.Date) || formatDateToMMDDYYYY(valuationResult.inputData[0].valuationDate);
    
          const payload = {
            industryAggregateList:industryList,
            valuationDate:date
          }
          const bearerToken = await this.authenticationService.extractBearer(request);
    
          if(!bearerToken.status)
            return bearerToken;
    
          const headers = { 
            'Authorization':`${bearerToken.token}`,
            'Content-Type': 'application/json'
          }
          
          const financialSegmentDetails = await axiosInstance.post(`${CIQ_FINANCIAL_SEGMENT}`, payload, { httpsAgent: axiosRejectUnauthorisedAgent, headers });
          
          const financialLog = new ciqGetFinancialDto();
          financialLog.industryAggregateList = financialSegmentDetails.data.data;
          financialLog.valuationDate = date;
          
          const elasticfinancialSegmentDetails = await axiosInstance.post(`${CIQ_ELASTIC_SEARCH_FINANCIAL_SEGMENT}`, financialLog, { httpsAgent: axiosRejectUnauthorisedAgent, headers });
          const financialData = elasticfinancialSegmentDetails.data.data;
          let companyFinancialAndMultiples = [];
    
          for await (const indFinancialData of financialData){
            for await (const indMeanMedianData of companyMeanMedian){
              if(indFinancialData.companyId === indMeanMedianData.companyId){
                companyFinancialAndMultiples.push({...indFinancialData, ...indMeanMedianData});
                break;
              }
            }
          }
          return companyFinancialAndMultiples;
        }
        catch(error){
          return {
            error:error,
            status:false,
            msg:"financial segment calculation failed"
          }
        }
      }

      computeProportions(valuationResult, proportion, getCapitalStructure){
        if(valuationResult.inputData[0].capitalStructureType === 'Industry_Based'){
          let debtProp, equityProp;
          if(valuationResult.inputData[0]?.formTwoData?.betaFrom !== BETA_FROM.ASWATHDAMODARAN){
            const debtRatio = parseFloat(valuationResult.inputData[0].capitalStructure.deRatio) / 100;
            const totalCapital = 1 + debtRatio;
            debtProp = debtRatio / totalCapital;
            equityProp = 1 - debtProp;
          }
          else{
            const deRatio = valuationResult.inputData[0]?.formTwoData?.aswathDamodaranSelectedBetaObj?.deRatio;
            if(deRatio){
              const updateDeRatio = `${deRatio}`.includes('%') ? deRatio.split('%')[0] : deRatio;
              debtProp = (convertToNumberOrZero(updateDeRatio)/100).toFixed(2);
              equityProp = 1;
            }else{
              debtProp = 0;
              equityProp = 0;
            }
          }
          if(proportion === 'equity'){
            return convertToNumberOrZero(parseFloat(equityProp) * 100).toFixed(2);
          }
          else{
            return convertToNumberOrZero(parseFloat(debtProp) * 100).toFixed(2);
          }
        }
        else if(valuationResult.inputData[0].capitalStructureType === 'Target_Based'){
          const debtProp = (convertToNumberOrZero(valuationResult.inputData[0]?.capitalStructure.debtProp)/100).toFixed(2);
          const equityProp = (convertToNumberOrZero(valuationResult.inputData[0]?.capitalStructure.equityProp)/100)?.toFixed(2);
          if(proportion === 'equity'){
            return convertToNumberOrZero(parseFloat(equityProp) * 100).toFixed(2);
          }
          else{
            return convertToNumberOrZero(parseFloat(debtProp) * 100).toFixed(2);
          }
        }
        else{   //This is for company based capital structure --- (needs verification)
          const debtProp = getCapitalStructure.result.capitalStructure.debtProp;
          const equityProp = getCapitalStructure.result.capitalStructure.equityProp;
          if(proportion === 'equity'){
            return convertToNumberOrZero(parseFloat(equityProp) * 100).toFixed(2);
          }
          else{
            return convertToNumberOrZero(parseFloat(debtProp) * 100).toFixed(2);
          }
        }
      }

      calculateCostOfDebt(valuationResult){
        let costOfDebt:any =  parseFloat(valuationResult.inputData[0]?.costOfDebt)?.toFixed(2) || 0;
        let taxRate = this.fetchTotalTaxRate(valuationResult);
        return (((costOfDebt/100)*(1-parseFloat(taxRate)/100))*100).toFixed(2);
      }

      fetchTotalTaxRate(valuationResult){
        return valuationResult.inputData[0]?.taxRate ? 
          (
            `${valuationResult.inputData[0]?.taxRate}`.includes('%') ? 
            valuationResult.inputData[0]?.taxRate.split('%')[0] :
            valuationResult.inputData[0]?.taxRate
          ) : 
          0;
      }

      checkModelExist(modelName,modelArray){
        return modelArray?.length ?  modelArray?.includes(modelName) : false;
      }
}