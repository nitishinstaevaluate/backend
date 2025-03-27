import { Injectable, NotFoundException } from "@nestjs/common";
import { MNEMONICS_ARRAY_2, MNEMONIC_ENUMS, RATIO_TYPE } from "src/constants/constants";
import { extractValues, calculateMean, calculateMedian, ciqCompanyMeanMedianStructure } from "./ciq-common-functions";


@Injectable()
export class ciqSpCompanyMeanMedianService {

    async createRatioWisePayloadStructure(data, valuationDate){
        try{

          const finalPayload = [];

            for await (const mnemonic of MNEMONICS_ARRAY_2) {
                const payload = await ciqCompanyMeanMedianStructure(data, valuationDate, mnemonic);
                finalPayload.push(...payload.data);
            }

          return {inputRequests:finalPayload};
        }
        catch(error){
          return {
            error:error,
            status:false,
            msg:"Payload creation failed"
          }
        }
      }
  
      async calculateCompanyMeanMedianAggregate(axiosResponse,inputData,type){
        try{
          if (!axiosResponse.data) {
            throw new NotFoundException({
              message: 'Axios response not found',
              status: false,
            });
          }
  
          const result = {};
          let maxLength = 0
          for await (const details of axiosResponse.data.GDSSDKResponse) {
            if (!details.ErrMsg) {
              for await (const mnemonic of MNEMONICS_ARRAY_2) {
                if (details.Headers.includes(mnemonic)) {
                  result[mnemonic] = result[mnemonic] || [];
                  result[mnemonic].push(...await extractValues(details, mnemonic));
  
                  const currentLength = result[mnemonic].length;
                  if (currentLength > maxLength) {
                    maxLength = currentLength;
                  }
                }
              }
            }
            else{
              result[details.Mnemonic] = [];
            }
          }
          const serialiseRatio:any =await this.searializeRatioList(result, inputData, maxLength);
  
          let meanRatio = {}, medianRatio = {};
          const calculatePeRatio:any = await this.calculateRatioMetric(result[MNEMONIC_ENUMS.IQ_PE_NORMALIZED], type, maxLength);
          const calculatePbvRatio:any = await this.calculateRatioMetric(result[MNEMONIC_ENUMS.IQ_PBV], type, maxLength);
          const calculateEbitdaRatio:any = await this.calculateRatioMetric(result[MNEMONIC_ENUMS.IQ_TEV_EBITDA], type, maxLength);
          const calculatePsRatio:any = await this.calculateRatioMetric(result[MNEMONIC_ENUMS.IQ_PRICE_SALES], type, maxLength);
          
          if(type === RATIO_TYPE[0]){
            meanRatio = {
              company: "Average",
              peRatio: calculatePeRatio.mean,
              pbRatio: calculatePbvRatio.mean, 
              ebitda:  calculateEbitdaRatio.mean, 
              sales: calculatePsRatio.mean
            }
            medianRatio = {
              company: "Median",
              peRatio: calculatePeRatio.median, 
              pbRatio: calculatePbvRatio.median, 
              ebitda: calculateEbitdaRatio.median, 
              sales: calculatePsRatio.median
            }
            return [...serialiseRatio,meanRatio, medianRatio]
          }
          else{
            meanRatio = {
              company: "Average",
              peRatio: calculatePeRatio.mean,
              pbRatio: calculatePbvRatio.mean, 
              ebitda:  calculateEbitdaRatio.mean, 
              sales: calculatePsRatio.mean
            }
            return [...serialiseRatio,meanRatio]
          }
        }
        catch(error){
          return {
            error:error,
            status:false,
            msg:"mean and median computaion failed"
          }
        }
      }
  
      async searializeRatioList(data, inputList, maxLength){
        try{
          let array = [];
          for(let i = 0; i < maxLength; i++){
            array.push(
              {
                company: inputList[i].COMPANYNAME,
                companyId: inputList[i].COMPANYID,
                peRatio: data[MNEMONIC_ENUMS.IQ_PE_NORMALIZED][i],
                pbRatio: data[MNEMONIC_ENUMS.IQ_PBV][i],
                sales: data[MNEMONIC_ENUMS.IQ_PRICE_SALES][i],
                ebitda: data[MNEMONIC_ENUMS.IQ_TEV_EBITDA][i],
                /**
                 * Ensure all companies to be selected by default
                 */
                isSelected:true
              }
            )
          }
          return array;
        }
        catch(error){
          return{
            error:error,
            status:false,
            msg:"Serialisation failed"
          }
        }
      }
  
      async calculateRatioMetric(data, method, maxLength){
        try{
          const result = (method === RATIO_TYPE[0])
          ? {mean: await calculateMean(data, maxLength), median: await calculateMedian(data)}
          : {mean: await calculateMean(data, maxLength)};
      
          return result;
        }
        catch(error){
          return {
            error:error,
            status:false,
            msg:"beta median/mean calculation failed"
          }
        }
      }
}