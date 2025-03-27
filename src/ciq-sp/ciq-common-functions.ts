import { MNEMONIC_ENUMS, MODEL } from "src/constants/constants"
import { convertToNumberOrZero } from "src/excelFileServices/common.methods"

    export async function iqCreateStructure(data,mnemonic){
        return {
            "data":data.industryAggregateList.map((elements)=>{
            return {
                "function":"GDSP",
                "mnemonic":`${mnemonic}`,
                "identifier":`IQ${elements.COMPANYID}`,
                "properties":{
                "periodType": "IQ_FY",
                "asOfDate": `${data.valuationDate}`
                }
            }
            })
        }
    }

    export async function ciqFinancialCreateStructure(data, mnemonic, valuationDate){
        return {
            "data":data.map((elements)=>{
            return {
                "function":"GDSP",
                "mnemonic":`${mnemonic}`,
                "identifier":`IQ${elements.COMPANYID}`,
                "properties":{
                "asOfDate": `${valuationDate}`
                }
            }
            })
        }
    }

    export async function ciqStockBetaCreateStructure(data, mnemonic) {
        return {
            "function":"GDSP",
            "mnemonic":`${mnemonic}`,
            "identifier":`IQ${data.companyId}`,    
            "properties": {
            "periodType": "IQ_FY",
            "asOfDate" : `${data.valuationDate}`
            }
        }
    }
    export async function extractValues(betaDetails: any, mnemonic: any) {
        try {
        return betaDetails.Rows.map((innerBetaRows: any) => {
            const value = innerBetaRows?.Row[0];
            return !isNaN(parseInt(value)) && !`${value}`.includes('-') && value !== "0"
            ? parseFloat(value)
            : null;
        });
        } 
        catch (error) {
        return {
            error: error,
            status: false,
            msg: `Beta extraction failed for ${mnemonic}`,
        };
        }
    }

    export async function calculateMean(data, maxLength){
        try{
            let total = 0;
            let staticMaxLength = 0
            for await (const items of data){
                if(items){
                    total += convertToNumberOrZero(items);
                    staticMaxLength++;
                }
            }
            return total/staticMaxLength;
        }
        catch(error){
        return {
            error:error,
            msg:"mean calculation failed",
            status:false
        }
        }
    }

    export async function calculateMedian(data){
        try{
        let median;
        const validData = data.filter(value => convertToNumberOrZero(value) > 0);
        const sortedData = [...validData].sort((a, b) => convertToNumberOrZero(a) - convertToNumberOrZero(b));
        const middleIndex = Math.floor(sortedData.length / 2);
        
        if (sortedData.length % 2 === 0) {
            median =  (sortedData[middleIndex - 1] + sortedData[middleIndex]) / 2;
        } 
        else {
            median =  sortedData[middleIndex];
        }
        return median;
        }
        catch(error){
        return {
            error:error,
            status:false,
            msg:"Median calculation failed"
        }
        }
    }


    export function getOneDayBeforeDate(){
        try{
        const currentDate = new Date();
        const oneDayBefore = new Date(currentDate);
        oneDayBefore.setDate(currentDate.getDate() - 1);
        const formattedDate = `${(oneDayBefore.getMonth() + 1).toString().padStart(2, '0')}/${oneDayBefore.getDate().toString().padStart(2, '0')}/${oneDayBefore.getFullYear()}`;

        return formattedDate
        }
        catch(error){
        return{
            error:error,
            msg:"Date not found",
            status:false
        }
        }
    }

    export async function ciqCompanyMeanMedianStructure(data:any, valuationDate, mnemonic){
        return {
        "data":data.map((elements)=>{
            return {
            "function":"GDSP",
            "mnemonic":`${mnemonic}`,
            "identifier":`IQ${elements.COMPANYID}`,
            "properties":{
                /**
                 * What was happening is that earlier we were only using period type as IQ_CY (without passing asofdate) which gives very recent data, ie. yesterdays data
                */
                // "periodType":"IQ_CY"

                /**
                 * Now we pass valuation date for fetching data for that date only with period type as IQ_LTM
                 */
                "periodType":"IQ_LTM",
                "asOfDate" : `${valuationDate}`
            }
            }
        })
        }
    }

    export async function  ciqSharePriceCreateStructure(data:any, mnemonic){
        return {
            "data":data.map((elements)=>{
                return {
                "function":"GDSP",
                "mnemonic":`${mnemonic}`,
                "identifier":`IQ${elements.COMPANYID}`,
                "properties":{
                    "periodType":"IQ_CY"
                }
                }
            })
            }
    }

    export function formatDateToMMDDYYYY(input: Date | number): string {
        const date = input instanceof Date ? input : new Date(input);
      
        const day = date.getDate().toString().padStart(2, '0');
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const year = date.getFullYear();

        return `${month}/${day}/${year}`;
      }

     export function isNotRuleElevenUaAndNav(modelArray:any){
        if (modelArray?.length === 1 &&
          (
            modelArray?.includes(MODEL[6]) ||
            modelArray?.includes(MODEL[5])
          ))
          {
          return false;
          }
          else if(modelArray?.length === 2 && (
            modelArray?.includes(MODEL[6]) &&
            modelArray?.includes(MODEL[5])
          )){
            return false;
          }
          else if(modelArray?.length  > 1 && (
            modelArray?.includes(MODEL[6]) ||
            modelArray?.includes(MODEL[5])
          )){
            return true;
          }
          else{
            return true;
          }
      }

      export function convertIntoTimeStamp(inputDate) {
        const [month, day, year] = inputDate.split('/');
        
        const date = new Date(year, month - 1, day);

        // Adding 5:30 hours, since we want exact date for filtering into elastic search db
        date.setHours(date.getHours() + 5);
        date.setMinutes(date.getMinutes() + 30);
        
        return date;
    }