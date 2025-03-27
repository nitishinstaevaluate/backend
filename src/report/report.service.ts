import { HttpException, HttpStatus, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import * as puppeteer from 'puppeteer';
import { ValuationsService } from 'src/valuationProcess/valuationProcess.service';
import hbs = require('handlebars');
import { InjectModel } from '@nestjs/mongoose';
import { Model, model } from 'mongoose';
import { ReportDocument } from './schema/report.schema';
import { ALPHA, AWS_STAGING, BETA_FROM, BETA_SUB_TYPE, BETA_TYPE, CAPITAL_STRUCTURE_TYPE, COST_OF_EQUITY_METHOD, DOCUMENT_UPLOAD_TYPE, EXPECTED_MARKET_RETURN_HISTORICAL_TYPE, FINANCIAL_BASIS_TYPE, GET_MULTIPLIER_UNITS, INCOME_APPROACH, MARKET_PRICE_APPROACH, MB01_PURPOSE_OF_REPORT_AND_SECTION, MB01_REPORT_PURPOSE, METHODS_AND_APPROACHES, MODEL, MULTIPLES_ORDER_CCM_REPORT, MULTIPLES_TYPE, NATURE_OF_INSTRUMENT, NAVIGANT_LOGO, NET_ASSET_VALUE_APPROACH, PURPOSE_OF_REPORT_AND_SECTION, RELATIVE_PREFERENCE_RATIO, REPORTING_UNIT, REPORT_BETA_TYPES, REPORT_LINE_ITEM, REPORT_PURPOSE } from 'src/constants/constants';
import { FCFEAndFCFFService } from 'src/valuationProcess/fcfeAndFCFF.service';
import { CalculationService } from 'src/calculation/calculation.service';
const FormData = require('form-data');
import ConvertAPI from 'convertapi';
import { IFIN_REPORT, SYNC_FUSION_DOC_CONVERT } from 'src/library/interfaces/api-endpoints.prod';
import { axiosInstance, axiosRejectUnauthorisedAgent } from 'src/middleware/axiosConfig';
require('dotenv').config();
import * as converter from 'number-to-words'
import { ElevenUaService } from 'src/elevenUA/eleven-ua.service';
import { CIQ_ELASTIC_SEARCH_FINANCIAL_SEGMENT, CIQ_FINANCIAL_SEGMENT, FETCH_BETA_WORKING } from 'src/library/interfaces/api-endpoints.local';
import { convertToNumberOrZero, getRequestAuth } from 'src/excelFileServices/common.methods';
import { ProcessStatusManagerService } from 'src/processStatusManager/service/process-status-manager.service';
import { AuthenticationService } from 'src/authentication/authentication.service';
import { HistoricalReturnsService } from 'src/data-references/data-references.service';
import { formatDateToMMDDYYYY, isNotRuleElevenUaAndNav } from 'src/ciq-sp/ciq-common-functions';
import { sebiReportService } from './sebi-report.service';
import { mandateReportService } from './mandate-report.service';
import { mrlReportService } from './mrl-report.service';
import { thirdpartyApiAggregateService } from 'src/library/thirdparty-api/thirdparty-api-aggregate.service';
import { ciqGetFinancialDto } from 'src/ciq-sp/dto/ciq-sp.dto';
import { navReportService } from './nav-report.service';
import { terminalValueWorkingService } from 'src/valuationProcess/terminal-value-working.service';
import { convertToRomanNumeral, customRound, formatPositiveAndNegativeValues } from './report-common-functions';
import { financialHelperService } from './helpers/financial-helpers.service';
import { KeyCloakAuthGuard } from 'src/middleware/key-cloak-auth-guard';
import { userRoles } from 'src/library/enums/user-roles.enum';
import { reportClaims } from 'src/library/enums/report-claim-mapping-enum';

@Injectable()
export class ReportService {
    // totalA=0;
    // totalB=0;
    // totalC=0;
    // totalD=0;
    // totalL=0;
    unqotedEquityShareVal=0;
    constructor( private valuationService:ValuationsService,
      @InjectModel('report')
    private readonly reportModel: Model<ReportDocument>,
    private fcfeService:FCFEAndFCFFService,
    private calculationService:CalculationService,
    private elevenUaService:ElevenUaService,
    private processStateManagerService:ProcessStatusManagerService,
    private authenticationService: AuthenticationService,
    private historicalReturnsService:HistoricalReturnsService,
    private sebiReportService:sebiReportService,
    private mandateReportService: mandateReportService,
    private mrlReportService: mrlReportService,
    private thirdpartyApiAggregateService: thirdpartyApiAggregateService,
    private navReportService: navReportService,
    private terminalValueWorkingService: terminalValueWorkingService,
    private financialHelperService: financialHelperService
    ){}

    async getReport(id,res, req,approach, formatType){
      try {
          const transposedData = [];
          let  getCapitalStructure, terminalYearWorkings, betaWorking;
          let htmlFilePath, pdfFilePath,docFilePath,pdf;
          const reportDetails = await this.reportModel.findById(id);
          const valuationResult:any = await this.valuationService.getValuationById(reportDetails.reportId);
          if(valuationResult.inputData[0].model.includes(MODEL[0]) || valuationResult.inputData[0].model.includes(MODEL[1])){
            terminalYearWorkings = await this.terminalValueWorkingService.computeTerminalValue(reportDetails.processStateId);
            betaWorking = await this.fetchBetaWorking(req, reportDetails.processStateId, valuationResult.inputData[0].betaType);
          }
          const allProcessStageDetails = await this.processStateManagerService.fetchProcess(reportDetails.processStateId);

          // Fetching Associated Roles
          const headers = {
            authorization: req.headers.authorization
          }
          const { roles } = await this.fetchUserInfo(headers);
          const reportClaimValidator = await this.validateReportClaims(roles, reportDetails.reportPurpose);
          if(!reportClaimValidator) throw new UnauthorizedException({msg:'User Unauthorised', status:false, description:"You are not authorised to generate selected report"});
          const MB01 = roles.some(indRole => indRole?.name === userRoles.merchantBanker);
         
          if(MB01){
            htmlFilePath = path.join(process.cwd(), 'html-template', `multi-model-report.html`);
          }
          else if(reportDetails.reportPurpose.includes(Object.keys(REPORT_PURPOSE)[0]) || reportDetails.reportPurpose.includes(Object.keys(REPORT_PURPOSE)[2]) || reportDetails.reportPurpose.includes(Object.keys(REPORT_PURPOSE)[4])){
            htmlFilePath = path.join(process.cwd(), 'html-template', `${approach === METHODS_AND_APPROACHES[0] ? 'basic-report' : (approach === METHODS_AND_APPROACHES[3] || approach === METHODS_AND_APPROACHES[4]) ? 'comparable-companies-report' : approach === METHODS_AND_APPROACHES[2]? 'multi-model-report':''}.html`);
          }

          pdfFilePath = path.join(process.cwd(), 'pdf', `${valuationResult.inputData[0].company}-${reportDetails.id}.pdf`);
          docFilePath = path.join(process.cwd(), 'pdf', `${valuationResult.inputData[0].company}-${reportDetails.id}.docx`);
          
          if(reportDetails?.fileName){
            let formatExtentionHeader,formatTypeHeader, attachmentHeader;
            if(formatType === 'DOCX'){
              let wordBuffer = fs.readFileSync(docFilePath);

              formatTypeHeader = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
              formatExtentionHeader = `attachment; filename="='${valuationResult.inputData[0].company}-${reportDetails.id}'.docx"`;
              attachmentHeader = wordBuffer;
            }
            else{
              const convertDocxToPdf = await this.thirdpartyApiAggregateService.convertDocxToPdf(docFilePath,pdfFilePath);

              formatTypeHeader = 'application/pdf';
              formatExtentionHeader = `attachment; filename="='${valuationResult.inputData[0].company}-${reportDetails.id}'.pdf"`;
              attachmentHeader = convertDocxToPdf;
            }
            
            res.setHeader('Content-Type', formatTypeHeader);
            res.setHeader('Content-Disposition', formatExtentionHeader);
            res.send(attachmentHeader);
            return {
                 msg: `${formatType === 'DOCX' ? 'DOCX' : 'PDF'} download Success`,
                 status: true,
             };
          }

          if(isNotRuleElevenUaAndNav(valuationResult.inputData[0].model)){
            const financialSegmentDetails = await this.getFinancialSegment(reportDetails, valuationResult, req);
            // this.loadFinancialTableHelper(financialSegmentDetails, valuationResult);
            this.financialHelperService.loadFinancialTableHelper(financialSegmentDetails, valuationResult, allProcessStageDetails);
          }

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
  
          for await (let data of valuationResult.modelResults) {
              if (data.model !== MODEL[2] && data.model !== MODEL[4] && data.model !== MODEL[5] && data.model !== MODEL[7]) {
                  transposedData.push({ model: data.model, data: await this.fcfeService.transformData(data.valuationData) });
              }
          }
          this.loadHelpers(transposedData, valuationResult, reportDetails,getCapitalStructure, betaWorking, allProcessStageDetails, terminalYearWorkings, roles);
  
          if (valuationResult.modelResults.length > 0) {
              const htmlContent = fs.readFileSync(htmlFilePath, 'utf8');
              const template = hbs.compile(htmlContent);
              const html = template(valuationResult);
            
              // if(reportDetails.reportPurpose.includes(Object.keys(REPORT_PURPOSE)[0])){
                pdf = await this.generatePdf(html, pdfFilePath, roles);
              // }
              let formatExtentionHeader,formatTypeHeader, attachmentHeader; 
              if(formatType === 'DOCX'){
                await this.thirdpartyApiAggregateService.convertPdfToDocx(pdfFilePath, docFilePath);
          
                let wordBuffer = fs.readFileSync(docFilePath);
                formatTypeHeader = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
                formatExtentionHeader = `attachment; filename="='${valuationResult.inputData[0].company}-${reportDetails.id}'.docx"`;
                attachmentHeader = wordBuffer;
              }
              else{
                formatTypeHeader = 'application/pdf';
                formatExtentionHeader = `attachment; filename="='${valuationResult.inputData[0].company}-${reportDetails.id}'.pdf"`;
                attachmentHeader = pdf;
              }

              res.setHeader('Content-Type', formatTypeHeader);
              res.setHeader('Content-Disposition', formatExtentionHeader);
              res.send(attachmentHeader);

              return {
                  msg: `${formatType === 'DOCX' ? 'DOCX' : 'PDF'} download Success`,
                  status: true,
              };
          } else {
              return {
                  msg: `No data found for ${formatType === 'DOCX' ? 'DOCX' : 'PDF'} generation`,
                  status: false
              };
          }
      } catch (error) {
        throw error;
      }
  }

 async previewReport(id,res, req, approach){
  try {
    const transposedData = [];
    let  getCapitalStructure, terminalValueWorking;
    const reportDetails = await this.reportModel.findById(id);

    let htmlFilePath, pdfFilePath,docFilePath,pdf;
    const valuationResult:any = await this.valuationService.getValuationById(reportDetails.reportId);
    if(valuationResult.inputData[0].model.includes(MODEL[0]) || valuationResult.inputData[0].model.includes(MODEL[1])){
      terminalValueWorking = await this.terminalValueWorkingService.computeTerminalValue(reportDetails.processStateId);
    }
    const allProcessStageDetails = await this.processStateManagerService.fetchProcess(reportDetails.processStateId);

    // Fetching Associated Roles
    const headers = {
      authorization: req.headers.authorization
    }
    const { roles } = await this.fetchUserInfo(headers);
    const reportClaimValidator = await this.validateReportClaims(roles, reportDetails.reportPurpose);
          
    if(!reportClaimValidator) throw new UnauthorizedException({msg:'User Unauthorised', status:false, description:"You are not authorised to generate selected report"});
    const MB01 = roles.some(indRole => indRole?.name === userRoles.merchantBanker);
    const betaWorking = await this.fetchBetaWorking(req, reportDetails.processStateId, valuationResult.inputData[0].betaType);

    if(MB01){
      htmlFilePath = path.join(process.cwd(), 'html-template', `multi-model-report.html`);
    }
    else if(reportDetails.reportPurpose.includes(Object.keys(REPORT_PURPOSE)[0]) || reportDetails.reportPurpose.includes(Object.keys(REPORT_PURPOSE)[2]) || reportDetails.reportPurpose.includes(Object.keys(REPORT_PURPOSE)[4])){
      htmlFilePath = path.join(process.cwd(), 'html-template', `${approach === METHODS_AND_APPROACHES[0] ? 'basic-report' : (approach === METHODS_AND_APPROACHES[3] || approach === METHODS_AND_APPROACHES[4]) ? 'comparable-companies-report' : approach === METHODS_AND_APPROACHES[2]? 'multi-model-report':''}.html`);
    }

    pdfFilePath = path.join(process.cwd(), 'pdf', `${valuationResult.inputData[0].company}-${reportDetails.id}.pdf`);
    docFilePath = path.join(process.cwd(), 'pdf', `${valuationResult.inputData[0].company}-${reportDetails.id}.docx`);

    if(reportDetails.fileName){
      const convertDocxToSfdt = await this.thirdpartyApiAggregateService.convertDocxToSyncfusionDocumentFormat(docFilePath,true)

      res.send(convertDocxToSfdt);

      return {
        msg: "Preview Success",
        status: true,
      };
    }

    if(isNotRuleElevenUaAndNav(valuationResult.inputData[0].model)){
      const financialSegmentDetails = await this.getFinancialSegment(reportDetails, valuationResult, req);
      // this.loadFinancialTableHelper(financialSegmentDetails, valuationResult);
      this.financialHelperService.loadFinancialTableHelper(financialSegmentDetails, valuationResult, allProcessStageDetails);
    }

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

    for await (let data of valuationResult.modelResults) {
        if (data.model !== MODEL[2] && data.model !== MODEL[4] && data.model !== MODEL[5] && data.model !== MODEL[7]) {
            transposedData.push({ model: data.model, data: await this.fcfeService.transformData(data.valuationData) });
        }
    }
    this.loadHelpers(transposedData, valuationResult, reportDetails,getCapitalStructure, betaWorking, allProcessStageDetails, terminalValueWorking, roles);

    if (valuationResult.modelResults.length > 0) {
        const htmlContent = fs.readFileSync(htmlFilePath, 'utf8');
        const template = hbs.compile(htmlContent);
        const html = template(valuationResult);

        // if(reportDetails.reportPurpose.includes(Object.keys(REPORT_PURPOSE)[0])){
          pdf = await this.generatePdf(html, pdfFilePath, roles);
        // }

        await this.thirdpartyApiAggregateService.convertPdfToDocx(pdfFilePath,docFilePath)
        
        const convertDocxToSfdt = await this.thirdpartyApiAggregateService.convertDocxToSyncfusionDocumentFormat(docFilePath)

        res.send(convertDocxToSfdt);

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
} catch (error) {
  throw error;
}
 }

 async ruleElevenUaReport(id,res,formatType){
  try{
    let htmlFilePath, pdfFilePath,docFilePath,pdf;

    const reportDetails = await this.reportModel.findById(id);
    const elevenUaData:any = await this.elevenUaService.fetchRuleElevenUa(reportDetails.reportId);
    htmlFilePath = path.join(process.cwd(), 'html-template', `transfer-of-shares-report.html`);

    pdfFilePath = path.join(process.cwd(), 'pdf', `${elevenUaData?.data?.inputData.company}-${reportDetails.id}.pdf`);
    docFilePath = path.join(process.cwd(), 'pdf', `${elevenUaData?.data?.inputData.company}-${reportDetails.id}.docx`);

    if(reportDetails?.fileName){
        let formatExtentionHeader,formatTypeHeader, attachmentHeader;
        if(formatType === 'DOCX'){
          let wordBuffer = fs.readFileSync(docFilePath);

          formatTypeHeader = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
          formatExtentionHeader = `attachment; filename="='${elevenUaData?.data?.inputData.company}-${reportDetails.id}'.docx"`;
          attachmentHeader = wordBuffer;
        }
        else{
          const convertDocxToPdf = await this.thirdpartyApiAggregateService.convertDocxToPdf(docFilePath,pdfFilePath);

          formatTypeHeader = 'application/pdf';
          formatExtentionHeader = `attachment; filename="='${elevenUaData?.data?.inputData.company}-${reportDetails.id}'.pdf"`;
          attachmentHeader = convertDocxToPdf;
        }
        
        res.setHeader('Content-Type', formatTypeHeader);
        res.setHeader('Content-Disposition', formatExtentionHeader);
        res.send(attachmentHeader);
        return {
              msg: `${formatType === 'DOCX' ? 'DOCX' : 'PDF'} download Success`,
              status: true,
          };
    }

    this.loadElevenUaHelpers(elevenUaData,reportDetails);

      const htmlContent = fs.readFileSync(htmlFilePath, 'utf8');
      const template = hbs.compile(htmlContent);
      const html = template(elevenUaData);
    
      pdf = await this.generateTransferOfSharesReport(html, pdfFilePath);

      let formatExtentionHeader,formatTypeHeader, attachmentHeader; 
      if(formatType === 'DOCX'){
          await this.thirdpartyApiAggregateService.convertPdfToDocx(pdfFilePath, docFilePath);
  
          let wordBuffer = fs.readFileSync(docFilePath);
          formatTypeHeader = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
          formatExtentionHeader = `attachment; filename="='${elevenUaData?.data?.inputData.company}-${reportDetails.id}'.docx"`;
          attachmentHeader = wordBuffer;
      }
      else{
          formatTypeHeader = 'application/pdf';
          formatExtentionHeader = `attachment; filename="='${elevenUaData?.data?.inputData.company}-${reportDetails.id}'.pdf"`;
          attachmentHeader = pdf;
      }

      res.setHeader('Content-Type', formatTypeHeader);
      res.setHeader('Content-Disposition', formatExtentionHeader);
      res.send(attachmentHeader);

      return {
          msg: `${formatType === 'DOCX' ? 'DOCX' : 'PDF'} download Success`,
          status: true,
      };
  }
  catch(error){
    return {
      error:error,
      msg:"report generation failed",
      status:false
    }
  }
 }

 async ruleElevenUaPreviewReport(id,res){
  try{
    let htmlFilePath, pdfFilePath,docFilePath,pdf;

    const reportDetails = await this.reportModel.findById(id);
    const elevenUaData:any = await this.elevenUaService.fetchRuleElevenUa(reportDetails.reportId);
    htmlFilePath = path.join(process.cwd(), 'html-template', `transfer-of-shares-report.html`);

    pdfFilePath = path.join(process.cwd(), 'pdf', `${elevenUaData?.data?.inputData.company}-${reportDetails.id}.pdf`);
    docFilePath = path.join(process.cwd(), 'pdf', `${elevenUaData?.data?.inputData.company}-${reportDetails.id}.docx`);

    if(reportDetails?.fileName){
      const convertDocxToSfdt = await this.thirdpartyApiAggregateService.convertDocxToSyncfusionDocumentFormat(docFilePath,true)

      res.send(convertDocxToSfdt);

      return {
        msg: "Preview Success",
        status: true,
      };
    }

    this.loadElevenUaHelpers(elevenUaData,reportDetails);

      const htmlContent = fs.readFileSync(htmlFilePath, 'utf8');
      const template = hbs.compile(htmlContent);
      const html = template(elevenUaData);
    
      pdf = await this.generateTransferOfSharesReport(html, pdfFilePath);

      await this.thirdpartyApiAggregateService.convertPdfToDocx(pdfFilePath,docFilePath)

      const convertDocxToSfdt = await this.thirdpartyApiAggregateService.convertDocxToSyncfusionDocumentFormat(docFilePath)

      res.send(convertDocxToSfdt);

      return {
          msg: "Preview Success",
          status: true,
      };
  }
  catch(error){
    console.log(error)
    throw error;
  }
 }

 async sebiReport(id,res, req, formatType){
  try{
    let htmlFilePath, pdfFilePath,docFilePath,pdf;
    
    const reportDetails = await this.reportModel.findById(id);

    const headers = {
      authorization: req.headers.authorization
    }
    const { roles } = await this.fetchUserInfo(headers);
    const reportClaimValidator = await this.validateReportClaims(roles, reportDetails.reportPurpose);
    
    if(!reportClaimValidator) throw new UnauthorizedException({msg:'User Unauthorised', status:false, description:"You are not authorised to generate selected report"});

    const valuationResultDetails:any = await this.valuationService.getValuationById(reportDetails.reportId);
    const companyName = valuationResultDetails.inputData[0].company;
    htmlFilePath = path.join(process.cwd(), 'html-template', `sebi-report.html`);

    pdfFilePath = path.join(process.cwd(), 'pdf', `${companyName}-${reportDetails.id}.pdf`);
    docFilePath = path.join(process.cwd(), 'pdf', `${companyName}-${reportDetails.id}.docx`);

    if(reportDetails?.fileName){
        let formatExtentionHeader,formatTypeHeader, attachmentHeader;
        if(formatType === 'DOCX'){
          let wordBuffer = fs.readFileSync(docFilePath);

          formatTypeHeader = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
          formatExtentionHeader = `attachment; filename="='${companyName}-${reportDetails.id}'.docx"`;
          attachmentHeader = wordBuffer;
        }
        else{
          const convertDocxToPdf = await this.thirdpartyApiAggregateService.convertDocxToPdf(docFilePath,pdfFilePath);

          formatTypeHeader = 'application/pdf';
          formatExtentionHeader = `attachment; filename="='${companyName}-${reportDetails.id}'.pdf"`;
          attachmentHeader = convertDocxToPdf;
        }
        
        res.setHeader('Content-Type', formatTypeHeader);
        res.setHeader('Content-Disposition', formatExtentionHeader);
        res.send(attachmentHeader);
        return {
              msg: `${formatType === 'DOCX' ? 'DOCX' : 'PDF'} download Success`,
              status: true,
          };
    }
    
    pdf =  await this.sebiReportService.computeSEBIReport(htmlFilePath, pdfFilePath, req, valuationResultDetails, reportDetails);

      let formatExtentionHeader,formatTypeHeader, attachmentHeader; 
      if(formatType === 'DOCX'){
          await this.thirdpartyApiAggregateService.convertPdfToDocx(pdfFilePath, docFilePath);
  
          let wordBuffer = fs.readFileSync(docFilePath);
          formatTypeHeader = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
          formatExtentionHeader = `attachment; filename="='${companyName}-${reportDetails.id}'.docx"`;
          attachmentHeader = wordBuffer;
      }
      else{
          formatTypeHeader = 'application/pdf';
          formatExtentionHeader = `attachment; filename="='${companyName}-${reportDetails.id}'.pdf"`;
          attachmentHeader = pdf;
      }

      res.setHeader('Content-Type', formatTypeHeader);
      res.setHeader('Content-Disposition', formatExtentionHeader);
      res.send(attachmentHeader);

      return {
          msg: `${formatType === 'DOCX' ? 'DOCX' : 'PDF'} download Success`,
          status: true,
      };
  }
  catch(error){
    throw error;
  }
 }

 async previewSebiReport(id, res, req){
  try{
    const reportDetails = await this.reportModel.findById(id);

    const headers = {
      authorization: req.headers.authorization
    }
    const { roles } = await this.fetchUserInfo(headers);
    const reportClaimValidator = await this.validateReportClaims(roles, reportDetails.reportPurpose);
    
    if(!reportClaimValidator) throw new UnauthorizedException({msg:'User Unauthorised', status:false, description:"You are not authorised to generate selected report"});

    let htmlFilePath, pdfFilePath,docFilePath,pdf;
    const valuationResult:any = await this.valuationService.getValuationById(reportDetails.reportId);

    
    htmlFilePath = path.join(process.cwd(), 'html-template', `sebi-report.html`);

    pdfFilePath = path.join(process.cwd(), 'pdf', `${valuationResult.inputData[0].company}-${reportDetails.id}.pdf`);
    docFilePath = path.join(process.cwd(), 'pdf', `${valuationResult.inputData[0].company}-${reportDetails.id}.docx`);
    
    return await this.sebiReportService.computeSEBIpreviewReport(reportDetails, valuationResult,res, req, docFilePath, htmlFilePath,pdfFilePath)
  }
  catch(error){
    throw error;
  }
 }

//  async convertDocxToSyncfusionDocumentFormat(docxpath,fileExist?){
//   try{
//     if(fileExist){
//       const { dir: directory, base: filename } = path.parse(docxpath);
//       await this.thirdpartyApiAggregateService.fetchReportFromS3(filename);
//     }
//     const htmlContent = fs.readFileSync(docxpath);
//     const formData = new FormData();
//     formData.append('file', htmlContent, {
//       filename: docxpath,
//       contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
//     });
  
//     const response = await axiosInstance.post(SYNC_FUSION_DOC_CONVERT, formData);
//     return response.data;
//    }
//    catch(error){
//     console.log(error)
//   return {
//     msg:'something went wrong',
//     status:false,
//     error:error.message
//   }
//    }
//  }

//  async convertPdfToDocx(filePath,savePath){
//   try{
//     const convertapi = new ConvertAPI(process.env.CONVERTAPISECRET);
//     const conversion = await  convertapi.convert('docx', { File: `${filePath}`},'pdf');
//     return conversion.file.save(savePath);
//   }
//   catch(error){
//     return{
//       msg:'conversion from pdf to docx failed',
//       status:false,
//       error:error.message
//     }
//   }
//  }

 async updateReportDocxBuffer(reportId:any,file){
  try{
    const report = await this.reportModel.findOneAndUpdate(
      { _id: reportId },
      { $set: { fileName: file.filename } },
      { new: true }
    );
    if(report.id)
      await this.pushUpdatedReportIntoS3(file);
    
    return {
      reportId:report.id,
      msg:'Successfully updated doc',
      status:true
    };
  }
  catch(error){
    return {
      error:error.message,
      msg:'Doc update failed',
      status:false
    }
  }
 }



    async generatePdf(htmlContent: any, pdfFilePath: string, roles) {
      const MB01 = roles.some(indRole => indRole?.name === userRoles.merchantBanker);
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
            footerTemplate:MB01 ? `<div style="width:100%;margin-top:5%">
            <hr style="border:1px solid #bbccbb">
            <h1 style="padding-left: 5%;  font-size:11px; color:#5F978E; display: flex; justify-content: space-between; align-items: center;">
                <span>Navigant Corporate Advisors Limited</span>
                <span style="font-weight:400 !important; font-size:11px;">Page <span class="pageNumber"></span></span>
                <span style="padding-right: 3%; font-size:12px;">Private &amp; confidential</span>
            </h1>
          </div>` : 
          `<div style="width:100%;margin-top:5%">
          <hr style="border:1px solid #bbccbb">
          <h1 style="padding-left: 5%;text-indent: 0pt;text-align: center;font-size:11px;color:#5F978E;"><span style="font-weight:400 !important;">Page <span class="pageNumber"></span></span></span> <span style="float: right;padding-right: 3%;font-size:12px"> Private &amp; confidential </span></h1>
          </div>`,
            margin: {
              right: "20px",
          },          
          });
          return pdf;
        } catch (error) {
          console.error('Error generating PDF:', error);
        } finally {
          await browser.close();
        }
      }
      
    async generateSebiReport(htmlContent: any, pdfFilePath: string) {
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
              bottom: "50px",
              left: "0px"
          },
          headerTemplate:`<table width="100%" border="0" cellspacing="0" cellpadding="0">
          <tr>
          <td style="width:100%;">
            <table border="0" cellspacing="0" cellpadding="0" style="height: 20px;width:100% !important;padding-left:3%;padding-right:3%">
              <tr>
                <td style=" border-bottom: 1px solid #bbccbb !important;font-size: 13px; height: 5px;width:100% !important;text-align:right;font-size:12px;font-family:Georgia, 'Times New Roman', Times, serif;"><i>Valuation of equity shares of ABC Limited</i></td>
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
    async generateTransferOfSharesReport(htmlContent: any, pdfFilePath: string) {
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
              top: "10px",
              right: "0px",
              bottom: "10px",
              left: "0px"
          },
            footerTemplate: `<div style="width:100%;padding-left:3%;padding-right:3%">
            <hr style="border: 1px solid rgba(187, 204, 187, 0.5);width:80%">
            <h1 style="text-indent: 0pt;text-align: center;font-size:11px;color:#5F978E;"><span style="float: left;padding-right: 3%;font-size:12px;font-family:'Carlito', sans-serif;"> <i></i> </span><span style="font-weight:400 !important;float:right;font-size:13px;font-family:'Carlito', sans-serif;color:#cceecc;padding-right:10%;padding-top:1%;font-weight:bold !important;"> <span class="pageNumber" style="color:#6F2F9F;font-weight:400;"></span> &nbsp;&nbsp; | &nbsp;&nbsp; Page  </span></span></h1>
            
            </div>`,
          });

          return pdf;
        } catch (error) {
          console.error('Error generating PDF:', error);
        } finally {
          await browser.close();
         
        }
      }

    async createReport(data, headers){
      let registerValuerPayload;
      const { roles } = await this.fetchUserInfo(headers);
      const MB01 = roles.some(indRole => indRole?.name === userRoles.merchantBanker);

      if(!data.useExistingValuer){
        if(MB01){
          registerValuerPayload={
            registeredValuerName: 'Sarthak Vijlani',
            registeredValuerCompanyName: 'Navigant Corporate Advisors Limited',
            registeredValuerEmailId: 'navigant@navigantcorp.com',
            registeredValuerIbbiId: 'INM000012243',
            registeredValuerMobileNumber: '9997354674',
            registeredValuerCorporateAddress: '804, Meadows, Sahar Plaza Complex, J.B. Nagar, Andheri Kurla Road, Andheri East, Mumbai-400 059',
            registeredvaluerDOIorConflict: 'No',
            registeredValuerQualifications: 'SEBI Registered Category I Merchant Banker',
            registeredValuerPosition:'Managing Director'
          }
        }
        else{
          registerValuerPayload={
            registeredValuerName: 'Nitish Chaturvedi',
            registeredValuerEmailId: 'chaturvedinitish@gmail.com',
            registeredValuerIbbiId: 'IBBI/RV/03/2020/12916',
            registeredValuerMobileNumber: '9997354674',
            registeredValuerGeneralAddress: '94, Bheesm Kunj, Gaja Paisa, Mathura 281001',
            registeredValuerCorporateAddress: 'Unit No. 8, 2nd Floor,Senior Estate, 7/C,Parsi Panchayat Road,Sterling Enterprises,Andheri (E), Mumbai - 400069',
            registeredvaluerDOIorConflict: 'No',
            registeredValuerQualifications: 'MBA & Registered Valuer - Securities or Financial Assets',
            registeredValuerProfile: `<span style="font-weight: bold;">Mr. Nitish Chaturvedi</span> is a Registered Valuer of Securities or Financial Assets with IBBI and he has done his MBA 
            from IMT Dubai and currently pursuing CFA Level 3 USA. He has more than 8 years of Experience in the 
            field of Corporate Finance, Equity Research, Investment Banking and Valuation activities and has managed 
            more than 1000 Valuation assignments in a span of around 5 years. He has performed on transactions covering 
            diverse industries like Oil & Gas, Automobiles, Software Services, Financial Services, etc.`,
            copNo:'ICSI RVO/COP/SFA0420/136'
          }
        }
      }
      else{
        registerValuerPayload={
          registeredValuerName: data?.registeredValuerName,
          registeredValuerEmailId: data?.registeredValuerEmailId,
          registeredValuerIbbiId: data?.registeredValuerIbbiId,
          registeredValuerMobileNumber: data?.registeredValuerMobileNumber,
          registeredValuerGeneralAddress: data?.registeredValuerGeneralAddress,
          registeredvaluerDOIorConflict: data?.registeredvaluerDOIorConflict,
          registeredValuerQualifications: data?.registeredValuerQualifications,
          registeredValuerCompanyName: MB01 ? 'Navigant Corporate Advisors Limited' : '',
          registeredValuerPosition:MB01 ? 'Managing Director' : ''
        }
      }
      let appointeeDetailsPayload:{};
      if(!data.appointeeDetails){
        appointeeDetailsPayload={
            appointingAuthorityName: data?.appointingAuthorityName,
            dateOfAppointment: data?.dateOfAppointment
        }
      }
      const payload= {
        clientName:data.clientName,
        registeredValuerDetails:registerValuerPayload,
        appointeeDetails:appointeeDetailsPayload,
        reportId:data?.reportId,
        useExistingValuer:data?.useExistingValuer,
        reportDate:data?.reportDate,
        natureOfInstrument:data?.natureOfInstrument,
        reportPurpose:data?.reportPurpose,
        reportSection:data?.reportSection,
        dateOfIncorporation:data?.dateOfIncorporation,
        cinNumber:data?.cinNumber,
        companyAddress:data?.companyAddress,
        modelWeightageValue:data.finalWeightedAverage,
        processStateId:data.processStateId,
        companyInfo:data.companyInfo
      }
      try {
        const filter = { reportId: data?.reportId };
        const update = { $set: payload };
        
        const options = {
          upsert: true,
          new: true,
          runValidators: true
        };
      
        const upsertReportDetails = await this.reportModel.findOneAndUpdate(filter, update, options);
        return upsertReportDetails._id;
      } catch (e) {
        throw new HttpException(e.message, HttpStatus.BAD_REQUEST);
      }
    }

    async fetchReportDetails(id){
      try {
        const reportDetails = await this.reportModel.findOne({_id: id});
        return reportDetails;
      } catch (e) {
        throw new HttpException(e.message, HttpStatus.BAD_REQUEST);
      }
    }
   loadHelpers(transposedData,valuationResult,reportDetails,getCapitalStructure, betaWorking, allProcessStageDetails, terminalYearWorkings, roles){
     try{
      hbs.registerHelper('companyName',()=>{
        if(valuationResult.inputData[0].company)
          return valuationResult.inputData[0].company;
        return '';
      })

      hbs.registerHelper('reportDate',()=>{
        if(reportDetails.registeredValuerDetails[0]) 
            return  this.formatDate(new Date(reportDetails.reportDate));
        return '';
      })

      hbs.registerHelper('strdate',()=>{
        if(valuationResult.inputData[0].valuationDate)
          return this.formatDate(new Date(valuationResult.inputData[0].valuationDate));
        return '';
      })

      hbs.registerHelper('registeredValuerName',()=>{
        if(reportDetails.registeredValuerDetails[0]) 
            return  reportDetails.registeredValuerDetails[0].registeredValuerName
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
      hbs.registerHelper('registeredValuerCompanyName',()=>{
        if(reportDetails.registeredValuerDetails[0]) 
            return  reportDetails.registeredValuerDetails[0].registeredValuerCompanyName; 
        return '';
      })

      hbs.registerHelper('registeredValuerCopNo',()=>{
        if(reportDetails.registeredValuerDetails[0]) {
          return  reportDetails.registeredValuerDetails[0]?.copNo
        }
        return '';
      })

      hbs.registerHelper('registeredValuerPosition',()=>{
        if(reportDetails.registeredValuerDetails[0]) 
            return  reportDetails.registeredValuerDetails[0].registeredValuerPosition; 
        return '';
      })
      hbs.registerHelper('logo',(logo)=>{
        switch(logo){
          case 'NAVIGANT_LOGO':
            return NAVIGANT_LOGO;
        }
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

      hbs.registerHelper('registeredValuerProfile',()=>{
        if(reportDetails.registeredValuerDetails[0]?.registeredValuerProfile) 
            return  reportDetails.registeredValuerDetails[0].registeredValuerProfile; 
        return '';
      })
      hbs.registerHelper('appointingAuthorityName',()=>{
        if(reportDetails.appointeeDetails[0]) 
            return  reportDetails.appointeeDetails[0].appointingAuthorityName; 
        return '';
      })
      hbs.registerHelper('dateOfAppointment',()=>{
        if(reportDetails)
            return this.formatDate(new Date(reportDetails.appointeeDetails[0].dateOfAppointment));
        return '';
      })
      hbs.registerHelper('dateOfIncorporation',()=>{
        if(reportDetails.appointeeDetails[0])
            return this.formatDate(new Date(reportDetails.dateOfIncorporation));
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
      hbs.registerHelper('clientName',()=>{
        if(reportDetails.registeredValuerDetails[0]) 
            return  reportDetails.clientName; 
        return '';
      })
      hbs.registerHelper('location',()=>{
        if(valuationResult.inputData[0]) 
            return valuationResult.inputData[0].location; 
        return '';
      })
      hbs.registerHelper('riskFreeRate',()=>{
        if(valuationResult.inputData[0]) 
            return valuationResult.inputData[0].riskFreeRate;
        return '';
      })
      hbs.registerHelper('expMarketReturn',()=>{
        if(valuationResult.inputData[0]) 
            return valuationResult.inputData[0]?.expMarketReturn.toFixed(2);
        return '';
      })
      hbs.registerHelper('expMarketReturnType',()=>{
        const inputData = valuationResult.inputData[0];
        const expectedMarketReturnType = valuationResult.inputData[0]?.expMarketReturnType;
        if(inputData && expectedMarketReturnType !== 'Analyst_Consensus_Estimates'){
          return EXPECTED_MARKET_RETURN_HISTORICAL_TYPE[`${valuationResult.inputData[0]?.expMarketReturnType}`]?.label;
        } 
        else if(inputData && expectedMarketReturnType === 'Analyst_Consensus_Estimates'){
          return 'Analyst Consensus Estimates';
        }
        else {
          return '';
        }
      })
      hbs.registerHelper('historicalDate',()=>{
        const inputData = valuationResult.inputData[0];
        const expectedMarketReturnType = valuationResult.inputData[0]?.expMarketReturnType;
        if(inputData && expectedMarketReturnType !== 'Analyst_Consensus_Estimates') {
          return EXPECTED_MARKET_RETURN_HISTORICAL_TYPE[`${valuationResult.inputData[0]?.expMarketReturnType}`]?.historicalDate;
        }
        else if(inputData && expectedMarketReturnType === 'Analyst_Consensus_Estimates'){
          return this.formatDate(new Date(inputData.valuationDate));
        }
        else{
          return '';
        }
      })
      hbs.registerHelper('historicalBaseValue',()=>{
        const inputData = valuationResult.inputData[0];
        const expectedMarketReturnType = valuationResult.inputData[0]?.expMarketReturnType;
        if(inputData && expectedMarketReturnType !== 'Analyst_Consensus_Estimates') {
          return this.formatPositiveAndNegativeValues(EXPECTED_MARKET_RETURN_HISTORICAL_TYPE[`${valuationResult.inputData[0]?.expMarketReturnType}`]?.historicalValue);
        }
        else if(inputData && expectedMarketReturnType === 'Analyst_Consensus_Estimates'){
          return '';
        }
        else { 
          return '';
        }
      })
      hbs.registerHelper('beta',()=>{
        if(valuationResult.inputData[0]) 
            return valuationResult.inputData[0]?.beta?.toFixed(2);
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
        if(valuationResult.inputData[0]) {
            return formatPositiveAndNegativeValues(valuationResult.inputData[0].costOfEquity);
        }
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
      hbs.registerHelper('costOfDebt',()=>{
        if(valuationResult.inputData[0] && valuationResult.inputData[0].model.includes(MODEL[1])) 
            return parseFloat(valuationResult.inputData[0]?.costOfDebt)?.toFixed(2);
        return '0';
      })
      hbs.registerHelper('taxRate',()=>{
        if(valuationResult.inputData[0] ) 
            return valuationResult.inputData[0]?.taxRate;
        return '0';
      })
      hbs.registerHelper('terminalGrowthRate',()=>{
        if(valuationResult.inputData[0]) 
            return valuationResult.inputData[0]?.terminalGrowthRate;
        return '0';
      })
      hbs.registerHelper('valuePerShare',()=>{
        if(transposedData[0]?.data?.transposedResult[1])
          return valuationResult.modelResults.map((response)=>{
            if(response.model===MODEL[0] || response.model === MODEL[1]){
              const formattedNumber = Math.floor(response?.valuationData[0]?.valuePerShare).toLocaleString('en-IN');
              return `${formattedNumber.replace(/,/g, ',')}/-`;
            }
          });
          return '';
      })


      hbs.registerHelper('companyInfo',()=>{
        if(reportDetails.companyInfo){
          return `The CIN of ${valuationResult.inputData[0].company} is ${reportDetails.cinNumber}. It is incorporated on ${this.formatDate(new Date(reportDetails.dateOfIncorporation))}. `.concat(reportDetails.companyInfo);
        }
        return '';
      })

      hbs.registerHelper('modelValuePerShare',(modelName)=>{
        const ccmMetricType = allProcessStageDetails.stateInfo?.fifthStageInput?.ccmVPStype || 'average';
        const modelArray = valuationResult.inputData[0]?.model || [];
        if(modelArray?.length > 1){
          if(reportDetails?.modelWeightageValue){
            const equityValue = reportDetails.modelWeightageValue.weightedVal;
            const outstandingShares = valuationResult.inputData[0].outstandingShares;
            const finalValue = this.formatPositiveAndNegativeValues(customRound(equityValue*GET_MULTIPLIER_UNITS[`${valuationResult?.inputData[0]?.reportingUnit}`]/outstandingShares));
            // console.log(equityValue*GET_MULTIPLIER_UNITS[`${valuationResult?.inputData[0]?.reportingUnit}`]/outstandingShares,"fina value found")
            return `${finalValue}/-`
          }
        }
        else{
          let valuePerShare = '';
          valuationResult.modelResults.map((response)=>{
            // Calculate weightage for CCM
            if(
              (
                response.model === MODEL[2] || 
                response.model === MODEL[4]
              ) && 
              this.checkModelExist(MODEL[2],modelArray)
            ){
              let marketApproachValuePerShare = 0;
              response?.valuationData.valuation.map((marketApproachValuation)=>{
                if(marketApproachValuation.particular === 'result'){
                  marketApproachValuePerShare = ccmMetricType === 'average' ?  marketApproachValuation.fairValuePerShareAvg : marketApproachValuation.fairValuePerShareMed;
                }
              })
              valuePerShare =  this.formatPositiveAndNegativeValues(marketApproachValuePerShare);
            }

            // Calculate weightage for DCF
            if(
              (
                response.model === MODEL[0] || 
                response.model === MODEL[1]
              ) && 
              (
                this.checkModelExist(MODEL[0], modelArray) || 
                this.checkModelExist(MODEL[1], modelArray)
              )
            ){
              let incomeApproachValuePerShare = response?.valuationData[0]?.valuePerShare || 0;
              valuePerShare =  this.formatPositiveAndNegativeValues(incomeApproachValuePerShare);
            }
            // Calculate weightage for NAV
            if(response.model === MODEL[5] && this.checkModelExist(MODEL[5], modelArray)){
              let navApproachValuePerShare = response?.valuationData?.valuePerShare?.fairValue || 0;
              valuePerShare =  this.formatPositiveAndNegativeValues(navApproachValuePerShare);
            }

          })
          return valuePerShare;
        }
       
        return '';
      })

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
                    const formattedNumber = ccmMetricType === 'average' ?  innerValuationData.fairValuePerShareAvg : innerValuationData.fairValuePerShareMed;
                    return `${formatPositiveAndNegativeValues(bool === 'true' ? customRound(formattedNumber) : formattedNumber)}/-`;
                  });
                return innerFormatted || [];
              }
              if (response.model === models && models !== 'NAV') {
                const formattedNumber = response?.valuationData[0]?.valuePerShare;
                return `${formatPositiveAndNegativeValues(bool === 'true' ? customRound(formattedNumber) : formattedNumber)}/-`;
              }
              if (response.model === models && models === 'NAV') {
                const formattedNumber = response?.valuationData?.valuePerShare?.fairValue;
                return `${formatPositiveAndNegativeValues(bool === 'true' ? customRound(formattedNumber) : formattedNumber)}/-`;
              }
              return [];
            });
          });
          return formattedValues[0]
        }
        else {
          if(reportDetails?.modelWeightageValue){
            // const equityValue = reportDetails.modelWeightageValue.weightedVal;
            // const outstandingShares = valuationResult.inputData[0].outstandingShares;
            // const finalValue =  Math.floor(equityValue*GET_MULTIPLIER_UNITS[`${valuationResult?.inputData[0]?.reportingUnit}`]/outstandingShares).toLocaleString('en-IN'); // use muliplier
            const finalValue = formatPositiveAndNegativeValues(
              bool === 'true' ?
              customRound(reportDetails.modelWeightageValue.weightedVal) :
              reportDetails.modelWeightageValue.weightedVal
              // bool === 'true' ? 
              // customRound(equityValue*GET_MULTIPLIER_UNITS[`${valuationResult?.inputData[0]?.reportingUnit}`]/outstandingShares) : 
              // equityValue*GET_MULTIPLIER_UNITS[`${valuationResult?.inputData[0]?.reportingUnit}`]/outstandingShares
            );
            return `${finalValue}/-`
          }
        }
      })

      hbs.registerHelper('dcfValuePerShare',()=>{
        let dcfValuePerShare = '';
         valuationResult.modelResults.map((response) => {
         
          if (response.model === MODEL[0] || response.model === MODEL[1]) {
            const formattedNumber = response?.valuationData[0]?.valuePerShare;
            dcfValuePerShare = `${formatPositiveAndNegativeValues(formattedNumber)}/-`;
          }
          });
        return dcfValuePerShare;
      })

      hbs.registerHelper('ccmValuePerShare',()=>{
        const ccmMetricType = allProcessStageDetails.stateInfo?.fifthStageInput?.ccmVPStype || 'average';
        let ccmValuePerShare = '';
         valuationResult.modelResults.map((response) => {
         
          if (response.model === MODEL[2] || response.model === MODEL[4]) {
            ccmValuePerShare = response?.valuationData.valuation
                  .filter((innerValuationData) => innerValuationData.particular === 'result')
                  .map((innerValuationData) => {
                    const formattedNumber = ccmMetricType === 'average' ?  innerValuationData.fairValuePerShareAvg : innerValuationData.fairValuePerShareMed;
                    return `${formatPositiveAndNegativeValues(customRound(formattedNumber))}/-`;
                  });
          }
          });
        return ccmValuePerShare;
      })

      hbs.registerHelper('isValuePerShareNegative',(modelName)=>{
        modelName = modelName.split(',');
        let isNegativeValuePerShare = false;
             modelName.flatMap((models) => {
                valuationResult.modelResults.flatMap((response) => {
                if (response.model === models && models === 'NAV') {
                    const fairValue = response?.valuationData?.valuePerShare?.fairValue || 0;
                    const faceValue = valuationResult.inputData[0]?.faceValue || 0;
                    if(fairValue < 0){
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

      hbs.registerHelper('modelValuePerShareNumbersToWords',(modelName)=>{
        const ccmMetricType = allProcessStageDetails.stateInfo?.fifthStageInput?.ccmVPStype || 'average';
        modelName = modelName.split(',');
        if(modelName.length <= 2 ){
          let formattedValues;
            formattedValues = modelName.flatMap((models) => {
              return valuationResult.modelResults.flatMap((response) => {
                if (
                  response.model === models &&
                  (models === MODEL[2] || models === MODEL[4])
                ) {
                  const innerFormatted = response?.valuationData.valuation
                    .filter((innerValuationData) => innerValuationData.particular === 'result')
                    .map((innerValuationData) => {
                      const ccmValuePerShare = ccmMetricType === 'average' ?  innerValuationData.fairValuePerShareAvg : innerValuationData.fairValuePerShareMed;
                      const formattedNumber = Math.floor(ccmValuePerShare).toLocaleString('en-IN');
                      return `Rupees${converter.toWords(formattedNumber)} Only`;
                    });
                  return innerFormatted || [];
                }
                if (response.model === models && models !== 'NAV') {
                  const formattedNumber = Math.floor(response?.valuationData[0]?.valuePerShare).toLocaleString('en-IN');
                  return `Rupees ${converter.toWords(formattedNumber)} Only`;
                }
                if (response.model === models && models === 'NAV') {
                  const fairValue = response?.valuationData?.valuePerShare?.fairValue || 0;
                  const faceValue = valuationResult.inputData[0]?.faceValue || 0;
                  const valuePerShare = fairValue < faceValue ? faceValue : fairValue;
                  let formattedNumber = Math.floor(valuePerShare);
                  // if(`${formattedNumber}`.includes('-')){
                  //   formattedNumber = Math.floor(10).toLocaleString('en-IN');
                  // }
                  return `Rupees ${converter.toWords(formattedNumber ? (+formattedNumber)?.toFixed(2) : 0)} Only`;
                }
                return [];
              });
            });
            return formattedValues[0];
          }
          else{
            if(reportDetails?.modelWeightageValue){
              const equityValue = reportDetails.modelWeightageValue.weightedVal;
              const outstandingShares = valuationResult.inputData[0].outstandingShares;
              const finalValue =  Math.floor(equityValue*GET_MULTIPLIER_UNITS[`${valuationResult?.inputData[0]?.reportingUnit}`]/outstandingShares).toLocaleString('en-IN'); // use muliplier
              return `${finalValue.replace(/,/g, ',')}/-`
            }
          }
       
        return '';
      })
      hbs.registerHelper('equityPerShare',()=>{
        const ccmMetricType = allProcessStageDetails.stateInfo?.fifthStageInput?.ccmVPStype || 'average';

        let equityPerShare = [];
        let checkiIfStub = false;
        if(reportDetails?.modelWeightageValue && valuationResult?.modelResults?.length > 1){
          const outstandingShares = valuationResult.inputData[0].outstandingShares;
          const finalValue = this.formatPositiveAndNegativeValues(
            reportDetails.modelWeightageValue.weightedVal*outstandingShares/GET_MULTIPLIER_UNITS[`${valuationResult?.inputData[0]?.reportingUnit}`] 
          );
          // const number = this.formatPositiveAndNegativeValues(reportDetails.modelWeightageValue.weightedVal);
          return finalValue;
        }
        if(transposedData[0]?.data.transposedResult[1]){
          valuationResult.modelResults.map((response)=>{
            if(Array.isArray(response.valuationData) && response.valuationData?.some(obj => obj.hasOwnProperty('stubAdjValue'))){
              checkiIfStub=true;
            }
          if(response.model===MODEL[0] || response.model === MODEL[1]){
            equityPerShare.push(this.formatPositiveAndNegativeValues(checkiIfStub ? response.valuationData[0]?.equityValueNew : response?.valuationData[0]?.equityValue));
          }
        });
        }
        if(valuationResult.inputData[0].model.includes(MODEL[2]) && valuationResult.inputData[0].model?.length === 1){
          let marketApproachValuePerShare = 0;
          valuationResult.modelResults.map((response)=>{
            if(response.model === MODEL[2]){
              response?.valuationData.valuation.map((marketApproachValuation)=>{
                if(marketApproachValuation.particular === 'result'){
                  marketApproachValuePerShare = ccmMetricType === 'average' ?  marketApproachValuation.fairValuePerShareAvg : marketApproachValuation.fairValuePerShareMed;
                }
              })
            }
          })
          const multiplier = GET_MULTIPLIER_UNITS[`${valuationResult.inputData[0].reportingUnit}`];
          const outstandingShares = valuationResult.inputData[0]?.outstandingShares || 0;
          equityPerShare.push(this.formatPositiveAndNegativeValues(convertToNumberOrZero(marketApproachValuePerShare) *  convertToNumberOrZero(outstandingShares)/ multiplier))
        }
        if(valuationResult.inputData[0].model.includes(MODEL[5]) && valuationResult.inputData[0].model?.length === 1){
          let navApproachEquityValue = 0;
          valuationResult.modelResults.map((response)=>{
            if(response.model === MODEL[5]){
              navApproachEquityValue = response?.valuationData?.equityValue?.fairValue || 0;
            }
          })
          equityPerShare.push(this.formatPositiveAndNegativeValues(navApproachEquityValue))
        }
        return equityPerShare;
      })
      hbs.registerHelper('auditedYear',()=>{
        if(transposedData)
          return '2023';
        return '';
      })
      hbs.registerHelper('projectedYear',()=>{
        if(transposedData){
          const projYear = transposedData[0].data.transposedResult[transposedData[0].data.transposedResult?.length - 1][0];
          return `20${projYear.split('-')[1]}`;
        }
        return '_______';
      })
      hbs.registerHelper('projectionStartYear',()=>{
          if(transposedData){
            const projYear = transposedData[0].data.transposedResult[1][0];
            return `20${projYear.split('-')[1]}`;
          }
        return '2024';
      })
      hbs.registerHelper('bse500Value',()=>{
        if(valuationResult.inputData[0])
          return this.formatPositiveAndNegativeValues(valuationResult.inputData[0]?.bse500Value ? valuationResult.inputData[0]?.bse500Value : 0);
        return '-';
      })
      hbs.registerHelper('freeCashFlow',()=>{
        let freeCashFlow = []
        const terminalValueType = allProcessStageDetails.stateInfo?.fifthStageInput?.terminalValueSelectedType ||  'tvCashFlowBased';
        let boolTvCashFlowBased = terminalValueType === 'tvCashFlowBased';    //Checking for default condition
        if(boolTvCashFlowBased){
        if(transposedData[0].data.transposedResult[1]){
           valuationResult.modelResults.map((response)=>{
            if(response.model===MODEL[0] || response.model === MODEL[1]){
              freeCashFlow.push(this.formatPositiveAndNegativeValues(response?.valuationData[response.valuationData.length - 1].fcff)); // subtract (- 2) to get last year fcfe/fcff data 
            }
          });
        }
      }
        else{
          const terminalYearFreeCashFlowPatBased = terminalYearWorkings?.terminalValueWorking?.freeCashFlow || 0;
          freeCashFlow.push(this.formatPositiveAndNegativeValues(terminalYearFreeCashFlowPatBased))
        }
        return freeCashFlow;
      })
      hbs.registerHelper('terminalValue',()=>{
        let terminalVal='';
        const terminalValueType = allProcessStageDetails.stateInfo?.fifthStageInput?.terminalValueSelectedType ||  'tvCashFlowBased';
        let boolTvCashFlowBased = terminalValueType === 'tvCashFlowBased';    //Checking for default condition
        if(boolTvCashFlowBased){
        if(valuationResult.modelResults){
          valuationResult.modelResults.map((response)=>{
            if(response.model===MODEL[0] || response.model === MODEL[1]){
              terminalVal = this.formatPositiveAndNegativeValues(response.terminalYearWorking.terminalValueBasedOnLastYear);
            }
              // response?.valuationData.map((perYearData)=>{
              //   if(perYearData.particulars === 'Terminal Value'){
              //     terminalVal = this.formatPositiveAndNegativeValues(perYearData?.fcff);
              //   }
              // });
          });
          return terminalVal;
          }
        }
        else{
          terminalVal = this.formatPositiveAndNegativeValues(terminalYearWorkings?.terminalValueWorking?.terminalYearValue || 0) ;
          return terminalVal;
        }
        return terminalVal
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

      hbs.registerHelper('alphaExist',()=>{
        let alphaToggle = false;
          for (const key in valuationResult.inputData[0].alpha) {
            if (valuationResult.inputData[0].alpha[key] !== '' && valuationResult.inputData[0].alpha[key] !== '0') {
              alphaToggle = true
            }
        }
          return alphaToggle;
      })
      hbs.registerHelper('alpha',()=>{
        let outputObject = {};
        let letterIndex = 97; // this is the ascii code start
        for (const key in valuationResult.inputData[0].alpha) {
          if (valuationResult.inputData[0].alpha[key] !== '' && valuationResult.inputData[0].alpha[key] !== '0') {
            let element;
            let letter = String.fromCharCode(letterIndex);
            if (letterIndex > 97) {
              element = `<br/><span style="text-align: left;text-transform:capitalize;padding-top:1%;">${letter}. ${ALPHA[`${key}`]}</span>`;
            } else {
              element = `<span style="text-align: left;text-transform:capitalize;padding-top:1%;">${letter}. ${ALPHA[`${key}`]}</span>`;
            }
            outputObject[element] = valuationResult.inputData[0].alpha[key];
            letterIndex++;
          }
        }
        return `<p style="text-align:left;padding-top:1%;padding-left:22%;">${Object.keys(outputObject)}</p>`;
      })

      hbs.registerHelper('betaName',()=>{
        if(valuationResult.inputData[0].betaType)
          return REPORT_BETA_TYPES[`${valuationResult.inputData[0].betaType}`];
        return '';
      })
      hbs.registerHelper('postCostOfDebt',()=>{
        let costOfDebt,taxRate;
        if(valuationResult.inputData[0].model.includes(MODEL[1])){
          costOfDebt =  parseFloat(valuationResult.inputData[0]?.costOfDebt)?.toFixed(2);
          taxRate = valuationResult.inputData[0]?.taxRate.split('%')[0];
          return (((costOfDebt/100)*(1-parseFloat(taxRate)/100))*100).toFixed(2);
        } 
        return '0';
      })


      // projection result table
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

      hbs.registerHelper('capitalStructureRatio', ()=>{
        if(valuationResult.inputData[0].capitalStructureType === 'Industry_Based'){
          let debtToCapital, equityToCapital;
          if(valuationResult.inputData[0]?.formTwoData?.betaFrom !== BETA_FROM.ASWATHDAMODARAN){
            betaWorking?.betaMeanMedianWorking.map((indRatios:any)=>{        
              if(valuationResult.inputData[0]?.betaSubType === indRatios.betaType){
                debtToCapital = convertToNumberOrZero(indRatios.debtToCapital/100).toFixed(2);
                equityToCapital = convertToNumberOrZero(indRatios.equityToCapital/100).toFixed(2);
              }
            })
          }
          else{
            const deRatio = valuationResult.inputData[0]?.formTwoData?.aswathDamodaranSelectedBetaObj?.deRatio;
            if(deRatio){
              const updateDeRatio = `${deRatio}`.includes('%') ? deRatio.split('%')[0] : deRatio;
              debtToCapital = (convertToNumberOrZero(updateDeRatio)/100).toFixed(2);
              equityToCapital = 1;
            }else{
              debtToCapital = '___ ';
              equityToCapital = ' ___';
            }
          }
          return `${debtToCapital}:${equityToCapital}`;
        }
        else if(valuationResult.inputData[0].capitalStructureType === 'Target_Based'){
          const debtProp = (convertToNumberOrZero(valuationResult.inputData[0]?.capitalStructure.debtProp)/100).toFixed(2);
          const equityProp = (convertToNumberOrZero(valuationResult.inputData[0]?.capitalStructure.equityProp)/100)?.toFixed(2);
          return `${debtProp}:${equityProp}`;
        }
        else{   //This is for company based capital structure --- (needs verification)
          const debtProp = convertToNumberOrZero(getCapitalStructure.result.capitalStructure.debtProp)?.toFixed(2);
          const equityProp = convertToNumberOrZero(getCapitalStructure.result.capitalStructure.equityProp)?.toFixed(2);
          return `${debtProp}:${equityProp}`;
        }
      })

      hbs.registerHelper('capitalStructureType', ()=>{
        const capitalStructureType = getCapitalStructure.result.capitalStructure.capitalStructureType;
        if(capitalStructureType){
          return CAPITAL_STRUCTURE_TYPE[`${capitalStructureType}`];
        }
        return '';
      })

      hbs.registerHelper('explicitYear',()=>{
        let explicitYear='';
        let index;
        if(valuationResult?.modelResults){
          valuationResult.modelResults.map((result)=>{

            if( result?.model === MODEL[0] ||  result?.model === MODEL[1]){
              // result?.valuationData.map((response,i)=>{
              //   if(response.particulars === 'Terminal Value'){
              //     index = i
              //   }
              // })
              explicitYear = result.valuationData[result?.valuationData.length-1]['particulars'];
            }
          })
          explicitYear = `20${explicitYear.split('-')[1]}`
        }
        return explicitYear
      })

      hbs.registerHelper('PAT', () => {
        let arrayPAT = [];
        const terminalValueType = allProcessStageDetails.stateInfo?.fifthStageInput?.terminalValueSelectedType ||  'tvCashFlowBased';
        let boolTvCashFlowBased = terminalValueType === 'tvCashFlowBased';    //Checking for default condition
        valuationResult.modelResults.forEach((result)=>{
          if(result.model === 'FCFE'){
            const terminalYearPat = result.terminalYearWorking.pat;
            result.valuationData.map((response:any)=>{              
              const patValue = this.formatPositiveAndNegativeValues(response?.pat);
              arrayPAT.push({fcfePat:patValue});
            })
            arrayPAT.unshift({fcfePat:"PAT"});
            if(!boolTvCashFlowBased){
              arrayPAT.push({fcfePat: this.formatPositiveAndNegativeValues(terminalYearPat)});
            }
          }
          else if(result.model === 'FCFF'){
            const terminalYearPat = result.terminalYearWorking.pat;
            result.valuationData.map((response:any)=>{
              const patValue = this.formatPositiveAndNegativeValues(response?.pat);
              arrayPAT.push({fcffPat:patValue})
            })
            arrayPAT.unshift({fcffPat:"PAT"});
            if(!boolTvCashFlowBased){
              arrayPAT.push({fcffPat: this.formatPositiveAndNegativeValues(terminalYearPat)});
            }
          }
          else if(result.model === 'Excess_Earnings'){
            result.valuationData.map((response:any)=>{
              const patValue = this.formatPositiveAndNegativeValues(response?.pat);
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
              const fcffValue = this.formatPositiveAndNegativeValues(response.fcff);
              arrayfcff.push({fcff:fcffValue})
            })
            arrayfcff.unshift({fcff:"FCFF"});
            if(!boolTvCashFlowBased){
              arrayfcff.push({fcff:this.formatPositiveAndNegativeValues(terminalValueFcffBasedOnPat)});
            }else{
              arrayfcff.push({fcff:this.formatPositiveAndNegativeValues(terminalValueFcffBasedOnLastYear)});
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
              const depAndAmortisation = this.formatPositiveAndNegativeValues(response?.depAndAmortisation);
              arraydepAndAmortisation.push({fcfeDepAmortisation:depAndAmortisation})
            })
            arraydepAndAmortisation.unshift({fcfeDepAmortisation:"Depn. and Amortn."});
            if(!boolTvCashFlowBased){
              arraydepAndAmortisation.push({fcfeDepAmortisation:this.formatPositiveAndNegativeValues(terminalYearDepnAndAmortisation)});
            }
          }
          else if (result.model === 'FCFF'){
            const terminalYearDepnAndAmortisation = result.terminalYearWorking.depAndAmortisation;
            result.valuationData.map((response:any)=>{
             const depAndAmortisation = this.formatPositiveAndNegativeValues(response.depAndAmortisation)
              arraydepAndAmortisation.push({fcffDepAmortisation:depAndAmortisation})
            })
            arraydepAndAmortisation.unshift({fcffDepAmortisation:"Depn. and Amortn."});
            if(!boolTvCashFlowBased){
              arraydepAndAmortisation.push({fcffDepAmortisation:this.formatPositiveAndNegativeValues(terminalYearDepnAndAmortisation)});
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
              const addInterestAdjTaxesValue = this.formatPositiveAndNegativeValues(response?.addInterestAdjTaxes);
              arrayaddInterestAdjTaxes.push({fcfeAddInterestAdjTaxes:addInterestAdjTaxesValue})
            })
            arrayaddInterestAdjTaxes.unshift({fcfeAddInterestAdjTaxes:"Add: Interest Adjusted Taxes"});
            if(!boolTvCashFlowBased){
              arrayaddInterestAdjTaxes.push({fcfeAddInterestAdjTaxes:this.formatPositiveAndNegativeValues(terminalValueInterestAdjTax)})
            }
          }
          else if(result.model === 'FCFF'){
            const terminalValueInterestAdjTax = result.terminalYearWorking.addInterestAdjTaxes;
            result.valuationData.map((response:any)=>{
              const addInterestAdjTaxesValue = this.formatPositiveAndNegativeValues(response?.addInterestAdjTaxes);
              arrayaddInterestAdjTaxes.push({fcffAddInterestAdjTaxes:addInterestAdjTaxesValue})
            })
            arrayaddInterestAdjTaxes.unshift({fcffAddInterestAdjTaxes:"Add: Interest Adjusted Taxes"});
            if(!boolTvCashFlowBased){
              arrayaddInterestAdjTaxes.push({fcffAddInterestAdjTaxes:this.formatPositiveAndNegativeValues(terminalValueInterestAdjTax)})
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
             const nonCashItem = this.formatPositiveAndNegativeValues(response?.onCashItems)
              arrayonCashItems.push({fcfeOnCashItems:nonCashItem})
            })
            arrayonCashItems.unshift({fcfeOnCashItems:"Other Non Cash items"});
            if(!boolTvCashFlowBased){
              arrayonCashItems.push({fcfeOnCashItems:'-'})    //Purposely pushing empty object since for terminal year column non cash item is 0
            }
          }
          else if(result.model === 'FCFF'){
            result.valuationData.map((response:any)=>{
              const nonCashItem = this.formatPositiveAndNegativeValues(response?.onCashItems)

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
              const ncaValue = this.formatPositiveAndNegativeValues(response?.nca);
              arrayNca.push({fcfeNca:ncaValue})
            })
            arrayNca.unshift({fcfeNca:"Change in NCA"});
            if(!boolTvCashFlowBased){
              arrayNca.push({fcfeNca:this.formatPositiveAndNegativeValues(terminalValueNca)})
            }
          }
          else if(result.model === 'FCFF'){
            const terminalValueNca = result.terminalYearWorking.nca;
            result.valuationData.map((response:any)=>{
              const ncaValue = this.formatPositiveAndNegativeValues(response?.nca);
              arrayNca.push({fcffNca:ncaValue})
            })
            arrayNca.unshift({fcffNca:"Change in NCA"});
            if(!boolTvCashFlowBased){
              arrayNca.push({fcffNca:this.formatPositiveAndNegativeValues(terminalValueNca)})
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
              const deferredTaxValue = this.formatPositiveAndNegativeValues(response?.defferedTaxAssets);
              arraydefferedTaxAssets.push({fcfeDefferedTaxAssets:deferredTaxValue})
            })
            arraydefferedTaxAssets.unshift({fcfeDefferedTaxAssets:"Add/Less: Deferred Tax Assets(Net)"});
            if(!boolTvCashFlowBased){
              arraydefferedTaxAssets.push({fcfeDefferedTaxAssets:this.formatPositiveAndNegativeValues(terminalValueDeferredTaxAsset)});
            }
          }
          else if(result.model === 'FCFF'){
            const terminalValueDeferredTaxAsset = result.terminalYearWorking.defferedTaxAssets;
            result.valuationData.map((response:any)=>{
              const deferredTaxValue = this.formatPositiveAndNegativeValues(response?.defferedTaxAssets);
              arraydefferedTaxAssets.push({fcffDefferedTaxAssets:deferredTaxValue})
            })
            arraydefferedTaxAssets.unshift({fcffDefferedTaxAssets:"Add/Less: Deferred Tax Assets(Net)"});
            if(!boolTvCashFlowBased){
              arraydefferedTaxAssets.push({fcffDefferedTaxAssets:this.formatPositiveAndNegativeValues(terminalValueDeferredTaxAsset)});
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
              const changeInBorrowingValue = this.formatPositiveAndNegativeValues(response?.changeInBorrowings);
              arrayChangeInBorrowings.push({changeInBorrowings:changeInBorrowingValue})
            })
            arrayChangeInBorrowings.unshift({changeInBorrowings:"Change in Borrowings"});
            if(!boolTvCashFlowBased){
              arrayChangeInBorrowings.push({changeInBorrowings:this.formatPositiveAndNegativeValues(terminalValueChangeInBorrowings)});
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
              const netCashFlowValue = this.formatPositiveAndNegativeValues(response?.netCashFlow);
              arrayNetCashFlow.push({fcfeNetCashFlow:netCashFlowValue})
            })
            arrayNetCashFlow.unshift({fcfeNetCashFlow:"Net Cash Flow"});
            if(!boolTvCashFlowBased){
              arrayNetCashFlow.push({fcfeNetCashFlow:this.formatPositiveAndNegativeValues(terminalValueNetCashFlow)});
            }
          }
          if(result.model === 'FCFF'){
            const terminalValueNetCashFlow = result.terminalYearWorking.netCashFlow;
            result.valuationData.map((response:any)=>{
              const netCashFlowValue = this.formatPositiveAndNegativeValues(response?.netCashFlow);
              arrayNetCashFlow.push({fcffNetCashFlow:netCashFlowValue})
            })
            arrayNetCashFlow.unshift({fcffNetCashFlow:"Net Cash Flow"});
            if(!boolTvCashFlowBased){
              arrayNetCashFlow.push({fcffNetCashFlow:this.formatPositiveAndNegativeValues(terminalValueNetCashFlow)});
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
              const fixedAssetsValue = this.formatPositiveAndNegativeValues(response?.fixedAssets);
              arrayFixedAssets.push({fcfeFixedAssets:fixedAssetsValue})
            })
            arrayFixedAssets.unshift({fcfeFixedAssets:"Change in fixed assets"});
            if(!boolTvCashFlowBased){
              arrayFixedAssets.push({fcfeFixedAssets:this.formatPositiveAndNegativeValues(terminalValueFixedAssets)});
            }
          }
          else if(result.model === 'FCFF'){
            const terminalValueFixedAssets = result.terminalYearWorking.fixedAssets;
            result.valuationData.map((response:any)=>{
              const fixedAssetsValue = this.formatPositiveAndNegativeValues(response?.fixedAssets);
              arrayFixedAssets.push({fcffFixedAssets:fixedAssetsValue})
            })
            arrayFixedAssets.unshift({fcffFixedAssets:"Change in fixed assets"});
            if(!boolTvCashFlowBased){
              arrayFixedAssets.push({fcffFixedAssets:this.formatPositiveAndNegativeValues(terminalValueFixedAssets)});
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
              const fcffValue = this.formatPositiveAndNegativeValues(response?.fcff);
              arrayfcff.push({fcff:fcffValue})
            })
            arrayfcff.unshift({fcff:"FCFE"});
            if(!boolTvCashFlowBased){
              arrayfcff.push({fcff:this.formatPositiveAndNegativeValues(terminalValueFcffBasedOnPat)});
            }else{
              arrayfcff.push({fcff:this.formatPositiveAndNegativeValues(terminalValueFcffBasedOnLastYear)});
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
              const discountingPeriodValue = this.formatPositiveAndNegativeValues(response?.discountingPeriod);
              arrayDiscountingPeriod.push({fcfeDiscountingPeriod:discountingPeriodValue})
            })
            arrayDiscountingPeriod.unshift({fcfeDiscountingPeriod:"Discounting Period"});
            if(boolTvCashFlowBased){
              arrayDiscountingPeriod.push({fcfeDiscountingPeriod:this.formatPositiveAndNegativeValues(terminalValueDiscountingPeriod)});
            }
          }
          else if(result.model === 'FCFF'){
            const terminalValueDiscountingPeriod = result.terminalYearWorking.discountingPeriod;
            result.valuationData.map((response:any)=>{
              const discountingPeriodValue = this.formatPositiveAndNegativeValues(response?.discountingPeriod);
              arrayDiscountingPeriod.push({fcffDiscountingPeriod:discountingPeriodValue})
            })
            arrayDiscountingPeriod.unshift({fcffDiscountingPeriod:"Discounting Period"});
            if(boolTvCashFlowBased){
              arrayDiscountingPeriod.push({fcffDiscountingPeriod:this.formatPositiveAndNegativeValues(terminalValueDiscountingPeriod)});
            }
          }
          else if(result.model === 'Excess_Earnings'){
            result.valuationData.map((response:any)=>{
              const discountingPeriodValue = this.formatPositiveAndNegativeValues(response?.discountingPeriod);
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
              const discountingFactorValue = this.formatPositiveAndNegativeValues(response?.discountingFactor);
              arrayDiscountingFactor.push({fcfeDiscountingFactor:discountingFactorValue})
            })
            arrayDiscountingFactor.unshift({fcfeDiscountingFactor:"Discounting Factor"});
            if(boolTvCashFlowBased){
              arrayDiscountingFactor.push({fcfeDiscountingFactor:this.formatPositiveAndNegativeValues(terminalValueDiscountingFactor)});
            }
          }
          else if(result.model === 'FCFF'){
            const terminalValueDiscountingFactor = result.terminalYearWorking.discountingFactor;
            result.valuationData.map((response:any)=>{
              const discountingFactorValue = this.formatPositiveAndNegativeValues(response?.discountingFactor);
              arrayDiscountingFactor.push({fcffDiscountingFactor:discountingFactorValue})
            })
            arrayDiscountingFactor.unshift({fcffDiscountingFactor:"Discounting Factor"});
            if(boolTvCashFlowBased){
              arrayDiscountingFactor.push({fcffDiscountingFactor:this.formatPositiveAndNegativeValues(terminalValueDiscountingFactor)});
            }
          }
          else if(result.model === 'Excess_Earnings'){
            result.valuationData.map((response:any)=>{
              const discountingFactorValue = this.formatPositiveAndNegativeValues(response?.discountingFactor);
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
              const presentFCFFValue = this.formatPositiveAndNegativeValues(response?.presentFCFF);
              arrayPresentFCFF.push({fcfePresentFCFF:presentFCFFValue})
            })
            arrayPresentFCFF.unshift({fcfePresentFCFF:result?.model === 'FCFF' ? "Present Value of FCFF" : "Present Value of FCFE"});
            // if(!boolTvCashFlowBased){
              //   arrayPresentFCFF.push({fcfePresentFCFF:this.formatPositiveAndNegativeValues(terminalValuePresentFCFFBasedOnPat)});
              // }
              // else{
            if(boolTvCashFlowBased){
              arrayPresentFCFF.push({fcfePresentFCFF:this.formatPositiveAndNegativeValues(terminalValuePresentFCFFBasedOnLastYear)});
            }
          }
          else if(result.model === 'FCFF'){
            const terminalValuePresentFCFFBasedOnPat = terminalYearWorkings?.terminalValueWorking?.pvTerminalValue || 0;
            const terminalValuePresentFCFFBasedOnLastYear = result.terminalYearWorking.presentFCFF || 0;
            result.valuationData.map((response:any)=>{
              const presentFCFFValue = this.formatPositiveAndNegativeValues(response?.presentFCFF);
              arrayPresentFCFF.push({fcffPresentFCFF:presentFCFFValue})
            })
            arrayPresentFCFF.unshift({fcffPresentFCFF:result?.model === 'FCFF' ? "Present Value of FCFF" : "Present Value of FCFE"});
            // if(!boolTvCashFlowBased){
              //   arrayPresentFCFF.push({fcffPresentFCFF:this.formatPositiveAndNegativeValues(terminalValuePresentFCFFBasedOnPat)});
              // }
              // else{
            if(boolTvCashFlowBased){
              arrayPresentFCFF.push({fcffPresentFCFF:this.formatPositiveAndNegativeValues(terminalValuePresentFCFFBasedOnLastYear)});
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
              const debtOnDateValue = this.formatPositiveAndNegativeValues(response?.debtOnDate);
              arrayDebtOnDate.push({fcfeDebtOnDate:debtOnDateValue})
            })
            arrayDebtOnDate.unshift({fcfeDebtOnDate:"Less: Debt as on Date"});
          }
          else if(result.model === 'FCFF'){
            result.valuationData.map((response:any)=>{
              const debtOnDateValue = this.formatPositiveAndNegativeValues(response?.debtOnDate);
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
              const sumOfCashFlowsValue = this.formatPositiveAndNegativeValues(response?.sumOfCashFlows);
              arraySumOfCashFlows.push({fcfeSumOfCashFlows:sumOfCashFlowsValue})
            })
            arraySumOfCashFlows.unshift({fcfeSumOfCashFlows:"Sum of Discounted Cash Flows (Explicit Period)"});
          }
          else if(result.model === 'FCFF'){
            result.valuationData.map((response:any)=>{
              const sumOfCashFlowsValue = this.formatPositiveAndNegativeValues(response?.sumOfCashFlows);
              arraySumOfCashFlows.push({fcffSumOfCashFlows:sumOfCashFlowsValue})
            })
            arraySumOfCashFlows.unshift({fcffSumOfCashFlows:"Sum of Discounted Cash Flows (Explicit Period)"});
          }
          else if(result.model === 'Excess_Earnings'){
            result.valuationData.map((response:any)=>{
              const sumOfCashFlowsValue = this.formatPositiveAndNegativeValues(response?.sumOfCashFlows);
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
              const pvTerminalValue = this.formatPositiveAndNegativeValues(response?.pvTerminalValue);
              arrayPvTerminalValue.push({fcfePvTerminalVal:pvTerminalValue})
            })
            arrayPvTerminalValue.unshift({fcfePvTerminalVal:"Present Value of Terminal Value"});
          }
          else if(result.model === 'FCFF'){
            result.valuationData.map((response:any)=>{
              const pvTerminalValue = this.formatPositiveAndNegativeValues(response?.pvTerminalValue);
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
              const cashEquivalentsValue = this.formatPositiveAndNegativeValues(response?.cashEquivalents);
              arrayCashEquivalents.push({fcfeCashEquivalents:cashEquivalentsValue})
            })
            arrayCashEquivalents.unshift({fcfeCashEquivalents:"Add: Cash & Cash Equivalents"});
          }
          else if(result.model === 'FCFF'){
            result.valuationData.map((response:any)=>{
              const cashEquivalentsValue = this.formatPositiveAndNegativeValues(response?.cashEquivalents);
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
              const surplusAssetsValue = this.formatPositiveAndNegativeValues(response?.surplusAssets);
              arraySurplusAssets.push({fcfeSurplusAssets:surplusAssetsValue})
            })
            arraySurplusAssets.unshift({fcfeSurplusAssets:"Add: Surplus Assets/Investments"});
          }
          else if(result.model === 'FCFF'){
            result.valuationData.map((response:any)=>{
              const surplusAssetsValue = this.formatPositiveAndNegativeValues(response?.surplusAssets);
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
              const otherAdjValue = this.formatPositiveAndNegativeValues(response?.otherAdj);
              arrayOtherAdj.push({fcfeOtherAdj:otherAdjValue})
            })
            arrayOtherAdj.unshift({fcfeOtherAdj:"Add/Less: Other Adjustments(if any)"});
          }
          else if(result.model === 'FCFF'){
            result.valuationData.map((response:any)=>{
              const otherAdjValue = this.formatPositiveAndNegativeValues(response?.otherAdj);
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
              const equityValue = this.formatPositiveAndNegativeValues(response?.equityValue);
              arrayEquityValue.push({fcfeEquityValue:equityValue})
            })
            if(checkiIfStub){
              // arrayEquityValue.unshift({fcfeEquityValue:`Equity Value as on ${result.valuationData[0].particulars}`});
              arrayEquityValue.unshift({fcfeEquityValue:`Equity Value as on ${this.formatDate(new Date(valuationResult.provisionalDate))}`});
            }
            else{
              arrayEquityValue.unshift({fcfeEquityValue:`Equity Value as on ${this.formatDate(new Date(valuationResult.inputData[0].valuationDate))}`});
            }
          }
          else if(result.model === 'FCFF'){
            result.valuationData.map((response:any)=>{
              const equityValue = this.formatPositiveAndNegativeValues(response?.equityValue);
              arrayEquityValue.push({fcffEquityValue:equityValue})
            })
            if(checkiIfStub){
              // arrayEquityValue.unshift({fcffEquityValue:`Equity Value as on ${result.valuationData[0].particulars}`});
              arrayEquityValue.unshift({fcffEquityValue:`Equity Value as on ${this.formatDate(new Date(valuationResult.provisionalDate))}`});
            }
            else{
              arrayEquityValue.unshift({fcffEquityValue:`Equity Value as on ${this.formatDate(new Date(valuationResult.inputData[0].valuationDate))}`});
            }
          }
          else if(result.model === 'Excess_Earnings'){
            result.valuationData.map((response:any)=>{
              const equityValue = this.formatPositiveAndNegativeValues(response?.equityValue);
              arrayEquityValue.push({excessEarningEquityValue:equityValue})
            })
            if(checkiIfStub){
              // arrayEquityValue.unshift({excessEarningEquityValue:`Equity Value as on ${result.valuationData[0].particulars}`});
              arrayEquityValue.unshift({excessEarningEquityValue:`Equity Value as on ${this.formatDate(new Date(valuationResult.provisionalDate))}`});
            }
            else{
              arrayEquityValue.unshift({excessEarningEquityValue:`Equity Value as on ${this.formatDate(new Date(valuationResult.inputData[0].valuationDate))}`});
            }
          }
        })
        return arrayEquityValue;
      });

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

      hbs.registerHelper('checkTerminalValueType',()=>{
        const terminalValueType = allProcessStageDetails.stateInfo?.fifthStageInput?.terminalValueSelectedType ||  'tvCashFlowBased';
        let boolTvCashFlowBased = terminalValueType === 'tvCashFlowBased'; 
        return boolTvCashFlowBased;
      })
      hbs.registerHelper('displayValuationHeader',()=>{
        let modelArray = [];
      if(valuationResult.inputData[0]){
          modelArray = valuationResult.inputData[0]?.model || [];
        }
        if(!modelArray.length) return 'Model not found'
        return this.generateString(modelArray);
      })

      hbs.registerHelper('stubValue',()=>{
        let arrayStubValue = [];
        valuationResult.modelResults.forEach((result)=>{
          if(result.model === MODEL[0]){
            result.valuationData.map((response:any)=>{
              const stubAdjValue = this.formatPositiveAndNegativeValues(response?.stubAdjValue);
              arrayStubValue.push({fcfeStubAdjValue:stubAdjValue})
            })
            arrayStubValue.unshift({fcfeStubAdjValue:"Add:Stub Period Adjustment"});
          }
          else if (result.model === MODEL[1]){
            result.valuationData.map((response:any)=>{
              const stubAdjValue = this.formatPositiveAndNegativeValues(response?.stubAdjValue);
              arrayStubValue.push({fcffStubAdjValue:stubAdjValue})
            })
            arrayStubValue.unshift({fcffStubAdjValue:"Add:Stub Period Adjustment"});
          }
          else if (result.model ===MODEL[3]){
            result.valuationData.map((response:any)=>{
              const stubAdjValue = this.formatPositiveAndNegativeValues(response?.stubAdjValue);
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
              const equityValueNew = this.formatPositiveAndNegativeValues(response?.equityValueNew);
              arrayProvisionalVal.push({fcfeequityValueNew:equityValueNew})
            })
            arrayProvisionalVal.unshift({fcfeequityValueNew:`Equity Value as on ${this.formatDate(new Date(valuationResult.inputData[0].valuationDate))}`});
          }
          else if (result.model === MODEL[1]){
            result.valuationData.map((response:any)=>{
              const equityValueNew = this.formatPositiveAndNegativeValues(response?.equityValueNew);
              arrayProvisionalVal.push({fcffequityValueNew:equityValueNew})
            })
            arrayProvisionalVal.unshift({fcffequityValueNew:`Equity Value as on ${this.formatDate(new Date(valuationResult.inputData[0].valuationDate))}`});
          }
          else if (result.model ===MODEL[3]){
            result.valuationData.map((response:any)=>{
              const equityValueNew = this.formatPositiveAndNegativeValues(response?.equityValueNew);
              arrayProvisionalVal.push({excessEarnequityValueNew:equityValueNew})
            })
            arrayProvisionalVal.unshift({excessEarnequityValueNew:`Equity Value as on ${this.formatDate(new Date(valuationResult.inputData[0].valuationDate))}`});
          }
        })
        return arrayProvisionalVal;
      })
      
      hbs.registerHelper('shares', () => {
        let arrayNoOfShares = [];
        valuationResult.modelResults.forEach((result)=>{
          if(result.model === 'FCFE'){
            result.valuationData.map((response:any)=>{
              const noOfSharesValue = this.formatPositiveAndNegativeValues(response?.noOfShares);
              arrayNoOfShares.push({fcfeNoOfShares:noOfSharesValue})
            })
            arrayNoOfShares.unshift({fcfeNoOfShares:"No. of o/s Shares"});
          }
          else if(result.model === 'FCFF'){
            result.valuationData.map((response:any)=>{
              const noOfSharesValue = this.formatPositiveAndNegativeValues(response?.noOfShares);
              arrayNoOfShares.push({fcffNoOfShares:noOfSharesValue})
            })
            arrayNoOfShares.unshift({fcffNoOfShares:"No. of o/s Shares"});
          }
          else if(result.model === 'Excess_Earnings'){
            result.valuationData.map((response:any)=>{
              const noOfSharesValue = this.formatPositiveAndNegativeValues(response?.noOfShares);
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
              const valuePerShare = this.formatPositiveAndNegativeValues(response?.valuePerShare);
              arrayValuePerShare.push({fcfeValuePerShare:valuePerShare})
            })
            arrayValuePerShare.unshift({fcfeValuePerShare:`Value per Share (${valuationResult.inputData[0].currencyUnit})`});
          }
          else if(result.model === 'FCFF'){
            result.valuationData.map((response:any)=>{
              const valuePerShare = this.formatPositiveAndNegativeValues(response?.valuePerShare);
              arrayValuePerShare.push({fcffValuePerShare:valuePerShare})
            })
            arrayValuePerShare.unshift({fcffValuePerShare:`Value per Share (${valuationResult.inputData[0].currencyUnit})`});
          }
          else if(result.model === 'Excess_Earnings'){
            result.valuationData.map((response:any)=>{
              const valuePerShare = this.formatPositiveAndNegativeValues(response?.valuePerShare);
              arrayValuePerShare.push({excessEarningValuePerShare:valuePerShare})
            })
            arrayValuePerShare.unshift({excessEarningValuePerShare:`Value per Share (${valuationResult.inputData[0].currencyUnit})`});
          }
        })
        return arrayValuePerShare;
      });

      hbs.registerHelper('natureOfInstrument',()=>{
        if(reportDetails)
          return NATURE_OF_INSTRUMENT[`${reportDetails.natureOfInstrument}`];
        return '';
      })

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

        // Nav helpers
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
        //         bookValue:indNav?.bookValue === null ? null : indNav?.bookValue === 0 || indNav?.bookValue ? this.formatPositiveAndNegativeValues(indNav.bookValue) : indNav?.bookValue,
        //         fairValue:indNav?.fairValue === 0 || indNav?.fairValue ? this.formatPositiveAndNegativeValues(indNav.fairValue) : indNav.value  === 0 || indNav?.value ? this.formatPositiveAndNegativeValues(indNav.value): indNav?.value
        //       }
        //      })
        //     }
        //   })
        //   return navData;
        // })

        // hbs.registerHelper('reportSection',()=>{
        //   let outputObject = {};
        //   let letterIndex = 97; // this is the ascii code start
        //   for (const key in reportDetails.reportSection) {
        //       let element;
        //       if (letterIndex > 97) {
        //         element = ` ${reportDetails.reportSection[key]}`;
        //       } else {
        //         element = `${reportDetails.reportSection[key]}`;
        //       }
        //       outputObject[element] = key;
        //       letterIndex++;
        //   }
        //   return `${Object.keys(outputObject)}`;
        // })

        hbs.registerHelper('iterateNAVData', () => {
          let navData = [];
            valuationResult.modelResults.forEach((result)=>{
                if(result.model === MODEL[5]){
                    navData = Object.values(result.valuationData);
                }
            })
            return this.navHTMLBinding(navData);
        })
        hbs.registerHelper('reportPurpose',()=>{
          if(reportDetails?.reportPurpose){
            let purposes = [];
            for(const indReportPurpose of reportDetails.reportPurpose){
              purposes.push(`${REPORT_PURPOSE[`${indReportPurpose}`]}`)
            }
            return purposes;
          }
          return '';
        })

        hbs.registerHelper('sectionAndPurposeOfReport', ()=>{
          let storePurposeWiseSections = {}, overallSectionsWithPurposes = [];
              if(reportDetails.reportPurpose.includes('internalAssessment') && reportDetails.reportPurpose?.length === 1){
              return PURPOSE_OF_REPORT_AND_SECTION.internalAssessment;
              }
              if(!reportDetails.reportPurpose?.length || !reportDetails.reportSection?.length){
                return ['Please provide data']
              }

               //Firstly create object structure with purpose of report and sections in key-value format;
               reportDetails.reportPurpose.forEach((indpurpose, purposeIndex)=>{
                reportDetails.reportSection.forEach((indSection, sectionIndex) => {
                  if(PURPOSE_OF_REPORT_AND_SECTION[indpurpose].length){
                    if(PURPOSE_OF_REPORT_AND_SECTION[indpurpose].includes(indSection)){
                      storePurposeWiseSections[indpurpose] = storePurposeWiseSections[indpurpose] || [];
                      storePurposeWiseSections[indpurpose].push(indSection);
                    }
                  }
                });
              })

              // Use that object structure created above for looping and adding sections followed by purposes
              reportDetails.reportPurpose.forEach((indPurposeOfReport,index)=>{
               let stockedPurposes = storePurposeWiseSections[indPurposeOfReport];
                if (stockedPurposes.length <= 1) {
                  overallSectionsWithPurposes.push(stockedPurposes.join(', ') + ' of ' + REPORT_PURPOSE[indPurposeOfReport]);
                } else {
                  const lastSection = stockedPurposes[stockedPurposes.length - 1];
                  const otherSections = stockedPurposes.slice(0, -1).join(', ');
                  overallSectionsWithPurposes.push(`${otherSections} and ${lastSection}` + ' of ' + REPORT_PURPOSE[indPurposeOfReport]);
                }
              })
              overallSectionsWithPurposes[0] = `in accordance with provisions of section ${overallSectionsWithPurposes[0]}`
              return overallSectionsWithPurposes.join(' and ');
        });

        hbs.registerHelper('isInternalAssessment',()=>{
          if(reportDetails.reportPurpose.includes('internalAssessment') && reportDetails.reportPurpose?.length === 1){
            return true;
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

        hbs.registerHelper('operatorAND', (conditionOne, conditionTwo) => {
          return conditionOne && conditionTwo;
        })

        hbs.registerHelper('scopeOfWorksectionAndPurposeOfReport', ()=>{
          let storePurposeWiseSections = {}, overallSectionsWithPurposes = [];
              if(reportDetails.reportPurpose.includes('internalAssessment') && reportDetails.reportPurpose?.length === 1){
              return PURPOSE_OF_REPORT_AND_SECTION.internalAssessment;
              }
              if(!reportDetails.reportPurpose?.length || !reportDetails.reportSection?.length){
                return ['Please provide data']
              }

               //Firstly create object structure with purpose of report and sections in key-value format;
               reportDetails.reportPurpose.forEach((indpurpose, purposeIndex)=>{
                reportDetails.reportSection.forEach((indSection, sectionIndex) => {
                  if(PURPOSE_OF_REPORT_AND_SECTION[indpurpose].length){
                    if(PURPOSE_OF_REPORT_AND_SECTION[indpurpose].includes(indSection)){
                      storePurposeWiseSections[indpurpose] = storePurposeWiseSections[indpurpose] || [];
                      storePurposeWiseSections[indpurpose].push(indSection);
                    }
                  }
                });
              })
              // Use that object structure created above for looping and adding sections followed by purposes
              reportDetails.reportPurpose.forEach((indPurposeOfReport,index)=>{
               let stockedPurposes = storePurposeWiseSections[indPurposeOfReport];
                if (stockedPurposes.length <= 1) {
                  overallSectionsWithPurposes.push(stockedPurposes.join(', ') + ' of ' + REPORT_PURPOSE[indPurposeOfReport]);
                } else {
                  const lastSection = stockedPurposes[stockedPurposes.length - 1];
                  const otherSections = stockedPurposes.slice(0, -1).join(', ');
                  overallSectionsWithPurposes.push(`${otherSections} and ${lastSection}` + ' of ' + REPORT_PURPOSE[indPurposeOfReport]);
                }
              })
              overallSectionsWithPurposes[0] = `as per section ${overallSectionsWithPurposes[0]}`
              return overallSectionsWithPurposes.join(' and ');
      });

        hbs.registerHelper('modelWeightageValue',()=>{
          let dcfApproachString:any = [],netAssetValueString:any = [],marketPriceString:any = [],totalWeightage:any=[];
          if(reportDetails?.modelWeightageValue){
            reportDetails?.modelWeightageValue?.modelValue.map((data)=>{
              if(data.model === MODEL[0] || data.model === MODEL[1]){
                dcfApproachString = {
                  particulars:'Value as DCF Method',
                  weights:(data.weight * 100)?.toFixed(1),
                  weightedValue: this.formatPositiveAndNegativeValues(data.weightedValue)
                };
                totalWeightage.push(dcfApproachString);
              }
              if(data.model === MODEL[5]){
                netAssetValueString = {
                  particulars:'Value as NAV Method',
                  weights:(data.weight * 100)?.toFixed(1),
                  weightedValue: this.formatPositiveAndNegativeValues(data.weightedValue)
                };
                totalWeightage.push(netAssetValueString);
              }
              if(data.model === MODEL[2] || data.model === MODEL[4]){
                marketPriceString = {
                  particulars:'Value as CCM Method',
                  weights:(data.weight * 100)?.toFixed(1),
                  weightedValue: this.formatPositiveAndNegativeValues(data.weightedValue)
                };
                totalWeightage.push(marketPriceString);
              }
            })
          }
          return totalWeightage;
        })

        hbs.registerHelper('checkModelLength', ()=>{
          const modelArray = valuationResult.inputData[0]?.model || [];
          if(modelArray?.length > 1) return true;
          return false;
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
                      avg:this.formatPositiveAndNegativeValues(valuationDetails.pat),
                      med:this.formatPositiveAndNegativeValues(valuationDetails.pat)
                    }

                    eps = {
                      particular:'P/E Ratio of Industry',
                      avg: this.formatPositiveAndNegativeValues(valuationDetails.peRatioAvg),
                      med: this.formatPositiveAndNegativeValues(valuationDetails.peRatioMed)
                    }

                    marketPrice = {
                      particular:'Fair Value of Equity',
                      avg:this.formatPositiveAndNegativeValues(valuationDetails.peMarketPriceAvg),
                      med:this.formatPositiveAndNegativeValues(valuationDetails.peMarketPriceMed)
                    }

                    totalPeRatio.push(pat,eps,marketPrice);

                    if(muliplesArray?.length === 1){
                      outstandingShares = {
                        particular:'Outstanding Shares',
                        avg:this.formatPositiveAndNegativeValues(valuationResult.inputData[0]?.outstandingShares),
                        med:this.formatPositiveAndNegativeValues(valuationResult.inputData[0]?.outstandingShares)
                      }
                      valPerShare = {
                        particular:'Value Per Share',
                        avg:this.formatPositiveAndNegativeValues(data.valuation.finalPriceAvg),
                        med:this.formatPositiveAndNegativeValues(data.valuation.finalPriceMed)
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
                      avg:this.formatPositiveAndNegativeValues(valuationDetails.netWorthAvg),
                      med:this.formatPositiveAndNegativeValues(valuationDetails.netWorthMed)
                    }
                    pbShares = {
                      particular:'P/B Ratio of Industry',
                      avg: this.formatPositiveAndNegativeValues(valuationDetails.pbRatioAvg),
                      med: this.formatPositiveAndNegativeValues(valuationDetails.pbRatioMed)
                    }

                    equityVal = {
                      particular:'Fair Value of Equity',
                      avg:this.formatPositiveAndNegativeValues(valuationDetails.pbMarketPriceAvg),
                      med:this.formatPositiveAndNegativeValues(valuationDetails.pbMarketPriceMed)
                    }

                    totalPbRatio.push(networth,pbShares,equityVal);

                    if(muliplesArray?.length === 1){
                      outstandingShares = {
                        particular:'Outstanding Shares',
                        avg:this.formatPositiveAndNegativeValues(valuationDetails.pbSharesAvg),
                        med:this.formatPositiveAndNegativeValues(valuationDetails.pbSharesAvg)
                      }
                      valPerShare = {
                        particular:'Value Per Share',
                        avg:this.formatPositiveAndNegativeValues(data.valuation.finalPriceAvg),
                        med:this.formatPositiveAndNegativeValues(data.valuation.finalPriceMed)
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
                      avg:this.formatPositiveAndNegativeValues(valuationDetails.ebitda),
                      med:this.formatPositiveAndNegativeValues(valuationDetails.ebitda)
                    }

                    evEbitda = {
                      particular:'EV/EBITDA',
                      avg: this.formatPositiveAndNegativeValues(valuationDetails.evAvg),
                      med: this.formatPositiveAndNegativeValues(valuationDetails.evMed)
                    }

                    enterpriseVal = {
                      particular:'Enterprise Value',
                      avg:this.formatPositiveAndNegativeValues(valuationDetails.enterpriseAvg),
                      med:this.formatPositiveAndNegativeValues(valuationDetails.enterpriseMed)
                    }

                    debtVal = {
                      particular:'Less : Value of Debt',
                      avg:this.formatPositiveAndNegativeValues(valuationDetails.debtAvg),
                      med:this.formatPositiveAndNegativeValues(valuationDetails.debtMed)
                    }
                    cashEquivalent = {
                      particular:'Cash and cash equivalent',
                      avg:this.formatPositiveAndNegativeValues(valuationDetails.cashEquivalent),
                      med:this.formatPositiveAndNegativeValues(valuationDetails.cashEquivalent)
                    }
                    equityVal = {
                      particular:'Value of Equity',
                      avg:this.formatPositiveAndNegativeValues(valuationDetails.ebitdaEquityAvg),
                      med:this.formatPositiveAndNegativeValues(valuationDetails.ebitdaEquityMed)
                    }
                    totalEvEbitdaRatio.push(ebitda,evEbitda,enterpriseVal,debtVal,cashEquivalent,equityVal);

                    if(muliplesArray?.length === 1){
                      outstandingShares = {
                        particular:'Outstanding Shares',
                        avg:this.formatPositiveAndNegativeValues(valuationDetails.ebitdaSharesAvg),
                        med:this.formatPositiveAndNegativeValues(valuationDetails.ebitdaSharesAvg)
                      }
                      valPerShare = {
                        particular:'Value Per Share',
                        avg:this.formatPositiveAndNegativeValues(data.valuation.finalPriceAvg),
                        med:this.formatPositiveAndNegativeValues(data.valuation.finalPriceMed)
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

        hbs.registerHelper('priceToSalesRatioCalculation',()=>{
          let sales, psRatio, equityVal, outstandingShares, valPerShare, totalPriceToSalesRatio:any = [];
          if(valuationResult?.modelResults){
            valuationResult.modelResults.map((data)=>{
              if(data.model === MODEL[2] || data.model === MODEL[4]){
                const multiples = data.valuationData?.multiples;
                const muliplesArray = Object.values(multiples).filter((x=> x));
                data.valuationData.valuation.map((valuationDetails)=>{
                  if(valuationDetails.particular === 'sales'){
                    sales = {
                      particular:'Sales of company',
                      avg:this.formatPositiveAndNegativeValues(valuationDetails.salesAvg),
                      med:this.formatPositiveAndNegativeValues(valuationDetails.salesMed)
                    }

                    psRatio = {
                      particular:'P/S Ratio',
                      avg: this.formatPositiveAndNegativeValues(valuationDetails.salesRatioAvg),
                      med: this.formatPositiveAndNegativeValues(valuationDetails.salesRatioMed)
                    }

                    equityVal = {
                      particular:'Value of Equity',
                      avg:this.formatPositiveAndNegativeValues(valuationDetails.salesEquityAvg),
                      med:this.formatPositiveAndNegativeValues(valuationDetails.salesEquityMed)
                    }

                    totalPriceToSalesRatio.push(sales,psRatio,equityVal);
                    
                    if(muliplesArray?.length === 1){
                      outstandingShares = {
                        particular:'Outstanding Shares',
                        avg:this.formatPositiveAndNegativeValues(valuationDetails.salesSharesAvg),
                        med:this.formatPositiveAndNegativeValues(valuationDetails.salesSharesAvg)
                      }
                      valPerShare = {
                        particular:'Value Per Share',
                        avg:this.formatPositiveAndNegativeValues(data.valuation.finalPriceAvg),
                        med:this.formatPositiveAndNegativeValues(data.valuation.finalPriceMed)
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

        hbs.registerHelper('containsPbAndPeSelection',()=>{
          let selection = false;
          if(valuationResult?.modelResults){
            valuationResult.modelResults.map((data)=>{
              if(data.model === MODEL[2]){
                const multiples = data.valuationData?.multiples || [];
                const muliplesArray = Object.values(multiples).filter((x=> x));
                if(!multiples || (multiples?.pbSelection || multiples?.peSelection)){
                  selection = true;
                }
              }
            })
          }
          return selection;
        })

        hbs.registerHelper('loadMultipleLabel',(value)=>{
          let multiples, selectedMultiples = [], associatedMuliplesArray = [];
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
                    associatedMuliplesArray.push(...multipleStruc.associatedLabel);
                }
              })
            })
          }
          else{
            // If multiples does not exist, take all the default multiples from array
            MULTIPLES_TYPE.map((multipleStru)=>{
               selectedMultiples.push(multipleStru.label);
                associatedMuliplesArray.push(...multipleStru.associatedLabel);
             }
            );
          }

          /** 
           * Two point approach to remove duplicacy
          */
          if(associatedMuliplesArray.length > 1){
            let sanitisedArray = [];
            let leftPointer = 0;
            let rightPointer = associatedMuliplesArray.length - 1;

            while (leftPointer <= rightPointer) {
              const element = associatedMuliplesArray[leftPointer];
              if (!sanitisedArray.includes(element)) {
                  sanitisedArray.push(element);
              }
              leftPointer++;
            }
            associatedMuliplesArray = sanitisedArray;
          }

          selectedMultiples = associatedMuliplesArray.concat(selectedMultiples)
          let str = ``;
          for (let i = 0; i < selectedMultiples.length; i ++){
            // In this add 6 because we want to start indexing after 6th
            str +=`<li>
            <p
                style="padding-left: 20pt;line-height: ${value === 'addLh' ? '190%' : '15pt'};text-align: left;">
               ${i + 1}. ${selectedMultiples[i]}
               </p>
            </li>
          `
          }
          return str;
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

        hbs.registerHelper('addSerialNo', (value) => {
          const [reportMultiple, reportDefaultIndex] = value.split(',');
          const { multiples, selectedMultiples } = this.getSelectedMultiples(valuationResult);
          const ccmValuationLength = valuationResult?.modelResults?.find(data => data.model === MODEL[2])?.valuationData?.valuation?.length;
          const serialNo = this.calculateSerialNo(reportMultiple, reportDefaultIndex, multiples, selectedMultiples, ccmValuationLength);
          return serialNo || 3;
        });
      
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
                      fairValOfEquity:this.formatPositiveAndNegativeValues(salesEquity), // only for calculating average
                      weights:`${totalAverage ? totalAverage : 25}%`,
                      weightedVal:this.formatPositiveAndNegativeValues(((totalAverage ? totalAverage : 25) * (salesEquity))/100),  //only for calculating average
                    }
                    sumOfWeightedValue += ((totalAverage ? totalAverage : 25) * (salesEquity))/100;
                    totalWeightedAvgValuePrShare.push(evSales);
                  }
                  if(valuationDetails.particular === 'ebitda' && (!multiples ? true : multiples?.evEbitdaSelection)){
                    const evEbitdaVal = ccmMetricType === 'average' ? valuationDetails.ebitdaEquityAvg : valuationDetails.ebitdaEquityMed;
                    evEbitda = {
                      particular:'Value as per EV/EBITDA',
                      fairValOfEquity: this.formatPositiveAndNegativeValues(evEbitdaVal), //only for calculating average
                      weights:`${totalAverage ? totalAverage : 25}%`,
                      weightedVal:this.formatPositiveAndNegativeValues(((totalAverage ? totalAverage : 25) * (evEbitdaVal))/100) //only for calculating average
                    }
                    
                    sumOfWeightedValue += ((totalAverage ? totalAverage : 25) * (evEbitdaVal))/100;
                    totalWeightedAvgValuePrShare.push(evEbitda);
                  }
                  
                  if(valuationDetails.particular === 'pbRatio' && (!multiples ? true : multiples?.pbSelection)){
                    const pbRatioVal = ccmMetricType === 'average' ? valuationDetails.pbMarketPriceAvg : valuationDetails.pbMarketPriceMed;
                    priceToBookValue = {
                      particular:'Value as per P/BV',
                      fairValOfEquity:this.formatPositiveAndNegativeValues(pbRatioVal), //only for calculating average
                      weights:`${totalAverage ? totalAverage : 25}%`,
                      weightedVal:this.formatPositiveAndNegativeValues(((totalAverage ? totalAverage : 25) * (pbRatioVal))/100) //only for calculating average
                    }
                    sumOfWeightedValue += ((totalAverage ? totalAverage : 25) * (pbRatioVal))/100;
                    totalWeightedAvgValuePrShare.push(priceToBookValue);
                  }
                  
                  if(valuationDetails.particular === 'peRatio' && (!multiples ? true : multiples?.peSelection)){
                    const peSelectionVal = ccmMetricType === 'average' ? valuationDetails.peMarketPriceAvg : valuationDetails.peMarketPriceMed;
                    priceToEarnings = {
                      particular:'Value as per P/E',
                      fairValOfEquity:this.formatPositiveAndNegativeValues(peSelectionVal), //only for calculating average
                      weights:`${totalAverage ? totalAverage : 25}%`,
                      weightedVal:this.formatPositiveAndNegativeValues(((totalAverage ? totalAverage : 25) * (peSelectionVal))/100) //only for calculating average
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
                      weightedVal: this.formatPositiveAndNegativeValues(equityVal) //selected fair value of equity for average calculation
                    }
                   
                    outstandingShares = {
                      particular:`No. of outstanding shares`,
                      fairValOfEquity:'', //selected fair value of equity for average calculation
                      weights:'',
                      weightedVal: this.formatPositiveAndNegativeValues(valuationResult.inputData[0].outstandingShares) //selected fair value of equity for average calculation
                    }
                  }

                })
              }
            })
            total = {
              particular:`Total weighted average`,
              fairValOfEquity:'', 
              weights:'',
              weightedVal: this.formatPositiveAndNegativeValues(sumOfWeightedValue)
            }
            totalWeightedAvgValuePrShare.push(total,outstandingShares,avgValuePerShare);
          }
          return totalWeightedAvgValuePrShare;
        })

        hbs.registerHelper('checkPreferenceRatio',()=>{
          if( valuationResult.inputData[0].preferenceRatioSelect === RELATIVE_PREFERENCE_RATIO[1])
            return true;
          return false;
        })

        hbs.registerHelper('ccmVPSMetricCheck', (requestedType)=>{
          const ccmMetricType = allProcessStageDetails.stateInfo?.fifthStageInput?.ccmVPStype || 'average';
            if(ccmMetricType){
              if(ccmMetricType === requestedType) return true;
              return false;
            }
            return false;
        })

        hbs.registerHelper('navCurrencyAndReportingUnit',()=>{
          if(valuationResult?.inputData[0]?.reportingUnit === 'absolute'){
            return `Amount (${valuationResult?.inputData[0]?.currencyUnit})`
          }
          else{
            return `(${valuationResult?.inputData[0]?.currencyUnit} in ${valuationResult?.inputData[0]?.reportingUnit})`
          }
        })

        hbs.registerHelper('industryName',()=>{
          if(valuationResult.inputData[0].industry)
            return valuationResult.inputData[0].industry;
          return '';
        })

        hbs.registerHelper('numberOfSubindustry',()=>{
          if(valuationResult.inputData[0].companies)
            return valuationResult.inputData[0].companies?.length
          return 0
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

      hbs.registerHelper('isNumber',(value)=>{
        if(isNaN(value) === false)
          return true;
        return false;
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

    hbs.registerHelper('ifMB01',()=>{
      if(roles?.length)
          return roles.some(indRole => indRole?.name === userRoles.merchantBanker);
      return false;
    })

    hbs.registerHelper('sectionAsPerIncomeTaxAndFema',()=>{
      if(reportDetails.reportPurpose){
        const section = reportDetails.reportSection || [];
        if(section.includes('56(2)(viib) - Issue of Shares by a Closely Held Company to residents')){
          return 'proposed issuance'
        }
        else{
          return 'transfer';
        }
      }
    })

    hbs.registerHelper('MBSectionsAndPurpose', ()=>{
      let storePurposeWiseSections = {}, overallSectionsWithPurposes = [];
      if(reportDetails.reportPurpose.includes('internalAssessment') && reportDetails.reportPurpose?.length === 1){
        return PURPOSE_OF_REPORT_AND_SECTION.internalAssessment;
        }
          if(!reportDetails.reportPurpose?.length || !reportDetails.reportSection?.length){
            return ['Please provide data']
          }

           //Firstly create object structure with purpose of report and sections in key-value format;
           reportDetails.reportPurpose.forEach((indpurpose, purposeIndex)=>{
                 
                 MB01_PURPOSE_OF_REPORT_AND_SECTION.forEach((sectionStructure)=>{
                   if(sectionStructure?.purposeOfReport === indpurpose){
                    sectionStructure.options.forEach((indSectionStructure)=>{
                      reportDetails.reportSection.forEach((indSection, sectionIndex) => {
                        if(indSection === indSectionStructure.section){
                          storePurposeWiseSections[indpurpose] = storePurposeWiseSections[indpurpose] || [];
                          storePurposeWiseSections[indpurpose].push(indSectionStructure.alias);
                        }
                    })
                    })
                }
            });
          })

          // Use that object structure created above for looping and adding sections followed by purposes
          reportDetails.reportPurpose.forEach((indPurposeOfReport,index)=>{
           let stockedPurposes = storePurposeWiseSections[indPurposeOfReport];
            if (stockedPurposes?.length <= 1) {
              overallSectionsWithPurposes.push(stockedPurposes.join(', ') + ' ' + MB01_REPORT_PURPOSE[indPurposeOfReport]);
            } else {
              const lastSection = stockedPurposes[stockedPurposes?.length - 1];
              const otherSections = stockedPurposes.slice(0, -1).join(', ');
              overallSectionsWithPurposes.push(`${otherSections} and ${lastSection}` + ' ' + MB01_REPORT_PURPOSE[indPurposeOfReport]);
              }
          })
          overallSectionsWithPurposes[0] = `in accordance with ${overallSectionsWithPurposes[0]}`
          return overallSectionsWithPurposes.join(' and ');
  });

    hbs.registerHelper('checkIfValuePerShare',(particular,stringToCheck)=>{
      if(stringToCheck === 'Value per Share' && particular.includes('Value per Share')){
        return true;
      }
      return false;
    })
    hbs.registerHelper('dcfModel',()=>{
      if(valuationResult.inputData[0] && (valuationResult.inputData[0]?.model.includes(MODEL[0]) || valuationResult.inputData[0]?.model.includes(MODEL[1]))){
        return true;
      }
      return false;
    })
    hbs.registerHelper('modelArrayLessThanTwo',()=>{
      if(valuationResult.inputData[0] && valuationResult.inputData[0].model?.length <= 2){
        return true;
      }
      return false;
    })
    hbs.registerHelper('checkIfTotalOrOutstandingShares',(particular,stringToCheck)=>{
      if(stringToCheck === 'Total weighted average' && particular.includes('Total weighted average') || stringToCheck === 'No. of outstanding shares' && particular.includes('No. of outstanding shares')){
        return true;
      }
      return false;
    })

    // hbs.registerHelper('isSection165',()=>{
    //   if(reportDetails.reportSection.includes(`165 - SEBI (Issue of Capital and Disclosure Requirements) Regulations, 2018`) && reportDetails.reportSection.length === 1){
    //     return true;
    //   }
    //   return false;
    // })

    hbs.registerHelper('calculateColspan',()=>{
      let colspan;
      valuationResult.modelResults.map((response)=>{
        if(response.model === MODEL[0] || response.model === MODEL[1]){
          colspan = response?.valuationData.length + 1;     //Adding one here since we remove terminal year working from the valuation array, and re-add in the above helper somewhere at the top
        }
      })
      return colspan + 1;  //add one since column starts from particulars
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

    hbs.registerHelper('marketApproachHeaderCheck',(value)=>{
      if(value === 'Value of Equity' || value === 'Enterprise Value' || value === 'Fair Value of Equity' || value === 'Value Per Share'){
        return true;
      }
      return false;
    })
    
    hbs.registerHelper('hasBetaWorking',()=>{
      const betaFrom = valuationResult.inputData[0].formTwoData?.betaFrom || BETA_FROM.CAPITALIQ;
      if(
        betaFrom !== BETA_FROM.ASWATHDAMODARAN && 
        (
          valuationResult.inputData[0].betaType === BETA_TYPE[0] || 
          valuationResult.inputData[0].betaType === BETA_TYPE[1]
        )
      ){
        return true;
      }
      return false;
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
    hbs.registerHelper('betaAdIndustryName',()=>{
      const betaIndustryAd = valuationResult.inputData[0].formTwoData?.industryAD;
      if(
        betaIndustryAd
      ){
        return betaIndustryAd;
      }
      return '';
    })

    hbs.registerHelper('coreBetaWorking',()=>{
      return betaWorking?.coreBetaWorking;
    })

    hbs.registerHelper('betaMeanMedianWorking',()=>{
      return betaWorking?.betaMeanMedianWorking;
    })

    hbs.registerHelper('hasLeveredBeta',()=>{
      return betaWorking?.coreBetaWorking.some((item:any) => item.leveredBeta !== undefined);
    })

    hbs.registerHelper('updateBetaType',(val)=>{
      if (val === BETA_SUB_TYPE[0]) {
        return 'Average';
      }
      else if(val === BETA_SUB_TYPE[1]) {
        return 'Median';
      }
      return '-';
    })

    hbs.registerHelper('auditedfinancialBasis',()=>{
      if(valuationResult.inputData[0].financialBasis === FINANCIAL_BASIS_TYPE[0]){
        return true;
      }
      return false;
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
    
    }
     
     catch(error){
      return {
        msg:'error in helper',
        error:error.message,
        status:false
      }
     }
    }

    formatDate(date: Date): string {
      const months = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
      ];
  
      const day = date.getDate();
      const month = months[date.getMonth()];
      const year = date.getFullYear();
  
      return `${month} ${day}, ${year}`;
    }

    async pushUpdatedReportIntoS3(formData){
      try{
        const uploadDir = path.join(process.cwd(),'pdf');

        const filePath = path.join(uploadDir, formData.filename);
        let file = fs.readFileSync(filePath).toString('base64');
        return await this.thirdpartyApiAggregateService.upsertReportInS3(file,formData.filename);
      }
      catch(error){
        return {
          error:error,
          msg:'uploading report in s3 failed',
          status : false
        }
      }
    }

  formatPositiveAndNegativeValues(value) {
    const epsilonThreshold = 0.00001;
  
    if (value !== undefined && value !== null && value !== '' &&  Math.abs(value) < epsilonThreshold) {
      return '-';
    }
  
    let formattedValue = '';
  
    if (value !== null && value !== undefined && value !== '') {
      formattedValue = Math.abs(value) < 0.005 ? '0.00' : `${Math.abs(value).toFixed(2)}`;
      formattedValue = Number(formattedValue).toLocaleString('en-IN');
    }
  
    return value < 0 ? `(${formattedValue})` : formattedValue;
  }

  loadElevenUaHelpers(elevenUaData,reportDetails){
    hbs.registerHelper('generatedOn',(txt,val)=>{
      console.log(elevenUaData,"eleven ua data")
      if(elevenUaData?.data?.createdAt)
        return new Date(elevenUaData?.data?.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
      return '';
    })
    
    hbs.registerHelper('companyName',()=>{
      if(elevenUaData)
        return elevenUaData.data?.inputData?.company;
      return ''
    })

    hbs.registerHelper('strdate',()=>{
      if(elevenUaData)
        return this.formatDate(new Date(elevenUaData?.data?.inputData?.valuationDate));
      return '';
    })

    hbs.registerHelper('currencyUnit',()=>{
      if(elevenUaData)
        return elevenUaData.data?.inputData?.currencyUnit;
      return 'INR';
    })

    hbs.registerHelper('valuePerShareAndCurrencyElevenUa',()=>{
      if(elevenUaData?.data?.computations?.valuePerShare && !`${elevenUaData?.data?.computations?.valuePerShare}`.includes('-'))
        return `${elevenUaData.data?.inputData?.currencyUnit} ${this.formatPositiveAndNegativeValues(elevenUaData?.data?.computations?.valuePerShare)}`;
      return 'NIL';
    })


    hbs.registerHelper('reportingUnit',()=>{
      if(elevenUaData)
        return elevenUaData.data?.inputData?.reportingUnit === REPORTING_UNIT.ABSOLUTE ? '' : elevenUaData.data?.inputData?.reportingUnit;
      return 'Lakhs';
    })

    hbs.registerHelper('companyInfo',()=>{
      if(reportDetails.companyInfo){
        return reportDetails.companyInfo;
      }
      return '';
    })

    hbs.registerHelper('bookValueOfAllAssets',()=>{
      if(elevenUaData)
        return elevenUaData.data?.bookValueOfAllAssets ? this.formatPositiveAndNegativeValues(elevenUaData.data?.bookValueOfAllAssets) : '-';
      return '-';
    })

    hbs.registerHelper('bookValueOfAllAssets',()=>{
      if(elevenUaData)
        return elevenUaData.data?.bookValueOfAllAssets ? this.formatPositiveAndNegativeValues(elevenUaData.data?.bookValueOfAllAssets) : '-';
      return '-';
    })

    hbs.registerHelper('totalIncomeTaxPaid',()=>{
      if(elevenUaData)
        return elevenUaData.data?.totalIncomeTaxPaid ? this.formatPositiveAndNegativeValues(elevenUaData.data?.totalIncomeTaxPaid) : '-';
      return '-';
    })

    hbs.registerHelper('unamortisedAmountOfDeferredExpenditure',()=>{
      if(elevenUaData)
        return elevenUaData.data?.unamortisedAmountOfDeferredExpenditure ? this.formatPositiveAndNegativeValues(elevenUaData.data?.unamortisedAmountOfDeferredExpenditure) : '-';
      return '-';
    })

    hbs.registerHelper('totalA',()=>{
      if(elevenUaData){
      //   const totalIncomeTaxPaid = elevenUaData?.data?.totalIncomeTaxPaid;
      // const unamortisedAmountOfDeferredExpenditure = elevenUaData?.data?.unamortisedAmountOfDeferredExpenditure;
      // this.totalA = elevenUaData?.data?.bookValueOfAllAssets - (totalIncomeTaxPaid + unamortisedAmountOfDeferredExpenditure);
      // return this.formatPositiveAndNegativeValues(elevenUaData?.data?.bookValueOfAllAssets - (totalIncomeTaxPaid + unamortisedAmountOfDeferredExpenditure));
      return elevenUaData?.data?.computations?.calculationAtA ? this.formatPositiveAndNegativeValues(elevenUaData?.data?.computations?.calculationAtA) : '-';
      }
      return '-';
    })

    hbs.registerHelper('jewlleryAndArtisticWork',()=>{
      // let jewlleryAndArtisticWork = [];
      if(elevenUaData){
        // const jewellery = elevenUaData.data?.inputData?.fairValueJewellery;
        // const artisticWork = elevenUaData.data?.inputData?.fairValueArtistic;
        // const jewelleryAndArtisticWorkArray = [
        //   {
        //     name:"Jewellery",
        //     value:jewellery
        //   },
        //   {
        //     name:"Artistic Work",
        //     value:artisticWork
        //   }
        // ]
        
        // for(let i = 0; i <= jewelleryAndArtisticWorkArray.length; i++){
        //   if(jewelleryAndArtisticWorkArray[i]?.name){
        //       const romanNumeral = convertToRomanNumeral(i);
        //       const obj = {
        //         index:romanNumeral,
        //         label:jewelleryAndArtisticWorkArray[i]?.name,
        //         value:jewelleryAndArtisticWorkArray[i]?.value ? this.formatPositiveAndNegativeValues(jewelleryAndArtisticWorkArray[i].value) : '-' 
        //       }
        //       jewlleryAndArtisticWork.push(obj);
        //     }
        //   }
        //   return jewlleryAndArtisticWork;
        return elevenUaData?.data?.computations?.jewelleryOrArtisticArray;
      }
    })

    hbs.registerHelper('totalB',()=>{
      if(elevenUaData){
        // const jewellery = !isNaN(parseFloat(elevenUaData.data?.inputData?.fairValueJewellery)) ? parseFloat(elevenUaData.data?.inputData?.fairValueJewellery) : 0;
        // const artisticWork =!isNaN(parseFloat(elevenUaData.data?.inputData?.fairValueArtistic)) ? parseFloat(elevenUaData.data?.inputData?.fairValueArtistic) : 0;
        // const totalValue = jewellery + artisticWork;
        // this.totalB = totalValue ? totalValue : 0;
        // return totalValue ? this.formatPositiveAndNegativeValues(totalValue) : '-';
        return elevenUaData.data?.computations?.calculationAtB ? this.formatPositiveAndNegativeValues(elevenUaData.data?.computations?.calculationAtB) : '-';
      }
      return '-';
    })

    hbs.registerHelper('fairValueinvstShareSec',()=>{
      if(elevenUaData){
        // let investment=0;
        // const investmentTotalFromExcel = elevenUaData?.data?.totalInvestmentSharesAndSecurities;
        // const elevenUaInvestment = elevenUaData.data?.inputData?.fairValueinvstShareSec;
        // investment = elevenUaInvestment;
        // if(!elevenUaInvestment){
        //   investment =  investmentTotalFromExcel;
        // }
        // this.totalC = investment;
        // return investment ? this.formatPositiveAndNegativeValues(investment) : '-';
        return elevenUaData.data?.computations?.calculationAtC ? this.formatPositiveAndNegativeValues(elevenUaData.data?.computations?.calculationAtC) : '-';
      }
      return '-'
    })

    hbs.registerHelper('hasFairValueinvstShareSec',()=>{
      if(elevenUaData){
        // let investment=0;
        // const investmentTotalFromExcel = elevenUaData?.data?.totalInvestmentSharesAndSecurities;
        // const elevenUaInvestment = elevenUaData.data?.inputData?.fairValueinvstShareSec;
        // investment = elevenUaInvestment;
        // if(!elevenUaInvestment){
        //   investment =  investmentTotalFromExcel;
        // }
        // this.totalC = investment;
        // if(convertToNumberOrZero(investment)){
        //   return true
        // } 
        // else {
        //  return false;
        // }
        if(convertToNumberOrZero(elevenUaData.data?.computations?.calculationAtC)){
          return true
        } 
        else {
         return false;
        }
      }
    })

    hbs.registerHelper('totalC',()=>{
      if(elevenUaData){
        // let investment=0;
        // const investmentTotalFromExcel = elevenUaData?.data?.totalInvestmentSharesAndSecurities;
        // const elevenUaInvestment = elevenUaData.data?.inputData?.fairValueinvstShareSec;
        // investment = elevenUaInvestment;
        // if(!elevenUaInvestment){
        //   investment =  investmentTotalFromExcel;
        // }
        // this.totalC = investment;
        // return investment ? this.formatPositiveAndNegativeValues(investment) : '-';
        return elevenUaData.data?.computations?.calculationAtC ? this.formatPositiveAndNegativeValues(elevenUaData.data?.computations?.calculationAtC) : '-';
      }
      return '-'
    })

    hbs.registerHelper('fairValueImmovableProp',()=>{
      if(elevenUaData)
        // return elevenUaData.data?.inputData?.fairValueImmovableProp ? this.formatPositiveAndNegativeValues(elevenUaData.data?.inputData?.fairValueImmovableProp) : '-';
        return elevenUaData.data?.computations?.calculationAtD ? this.formatPositiveAndNegativeValues(elevenUaData.data?.computations?.calculationAtD) : '-';
      return '-'
    })
    hbs.registerHelper('hasFairValueImmovableProp',()=>{
      if(elevenUaData){
        if(convertToNumberOrZero(elevenUaData.data?.computations?.calculationAtD)){
          return true
        } 
        else {
         return false;
        }
      }
    })
    hbs.registerHelper('hasEitherImmovableOrInvstShare',()=>{
      if(elevenUaData){
        if(convertToNumberOrZero(elevenUaData.data?.computations?.calculationAtD) || convertToNumberOrZero(elevenUaData.data?.computations?.calculationAtC)){
          return true
        } 
        else {
         return false;
        }
      }
    })
    
    
    hbs.registerHelper('totalD',()=>{
      if(elevenUaData){
        // this.totalD = elevenUaData.data?.inputData?.fairValueImmovableProp ? parseFloat(elevenUaData.data?.inputData?.fairValueImmovableProp) : 0 
        // return elevenUaData.data?.inputData?.fairValueImmovableProp ? this.formatPositiveAndNegativeValues(elevenUaData.data?.inputData?.fairValueImmovableProp) : '-';
        return elevenUaData.data?.computations?.calculationAtD ? this.formatPositiveAndNegativeValues(elevenUaData.data?.computations?.calculationAtD) : '-';
      }
    return '-'
    })

    hbs.registerHelper('bookValueOfLiabilities',()=>{
      if(elevenUaData)
        return elevenUaData?.data?.bookValueOfLiabilities ? this.formatPositiveAndNegativeValues(elevenUaData?.data?.bookValueOfLiabilities) : '-';
      return '-'
    })

    hbs.registerHelper('paidUpCapital',()=>{
      if(elevenUaData)
        return elevenUaData?.data?.paidUpCapital ? this.formatPositiveAndNegativeValues(elevenUaData?.data?.paidUpCapital) : '-';
      return '-'
    })

    hbs.registerHelper('isTransferOfShares',()=>{
      if(elevenUaData)
        return elevenUaData?.data?.inputData?.issuanceOfShares ? false : true;
      return false;
    })

    hbs.registerHelper('paymentDividends',()=>{
      if(elevenUaData)
        return elevenUaData?.data?.paymentDividends ? this.formatPositiveAndNegativeValues(elevenUaData?.data?.paymentDividends) : '-';
      return '-'
    })

    hbs.registerHelper('reserveAndSurplus',()=>{
      if(elevenUaData)
        return elevenUaData?.data?.reserveAndSurplus ? this.formatPositiveAndNegativeValues(elevenUaData?.data?.reserveAndSurplus) : '-';
      return '-'
    })

    hbs.registerHelper('provisionForTaxation',()=>{
      if(elevenUaData)
        return elevenUaData?.data?.provisionForTaxation ? this.formatPositiveAndNegativeValues(elevenUaData?.data?.provisionForTaxation) : '-';
      return '-'
    })

    hbs.registerHelper('otherThanAscertainLiability',()=>{
      if(elevenUaData)
        return elevenUaData?.data?.inputData?.otherThanAscertainLiability ? this.formatPositiveAndNegativeValues(elevenUaData?.data?.inputData?.otherThanAscertainLiability) : '-';
      return '-'
    })

    hbs.registerHelper('contingentLiability',()=>{
      if(elevenUaData)
        return elevenUaData?.data?.inputData?.contingentLiability ? this.formatPositiveAndNegativeValues(elevenUaData?.data?.inputData?.contingentLiability) : '-';
      return '-'
    })
    hbs.registerHelper('totalL',()=>{
      if(elevenUaData){
          // const paidUpCapital = elevenUaData.data?.paidUpCapital;
          // const paymentDividends = elevenUaData.data?.paymentDividends;
          // const reservAndSurplus = elevenUaData.data?.reserveAndSurplus;
          // const provisionForTaxation = elevenUaData.data?.provisionForTaxation;
          // // const contingentLiabilities = isNaN(parseFloat(elevenUaData.data?.inputData?.contingentLiability)) ? 0 : parseFloat(elevenUaData.data?.inputData?.contingentLiability);
          // // const otherThanAscertainLiability = isNaN(parseFloat(elevenUaData.data?.inputData?.otherThanAscertainLiability)) ? 0 : parseFloat(elevenUaData.data?.inputData?.otherThanAscertainLiability);
          // this.totalL = convertToNumberOrZero(elevenUaData?.data?.bookValueOfLiabilities) - (convertToNumberOrZero(paidUpCapital) + convertToNumberOrZero(paymentDividends) + convertToNumberOrZero(reservAndSurplus) + convertToNumberOrZero(provisionForTaxation) + convertToNumberOrZero(elevenUaData.data?.inputData?.contingentLiability) + convertToNumberOrZero(elevenUaData.data?.inputData?.otherThanAscertainLiability));
          // return this.formatPositiveAndNegativeValues(
          //   (
          //     convertToNumberOrZero(elevenUaData?.data?.bookValueOfLiabilities) -  
          //   (
          //     convertToNumberOrZero(paidUpCapital) + 
          //     convertToNumberOrZero(paymentDividends) + 
          //     convertToNumberOrZero(reservAndSurplus) + 
          //     convertToNumberOrZero(provisionForTaxation) + 
          //     convertToNumberOrZero(elevenUaData.data?.inputData?.contingentLiability) + 
          //     convertToNumberOrZero(elevenUaData.data?.inputData?.otherThanAscertainLiability)
          //   )
          //   )
          // );
          return elevenUaData?.data?.computations?.calculationAtL ? this.formatPositiveAndNegativeValues(elevenUaData?.data?.computations?.calculationAtL) : '-';
      }
      return '-'
    })

    hbs.registerHelper('calculateAll',()=>{
      // return this.formatPositiveAndNegativeValues(
      //   (convertToNumberOrZero(this.totalA) + convertToNumberOrZero(this.totalB) + convertToNumberOrZero(this.totalC) + convertToNumberOrZero(this.totalD) - convertToNumberOrZero(this.totalL))
      // );
      return elevenUaData?.data?.computations?.totalCalculation ? this.formatPositiveAndNegativeValues(elevenUaData?.data?.computations?.totalCalculation) : '-';
    })

    hbs.registerHelper('phaseValue',()=>{
      if(elevenUaData){
        return elevenUaData?.data?.inputData?.faceValue ? this.formatPositiveAndNegativeValues(elevenUaData?.data?.inputData?.faceValue) : '-';
      }
      return '-';
    })

    hbs.registerHelper('unquotedEquityShare',()=>{
      // const phaseValue = !isNaN(parseFloat(elevenUaData?.data?.inputData?.phaseValue)) ? parseFloat(elevenUaData?.data?.inputData?.phaseValue) : 1;
      // const paidUpCapital = !isNaN(parseFloat(elevenUaData?.data?.paidUpCapital)) ? parseFloat(elevenUaData?.data?.paidUpCapital) : 1;

      // const totalSum = convertToNumberOrZero(this.totalA) + convertToNumberOrZero(this.totalB) + convertToNumberOrZero(this.totalC) + convertToNumberOrZero(this.totalD) - convertToNumberOrZero(this.totalL);

      // const result = totalSum !== 0 && paidUpCapital !== 0 ? (totalSum * phaseValue) / paidUpCapital : 0;
      // this.unqotedEquityShareVal = result

      // return this.formatPositiveAndNegativeValues(result);
      return elevenUaData?.data?.computations?.valuePerShare ? this.formatPositiveAndNegativeValues(elevenUaData?.data?.computations?.valuePerShare) : '-';
    })

    hbs.registerHelper('elevenUaPerShare',()=>{
      if(elevenUaData?.data?.computations?.valuePerShare){
        // return this.formatPositiveAndNegativeValues(this.unqotedEquityShareVal);
        return elevenUaData?.data?.computations?.valuePerShare ? this.formatPositiveAndNegativeValues(elevenUaData?.data?.computations?.valuePerShare) : '-';
      }
      return '-'
    })

    hbs.registerHelper('reportDate',()=>{
      if(reportDetails.registeredValuerDetails[0]) 
          return  this.formatDate(new Date(reportDetails.reportDate));
      return '';
    })

    hbs.registerHelper('registeredValuerName',()=>{
      if(reportDetails.registeredValuerDetails[0]) 
          return  reportDetails.registeredValuerDetails[0].registeredValuerName
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
    hbs.registerHelper('appointingAuthorityName',()=>{
      if(reportDetails.appointeeDetails[0]) 
          return  reportDetails.appointeeDetails[0].appointingAuthorityName; 
      return '';
    })
    hbs.registerHelper('dateOfAppointment',()=>{
      if(reportDetails)
          return this.formatDate(new Date(reportDetails.appointeeDetails[0].dateOfAppointment));
      return '';
    })

    hbs.registerHelper('dateOfIncorporation',()=>{
      if(reportDetails.appointeeDetails[0])
          return this.formatDate(new Date(reportDetails.dateOfIncorporation));
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
    hbs.registerHelper('financialBasis',()=>{
      if(elevenUaData.data?.inputData?.financialBasis === 'audited')
          return true;
      return false;
    })

    hbs.registerHelper('sectionAndPurposeOfReport', ()=>{
      let storePurposeWiseSections = {}, overallSectionsWithPurposes = [];
          if(!reportDetails.reportPurpose?.length || !reportDetails.reportSection?.length){
            return ['Please provide data']
          }

           //Firstly create object structure with purpose of report and sections in key-value format;
           reportDetails.reportPurpose.forEach((indpurpose, purposeIndex)=>{
            reportDetails.reportSection.forEach((indSection, sectionIndex) => {
              if(PURPOSE_OF_REPORT_AND_SECTION[indpurpose].length){
                if(PURPOSE_OF_REPORT_AND_SECTION[indpurpose].includes(indSection)){
                  storePurposeWiseSections[indpurpose] = storePurposeWiseSections[indpurpose] || [];
                  storePurposeWiseSections[indpurpose].push(indSection);
                }
              }
            });
          })

          // Use that object structure created above for looping and adding sections followed by purposes
          reportDetails.reportPurpose.forEach((indPurposeOfReport,index)=>{
           let stockedPurposes = storePurposeWiseSections[indPurposeOfReport];
            if (stockedPurposes.length <= 1) {
              overallSectionsWithPurposes.push(stockedPurposes.join(', ') + ' of ' + REPORT_PURPOSE[indPurposeOfReport]);
            } else {
              const lastSection = stockedPurposes[stockedPurposes.length - 1];
              const otherSections = stockedPurposes.slice(0, -1).join(', ');
              overallSectionsWithPurposes.push(`${otherSections} and ${lastSection}` + ' of ' + REPORT_PURPOSE[indPurposeOfReport]);
              }
          })
          return overallSectionsWithPurposes.join(' and ');
  });
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

  
  async mandateReport(id, res, headers){
    try{
      return await this.mandateReportService.generateMandateReport(id, res, headers);   
    }
    catch(error){
      return {
        error:error,
        msg:"report generation failed",
        status:false
      }
    }
  }

  async mrlReport(stateId, res, format, headers){
    try{
      return await this.mrlReportService.generateMrlReport(stateId, res, format, headers);   
    }
    catch(error){
      return {
        error:error,
        msg:"report generation failed",
        status:false
      }
    }
  }
  
  async elevenUaMrlReport(stateId, res, format, headers){
    try{
      return await this.mrlReportService.generateElevenUaMrl(stateId, res, format, headers);   
    }
    catch(error){
      return {
        error:error,
        msg:"mrl generation failed",
        status:false
      }
    }
  }


  async fetchBetaWorking(request, id, betaType){
    try{
      if(betaType === BETA_TYPE[2]){
        return;
      }
      const bearerToken = await this.authenticationService.extractBearer(request);

      if(!bearerToken.status)
        return bearerToken;

      const headers = { 
        'Authorization':`${bearerToken.token}`,
        'Content-Type': 'application/json'
      }
      const processDetails = await this.processStateManagerService.getProcessIdentifierId({obId:id});
      const financialSegmentDetails = await axiosInstance.get(`${FETCH_BETA_WORKING}/${processDetails.processIdentifierId}`, { httpsAgent: axiosRejectUnauthorisedAgent, headers });
      return financialSegmentDetails.data?.data;
    }
    catch(error){
      throw new HttpException(
        {
          error: error,
          status: false,
          msg: 'beta working fetch failed',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async navReport(id, res, type, req){
    try{
      // Fetching Associated Roles
      const headers = {
        authorization: req.headers.authorization
      }
      const {roles} = await this.fetchUserInfo(headers);
      const MB01 = roles.some(indRole => indRole?.name === userRoles.merchantBanker);

      if(MB01){
        return this.getReport(id, res, req, METHODS_AND_APPROACHES[2], type);
      }
     return await this.navReportService.generateNavReport(id,res,type);
    }
    catch(error){
      throw new HttpException(
        {
          error: error,
          status: false,
          msg: 'nav report generation failed',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async previewNavReport(id, res, req){
    try{
      // Fetching Associated Roles
      const headers = {
        authorization: req.headers.authorization
      }
      const {roles} = await this.fetchUserInfo(headers);
      const MB01 = roles.some(indRole => indRole?.name === userRoles.merchantBanker);

      if(MB01){
        return await this.previewReport(id,res, req, METHODS_AND_APPROACHES[2])
      }
     return await this.navReportService.navReportPreview(id,res);
    }
    catch(error){
      throw new HttpException(
        {
          error: error,
          status: false,
          msg: 'nav report generation failed',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  calculateSerialNo(reportMultiple, reportDefaultIndex, multiples, selectedMultiples, ccmValuationLength) {
    if (reportMultiple === 'weightageAverage') {
        return multiples ? `3.${selectedMultiples?.length + 1}` : `3.${ccmValuationLength}`;
    } else {
        if (!multiples || selectedMultiples.length === 4) {
            return `3.${reportDefaultIndex}`;
        } else {
            const simplifiedMultipleArray = MULTIPLES_ORDER_CCM_REPORT.filter(mStruc => selectedMultiples.includes(mStruc));
            const index = simplifiedMultipleArray.indexOf(reportMultiple);
            return index !== -1 ? `3.${index + 1}` : '';
        }
    }
}

 getSelectedMultiples(valuationResult) {
  let multiples, selectedMultiples;
  valuationResult?.modelResults?.some((data) => {
      if (data.model === MODEL[2]) {
          multiples = data.valuationData?.multiples;
          if(multiples){
            selectedMultiples = Object.keys(multiples).filter(key => multiples[key]);
          }
          return true; // Exit loop once found
      }
  });
  return { multiples, selectedMultiples };
}

async fetchUserInfo(headers){
  const KCGuard = new KeyCloakAuthGuard();
  const roles = await KCGuard.fetchUserRoles(getRequestAuth(headers)).toPromise();
  return { roles };
}

checkModelExist(modelName,modelArray){
  return modelArray?.length ?  modelArray?.includes(modelName) : false;
}

generateString(modelArray) {
  const methods = {
    DCF: "Discounted Cash Flow Method (‘DCF’)",
    CCM: "Comparable Company Multiple Method (‘CCM’)",
    NAV: "Net Asset Value Method (‘NAV’)",
    MarketPrice: "Market Price Method",
  };

  let selectedMethods = [], finalArray = [];

  selectedMethods = [
    modelArray.includes(MODEL[0]) || modelArray.includes(MODEL[1]) ? methods.DCF : null,
    modelArray.includes(MODEL[5]) ? methods.NAV : null,
    (modelArray.includes(MODEL[2]) || modelArray.includes(MODEL[4])) ? methods.CCM : null,
  ];

  const filteredMethods = selectedMethods.filter(method => method !== null);

  const lastElementIndex = filteredMethods.length - 1;
  if (lastElementIndex >= 1) {
    const allElementsExcptLast = filteredMethods.slice(0, -1).join(', ');
    finalArray.push(`${allElementsExcptLast} and ${filteredMethods[lastElementIndex]}`);
  }

  const string = finalArray.length ? finalArray : filteredMethods.join(', ');

  return string;
}
async validateReportClaims(roles, purposeOfReport){
  if(!purposeOfReport?.length) return false;

  let purposeRoleArray = [];
  for await(const indPurpose of purposeOfReport){
    if(reportClaims[indPurpose]){
      purposeRoleArray.push(
        {
          purpose:indPurpose,
          claim:reportClaims[indPurpose]
        }
      )
    }
  }
  let roleExist = false;
  for await(const indRole of roles){
    roleExist = purposeRoleArray.some(reportRole => indRole?.name === reportRole?.claim)
    if(roleExist)
      break;
  }
  return roleExist
}

navHTMLBinding(navData, splittingIndex?){
  return this.navReportService.navTableStructure(navData, splittingIndex);
}
}
