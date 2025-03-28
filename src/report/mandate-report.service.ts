import { Injectable } from "@nestjs/common";
import * as fs from 'fs';
import * as path from 'path';
import * as puppeteer from 'puppeteer';
import { utilsService } from "src/utils/utils.service";
import hbs = require('handlebars');
import * as converter from 'number-to-words'
import { NATURE_OF_INSTRUMENT, PURPOSE_OF_REPORT_AND_SECTION, REPORT_PURPOSE } from "src/constants/constants";
import { formatDate, formatPositiveAndNegativeValues } from "./report-common-functions";

@Injectable()
export class mandateReportService {
    constructor(private utilService: utilsService){}
    async generateMandateReport(id, res){
        try{
            const mandateDetails:any = await this.utilService.fetchMandateByLinkId(id);

            let htmlFilePath = path.join(process.cwd(), 'html-template', `mandate.html`);
            let pdfFilePath = path.join(process.cwd(), 'pdf', `${mandateDetails.data.companyName}.pdf`);

        
            await this.loadMandateHelpers(mandateDetails.data);
        
            const htmlContent = fs.readFileSync(htmlFilePath, 'utf8');
            const template = hbs.compile(htmlContent);
            const html = template(mandateDetails);
        
            let pdf =  await this.createpdf(html, pdfFilePath, mandateDetails.data);

            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename="='Mandate - ${mandateDetails.data.companyName}'.pdf"`);
            res.send(pdf);
    
            return {
                msg: "PDF download Success",
                status: true,
            };
        }
        catch(error){
            return {
                error:error,
                status:false,
                msg:"mandate pdf generation failed"
            }
        }
    }

    async loadMandateHelpers(mandateDetails){
        try{
            hbs.registerHelper('companyAddress',()=>{
                if(mandateDetails.companyAddress)
                    return mandateDetails.companyAddress;
                return '';
            })

            hbs.registerHelper('companyName',()=>{
                if(mandateDetails.companyName)
                    return mandateDetails.companyName;
                return '';
            })

            hbs.registerHelper('totalFees',()=>{
                if(mandateDetails.totalFees)
                    return formatPositiveAndNegativeValues(mandateDetails.totalFees);
                return '';
            })

            hbs.registerHelper('totalFeesInWords',()=>{
                if(mandateDetails.totalFees)
                    return `Rupees ${converter.toWords(+mandateDetails.totalFees)} Only`;;
                return '';
            })

            hbs.registerHelper('natureOfInstrument',()=>{
                if(mandateDetails.natureOfInstrument)
                    return NATURE_OF_INSTRUMENT[`${mandateDetails.natureOfInstrument}`];
                return '';
            })

            hbs.registerHelper('dateOfAppointment',()=>{
                if(mandateDetails.dateOfAppointment)
                    return formatDate(mandateDetails.dateOfAppointment);
                return '';
            })

            hbs.registerHelper('valuedEntity',()=>{
                if(mandateDetails.valuedEntity)
                    return mandateDetails.valuedEntity;
                return '';
            })

            hbs.registerHelper('sectionAndPurposeOfReport', ()=>{
              let storePurposeWiseSections = {}, overallSectionsWithPurposes = [];
              if(!mandateDetails.purposeOfReport?.length || !mandateDetails.section?.length){
                return ['Please provide data']
              }

               //Firstly create object structure with purpose of report and sections in key-value format;
              mandateDetails.purposeOfReport.forEach((indpurpose, purposeIndex)=>{
                mandateDetails.section.forEach((indSection, sectionIndex) => {
                  if(PURPOSE_OF_REPORT_AND_SECTION[indpurpose].length){
                    if(PURPOSE_OF_REPORT_AND_SECTION[indpurpose].includes(indSection)){
                      storePurposeWiseSections[indpurpose] = storePurposeWiseSections[indpurpose] || [];
                      storePurposeWiseSections[indpurpose].push(indSection);
                    }
                  }
                });
              })

              // Use that object structure created above for looping and adding sections followed by purposes
              mandateDetails.purposeOfReport.forEach((indPurposeOfReport,index)=>{
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
            return{
                error:error,
                msg:"mandate helpers failed"
            }
        }
    }

    async createpdf(htmlContent: any, pdfFilePath: string, mandateDetails) {
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
}