import { Injectable, NotFoundException } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import * as xlsx from 'xlsx';
import * as ExcelJS from 'exceljs';
import * as dateAndTime from 'date-and-time';
import { Observable, throwError, of, from } from 'rxjs';
import { catchError, findIndex, last, switchMap } from 'rxjs/operators';
import * as puppeteer from 'puppeteer';
import { ASSESSMENT_DATA, AWS_STAGING, BALANCE_SHEET, BETA_FROM, CAPITAL_STRUCTURE_TYPE, CASHFLOW_HEADER_LINE_ITEM, CASHFLOW_LINE_ITEMS_SKIP, CASH_FLOW, DATE_REGEX, DOCUMENT_UPLOAD_TYPE, EXCEL_CONVENTION, MARKET_APPROACH_REPORT_LINE_ITEM, MODEL, PROFIT_LOSS, RELATIVE_PREFERENCE_RATIO, REPORTING_UNIT, RULE_ELEVEN_UA, SLUMP_SALE, V2_ASSESSMENT_OF_WORKING_CAPITAL, V2_BALANCE_SHEET, V2_PROFIT_LOSS, YEAR_REGEX, assessmentOfWCformulas, cashFlowFormulas, mainLogo, sortArrayOfObjects, ALL_MODELS, GET_DATE_MONTH_YEAR_FORMAT, CURRENT_YEAR_CYCLE, XL_SHEET_ENUM } from 'src/constants/constants';
// import { ALL_MODELS, ASSESSMENT_DATA, AWS_STAGING, BALANCE_SHEET, BETA_FROM, CAPITAL_STRUCTURE_TYPE, DOCUMENT_UPLOAD_TYPE, MARKET_APPROACH_REPORT_LINE_ITEM, MODEL, PROFIT_LOSS, RELATIVE_PREFERENCE_RATIO, REPORTING_UNIT, RULE_ELEVEN_UA, mainLogo } from 'src/constants/constants';
import { ValuationsService } from 'src/valuationProcess/valuationProcess.service';
import { FCFEAndFCFFService } from 'src/valuationProcess/fcfeAndFCFF.service';
import hbs = require('handlebars');
import { isNotEmpty } from 'class-validator';
import { getYearsList, calculateDaysFromDate,getCellValue,getDiscountingPeriod,searchDate, parseDate, getFormattedProvisionalDate, convertToNumberOrZero, formatDateHyphenToDDMMYYYY, extractYearsFromKeys, getDateKey, formatDateToShortForm } from '../excelFileServices/common.methods';
import { columnsList, sheet2_BSObj } from './excelSheetConfig';
import { ChangeInNCA } from './fcfeAndFCFF.method';
import { IFIN_FINANCIAL_SHEETS } from 'src/library/interfaces/api-endpoints.prod';
import { axiosInstance } from 'src/middleware/axiosConfig';
import { thirdpartyApiAggregateService } from 'src/library/thirdparty-api/thirdparty-api-aggregate.service';
import { convertEpochToPlusOneDate, formatPositiveAndNegativeValues } from 'src/report/report-common-functions';
import { ReportService } from 'src/report/report.service';
import { ElevenUaService } from 'src/elevenUA/eleven-ua.service';
import { terminalValueWorkingService } from 'src/valuationProcess/terminal-value-working.service';
import { ExcelArchiveDto } from 'src/excel-archive/dto/excel-archive.dto';
import { KeyCloakAuthGuard } from 'src/middleware/key-cloak-auth-guard';
import { ExcelArchiveService } from 'src/excel-archive/service/excel-archive.service';
import { authenticationTokenService } from 'src/authentication/authentication-token.service';
import { userRoles } from 'src/library/enums/user-roles.enum';
import BTree from 'sorted-btree';
import { CalculationService } from 'src/calculation/calculation.service';
import { ProcessStatusManagerService } from 'src/processStatusManager/service/process-status-manager.service';
require('dotenv').config();

@Injectable()
export class ExcelSheetService {
  totalA=0;
    totalB=0;
    totalC=0;
    totalD=0;
    totalL=0;
    unqotedEquityShareVal=0;
  constructor( private valuationService:ValuationsService,
    private fcfeService:FCFEAndFCFFService,
    private thirdpartyApiAggregateService: thirdpartyApiAggregateService,
    private readonly reportService: ReportService,
    private readonly elevenUaService: ElevenUaService,
    private readonly terminalValueWorkingService: terminalValueWorkingService,
    private readonly excelArchiveService: ExcelArchiveService,
    private readonly authTokenService:authenticationTokenService,
    private readonly calculationService: CalculationService,
    private readonly processStateManagerService: ProcessStatusManagerService){}
    getSheetData(fileName: string, sheetName: string, request, processStateId): Observable<any> {
        // const uploadDir = path.join(__dirname, '../../uploads');
        // const filePath = path.join(uploadDir, fileName);
        return from (this.excelArchiveService.fetchExcelByProcessStateId(processStateId)).pipe(
          switchMap((excelArchiveData)=>{
            const excelRowCount = excelArchiveData[EXCEL_CONVENTION[sheetName]?.EAcountCheck] || 0;
            if(excelRowCount){
              return of({
                data:excelArchiveData[EXCEL_CONVENTION[sheetName]?.EAkey],
                msg:`Excel Sheet Fetched`,
                status:true
              });
            }
            else{
              return from(this.thirdpartyApiAggregateService.fetchFinancialSheetFromS3(fileName)).pipe(
                switchMap((filePath:any)=>{
                  const fileType = path.extname(filePath);
                  const stats = fs.statSync(filePath);
                  const fileSize = stats.size;
                  return from(this.readFile(filePath)).pipe(
                    switchMap((workbook) => {
                      return from(this.copyWorksheets(workbook,fileName)).pipe(
                          switchMap((response)=>{
                            switch(sheetName){
                              case 'BS':
                              case 'P&L':
                                if (!workbook.SheetNames.includes(sheetName)) {
                                  return throwError( {
                                    message: `${sheetName} Sheet not found`,
                                    status: false
                                  });
                                }
                                const sheetData = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);
                                // sheetData.forEach((row:any) => {
                                //   for (let columns in row) {
                                //     if (typeof row[columns] === 'string') {
                                //       row[columns] = row[columns].replace(/\r\n/g, '');
                                //   }
                                
                                //     if (typeof row[columns] === 'number') {
                                //       row[columns] = parseFloat(row[columns].toFixed(2));
                                //     }
                                //     if (typeof columns === 'string') {
                                //       const cleanedColumn = columns.trim().replace(/^\s+/g, '').replace(/\r\n/g, '');
                                //       // const cleanedColumn = columns.replace(/^\s+/g, '');
                                //       // console.log(cleanedColumn)
                                //       if (columns !== cleanedColumn) {
                                //         row[cleanedColumn] = row[columns];
                                //         //   console.log(row[cleanedColumn])
                                //         delete row[columns];
                                //       }
                                //     }
                                //   }
                                // });
                                sheetData.forEach((row:any) => {
                                  const orderedEntries = Object.entries(row).map(([key, value]) => {
                                    if (typeof value === 'string') {
                                        value = value.replace(/\r\n/g, '');
                                    }
                                    if (typeof value === 'number') {
                                        value = parseFloat(value.toFixed(2));
                                    }
                                    return [key.trim().replace(/^\s+/g, '').replace(/\r\n/g, ''), value];
                                });
                            
                                // Rebuild object with preserved order
                                row = Object.fromEntries(orderedEntries);
                                 });
                                 return from(this.transformData(sheetData)).pipe(
                                  switchMap((excelData)=>{
                                    return from(this.createStructure(excelData,sheetName)).pipe(
                                      switchMap((structure:any)=>{
                                            const payload = {
                                              processStateId,
                                              fileName,
                                              fileSize,
                                              fileType,
                                              filePath,
                                              structure:structure,
                                              sheetName
                                            }
                                           return from(this.updateBSorPLexcelArchive(payload, request)).pipe(
                                            switchMap((response)=>{
                                              return of({
                                                data:response.data,
                                                msg:"excel Sheet Fetched",
                                                status:true
                                              });
                                            }),
                                            catchError((error)=>{
                                              return throwError(error)
                                            })
                                           )
                                      })
                                    )
                                 }),
                                 catchError((error)=>{
                                  return throwError(error)
                                 })
                                 )
                              break;
          
                            case 'Assessment of Working Capital':
                              return from(this.generateAssessmentOfWCExcel(workbook, processStateId, fileName, filePath, fileSize, fileType, request)).pipe(
                                switchMap((response)=>{
                                  return of({
                                    data:response.data,
                                    msg:"assessment Sheet Fetched",
                                    status:true
                                  });
                                }),
                                catchError((error)=>{
                                  return throwError(error)
                                })
                              )
                              break;

                              case 'Cash Flow':
                                return from(this.generateCashFlowExcel(workbook, processStateId, fileName, filePath, fileSize, fileType, request)).pipe(
                                  switchMap((response)=>{
                                    return of({
                                      data:response.data,
                                      msg:"Cash flow Sheet Fetched",
                                      status:true
                                    });
                                  }),
                                catchError((error)=>{
                                  return throwError(error)
                                }))
                                break;

                              case 'Rule 11 UA':
                                if (!workbook.SheetNames.includes(sheetName)) {
                                  return throwError( {
                                    message: `${sheetName} Sheet not found`,
                                    status: false
                                  });
                                }
                                const elevenUaSheetData = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);
                                 return from(this.transformData(elevenUaSheetData)).pipe(
                                  switchMap((excelData)=>{
                                    return from(this.createStructure(excelData,sheetName)).pipe(
                                      switchMap((structure)=>{
                                        const elevenUaPayload = {
                                          fileName,
                                          filePath,
                                          fileSize,
                                          sheetName,
                                          processStateId,
                                          structure
                                        }
                                        return from(this.updateRuleElevenUaArchive(elevenUaPayload,request)).pipe(
                                          switchMap((archiveResponse)=>{
                                            return of({
                                              data:archiveResponse.data,
                                              msg:`Excel Sheet Fetched`,
                                              status:true
                                            });
                                          }),catchError((error)=>{
                                            return throwError(error);
                                          })
                                        )
                                        
                                      })
                                    )
                                  }),
                                  catchError((error)=>{
                                    return throwError(error)
                                  })
                                 )
          
                              break;   
          
                              case 'Slump Sale':
                                if (!workbook.SheetNames.includes(sheetName)) {
                                  return throwError( {
                                    message: `${sheetName} Sheet not found`,
                                    status: false
                                  });
                                }
                                const slumpSaleSheetData = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);
                                 return from(this.transformData(slumpSaleSheetData)).pipe(
                                  switchMap((excelData)=>{
                                    return from(this.createStructure(excelData,sheetName)).pipe(
                                      switchMap((structureResponse:any)=>{
                                        return from(this.fetchUserInfo(request)).pipe(
                                          switchMap((authUser)=>{
                                            //  let excelArchive = new ExcelArchiveDto();
                                            //  excelArchive.fileName = fileName;
                                            //  excelArchive.sheetName = sheetName;
                                            //  excelArchive.rowCount = structureResponse.rows;
                                            //  excelArchive.fileSize = `${fileSize}B`;
                                            //  excelArchive.fileType = fileType;
                                            //  excelArchive.importedBy = authUser?.userInfo?.userId;
                                            //  excelArchive.status = 'complete';
                                            //  excelArchive.data = structureResponse.slumpSaleStructure
                                            
                                            //  return from(this.excelArchiveService.upsertExcel(excelArchive)).pipe(
                                            //   switchMap((excelArchiveResponse)=>{
                                            //     return of({
                                            //       data:structureResponse.slumpSaleStructure,
                                            //       msg:`Excel Sheet Fetched`,
                                            //       status:true
                                            //     });
                                            //   }),
                                            //   catchError((error)=>{
                                            //     return throwError(error)
                                            //   })
                                            //  )
                                                return of({
                                                  data:structureResponse.slumpSaleStructure,
                                                  msg:`Excel Sheet Fetched`,
                                                  status:true
                                                }); 
                                          })
                                        )
                                      })
                                    )
                                  }),
                                  catchError((error)=>{
                                    return throwError(error)
                                  })
                                 )
          
                              break;   
                            }
                          }),
                          catchError((error) => {
                            return throwError(error)
                          })
                        )
              
                    }),
                    catchError((error) => {
                      return throwError(error)
                    })
                  )
                  },
                 ),
                 catchError((error) => {
                  return throwError(error)
                })
                )
            }
          })
        )
      }

   async updateBalanceSheetRetainersAndCashEquivalent(fileName: string, request, processStateId){
      try{
        /**
         * Row Auto-adjuster for Balance Sheet:
         * Firstly it updates 'Cash and cash equivalents at end of period (IV+V)' from Current Assets 
         * Secondly it updates '(iv) Retained Earnings' from equity in balance sheet
         * Start with loading Balance Sheet JSON from DB --- [It cannot be empty by any means]
         * 
         * Load Cash Flow JSON by either fetching or creating one into DB
         * Load Profit Loss JSON from DB --- [It cannot be empty by any means]
         * 
         * Seperate 'Cash and cash equivalents at end of period (IV+V)' row from Cash Flow
         * Seperate 'Profit/(loss) for the period (IX+XII)' row from Profit Loss
         * 
         * Loop Balance Sheet JSON, by using sysCode, start conditioning the objects
         * Condition 1 - For '(iii) cash and cash equivalents'
         * Condition 2 - For '(iv) Retained Earnings'
         * Create array containing cell Address, row number, syscode
         * 
         * Start looping around the array 
         * Load workbook, read excel, start dynamic append worksheets, at the end write it
         * 
         * Update balance sheet JSON into mongodb using processStateId
         */

        const balanceSheetName:any = EXCEL_CONVENTION.BS.key;

        const excelArchiveData:any = await this.excelArchiveService.fetchExcelByProcessStateId(processStateId);

        const balanceSheetRowCount = excelArchiveData?.balanceSheetRowCount || 0;
        const cashFlowRowCount = excelArchiveData?.cashFlowSheetRowCount || 0;
        const profitLossRowCount = excelArchiveData?.profitLossSheetRowCount || 0;

        if(!balanceSheetRowCount) throw new NotFoundException({status:false,msg:`Balance sheet not found in MongoDb for processId ${processStateId}`, description:"try loading balance sheet again"})
        if(!profitLossRowCount) throw new NotFoundException({status:false,msg:`profit and loss sheet not found in MongoDb for processId ${processStateId}`, description:"try loading profit loss sheet again"})

        const balanceSheetData = excelArchiveData?.balanceSheetdata;
        const profitLossSheetData = excelArchiveData?.profitLossSheetdata;

        let cashFlowSheetData;
        if(!cashFlowRowCount){
          cashFlowSheetData = (await this.getSheetData(fileName, EXCEL_CONVENTION['Cash Flow'].key, request, processStateId).toPromise())?.data;
        }
        else{
          cashFlowSheetData = excelArchiveData.cashFlowSheetdata;
        }

        let cashEquivalentFromCashFlow = [];
        for await(const indCashFlowData of cashFlowSheetData){
          /**
           * Line Item : Cash and cash equivalents at end of period (IV+V)
           */
          if(indCashFlowData.lineEntry.sysCode === 7040){
            cashEquivalentFromCashFlow.push(indCashFlowData);
          }
        }

        let periodProfitLoss = [];
        for await(const indPLdata of profitLossSheetData){
          /**
           * Line Item : Profit/(loss) for the period (IX+XII)
           */
          if(indPLdata.lineEntry.sysCode === 6040){
            periodProfitLoss.push(indPLdata);
          }
        }

        let bsStruc = [];
        const A_CHAR_CODE = 65;
        
        for await (const indBSdata of balanceSheetData) {
          const sortedKeys = Object.keys(indBSdata)
                .filter(key => /\d{2}-\d{2}-\d{4}/.test(key))    
                .sort((a, b) => {
                  const dateA = new Date(a.split('-').reverse().join('-')).getTime();
                  const dateB = new Date(b.split('-').reverse().join('-')).getTime();
                  return dateA - dateB; // Now TypeScript knows these are numbers
                })
                .concat(
                  Object.keys(indBSdata)
                    .filter(key => !/\d{2}-\d{2}-\d{4}/.test(key))
                    .sort()
                );

              const sortedData = sortedKeys.reduce((acc, key) => ({ ...acc, [key]: indBSdata[key] }), {});
          /**
           * Line Item : (iii) cash and cash equivalents
          */
         if (indBSdata.lineEntry.sysCode === 8029) {
              const keysToProcess = Object.keys(sortedData).filter((key,index) => key !== 'lineEntry' && index !== 1);
                for await (const key of keysToProcess) {
                    const nextKeyIndex = keysToProcess.indexOf(key) + 1;
                    if (keysToProcess[nextKeyIndex]) {
                        const cellAddressColumn = String.fromCharCode(A_CHAR_CODE + nextKeyIndex + 2);
                        const cellAddress = `${cellAddressColumn}${indBSdata.lineEntry.rowNumber}`;
                        const newValue = cashEquivalentFromCashFlow[0]?.[keysToProcess[nextKeyIndex]] ?? 0;
                        const bsExcelSheetLogger = {
                            excelSheet: EXCEL_CONVENTION.BS.key,
                            excelSheetId: fileName,
                            processStateId: processStateId,
                            oldValue: 0,
                            newValue,
                            particulars:'(iii) cash and cash equivalents',
                            cellData: [
                                {
                                    cellAddress,
                                    columnCell: cellAddressColumn,
                                    rowCell: indBSdata.lineEntry.rowNumber,
                                    sysCode: 8029
                                }
                            ]
                        };
        
                        bsStruc.push(bsExcelSheetLogger);
                    }
                }
            }
            /**
             * Line Item : (iv) Retained Earnings
             */
            if (indBSdata.lineEntry.sysCode === 8046) {
              const keysToProcess = Object.keys(sortedData).filter((key,index) => key !== 'lineEntry');
                for await (const key of keysToProcess) {

                    const nextKeyIndex = keysToProcess.indexOf(key) + 2;
                    const currentKey = keysToProcess[keysToProcess.indexOf(key)+1];
                    if (keysToProcess[nextKeyIndex]) {

                        const cellAddressColumn = String.fromCharCode(A_CHAR_CODE + nextKeyIndex + 1);
                        const cellAddress = `${cellAddressColumn}${indBSdata.lineEntry.rowNumber}`;
                        indBSdata[keysToProcess[nextKeyIndex]] = convertToNumberOrZero(indBSdata[currentKey]) + convertToNumberOrZero(periodProfitLoss[0]?.[keysToProcess[nextKeyIndex]] ?? 0);
        
                        const bsExcelSheetLogger = {
                            excelSheet: EXCEL_CONVENTION.BS.key,
                            excelSheetId: fileName,
                            processStateId: processStateId,
                            oldValue: 0,
                            newValue:indBSdata[keysToProcess[nextKeyIndex]],
                            particulars:'(iv) Retained Earnings',
                            cellData: [
                                {
                                    cellAddress,
                                    columnCell: cellAddressColumn,
                                    rowCell: indBSdata.lineEntry.rowNumber,
                                    sysCode: 8046
                                }
                            ]
                        };
        
                        bsStruc.push(bsExcelSheetLogger);
                    }
                }
            }
        }

            const workbook= new ExcelJS.Workbook();
            await workbook.xlsx.readFile(path.join(process.cwd(), 'uploads', fileName));
            let worksheet:any = workbook.getWorksheet(balanceSheetName);
            for await (const indBS of bsStruc){
              const structure:any = V2_BALANCE_SHEET;

              for await(const cells of indBS.cellData) {
                worksheet.getCell(`${cells.cellAddress}`).value = indBS.newValue;
                await new Promise<void>(async (resolve) => {      
                  for await(let mainData of structure){
                    await new Promise<void>(async (resolve) => {
                      const dependentArray = mainData.lineEntry?.dependent;
                      const sysCode = mainData.lineEntry?.sysCode;
                      if (dependentArray && sysCode && dependentArray.includes(cells.sysCode)) {
                        let formulae = mainData.lineEntry?.formula.replace(/currentOne/g, cells.columnCell);
                        const formulaComputation = await this.formulaComputations(formulae,worksheet)
                        worksheet.getCell(`${cells.columnCell}${mainData.lineEntry?.rowNumber}`).value = formulaComputation;
                      }
                   resolve();
                    })
                  }
                resolve();
              })
              }
            }

            await workbook.xlsx.writeFile(path.join(process.cwd(), 'uploads', fileName), balanceSheetName);

            await this.updateFinancialSheet(path.join(process.cwd(), 'uploads', fileName));
            
            const evaluatedValues:any = await this.fetchSheetData(path.join(process.cwd(), 'uploads', fileName), balanceSheetName);
        
            let excelArchive = new ExcelArchiveDto();

            excelArchive.processStateId = processStateId;
            excelArchive.status = 'completed';
            excelArchive.balanceSheetRowCount = evaluatedValues.rows;
            excelArchive.balanceSheetdata = evaluatedValues.balanceSheetStructure;
            excelArchive.fileName = fileName;
            excelArchive.sheetUploaded = EXCEL_CONVENTION.BS.key;

            const authUser = await this.fetchUserInfo(request);
            excelArchive.importedBy = authUser?.userInfo?.userId;

            await this.excelArchiveService.upsertExcel(excelArchive);

            return {
              data:evaluatedValues.balanceSheetStructure,
              msg:`Excel Sheet Fetched`,
              status:true
            };
        
      }
      catch(error){
        throw error;
      }
    }
    generateAssessmentOfWCExcel(workbook,  processStateId, fileName, filePath, fileSize, fileType, request){
      if(!workbook.SheetNames.includes(EXCEL_CONVENTION['Assessment of Working Capital'].key)){
        // return from(new Promise((resolve, reject) => {
        //     let workbookXLSX = xlsx.readFile(filePath);
        //   resolve(workbookXLSX);
        //   })).pipe(
        //     switchMap((workbookXLSX: any) => {
            // const worksheet1 = workbookXLSX.Sheets['P&L'];
            // return from(getYearsList(worksheet1)).pipe(
            //   switchMap((years) => {

                //  const balanceSheet = workbookXLSX.Sheets['BS']
               return from(this.generateAssessmentOfWCpayload(processStateId)).pipe(
                 switchMap((data)=>{
                   return from(this.appendSheetInExcel(filePath, data)).pipe( /// pass the above created payload from generatePayload method
                     switchMap((response) => {
                       if (response) {
                         return from(this.formatExcelResult(response)).pipe(
                           switchMap((excelData)=>{
                            const assessmentPayload = {
                              processStateId,
                              fileName,
                              fileSize,
                              fileType,
                              filePath,
                              response,
                              excelData
                            }
                            return from(this.updateAssessmentArchive(assessmentPayload, request)).pipe(
                              switchMap((assessmentArchiveResponse)=>{
                                return of({
                                  data:excelData,
                                  msg:"Assessment Sheet Fetched",
                                  status:true
                                });
                              }),
                              catchError((error)=>{
                                return throwError(error)
                              })
                            )
                           }),catchError((error)=>{
                             return throwError(error)
                           })
                         )
                       } else {
                         return throwError('Error: Response not found');
                       }
                     }),
                     catchError((error) => {
                       return throwError(error);
                     })
                   );
                 }),catchError((error)=>{
                   return throwError(error)
                 })
               )
             
              //  }),
              //  catchError((error) => {
              //    return throwError(error);
              //  })
              //  );
              //   }),
              //   catchError((error) => {
              //     console.error('Error reading file:', error);
              //     return throwError(error);
              //   })
              // );
           }
           else{
             return from(this.appendSheetInExcel(filePath,[])).pipe(
               switchMap((response)=>{
                 if(response){
                   if (response) {
                     return from(this.formatExcelResult(response)).pipe(
                       switchMap((excelData)=>{
                        const assessmentPayload = {
                          processStateId,
                          fileName,
                          fileSize,
                          fileType,
                          filePath,
                          response,
                          excelData
                        }
                        return from(this.updateAssessmentArchive(assessmentPayload, request)).pipe(
                          switchMap((assessmentArchiveResponse)=>{
                            return of({
                              data:excelData,
                              msg:"Assessment Sheet Fetched",
                              status:true
                            });
                          }),
                          catchError((error)=>{
                            return throwError(error)
                          })
                        )
                       }),catchError((error)=>{
                         return throwError(error)
                       })
                     )

                   } else {
                     return throwError('Error: Response not found');
                   }
                 }
               }),catchError((error)=>{
                   return throwError(error)
               })
             )
           }
    }
      
    generateCashFlowExcel(workbook,  processStateId, fileName, filePath, fileSize, fileType, request){
      if(workbook.SheetNames.includes(EXCEL_CONVENTION['Cash Flow'].key)){
        delete workbook.Sheets['Cash Flow'];
        workbook.SheetNames = workbook.SheetNames.filter(name => name !== 'Cash Flow');
      }
        return from(new Promise((resolve, reject) => {
            let workbookXLSX = xlsx.readFile(filePath);
          resolve(workbookXLSX);
          })).pipe(
            switchMap((workbookXLSX: any) => {
            const worksheet1 = workbookXLSX.Sheets[EXCEL_CONVENTION['BS'].key];
            return from(getYearsList(worksheet1)).pipe(
              switchMap((years) => {
               const profitLossSheet = workbookXLSX.Sheets[EXCEL_CONVENTION['P&L'].key]
               return from(this.generateCashFlowPayload(processStateId)).pipe(
                 switchMap((data)=>{
                   return from(this.appendCashFlowSheetInExcel(filePath, data)).pipe( /// pass the above created payload from generatePayload method
                    switchMap((response:any) => {
                        const payload = {
                          response,
                          fileName,
                          filePath,
                          fileSize,
                          fileType,
                          processStateId
                        }
                         return from(this.updateCashFlowArchive(payload, request)).pipe(
                          switchMap((excelArchiveResponse)=>{
                               if (response) {
                                     return of({
                                       data:response.data,
                                       msg:"Cash flow Sheet Fetched",
                                       status:true
                                     });        
                               } else 
                                 return throwError('Error: Response not found');
                          })
                         )
                       }),
                     catchError((error) => {
                       return throwError(error);
                     })
                   );
                 }),catchError((error)=>{
                   return throwError(error)
                 })
               )
              
               }),
               catchError((error) => {
                 return throwError(error);
               })
               );
                }),
                catchError((error) => {
                  console.error('Error reading file:', error);
                  return throwError(error);
                })
              );
      // }
      // else{
      //   return from(this.appendCashFlowSheetInExcel(filePath,[])).pipe(
      //     switchMap((response)=>{
      //       if(response){
      //         const payload = {
      //           response,
      //           fileName,
      //           filePath,
      //           fileSize,
      //           fileType,
      //           processStateId
      //         }
      //          return from(this.updateCashFlowArchive(payload, request)).pipe(
      //           switchMap((excelArchiveResponse)=>{
      //                if (response) {
      //                   return of({
      //                     data:response.data,
      //                     msg:"Assessment Sheet Fetched",
      //                     status:true
      //                   });
      //                } else 
      //                  return throwError('Error: Response not found');
      //           })
      //          )
      //       }
      //     }),catchError((error)=>{
      //         return throwError(error)
      //     })
      //   )
      // }
    }

    updateAssessmentArchive(payload,request){
      let excelArchive = new ExcelArchiveDto();
      excelArchive.fileName = payload.fileName;
      excelArchive.sheetUploaded = EXCEL_CONVENTION['Assessment of Working Capital'].key;
      excelArchive.fileSize = `${payload.fileSize}B`;
      excelArchive.fileType = payload.fileType;
      excelArchive.status = 'complete';
      excelArchive.processStateId = payload.processStateId;
      excelArchive.assessmentSheetData = payload.excelData;
      excelArchive.assessmentSheetRowCount = payload.response.rows;
      return from(this.fetchUserInfo(request)).pipe(
        switchMap((authUser)=>{
          excelArchive.importedBy = authUser?.userInfo?.userId;
          return from(this.excelArchiveService.upsertExcel(excelArchive)).pipe(
            switchMap((excelArchiveResponse)=>{
              return of({
                data:payload.excelData,
                msg:`Excel Sheet Fetched`,
                status:true
              });
            }),
            catchError((error)=>{
              return throwError(error)
            })
            )

        }),
        catchError((error)=>{
          return throwError(error)
        })
      )
    }

    updateCashFlowArchive(payload,request){
      let excelArchive = new ExcelArchiveDto();
      excelArchive.fileName = payload.fileName;
      excelArchive.sheetUploaded = EXCEL_CONVENTION['Cash Flow'].key;
      excelArchive.fileSize = `${payload.fileSize}B`;
      excelArchive.fileType = payload.fileType;
      excelArchive.status = 'complete';
      excelArchive.processStateId = payload.processStateId;
      excelArchive.cashFlowSheetdata = payload?.response?.data;
      excelArchive.cashFlowSheetRowCount = payload?.response?.rows;
      return from(this.fetchUserInfo(request)).pipe(
        switchMap((authUser)=>{
          excelArchive.importedBy = authUser?.userInfo?.userId;
          return from(this.excelArchiveService.upsertExcel(excelArchive)).pipe(
            switchMap((excelArchiveResponse)=>{
              return of({
                data:payload.response.data,
                msg:`Excel Sheet Fetched`,
                status:true
              });
            }),
            catchError((error)=>{
              return throwError(error)
            })
            )

        }),
        catchError((error)=>{
          return throwError(error)
        })
      )
    }

    updateBSorPLexcelArchive(payload, request){
      let excelArchive = new ExcelArchiveDto();
      excelArchive.fileName = payload.fileName;
      excelArchive.sheetUploaded = payload.sheetName;
      excelArchive.fileSize = `${payload.fileSize}B`;
      excelArchive.fileType = payload.fileType;
      excelArchive.status = 'complete';
      excelArchive.processStateId = payload.processStateId;
      if(payload.sheetName === 'BS') {
        excelArchive.balanceSheetdata = payload.structure.balanceSheetStructure 
        excelArchive.balanceSheetRowCount = payload.structure.rows;
      }else{
        excelArchive.profitLossSheetdata = payload.structure.profitAndLossSheetStructure 
        excelArchive.profitLossSheetRowCount = payload.structure.rows;
      }
      return from(this.fetchUserInfo(request)).pipe(
        switchMap((authUser)=>{
          excelArchive.importedBy = authUser?.userInfo?.userId;
           return from(this.excelArchiveService.upsertExcel(excelArchive)).pipe(
            switchMap((excelArchiveResponse)=>{
              return of({
                data:payload.sheetName === 'BS' ? payload.structure.balanceSheetStructure : payload.structure.profitAndLossSheetStructure,
                msg:`Excel Sheet Fetched`,
                status:true
              });
            }),
            catchError((error)=>{
              return throwError(error)
            })
           )
        })
      )
    }

    updateRuleElevenUaArchive(payload, request){
      let excelArchive = new ExcelArchiveDto();
      excelArchive.fileName = payload.fileName;
      excelArchive.fileSize = payload.fileSize;
      excelArchive.fileType = payload.fileType;
      excelArchive.processStateId = payload.processStateId;
      excelArchive.sheetUploaded = EXCEL_CONVENTION['Rule 11 UA'].key;
      excelArchive.status = 'complete';
      excelArchive.rule11UaSheetdata = payload?.structure?.ruleElevenUaStructure;
      excelArchive.rule11UaSheetRowCount = payload?.structure?.rows;

      return from(this.fetchUserInfo(request)).pipe(
        switchMap((authUser)=>{
          excelArchive.importedBy = authUser?.userInfo?.userId;
           return from(this.excelArchiveService.upsertExcel(excelArchive)).pipe(
            switchMap((excelArchiveResponse)=>{
              return of({
                data:excelArchive.rule11UaSheetdata,
                msg:`Excel Sheet Fetched`,
                status:true
              });
            }),
            catchError((error)=>{
              return throwError(error)
            })
           )
        })
      )
    }
      
      async copyWorksheets(workbook, fileName) {
        // const uploadDir = path.join(__dirname, '../../uploads');
        const uploadDir = path.join(process.cwd(),'uploads');

        const filePath = path.join(uploadDir, fileName);
        const newWorkbook = xlsx.utils.book_new();            
        for (const sheetName in workbook.Sheets) {
            xlsx.utils.book_append_sheet(newWorkbook, workbook.Sheets[sheetName], sheetName);
        }
        
        await new Promise<void>(async (resolve) => {
          xlsx.writeFile(newWorkbook, filePath);
          resolve();
        });

       // await this.uploadFinancialSheet(filePath);
      }
      
      async readFile(filePath: string): Promise<xlsx.WorkBook> {
        return new Promise(async (resolve, reject) => {
          if (!fs.existsSync(filePath)) {
            reject('File not found');
            return;
          }
          let workbook;
          await new Promise<void>(async (resolve) => {
             workbook = xlsx.readFile(filePath);
             resolve();
            });
          resolve(workbook);
        });
      }

      async generateValuation(payload, res, request) {
        try {
          const { id,model,specificity, processId, terminalValueType, formatType, modelWeightageData } = payload;
          const valuationResult:any = await this.valuationService.getValuationById(id);
          const transposedData = [];
          const modifiedDataSet = [];
          let htmlFilePath,pdfFilePath;
          let dateStamp = `${new Date().getFullYear()}-${new Date().getMonth()+1}-${new Date().getDate()}-${new Date().getHours()}${new Date().getMinutes()}`;

          let wordFilePath = path.join(process.cwd(), 'pdf', `${model === MODEL[4] ? 'Comparable Industries' : model === MODEL[2] ? 'Relative Valuation': model }-${dateStamp}.docx`);
          let excelFilePath = path.join(process.cwd(), 'pdf', `${model === MODEL[4] ? 'Comparable Industries' : model === MODEL[2] ? 'Relative Valuation': model }-${dateStamp}.xlsx`);

          const headers = {
            authorization: request.headers.authorization
          }
          const { roles } = await this.authTokenService.fetchUserInfo(headers);

          if (specificity === true && model) {
             htmlFilePath = path.join(process.cwd(), 'html-template', `${model === MODEL[4] ? MODEL[2] : model}.html`);
             pdfFilePath = path.join(process.cwd(), 'pdf', `${model === MODEL[4] ? 'Comparable Industries' : model === MODEL[2] ? 'Relative Valuation': model }-${dateStamp}.pdf`);
            for await (let data of valuationResult.modelResults) {
              if (data.model === model) {
                modifiedDataSet.push(data);
                if(data.model === MODEL[0] || data.model === MODEL[1]){
                  transposedData.push({ model: data.model, data: await this.fcfeService.transformData(data.valuationData) });
                }
              }
            }
            valuationResult.modelResults = modifiedDataSet;
          } 
          else {
             htmlFilePath = path.join(process.cwd(), 'html-template', 'main-pdf.html');
             pdfFilePath = path.join(process.cwd(), 'pdf', `PAVIN-${dateStamp}.pdf`);
            for await (let data of valuationResult.modelResults) {
              if(data.model === MODEL[0] || data.model === MODEL[1]){
                transposedData.push({ model: data.model, data: await this.fcfeService.transformData(data.valuationData) });
              }  
            }
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
          this.loadHelpers(transposedData, valuationResult, terminalValueType, roles, getCapitalStructure, modelWeightageData, payload?.ccmVPStype);
        
          if (valuationResult.modelResults.length > 0) {
            const htmlContent = fs.readFileSync(htmlFilePath, 'utf8');
            const template = hbs.compile(htmlContent);
            const html = template(valuationResult);
      
            switch(formatType){
              case 'PDF':
                const pdf = await this.generatePdf(html, pdfFilePath, roles);
                res.setHeader('Content-Type', 'application/pdf');
                res.setHeader('Content-Disposition', `attachment; filename="${model !== 'null' ? model === MODEL[4] ? 'Comparable Industries' : model === MODEL[2] ? 'Comparable Companies': model : 'PAVIN' }-${dateStamp}.pdf"`);
                res.send(pdf);
                break;
              case 'DOCX':
                await this.generatePdf(html, pdfFilePath, roles);
                await this.thirdpartyApiAggregateService.convertPdfToDocx(pdfFilePath, wordFilePath);
          
                let wordBuffer = fs.readFileSync(wordFilePath);
                
                res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
                res.setHeader('Content-Disposition', `attachment; filename="${model !== 'null' ? model === MODEL[4] ? 'Comparable Industries' : model === MODEL[2] ? 'Comparable Companies': model : 'PAVIN' }-${dateStamp}.docx"`);

                res.send(wordBuffer);
                break;
              case 'XLSX':
                await this.generatePdf(html, pdfFilePath, roles);
                await this.thirdpartyApiAggregateService.convertPdfToExcel(pdfFilePath, excelFilePath);
          
                let excelBuffer = fs.readFileSync(excelFilePath);
                
                res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
                res.setHeader('Content-Disposition', `attachment; filename="${model !== 'null' ? model === MODEL[4] ? 'Comparable Industries' : model === MODEL[2] ? 'Comparable Companies': model : 'PAVIN' }-${dateStamp}.xlsx"`);

                res.send(excelBuffer);
                break;
            }
      
            return {
              msg: "PDF download Success",
              status: true,
            };
          } 
          else {
            console.log("Data not found");
            return {
              msg: "No data found for PDF generation",
              status: false
            };
          }
        } catch (error) {
          console.error("Error:", error);
        
          return {
            msg: "Download Failed. An error occurred during processing.",
            status: false,
            error:error.message
          };
        }
      }

      async exportElevenUa(id,res, formatType, request) {
        try {
          const elevenUaData:any = await this.elevenUaService.fetchRuleElevenUa(id);
          let htmlFilePath,pdfFilePath;
          let dateStamp = `${new Date().getFullYear()}-${new Date().getMonth()+1}-${new Date().getDate()}-${new Date().getHours()}${new Date().getMinutes()}` 
          htmlFilePath = path.join(process.cwd(), 'html-template', `rule-eleven-ua.html`);
          pdfFilePath = path.join(process.cwd(), 'pdf', `Rule-Eleven-UA-${dateStamp}.pdf`);
          let wordFilePath = path.join(process.cwd(), 'pdf', `Rule-Eleven-UA-${dateStamp}.docx`);
          let excelFilePath = path.join(process.cwd(), 'pdf', `Rule-Eleven-UA-${dateStamp}.xlsx`);

          const headers = {
            authorization: request.headers.authorization
          }
          const { roles } = await this.authTokenService.fetchUserInfo(headers);

          this.reportService.loadElevenUaHelpers(elevenUaData, null);   //Providing null since we don't generate/store report details on stepper 5
        
          const htmlContent = fs.readFileSync(htmlFilePath, 'utf8');
          const template = hbs.compile(htmlContent);
          const html = template(elevenUaData);
          
          switch(formatType){
            case 'PDF':
              const pdf = await this.generatePdf(html, pdfFilePath, roles);
              res.setHeader('Content-Type', 'application/pdf');
              res.setHeader('Content-Disposition', `attachment; filename="Rule-Eleven-UA-${dateStamp}.pdf"`);
              res.send(pdf);
              break;
            case 'DOCX':
              await this.generatePdf(html, pdfFilePath, roles);
              await this.thirdpartyApiAggregateService.convertPdfToDocx(pdfFilePath, wordFilePath);
        
              let wordBuffer = fs.readFileSync(wordFilePath);
              
              res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
              res.setHeader('Content-Disposition', `attachment; filename="Rule-Eleven-UA-${dateStamp}.docx"`);

              res.send(wordBuffer);
              break;
            case 'XLSX':
              await this.generatePdf(html, pdfFilePath, roles);
              await this.thirdpartyApiAggregateService.convertPdfToExcel(pdfFilePath, excelFilePath);
        
              let excelBuffer = fs.readFileSync(excelFilePath);
              
              res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
              res.setHeader('Content-Disposition', `attachment; filename="Rule-Eleven-UA-${dateStamp}.xlsx"`);

              res.send(excelBuffer);
              break;
          }

          return {
            msg: "PDF download Success",
            status: true,
          };
       
        } catch (error) {
          console.error("Error:", error);
        
          return {
            msg: "Download Failed. An error occurred during processing.",
            status: false,
            error:error.message
          };
        }
      }
    
      async generatePdf(htmlContent: any, pdfFilePath: string, roles) {
        const browser = await puppeteer.launch({
          headless:"new",
          executablePath: process.env.PUPPETEERPATH
        });
        const page = await browser.newPage();
        const MB01 = roles.some(indRole => indRole?.name === userRoles.merchantBanker);
        try {
          const contenread = await page.setContent(htmlContent);
          const pdf = await page.pdf({
            path: pdfFilePath,
            format: 'A4' as puppeteer.PaperFormat, // Cast 'A4' to PaperFormat
            displayHeaderFooter: true,
            printBackground: true,
            footerTemplate: MB01 ? 
            `<table style="margin: 20px; width: 100%;">
            <tr>
              <td colspan="4" style="text-align: right; font-size: 12px; padding: 10px;">
                <table style="width: 100%; border-top: 1px solid #000; border-bottom: 1px solid #000;">
                  <tr>
                    <td style="width: 15%;">&nbsp;</td>
                    <td style="width: 70%; text-align: center;">
                      <span style="font-size: 10px;">Navigant Corporate Advisors Limited | Page <span class="pageNumber"></span> of <span class="totalPages"></span></span>
                    </td>
                    <td style="width: 15%; font-size: 10px;">V1/ March / 2024</td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>` :
            `<table style="margin: 20px; width: 100%;">
            <tr>
              <td colspan="4" style="text-align: right; font-size: 12px; padding: 10px;">
                <table style="width: 100%; border-top: 1px solid #000; border-bottom: 1px solid #000;">
                  <tr>
                    <td style="width: 15%;">&nbsp;</td>
                    <td style="width: 70%; text-align: center;">
                      <span style="font-size: 10px;">PAVIN | Page <span class="pageNumber"></span> of <span class="totalPages"></span></span>
                    </td>
                    <td style="width: 15%; font-size: 10px;">V1/ March / 2024</td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>`,
          headerTemplate: MB01 ? `
          <table width="100%" border="0" cellspacing="0" cellpadding="0">
          <tr>
          <td style="width:86.2%;">
          
            <table border="0" cellspacing="0" cellpadding="0" style="height: 20px;width:100% !important;padding-left:2%;">
              <tr>
                <td style="border-bottom: solid 2px #03002f !important; font-size: 13px; height: 5px;width:100% !important;">Navigant Corporate Advisors Limited</td>
              </tr>

              <tr>
                <td style="font-size: 11px">&nbsp;</td>
              </tr>
            </table>
          </td>
        </tr></table>` : 
          `<table width="100%" border="0" cellspacing="0" cellpadding="0">
          <tr>
          <td style="width:86.2%;">
          
            <table border="0" cellspacing="0" cellpadding="0" style="height: 20px;width:100% !important;padding-left:2%;">
              <tr>
                <td style="border-bottom: solid 2px #03002f !important; font-size: 13px; height: 5px;width:100% !important;">Pavin Valtech Private Ltd.</td>
              </tr>

              <tr>
                <td style="font-size: 11px">&nbsp;</td>
              </tr>
            </table>
          </td>
        <td  align="right" style="padding-right:1%;" height="10px"><img src="${mainLogo}" width="100" height="" /></td>
        </tr></table>`
          });

          return pdf;
        } catch (error) {
          console.error('Error generating PDF:', error);
        } finally {
          await browser.close();
         
        }
      }
      async transformData(data: any[]) { //only for data table showcase on ui
        try{
        let maxKeys = Object.keys(data[0]).length;
        let maxKeysObject = data[0];

        for (let i = 1; i < data.length; i++) {
          const numKeys = Object.keys(data[i]).length;
          if (numKeys > maxKeys) {
            maxKeys = numKeys;
            maxKeysObject = data[i];
          }
        }
        const atLeastOneArray = data.some(item => Array.isArray(item));
        const keysArray = Object.keys(maxKeysObject);
        data.forEach(obj => {
          keysArray.forEach(key => {
            if (!(key in obj)) {
              obj[key] = null;
            }
          });
        });
        let splicedEle;
        keysArray.map((value:any,index:number)=>{
          if(value === 'Particulars'){
            splicedEle = keysArray.splice(index,1);
          }
        })
        if(!atLeastOneArray){
          keysArray.unshift(splicedEle[0])
        }
        data.unshift(keysArray)
        return data;
      }
        catch(error){
          console.log(error);
          throw error;
        }
      
      }

      async loadHelpers(transposedData,valuationResult, terminalType, roles, getCapitalStructure, modelWeightageData, ccmSubType){
        hbs.registerHelper('ifMB01',()=>{
          if(roles?.length)
              return roles.some(indRole => indRole?.name === userRoles.merchantBanker);
          return false;
        })

        hbs.registerHelper('riskFreeRateYears',()=>{
          if(valuationResult.inputData[0].riskFreeRateYears){
            return valuationResult.inputData[0].riskFreeRateYears;
          }
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
  
          hbs.registerHelper('costOfDebtMultipliedTaxRate',()=>{
            if(valuationResult.inputData[0] && valuationResult.inputData[0].model.includes(MODEL[1])) 
                return (convertToNumberOrZero(valuationResult.inputData[0]?.costOfDebt) * convertToNumberOrZero(this.fetchTotalTaxRate(valuationResult))/100).toFixed(2);
            return '0';
          })
        
          hbs.registerHelper('postCostOfDebt',()=>{
            if(valuationResult.inputData[0].model.includes(MODEL[1])){
              return this.calculateCostOfDebt(valuationResult);
            } 
            return '0';
          })
  
          hbs.registerHelper('capitalStructureType', ()=>{
            const capitalStructureType = getCapitalStructure.result.capitalStructure.capitalStructureType;
            if(capitalStructureType){
              return CAPITAL_STRUCTURE_TYPE[`${capitalStructureType}`];
            }
            return '';
          })
  
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
        hbs.registerHelper('modelCheck',(txt,options)=>{
          if (!valuationResult || !valuationResult.modelResults || valuationResult.modelResults.length === 0) {
            return ''; // Return an empty string if there are no results to check
          }
        const found = valuationResult.modelResults.some((response) => {
          if(txt === 'isRelativeOrCTM')
            return response.model === MODEL[4] || response.model === MODEL[2];
          return response.model === txt;
        });
        
          if (found) {
            return options.fn(this); // Render the block content
          } else {
            return ''; // Return an empty string if the condition is not met
          }
        })
        hbs.registerHelper('reportingUnit',()=>{
          if(valuationResult.inputData[0].reportingUnit)
            return valuationResult.inputData[0].reportingUnit === REPORTING_UNIT.ABSOLUTE ? '' : `( ${valuationResult.inputData[0].reportingUnit} )`;
          return '( Lakhs )';
        })
        hbs.registerHelper('fcfeColumnHeader', () => {
          let fcfeHeader = [];
          transposedData.forEach((result) => {
            if (result.model === 'FCFE' || result.model === 'FCFF') {
              fcfeHeader = result.data.columnHeader.map((headers)=>{
                return {headers};
              }); 
              fcfeHeader.push({headers:'Terminal Period'});
            }
            else if (result.model === 'Excess_Earnings') {
              fcfeHeader = result.data.columnHeader.map((headers)=>{
                return {headers};
              }); 
            }
          });
          console.log(transposedData,"fcfe header")
          return fcfeHeader;
        });

        hbs.registerHelper('PAT', () => {
          let arrayPAT = [];
          const terminalValueType = terminalType ||  'tvCashFlowBased';
          let boolTvCashFlowBased = terminalValueType === 'tvCashFlowBased';    //Checking for default condition
          valuationResult.modelResults.forEach((result)=>{
            if(result.model === 'FCFE'){
              const terminalYearPat = result.terminalYearWorking.pat;
              result.valuationData.map((response:any)=>{
                const pat = formatPositiveAndNegativeValues(response.pat);
                arrayPAT.push({fcfePat:pat})
              })
              arrayPAT.unshift({fcfePat:"PAT"});
              if(!boolTvCashFlowBased){
                arrayPAT.push({fcfePat: formatPositiveAndNegativeValues(terminalYearPat)});
              }
            }
            else if(result.model === 'FCFF'){
              const terminalYearPat = result.terminalYearWorking.pat;
              result.valuationData.map((response:any)=>{
                const pat = formatPositiveAndNegativeValues(response.pat);
                arrayPAT.push({fcffPat:pat})
              })
              arrayPAT.unshift({fcffPat:"PAT"});
              if(!boolTvCashFlowBased){
                arrayPAT.push({fcffPat: formatPositiveAndNegativeValues(terminalYearPat)});
              }
            }
            else if(result.model === 'Excess_Earnings'){
              result.valuationData.map((response:any)=>{
                const pat = formatPositiveAndNegativeValues(response.pat);
                arrayPAT.push({excessEarningPat:pat})
              })
              arrayPAT.unshift({excessEarningPat:"PAT"});
            }
          })
          return arrayPAT;
        });

        hbs.registerHelper('depAndAmortisation', () => {
          let arraydepAndAmortisation = [];
          const terminalValueType = terminalType ||  'tvCashFlowBased';
        let boolTvCashFlowBased = terminalValueType === 'tvCashFlowBased';    //Checking for default condition
          valuationResult.modelResults.forEach((result)=>{
            if(result.model === 'FCFE'){
              const terminalYearDepnAndAmortisation = result.terminalYearWorking.depAndAmortisation;
              result.valuationData.map((response:any)=>{
                const depAndAmortisation = formatPositiveAndNegativeValues(response.depAndAmortisation);
                arraydepAndAmortisation.push({fcfeDepAmortisation:depAndAmortisation})
              })
              arraydepAndAmortisation.unshift({fcfeDepAmortisation:"Dept And Amortisation"});
              if(!boolTvCashFlowBased){
                arraydepAndAmortisation.push({fcfeDepAmortisation:formatPositiveAndNegativeValues(terminalYearDepnAndAmortisation)});
              }
            }
            else if (result.model === 'FCFF'){
              const terminalYearDepnAndAmortisation = result.terminalYearWorking.depAndAmortisation;
              result.valuationData.map((response:any)=>{
                const depAndAmortisation = formatPositiveAndNegativeValues(response.depAndAmortisation);
                arraydepAndAmortisation.push({fcffDepAmortisation:depAndAmortisation})
              })
              arraydepAndAmortisation.unshift({fcffDepAmortisation:"Dept And Amortisation"});
              if(!boolTvCashFlowBased){
                arraydepAndAmortisation.push({fcffDepAmortisation:formatPositiveAndNegativeValues(terminalYearDepnAndAmortisation)});
              }
            }
          })
          return arraydepAndAmortisation;
        });

        hbs.registerHelper('InterestAdjTaxes', () => {
          let arrayaddInterestAdjTaxes = [];
          const terminalValueType = terminalType ||  'tvCashFlowBased';
        let boolTvCashFlowBased = terminalValueType === 'tvCashFlowBased';    //Checking for default condition
          valuationResult.modelResults.forEach((result)=>{
            if(result.model === 'FCFE'){
              const terminalValueInterestAdjTax = result.terminalYearWorking.addInterestAdjTaxes;
              result.valuationData.map((response:any)=>{
                const addInterestAdjTaxes = formatPositiveAndNegativeValues(response.addInterestAdjTaxes);
                arrayaddInterestAdjTaxes.push({fcfeAddInterestAdjTaxes:addInterestAdjTaxes})
              })
              arrayaddInterestAdjTaxes.unshift({fcfeAddInterestAdjTaxes:"Add: Interest Adjusted Taxes"});
              if(!boolTvCashFlowBased){
                arrayaddInterestAdjTaxes.push({fcfeAddInterestAdjTaxes:formatPositiveAndNegativeValues(terminalValueInterestAdjTax)})
              }
            }
            else if(result.model === 'FCFF'){
              const terminalValueInterestAdjTax = result.terminalYearWorking.addInterestAdjTaxes;
              result.valuationData.map((response:any)=>{
                const addInterestAdjTaxes = formatPositiveAndNegativeValues(response.addInterestAdjTaxes);
                arrayaddInterestAdjTaxes.push({fcffAddInterestAdjTaxes:addInterestAdjTaxes})
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
          const terminalValueType = terminalType ||  'tvCashFlowBased';
        let boolTvCashFlowBased = terminalValueType === 'tvCashFlowBased';    //Checking for default condition
          valuationResult.modelResults.forEach((result)=>{
            if(result.model === 'FCFE'){
              result.valuationData.map((response:any)=>{
                const onCashItems = formatPositiveAndNegativeValues(response.onCashItems);
                arrayonCashItems.push({fcfeOnCashItems:onCashItems})
              })
              arrayonCashItems.unshift({fcfeOnCashItems:"Other Non Cash items"});
              if(!boolTvCashFlowBased){
                arrayonCashItems.push({fcfeOnCashItems:'-'})    //Purposely pushing empty object since for terminal year column non cash item is 0
              }
            }
            else if(result.model === 'FCFF'){
              result.valuationData.map((response:any)=>{
                const onCashItems = formatPositiveAndNegativeValues(response.onCashItems);
                arrayonCashItems.push({fcffOnCashItems:onCashItems})
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
          const terminalValueType = terminalType ||  'tvCashFlowBased';
        let boolTvCashFlowBased = terminalValueType === 'tvCashFlowBased';    //Checking for default condition
          valuationResult.modelResults.forEach((result)=>{
            if(result.model === 'FCFE'){
              const terminalValueNca = result.terminalYearWorking.nca;
              result.valuationData.map((response:any)=>{
                const nca = formatPositiveAndNegativeValues(response.nca);
                arrayNca.push({fcfeNca:nca})
              })
              arrayNca.unshift({fcfeNca:"Change in NCA"});
              if(!boolTvCashFlowBased){
                arrayNca.push({fcfeNca:formatPositiveAndNegativeValues(terminalValueNca)})
              }
            }
            else if(result.model === 'FCFF'){
              const terminalValueNca = result.terminalYearWorking.nca;
              result.valuationData.map((response:any)=>{
                const nca = formatPositiveAndNegativeValues(response.nca);
                arrayNca.push({fcffNca:nca})
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
          const terminalValueType = terminalType ||  'tvCashFlowBased';
        let boolTvCashFlowBased = terminalValueType === 'tvCashFlowBased';    //Checking for default condition
          valuationResult.modelResults.forEach((result)=>{
            if(result.model === 'FCFE'){
              const terminalValueDeferredTaxAsset = result.terminalYearWorking.defferedTaxAssets;
              result.valuationData.map((response:any)=>{
                const defferedTaxAssets = formatPositiveAndNegativeValues(response.defferedTaxAssets);
                arraydefferedTaxAssets.push({fcfeDefferedTaxAssets:defferedTaxAssets})
              })
              arraydefferedTaxAssets.unshift({fcfeDefferedTaxAssets:"Add/Less: Deferred Tax Assets(Net)"});
              if(!boolTvCashFlowBased){
                arraydefferedTaxAssets.push({fcfeDefferedTaxAssets:formatPositiveAndNegativeValues(terminalValueDeferredTaxAsset)});
              }
            }
            else if(result.model === 'FCFF'){
              const terminalValueDeferredTaxAsset = result.terminalYearWorking.defferedTaxAssets;
              result.valuationData.map((response:any)=>{
                const defferedTaxAssets = formatPositiveAndNegativeValues(response.defferedTaxAssets);
                arraydefferedTaxAssets.push({fcffDefferedTaxAssets:defferedTaxAssets})
              })
              arraydefferedTaxAssets.unshift({fcffDefferedTaxAssets:"Add/Less: Deferred Tax Assets(Net)"});
              if(!boolTvCashFlowBased){
                arraydefferedTaxAssets.push({fcffDefferedTaxAssets:formatPositiveAndNegativeValues(terminalValueDeferredTaxAsset)});
              }
            }
          })
          return arraydefferedTaxAssets;
        });
        
        hbs.registerHelper('netCshFlow', () => {
          let arrayNetCashFlow = [];
          const terminalValueType = terminalType ||  'tvCashFlowBased';
        let boolTvCashFlowBased = terminalValueType === 'tvCashFlowBased';    //Checking for default condition
          valuationResult.modelResults.forEach((result)=>{
            if(result.model === 'FCFE'){
              const terminalValueNetCashFlow = result.terminalYearWorking.netCashFlow;
              result.valuationData.map((response:any)=>{
                const netCashFlow = formatPositiveAndNegativeValues(response.netCashFlow);
                arrayNetCashFlow.push({fcfeNetCashFlow:netCashFlow})
              })
              arrayNetCashFlow.unshift({fcfeNetCashFlow:"Net Cash Flow"});
              if(!boolTvCashFlowBased){
                arrayNetCashFlow.push({fcfeNetCashFlow:formatPositiveAndNegativeValues(terminalValueNetCashFlow)});
              }
            }
            if(result.model === 'FCFF'){
              const terminalValueNetCashFlow = result.terminalYearWorking.netCashFlow;
              result.valuationData.map((response:any)=>{
                const netCashFlow = formatPositiveAndNegativeValues(response.netCashFlow);
                arrayNetCashFlow.push({fcffNetCashFlow:netCashFlow})
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
          const terminalValueType = terminalType ||  'tvCashFlowBased';
        let boolTvCashFlowBased = terminalValueType === 'tvCashFlowBased';    //Checking for default condition
          valuationResult.modelResults.forEach((result)=>{
            if(result.model === 'FCFE'){
              const terminalValueFixedAssets = result.terminalYearWorking.fixedAssets;
              result.valuationData.map((response:any)=>{
                const fixedAssets = formatPositiveAndNegativeValues(response.fixedAssets);
                arrayFixedAssets.push({fcfeFixedAssets:fixedAssets})
              })
              arrayFixedAssets.unshift({fcfeFixedAssets:"Change in fixed assets"});
              if(!boolTvCashFlowBased){
                arrayFixedAssets.push({fcfeFixedAssets:formatPositiveAndNegativeValues(terminalValueFixedAssets)});
              }
            }
            else if(result.model === 'FCFF'){
              const terminalValueFixedAssets = result.terminalYearWorking.fixedAssets;
              result.valuationData.map((response:any)=>{
                const fixedAssets = formatPositiveAndNegativeValues(response.fixedAssets);
                arrayFixedAssets.push({fcffFixedAssets:fixedAssets})
              })
              arrayFixedAssets.unshift({fcffFixedAssets:"Change in fixed assets"});
              if(!boolTvCashFlowBased){
                arrayFixedAssets.push({fcffFixedAssets:formatPositiveAndNegativeValues(terminalValueFixedAssets)});
              }
            }
          })
          return arrayFixedAssets;
        });
        
        hbs.registerHelper('FCFF', () => {
          let arrayfcff = [];
          const terminalValueType = terminalType ||  'tvCashFlowBased';
          let boolTvCashFlowBased = terminalValueType === 'tvCashFlowBased';    //Checking for default condition
          valuationResult.modelResults.forEach((result)=>{
            if(result.model === 'FCFF'){
              const terminalValueFcffBasedOnPat = result.terminalYearWorking.fcff;
            const terminalValueFcffBasedOnLastYear = result.terminalYearWorking.terminalValueBasedOnLastYear;
              result.valuationData.map((response:any)=>{
                const fcff = formatPositiveAndNegativeValues(response.fcff);
                arrayfcff.push({fcff:fcff})
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
        
        hbs.registerHelper('discPeriod', () => {
          let arrayDiscountingPeriod = [];
        const terminalValueType = terminalType ||  'tvCashFlowBased';
        let boolTvCashFlowBased = terminalValueType === 'tvCashFlowBased';    //Checking for default condition
          valuationResult.modelResults.forEach((result)=>{
            if(result.model === 'FCFE'){
              const terminalValueDiscountingPeriod = result.terminalYearWorking.discountingPeriod;
              result.valuationData.map((response:any)=>{
                const discountingPeriod = formatPositiveAndNegativeValues(response.discountingPeriod);
                arrayDiscountingPeriod.push({fcfeDiscountingPeriod:discountingPeriod})
              })
              arrayDiscountingPeriod.unshift({fcfeDiscountingPeriod:"Discounting Period"});
              if(boolTvCashFlowBased){
                arrayDiscountingPeriod.push({fcfeDiscountingPeriod:formatPositiveAndNegativeValues(terminalValueDiscountingPeriod)});
              }
            }
            else if(result.model === 'FCFF'){
              const terminalValueDiscountingPeriod = result.terminalYearWorking.discountingPeriod;
              result.valuationData.map((response:any)=>{
                const discountingPeriod = formatPositiveAndNegativeValues(response.discountingPeriod);
                arrayDiscountingPeriod.push({fcffDiscountingPeriod:discountingPeriod})
              })
              arrayDiscountingPeriod.unshift({fcffDiscountingPeriod:"Discounting Period"});
              if(boolTvCashFlowBased){
                arrayDiscountingPeriod.push({fcffDiscountingPeriod:formatPositiveAndNegativeValues(terminalValueDiscountingPeriod)});
              }
            }
            else if(result.model === 'Excess_Earnings'){
              result.valuationData.map((response:any)=>{
                const discountingPeriod = formatPositiveAndNegativeValues(response.discountingPeriod);
                arrayDiscountingPeriod.push({excessEarningDiscountingPeriod:discountingPeriod})
              })
              arrayDiscountingPeriod.unshift({excessEarningDiscountingPeriod:"Discounting Period"});
            }
          })
          return arrayDiscountingPeriod;
        });
        
        hbs.registerHelper('discFactor', () => {
          let arrayDiscountingFactor = [];
          const terminalValueType = terminalType ||  'tvCashFlowBased';
          let boolTvCashFlowBased = terminalValueType === 'tvCashFlowBased';    //Checking for default condition
          valuationResult.modelResults.forEach((result)=>{
            if(result.model === 'FCFE'){
              const terminalValueDiscountingFactor = result.terminalYearWorking.discountingFactor;
              result.valuationData.map((response:any)=>{
                const discountingFactor = formatPositiveAndNegativeValues(response.discountingFactor);
                arrayDiscountingFactor.push({fcfeDiscountingFactor:discountingFactor})
              })
              arrayDiscountingFactor.unshift({fcfeDiscountingFactor:"Discounting Factor"});
              if(boolTvCashFlowBased){
                arrayDiscountingFactor.push({fcfeDiscountingFactor:formatPositiveAndNegativeValues(terminalValueDiscountingFactor)});
              }
            }
            else if(result.model === 'FCFF'){
              const terminalValueDiscountingFactor = result.terminalYearWorking.discountingFactor;
              result.valuationData.map((response:any)=>{
                const discountingFactor = formatPositiveAndNegativeValues(response.discountingFactor);
                arrayDiscountingFactor.push({fcffDiscountingFactor:discountingFactor})
              })
              arrayDiscountingFactor.unshift({fcffDiscountingFactor:"Discounting Factor"});
              if(boolTvCashFlowBased){
                arrayDiscountingFactor.push({fcffDiscountingFactor:formatPositiveAndNegativeValues(terminalValueDiscountingFactor)});
              }
            }
            else if(result.model === 'Excess_Earnings'){
              result.valuationData.map((response:any)=>{
                const discountingFactor = formatPositiveAndNegativeValues(response.discountingFactor);
                arrayDiscountingFactor.push({excessEarningDiscountingFactor:discountingFactor})
              })
              arrayDiscountingFactor.unshift({excessEarningDiscountingFactor:"Discounting Factor"});
            }
          })
          return arrayDiscountingFactor;
        });
        
        hbs.registerHelper('prsntFCFF', () => {
          let arrayPresentFCFF = [];
          const terminalValueType = terminalType ||  'tvCashFlowBased';
          let boolTvCashFlowBased = terminalValueType === 'tvCashFlowBased';    //Checking for default condition
          valuationResult.modelResults.forEach((result)=>{
            if(result.model === 'FCFE'){
              const terminalValuePresentFCFFBasedOnLastYear = result.terminalYearWorking.presentFCFF || 0;
              result.valuationData.map((response:any)=>{
                const presentFCFF = formatPositiveAndNegativeValues(response.presentFCFF);
                arrayPresentFCFF.push({fcfePresentFCFF:presentFCFF})
              })
              arrayPresentFCFF.unshift({fcfePresentFCFF:result?.model === 'FCFF' ? "Present Value of FCFF" : "Present Value of FCFE"});
              if(boolTvCashFlowBased){
                arrayPresentFCFF.push({fcfePresentFCFF:formatPositiveAndNegativeValues(terminalValuePresentFCFFBasedOnLastYear)});
              }
            }
            else if(result.model === 'FCFF'){
              const terminalValuePresentFCFFBasedOnLastYear = result.terminalYearWorking.presentFCFF || 0;
              result.valuationData.map((response:any)=>{
                const presentFCFF = formatPositiveAndNegativeValues(response.presentFCFF);
                arrayPresentFCFF.push({fcffPresentFCFF:presentFCFF})
              })
              arrayPresentFCFF.unshift({fcffPresentFCFF:result?.model === 'FCFF' ? "Present Value of FCFF" : "Present Value of FCFE"});
              if(boolTvCashFlowBased){
                arrayPresentFCFF.push({fcffPresentFCFF:formatPositiveAndNegativeValues(terminalValuePresentFCFFBasedOnLastYear)});
              }
            }
          })
          return arrayPresentFCFF;
        });
        
        hbs.registerHelper('sumCashFlow', () => {
          let arraySumOfCashFlows = [];
          valuationResult.modelResults.forEach((result)=>{
            if(result.model === 'FCFE'){
              result.valuationData.map((response:any)=>{
                const sumOfCashFlows = formatPositiveAndNegativeValues(response.sumOfCashFlows);
                arraySumOfCashFlows.push({fcfeSumOfCashFlows:sumOfCashFlows})
              })
              arraySumOfCashFlows.unshift({fcfeSumOfCashFlows:"Sum of Discounted Cash Flows"});
            }
            else if(result.model === 'FCFF'){
              result.valuationData.map((response:any)=>{
                const sumOfCashFlows = formatPositiveAndNegativeValues(response.sumOfCashFlows);
                arraySumOfCashFlows.push({fcffSumOfCashFlows:sumOfCashFlows})
              })
              arraySumOfCashFlows.unshift({fcffSumOfCashFlows:"Sum of Discounted  Cash Flows"});
            }
            else if(result.model === 'Excess_Earnings'){
              result.valuationData.map((response:any)=>{
                const sumOfCashFlows = formatPositiveAndNegativeValues(response.sumOfCashFlows);
                arraySumOfCashFlows.push({excessEarningSumOfCashFlows:sumOfCashFlows})
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
        
        hbs.registerHelper('debtDate', () => {
          let arrayDebtOnDate = [];
          valuationResult.modelResults.forEach((result)=>{
            if(result.model === 'FCFE'){
              result.valuationData.map((response:any)=>{
                const debtOnDate = formatPositiveAndNegativeValues(response.debtOnDate);
                arrayDebtOnDate.push({fcfeDebtOnDate:debtOnDate})
              })
              arrayDebtOnDate.unshift({fcfeDebtOnDate:"Less: Debt as on Date"});
            }
            else if(result.model === 'FCFF'){
              result.valuationData.map((response:any)=>{
                const debtOnDate = formatPositiveAndNegativeValues(response.debtOnDate);
                arrayDebtOnDate.push({fcffDebtOnDate:debtOnDate})
              })
              arrayDebtOnDate.unshift({fcffDebtOnDate:"Less: Debt as on Date"});
            }
          })
          return arrayDebtOnDate;
        });
        
        hbs.registerHelper('cashEquvlnt', () => {
          let arrayCashEquivalents = [];
          valuationResult.modelResults.forEach((result)=>{
            if(result.model === 'FCFE'){
              result.valuationData.map((response:any)=>{
                const cashEquivalents = formatPositiveAndNegativeValues(response.cashEquivalents);
                arrayCashEquivalents.push({fcfeCashEquivalents:cashEquivalents})
              })
              arrayCashEquivalents.unshift({fcfeCashEquivalents:"Add: Cash & Cash Equivalents"});
            }
            else if(result.model === 'FCFF'){
              result.valuationData.map((response:any)=>{
                const cashEquivalents = formatPositiveAndNegativeValues(response.cashEquivalents);
                arrayCashEquivalents.push({fcffCashEquivalents:cashEquivalents})
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
                const surplusAssets = formatPositiveAndNegativeValues(response.surplusAssets);
                arraySurplusAssets.push({fcfeSurplusAssets:surplusAssets})
              })
              arraySurplusAssets.unshift({fcfeSurplusAssets:"Add: Surplus Assets/Investments"});
            }
            else if(result.model === 'FCFF'){
              result.valuationData.map((response:any)=>{
                const surplusAssets = formatPositiveAndNegativeValues(response.surplusAssets);
                arraySurplusAssets.push({fcffSurplusAssets:surplusAssets})
              })
              arraySurplusAssets.unshift({fcffSurplusAssets:"Add: Surplus Assets/Investments"});
            }
          })
          return arraySurplusAssets;
        });
        
        hbs.registerHelper('otherAdjustment', () => {
          let arrayOtherAdj = [];
          valuationResult.modelResults.forEach((result)=>{
            if(result.model === 'FCFE'){
              result.valuationData.map((response:any)=>{
                const otherAdj = formatPositiveAndNegativeValues(response.otherAdj);
                arrayOtherAdj.push({fcfeOtherAdj:otherAdj})
              })
              arrayOtherAdj.unshift({fcfeOtherAdj:"Add/Less: Other Adjustments(if any)"});
            }
            else if(result.model === 'FCFF'){
              result.valuationData.map((response:any)=>{
                const otherAdj = formatPositiveAndNegativeValues(response.otherAdj);
                arrayOtherAdj.push({fcffOtherAdj:otherAdj})
              })
              arrayOtherAdj.unshift({fcffOtherAdj:"Add/Less: Other Adjustments(if any)"});
            }
          })
          return arrayOtherAdj;
        });

        hbs.registerHelper('eqtValue', () => {
          let checkiIfStub = false;
          
          let arrayEquityValue = [];
          valuationResult.modelResults.forEach((result)=>{
            if(Array.isArray(result.valuationData) && result.valuationData.some(obj => obj.hasOwnProperty('stubAdjValue'))){
              checkiIfStub=true;
            }
            if(result.model === 'FCFE'){
              result.valuationData.map((response:any)=>{
                const equityValue = formatPositiveAndNegativeValues(response.equityValue);
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
                const equityValue = formatPositiveAndNegativeValues(response.equityValue);
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
                const equityValue = formatPositiveAndNegativeValues(response.equityValue);
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
        
        hbs.registerHelper('stubValue',()=>{
          let arrayStubValue = [];
          valuationResult.modelResults.forEach((result)=>{
            if(result.model === MODEL[0]){
              result.valuationData.map((response:any)=>{
                const stubAdjValue = formatPositiveAndNegativeValues(response.stubAdjValue);
                arrayStubValue.push({fcfeStubAdjValue:stubAdjValue})
              })
              arrayStubValue.unshift({fcfeStubAdjValue:"Add:Stub Period Adjustment"});
            }
            else if (result.model === MODEL[1]){
              result.valuationData.map((response:any)=>{
                const stubAdjValue = formatPositiveAndNegativeValues(response.stubAdjValue);
                arrayStubValue.push({fcffStubAdjValue:stubAdjValue})
              })
              arrayStubValue.unshift({fcffStubAdjValue:"Add:Stub Period Adjustment"});
            }
            else if (result.model ===MODEL[3]){
              result.valuationData.map((response:any)=>{
                const stubAdjValue = formatPositiveAndNegativeValues(response.stubAdjValue);
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
                const equityValueNew = formatPositiveAndNegativeValues(response.equityValueNew);
                arrayProvisionalVal.push({fcfeequityValueNew:equityValueNew})
              })
              arrayProvisionalVal.unshift({fcfeequityValueNew:`Equity Value as on ${this.formatDate(new Date(valuationResult.inputData[0].valuationDate))}`});
            }
            else if (result.model === MODEL[1]){
              result.valuationData.map((response:any)=>{
                const equityValueNew = formatPositiveAndNegativeValues(response.equityValueNew);
                arrayProvisionalVal.push({fcffequityValueNew:equityValueNew})
              })
              arrayProvisionalVal.unshift({fcffequityValueNew:`Equity Value as on ${this.formatDate(new Date(valuationResult.inputData[0].valuationDate))}`});
            }
            else if (result.model ===MODEL[3]){
              result.valuationData.map((response:any)=>{
                const equityValueNew = formatPositiveAndNegativeValues(response.equityValueNew);
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
                const noOfShares = formatPositiveAndNegativeValues(response.noOfShares);
                arrayNoOfShares.push({fcfeNoOfShares:noOfShares})
              })
              arrayNoOfShares.unshift({fcfeNoOfShares:"No. of Shares"});
            }
            else if(result.model === 'FCFF'){
              result.valuationData.map((response:any)=>{
                const noOfShares = formatPositiveAndNegativeValues(response.noOfShares);
                arrayNoOfShares.push({fcffNoOfShares:noOfShares})
              })
              arrayNoOfShares.unshift({fcffNoOfShares:"No. of Shares"});
            }
            else if(result.model === 'Excess_Earnings'){
              result.valuationData.map((response:any)=>{
                const noOfShares = formatPositiveAndNegativeValues(response.noOfShares);
                arrayNoOfShares.push({excessEarningNoOfShares:noOfShares})
              })
              arrayNoOfShares.unshift({excessEarningNoOfShares:"No. of Shares"});
            }
          })
          return arrayNoOfShares;
        });

        hbs.registerHelper('valuePrShare', () => {
          let arrayValuePerShare = [];
          valuationResult.modelResults.forEach((result)=>{
            if(result.model === 'FCFE'){
              result.valuationData.map((response:any)=>{
                const valuePerShare = formatPositiveAndNegativeValues(response.valuePerShare);
                arrayValuePerShare.push({fcfeValuePerShare:valuePerShare})
              })
              arrayValuePerShare.unshift({fcfeValuePerShare:`Value per Share (${valuationResult.inputData[0].currencyUnit})`});
            }
            else if(result.model === 'FCFF'){
              result.valuationData.map((response:any)=>{
                const valuePerShare = formatPositiveAndNegativeValues(response.valuePerShare);
                arrayValuePerShare.push({fcffValuePerShare:valuePerShare})
              })
              arrayValuePerShare.unshift({fcffValuePerShare:`Value per Share (${valuationResult.inputData[0].currencyUnit})`});
            }
            else if(result.model === 'Excess_Earnings'){
              result.valuationData.map((response:any)=>{
                const valuePerShare = formatPositiveAndNegativeValues(response.valuePerShare);
                arrayValuePerShare.push({excessEarningValuePerShare:valuePerShare})
              })
              arrayValuePerShare.unshift({excessEarningValuePerShare:`Value per Share (${valuationResult.inputData[0].currencyUnit})`});
            }
          })
          return arrayValuePerShare;
        });

        hbs.registerHelper('changeInBorrowing', () => {
          let arrayChangeInBorrowings = [];
          const terminalValueType = terminalType ||  'tvCashFlowBased';
        let boolTvCashFlowBased = terminalValueType === 'tvCashFlowBased';    //Checking for default condition
          valuationResult.modelResults.forEach((result)=>{
            if(result.model === 'FCFE'){
              const terminalValueChangeInBorrowings = result.terminalYearWorking.changeInBorrowings;
              result.valuationData.map((response:any)=>{
                const changeInBorrowings = formatPositiveAndNegativeValues(response.changeInBorrowings);
                arrayChangeInBorrowings.push({changeInBorrowings:changeInBorrowings})
              })
              arrayChangeInBorrowings.unshift({changeInBorrowings:"Change in Borrowings"});
              if(!boolTvCashFlowBased){
                arrayChangeInBorrowings.push({changeInBorrowings:formatPositiveAndNegativeValues(terminalValueChangeInBorrowings)});
              }
            }
          })
          return arrayChangeInBorrowings;
        });

        hbs.registerHelper('FCFE', () => {
          let arrayfcff = [];
          const terminalValueType = terminalType ||  'tvCashFlowBased';
        let boolTvCashFlowBased = terminalValueType === 'tvCashFlowBased';    //Checking for default condition
          valuationResult.modelResults.forEach((result)=>{
            if(result.model === 'FCFE'){
              const terminalValueFcffBasedOnPat = result.terminalYearWorking.fcff;
            const terminalValueFcffBasedOnLastYear = result.terminalYearWorking.terminalValueBasedOnLastYear;
              result.valuationData.map((response:any)=>{
                const fcff = formatPositiveAndNegativeValues(response.fcff);
                arrayfcff.push({fcff:fcff})
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

        // excess earning model
        hbs.registerHelper('NetWorth', () => {
          let arrayNetWorth = [];
          valuationResult.modelResults.forEach((result)=>{
            if(result.model === 'Excess_Earnings'){
              result.valuationData.map((response:any)=>{
                const netWorth = formatPositiveAndNegativeValues(response.netWorth);
                arrayNetWorth.push({netWorth:netWorth})
              })
              arrayNetWorth.unshift({netWorth:"Networth"});
            }
          })
          return arrayNetWorth;
        });

        hbs.registerHelper('expctProfitCOE', () => {
          let arrayExpectedProfitCOE = [];
          valuationResult.modelResults.forEach((result)=>{
            if(result.model === 'Excess_Earnings'){
              result.valuationData.map((response:any)=>{
                arrayExpectedProfitCOE.push({expectedProfitCOE:response?.expectedProfitCOE ? parseFloat(response?.expectedProfitCOE).toFixed(2) : response.expectedProfitCOE === 0 ? 0 : ''})
              })
              arrayExpectedProfitCOE.unshift({expectedProfitCOE:"Expected Profit COE"});
            }
          })
          return arrayExpectedProfitCOE;
        });

        hbs.registerHelper('excessRtrn', () => {
          let arrayExcessReturn = [];
          valuationResult.modelResults.forEach((result)=>{
            if(result.model === 'Excess_Earnings'){
              result.valuationData.map((response:any)=>{
                arrayExcessReturn.push({excessReturn:response?.excessReturn ? parseFloat(response?.excessReturn).toFixed(2) : response.excessReturn === 0 ? 0 : ''})
              })
              arrayExcessReturn.unshift({excessReturn:"Excess Return"});
            }
          })
          return arrayExcessReturn;
        });

        hbs.registerHelper('presentValOfExcessReturn', () => {
          let arrayPresentValueOfExcessReturn = [];
          valuationResult.modelResults.forEach((result)=>{
            if(result.model === 'Excess_Earnings'){
              result.valuationData.map((response:any)=>{
                arrayPresentValueOfExcessReturn.push({presentValueOfExcessReturn:response?.presentValueOfExcessReturn ? parseFloat(response?.presentValueOfExcessReturn).toFixed(2) : response.presentValueOfExcessReturn === 0 ? 0 : ''})
              })
              arrayPresentValueOfExcessReturn.unshift({presentValueOfExcessReturn:"Present Value Of Excess Return"});
            }
          })
          return arrayPresentValueOfExcessReturn;
        });

        hbs.registerHelper('bkValue', () => {
          let arrayBookValue = [];
          valuationResult.modelResults.forEach((result)=>{
            if(result.model === 'Excess_Earnings'){
              result.valuationData.map((response:any)=>{
                arrayBookValue.push({bookValue:response?.bookValue ? parseFloat(response?.bookValue).toFixed(2) : response.bookValue === 0 ? 0 : ''})
              })
              arrayBookValue.unshift({bookValue:"Book Value"});
            }
          })
          return arrayBookValue;
        });

        // relative valuation helpers
        // hbs.registerHelper('companies', () => {
        //   let arrayCompany = [];
        //   let isCompany = false;
        //   if( valuationResult.inputData[0].preferenceRatioSelect === RELATIVE_PREFERENCE_RATIO[1]){
        //     isCompany=true;
        //   }
        //   valuationResult.modelResults.forEach((result)=>{
        //     if(result.model === MODEL[2] || result.model === MODEL[4]){
        //       arrayCompany = this.createPrfnceRtio(isCompany ? result.valuationData?.companies : result.valuationData.industries,isCompany);
        //     }
        //   })
        //   return arrayCompany;
        // });

        hbs.registerHelper('relativeVal', () => {
          let arrayPbRatio = [], selectedMultiples = [];
          valuationResult.modelResults.forEach((result)=>{
            if(result.model === MODEL[2] || result.model === MODEL[4]){
              const multiples = result.valuationData?.multiples;
              result.valuationData?.valuation.map((response)=>{
                if(response?.particular === 'pbRatio' && (multiples ? multiples?.pbSelection : true)){
                  const pbRatioHead = {
                    srNo:response.serialNo || 1,
                    particular:'P/B Ratio',
                    avg:'',
                    med:''
                  }
                  const netWorthObj = {
                    srNo:'',
                    particular:'Net Worth Of Company',
                    avg:formatPositiveAndNegativeValues(response.netWorthAvg),
                    med:formatPositiveAndNegativeValues(response.netWorthMed)
                  }
                  const industryObj = {
                    srNo:'',
                    particular:'P/B Ratio of Industry (x)',
                    avg:formatPositiveAndNegativeValues(response.pbRatioAvg),
                    med:formatPositiveAndNegativeValues(response.pbRatioMed)
                  }
                  const fairValEquity = {
                    srNo:'',
                    particular:'Fair Value of Equity',
                    avg:formatPositiveAndNegativeValues(response.pbMarketPriceAvg),
                    med:formatPositiveAndNegativeValues(response.pbMarketPriceMed)
                  }
                  arrayPbRatio.push(pbRatioHead,netWorthObj,industryObj,fairValEquity)
                }
                else if(response?.particular === 'peRatio' && (multiples ? multiples?.peSelection : true)){
                  arrayPbRatio.push({ //make sure to push empty object to have empty space between rows
                    srNo:'',
                    particular:'',
                    avg:'',
                    med:''
                  })
                  const peRatioHead = {
                    srNo:response?.serialNo || 2,
                    particular:'P/E Ratio',
                    avg:'',
                    med:''
                  }
                  const patObj={
                    srNo:'',
                    particular:'Profit after Taxes',
                    avg:formatPositiveAndNegativeValues(response.pat),
                    med:formatPositiveAndNegativeValues(response.pat)
                  }
                  const peRatioIndObj={
                    srNo:'',
                    particular:'P/E Ratio of Industry (x)',
                    avg:formatPositiveAndNegativeValues(response.peRatioAvg),
                    med:formatPositiveAndNegativeValues(response.peRatioMed)
                  }
                  const peRatioMrktPrceObj={
                    srNo:'',
                    particular:'Fair Value of Equity',
                    avg:formatPositiveAndNegativeValues(response.peMarketPriceAvg),
                    med:formatPositiveAndNegativeValues(response.peMarketPriceMed)
                  }
                  arrayPbRatio.push(peRatioHead,patObj,peRatioIndObj,peRatioMrktPrceObj)
                }
                else if(response?.particular === 'ebitda' && (multiples ? multiples?.evEbitdaSelection : true)){
                  arrayPbRatio.push({ //make sure to push empty object to have empty space between rows
                    srNo:'',
                    particular:'',
                    avg:'',
                    med:''
                  })
                  const ebitDatHead = {
                    srNo:response?.serialNo || 3,
                    particular:'EV/EBITDA',
                    avg:'',
                    med:''
                  }
                  const ebitDaObj={
                    srNo:'',
                    particular:'EBITDA',
                    avg:formatPositiveAndNegativeValues(response.ebitda),
                    med:formatPositiveAndNegativeValues(response.ebitda)
                  }
                  const evEbitDaObj={
                    srNo:'',
                    particular:'EV/EBITDA (x)',
                    avg:formatPositiveAndNegativeValues(response.evAvg),
                    med:formatPositiveAndNegativeValues(response.evMed)
                  }
                  const entprseObj={
                    srNo:'',
                    particular:'Enterprise Value',
                    avg:formatPositiveAndNegativeValues(response.enterpriseAvg),
                    med:formatPositiveAndNegativeValues(response.enterpriseMed)
                  }
                  const valDebtObj={
                    srNo:'',
                    particular:'Less:Value of Debt',
                    avg:formatPositiveAndNegativeValues(response.debtAvg),
                    med:formatPositiveAndNegativeValues(response.debtMed)
                  }
                  const cashAndCashEquObj={
                    srNo:'',
                    particular:'Add:Cash and cash equivalent',
                    avg:formatPositiveAndNegativeValues(response.cashEquivalent),
                    med:formatPositiveAndNegativeValues(response.cashEquivalent)
                  }
                  const valEquityObj={
                    srNo:'',
                    particular:'Value of Equity',
                    avg:formatPositiveAndNegativeValues(response.ebitdaEquityAvg),
                    med:formatPositiveAndNegativeValues(response.ebitdaEquityMed)
                  }
                  arrayPbRatio.push(ebitDatHead,ebitDaObj,evEbitDaObj,entprseObj,valDebtObj,cashAndCashEquObj,valEquityObj)
                }
                else if(response?.particular === 'sales' && (multiples ? multiples?.psSelection : true)){
                  arrayPbRatio.push({ //make sure to push empty object to have empty space between rows
                    srNo:'',
                    particular:'',
                    avg:'',
                    med:''
                  })
                  const salesHead = {
                    srNo:response?.serialNo || 4,
                    particular:'Price to Sales',
                    avg:'',
                    med:''
                  }
                  const companySalesObj = {
                    srNo:'',
                    particular:'Sales of company',
                    avg:formatPositiveAndNegativeValues(response.salesAvg),
                    med:formatPositiveAndNegativeValues(response.salesMed)
                  }
                  const salesRatioObj = {
                    srNo:'',
                    particular:'P/S Ratio (x)',
                    avg:formatPositiveAndNegativeValues(response.salesRatioAvg),
                    med:formatPositiveAndNegativeValues(response.salesRatioMed)
                  }
                  const salesEquityObj = {
                    srNo:'',
                    particular:'Value of Equity',
                    avg:formatPositiveAndNegativeValues(response.salesEquityAvg?.toFixed(2)),
                    med:formatPositiveAndNegativeValues(response.salesEquityMed?.toFixed(2))
                  }
                  arrayPbRatio.push(salesHead,companySalesObj,salesRatioObj,salesEquityObj)
                }
                else if(response?.particular === 'result'){
                  arrayPbRatio.push({ //make sure to push empty object to have empty space between rows
                    srNo:'',
                    particular:'',
                    avg:'',
                    med:''
                  })
                  const resultHead = {
                    srNo:'',
                    particular:'Average value of Equity',
                    avg:formatPositiveAndNegativeValues(response.avgPricePerShareAvg),
                    med:formatPositiveAndNegativeValues(response.avgPricePerShareMed)
                  }
                  // const illiquidityObj = {
                  //   srNo:'',
                  //   particular:'Less:Discount',
                  //   avg:formatPositiveAndNegativeValues(response.locAvg),
                  //   med:formatPositiveAndNegativeValues(response.locMed)
                  // }
                  // const finalPriceObj = {
                  //   srNo:'',
                  //   particular:'Final Price',
                  //   avg:formatPositiveAndNegativeValues(response.finalPriceAvg),
                  //   med:formatPositiveAndNegativeValues(response.finalPriceMed)
                  // }
                  const sharesObj = {
                    srNo:'',
                    particular:'No. of Shares',
                    avg:formatPositiveAndNegativeValues(response.outstandingShares),
                    med:formatPositiveAndNegativeValues(response.outstandingShares)
                  }
                  const valPrShareObj = {
                    srNo:'',
                    particular:`Fair Value per Share  (${valuationResult.inputData[0].currencyUnit})`,
                    avg:formatPositiveAndNegativeValues(response.fairValuePerShareAvg),
                    med:formatPositiveAndNegativeValues(response.fairValuePerShareMed)
                  }
                  arrayPbRatio.push(resultHead,sharesObj,valPrShareObj)
                }
              })
            }
          
          })
          if(valuationResult.inputData[0].preferenceRatioSelect === RELATIVE_PREFERENCE_RATIO[0]){
            arrayPbRatio.forEach(item => delete item.med);   
          }
          return arrayPbRatio;
        });

        hbs.registerHelper('companyName',()=>{
          if(valuationResult.inputData[0].company)
            return valuationResult.inputData[0].company;
          return '';
        })

        hbs.registerHelper('strdate',()=>{
          if(valuationResult.inputData[0].valuationDate)
            return this.formatDate(new Date(valuationResult.inputData[0].valuationDate));
          return '';
        })

        hbs.registerHelper('checkPreferenceRatio',()=>{
          if( valuationResult.inputData[0].preferenceRatioSelect === RELATIVE_PREFERENCE_RATIO[1])
            return true;
          return false;
        })
        
        hbs.registerHelper('ccmVPSMetricCheck', (requestedType) => {
          const ccmMetricType = ccmSubType || 'average';
          if(ccmMetricType){
            if(ccmMetricType === requestedType) return true;
            return false;
          }
          return false;
        })

        hbs.registerHelper('checkHead',(txt,val)=>{
          if(typeof txt === 'number' && val === 'srNo'){
            return true;
          }
          if(txt === '' && val === 'particular'){
            return true;
          }
          if(txt === 'Value per share' || txt === 'Equity Value' || txt === 'Firm Value'|| txt === 'Net Current Assets' || txt === 'Non Current Assets' || MARKET_APPROACH_REPORT_LINE_ITEM.includes(txt))
          {
            return true;
          }
          return false
        })

        hbs.registerHelper('formatPositiveAndNegativeNumber',(val)=>{
          if(!val)
            return '-';
          return formatPositiveAndNegativeValues(val);
        })

        hbs.registerHelper('generatedOn',(txt,val)=>{
          if(valuationResult?.createdAt)
            return new Date(valuationResult?.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
          return '';
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

        hbs.registerHelper('checkPeriod',()=>{
          if(valuationResult.inputData[0].discountingPeriod)
            return valuationResult.inputData[0].discountingPeriod;
          return '';
        })

        hbs.registerHelper('isRelativeOrCTM',()=>{
          let method = '';
          valuationResult.modelResults.forEach((result)=>{
            if(result.model === MODEL[2]) return method = 'Comparable Companies';
            if(result.model === MODEL[4]) return method = 'Comparable Industries';
          })
          return method;
        })

        hbs.registerHelper('ifStub',(options)=>{
          let checkiIfStub = false;
          valuationResult.modelResults.forEach((result)=>{
            if(Array.isArray(result.valuationData) && result.valuationData.some(obj => obj.hasOwnProperty('stubAdjValue'))){
              checkiIfStub = true;
            }
          })
              if(checkiIfStub){
                return options.fn(this)
              }
              else{
                return options.inverse(this);
              }
            
          })
        hbs.registerHelper('ifEquityValProvisional',(options)=>{
          let checkiIfprovisional = false;
          valuationResult.modelResults.forEach((result)=>{
            if(Array.isArray(result.valuationData) && result.valuationData.some(obj => obj.hasOwnProperty('equityValueNew'))){
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
     

        // Nav helpers
        hbs.registerHelper('iterateNAVData',(data)=>{
          let navData = [];
          valuationResult.modelResults.forEach((result)=>{
              if(result.model === MODEL[5]){
                  navData = Object.values(result.valuationData);
              }
          })
          return this.reportService.navHTMLBinding(navData, 23);
      })

        hbs.registerHelper('companies', () => {
          let arrayCompany = [];
          let isCompany = false;
          if( valuationResult.inputData[0].preferenceRatioSelect === RELATIVE_PREFERENCE_RATIO[1]){
            isCompany=true;
          }
          valuationResult.modelResults.forEach((result)=>{
            if(result.model === MODEL[2] || result.model === MODEL[4]){
              const companiesMultiplesRecaculated = this.createPrfnceRtio(isCompany ? result.valuationData?.companies : result.valuationData.industries,isCompany);
               arrayCompany = this.loadPostDiscountMultiples(companiesMultiplesRecaculated, valuationResult.inputData[0].discountRateValue);
            }
          })
          return arrayCompany;
        });

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

        hbs.registerHelper('relevantDate',()=>{
          if(valuationResult.inputData[0].valuationDate)
            return convertEpochToPlusOneDate(new Date(valuationResult.inputData[0].valuationDate));
          return '';
        })

        hbs.registerHelper('sharePriceDataF30', ()=>{
          let sharePriceDetails = [];
          valuationResult.modelResults.map((response)=>{
            if(response.model === MODEL[7] && response.valuationData?.sharePriceLastNinetyDays){
             sharePriceDetails = response.valuationData.sharePriceLastNinetyDays;
            }
          })
          const first40Elements = sharePriceDetails.slice(0, 30);
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
          const next40Elements = sharePriceDetails.slice(30, 70);
          return next40Elements
        })
        hbs.registerHelper('sharePriceDataN30', ()=>{
          let sharePriceDetails = [];
          valuationResult.modelResults.map((response)=>{
            if(response.model === MODEL[7] && response.valuationData?.sharePriceLastNinetyDays){
             sharePriceDetails = response.valuationData.sharePriceLastNinetyDays;
            }
          })
          const next30Elements = sharePriceDetails.slice(30, 60);
          return next30Elements
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
        hbs.registerHelper('sharePriceDataN30Length', ()=>{
          let sharePriceDetails = [];
          valuationResult.modelResults.map((response)=>{
            if(response.model === MODEL[7] && response.valuationData?.sharePriceLastNinetyDays){
             sharePriceDetails = response.valuationData.sharePriceLastNinetyDays;
            }
          })
          const next30Elements = sharePriceDetails.slice(30, 60);
          return next30Elements?.length ? true : false;
        })
        hbs.registerHelper('sharePriceDataRemaining', ()=>{
          let sharePriceDetails = [];
          valuationResult.modelResults.map((response)=>{
            if(response.model === MODEL[7] && response.valuationData?.sharePriceLastNinetyDays){
             sharePriceDetails = response.valuationData.sharePriceLastNinetyDays;
            }
          })
          const remainingElements = sharePriceDetails.slice(60);
          return remainingElements
        })
        hbs.registerHelper('sharePriceDataRemainingLength', ()=>{
          let sharePriceDetails = [];
          valuationResult.modelResults.map((response)=>{
            if(response.model === MODEL[7] && response.valuationData?.sharePriceLastNinetyDays){
             sharePriceDetails = response.valuationData.sharePriceLastNinetyDays;
            }
          })
          const remainingElements = sharePriceDetails.slice(60);
          return remainingElements?.length ? true : false;
        })

        hbs.registerHelper('updateDateFormat',(val)=>{
          return formatDateToShortForm(val);
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
        hbs.registerHelper('formatValue',(value)=>{
          return formatPositiveAndNegativeValues(value);
        })
        hbs.registerHelper('currencyUnit',()=>{
          if(valuationResult.inputData[0].currencyUnit)
            return valuationResult.inputData[0].currencyUnit;
          return 'INR';
        })
        hbs.registerHelper('modelWeightageTab', ()=>{
         if(!modelWeightageData?.modelValue?.length) return [];

          const createTab = (weightObj, srNo) => {
            const wgtdVal = formatPositiveAndNegativeValues(weightObj.weightedValue);
            const indctVal = formatPositiveAndNegativeValues(weightObj.indicatedValue);
            return {
              wghtSrNo:srNo,
              model:ALL_MODELS[`${weightObj.model}`],
              indctVal: indctVal === '-' ? '0' : indctVal,
              wght: weightObj.weight * 100,
              wghtdVal: wgtdVal === '-' ? '0' : wgtdVal
            }
          }

          let totalWeightage = [], ctr = 1;
          for(const indWeights of modelWeightageData?.modelValue){
            totalWeightage.push(createTab(indWeights, ctr));
            ctr++;
          }
          return totalWeightage;
        }) 

        hbs.registerHelper('modelWeightageLength', ()=>{
          return valuationResult.inputData[0]?.model?.length > 1 ? (modelWeightageData && modelWeightageData?.modelValue?.length > 1) : false;
        })

        hbs.registerHelper('totalModWeightPrShare', ()=>{
          return formatPositiveAndNegativeValues(modelWeightageData?.weightedVal);
        })
      }  

      loadPostDiscountMultiples(companyData, discountRateValue){
        let postMultipleAverage:any = [], postMultipleMedian:any = [], modifiedMultiples = companyData || [];
        if(discountRateValue){
          companyData.map((indCompanyData:any)=>{  
            if(indCompanyData.company === 'Average'){
              postMultipleAverage = {
                company: 'Post Discount Multiple (Average)',
                peRatio: formatPositiveAndNegativeValues(convertToNumberOrZero(indCompanyData.peRatio) * (1-discountRateValue/100)),
                pbRatio: formatPositiveAndNegativeValues(convertToNumberOrZero(indCompanyData.pbRatio) * (1-discountRateValue/100)),
                ebitda: formatPositiveAndNegativeValues(convertToNumberOrZero(indCompanyData.ebitda) * (1-discountRateValue/100)),
                sales: formatPositiveAndNegativeValues(convertToNumberOrZero(indCompanyData.sales) * (1-discountRateValue/100))
              }
            }
            if(indCompanyData.company === 'Median'){
              postMultipleMedian = {
                company: 'Post Discount Multiple (Median)',
                peRatio: formatPositiveAndNegativeValues(convertToNumberOrZero(indCompanyData.peRatio) * (1-discountRateValue/100)),
                pbRatio: formatPositiveAndNegativeValues(convertToNumberOrZero(indCompanyData.pbRatio) * (1-discountRateValue/100)),
                ebitda: formatPositiveAndNegativeValues(convertToNumberOrZero(indCompanyData.ebitda) * (1-discountRateValue/100)),
                sales: formatPositiveAndNegativeValues(convertToNumberOrZero(indCompanyData.sales) * (1-discountRateValue/100))
              }
            }
          })
          modifiedMultiples.push(postMultipleAverage, postMultipleMedian);
          return modifiedMultiples
        }
      }

      createPrfnceRtio(data,isCompany){
        const isSelectedExists = data.some((indCompanies: any) => 'isSelected' in indCompanies);
        const arrayCompany = [];
          data.map((response:any)=>{
            if(
              isSelectedExists ? 
              (
                response.isSelected || 
                response.company === 'Average' || 
                response.company === 'Median'
              ) : true
            ){
              const obj={
                company:isCompany ? response?.company : response.industry,
                peRatio:isCompany && response.peRatio  ? parseFloat(response.peRatio).toFixed(2) : !isCompany && response.currentPE ?  parseFloat(response.currentPE).toFixed(2) : response.peRatio === 0 ? 0 : response.currentPE === 0 ? 0 :  '',
                pbRatio:isCompany && response.pbRatio ? parseFloat(response.pbRatio).toFixed(2) : !isCompany &&  response.pbv ? parseFloat(response.pbv).toFixed(2) : response.pbRatio === 0 ? 0 : response.pbv === 0 ? 0 : '',
                ebitda:isCompany && response.ebitda ? parseFloat(response.ebitda).toFixed(2) : !isCompany && response.evEBITDA_PV ? parseFloat(response.evEBITDA_PV).toFixed(2) :  response.ebitda === 0 ? 0 : response.evEBITDA_PV === 0 ? 0 :  '',
                sales:isCompany && response.sales ? parseFloat(response.sales).toFixed(2) : !isCompany && response.priceSales ? parseFloat(response.priceSales).toFixed(2) : response.sales === 0 ? 0 : response.priceSales === 0 ? 0 : '',
              }
              arrayCompany.push(obj)
            }
          })
          // if(isCompany){
          //   const avgObj = {
          //     'company':'Average',
          //     'peRatio':this.findAverage(isCompany ? 'peRatio' : 'currentPE' ,data).toFixed(2),
          //     'pbRatio':this.findAverage(isCompany ? 'pbRatio' : 'pbv',data).toFixed(2),
          //     'ebitda':this.findAverage(isCompany ? 'ebitda' : 'evEBITDA_PV',data).toFixed(2),
          //     'sales': this.findAverage(isCompany ? 'sales' : 'priceSales',data).toFixed(2)
          //   }
          //   const medObj = {
          //     'company':'Median',
          //     'peRatio':this.findMedian(isCompany ? 'peRatio' : 'currentPE',data).toFixed(2),
          //     'pbRatio':this.findMedian(isCompany ? 'pbRatio' : 'pbv',data).toFixed(2),
          //     'ebitda':this.findMedian(isCompany ? 'ebitda' : 'evEBITDA_PV',data).toFixed(2),
          //     'sales': this.findMedian(isCompany ? 'sales' : 'priceSales',data).toFixed(2)
          //   }
          //   arrayCompany.push(avgObj,medObj);
          // }
          
        return arrayCompany;
      }

      formatDate(date: Date): string {
        const months = [
          'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
          'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
        ];
    
        const day = date.getDate();
        const month = months[date.getMonth()];
        const year = date.getFullYear();
    
        return `${month} ${day}, ${year}`;
      }
    
      findAverage(type:any,company:any){
        const numbers = company.map((c: any) => {
          if (c.company !== 'Median') {
            return c[type];
          } else {
            return null; 
          }
        }).filter((value: any) => value !== null);
        const sum = numbers.reduce(
          (accumulator:any, currentValue:any) => accumulator + currentValue,
          0
        );
        const average = sum / numbers.length;
        return average
      }
    
      findMedian(type: string,company:any) {
        const numbers = company.map((c: any) => {
          if (c.company !== 'Average') {
            return c[type];
          } else {
            return null; 
          }
        }).filter((value: any) => value !== null);
      
        numbers.sort((a: any, b: any) => a - b);
        const middleIndex = Math.floor(numbers.length / 2);
        const isEvenLength = numbers.length % 2 === 0;
      
        if (isEvenLength) {
          return (numbers[middleIndex - 1] + numbers[middleIndex]) / 2;
        } else {
          return numbers[middleIndex];
        }
      }

  async modifyExcelSheet(data, request) {
    try {
      switch(data.excelSheet){
        case 'P&L':
          const uploadDirPl = path.join(process.cwd(),'uploads');
          const filePathPl = path.join(uploadDirPl, data.excelSheetId);
          const updateProfitAndLossExcel = await this.updateExcel(filePathPl,data,data.excelSheet);
          const fileType = path.extname(filePathPl);
          const stats = fs.statSync(filePathPl);
          const fileSize = stats.size;
          
          const payload = {
            processStateId: data.processStateId,
            fileName:updateProfitAndLossExcel.modifiedFileName,
            fileSize,
            fileType,
            structure:{
              profitAndLossSheetStructure:updateProfitAndLossExcel.data,
              rows:updateProfitAndLossExcel.rows
            },
            sheetName:data.excelSheet
          }
          await this.updateBSorPLexcelArchive(payload, request).toPromise();
          await this.excelArchiveService.removeAssessmentOfWCbyProcessStateId(data.processStateId);
          await this.excelArchiveService.removeCashFlowByProcessStateId(data.processStateId);
          await this.getSheetData(updateProfitAndLossExcel.modifiedFileName, 'Cash Flow', request, data.processStateId).toPromise();
          await this.updateBalanceSheetRetainersAndCashEquivalent(updateProfitAndLossExcel.modifiedFileName, request, data.processStateId);
          await this.getSheetData(updateProfitAndLossExcel.modifiedFileName, 'Assessment of Working Capital', request, data.processStateId).toPromise();

          return (
            {
              data:updateProfitAndLossExcel.data,
              status:true,
              msg:'Excel Updated Successfully',
              originalFileName:updateProfitAndLossExcel.originalFileName,
              modifiedFileName:updateProfitAndLossExcel.modifiedFileName
            }
          );
        break;

        case 'BS':
          let containsBSonly = false;
          if(
            (
              (
                data?.model.includes(MODEL[2]) || data?.model.includes(MODEL[5])
              ) &&
              data?.model?.length === 1
            ) ||
            (
              (
                data?.model.includes(MODEL[2]) && data?.model.includes(MODEL[5])
              ) &&
              data?.model?.length === 2
            )
          ){ containsBSonly = true};

          const uploadDirBs = path.join(process.cwd(),'uploads');
          const filePathBs = path.join(uploadDirBs, data.excelSheetId);
  
          const fileBsType = path.extname(filePathBs);
          const statsBs = fs.statSync(filePathBs);
          const fileBsSize = statsBs.size;
          const updateBalanceSheetExcel = await this.updateExcel(filePathBs,data,data.excelSheet);
          if(!containsBSonly){
            await this.excelArchiveService.removeAssessmentOfWCbyProcessStateId(data.processStateId);
            await this.excelArchiveService.removeCashFlowByProcessStateId(data.processStateId);
          }

           const bspayload = {
            processStateId: data.processStateId,
            fileName:updateBalanceSheetExcel.modifiedFileName,
            fileSize:fileBsSize,
            fileType:fileBsType,
            structure:{
              balanceSheetStructure:updateBalanceSheetExcel.data,
              rows:updateBalanceSheetExcel.rows
            },
            sheetName:data.excelSheet
          }
          let adjustRetainersAndCashEqv =  await this.updateBSorPLexcelArchive(bspayload, request).toPromise();
          await this.updateBSorPLexcelArchive(bspayload, request).toPromise();
          if(!containsBSonly){
            await this.getSheetData(updateBalanceSheetExcel.modifiedFileName, 'Cash Flow', request, data.processStateId).toPromise();
            adjustRetainersAndCashEqv = await this.updateBalanceSheetRetainersAndCashEquivalent(updateBalanceSheetExcel.modifiedFileName, request, data.processStateId);
            await this.getSheetData(updateBalanceSheetExcel.modifiedFileName, 'Assessment of Working Capital', request, data.processStateId).toPromise();
          }

          return (
            {
              data:adjustRetainersAndCashEqv.data,
              status:true,
              msg:'Excel Updated Successfully',
              originalFileName:updateBalanceSheetExcel.originalFileName,
              modifiedFileName:updateBalanceSheetExcel.modifiedFileName
            }
          );
        break;

        case 'Assessment of Working Capital':
          // const uploadDirAssessmentSheet = path.join(__dirname, '../../uploads');
          // const uploadDirAssessmentSheet = path.join(process.cwd(),'uploads');
          // const filePathAssessmentSheet = path.join(uploadDirAssessmentSheet, data.excelSheetId);
          // const updatedExcelAssessment = await this.appendSheetInExcel(filePathAssessmentSheet,data);
  
          // if(updatedExcelAssessment.status){
          //   const formatExcel = await this.formatExcelResult(updatedExcelAssessment);
          //   return (
          //     {
          //       data:formatExcel,
          //       status:true,
          //       msg:'Excel Updated Successfully',
          //       originalFileName:updatedExcelAssessment.originalFileName,
          //       modifiedFileName:updatedExcelAssessment.modifiedFileName
          //     }
          //   );
          // }
          // else{
          //   return of(
          //     {
          //       msg:'Excel update failed',
          //       updatedExcelAssessment
          //     }
          //   )
          // }

        break;

        case 'Rule 11 UA':
          // const uploadDirRuleElevenUa = path.join(__dirname, '../../uploads');
          const uploadDirRuleElevenUa = path.join(process.cwd(),'uploads');
          const filePathRuleElevenUa = path.join(uploadDirRuleElevenUa, data.excelSheetId);

          const fileRUAType = path.extname(filePathRuleElevenUa);
          const statsRUA = fs.statSync(filePathRuleElevenUa);
          const fileRUASize = statsRUA.size;

          const updateRuleElevenUaExcel = await this.updateExcel(filePathRuleElevenUa,data,data.excelSheet);

          const ruleElevenUapayload = {
            processStateId: data.processStateId,
            fileName:updateRuleElevenUaExcel.modifiedFileName,
            fileSize:fileRUASize,
            fileType:fileRUAType,
            structure:{
              ruleElevenUaStructure:updateRuleElevenUaExcel.data,
              rows:updateRuleElevenUaExcel.rows
            },
            sheetName:data.excelSheet
          }
          await this.updateRuleElevenUaArchive(ruleElevenUapayload, request).toPromise();

          return (
            {
              data:updateRuleElevenUaExcel.data,
              status:true,
              msg:'Excel Updated Successfully',
              originalFileName:updateRuleElevenUaExcel.originalFileName,
              modifiedFileName:updateRuleElevenUaExcel.modifiedFileName
            }
          );
      }
    } catch (error) {
      throw error;
    }
  }

    async formatExcelResult(excelData){
      let arrayExcel = [];
      let index = 0;
      const emptyLineIndex = excelData.data.findIndex(item=>item?.Particulars ==="  ");
    if(emptyLineIndex !== -1){
      excelData.data.splice(emptyLineIndex,1)
    }
      for await(let item of excelData.data){
        const { Particulars, ...rest } = item;
        arrayExcel.push({lineEntry:V2_ASSESSMENT_OF_WORKING_CAPITAL[index]?.lineEntry,...rest});
        index++;
      }
     return arrayExcel;  
    }
    async formatCashFlowExcelResult(excelData){
      let arrayExcel = [];
      let index = 0;
      const emptyLineIndex = excelData.findIndex(item=>item?.Particulars ==="  ");
    if(emptyLineIndex !== -1){
      excelData.splice(emptyLineIndex,1)
    }
      for await(let item of excelData){
        const { Particulars, ...rest } = item;
        arrayExcel.push({lineEntry:CASH_FLOW[index]?.lineEntry,...rest});
        index++;
      }
     return arrayExcel;  
    }

  async appendSheetInExcel(filepath,data){
    try{
      let sheet;
      const workbook:any = new ExcelJS.Workbook();
      await workbook.xlsx.readFile(filepath);
      let alreadyExistAssessmentSheet = workbook.getWorksheet('Assessment of Working Capital');
      if(!alreadyExistAssessmentSheet){
        sheet = workbook.addWorksheet('Assessment of Working Capital');

        const headers = Object.keys(data[0]);
        sheet.addRow(headers);

        const headerRow = sheet.getRow(1);

        headerRow.eachCell((cell) => {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: '195478' } // Background color
          };
          cell.font = {
            size: 11,
            bold: true,
            color: { argb: 'FFFFFF' },
          };
            cell.alignment = {
              vertical: 'middle',
              horizontal: 'center',
          };
        });

        sheet.autoFilter = {
            from: { row: 1, column: 1 },
            to: { row: 1, column: headers.length },
        };

        data.forEach((row, index) => {
          const dataRow = sheet.addRow(Object.values(row));

          dataRow.eachCell((cell, cellNumber) => {
            cell.font = {
              size: 11,
              color: { argb: '333333' },
            };
            cell.alignment = {
                vertical: 'middle',
                wrapText: true,
                horizontal: typeof cell.value === 'number' ? 'right' : 'left'
            };
            
            cell.numFmt = '#,##0.00'
             
          });
        });

        sheet.columns.forEach((column) => {
          let maxLength = 0;
          column.eachCell({ includeEmpty: true }, (cell) => {
              const length = cell.value ? cell.value.toString().length : 0;
              maxLength = Math.max(length, maxLength);
          });

          column.width = maxLength < 20 ? 20 : maxLength + 2; // Minimum width set to 20 for readability
        });

        await workbook.xlsx.writeFile(filepath);
        await this.updateFinancialSheet(filepath);
        const evaluatedValues = await this.readAndEvaluateExcel(filepath)
      
        return {
          msg:'Excel Appended Successfully',
          status:true,
          data:evaluatedValues.formattedData,
          rows:evaluatedValues.indexing
        };
      }
      else {
        if(data.length === 0){
          const evaluatedValues = await this.readAndEvaluateExcel(filepath);
          return {
            msg:'Excel Fetched Successfully',
            status:true,
            data: evaluatedValues.formattedData,
            rows: evaluatedValues.indexing
          }
        }
        // else{
        //   let  editedFilePath='';
        //   // const uploadDir = path.join(__dirname, '../../uploads');
        //   const uploadDir = path.join(process.cwd(),'uploads');
        //   if(data?.excelSheetId.includes('edited')){
        //      editedFilePath = path.join(uploadDir, `${data?.excelSheetId}`);
        //   }
        //   else{
        //     editedFilePath = path.join(uploadDir, `edited-${data?.excelSheetId}`);
        //   }
        //   const workbook= new ExcelJS.Workbook();
        //   await workbook.xlsx.readFile(filepath);
        //   let worksheet:any = workbook.getWorksheet('Assessment of Working Capital');

        //   // manage dynamic formulas
        //   let startingCalcuationIndex,maxCalculationIndex, summationVlaue=0;
        //     for await(const cells of data.cellData) {
        //       await new Promise<void>(async (resolve) => {
        //         worksheet.getCell(`${cells.cellAddress}`).value = data.newValue;
        //         if(cells.sysCode === 3009){
        //           startingCalcuationIndex = 3;
        //           maxCalculationIndex = 10;
        //         }
        //         else{
        //           startingCalcuationIndex = 14;
        //           maxCalculationIndex = 20;
        //         }
        //         for(let i = startingCalcuationIndex;i<=maxCalculationIndex;i++){
        //           const checkIfValue = isNotEmpty(worksheet.getCell(`${cells.columnCell}${i}`)?.value);
        //            summationVlaue =summationVlaue + (checkIfValue ?  parseFloat(worksheet.getCell(`${cells.columnCell}${i}`).value) : 0);
        //         }
    
        //       for await(let mainData of ASSESSMENT_DATA){
        //         await new Promise<void>(async (resolve) => {

        //             const dependentArray = mainData.lineEntry?.dependent;
        //             const sysCode = mainData.lineEntry?.sysCode;
        //             if (dependentArray && sysCode && dependentArray.includes(cells.sysCode)) { //update total
        //               // let formulae = mainData.lineEntry?.formula.replace(/currentOne/g, cells.columnCell);
        //               // console.log(summationVlaue,"formulae")
                      
        //                 // const cell:any = worksheet.getCell(`${cells.columnCell}${mainData.lineEntry?.rowNumber}`).value;
        //                 worksheet.getCell(`${cells.columnCell}${mainData.lineEntry?.rowNumber}`).value = summationVlaue?.toFixed(2);
                        
        //              }

        //             if (dependentArray && sysCode && dependentArray.includes(cells.sysCode) && mainData.lineEntry.sysCode === 3020) { // update net operating assets
        //                 worksheet.getCell(`${cells.columnCell}${mainData.lineEntry?.rowNumber}`).value = (worksheet.getCell(`${cells.columnCell}11`)?.value - worksheet.getCell(`${cells.columnCell}21`)?.value).toFixed(2);
        //             }

        //             if (dependentArray && sysCode && dependentArray.includes(cells.sysCode) && mainData.lineEntry.sysCode === 3021) { // update change in nca 
        //               let  firstRowName=[]
        //               let letterIndex = 0; //starting capital letter in ascii format
                      
        //               worksheet.eachRow({ includeEmpty: true }, (row, rowNumber) => {
        //                 row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        //                   if (rowNumber === 1 && cell.text) {
        //                     firstRowName.push(letterIndex);
        //                   }
        //                   letterIndex++;
        //                 });
        //               });

        //               for await (let columns of firstRowName){
        //                 const currentColumn =   String.fromCharCode(65 + columns);
        //                 const previousColumn =  String.fromCharCode(65 + columns - 1);
                        
        //                 if( previousColumn !== '@' ){
        //                   const currentCellValue = await worksheet.getCell(`${currentColumn}23`)?.value;
        //                   const previousCellValue =await worksheet.getCell(`${previousColumn}23`)?.value;
        //                   const updatedValue =(previousCellValue - currentCellValue).toFixed(2);
        //                   if (!isNaN(parseInt(updatedValue)) ) {
        //                     worksheet.getCell(`${currentColumn}${mainData.lineEntry?.rowNumber}`).value = updatedValue;
        //                   }
        //                   else{
        //                     worksheet.getCell(`${currentColumn}${mainData.lineEntry?.rowNumber}`).value ='';

        //                   }
        //                 }
        //               }
        //             }
        //          resolve();
        //           })
        //         }
        //       resolve();
        //     })
        //     }
          
        // await workbook.xlsx.writeFile(editedFilePath); // Changed by SHAQUE 24-Feb-2024 due to still error in assessment of WC// Rechanged by SANKET 26-Feb-2024, removed below promise statement
        // // await new Promise<void>(async (resolve) => {
        // //   workbook.xlsx.writeFile(editedFilePath);
        // //   resolve();
        // // });

        // await this.updateFinancialSheet(editedFilePath);
        //   const evaluatedValues = await this.readAndEvaluateExcel(editedFilePath);
        //   return {
        //     msg:'Excel Updated Successfully',
        //     status:true,
        //     data:evaluatedValues,
        //     originalFileName: `${data?.excelSheetId}`,
        //     modifiedFileName: data?.excelSheetId.includes('edited') ? `${data?.excelSheetId}` : `edited-${data?.excelSheetId}`,
        //   }
        // }
      }
    }
    catch(error){
      throw  error
    }
  }
  async appendCashFlowSheetInExcel(filepath,data){
    try{
      let sheet;
      const workbook:any = new ExcelJS.Workbook();
      await workbook.xlsx.readFile(filepath);
      let alreadyExistCashFlowSheet = workbook.getWorksheet('Cash Flow');
      if(!alreadyExistCashFlowSheet){
        sheet = workbook.addWorksheet('Cash Flow');

        const headers = Object.keys(data[0]);
        sheet.addRow(headers);

        const headerRow = sheet.getRow(1);

        headerRow.eachCell((cell) => {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: '195478' } // Background color
        };
        cell.font = {
          size: 11,
          bold: true,
          color: { argb: 'FFFFFF' },
        };
          cell.alignment = {
            vertical: 'middle',
            horizontal: 'center',
        };
        });

        sheet.autoFilter = {
            from: { row: 1, column: 1 },
            to: { row: 1, column: headers.length },
        };

        data.forEach((row, index) => {
          const dataRow = sheet.addRow(Object.values(row));

          dataRow.eachCell((cell, cellNumber) => {
              cell.font = {
                  size: 11,
                  color: { argb: '333333' },
              };
              cell.alignment = {
                vertical: 'middle',
                wrapText: true,
                horizontal: typeof cell.value === 'number' ? 'right' : 'left'
              };
              cell.numFmt = '#,##0.00';
          });
        });

        sheet.columns.forEach((column) => {
          let maxLength = 0;
          column.eachCell({ includeEmpty: true }, (cell) => {
              const length = cell.value ? cell.value.toString().length : 0;
              maxLength = Math.max(length, maxLength);
          });

          column.width = maxLength < 20 ? 20 : maxLength + 2; // Minimum width set to 20 for readability
        });

        await workbook.xlsx.writeFile(filepath);
        await this.updateFinancialSheet(filepath);
        const evaluatedValues = await this.readAndEvaluateCashFlowExcel(filepath)
      
        return {
          msg:'Excel Appended Successfully',
          status:true,
          data:evaluatedValues.formattedData,
          rows:evaluatedValues.indexing
        };
      }
      else {
          const evaluatedValues = await this.readAndEvaluateCashFlowExcel(filepath);
          return {
            msg:'Excel Fetched Successfully',
            status:true,
            data:evaluatedValues.formattedData,
            rows:evaluatedValues.indexing
          }
        // }
      //   else{
      //     let  editedFilePath='';
      //     // const uploadDir = path.join(__dirname, '../../uploads');
      //     const uploadDir = path.join(process.cwd(),'uploads');
      //     if(data?.excelSheetId.includes('edited')){
      //        editedFilePath = path.join(uploadDir, `${data?.excelSheetId}`);
      //     }
      //     else{
      //       editedFilePath = path.join(uploadDir, `edited-${data?.excelSheetId}`);
      //     }
      //     const workbook= new ExcelJS.Workbook();
      //     await workbook.xlsx.readFile(filepath);
      //     let worksheet:any = workbook.getWorksheet('Assessment of Working Capital');

      //     // manage dynamic formulas
      //     let startingCalcuationIndex,maxCalculationIndex, summationVlaue=0;
      //       for await(const cells of data.cellData) {
      //         await new Promise<void>(async (resolve) => {
      //           worksheet.getCell(`${cells.cellAddress}`).value = data.newValue;
      //           if(cells.sysCode === 3009){
      //             startingCalcuationIndex = 3;
      //             maxCalculationIndex = 10;
      //           }
      //           else{
      //             startingCalcuationIndex = 14;
      //             maxCalculationIndex = 20;
      //           }
      //           for(let i = startingCalcuationIndex;i<=maxCalculationIndex;i++){
      //             const checkIfValue = isNotEmpty(worksheet.getCell(`${cells.columnCell}${i}`)?.value);
      //              summationVlaue =summationVlaue + (checkIfValue ?  parseFloat(worksheet.getCell(`${cells.columnCell}${i}`).value) : 0);
      //           }
    
      //         for await(let mainData of ASSESSMENT_DATA){
      //           await new Promise<void>(async (resolve) => {

      //               const dependentArray = mainData.lineEntry?.dependent;
      //               const sysCode = mainData.lineEntry?.sysCode;
      //               if (dependentArray && sysCode && dependentArray.includes(cells.sysCode)) { //update total
      //                 // let formulae = mainData.lineEntry?.formula.replace(/currentOne/g, cells.columnCell);
      //                 // console.log(summationVlaue,"formulae")
                      
      //                   // const cell:any = worksheet.getCell(`${cells.columnCell}${mainData.lineEntry?.rowNumber}`).value;
      //                   worksheet.getCell(`${cells.columnCell}${mainData.lineEntry?.rowNumber}`).value = summationVlaue?.toFixed(2);
                        
      //                }

      //               if (dependentArray && sysCode && dependentArray.includes(cells.sysCode) && mainData.lineEntry.sysCode === 3020) { // update net operating assets
      //                   worksheet.getCell(`${cells.columnCell}${mainData.lineEntry?.rowNumber}`).value = (worksheet.getCell(`${cells.columnCell}11`)?.value - worksheet.getCell(`${cells.columnCell}21`)?.value).toFixed(2);
      //               }

      //               if (dependentArray && sysCode && dependentArray.includes(cells.sysCode) && mainData.lineEntry.sysCode === 3021) { // update change in nca 
      //                 let  firstRowName=[]
      //                 let letterIndex = 0; //starting capital letter in ascii format
                      
      //                 worksheet.eachRow({ includeEmpty: true }, (row, rowNumber) => {
      //                   row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      //                     if (rowNumber === 1 && cell.text) {
      //                       firstRowName.push(letterIndex);
      //                     }
      //                     letterIndex++;
      //                   });
      //                 });

      //                 for await (let columns of firstRowName){
      //                   const currentColumn =   String.fromCharCode(65 + columns);
      //                   const previousColumn =  String.fromCharCode(65 + columns - 1);
                        
      //                   if( previousColumn !== '@' ){
      //                     const currentCellValue = await worksheet.getCell(`${currentColumn}23`)?.value;
      //                     const previousCellValue =await worksheet.getCell(`${previousColumn}23`)?.value;
      //                     const updatedValue =(previousCellValue - currentCellValue).toFixed(2);
      //                     if (!isNaN(parseInt(updatedValue)) ) {
      //                       worksheet.getCell(`${currentColumn}${mainData.lineEntry?.rowNumber}`).value = updatedValue;
      //                     }
      //                     else{
      //                       worksheet.getCell(`${currentColumn}${mainData.lineEntry?.rowNumber}`).value ='';

      //                     }
      //                   }
      //                 }
      //               }
      //            resolve();
      //             })
      //           }
      //         resolve();
      //       })
      //       }
          
      //   await workbook.xlsx.writeFile(editedFilePath); // Changed by SHAQUE 24-Feb-2024 due to still error in assessment of WC// Rechanged by SANKET 26-Feb-2024, removed below promise statement
      //   // await new Promise<void>(async (resolve) => {
      //   //   workbook.xlsx.writeFile(editedFilePath);
      //   //   resolve();
      //   // });

      //   await this.updateFinancialSheet(editedFilePath);
      //     const evaluatedValues = await this.readAndEvaluateExcel(editedFilePath);
      //     return {
      //       msg:'Excel Updated Successfully',
      //       status:true,
      //       data:evaluatedValues,
      //       originalFileName: `${data?.excelSheetId}`,
      //       modifiedFileName: data?.excelSheetId.includes('edited') ? `${data?.excelSheetId}` : `edited-${data?.excelSheetId}`,
      //     }
      //   }
      }
    }
    catch(error){
      throw  error
    }
  }

  async updateExcel(filepath,data,sheetName, deleteAssessmentSheet?){
    const workbook= new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filepath);
    let worksheet:any = workbook.getWorksheet(sheetName);
    const structure:any = sheetName === 'P&L' ? V2_PROFIT_LOSS : sheetName === 'BS' ? V2_BALANCE_SHEET : sheetName === 'Rule 11 UA' ? RULE_ELEVEN_UA : ''; 

    let  editedFilePath='';
    // const uploadDir = path.join(__dirname, '../../uploads');
    const uploadDir = path.join(process.cwd(),'uploads');
    if(data?.excelSheetId.includes('edited')){
        editedFilePath = path.join(uploadDir, `${data?.excelSheetId}`);
    }
    else{
      editedFilePath = path.join(uploadDir, `edited-${data?.excelSheetId}`);
    }
    for await(const cells of data.cellData) {
      worksheet.getCell(`${cells.cellAddress}`).value = data.newValue;
      await new Promise<void>(async (resolve) => {      
        for await(let mainData of structure){
          await new Promise<void>(async (resolve) => {
            const dependentArray = mainData.lineEntry?.dependent;
            const sysCode = mainData.lineEntry?.sysCode;
            if (dependentArray && sysCode && dependentArray.includes(cells.sysCode)) {     //updating cells
              let formulae = mainData.lineEntry?.formula.replace(/currentOne/g, cells.columnCell);
              const formulaComputation = await this.formulaComputations(formulae,worksheet)
              worksheet.getCell(`${cells.columnCell}${mainData.lineEntry?.rowNumber}`).value = formulaComputation;
            }
         resolve();
          })
        }
      resolve();
    })
    }

    if((sheetName === EXCEL_CONVENTION['P&L'].key || sheetName === EXCEL_CONVENTION['BS'].key) && !deleteAssessmentSheet){

      const sheet = workbook.getWorksheet(EXCEL_CONVENTION['Cash Flow'].key);
      if (sheet) {
          workbook.removeWorksheet(sheet.id);
      } else {
          console.log(`Sheet with name "${EXCEL_CONVENTION['Cash Flow'].key}" not found.`);
      }
    }

    if(sheetName === EXCEL_CONVENTION['BS'].key && !deleteAssessmentSheet){

      const sheet = workbook.getWorksheet(EXCEL_CONVENTION['Assessment of Working Capital'].key);
      if (sheet) {
          workbook.removeWorksheet(sheet.id);
      } else {
          console.log(`Sheet with name "${EXCEL_CONVENTION['Assessment of Working Capital'].key}" not found.`);
      }
    }
    

await workbook.xlsx.writeFile(editedFilePath,sheetName);
await this.updateFinancialSheet(editedFilePath);
const evaluatedValues = await this.fetchSheetData(editedFilePath,sheetName);

let excelData;
if(sheetName === EXCEL_CONVENTION['P&L'].key){
  excelData = evaluatedValues.profitAndLossSheetStructure;
}
else if(sheetName === EXCEL_CONVENTION['BS'].key){
  excelData = evaluatedValues.balanceSheetStructure;
}
else if(sheetName === EXCEL_CONVENTION['Rule 11 UA'].key){
  excelData = evaluatedValues.ruleElevenUaStructure;
}
return {
  msg:'Excel Updated Successfully',
  status:true,
  data:excelData,
  rows:evaluatedValues.rows,
  originalFileName: `${data?.excelSheetId}`,
  modifiedFileName: data?.excelSheetId.includes('edited') ? `${data?.excelSheetId}` : `edited-${data?.excelSheetId}`,
}
  }

  async formulaComputations(formula,worksheet){
    const operations = formula.split(/([+*/-])/);

    let result = 0;
    let operator = '+';
    operations.forEach(part => {
      if (['+', '-', '*', '/'].includes(part)) {
        operator = part;
      } else {
        const operand =  worksheet.getCell(part)?.value?.result ?  worksheet.getCell(part)?.value?.result : !isNaN(worksheet.getCell(part)?.value) ? worksheet.getCell(part)?.value : 0 ; 
        switch (operator)   {
          case '+':
            result += operand;
            break;
          case '-':
            result -= operand;
            break;
          case '*':
            result *= operand;
            break;
          case '/':
            result /= operand;
            break;
        }
      }
    });
    return result;
  }
  async fetchSheetData(filepath,sheetName){

    const workBook = await this.readFile(filepath)
    const sheetData = xlsx.utils.sheet_to_json(workBook.Sheets[sheetName]);

    if(sheetName === 'BS' || sheetName === 'P&L'){
      
      sheetData.forEach((row:any) => {
          // for (let columns in row) {
          //   if (typeof row[columns] === 'string') {
          //     row[columns] = row[columns].replace(/\r\n/g, '');
          // }
        
          //   if (typeof row[columns] === 'number') {
          //     row[columns] = parseFloat(row[columns].toFixed(2));
          //   }
          //   if (typeof columns === 'string') {
          //     const cleanedColumn = columns.trim().replace(/^\s+/g, '').replace(/\r\n/g, '');
          //     if (columns !== cleanedColumn) {
          //       row[cleanedColumn] = row[columns];
          //       delete row[columns];
          //     }
          //   }
          // }
            const orderedEntries = Object.entries(row).map(([key, value]) => {
              if (typeof value === 'string') {
                  value = value.replace(/\r\n/g, '');
              }
              if (typeof value === 'number') {
                  value = parseFloat(value.toFixed(2));
              }
              return [key.trim().replace(/^\s+/g, '').replace(/\r\n/g, ''), value];
          });
          row = Object.fromEntries(orderedEntries);
        });   
    }
        const modifiedData = await this.transformData(sheetData);
        const updateStructure = await this.createStructure(modifiedData,sheetName);
        return updateStructure;
  }
  async  readAndEvaluateExcel(filepath){
 
    let jsonData = xlsx.utils.sheet_to_json((await this.readFile(filepath)).Sheets['Assessment of Working Capital'], { header: 1 });
          
    const head:any = jsonData[0];
    const formattedData = [];
    let indexing = 0;
    for (let i = 1; i < jsonData.length; i++) {
      const row = jsonData[i];
      const obj = {};

      for (let j = 0; j < head.length; j++) {
          obj[head[j]] = row[j] || row[j] === '' ? row[j] : null;
      }

      formattedData.push(obj);
      indexing++;
    }
    // const emptyLineIndex = formattedData.findIndex(item=>item.Particulars ==="  ");
    // if(emptyLineIndex !== -1){
    //   formattedData.splice(emptyLineIndex,1);
    // }
  
  return {formattedData, indexing};
}
  async  readAndEvaluateCashFlowExcel(filepath){
 
    let jsonData = xlsx.utils.sheet_to_json((await this.readFile(filepath)).Sheets['Cash Flow'], { header: 1 });
          
    const head:any = jsonData[0];
    const formattedData = [];
    let indexing = 0;
    for (let i = 1; i < jsonData.length; i++) {
      const row:any = jsonData[i];
      if(!row.length) continue;
      const obj = {};

      for (let j = 0; j < head.length; j++) {
          obj[head[j]] = row[j] || row[j] === '' ? row[j] : null;
      }

      formattedData.push(obj);
      indexing++;
    }

    const updatedCashFlow = await this.formatCashFlowExcelResult(formattedData);
  return {formattedData:updatedCashFlow ,indexing};
}
// Older assessment function for generating assessment payload structure 
// async generatePayload(years,balanceSheet){
//     let transformedObject = years.reduce((acc, year, index, array) => {
//       if (index < array.length - 1) {
//           const nextYear = array[index + 1];
//           acc[`${year}-${nextYear}`] = '';
//       }
//       return acc;
//   }, {});
//   let provisionalDate = balanceSheet['B1'].v
//   transformedObject = {
//     [provisionalDate]: '',
//     ...transformedObject
// };
//   // console.log(transformedObject,"transformed object")
//   const payload = ASSESSMENT_DATA.map((data,index)=>{
//     if(data.lineEntry.sysCode===3001 || data.lineEntry.sysCode === 3011){
//       const transformedEntry = { Particulars: data.lineEntry?.particulars };
//       for (const key in transformedObject) {
//           transformedEntry[key] = null;
//       }
//       return transformedEntry;
//     }

//     return {
//     Particulars:data.lineEntry?.particulars,
//     ...transformedObject
//     }
    
//   })

//   const calculatedPayload = await this.assessmentCalculations(payload,balanceSheet);
//   const emptySpaceOne = calculatedPayload.findIndex(item=>item.Particulars === 'Operating Liabilities');
//   if(emptySpaceOne !== -1){
//     calculatedPayload.splice(emptySpaceOne,0,{Particulars: '  '})
//   }
//   const emptySpaceTwo = calculatedPayload.findIndex(item=>item.Particulars === 'Net Operating Assets');
//   if(emptySpaceTwo !== -1){
//     calculatedPayload.splice(emptySpaceTwo,0,{Particulars: '  '})
//   }
 
//   return calculatedPayload;
// }


async generateAssessmentOfWCpayload(processStateId){
    const loadExcelArchive:any = await this.excelArchiveService.fetchExcelByProcessStateId(processStateId);
    const balanceSheetData = loadExcelArchive.balanceSheetdata;
    const yearsList:any = extractYearsFromKeys(balanceSheetData[0]);
    let provisionalDate = getDateKey(balanceSheetData[0]);
    let transformedObject = yearsList.reduce((acc, year, index, array) => {
      if (index < array.length - 1) {
          const nextYear = array[index + 1];
          acc[`20${year}-20${nextYear}`] = '';
      }
      return acc;
  }, {});
  transformedObject = {
    [provisionalDate]: '',
    ...transformedObject
};
  const payload = V2_ASSESSMENT_OF_WORKING_CAPITAL.map((data,index)=>{
    if(data.lineEntry.sysCode===9001 || data.lineEntry.sysCode === 9011){
      const transformedEntry = { Particulars: data.lineEntry?.particulars };
      for (const key in transformedObject) {
          transformedEntry[key] = null;
      }
      return transformedEntry;
    }

    return {
    Particulars:data.lineEntry?.particulars,
    ...transformedObject
    }
    
  })

  const calculatedPayload = await this.assessmentCalculations(payload, processStateId, provisionalDate);
  // const emptySpaceOne = calculatedPayload.findIndex(item=>item.Particulars === 'Operating Liabilities');
  // if(emptySpaceOne !== -1){
  //   calculatedPayload.splice(emptySpaceOne,0,{Particulars: '  '})
  // }
  // const emptySpaceTwo = calculatedPayload.findIndex(item=>item.Particulars === 'Net Operating Assets');
  // if(emptySpaceTwo !== -1){
  //   calculatedPayload.splice(emptySpaceTwo,0,{Particulars: '  '})
  // }
 
  return calculatedPayload;
}

async generateCashFlowPayload(processStateId){
  const loadExcelArchive:any = await this.excelArchiveService.fetchExcelByProcessStateId(processStateId);
    const balanceSheetData = loadExcelArchive.balanceSheetdata;
    const yearsList:any = extractYearsFromKeys(balanceSheetData[0]);
    let provisionalDate = getDateKey(balanceSheetData[0]);
    let transformedObject = yearsList.reduce((acc, year, index, array) => {
      if (index < array.length - 1) {
          const nextYear = array[index + 1];
          acc[`20${year}-20${nextYear}`] = '';
      }
      return acc;
  }, {});
  transformedObject = {
    [provisionalDate]: '',
    ...transformedObject
};
const payload = CASH_FLOW.map((data,index)=>{
  if(data.lineEntry.sysCode === 7001 || data.lineEntry.sysCode === 7003 || data.lineEntry.sysCode === 7009 || data.lineEntry.sysCode === 7023 || data.lineEntry.sysCode === 7029){
    const transformedEntry = { Particulars: data.lineEntry?.particulars };
    for (const key in transformedObject) {
      transformedEntry[key] = null;
    }
    if(data.lineEntry?.romanIndex){
      transformedEntry['Sr No'] = data.lineEntry.romanIndex;
    }
    else{
      transformedEntry['Sr No'] = null;
    }
      return transformedEntry;
  }
  if(data.lineEntry?.romanIndex){
    return {
      ['Sr No']:data.lineEntry.romanIndex,
      Particulars:data.lineEntry?.particulars,
      ...transformedObject
    }
  }
  
  return {
    ['Sr No']:null,
    Particulars:data.lineEntry?.particulars,
    ...transformedObject
  }
  
})
  const calculatedPayload = await this.cashFlowCalculations(payload,processStateId, provisionalDate);
  return calculatedPayload;
}

// Older assessment of WC function to calculate assessment sheet (Manual process)
// async assessmentCalculations(payload,balanceSheet){
//   /*
//   *This function gets called twice
//   *Once while appending assessment sheet for the first time
//   *Second time when you modify assessment sheet [Recalculation purpose]
//   */
//   await Promise.all(payload.map(async (data,i) => {
//     let keysToProcess = Object.keys(data).filter(key => key !== 'Particulars');
//         if (i === 1) {

//             for (const key of keysToProcess) {
//                 data[key] = (await getCellValue(
//                     balanceSheet,
//                     `${columnsList[keysToProcess.indexOf(key) ] + sheet2_BSObj.tradeReceivablesRow}`
//                 ))?.toFixed(2);
//             }
//         }
//         if(i === 2){

//           for (const key of keysToProcess) {
//               data[key] = (await getCellValue(
//                   balanceSheet,
//                   `${columnsList[keysToProcess.indexOf(key) ] + sheet2_BSObj.unbilledRevenuesRow}`
//               ))?.toFixed(2);
//           }
//         }
//         if(i === 3){

//           for (const key of keysToProcess) {
//               data[key] = (await getCellValue(
//                   balanceSheet,
//                   `${columnsList[keysToProcess.indexOf(key) ] + sheet2_BSObj.inventoriesRow}`
//               ))?.toFixed(2);
//           }
//         }
//         if(i === 4){

//           for (const key of keysToProcess) {
//               data[key] = (await getCellValue(
//                   balanceSheet,
//                   `${columnsList[keysToProcess.indexOf(key)] + sheet2_BSObj.advancesRow}`
//               ))?.toFixed(2);
//           }
//         }
//         if(i === 5){

//           for (const key of keysToProcess) {
//             /*
//             *Please make sure to re-update/comment whichever formula want to remove directly in this function block [ related to asssessment sheet only ]
//             *If don't, will make you cry
//             */
//             // data[key] = (await getCellValue(
//             //     balanceSheet,
//             //     `${columnsList[keysToProcess.indexOf(key) ] + sheet2_BSObj.shortTermInvestmentsRow}`
//             // ))?.toFixed(2);
//              data[key] = 0;
//           }
//         }
//         if(i === 6){

//           for (const key of keysToProcess) {
//               data[key] = (await getCellValue(
//                   balanceSheet,
//                   `${columnsList[keysToProcess.indexOf(key) ] + sheet2_BSObj.otherCurrentAssetsRow}`
//               ))?.toFixed(2);
//           }
//         }
//         if(i === 7){

//           for (const key of keysToProcess) {
//               data[key] = (await getCellValue(
//                   balanceSheet,
//                   `${columnsList[keysToProcess.indexOf(key) ] + sheet2_BSObj.otherNonCurrentAssetsRow}`
//               ))?.toFixed(2);
//           }

//         }
       
//         if(i === 9){

//           for await (const key of keysToProcess) {
//               data[key] = (parseFloat(payload[1][key] ?? 0) + parseFloat(payload[2][key] ?? 0) + parseFloat(payload[3][key] ?? 0) + parseFloat(payload[4][key] ?? 0) + parseFloat(payload[5][key] ?? 0) + parseFloat(payload[6][key] ?? 0) + parseFloat(payload[7][key] ?? 0)).toFixed(2);
//           }
//         }
//         if(i===11){

//           for (const key of keysToProcess) {
//             data[key] = (await getCellValue(
//                 balanceSheet,
//                 `${columnsList[keysToProcess.indexOf(key)] + sheet2_BSObj.tradePayablesRow}`
//             ))?.toFixed(2);
//         }
//         }
//         if(i===12){

//           for (const key of keysToProcess) {
//             data[key] = (await getCellValue(
//                 balanceSheet,
//                 `${columnsList[keysToProcess.indexOf(key)] + sheet2_BSObj.employeePayablesRow}`
//             ))?.toFixed(2);
//           }
//         }
//         if(i === 13){

//           for (const key of keysToProcess) {
//             data[key] = (await getCellValue(
//                 balanceSheet,
//                 `${columnsList[keysToProcess.indexOf(key) ] + sheet2_BSObj.lcPayablesRow}`
//             ))?.toFixed(2);
//           }
//         }
//         if(i === 14){

//           for (const key of keysToProcess) {
//             data[key] = (await getCellValue(
//                 balanceSheet,
//                 `${columnsList[keysToProcess.indexOf(key) ] + sheet2_BSObj.otherCurrentLiabilitiesRow}`
//             ))?.toFixed(2);
//           }
//         }
//         if(i === 15){

//           for (const key of keysToProcess) {
//             data[key] = (await getCellValue(
//                 balanceSheet,
//                 `${columnsList[keysToProcess.indexOf(key) ] + sheet2_BSObj.shortTermProvisionsRow}`
//             ))?.toFixed(2);
//           }
//         }
//         if(i === 16){

//           for (const key of keysToProcess) {
//             data[key] = (await getCellValue(
//                 balanceSheet,
//                 `${columnsList[keysToProcess.indexOf(key) ] + sheet2_BSObj.longTermProvisionRow}`
//             ))?.toFixed(2);
//           }
//         }
//         if(i === 18){
//           for await(const key of keysToProcess) {
//             data[key] = (parseFloat(payload[11][key] ?? 0) + parseFloat(payload[12][key] ?? 0) + parseFloat(payload[13][key] ?? 0) + parseFloat(payload[14][key] ?? 0) + parseFloat(payload[15][key] ?? 0) + parseFloat(payload[16][key] ?? 0)).toFixed(2); 
//         }
//       }
//       if(i ===19){ // add net operating liablities in excel
//         for await(const key of keysToProcess) {
//           data[key] = (parseFloat(payload[9][key] ?? 0) - parseFloat(payload[18][key] ?? 0)).toFixed(2); 
//         }
//       }
//       if(i ===20){
//         for await(const key of keysToProcess) { // add change in nca in excel
//           if(keysToProcess.indexOf(key) < keysToProcess.length-1){
//                 data[ keysToProcess[  keysToProcess.indexOf(key)+1]] = (parseFloat(payload[19][key] ?? 0) - parseFloat(payload[19][`${await keysToProcess[await keysToProcess.indexOf(key)+1]}`] ?? 0)).toFixed(2); 
//            }
//       }
//       }
// }));
// return payload
// }

async assessmentCalculations(payload, processStateId, provDate){
  try{
    const excelArchive:any = await this.excelArchiveService.fetchExcelByProcessStateId(processStateId);
    const balanceSheetRowCount = excelArchive?.balanceSheetRowCount || 0;

    /**
     * The BTree package import is little wonky
     * Note: [ Instead of SortedMap instance, use BTree instance ]
     */
    const balanceSheetExcelBtree = new BTree();

    if(balanceSheetRowCount){
      const balanceSheetData:any = excelArchive.balanceSheetdata;
      for await (const indBSArchive of balanceSheetData){
        const {lineEntry, ...rest} = indBSArchive;
        balanceSheetExcelBtree.set(indBSArchive.lineEntry.particulars, rest);
      } 
    }

    let indexing = 0;

    for await(const indStructure of payload){
      let keysToProcess = Object.keys(indStructure).filter(key => key !== 'Particulars');

       /**
       * [Outer IF condition] 
       * Index 0 = Operating Assets:
       * Index 9 = Operating Liabilities
       * Used for ignoring headers, 
       * Since we dont do any calculations for header rows
       * 
       * [Inner IF condition]
       * Index 21 = Change In NCA
       * We want to handle special cases where
       * need to ignore provisional date/year column and begin with next column
       * 
       * Special Cases
       * Removed Deferred Tax Asset
       * Removed Deferred Tax Liability
       */

       if(indexing !== 0 && indexing !== 9){
        if(indexing !== 21){
          for await (const key of keysToProcess){
            indStructure[key] = await assessmentOfWCformulas(balanceSheetExcelBtree, indStructure.Particulars, key, payload, keysToProcess);
          }
        }
        else{
          for await (const key of keysToProcess){
            if(keysToProcess[keysToProcess.indexOf(key)+1]){
              indStructure[keysToProcess[keysToProcess.indexOf(key)+1]] = await assessmentOfWCformulas(balanceSheetExcelBtree, indStructure.Particulars, keysToProcess[keysToProcess.indexOf(key)+1], payload, keysToProcess);
            }
          }
        }
      }
      indexing++;
    }
    return payload;
  }
  catch(error){
    throw error;
  }
}

async cashFlowCalculations(payload, processStateId, provDate){
  try{
    let firstColumnKey;
    const excelArchive:any = await this.excelArchiveService.fetchExcelByProcessStateId(processStateId);
    const profitLossSheetRowCount = excelArchive?.profitLossSheetRowCount || 0;
    const balanceSheetRowCount = excelArchive?.balanceSheetRowCount || 0;
    /**
     * The BTree package import is little wonky
     * Note: [ Instead of SortedMap instance, use BTree instance ]
     */
    const sortedProfitLossBtree = new BTree();
    const sortedBalanceSheetBtree = new BTree();

    if(profitLossSheetRowCount && balanceSheetRowCount){
      const profitLossData:any = excelArchive.profitLossSheetdata;
      const balanceSheetData:any = excelArchive.balanceSheetdata;

      for await (const indPLArchive of profitLossData){
        const {lineEntry, 'Sr no.': srNo, ...rest} = indPLArchive; 
        sortedProfitLossBtree.set(indPLArchive.lineEntry.particulars, rest )
      }
      for await (const indBSArchive of balanceSheetData){
        const {lineEntry, ...rest} = indBSArchive; 
        sortedBalanceSheetBtree.set(indBSArchive.lineEntry.particulars, rest);
        if(!firstColumnKey){
          firstColumnKey = Object.keys(
                            Object.keys(indBSArchive)
                            .sort((a, b) => 
                              (/\d{2}-\d{2}-\d{4}/.test(a) ? -1 : 1)
                            )
                            .reduce((acc, key) => 
                              ({ ...acc, [key]: indBSArchive[key] }), {})
                            )
                            .filter((key,index) => 
                              index === 2
                          );
        }
      }
    }
    //#region INFO 
     /**
       * [Outer IF condition] -- outerIgnoredIndexes
       * Index 0 = Operating Cash Flow:
       * Index 2 = Adjustments for:
       * Index 8 = Working capital changes:
       * Index 22 = Cash flows from investing activities
       * Index 28 = Cash flows from financing activities
       * Used for ignoring headers, 
       * Since we dont do any calculations for header rows
       * 
       * [Inner IF condition] -- innerHandledIndexes
       * Index 9 = (Increase) / Decrease in trade and other receivables
       * Index 10 = (Increase) / Decrease in inventories
       * Index 11 = (Increase) / Decrease in Other Current Assets
       * Index 12 = (Increase) / Decrease in Loans & Advances
       * Index 13 = (Increase) / Decrease in Tax Assets
       * Index 14 = Increase / (Decrease) in trade payables
       * Index 15 = Increase / (Decrease) in  other payables
       * Index 16 = Increase / (Decrease) in provisions and other current Liabilities
       * Index 17 = Increase / (Decrease) in Non-Current Liabilities
       * Index 18 = Increase / (Decrease) in Tax Liabilities
       * Index 23 = Purchase/Sale  of property, plant and equipment
       * Index 26 = Acquisition of investments
       * Index 29 = Proceed from issue of share capital
       * Index 30 = Proceeds/Repayment from long-term borrowings
       * Index 31 = Proceeds/Repayment Short-term borrowings
       * Index 32 = Proceeds / (repayment) of lease liability, net
       * Index 33 = Share Application money pending
       * Index 37 = Cash and cash equivalents at beginning of period
       * We want to handle special cases where
       * need to ignore provisional date/year column and begin with next column
       */
      //#endregion INFO
    let indexing = 0;
    const outerIgnoredIndexes = new Set(CASHFLOW_HEADER_LINE_ITEM);
    const innerHandledIndexes = new Set(CASHFLOW_LINE_ITEMS_SKIP);
    for await (const indStructure of payload) {
      const keysToProcess:any = Object.keys(indStructure).filter(key => key !== 'Particulars' && key !== 'Sr No');

      if (!outerIgnoredIndexes.has(indStructure.Particulars)) {
        for await (const key of keysToProcess) {
          const i = keysToProcess.indexOf(key);
          if (!innerHandledIndexes.has(indStructure.Particulars)) {
            indStructure[key] = await cashFlowFormulas(
              sortedProfitLossBtree,
              sortedBalanceSheetBtree,
              indStructure.Particulars,
              key,
              payload,
              firstColumnKey,
              keysToProcess,
            );
          } else {
            const nextKey = keysToProcess[i + 1];
            if(!nextKey) continue;
            indStructure[nextKey] = await cashFlowFormulas(
              sortedProfitLossBtree,
              sortedBalanceSheetBtree,
              indStructure.Particulars,
              nextKey,
              payload,
              firstColumnKey,
              keysToProcess,
            );
          }
        }
      }
      indexing++;
    }
    const sort = sortArrayOfObjects(payload, provDate);
    return sort;

  }catch(error){
    throw error
  }
}

async createStructure(data,sheetName){
  data.splice(0,1) // removing first element from array, since its consist only column headers
  
  let balanceSheetStructure = [];
  let profitAndLossSheetStructure = [];
  let ruleElevenUaStructure = [];
  let slumpSaleStructure = [];
  if(sheetName === 'BS'){
    let rows = 0;

      for await (const indBSArchive of data){
        for await (const BSstructure of V2_BALANCE_SHEET){
          if(BSstructure.lineEntry.particulars === indBSArchive.Particulars){
            const { Particulars, ...rest } = indBSArchive;
            balanceSheetStructure.push({lineEntry:BSstructure.lineEntry,...rest});
            rows ++;
          }
        }
    }
    return { balanceSheetStructure, rows};
  }
  else if(sheetName === 'P&L'){
    let rows = 0;
    for await (const indPLArchive of data){
      for await (const PLstructure of V2_PROFIT_LOSS){
        if(PLstructure.lineEntry.particulars === indPLArchive.Particulars){
        const { Particulars, ...rest } = indPLArchive;
          profitAndLossSheetStructure.push({lineEntry:PLstructure.lineEntry,...rest});
          rows ++;
        }
      }
  }
    return {profitAndLossSheetStructure, rows};
  }
  else if(sheetName === 'Rule 11 UA'){
    let rows = 0;
    data.map((element)=>{
      const {Particulars,...rest} = element; 
      for (const lineItems of RULE_ELEVEN_UA){
        if(element.Particulars === lineItems.lineEntry.particulars){
          ruleElevenUaStructure.push({lineEntry:lineItems.lineEntry,...rest});
          rows ++;
        }
      }
    })
    return {ruleElevenUaStructure, rows};
  }
  else if(sheetName === 'Slump Sale'){
    let rows = 0
    data.map((element)=>{
      const {Particulars,...rest} = element; 
      for (const lineItems of SLUMP_SALE){
        if(element.Particulars === lineItems.lineEntry.particulars){
          slumpSaleStructure.push({lineEntry:lineItems.lineEntry,...rest})
          rows ++;
        }
      }
    })
    return {slumpSaleStructure,rows};
  }
}

async updateFinancialSheet(filepath){
  try{
    const base64 = await fs.readFileSync(filepath).toString('base64');
      const fileName = filepath.split('\\');
      const data = {
        filename: path.basename(`${fileName[fileName.length-1]}`),
        base64Document: base64
      }
      return await this.thirdpartyApiAggregateService.upsertExcelInS3(data.base64Document,data.filename)
  }catch(error){
    return {
      error:error,
      status:false,
      msg:'Financial sheet upload failed'
    }
  }
}

async pushInitialFinancialSheet(formData, fileName?){
  try{
    // const uploadDir = path.join(__dirname, '../../uploads');
    const uploadDir = path.join(process.cwd(),'uploads');
    const filePath = path.join(uploadDir, formData.filename);

    let file = fs.readFileSync(filePath).toString('base64');
    return await this.thirdpartyApiAggregateService.upsertExcelInS3(file, fileName || formData.filename)
  }
  catch(error){
    return {
      error:error,
      msg:'uploading financial sheet in s3 failed',
      status : false
    }
  }
}

async fetchUserInfo(request){

  const KCGuard = new KeyCloakAuthGuard();
  const userInfo =await KCGuard.fetchAuthUser(request).toPromise();
  // console.log(userInfo,"user Info")
  return { userInfo }
}

async uploadExcelProcess(formData, processId, modelName, request){
  try{
    let processStateId = processId;
    const {validationStat, errorStack} = await this.validateExcelTemplate(formData, modelName);
    if(validationStat) throw new NotFoundException(errorStack.join('\n')).getResponse();

    if(processStateId && processStateId !== "null") await this.excelArchiveService.removeExcelByProcessId(processStateId);

    const uploadedFileData: any =  await this.pushInitialFinancialSheet(formData);

    const boolProcessIdInvalid = !processStateId || processStateId === "null";
    
    const exportedExcelResponse:any =  await this.uploadExportableExcelInS3(formData);

    if(!exportedExcelResponse?.excelSheetId) throw new Error(exportedExcelResponse).message;

    const processStateModel ={
      firstStageInput:{
        excelSheetId:uploadedFileData.excelSheetId,
        exportExcelId:exportedExcelResponse.excelSheetId,
        isExcelModified:false
      },
      step:0
    }
    const processState = await this.processStateManagerService.upsertProcess(request, processStateModel,boolProcessIdInvalid ? null : processId);
    processStateId = processState.processId;
    
    await this.loadExcelJSONintoDB(modelName, uploadedFileData, request, processStateId);
    return {excelSheetId:uploadedFileData.excelSheetId, processId: processStateId};

  }
  catch(error){
    throw error;
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

async validateExcelTemplate(formData, modelType){
  if(modelType === XL_SHEET_ENUM[1]) return {validationStat: false};
  const errorSet = [];

  let workbook = xlsx.readFile(path.join(process.cwd(), 'uploads', formData.filename));
  let validationStat = false;
  const sheetNames = workbook.SheetNames;

  const isPL = sheetNames.includes(EXCEL_CONVENTION['P&L'].key);
  const isBS = sheetNames.includes(EXCEL_CONVENTION['BS'].key);
  const excelJSWorkbook = new ExcelJS.Workbook();
  await excelJSWorkbook.xlsx.readFile(path.join(process.cwd(), 'uploads', formData.filename));

  const boolContainsProfitLossAndBalanceSheet = sheetNames.length && 
    (
      isPL || 
      isBS
    );

    let headLabels = {}, particularsList:any = {};
  if(boolContainsProfitLossAndBalanceSheet){
    for await(const indSheet of sheetNames){
      particularsList[`${indSheet}`] = particularsList[`${indSheet}`] || [];
      headLabels[`${indSheet}`] = headLabels[`${indSheet}`] || [];

      const worksheet = excelJSWorkbook.getWorksheet(indSheet);
      const capturedHeaders = this.captureHeaders(worksheet);
      const { sheetData, maxKeysObject, errorStack } = this.sanitiseCells(workbook, indSheet, capturedHeaders, modelType);

      if(errorStack) {errorSet.push(errorStack); break};
      headLabels[indSheet] = Object.keys(maxKeysObject);
      particularsList[`${indSheet}`] = sheetData.map((_cell:any) => { return {Particulars: _cell.Particulars}});
    }
  }
  if(errorSet.length) return {validationStat: true, errorStack: errorSet}

  /**
   * DUPLICACY VALIDATION
   * Check for duplicate rows
   */
  for(let i = 0; i < sheetNames.length; i++){
    const seen = new Set();

    for(let j = 0; j < particularsList[sheetNames[i]].length; j++){
      const row = particularsList[sheetNames[i]][j];
      if(seen.has(row.Particulars)) errorSet.push(`Duplicate row detected in [${sheetNames[i]}], Row - ${j + 1}: "${row.Particulars}".`);  
      if(!seen.has(row.Particulars)) seen.add(row.Particulars);
    }
  }
  if (errorSet.length) return {validationStat: true, errorStack: errorSet};

  /**
   * BS LINE ITEMS
   * Validate by iterating every line item
   */
  if(particularsList?.BS?.length && isBS){
    const BSstructure  = V2_BALANCE_SHEET.map(bs=>{ return bs.lineEntry.particulars});

    let index = 1;
    for await(const indBS of particularsList?.BS){
      if(BSstructure[index-1] !== indBS.Particulars){
        errorSet.push(`Excel: [BS] - Required: "${[...BSstructure][index-1]}" ; Received: "${indBS.Particulars}".`);
      }
      index++;
    }
  }

  /**
   * PL LINE ITEMS
   * Validate by iterating every line item
   */
  if(particularsList?.['P&L']?.length && isPL){
    const PLstructure  = V2_PROFIT_LOSS.map(bs=>{ return bs.lineEntry.particulars});
    
    let index = 1;
    for await(const indPL of particularsList['P&L']){
      if(PLstructure[index - 1] !== indPL.Particulars){
        errorSet.push(`Excel: [PL] - Required: "${[...PLstructure][index-1]}" ; Received: "${indPL.Particulars}".`);
      }
      index++;
    }
  }

  /**
   * DATE COLUMN VALIDATION
   * Column 2 in BS, Column 3 in PL
   */
    let emptyPLexist, emptyBSexist, boolBSDate;
    if(isPL){
      const boolPLDate = modelType === XL_SHEET_ENUM[2] ? `${headLabels['P&L'][2]}`.trim().match(DATE_REGEX) : `${headLabels['P&L'][3]}`.trim().match(DATE_REGEX) ;
      emptyPLexist = headLabels['P&L'].includes('__EMPTY');
      if(emptyPLexist) errorSet.push(`Excel: [PL] - Data integrity error: Found an empty column.`) 
      if(!boolPLDate && !emptyPLexist) errorSet.push(`Critical Error: [PL] Date format must be "DD-MM-YYYY". Received "${headLabels['P&L'][2]}".`)
    }
    if(isBS){
      boolBSDate = modelType === XL_SHEET_ENUM[2] || modelType === XL_SHEET_ENUM[3] ? `${headLabels['BS'][1]}`.trim().match(DATE_REGEX) : `${headLabels['BS'][2]}`.trim().match(DATE_REGEX);
      emptyBSexist = headLabels['BS'].includes('__EMPTY');
      if(emptyBSexist) errorSet.push(`Excel: [BS] - Data integrity error: Found an empty column.`) 
    }
    
    if(emptyBSexist || emptyPLexist) return {validationStat:true, errorStack:errorSet};
    if(!boolBSDate && !emptyBSexist) errorSet.push(`Critical Error: [BS] Date format must be "DD-MM-YYYY". Received "${headLabels['BS'][1]}".`)


  /**
   * YEARS COLUMN VALIDATION
   * Column 3 onwards in BS, Column 4 onwards in PL
   */
  if(modelType === XL_SHEET_ENUM[0]){
    const PLyears = headLabels['P&L'].splice(4, headLabels['P&L'].length-1);
    const BSyears = headLabels['BS'].splice(3, headLabels['BS'].length-1);
    if(PLyears.length !== BSyears.length) errorSet.push(`Content Verification Error: Column length mismatch detected in both Excel files.`);
  
    const yearStruccture = [PLyears, BSyears];
    for(let i = 0;;){
      if(i > yearStruccture.length - 1) break;
      for (let j = 0;;){
        if(j > yearStruccture[i].length - 1) break;
        if(!yearStruccture[i][j].match(YEAR_REGEX)) errorSet.push(`Content Verification Error: [${i === 0 ? 'P&L' : 'BS'}] - The year format should be "YYYY-YYYY". Received: "${yearStruccture[i][j]}".`)
        j++;
      }
      i++;
    }
  }

  if(errorSet.length) validationStat = true; 

  return {validationStat, errorStack:errorSet};
}

captureHeaders(worksheet){
  const columnCount = worksheet.columnCount;
  const headerColumns = [];

  for (let i = 1; i <= columnCount; i++) {
    headerColumns.push(worksheet.getCell(1, i).value); 
  }
  return headerColumns.filter(item=>{return item});
};

sanitiseCells(workbook,sheetName, headers, approach){
  let errorStack = '', sheetWiseCheck = {};
  const sheetData = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);
  // sheetData.forEach((row:any) => {
  //   for (let columns in row) {
  //     if (typeof row[columns] === 'string') {
  //       row[columns] = row[columns].replace(/\r\n/g, '');
  //     }

  //     if (typeof row[columns] === 'number') {
  //       row[columns] = parseFloat(row[columns].toFixed(2));
  //     }
      
  //     if (typeof columns === 'string') {
  //       const cleanedColumn = columns.trim().replace(/^\s+/g, '').replace(/\r\n/g, '');
  //       if (columns !== cleanedColumn) {
  //         row[cleanedColumn] = row[columns];
  //         delete row[columns];
  //       }
  //     }

  //   }
  //   for(const indYear of headers){
  //     sheetWiseCheck[sheetName] = sheetWiseCheck[sheetName] || [];
  //     if(Object.keys(row).includes(indYear)) { sheetWiseCheck[sheetName] = {value: true, sheetName}; continue };
  //     sheetWiseCheck[sheetName] = {value:false, year: indYear, sheetName};
  //   }
  // });
  sheetData.forEach((row:any) => {
      const orderedEntries = Object.entries(row).map(([key, value]) => {
        if (typeof value === 'string') {
            value = value.replace(/\r\n/g, '');
        }
        if (typeof value === 'number') {
            value = parseFloat(value.toFixed(2));
        }
        return [key.trim().replace(/^\s+/g, '').replace(/\r\n/g, ''), value];
    });

    // Rebuild object with preserved order
    row = Object.fromEntries(orderedEntries);
    for(const indYear of headers){
      sheetWiseCheck[sheetName] = sheetWiseCheck[sheetName] || [];
      if(Object.keys(row).includes(indYear)) { sheetWiseCheck[sheetName] = {value: true, sheetName}; continue };
      sheetWiseCheck[sheetName] = {value:false, year: indYear, sheetName};
    }
  });
  const errorCheck:any = Object.values(sheetWiseCheck).filter((item:any) => !item.value);
  if(errorCheck?.length){
    const year = errorCheck[0].year;
    if(year){
      errorStack = `[${errorCheck[0].sheetName}]; Columns without data: ${errorCheck[0].year}`
    }
    else{
      errorStack = `Found empty column in ${errorCheck[0].sheetName} Excel Sheet`
    }
  }

  let maxKeys = Object.keys(sheetData[0]).length;
  let maxKeysObject = sheetData[0];

  for (let i = 0; i<sheetData.length; i++){
    const numKeys = Object.keys(sheetData[i]).length;
        if (numKeys > maxKeys) {
          maxKeys = numKeys;
          maxKeysObject = sheetData[i];
        }
  }
  return {sheetData, maxKeysObject, errorStack}
}

fetchSheetName(workbook){
  const sheetNames: string[] = [];
  workbook.eachSheet((worksheet, sheetId) => {
    sheetNames.push(worksheet.name);
  });
  return sheetNames;
}

async downloadTemplate(templateData, response){
  try{
    let excelBuffer;

    const fileName = templateData?.fileName || '';
    const processId = templateData?.processStateId || '';
    if(!processId) throw new NotFoundException('Filename not found').getResponse();

    const excelDetails: any = await this.processStateManagerService.getExcelStatus(processId);

    if(!excelDetails.exportExcelId) throw new NotFoundException(`Please Upload Excel Again`).getResponse();

    const uploadDir = path.join(process.cwd(),'uploads');
    const filePath = path.join(uploadDir, excelDetails.exportExcelId);

    const excelBufferResponse = () => {
      response.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      response.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      response.send(excelBuffer);
    }

    if (!fs.existsSync(filePath)) {
      await this.thirdpartyApiAggregateService.fetchFinancialSheetFromS3(excelDetails.exportExcelId);
      excelBuffer = fs.readFileSync(filePath);  
      return excelBufferResponse();      
    }
    excelBuffer = fs.readFileSync(filePath);

    return excelBufferResponse();
  }catch(error){
    throw error
  }
}

async uploadExportableExcelInS3(formData){
   try{
     /*
    * Execute downloadable excel file function
    */
   const exportableFileName = `export-${formData.filename}`
   return await this.pushInitialFinancialSheet(formData, exportableFileName);
   }
   catch(error){
    throw error;
   }
}

async loadExcelJSONintoDB(modelName, uploadedFileData, request, processStateId){
  /**
   * When user uploads excel,
   * 1. Create copy of the excel     
   * 2. Adjust retainers and cash & cash equivalent line items in Balance Sheet 
   */
  if(modelName === XL_SHEET_ENUM[0]){
    console.log(modelName, uploadedFileData, processStateId,"all three parameters")
    await this.getSheetData(uploadedFileData.excelSheetId, EXCEL_CONVENTION['P&L'].key, request, processStateId).toPromise();
    await this.getSheetData(uploadedFileData.excelSheetId, EXCEL_CONVENTION['BS'].key, request, processStateId).toPromise();
    await this.getSheetData(uploadedFileData.excelSheetId, EXCEL_CONVENTION['Cash Flow'].key, request, processStateId).toPromise();
    await this.updateBalanceSheetRetainersAndCashEquivalent(uploadedFileData.excelSheetId, request, processStateId);
    await this.getSheetData(uploadedFileData.excelSheetId, EXCEL_CONVENTION['Assessment of Working Capital'].key, request, processStateId).toPromise();
  }
  if(modelName === XL_SHEET_ENUM[2]){
    await this.getSheetData(uploadedFileData.excelSheetId, EXCEL_CONVENTION['P&L'].key, request, processStateId).toPromise();
    await this.getSheetData(uploadedFileData.excelSheetId, EXCEL_CONVENTION['BS'].key, request, processStateId).toPromise();
  }
  return true;
}
}