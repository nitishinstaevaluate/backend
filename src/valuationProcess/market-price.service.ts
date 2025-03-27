import { Injectable, NotFoundException } from "@nestjs/common";
import { NOTFOUND } from "dns";
import { AuthenticationService } from "src/authentication/authentication.service";
import { GET_MULTIPLIER_UNITS, MARKET_PRICE_ENUMS, MODEL } from "src/constants/constants";
import { convertToNumberOrZero, convertUnixTimestampToQuarterAndYear, getRequestAuth } from "src/excelFileServices/common.methods";
import { CIQ_ELASTIC_SEARCH_PRICE_EQUITY } from "src/library/interfaces/api-endpoints.local";
import { axiosInstance, axiosRejectUnauthorisedAgent } from "src/middleware/axiosConfig";
import { ProcessStatusManagerService } from "src/processStatusManager/service/process-status-manager.service";
import { ValuationsService } from "./valuationProcess.service";

@Injectable()
export class MarketPriceService {
    constructor(private authenticationService: AuthenticationService, 
        private readonly processStatusManagerService: ProcessStatusManagerService,
        private readonly valuationService: ValuationsService
    ){}
    async fetchPriceEquityShare(header, marketPriceInputpayload){
        try{
            const {companyId, valuationDateTimestamp, outstandingShares, reportingUnit, isCmpnyNmeOrVltionDteReset, processStateId} = marketPriceInputpayload;

            if(!isCmpnyNmeOrVltionDteReset && processStateId){
                const fourthStageDetails:any =  await this.processStatusManagerService.fetchStageWiseDetails(processStateId, 'fourthStageInput');
                const valuationResult = fourthStageDetails.data.fourthStageInput.appData.valuationResult.find((_e) => { return _e.model === MODEL[7] ? _e : null;});
                if(valuationResult) {
                    return {
                        sharePriceLastTenDays: valuationResult.valuationData.sharePriceLastTenDays,
                        sharePriceLastNinetyDays: valuationResult.valuationData.sharePriceLastNinetyDays,
                        vwapLastTenDays: valuationResult.valuationData.vwapLastTenDays,
                        vwapLastNinetyDays: valuationResult.valuationData.vwapLastNinetyDays,
                        valuePerShare:valuationResult.valuation,
                        equityValue: valuationResult.equityValue
                    };
                }
                else await this.fetchPriceEquityShare(header, {...marketPriceInputpayload, isCmpnyNmeOrVltionDteReset:true}); 
            }
            const oneDayInMillis = 24 * 60 * 60 * 1000;
            const valuationDate = new Date(valuationDateTimestamp);
            const valuationDatePlusOneDay = new Date(valuationDate.getTime() + oneDayInMillis);
            const valuationDatePlusOneDayTimestamp = valuationDatePlusOneDay.getTime();

            const payload = {
                companyDetails: {
                    date:convertUnixTimestampToQuarterAndYear(valuationDatePlusOneDayTimestamp).date,
                    companyId:companyId,
                }
            }
            
            if(!header)
                return 'Insufficient data (auth token not found)';
            
            const headers = { 
                'Authorization':`${header.authorization}`,
                'Content-Type': 'application/json'
            }

            const financialSegmentDetailsNSE:any = await axiosInstance.post(
                `${CIQ_ELASTIC_SEARCH_PRICE_EQUITY}`, 
                {
                    companyDetails: { 
                        ...payload.companyDetails, 
                        exchangeId: 161 
                    }
                }, 
                { httpsAgent: axiosRejectUnauthorisedAgent, headers });
            const financialSegmentDetailsBSE:any = await axiosInstance.post(`${CIQ_ELASTIC_SEARCH_PRICE_EQUITY}`, 
                {
                    companyDetails: { 
                        ...payload.companyDetails, 
                        exchangeId: 39 
                    }
                }, 
            { httpsAgent: axiosRejectUnauthorisedAgent, headers });

            if(!financialSegmentDetailsNSE?.data?.data?.length && !financialSegmentDetailsBSE?.data?.data?.length)
                return new NotFoundException(`Share price data not found for companyId - ${companyId}`).getResponse();

            const dataNse = financialSegmentDetailsNSE.data?.data;
            const dataBse = financialSegmentDetailsBSE.data?.data;

            const data = await this.mergeData(dataNse, dataBse);

            const sharePrice10Days = await this.sharePrice10Days(data);
            const computations = await this.computeValuePerShare(data);
            const equityValueNse = convertToNumberOrZero(computations.valuePerShareNse) * convertToNumberOrZero(outstandingShares)/ GET_MULTIPLIER_UNITS[`${reportingUnit}`];
            const equityValueBse = convertToNumberOrZero(computations.valuePerShareBse) * convertToNumberOrZero(outstandingShares)/ GET_MULTIPLIER_UNITS[`${reportingUnit}`];

            const processStateModel = {
                firstStageInput:{
                    validateFieldOptions:{
                        isCmpnyNmeOrVltionDteReset:false
                    },
                },
                step:5
            }
            await this.processStatusManagerService.upsertProcess(getRequestAuth(header), processStateModel, processStateId);
            
            return {
                sharePriceLastTenDays: sharePrice10Days,
                sharePriceLastNinetyDays: data,
                vwapLastTenDays: computations.vwap10Days,
                vwapLastNinetyDays: computations.vwap90Days,
                valuePerShare:{
                    valuePerShareNse: computations.valuePerShareNse,
                    valuePerShareBse: computations.valuePerShareBse
                },
                equityValue: {
                    equityValueNse,
                    equityValueBse
                },
            }
        }
        catch(error){
          return {
            error:error,
            status:false,
            msg:"Market Price Valuation calculation failed"
          }
        }
      }

      async mergeData(nseData, bseData) {
        nseData = nseData || [];
        bseData = bseData || [];
      
        const maxLength = Math.max(nseData.length, bseData.length);
      
        return Array.from({ length: maxLength }, (_, index) => {
          const nseElement = nseData[index] || {};
          const bseElement = bseData[index] || {};
      
          const { VOLUME: VOLUMENSE, VWAP: VWAPNSE, ...restNse } = nseElement;
          const { VOLUME: VOLUMEBSE, VWAP: VWAPBSE, ...restBse } = bseElement;
      
          return {
            VOLUMENSE: VOLUMENSE || null,
            VOLUMEBSE: VOLUMEBSE || null,
            VWAPBSE: VWAPBSE || null,
            VWAPNSE: VWAPNSE || null,
            ISVWAPBSENULL: VWAPBSE ? false : true,
            ISVWAPNSENULL: VWAPNSE ? false : true,
            TOTALREVENUENSE: convertToNumberOrZero(VOLUMENSE) * convertToNumberOrZero(VWAPNSE),
            TOTALREVENUEBSE: convertToNumberOrZero(VOLUMEBSE) * convertToNumberOrZero(VWAPBSE),
            ...restNse,
            ...restBse,
          };
        });
      }

      async sharePrice10Days(data){
        const createSplitter = [...data];
        return createSplitter.slice(0,10);
      }

      async computeValuePerShare(sharePrice90Days){
        const vwap10Days = this.calculateVwap(sharePrice90Days, true);
        const vwap90Days = this.calculateVwap(sharePrice90Days, false);

        const valuePerShareNse = convertToNumberOrZero(vwap90Days.VWAPNSE) > convertToNumberOrZero(vwap10Days.VWAPNSE) ? convertToNumberOrZero(vwap90Days.VWAPNSE) : convertToNumberOrZero(vwap10Days.VWAPNSE);
        const valuePerShareBse = convertToNumberOrZero(vwap90Days.VWAPBSE) > convertToNumberOrZero(vwap10Days.VWAPBSE) ? convertToNumberOrZero(vwap90Days.VWAPBSE) : convertToNumberOrZero(vwap10Days.VWAPBSE);
        return { vwap10Days, vwap90Days, valuePerShareNse, valuePerShareBse }
    }
      
    calculateVwap(sharePriceDetails, tenDaysBool){
        let volumeSummationNse = 0, volumeSummationBse = 0, totalRevenueSummationNse = 0, totalRevenueSummationBse = 0; 
        (
            tenDaysBool ? 
            sharePriceDetails.slice(0, 10) : 
            sharePriceDetails
        ).map((indSharePrice)=>{
            if(indSharePrice.VOLUMENSE){
                volumeSummationNse += convertToNumberOrZero(indSharePrice.VOLUMENSE);
            }
            if(indSharePrice.VOLUMEBSE){
                volumeSummationBse += convertToNumberOrZero(indSharePrice.VOLUMEBSE);
            }
            if(indSharePrice.TOTALREVENUENSE){
                totalRevenueSummationNse += convertToNumberOrZero(indSharePrice.TOTALREVENUENSE);
            }
            if(indSharePrice.TOTALREVENUEBSE){
                totalRevenueSummationBse += convertToNumberOrZero(indSharePrice.TOTALREVENUEBSE);
            }
        })
        return {
            VWAPNSE: convertToNumberOrZero(totalRevenueSummationNse/volumeSummationNse).toFixed(2),
            VWAPBSE: convertToNumberOrZero(totalRevenueSummationBse/volumeSummationBse).toFixed(2),
        };
      }


      async revaluationMarketPrice(header, input){
        try{
            let marketPriceValuationObj:any = {}
            const pid = input.processId;

            if(!pid) throw new NotFoundException('Process Id not found').getResponse();

            const valuationDetails:any = await this.processStatusManagerService.fetchValuationUsingPID(pid);
            const outstandingShares = valuationDetails.inputData[0].outstandingShares;
            const reportingUnit = valuationDetails.inputData[0].reportingUnit;

            for await( let indValuations of valuationDetails.modelResults){
                if (indValuations.model === MODEL[7]) {
                    const { valuationData } = indValuations;
                    const sharePriceLastTenDays = valuationData?.sharePriceLastTenDays || [];
                    const sharePriceLastNinetyDays = valuationData?.sharePriceLastNinetyDays || [];
            
                    const updateVWAP = async (elements: any[], date: string, type: string, value: any) => {
                        for await(const element of elements){
                            if (element.PRICINGDATE === date) {
                                if (type === MARKET_PRICE_ENUMS.VWAPNSE.key) element.TOTALREVENUENSE = convertToNumberOrZero(value);
                                if (type === MARKET_PRICE_ENUMS.VWAPBSE.key) element.TOTALREVENUEBSE = convertToNumberOrZero(value);
                            }
                        }
                    };
            
                    await updateVWAP(sharePriceLastTenDays, input.date, input.type, input.newValue);
                    await updateVWAP(sharePriceLastNinetyDays, input.date, input.type, input.newValue);
            
                    const computations:any = await this.computeValuePerShare(sharePriceLastNinetyDays);
                    const { valuePerShareNse, valuePerShareBse } = computations;
            
                    const multiplier = GET_MULTIPLIER_UNITS[`${reportingUnit}`];
                    const equityValueNse = convertToNumberOrZero(valuePerShareNse) * convertToNumberOrZero(outstandingShares) / multiplier;
                    const equityValueBse = convertToNumberOrZero(valuePerShareBse) * convertToNumberOrZero(outstandingShares) / multiplier;
            
                    valuationData.vwapLastTenDays = computations.vwap10Days;
                    valuationData.vwapLastNinetyDays = computations.vwap90Days;
                    indValuations.valuation = {
                        valuePerShareNse,
                        valuePerShareBse,
                    };
                    indValuations.equityValue = {
                        equityValueNse,
                        equityValueBse,
                    };

                    marketPriceValuationObj = indValuations;
                }
            }

            const fourthStageDetails:any = await this.processStatusManagerService.fetchStageWiseDetails(pid, 'fourthStageInput');

            const valuationResult = fourthStageDetails.data.fourthStageInput.appData.valuationResult;
            for await(const data of valuationResult){
                if (data.model === MODEL[7]) {
                    data.valuationData = marketPriceValuationObj?.valuationData;
                    data.equityValue = marketPriceValuationObj?.equityValue;
                    data.valuation = marketPriceValuationObj?.valuation;
                }
            }

            const valuationWithoutInternalProps = valuationDetails.toObject({ getters: true, virtuals: true });

            const { _id, ...rest } = valuationWithoutInternalProps;

            await this.valuationService.createValuation(rest, _id);

            const processStateModel ={
                fourthStageInput: fourthStageDetails.data.fourthStageInput,
                step: 4
            }
            await this.processStatusManagerService.upsertProcess(getRequestAuth(header), processStateModel, pid);
            
            return  {
                data: fourthStageDetails.data.fourthStageInput,
                message:'Request Successful',
                status:true
              }
        }
        catch(error){
            throw error;
        }
      }
}