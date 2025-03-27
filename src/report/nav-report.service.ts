import { HttpException, HttpStatus, Injectable } from "@nestjs/common";
import { REPORT_PURPOSE, MODEL, GET_MULTIPLIER_UNITS, REPORTING_UNIT, NATURE_OF_INSTRUMENT, PURPOSE_OF_REPORT_AND_SECTION } from "src/constants/constants";
import { thirdpartyApiAggregateService } from "src/library/thirdparty-api/thirdparty-api-aggregate.service";
import { formatDate, formatPositiveAndNegativeValues } from "./report-common-functions";
import * as converter from 'number-to-words';
import * as fs from 'fs';
import * as path from 'path';
import * as puppeteer from 'puppeteer';
import hbs = require('handlebars');
import { ReportDocument } from "./schema/report.schema";
import { Model } from "mongoose";
import { ValuationsService } from "src/valuationProcess/valuationProcess.service";
import { InjectModel } from "@nestjs/mongoose";
import { convertToNumberOrZero } from "src/excelFileServices/common.methods";
@Injectable()
export class navReportService {
    constructor(private thirdpartyApiAggregateService: thirdpartyApiAggregateService,
        @InjectModel('report') private readonly reportModel: Model<ReportDocument>,
        private valuationService:ValuationsService){
    }
    async generateNavReport(id, res, formatType){
        try{
            let htmlFilePath, pdfFilePath,docFilePath,pdf;
            const reportDetails = await this.reportModel.findById(id);
            const valuationResult:any = await this.valuationService.getValuationById(reportDetails.reportId);
      
            if(reportDetails.reportPurpose.includes(Object.keys(REPORT_PURPOSE)[0]) || reportDetails.reportPurpose.includes(Object.keys(REPORT_PURPOSE)[4])){
              htmlFilePath = path.join(process.cwd(), 'html-template', 'nav-report.html');
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
            this.loadNavHelpers(valuationResult, reportDetails);
      
            if (valuationResult.modelResults.length > 0) {
                const htmlContent = fs.readFileSync(htmlFilePath, 'utf8');
                const template = hbs.compile(htmlContent);
                const html = template(valuationResult);
              
                if(reportDetails.reportPurpose.includes(Object.keys(REPORT_PURPOSE)[0]) || reportDetails.reportPurpose.includes(Object.keys(REPORT_PURPOSE)[4])){
                  pdf = await this.generateNavPdf(html, pdfFilePath);
                }
      
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
                console.log("Data not found");
                return {
                    msg: `No data found for NAV ${formatType === 'DOCX' ? 'DOCX' : 'PDF'} generation`,
                    status: false
                };
            }
        }
        catch(error){
            throw new HttpException(
                {
                  error: error,
                  status: false,
                  msg: `please check nav details, ${formatType === 'DOCX' ? 'DOCX' : 'PDF'} generation failed`,
                },
                HttpStatus.INTERNAL_SERVER_ERROR,
              );
            }
    }

    loadNavHelpers(valuationResult,reportDetails){
        try{
            hbs.registerHelper('companyName',()=>{
            if(valuationResult.inputData[0].company)
                return valuationResult.inputData[0].company;
            return '';
            })
    
            hbs.registerHelper('reportDate',()=>{
            if(reportDetails.registeredValuerDetails[0]) 
                return  formatDate(new Date(reportDetails.reportDate));
            return '';
            })
    
            hbs.registerHelper('strdate',()=>{
            if(valuationResult.inputData[0].valuationDate)
                return formatDate(new Date(valuationResult.inputData[0].valuationDate));
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
            hbs.registerHelper('registeredValuerCopNo',()=>{
            if(reportDetails.registeredValuerDetails[0]) 
                return  reportDetails.registeredValuerDetails[0].copNo; 
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

            hbs.registerHelper('location',()=>{
            if(valuationResult.inputData[0]) 
                return valuationResult.inputData[0].location; 
            return '';
            })
    
            hbs.registerHelper('companyInfo',()=>{
            if(reportDetails.companyInfo){
                return reportDetails.companyInfo;
            }
            return '';
            })
    
            hbs.registerHelper('modelValuePerShare',(modelName)=>{
            modelName = modelName.split(',');
            if(modelName.length <= 2 ){
                let formattedValues;
                formattedValues = modelName.flatMap((models) => {
                    return valuationResult.modelResults.flatMap((response) => {
                    if (response.model === models && models === 'NAV') {
                        const fairValue = response?.valuationData?.valuePerShare?.fairValue || 0;
                        const faceValue = valuationResult.inputData[0]?.faceValue || 0;
                        const valuePerShare = fairValue < faceValue ? faceValue : fairValue;
                        const formattedNumber = formatPositiveAndNegativeValues(valuePerShare);
                        return `${formattedNumber}/-`;
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

            hbs.registerHelper('isValuePerShareNegative',(modelName)=>{
            modelName = modelName.split(',');
            let isNegativeValuePerShare = false;
                 modelName.flatMap((models) => {
                    valuationResult.modelResults.flatMap((response) => {
                    if (response.model === models && models === 'NAV') {
                        const fairValue = response?.valuationData?.valuePerShare?.fairValue || 0;
                        if(fairValue < 0){
                            isNegativeValuePerShare = true;
                        }
                    }
                    });
                });
                return isNegativeValuePerShare;
             
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
            modelName = modelName.split(',');
            if(modelName.length <= 2 ){
                let formattedValues;
                formattedValues = modelName.flatMap((models) => {
                    return valuationResult.modelResults.flatMap((response) => {
                    
                    if (response.model === models && models === 'NAV') {
                        const fairValue = response?.valuationData?.valuePerShare?.fairValue || 0;
                        const faceValue = valuationResult.inputData[0]?.faceValue || 0;
                        const valuePerShare = fairValue < faceValue ? faceValue : fairValue;
                        let formattedNumber = convertToNumberOrZero(valuePerShare);
                        // if(`${formattedNumber}`.includes('-')){
                        // formattedNumber = Math.floor(10).toLocaleString('en-IN');
                        // }
                        if(`${formattedNumber}`.includes('.')){
                            return `${this.convertToIndianCurrency(formattedNumber ? (+formattedNumber)?.toFixed(2) : 0)} Only`;
                        }
                        return `Rupees ${converter.toWords(formattedNumber)} Only`;
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

    
            hbs.registerHelper('natureOfInstrument',()=>{
            if(reportDetails)
                return NATURE_OF_INSTRUMENT[`${reportDetails.natureOfInstrument}`];
            return '';
            })
    
        // hbs.registerHelper('netAssetValue',()=>{
        //     let navData = [];
        //     valuationResult.modelResults.forEach((result)=>{
        //     if(result.model === MODEL[5]){
        //         navData = Object.values(result.valuationData);
        //     // const firmValueInd = navData.findIndex((item:any)=>item.fieldName === 'Firm Value');
        //     // const netCurrentAssetInd = navData.findIndex((item:any)=>item.fieldName === 'Net Current Assets');
        //     // const emptyObj={ //push this empty object to have empty td between two td tags
        //     //     fieldName:'',
        //     //     // type:'',
        //     //     bookValue:'',
        //     //     fairValue:''
        //     //     }
        //     // navData.splice(firmValueInd,0,emptyObj);
        //     // navData.splice(netCurrentAssetInd,0,emptyObj);

        //     // navData = navData.map((indNav)=>{
        //     //     return {
        //     //     fieldName:indNav.fieldName,
        //     //     // type:indNav.type === 'book_value' ? 'Book Value' : indNav.type === 'market_value' ? 'Market Value' : indNav.type,
        //     //     // bookValue:indNav?.bookValue === null ? null : indNav?.bookValue === 0 || indNav?.bookValue ? formatPositiveAndNegativeValues(indNav.bookValue) : indNav?.bookValue,
        //     //     // fairValue:indNav?.fairValue === 0 || indNav?.fairValue ? formatPositiveAndNegativeValues(indNav.fairValue) : indNav.value  === 0 || indNav?.value ? formatPositiveAndNegativeValues(indNav.value): indNav?.value
        //     //     bookValue:indNav?.bookValue,
        //     //     fairValue:indNav?.fairValue
        //     //     }
        //     // })
        //     }
        //     })
        //     return navData;
        // })

        hbs.registerHelper('iterateNAVData',(data)=>{
            let navData = [];
            valuationResult.modelResults.forEach((result)=>{
                if(result.model === MODEL[5]){
                    navData = Object.values(result.valuationData);
                }
            })
            return this.navTableStructure(navData);
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
                return overallSectionsWithPurposes.join(' and ');
        });
    
        hbs.registerHelper('isInternalAssessment',()=>{
            if(reportDetails.reportPurpose.includes('internalAssessment') && reportDetails.reportPurpose?.length === 1){
              return true;
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
        }  
        catch(error){
            return {
            msg:'error in helper',
            error:error.message,
            status:false
            }
        }
    }

    convertToIndianCurrency(number) {
        const [rupees, paise] = number.split('.');
        
        let rupeesInWords = converter.toWords(rupees);
        
        let paiseInWords = '';
        if (paise) {
            paiseInWords = 'and ' + converter.toWords(paise) + ' paise';
        }
        
        let result = 'Rupees ' + rupeesInWords;
        if (paise) {
            result += ' ' + paiseInWords;
        }
        
        return result;
    }

    async generateNavPdf(htmlContent: any, pdfFilePath: string) {
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
            footerTemplate:`<div style="width:100%;margin-top:5%">
            <hr style="border:1px solid #bbccbb">
            <h1 style="padding-left: 5%;text-indent: 0pt;text-align: center;font-size:11px;color:#5F978E;"><span style="font-weight:400 !important;">Page <span class="pageNumber"></span></span></span> <span style="float: right;padding-right: 3%;font-size:12px"> Private &amp; confidential </span></h1>
            </div>` ,
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

    async navReportPreview(id, response){
        try{

            let htmlFilePath, pdfFilePath,docFilePath,pdf;
            const reportDetails = await this.reportModel.findById(id);
            const valuationResult:any = await this.valuationService.getValuationById(reportDetails.reportId);
      
            if(reportDetails.reportPurpose.includes(Object.keys(REPORT_PURPOSE)[0])){
              htmlFilePath = path.join(process.cwd(), 'html-template', 'nav-report.html');
            }

            pdfFilePath = path.join(process.cwd(), 'pdf', `${valuationResult.inputData[0].company}-${reportDetails.id}.pdf`);
            docFilePath = path.join(process.cwd(), 'pdf', `${valuationResult.inputData[0].company}-${reportDetails.id}.docx`);
            
            if(reportDetails?.fileName){
              const convertDocxToSfdt = await this.thirdpartyApiAggregateService.convertDocxToSyncfusionDocumentFormat(docFilePath, true);
      
              response.send(convertDocxToSfdt)
              return {
                  msg: "Nav PDF download Success",
                  status: true,
                };
            }
            
            this.loadNavHelpers(valuationResult, reportDetails);

            if (valuationResult.modelResults.length > 0) {
                const htmlContent = fs.readFileSync(htmlFilePath, 'utf8');
                const template = hbs.compile(htmlContent);
                const html = template(valuationResult);
                
                pdf = await this.generateNavPdf(html, pdfFilePath);
                await this.thirdpartyApiAggregateService.convertPdfToDocx(pdfFilePath,docFilePath);
                
                const convertDocxToSfdt = await this.thirdpartyApiAggregateService.convertDocxToSyncfusionDocumentFormat(docFilePath);
        
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
            throw new HttpException(
                {
                  error: error,
                  status: false,
                  msg: 'please check nav details, nav report preview failed',
                },
                HttpStatus.INTERNAL_SERVER_ERROR,
              );
        }
    }

    navTableStructure(nArray, splittingIndex?){
        const navArray = nArray || [];
        if(!navArray.length) return [];

        // const pageBreakIndex = navArray.findIndex(indEle => indEle.fieldName === 'Total Assets (A)');
        const pageBreakIndex = splittingIndex ||  31; //Statically applying page-break after 31th Index
        const firstPart = navArray.slice(0, pageBreakIndex + 1);
        const secondPart = navArray.slice(pageBreakIndex + 1);

        const generateTableHTML = (array) => {
            return `
            <table style="border-collapse:collapse;margin-left:8pt;width: 100%;padding-top: 2%;" cellspacing="0">
                <tr style="height:18pt">
                    <td style="width:227pt;border-top-style:solid;border-top-width:1pt;border-left-style:solid;border-left-width:1pt;border-bottom-style:solid;border-bottom-width:1pt;border-right-style:solid;border-right-width:1pt" bgcolor="#001F5F">
                        <p class="s12" style="padding-left: 2pt;text-indent: 0pt;line-height: 12pt;text-align: left;font-size: 13px !important;padding-top:3px;padding-bottom:3px;color:#fff">
                            Particulars
                        </p>
                    </td>
                    <td style="width:71pt;border-top-style:solid;border-top-width:1pt;border-left-style:solid;border-left-width:1pt;border-bottom-style:solid;border-bottom-width:1pt;border-right-style:solid;border-right-width:1pt" bgcolor="#001F5F">
                        <p class="s12" style="padding-right: 3pt;text-indent: 0pt;line-height: 12pt;text-align: right;font-size: 13px !important;padding-top:3px;padding-bottom:3px;color:#fff">
                            Book Value
                        </p>
                    </td>
                    <td style="width:75pt;border-top-style:solid;border-top-width:1pt;border-left-style:solid;border-left-width:1pt;border-bottom-style:solid;border-bottom-width:1pt;border-right-style:solid;border-right-width:1pt" bgcolor="#001F5F">
                        <p class="s12" style="padding-right: 3pt;text-indent: 0pt;line-height: 12pt;text-align: right;font-size: 13px !important;padding-top:3px;padding-bottom:3px;color:#fff">
                            Fair Value
                        </p>
                    </td>
                </tr>
                <tbody>
                    ${array.map(indEle => {return this.navHTMLBinder(indEle)}).join('')}
                </tbody>
            </table>
            `;
        };

        return `
            ${generateTableHTML(firstPart)}
            ${secondPart.length > 0 ? `
                <div style="page-break-before: always;"></div>
                <div style="padding-top:8%">
                ${generateTableHTML(secondPart)}
                </div>
            ` : ''}
            `;

       
    }

    /**
     * This is older function for generating NAV valuation table
     * What it does:
     * It checks for line item Liabilities - 
     * Once found it divides the data into two
     * First half contains Equity section
     * Second half contains Liabilities section
     * Which helps conditional rendering of pages using page-break statements
     */
    // navTableStructure(nArray){
    //     const navArray = nArray || [];
    //     if(!navArray.length) return [];

    //     const pageBreakIndex = navArray.findIndex(indEle => indEle.fieldName === 'Total Assets (A)');
    //     const firstPart = navArray.slice(0, pageBreakIndex + 1);
    //     const secondPart = navArray.slice(pageBreakIndex + 1);

    //     const generateTableHTML = (array) => {
    //         return `
    //         <table style="border-collapse:collapse;margin-left:8pt;width: 100%;padding-top: 2%;" cellspacing="0">
    //             <tr style="height:18pt">
    //                 <td style="width:227pt;border-top-style:solid;border-top-width:1pt;border-left-style:solid;border-left-width:1pt;border-bottom-style:solid;border-bottom-width:1pt;border-right-style:solid;border-right-width:1pt" bgcolor="#001F5F">
    //                     <p class="s12" style="padding-left: 2pt;text-indent: 0pt;line-height: 12pt;text-align: left;font-size: 13px !important;padding-top:3px;padding-bottom:3px;color:#fff">
    //                         Particulars
    //                     </p>
    //                 </td>
    //                 <td style="width:71pt;border-top-style:solid;border-top-width:1pt;border-left-style:solid;border-left-width:1pt;border-bottom-style:solid;border-bottom-width:1pt;border-right-style:solid;border-right-width:1pt" bgcolor="#001F5F">
    //                     <p class="s12" style="padding-right: 3pt;text-indent: 0pt;line-height: 12pt;text-align: right;font-size: 13px !important;padding-top:3px;padding-bottom:3px;color:#fff">
    //                         Book Value
    //                     </p>
    //                 </td>
    //                 <td style="width:75pt;border-top-style:solid;border-top-width:1pt;border-left-style:solid;border-left-width:1pt;border-bottom-style:solid;border-bottom-width:1pt;border-right-style:solid;border-right-width:1pt" bgcolor="#001F5F">
    //                     <p class="s12" style="padding-right: 3pt;text-indent: 0pt;line-height: 12pt;text-align: right;font-size: 13px !important;padding-top:3px;padding-bottom:3px;color:#fff">
    //                         Fair Value
    //                     </p>
    //                 </td>
    //             </tr>
    //             <tbody>
    //                 ${array.map(indEle => {return this.navHTMLBinder(indEle)}).join('')}
    //             </tbody>
    //         </table>
    //         `;
    //     };

    //     return `
    //         ${generateTableHTML(firstPart)}
    //         <div style="page-break-before: always;"></div>
    //         <div style="padding-top:8%">
    //         ${generateTableHTML(secondPart)}
    //         </div> 
    //     `;
    // }
    
    navHTMLBinder(parameters:any){
        let backgroundColorStndrd = '#fff', fontColorStndrd = 'black', fontSizeStndrd = '12px !important', fontWeightStndrd = '400', boolEmptyRow = false, paddingLeftStndrd = '4pt';

        if((parameters.reqLBrk || parameters.reqUBrk)) boolEmptyRow = true;
        if(parameters.fieldName === 'Value Per Share') {backgroundColorStndrd = '#001F5F';fontColorStndrd = '#fff'}
        if(parameters.mainHead) {fontSizeStndrd = '15px'; fontWeightStndrd = '600';}
        if(parameters.mainSubHead) {fontSizeStndrd = '13px'; fontWeightStndrd = '600';}
        if(parameters.header) {fontWeightStndrd = '600';}
        if(parameters.subHeader) {paddingLeftStndrd = '9pt';}
        if(parameters.nestedSubHeader) paddingLeftStndrd = '15pt';

        if(parameters?.fieldName && parameters?.fieldName?.trim().toLowerCase() === 'value per share') parameters.fieldName = 'Value Per Share (INR)';

        
        let emptyRow = 
        `<tr style="height:16pt">
            <td style="width:auto !important;border-top-style:solid;border-top-width:1pt;border-left-style:solid;border-left-width:1pt;border-bottom-style:solid;border-bottom-width:1pt;border-right-style:solid;border-right-width:1pt"></td>
            <td style="width:75pt;border-top-style:solid;border-top-width:1pt;border-left-style:solid;border-left-width:1pt;border-bottom-style:solid;border-bottom-width:1pt;border-right-style:solid;border-right-width:1pt"></td>
            <td style="width:75pt;border-top-style:solid;border-top-width:1pt;border-left-style:solid;border-left-width:1pt;border-bottom-style:solid;border-bottom-width:1pt;border-right-style:solid;border-right-width:1pt"></td>
        </tr>`;

        const finalHTMLFormation = 
        `<tr style="height:18pt">

            <td style="width:auto !important;border-top-style:solid;border-top-width:1pt;border-left-style:solid;border-left-width:1pt;border-bottom-style:solid;border-bottom-width:1pt;border-right-style:solid;border-right-width:1pt" 
            bgcolor="${backgroundColorStndrd}">
                <p class="s12" style="padding-left: ${paddingLeftStndrd};text-indent: 0pt;text-align: left;font-size: ${fontSizeStndrd};color:${fontColorStndrd};font-weight:${fontWeightStndrd};padding-top:3px;padding-bottom:3px">
                    ${parameters.fieldName}
                </p>
            </td>

            <td style="width:75pt;border-top-style:solid;border-top-width:1pt;border-left-style:solid;border-left-width:1pt;border-bottom-style:solid;border-bottom-width:1pt;border-right-style:solid;border-right-width:1pt" bgcolor="${backgroundColorStndrd}">
                <p class="s12" style="padding-right: 4pt;text-indent: 0pt;text-align: right;font-size: ${fontSizeStndrd};color:${fontColorStndrd};font-weight:${fontWeightStndrd};padding-top:3px;padding-bottom:3px">
                    ${parameters?.bookValue ? formatPositiveAndNegativeValues(parameters.bookValue) : ''}
                </p>
            </td>

            <td style="width:75pt;border-top-style:solid;border-top-width:1pt;border-left-style:solid;border-left-width:1pt;border-bottom-style:solid;border-bottom-width:1pt;border-right-style:solid;border-right-width:1pt" bgcolor="${backgroundColorStndrd}">
                <p class="s12" style="padding-right: 4pt;text-indent: 0pt;text-align: right;font-size: ${fontSizeStndrd};color:${fontColorStndrd};font-weight:${fontWeightStndrd};padding-top:3px;padding-bottom:3px">
                    ${parameters?.fairValue ? formatPositiveAndNegativeValues(parameters.fairValue) : ''}
                </p>
            </td>

        </tr>`

        return boolEmptyRow ? 
        (
            parameters.reqLBrk ? 
            finalHTMLFormation.concat(emptyRow) : 
            emptyRow.concat(finalHTMLFormation)
        ) : 
        finalHTMLFormation;
    }
}