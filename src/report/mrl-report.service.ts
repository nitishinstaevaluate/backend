import { HttpStatus, Injectable, NotFoundException } from "@nestjs/common";
import * as fs from 'fs';
import * as path from 'path';
import * as puppeteer from 'puppeteer';
import { utilsService } from "src/utils/utils.service";
import hbs = require('handlebars');
import * as converter from 'number-to-words'
import { MODEL, NATURE_OF_INSTRUMENT, PURPOSE_OF_REPORT_AND_SECTION, REPORT_PURPOSE } from "src/constants/constants";
import { computedTotalYears, formatDate, formatPositiveAndNegativeValues, transformData } from "./report-common-functions";
import { ProcessStatusManagerService } from "src/processStatusManager/service/process-status-manager.service";
import * as xlsx from 'xlsx';
import { thirdpartyApiAggregateService } from "src/library/thirdparty-api/thirdparty-api-aggregate.service";
import { convertToNumberOrZero, getRequestAuth } from "src/excelFileServices/common.methods";
import { KeyCloakAuthGuard } from "src/middleware/key-cloak-auth-guard";
import { userRoles } from "src/library/enums/user-roles.enum";
import { ExcelArchiveService } from "src/excel-archive/service/excel-archive.service";

@Injectable()
export class mrlReportService {
    constructor(private utilService: utilsService,
      private processStateManagerService: ProcessStatusManagerService,
      private thirdPartyApiAggregateService: thirdpartyApiAggregateService,
      private excelArchiveService: ExcelArchiveService){}
    async generateMrlReport(id, res, format, headers){
        try{
            const applicationData:any = await this.processStateManagerService.fetchProcess(id);
            if(!applicationData.status) 
              throw new NotFoundException({
                  statusCode: HttpStatus.NOT_FOUND,
                  message: 'Application data not found, check processId',
                  error: 'Not Found',
                }).getResponse();

            const { roles } = await this.fetchUserInfo(headers);

            const stageOneData = applicationData.stateInfo.firstStageInput;
            const computeExcelSheet = await this.excelSheetComputation(stageOneData, id);
            const excelSheetId = this.getExcelSheetId(stageOneData);
            const workbook = await this.readFile(excelSheetId); 
            const computedTotalYear = await computedTotalYears(workbook);
              

            let htmlFilePath = path.join(process.cwd(), 'html-template', `management-representation-letter.html`);
            let pdfFilePath = path.join(process.cwd(), 'pdf', `mrl.pdf`);
            let wordFilePath = path.join(process.cwd(), 'pdf', `mrl.docx`);
        
           await this.loadMrlHelpers(applicationData.stateInfo, computeExcelSheet, computedTotalYear, roles);
        
            const htmlContent = fs.readFileSync(htmlFilePath, 'utf8');
            const template = hbs.compile(htmlContent);
            const html = template(applicationData.stateInfo);
        
            let pdf =  await this.createpdf(html, pdfFilePath);

            let formatExtentionHeader,formatTypeHeader, attachmentHeader;
            if(format === 'DOCX'){
              await this.thirdPartyApiAggregateService.convertPdfToDocx(pdfFilePath, wordFilePath);
            
              let wordBuffer = fs.readFileSync(wordFilePath);
              
              formatTypeHeader = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
              formatExtentionHeader = `attachment; filename="='Mrl'.docx"`;
              attachmentHeader = wordBuffer;
            }
            else{
              formatTypeHeader = 'application/pdf';
              formatExtentionHeader = `attachment; filename="='Mrl'.pdf"`;
              attachmentHeader = pdf;
            }

            res.setHeader('Content-Type', formatTypeHeader);
            res.setHeader('Content-Disposition', formatExtentionHeader);
            res.send(attachmentHeader);
    
            return {
                msg: "Mrl service report download Success",
                status: true,
            };
        }
        catch(error){
            return {
                error:error,
                status:false,
                msg:"Mrl service report generation failed"
            }
        }
    }
    
    getExcelSheetId(formOneData){
      return formOneData.isExcelModified ? formOneData.modifiedExcelSheetId : formOneData.excelSheetId;
    }

    async loadMrlHelpers(processStateInfo, excelSheetData, computedTotalYear, roles){
        try{
            hbs.registerHelper('companyName',()=>{
                if(processStateInfo.firstStageInput.company)
                    return processStateInfo.firstStageInput?.company;
                return '';
            })
            hbs.registerHelper('terminalGrowthRate',()=>{
                if(processStateInfo.firstStageInput.terminalGrowthRate){
                    return processStateInfo.firstStageInput?.terminalGrowthRate;
                }
                return '';
            })

            hbs.registerHelper('natureOfInstrument',()=>{
                if(processStateInfo.sixthStageInput.natureOfInstrument)
                    return NATURE_OF_INSTRUMENT[`${processStateInfo.sixthStageInput?.natureOfInstrument}`];
                return '';
            })

            hbs.registerHelper('dateOfAppointment',()=>{
                if(processStateInfo.sixthStageInput.dateOfAppointment){
                  return formatDate(new Date(processStateInfo.sixthStageInput?.dateOfAppointment));
                }
                return '';
            })

            hbs.registerHelper('conditionalWidth', function(index, options) {
              return index === 0 ? '25%' : 'auto';
             })

            hbs.registerHelper('columnAlignment', function(index: number) {
              return index === 0 ? 'left' : 'right';
            });

            hbs.registerHelper('companyInfo', ()=>{
              if(processStateInfo.sixthStageInput?.companyInfo)
                return processStateInfo.sixthStageInput?.companyInfo;
              return '';
            })
            hbs.registerHelper('ifMB01',()=>{
              if(roles?.length)
                  return roles.some(indRole => indRole?.name === userRoles.merchantBanker);
              return false;
            })
            hbs.registerHelper('dateOfIncorporation',()=>{
                if(processStateInfo.sixthStageInput.dateOfIncorporation)
                    return formatDate(new Date(processStateInfo.sixthStageInput?.dateOfIncorporation));
                return '';
            })

            hbs.registerHelper('valuationDate',()=>{
                if(processStateInfo.firstStageInput.valuationDate)
                    return formatDate(new Date(processStateInfo.firstStageInput?.valuationDate));
                return '';
            })

            hbs.registerHelper('cinNumber',()=>{
                if(processStateInfo.sixthStageInput?.cinNumber)
                    return processStateInfo.sixthStageInput?.cinNumber;
                return '';
            })

            hbs.registerHelper('companyAddress',()=>{
                if(processStateInfo.sixthStageInput?.companyAddress)
                    return processStateInfo.sixthStageInput?.companyAddress;
                return '';
            })

            hbs.registerHelper('sectionAndPurposeOfReport', ()=>{
              let storePurposeWiseSections = {}, overallSectionsWithPurposes = [];
              if(!processStateInfo.sixthStageInput.reportPurpose?.length || !processStateInfo.sixthStageInput.reportSection?.length){
                return ['Please provide data']
              }


              //Firstly create object structure with purpose of report and sections in key-value format;
              processStateInfo.sixthStageInput.reportPurpose.forEach((indpurpose, purposeIndex)=>{
                processStateInfo.sixthStageInput.reportSection.forEach((indSection, sectionIndex) => {
                  if(PURPOSE_OF_REPORT_AND_SECTION[indpurpose].length){
                    if(PURPOSE_OF_REPORT_AND_SECTION[indpurpose].includes(indSection)){
                      storePurposeWiseSections[indpurpose] = storePurposeWiseSections[indpurpose] || [];
                      storePurposeWiseSections[indpurpose].push(indSection);
                    }
                  }
                });
              })

              // Use that object structure created above for looping and adding sections followed by purposes 
              processStateInfo.sixthStageInput.reportPurpose.forEach((indPurposeOfReport,index)=>{
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

          hbs.registerHelper('profitAndLossExcel',()=>{
            if(excelSheetData['P&L'])
                return excelSheetData['P&L'];
            return '';
        })
          hbs.registerHelper('balanceSheetExcel',()=>{
            if(excelSheetData['BS'])
                return excelSheetData['BS'];
            return '';
        })
          hbs.registerHelper('profitAndLossExcelHeaders',()=>{
            if(excelSheetData['P&L']){
              const headers = excelSheetData['P&L'][0].map((excelResponse)=>{
                return {head:excelResponse};
              })
              return headers
            }
            return '';
        })
          hbs.registerHelper('balanceSheetExcelHeaders',()=>{
            if(excelSheetData['BS']){
              const headers = excelSheetData['BS'][0].map((excelResponse)=>{
                return {head:excelResponse};
              })
              return headers
            }
            return '';
        })

        hbs.registerHelper('natureOfInstrument',()=>{
          if(processStateInfo.sixthStageInput.natureOfInstrument)
            return NATURE_OF_INSTRUMENT[`${processStateInfo.sixthStageInput.natureOfInstrument}`];
          return '';
        })

        hbs.registerHelper('yearStartAndYearEnd',()=>{
          if(computedTotalYear)
            return `FY ${computedTotalYear.startYear} to FY ${computedTotalYear.endYear}`;
          return '';
        })
        hbs.registerHelper('yearEnd',()=>{
          if(computedTotalYear)
            return `${computedTotalYear.endYear}`;
          return '';
        })

        hbs.registerHelper('isDcf',()=>{
          if(processStateInfo.firstStageInput)
            return processStateInfo.firstStageInput?.model?.length && 
              (
                processStateInfo.firstStageInput?.model.includes(MODEL[0]) || processStateInfo.firstStageInput?.model.includes(MODEL[1]) || processStateInfo.firstStageInput?.model.includes(MODEL[3])
              );
          return false;
        })
        hbs.registerHelper('reportPurpose',()=>{
          if(processStateInfo.sixthStageInput.reportPurpose){
            let purposes = [];
            for(const indReportPurpose of processStateInfo.sixthStageInput.reportPurpose){
              purposes.push(`${REPORT_PURPOSE[`${indReportPurpose}`]}`)
            }
            return purposes;
          }
          return '';
        })
        hbs.registerHelper("formatNumber", function(value) {
          return !isNaN(value) && value !== null ? Number(value).toFixed(2) : value;
      });
        }
        catch(error){
          console.log(error,"error")
            return{
                error:error,
                msg:"mandate helpers failed"
            }
        }
    }

    async createpdf(htmlContent: any, pdfFilePath: string) {
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
            displayHeaderFooter: false,
            printBackground: true,
            margin: {
              top: "35px",
              right: "0px",
              bottom: "50px",
              left: "0px"
          },
          

          headerTemplate: `
            <table width="100%" border="0" cellspacing="0" cellpadding="0" style="padding-left:7%;padding-right:0%;">
              <tr>
                <td style="width:50%;">
                  <table border="0" cellspacing="0" cellpadding="0" style="height: auto; width:100% !important; padding-left:3%; padding-right:3%">
                    <tr>
                      <td style="font-size: 13px; height: 5px; width:100% !important; text-align:left; font-size:12px; font-family:Calibri, sans-serif;line-height:160%">
                        <b></b> <span style="font-size:14px;color:#4f4f4f;">Nitish Chaturvedi</span><br>
                        <b></b> <span style="font-size:14px;color:#4f4f4f;">REGISTERED VALUER - Securities or Financial Assets</span>
                      </td>
                    </tr>
                    <tr>
                      <td style="font-size: 11px">&nbsp;</td>
                    </tr>
                  </table>
                </td>
                <td style="width:50%;">
                  <table border="0" cellspacing="0" cellpadding="0" style="height: auto; width:100% !important; padding-left:14%;">
                    <tr>
                      <td style="font-size: 14px; height: 5px; width:100% !important; text-align:left; font-size:12px; font-family:Calibri, sans-serif;line-height:160%;padding-left:9%">
                        <b>Corporate Address:</b><br>
                        Unit No. 8, 2nd Floor,<br>
                        Senior Estate, 7/C, Parsi Panchayat Road,<br>
                        Andheri (East), Mumbai - 400069<br>
                        <b>Email:</b> <a href="#">chaturvedinitish@gmail.com</a><br>
                        <b>Mobile:</b> 9997354674
                      </td>
                    </tr>
                    <tr>
                      <td style="font-size: 11px">&nbsp;</td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>`,

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

      async readFile(fileName: string): Promise<xlsx.WorkBook> {
        return new Promise(async (resolve, reject) => {
          const uploadDir = path.join(process.cwd(),'uploads');

          const filePath = path.join(uploadDir, fileName);
          if (!fs.existsSync(filePath)) {
            await this.thirdPartyApiAggregateService.fetchFinancialSheetFromS3(fileName);       //If excel is not found in uploads folder, download it from S3
            return;
          }
          const  workbook = xlsx.readFile(filePath);
          resolve(workbook);
        });
      }

      async excelSheetComputation(data, processId){
        try{
          // const excelSheetId = this.getExcelSheetId(data);
          // const workbook = await this.readFile(excelSheetId); 

          const excelArchive:any = await this.excelArchiveService.fetchExcelByProcessStateId(processId)
          console.log(data, "process state id");

          const balanceSheetRowCount = excelArchive?.balanceSheetRowCount || 0;
          const profitLossSheetRowCount = excelArchive?.profitLossSheetRowCount || 0;

          let excelSheetDataObject = {};
          if(balanceSheetRowCount && profitLossSheetRowCount){
            const balanceSheetData = excelArchive?.balanceSheetdata;
            const profitLossSheetData = excelArchive?.profitLossSheetdata;

            for await (const indBSdata of balanceSheetData){
              indBSdata.Particulars = indBSdata.lineEntry.particulars;
              delete indBSdata.lineEntry;
            }

            for await (const indPldata of profitLossSheetData){
              indPldata.Particulars = indPldata.lineEntry.particulars;
              delete indPldata.lineEntry;
              delete indPldata['Sr no.'];
            }
            excelSheetDataObject['P&L'] = await transformData(profitLossSheetData);
            excelSheetDataObject['BS'] = await transformData(balanceSheetData);
          }
          // let excelSheet = ['P&L','BS']
          // for(let i =0; i<excelSheet.length;i++){   //Running this loop twice cause we need only P&L and BS in mandate pdf (if more than two sheets data is required increment the counter)
          //   const sheetData = xlsx.utils.sheet_to_json(workbook.Sheets[excelSheet[i]]);
          //   sheetData.forEach((row:any) => {
          //       for (let columns in row) {
          //         if (typeof row[columns] === 'string') {
          //           row[columns] = row[columns].replace(/\r\n/g, '');
          //         }

          //         if (typeof row[columns] === 'number') {
          //           row[columns] = parseFloat(row[columns].toFixed(2));
          //         }

          //         if (typeof columns === 'string') {
          //           const cleanedColumn = columns.trim().replace(/^\s+/g, '').replace(/\r\n/g, '');
          //           if (columns !== cleanedColumn) {
          //             row[cleanedColumn] = row[columns];
          //             delete row[columns];
          //           }
          //         }
          //       }
          //   });
          // }
          return excelSheetDataObject;
        }
        catch(error){
          return {
            error:error,
            status:false,
            msg:"Excel sheet computation failed"
          }
        }
      }

      async generateElevenUaMrl(id, res, format, headers){
        try{
          const applicationData:any = await this.processStateManagerService.fetchProcess(id);

          const { roles } = await this.fetchUserInfo(headers);

          if(!applicationData.status) 
            throw new NotFoundException({
                statusCode: HttpStatus.NOT_FOUND,
                message: 'Application data not found, check processId',
                error: 'Not Found',
              }).getResponse();

          let htmlFilePath = path.join(process.cwd(), 'html-template', `rule-eleven-ua-mrl.html`);
          let pdfFilePath = path.join(process.cwd(), 'pdf', `mrl.pdf`);
          let wordFilePath = path.join(process.cwd(), 'pdf', `mrl.docx`);
      
          await this.loadElevenUaMrlHelpers(applicationData.stateInfo, roles);
      
          const htmlContent = fs.readFileSync(htmlFilePath, 'utf8');
          const template = hbs.compile(htmlContent);
          const html = template(applicationData.stateInfo);
      
          let pdf =  await this.createpdf(html, pdfFilePath);

          let formatExtentionHeader,formatTypeHeader, attachmentHeader;
          if(format === 'DOCX'){
            await this.thirdPartyApiAggregateService.convertPdfToDocx(pdfFilePath, wordFilePath);
          
            let wordBuffer = fs.readFileSync(wordFilePath);
            
            formatTypeHeader = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
            formatExtentionHeader = `attachment; filename="='Mrl'.docx"`;
            attachmentHeader = wordBuffer;
          }
          else{
            formatTypeHeader = 'application/pdf';
            formatExtentionHeader = `attachment; filename="='Mrl'.pdf"`;
            attachmentHeader = pdf;
          }

          res.setHeader('Content-Type', formatTypeHeader);
          res.setHeader('Content-Disposition', formatExtentionHeader);
          res.send(attachmentHeader);
  
          return {
              msg: `Rule eleven UA mrl download Success`,
              status: true,
          };
        }
        catch(error){
          return {
            error:error,
            status:false,
            msg:"Rule eleven UA mrl report generation failed"
          }
        }
      }

      async loadElevenUaMrlHelpers(processStateInfo, roles){
        try{
          hbs.registerHelper('companyInfo', ()=>{
            if(processStateInfo.sixthStageInput?.companyInfo)
              return processStateInfo.sixthStageInput?.companyInfo;
            return '';
          })
          hbs.registerHelper('dateOfAppointment',()=>{
            if(processStateInfo.sixthStageInput.dateOfAppointment){
              return formatDate(new Date(processStateInfo.sixthStageInput?.dateOfAppointment));
            }
            return '';
          })
          hbs.registerHelper('companyName',()=>{
            if(processStateInfo.firstStageInput.company)
                return processStateInfo.firstStageInput?.company;
            return '';
          })
          hbs.registerHelper('valuationDate',()=>{
            if(processStateInfo.firstStageInput.valuationDate)
                return formatDate(new Date(processStateInfo.firstStageInput?.valuationDate));
            return '';
          })
          hbs.registerHelper('noOfShares',()=>{
            if(processStateInfo.firstStageInput.outstandingShares)
                return formatPositiveAndNegativeValues(processStateInfo.firstStageInput.outstandingShares);
            return '';
          })

          hbs.registerHelper('ifMB01',()=>{
            if(roles?.length)
                return roles.some(indRole => indRole?.name === userRoles.merchantBanker);
            return false;
          })

          hbs.registerHelper('phaseValue',()=>{
            let phaseValue = '-';
            if(processStateInfo.firstStageInput){
              phaseValue = processStateInfo.firstStageInput?.faceValue;
            }
            return `${phaseValue}`.includes('-') ? '-' : `${phaseValue}/-` ;
          })

          hbs.registerHelper('multiplyPhaseValueAndShares',()=>{
            let phaseValue = 0;
            if(processStateInfo.firstStageInput){
              phaseValue = processStateInfo.firstStageInput?.faceValue;
            }
            const noOfShares = processStateInfo.firstStageInput.outstandingShares
            const value =  formatPositiveAndNegativeValues(convertToNumberOrZero(phaseValue) * convertToNumberOrZero(noOfShares));
            return `${value}`.includes('-') ? '-' : `${value}/-`;
          })

          hbs.registerHelper('sectionAndPurposeOfReport', ()=>{
            let storePurposeWiseSections = {}, overallSectionsWithPurposes = [];
            if(!processStateInfo.sixthStageInput.reportPurpose?.length || !processStateInfo.sixthStageInput.reportSection?.length){
              return ['Please provide data']
            }


            //Firstly create object structure with purpose of report and sections in key-value format;
            processStateInfo.sixthStageInput.reportPurpose.forEach((indpurpose, purposeIndex)=>{
              processStateInfo.sixthStageInput.reportSection.forEach((indSection, sectionIndex) => {
                if(PURPOSE_OF_REPORT_AND_SECTION[indpurpose].length){
                  if(PURPOSE_OF_REPORT_AND_SECTION[indpurpose].includes(indSection)){
                    storePurposeWiseSections[indpurpose] = storePurposeWiseSections[indpurpose] || [];
                    storePurposeWiseSections[indpurpose].push(indSection);
                  }
                }
              });
            })

            // Use that object structure created above for looping and adding sections followed by purposes 
            processStateInfo.sixthStageInput.reportPurpose.forEach((indPurposeOfReport,index)=>{
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
        catch(error){
          console.log(error)
          return {
            error,
            msg:"Rule Eleven Ua helper failed"
          }
        }
      }

      async fetchUserInfo(headers){
        const KCGuard = new KeyCloakAuthGuard();
        const roles = await KCGuard.fetchUserRoles(getRequestAuth(headers)).toPromise();
        return { roles };
      }
}