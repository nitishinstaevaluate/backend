import { HttpException, HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ElevenUaDocument } from './schema/eleven-ua.schema';
import { ExcelSheetService } from 'src/excelFileServices/uploadExcel.service';
import * as xlsx from 'xlsx';
import { convertToNumberOrZero, getCellValue, isObjectEmpty } from 'src/excelFileServices/common.methods';
import { columnsList, RULE_ELEVEN_UA_RAW_LINE_ITEMS, sheet4_ruleElevenUaObj } from 'src/excelFileServices/excelSheetConfig';
import { AuthenticationService } from 'src/authentication/authentication.service';
import { plainToClass } from 'class-transformer';
import { ElevenUaDTO, FetchElevenUaDto } from './dto/eleven-ua.dto';
import { thirdpartyApiAggregateService } from 'src/library/thirdparty-api/thirdparty-api-aggregate.service';
import { KeyCloakAuthGuard } from 'src/middleware/key-cloak-auth-guard';
import { convertToRomanNumeral, formatPositiveAndNegativeValues } from 'src/report/report-common-functions';
import { ExcelArchiveService } from 'src/excel-archive/service/excel-archive.service';

@Injectable()
export class ElevenUaService {
    constructor(@InjectModel('ruleelevenua') private readonly ruleelevenuaModel: Model<ElevenUaDocument>,
    private readonly thirdpartyApiAggregate: thirdpartyApiAggregateService,
    private readonly authenticationService:AuthenticationService,
    private readonly excelArchiveService: ExcelArchiveService){}

    async upsertProcess(req,payload,id){
        try{
            if(!payload)
                return {
                    msg:'Incorrect Payload',
                    status:false,
                }

            const processId = payload?.processStateId;

            const excelArchive: any = await this.excelArchiveService.fetchExcelByProcessStateId(processId);
            const ruleElevenUaRowCount = excelArchive?.rule11UaSheetRowCount || 0;

            let ruleElevenUaArchive = {},keysToProcess = [];
            if(ruleElevenUaRowCount){
                const ruleElevenUaData = excelArchive?.rule11UaSheetdata;
                for await (const indArchive of ruleElevenUaData){
                    const {lineEntry,  ...rest} = indArchive; 
                    ruleElevenUaArchive[indArchive.lineEntry.particulars] = rest;
                }
                keysToProcess = Object.keys(ruleElevenUaData[0]).filter(ruleKey=>ruleKey === 'Amount ')
            }

            const KCGuard:any = new KeyCloakAuthGuard();
            const authorizeUser = await KCGuard.fetchAuthUser(req).toPromise();

            if(!authorizeUser.status)
                return authorizeUser

            if(isObjectEmpty(ruleElevenUaArchive))
                throw new  NotFoundException({
                    msg:"Rule Eleven Ua archive object is empty, please check data in DB",
                    status:false
                })
                
                
                const amountKey = keysToProcess[0];
                /**
                 * keysToProcess[0] contains Amount Key as on index 0
                 * 
                 * Calculate Book value of all assets
                 */
                const totalAssets = convertToNumberOrZero(ruleElevenUaArchive[RULE_ELEVEN_UA_RAW_LINE_ITEMS.assets.innerAsset.totalAsset.particulars][amountKey]);
                const immovableProperty = convertToNumberOrZero(ruleElevenUaArchive[RULE_ELEVEN_UA_RAW_LINE_ITEMS.assets.innerAsset.nonCurrentAssetRow.innerNonCurrentAssetRow.immovableProperty.particulars][amountKey]);
                const jewellery = convertToNumberOrZero(ruleElevenUaArchive[RULE_ELEVEN_UA_RAW_LINE_ITEMS.assets.innerAsset.nonCurrentAssetRow.innerNonCurrentAssetRow.jewellery.particulars][amountKey]);
                const artisticWork = convertToNumberOrZero(ruleElevenUaArchive[RULE_ELEVEN_UA_RAW_LINE_ITEMS.assets.innerAsset.nonCurrentAssetRow.innerNonCurrentAssetRow.artisticWork.particulars][amountKey]);
                const sharesAndSecurities = convertToNumberOrZero(ruleElevenUaArchive[RULE_ELEVEN_UA_RAW_LINE_ITEMS.assets.innerAsset.nonCurrentAssetRow.innerNonCurrentAssetRow.sharesAndSecurities.particulars][amountKey]);
                const currentInvestmentAndSecurities = convertToNumberOrZero(ruleElevenUaArchive[RULE_ELEVEN_UA_RAW_LINE_ITEMS.assets.innerAsset.currentAssetRow.innerCrrntAsset.invsmntInShrsAndSecrities.particulars][amountKey]);
                const currentOtherInvestments = convertToNumberOrZero(ruleElevenUaArchive[RULE_ELEVEN_UA_RAW_LINE_ITEMS.assets.innerAsset.currentAssetRow.innerCrrntAsset.othrInvstmnt.particulars][amountKey]);
                const nonCurrentInvestmentAndSecurities = convertToNumberOrZero(ruleElevenUaArchive[RULE_ELEVEN_UA_RAW_LINE_ITEMS.assets.innerAsset.nonCurrentAssetRow.innerNonCurrentAssetRow.invstmntInShareAndSecurities.particulars][amountKey]);
                const nonCurrentOtherInvestments = convertToNumberOrZero(ruleElevenUaArchive[RULE_ELEVEN_UA_RAW_LINE_ITEMS.assets.innerAsset.nonCurrentAssetRow.innerNonCurrentAssetRow.othrInvstmnt.particulars][amountKey]);

                const bookValueOfAllAssets = (totalAssets - immovableProperty - jewellery - artisticWork - sharesAndSecurities - currentInvestmentAndSecurities - currentOtherInvestments - nonCurrentInvestmentAndSecurities - nonCurrentOtherInvestments).toFixed(2);

                /* calculate income tax refund claim 
                * Transfer of shares - b20+b21+b38
                * Issuance of shares - b20+b21+b37+b38
                */
                let totalIncomeTaxPaid;
                const advanceTax = convertToNumberOrZero(ruleElevenUaArchive[RULE_ELEVEN_UA_RAW_LINE_ITEMS.assets.innerAsset.nonCurrentAssetRow.innerNonCurrentAssetRow.advnceTx.particulars][amountKey]);
                const incomeTaxRefund = convertToNumberOrZero(ruleElevenUaArchive[RULE_ELEVEN_UA_RAW_LINE_ITEMS.assets.innerAsset.nonCurrentAssetRow.innerNonCurrentAssetRow.incmeTaxRefnd.particulars][amountKey]);
                const advanceTaxPaid = convertToNumberOrZero(ruleElevenUaArchive[RULE_ELEVEN_UA_RAW_LINE_ITEMS.assets.innerAsset.currentAssetRow.innerCrrntAsset.advnceTxPaid.particulars][amountKey]);
                const tdsRecievable = convertToNumberOrZero(ruleElevenUaArchive[RULE_ELEVEN_UA_RAW_LINE_ITEMS.assets.innerAsset.currentAssetRow.innerCrrntAsset.tdsRecvbles.particulars][amountKey]);
                if(payload?.issuanceOfShares){
                    totalIncomeTaxPaid = (advanceTax + incomeTaxRefund + advanceTaxPaid + tdsRecievable).toFixed(2);
                }
                else{
                    totalIncomeTaxPaid = (advanceTax + incomeTaxRefund + advanceTaxPaid).toFixed(2);
                }
            
                // calculate unamortised amount of deffered expenditure b39 + b40 + b41+ b22
                const preliminaryExpense = convertToNumberOrZero(ruleElevenUaArchive[RULE_ELEVEN_UA_RAW_LINE_ITEMS.assets.innerAsset.currentAssetRow.innerCrrntAsset.prlmnryExpnse.particulars][amountKey]);
                const preOperativeExpense = convertToNumberOrZero(ruleElevenUaArchive[RULE_ELEVEN_UA_RAW_LINE_ITEMS.assets.innerAsset.currentAssetRow.innerCrrntAsset.prOprtveExpnse.particulars][amountKey]);
                const otherMiscllneousExpense = convertToNumberOrZero(ruleElevenUaArchive[RULE_ELEVEN_UA_RAW_LINE_ITEMS.assets.innerAsset.currentAssetRow.innerCrrntAsset.othrMisclneousExpnse.particulars][amountKey]);
                const deferredTaxAssets = convertToNumberOrZero(ruleElevenUaArchive[RULE_ELEVEN_UA_RAW_LINE_ITEMS.assets.innerAsset.nonCurrentAssetRow.innerNonCurrentAssetRow.deffrdTxAsstNet.particulars][amountKey]);

                const unamortisedAmountOfDeferredExpenditure = (preliminaryExpense + preOperativeExpense + otherMiscllneousExpense + deferredTaxAssets).toFixed(2);

                // calculate book value of liabilities
                const bookValueOfLiabilities = convertToNumberOrZero(ruleElevenUaArchive[RULE_ELEVEN_UA_RAW_LINE_ITEMS.assets.innerAsset.totalAsset.particulars][amountKey]).toFixed(2);

                // calculate paid-up capital/share capital
                const paidUpCapital = convertToNumberOrZero(ruleElevenUaArchive[RULE_ELEVEN_UA_RAW_LINE_ITEMS.equityAndLiabilities.innerEquityAndLiability.equityRow.innerEquityRow.shareCapital.particulars][amountKey]).toFixed(2);

                // calculate amount set apart for payment of dividends
                const paymentDividends = convertToNumberOrZero(ruleElevenUaArchive[RULE_ELEVEN_UA_RAW_LINE_ITEMS.equityAndLiabilities.innerEquityAndLiability.equityRow.innerEquityRow.amntSetAprtForPymntOfDvdnds.particulars][amountKey]).toFixed(2);


                // calculate reserve and surplus
                const reserveAndSurplus = convertToNumberOrZero(ruleElevenUaArchive[RULE_ELEVEN_UA_RAW_LINE_ITEMS.equityAndLiabilities.innerEquityAndLiability.equityRow.innerEquityRow.rsrveAndSrplus.particulars][amountKey]).toFixed(2);

                // calculate amount representing provision for taxation
                const provisionForTaxation = convertToNumberOrZero(ruleElevenUaArchive[RULE_ELEVEN_UA_RAW_LINE_ITEMS.equityAndLiabilities.innerEquityAndLiability.liabilitiesRow.nonCurrentLiabilitiesRow.innerNonCrrntLiabilitiesRow.prvsionForTxation.particulars][amountKey]).toFixed(2);

                // calculate current-investment (shares and securities) and non-current-investment (shares and securities)
                const totalInvestmentSharesAndSecurities = (currentInvestmentAndSecurities + nonCurrentInvestmentAndSecurities).toFixed(2);

                const createPayload = {
                    bookValueOfAllAssets,
                    totalIncomeTaxPaid,
                    unamortisedAmountOfDeferredExpenditure,
                    totalInvestmentSharesAndSecurities,
                    bookValueOfLiabilities,
                    paidUpCapital,
                    paymentDividends,
                    reserveAndSurplus,
                    provisionForTaxation,
                    userId:authorizeUser.userId,
                    inputData:payload
                }
                let computations = await this.calculateElevenUaParameters(createPayload);
                createPayload['computations'] = computations;

                let elevenUaResponse;

                if(id && id !== 'undefined'){
                    const elevenUaExist = await this.ruleelevenuaModel.findById(id);

                    if(elevenUaExist){

                        elevenUaResponse = await this.ruleelevenuaModel.findOneAndUpdate(
                            {_id:id},
                            createPayload,
                            { new:true }
                        )
                    }
                    else{

                        return {
                            msg:"Id not found",
                            status:false,
                        }
                    }
                }
                else{

                    elevenUaResponse = await new this.ruleelevenuaModel(createPayload).save();
                }

            return {
                data:elevenUaResponse,
                msg:"valuation success",
                status:true
            }
        }
        catch(error){
            throw error;
        }
    }

    async fetchRuleElevenUa(id){
        try{
            const  data = plainToClass(FetchElevenUaDto,await this.ruleelevenuaModel.findById({_id:id}), {excludeExtraneousValues:true})
            return {
                data,
                msg:"record found",
                status:true
            }
        }
        catch(error){
            return {
                error:error,
                msg:'eleven ua record not found',
                status:false
            } 
        }
    }

    // Use this function to compute valuation related parameters like value per share,etc
    // Code optimisation, no need to perform similar below operation on front-end and while generating report  
    async calculateElevenUaParameters(preParameters){
        try{
            let totalCalculationA, totalCalculationB, totalCalculationC, totalCalculationD, totalCalculationL;

                //Calculation at A 
                const totalIncomeTaxPaid = convertToNumberOrZero(preParameters.totalIncomeTaxPaid);
                const unamortisedAmountOfDeferredExpenditure = convertToNumberOrZero(preParameters.unamortisedAmountOfDeferredExpenditure);
                const bookValueOfAllAssets = convertToNumberOrZero(preParameters.bookValueOfAllAssets);
                totalCalculationA = preParameters.bookValueOfAllAssets -  (totalIncomeTaxPaid + unamortisedAmountOfDeferredExpenditure); 
                const calculationAtA =  (bookValueOfAllAssets -  (totalIncomeTaxPaid + unamortisedAmountOfDeferredExpenditure));

                // Calculation of jwellery and artistic works
                let jewelleryOrArtisticWork=[];
                const jewellery = preParameters.inputData?.fairValueJewellery;
                const artisticWork = preParameters.inputData?.fairValueArtistic;
                const jewelleryAndArtisticWorkArray = [
                  {
                    name:"Jewellery",
                    value:jewellery
                  },
                  {
                    name:"Artistic Value",
                    value:artisticWork
                  }
                ]
                for(let i = 0; i <= jewelleryAndArtisticWorkArray.length; i++){
                  if(jewelleryAndArtisticWorkArray[i]?.name){
                      const romanNumeral = convertToRomanNumeral(i);
                      const obj = {
                        index:romanNumeral,
                        label:jewelleryAndArtisticWorkArray[i]?.name,
                        value:formatPositiveAndNegativeValues(jewelleryAndArtisticWorkArray[i].value) 
                      }
                      jewelleryOrArtisticWork.push(obj);
                    }
                  }

                let totalValue = 0;
                totalValue = convertToNumberOrZero(jewellery) + convertToNumberOrZero(artisticWork);
                totalCalculationB = totalValue ? totalValue : 0;
                const calculationAtB = convertToNumberOrZero(totalValue);

                // calculation at C
                let investment=0;
                const investmentTotalFromExcel = preParameters.totalInvestmentSharesAndSecurities;
                const elevenUaInvestment = preParameters.inputData.fairValueinvstShareSec;
                investment = elevenUaInvestment;
                if(!elevenUaInvestment){
                   investment =  investmentTotalFromExcel;
                }
                totalCalculationC = convertToNumberOrZero(investment);
                const calculationAtC = convertToNumberOrZero(investment);

                // calculation at D
                totalCalculationD = convertToNumberOrZero(preParameters?.inputData.fairValueImmovableProp);
                const calculationAtD = convertToNumberOrZero(preParameters?.inputData.fairValueImmovableProp);

                // calculation at L
                const paidUpCapital = preParameters.paidUpCapital;
                const paymentDividends = preParameters.paymentDividends;
                const reservAndSurplus = preParameters.reserveAndSurplus;
                const provisionForTaxation = preParameters.provisionForTaxation;
                totalCalculationL = (convertToNumberOrZero(preParameters.bookValueOfLiabilities) - 
                (convertToNumberOrZero(paidUpCapital) +
                    convertToNumberOrZero(paymentDividends) + 
                    convertToNumberOrZero(reservAndSurplus) + 
                    convertToNumberOrZero(provisionForTaxation) + 
                    convertToNumberOrZero(preParameters.inputData?.contingentLiability) + 
                    convertToNumberOrZero(preParameters.inputData?.otherThanAscertainLiability)));
                
                    const calculationAtL = (
                    convertToNumberOrZero(preParameters.bookValueOfLiabilities) - 
                (
                    convertToNumberOrZero(paidUpCapital) + 
                    convertToNumberOrZero(paymentDividends) + 
                    convertToNumberOrZero(reservAndSurplus) + 
                    convertToNumberOrZero(provisionForTaxation) + 
                    convertToNumberOrZero(preParameters.inputData?.contingentLiability) + 
                    convertToNumberOrZero(preParameters.inputData?.otherThanAscertainLiability)
                )
                );

                /* total calculation  
                * transfer of shares : A + B + C + D - L
                * issuance of shares : A - L
                */
                let totalCalculation = 0;
                if(preParameters.inputData?.issuanceOfShares){
                    totalCalculation = convertToNumberOrZero(convertToNumberOrZero(totalCalculationA) - convertToNumberOrZero(totalCalculationL));
                }
                else{
                    totalCalculation = convertToNumberOrZero(convertToNumberOrZero(totalCalculationA)+ convertToNumberOrZero(totalCalculationB) + convertToNumberOrZero(totalCalculationC) + convertToNumberOrZero(totalCalculationD) - convertToNumberOrZero(totalCalculationL));
                }


                // calculating Value Per share
                const faceValue = !isNaN(parseFloat(preParameters?.inputData?.faceValue)) ? parseFloat(preParameters?.inputData?.faceValue) : 1;
                const newPaidUpCapital = !isNaN(parseFloat(preParameters?.paidUpCapital)) ? parseFloat(preParameters?.paidUpCapital) : 1;
            
                let totalSum = 0;
                if(preParameters.inputData?.issuanceOfShares) {
                    totalSum = convertToNumberOrZero(totalCalculationA) - convertToNumberOrZero(totalCalculationL);
                }
                else{
                    totalSum = convertToNumberOrZero(totalCalculationA) + convertToNumberOrZero(totalCalculationB) + convertToNumberOrZero(totalCalculationC) + convertToNumberOrZero(totalCalculationD) - convertToNumberOrZero(totalCalculationL);
                }
            
                let result;
            
                if (!isNaN(totalSum) && !isNaN(newPaidUpCapital) ) {
                    result = (totalSum * faceValue) / newPaidUpCapital;
                } else {
                    result = 0;
                }
            
                const valuePerShare =  convertToNumberOrZero(result);

                return {
                    calculationAtA,
                    calculationAtB,
                    calculationAtC,
                    calculationAtD,
                    calculationAtL,
                    totalCalculation,
                    valuePerShare,
                    jewelleryOrArtisticArray: jewelleryOrArtisticWork
                }
        }
        catch(error){
            throw new HttpException(
                {
                  error: error,
                  status: false,
                  msg: 'post-calculation of eleven ua failed',
                },
                HttpStatus.INTERNAL_SERVER_ERROR,
              );
        }
    }
}
