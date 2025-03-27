import {
  Body,
  Controller,
  Post,
  UseInterceptors,
  Get,
  Param,
  Query,
  ParseIntPipe,
  UseGuards,
  Request,
  Headers
} from '@nestjs/common';
import * as XLSX from 'xlsx';
import { ValuationsService } from './valuationProcess.service';
import { ValuationMethodsService } from './valuation.methods.service';
import { MyMiddleware } from '../middleware/Valuation.middleware';
import {
  calculateDaysFromDate,
  getRequestAuth,
} from '../excelFileServices/common.methods';
// import {CapitalStruc} from '../excelFileServices/fcfeAndFCFF.method';
import { utilsService } from 'src/utils/utils.service';
import { CustomLogger } from 'src/loggerService/logger.service';
import { MODEL } from 'src/constants/constants';
import { AuthGuard } from '@nestjs/passport';
import { AuthenticationService } from 'src/authentication/authentication.service';
import { KeyCloakAuthGuard } from 'src/middleware/key-cloak-auth-guard';
import { terminalValueWorkingService } from './terminal-value-working.service';
import { FCFEAndFCFFService } from './fcfeAndFCFF.service';
import { RelativeValuationService } from './relativeValuation.service';
import { SensitivityAnalysisService } from 'src/sensitivity-analysis/service/sensitivity-analysis.service';
import { authenticationTokenService } from 'src/authentication/authentication-token.service';
import { thirdpartyApiAggregateService } from 'src/library/thirdparty-api/thirdparty-api-aggregate.service';
import { MarketPriceService } from './market-price.service';

@UseGuards(KeyCloakAuthGuard)
@Controller('valuationProcess')
@UseInterceptors(MyMiddleware)
export class ValuationProcessController {
  constructor(
    private valuationsService: ValuationsService,
    private valuationMethodsService: ValuationMethodsService,
    private customLogger: CustomLogger,
    private authService:AuthenticationService,
    private sensitivityAnalysisService: SensitivityAnalysisService,
    private authenticationTokenService: authenticationTokenService,
    private thirdPartyService: thirdpartyApiAggregateService
  ) {}

  @Post()
  async processExcelFile(@Body() inputs): Promise<any> {
    console.log("Initiating Process");
    console.log(inputs);
    this.customLogger.log({
      message: 'Request is entered into Valuation Process Controller.',
      userId: inputs.userId,
    });
    const { model, valuationDate, company, userId, excelSheetId } = inputs;
let workbook=null;
    try{
   workbook = XLSX.readFile(`./uploads/${excelSheetId}`);
}catch{
  this.customLogger.log({
    message: `excelSheetId: ${excelSheetId} not available`,
    userId: inputs.userId,
  });
  return {
    result: null,
    msg: `excelSheetId: ${excelSheetId} not available`,
  };
}
    const worksheet1 = workbook.Sheets['P&L'];
    const worksheet2 = workbook.Sheets['BS'];
    const worksheet3 = workbook.Sheets['Assessment of Working Capital'] ?? 'NA';
    let capitalStruc: any;

    // capitalStruc = await CapitalStruc(i,worksheet2);
    // console.log(capitalStruc.debtProp);

    //if we want to get date from excel sheet.
    // const B1Cell = worksheet1['B1'];
    // const B1Value = B1Cell.v;
    // const data = B1Value.split(',');
    // const date = data[2];

    if (model === 'FCFE' || model === 'FCFF') {
      // const plDays = calculateDaysFromDate(new Date(valuationDate));
      // const date = new Date(valuationDate);
      // const totalDays = isLeapYear(date.getFullYear()) ? 366 : 365;
      // if (plDays <totalDays) {
        console.log(
          'Running Valuation ..............',
          'Date: ',
          valuationDate,
          // 'Days:',
          // plDays.dateDiff,
        );
        // Change column B values for worksheet1
        const range = XLSX.utils.decode_range(worksheet1['!ref']);

        for (let rowNum = range.s.r + 1; rowNum <= range.e.r; rowNum++) {
          const cellAddress = XLSX.utils.encode_cell({ r: rowNum, c: 1 }); // Column B
          const cell = worksheet1[cellAddress];
          if (cell && cell.t === 'n') {
            // Check if the cell contains a number
            // cell.v = (cell.v / plDays) * (365 - plDays) + cell.v;
          }
        }

        // Change column B values for worksheet2
        const range2 = XLSX.utils.decode_range(worksheet2['!ref']);

        for (let rowNum = range2.s.r + 1; rowNum <= range2.e.r; rowNum++) {
          const cellAddress = XLSX.utils.encode_cell({ r: rowNum, c: 1 }); // Column B
          const cell = worksheet2[cellAddress];
          if (cell && cell.t === 'n') {
            // Check if the cell contains a number
            // cell.v = (cell.v / plDays) * (365 - plDays) + cell.v;
          }
        }
      // }
    }

    // Performe calculation by specific method
    if (model === 'FCFE') {
      
      const valuationResponse = await this.valuationMethodsService.FCFEMethodVersionTwo(
        inputs,
        worksheet1,
        worksheet2,
        worksheet3,
      );
      if (valuationResponse.result === null) return valuationResponse.msg;
      
      const valuationResult = valuationResponse.result;
      // Store the result in Database
      const data = {
        company: company,
        model: model,
        valuation: valuationResponse.valuation,
        inputData: inputs,
        valuationData: valuationResult,
        userId: userId,
      };
      // console.log(inputs);
      const reportId = await this.valuationsService.createValuation(data);
      this.customLogger.log({
        message:
        ' FCFE Request is sucessfully executed in Valuation Process Controller.',
        userId: inputs.userId,
      });
      // Send Response.
      return { reportId: reportId, valuationData: valuationResult };
    } else if (model === 'FCFF') {
      const valuationResponse = await this.valuationMethodsService.FCFEMethodVersionTwo(
        inputs,
        worksheet1,
        worksheet2,
        worksheet3,
        );
      // console.log(inputs);
      if (valuationResponse.result === null) return valuationResponse.msg;

      const valuationResult = valuationResponse.result;
      // Store the result in Database
      const data = {
        company: company,
        model: model,
        valuation: valuationResponse.valuation,
        inputData: inputs,
        valuationData: valuationResult,
        userId: userId,
      };
      const reportId = await this.valuationsService.createValuation(data);
      this.customLogger.log({
        message:
          'FCFF Request is sucessfully executed in Valuation Process Controller.',
        userId: inputs.userId,
      });
      // Send Response.
      return { reportId: reportId, valuationData: valuationResult };
    } else if (model === 'Relative_Valuation') {
      const valuationResponse =
        await this.valuationMethodsService.Relative_Valuation_Method(
          inputs,
          // worksheet1,
          // worksheet2,
        );
      if (valuationResponse.result === null) return valuationResponse.msg;

      const valuationResult = valuationResponse.result;
      // Store the result in Database
      const data = {
        company: company,
        model: model,
        valuation: valuationResponse.valuation,
        inputData: inputs,
        valuationData: valuationResult,
        userId: userId,
      };
      const reportId = await this.valuationsService.createValuation(data);
      this.customLogger.log({
        message:
          'Relative Valuation Request is sucessfully executed in Valuation Process Controller.',
        userId: inputs.userId,
      });
      // Send Response.
      return { reportId: reportId, valuationData: valuationResult };
    }
  }

  @UseGuards(KeyCloakAuthGuard)
  @Post('v1')
  async processValuationModel(@Headers() headers: Headers, @Body() inputs): Promise<any> {
    const KCGuard:any = new KeyCloakAuthGuard();

    const authoriseUser = await KCGuard.fetchAuthUser(getRequestAuth(headers)).toPromise();
    if(!authoriseUser.status)
      return authoriseUser;
    
    inputs.userId = authoriseUser.userId;

    console.log('Initiating Process v1');
    this.customLogger.log({
      message: 'Request is entered into Valuation Process Controller.',
      userId: inputs.userId,
    });

    const { model, valuationDate, company, userId, excelSheetId } = inputs;
    let workbook = null;
    // An issue is resulting in old modified sheet id hence passing manually
    const valuationFileToProcess = inputs.isExcelModified === true ? inputs.modifiedExcelSheetId : excelSheetId;
    // const valuationFileToProcess = inputs.isExcelModified === true ? `edited-${excelSheetId}` : excelSheetId;

    try {
      workbook = XLSX.readFile(`./uploads/${valuationFileToProcess}`);
    } catch (error) {
      await this.thirdPartyService.fetchFinancialSheetFromS3(valuationFileToProcess);
      workbook = XLSX.readFile(`./uploads/${valuationFileToProcess}`);
      // this.customLogger.log({
      //   message: `excelSheetId: ${valuationFileToProcess} not available`,
      //   userId: inputs.userId,
      // });
      if(!workbook)
      return {
        result: null,
        msg: `excelSheetId: ${valuationFileToProcess} not available`,
      };
    }

    const worksheet1 = workbook.Sheets['P&L'];
    const worksheet2 = workbook.Sheets['BS'];
    const worksheet3 = workbook.Sheets['Assessment of Working Capital'] ?? 'NA';
    
    console.log('Choosing Model Run:');
    if (inputs.model) {
      const valResult = [];
      const models = [];
      const tableResult = [];
      try{
        for (let modelValue of inputs.model) {
          switch (modelValue) {
            case MODEL[0]:
              const fcfeResponse = await this.valuationMethodsService
                .FCFEMethodVersionTwo(inputs, worksheet1, worksheet2, worksheet3)
                valResult.push({
                  model: MODEL[0],
                  valuationData: fcfeResponse.result,
                  valuation:fcfeResponse.valuation,
                  terminalYearWorking:fcfeResponse.terminalValueWorking,
                  provisionalDate:fcfeResponse.provisionalDate
                  });
                tableResult.push({
                model: MODEL[0],
                valuationData: fcfeResponse.tableData,
                valuation:fcfeResponse.valuation,
                terminalYearWorking:fcfeResponse.terminalValueWorking,
                columnHeader:fcfeResponse.columnHeader,
                provisionalDate:fcfeResponse.provisionalDate
                });
                  
              models.push(modelValue);
              break;
              
              case MODEL[1]:
                const fcffResponse = await this.valuationMethodsService
                .FCFEMethodVersionTwo(inputs, worksheet1, worksheet2,worksheet3)
                valResult.push({
                  model: MODEL[1],
                  valuationData: fcffResponse.result,
                  valuation:fcffResponse.valuation,
                  terminalYearWorking:fcffResponse.terminalValueWorking,
                  provisionalDate:fcffResponse.provisionalDate
                  });
                tableResult.push({
                  model: MODEL[1],
                  valuationData: fcffResponse.tableData,
                  valuation:fcffResponse.valuation,
                  terminalYearWorking:fcffResponse.terminalValueWorking,
                  columnHeader:fcffResponse.columnHeader,
                  provisionalDate:fcffResponse.provisionalDate
                  });
                   models.push(modelValue);
                    break;
                    
              case MODEL[2]:
                const relativeValuationResponse = await this.valuationMethodsService
                .Relative_Valuation_Method(inputs)
                valResult.push({
                  model: MODEL[2],
                  valuationData: relativeValuationResponse.result,
                  valuation:relativeValuationResponse.valuation,
                  // provisionalDate:relativeValuationResponse.provisionalDate
                  });
                tableResult.push({
                  model: MODEL[2],
                  valuationData: relativeValuationResponse.result,
                  valuation:relativeValuationResponse.valuation
                  });
                  models.push(modelValue);
              break;  
  
            case MODEL[3]:  
            const excessEarningsResponse = await this.valuationMethodsService
            .Excess_Earnings_method(inputs, worksheet1, worksheet2,worksheet3)
            valResult.push({
              model: MODEL[3],
              valuationData: excessEarningsResponse.result,
              valuation:excessEarningsResponse.valuation,
              provisionalDate:excessEarningsResponse.provisionalDate
              });
            tableResult.push({
              model: MODEL[3],
              valuationData: excessEarningsResponse.tableData,
              valuation:excessEarningsResponse.valuation,
              columnHeader:excessEarningsResponse.columnHeader,
              provisionalDate:excessEarningsResponse.provisionalDate
              });
              models.push(modelValue);

          break; 
            case MODEL[4]: 
            const comparableIndustries = await this.valuationMethodsService
                .Relative_Valuation_Method(inputs)
                valResult.push({
                  model: MODEL[4],
                  valuationData: comparableIndustries.result,
                  valuation:comparableIndustries.valuation,
                  provisionalDate:comparableIndustries.provisionalDate
                  });
                tableResult.push({
                  model: MODEL[4],
                  valuationData: comparableIndustries.result,
                  valuation:comparableIndustries.valuation
                  });
                  models.push(modelValue);
                break;

            case MODEL[5]: 
            const netAssetValueResponse = await this.valuationMethodsService
            .Net_Asset_Value_method(inputs)
            valResult.push({
              model: MODEL[5],
              valuationData: netAssetValueResponse.result,
              valuation:netAssetValueResponse.valuation,
              provisionalDate:netAssetValueResponse.provisionalDate
              });
            tableResult.push({
              model: MODEL[5],
              valuationData: netAssetValueResponse.result,
              valuation:netAssetValueResponse.valuation,
              // columnHeader:netAssetValueResponse.columnHeader
              });
              models.push(modelValue);
            break; 

            case MODEL[6]:  
            console.log(`${MODEL[6]} not initialised`)
              break;
              
            case MODEL[7]:
              const companyId = inputs?.companyId;
              const valuationDate = inputs?.valuationDate;
              const outstandingShares = inputs?.outstandingShares;
              const reportingUnit = inputs?.reportingUnit;
              const processStateId = inputs?.processStateId;
              const payload = {
                companyId, 
                valuationDateTimestamp:valuationDate, 
                outstandingShares, 
                reportingUnit,
                isCmpnyNmeOrVltionDteReset:inputs?.validateFieldOptions?.isCmpnyNmeOrVltionDteReset,
                processStateId
              }
              const marketPriceResponse = await this.valuationMethodsService.Market_Price_method(headers, payload);

              inputs['validateFieldOptions'] = inputs['validateFieldOptions'] || {};
              inputs['validateFieldOptions']['isCmpnyNmeOrVltionDteReset'] = false;
              
              valResult.push({
                model: MODEL[7],
                valuationData: { 
                  sharePriceLastTenDays: marketPriceResponse.sharePriceLastTenDays, 
                  sharePriceLastNinetyDays: marketPriceResponse.sharePriceLastNinetyDays,
                  vwapLastTenDays: marketPriceResponse.vwapLastTenDays,
                  vwapLastNinetyDays: marketPriceResponse.vwapLastNinetyDays,
                },
                equityValue: marketPriceResponse.equityValue,
                // equityValueBSE: marketPriceResponse.equityValueBse,
                valuation:marketPriceResponse.valuePerShare,
                // valuationBSE:marketPriceResponse.valuePerShareBse
              });
              tableResult.push({
                model: MODEL[7],
                valuationData: { 
                  sharePriceLastTenDays: marketPriceResponse.sharePriceLastTenDays, 
                  sharePriceLastNinetyDays: marketPriceResponse.sharePriceLastNinetyDays,
                  vwapLastTenDays: marketPriceResponse.vwapLastTenDays,
                  vwapLastNinetyDays: marketPriceResponse.vwapLastNinetyDays,
                },
                equityValue: marketPriceResponse.equityValue,
                valuation:marketPriceResponse.valuePerShare,
              });
              models.push(modelValue);
            break;  

            default:
              console.log('Default case');
              break;
          }
        }
        const provisionalDate = valResult.find((indVal) => indVal?.provisionalDate)?.provisionalDate;
        const {secondaryValuationId, ...rest} = inputs;
        const data ={company:company,model:models,provisionalDate:provisionalDate,inputData:rest,modelResults:valResult,userId:userId, processStateId:inputs.processStateId}
        const reportId = await this.valuationsService.createValuation(data);

        const role = {
          role: ['sensitivityAnalysis']
        }
         const  request  = {
            headers : {
              authorization: headers['authorization']
            }
          }
        const hasAccess = await this.authenticationTokenService.entityAccess(role, request);
        let SAResponse:any;
        if(hasAccess){
            SAResponse = await this.sensitivityAnalysisService.upsertPrimaryValuationByReportId(reportId, secondaryValuationId);
        }
        return  {
          reportId:reportId,
          valuationResult:tableResult,
          sensitivityAnalysisId: SAResponse?.id,
          message:'Request Successful',
          success:true
        }
      }catch(error)
      {
        throw error;
      }
    }
  }
}

//Industries Controller
@Controller('valuations')
export class ValuationsController {
  
  constructor(private valuationsService: ValuationsService,
    private readonly utilsService: utilsService,
    private terminalWorkingService: terminalValueWorkingService,
    private readonly fcfeService: FCFEAndFCFFService,
    private relativeValuationService: RelativeValuationService,
    private readonly marketPriceService: MarketPriceService) {}

  @UseGuards(KeyCloakAuthGuard)
  @Get('calculate-terminal-value')
  async processTerminalValue(@Query('id') valuationId:any){
    return await this.terminalWorkingService.computeTerminalValue(valuationId);
  }

  @UseGuards(KeyCloakAuthGuard)
  @Post('dcf-re-valuation')
  async recalculateValuePerShare(
  @Body() payload: any,
  @Headers() headers: Headers){
    return await this.fcfeService.recalculateValuePerShare(payload, headers);
  }

  @UseGuards(KeyCloakAuthGuard)
  @Post('sa-re-valuation')
  async recalculateValuePerShareForSA(
  @Body() payload: any,
  @Headers() headers: Headers){
    return await this.fcfeService.recalculateValuePerShareForSA(payload, headers);
  }

  @UseGuards(KeyCloakAuthGuard)
  @Post('ccm-re-valuation')
  async recalculateCcmValuation(@Body() inputPayload:any,
  @Headers() headers: Headers){
    return await this.relativeValuationService.recalculateCcmValuation(inputPayload, headers);
  }

  @UseGuards(KeyCloakAuthGuard)
  @Post('market-price-re-valuation')
  async recalculateMarketPriceValuation(@Body() inputPayload:any, @Headers() headers: Headers){
    return await this.marketPriceService.revaluationMarketPrice(headers, inputPayload);
  }

  @UseGuards(KeyCloakAuthGuard)
  @Post('insert-valuation')
  async insertValuation(@Body() payload:any,
  @Headers() headers: Headers){
    return await this.fcfeService.insertValuation(payload, headers);
  }

  @UseGuards(KeyCloakAuthGuard)
  @Get(':userId')
  async findAllByUserId(@Param('userId') userId: string): Promise<any[]> {
    return this.valuationsService.getValuationsByUserId(userId);
  }
}
