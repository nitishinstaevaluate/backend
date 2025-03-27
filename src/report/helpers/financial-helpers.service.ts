import { Injectable } from "@nestjs/common";
import hbs = require('handlebars');
import { MODEL } from "src/constants/constants";
import { convertToNumberOrZero } from "src/excelFileServices/common.methods";
import { formatPositiveAndNegativeValues } from "../report-common-functions";
import * as converter from 'number-to-words';

@Injectable()
export class financialHelperService{

    loadFinancialTableHelper(financialData, valuationDetails, allProcessStageDetails){
        hbs.registerHelper('financialSegment',()=>{
          let financiallyFilteredCompany = [], companySelectedArray = [], isSelectedExists = false;
          if(financialData){
            valuationDetails.modelResults.map((data)=>{
              if(data.model === MODEL[2] || data.model === MODEL[4]){
                isSelectedExists  = data.valuationData?.companies.some((indCompanies: any) => 'isSelected' in indCompanies);
                if(isSelectedExists){
                  companySelectedArray = data.valuationData?.companies;
                }
              }
            }
            )
            if(isSelectedExists && companySelectedArray?.length){
              let counter = 1;
              companySelectedArray.map((indFilterCompany)=>{
                financialData.map((indFinancialCompanyData)=>{
                  if(indFinancialCompanyData?.companyId === indFilterCompany?.companyId && indFilterCompany?.isSelected){
                    indFinancialCompanyData['serialNo'] = counter;
                    financiallyFilteredCompany.push(indFinancialCompanyData);
                    counter ++;
                  }
                })
              })
              return financiallyFilteredCompany;
            }
            else{
              return financialData;
            }
          }
          return [];
        })
    
        hbs.registerHelper('totalNumberOfCompaniesSelected',(format?)=>{
          if(valuationDetails?.modelResults){
            let companySelectedArray = [], defaultCompaniesArray = [];
            valuationDetails.modelResults.map((data)=>{
              if(data.model === MODEL[2] || data.model === MODEL[4]){
                data.valuationData?.companies.map((allCompanies)=>{
                  if(allCompanies?.companyId){
                    defaultCompaniesArray.push(allCompanies);
                  }
                  if(allCompanies?.isSelected){
                    companySelectedArray.push(allCompanies);
                  }
                })
              }
            }
          )
          let totalLength = 0;
          if(!companySelectedArray.length){
            totalLength = defaultCompaniesArray.length;
          }
          else{
            totalLength = companySelectedArray.length;
          }
            return format && format === 'number' ?  formatPositiveAndNegativeValues(totalLength) : converter.toWords(convertToNumberOrZero(totalLength))
          }
          return 'zero';
        })
    
        hbs.registerHelper('fiancialMean',()=>{
          let mean = 0;
          if(financialData){
            financialData.map((elements)=>{
              mean += convertToNumberOrZero(elements.evByRevenue);
            })
            return (mean/financialData.length).toFixed(2);
          }
          return 0;
        })
    
        hbs.registerHelper('priceToSalesMean',()=>{
          const ccmMetricType = allProcessStageDetails.stateInfo?.fifthStageInput?.ccmVPStype || 'average';
          let mean = 0;
          if(financialData){
            valuationDetails.modelResults.map((data)=>{
              if(data.model === MODEL[2] || data.model === MODEL[4]){
                const companies = data.valuationData?.companies;
                if(!companies?.length)
                    return mean = 0;
                companies.map((indCompany)=>{
                  if(ccmMetricType === 'average'){
                    if(indCompany.company === 'Average') mean = indCompany.sales;
                  }
                  else{
                    if(indCompany.company === 'Median') mean = indCompany.sales;
                  }
                })
              }
            }
            )
            // financialData.map((elements)=>{
            //   mean += convertToNumberOrZero(elements.sales);
            // })
            return convertToNumberOrZero(mean).toFixed(2);
          }
          return 0;
        })
        hbs.registerHelper('priceToBookMean',()=>{
          const ccmMetricType = allProcessStageDetails.stateInfo?.fifthStageInput?.ccmVPStype || 'average';
          let mean = 0;
          if(financialData){
            valuationDetails.modelResults.map((data)=>{
              if(data.model === MODEL[2] || data.model === MODEL[4]){
                const companies = data.valuationData?.companies;
                if(!companies?.length)
                  return mean = 0;
                companies.map((indCompany)=>{
                  if(ccmMetricType === 'average'){
                    if(indCompany.company === 'Average') mean = indCompany.pbRatio;
                  }
                  else{
                    if(indCompany.company === 'Median') mean = indCompany.pbRatio;
                  }
                })
              }
            }
            )
            // financialData.map((elements)=>{
            //   mean += convertToNumberOrZero(elements.pbRatio);
            // })
            return convertToNumberOrZero(mean).toFixed(2);
          }
          return 0;
        })
    
        hbs.registerHelper('priceToEquityMean',()=>{
          const ccmMetricType = allProcessStageDetails.stateInfo?.fifthStageInput?.ccmVPStype || 'average';
          let mean = 0;
          if(financialData){
            valuationDetails.modelResults.map((data)=>{
              if(data.model === MODEL[2] || data.model === MODEL[4]){
                const companies = data.valuationData?.companies;
                if(!companies?.length)
                  return mean = 0;
                companies.map((indCompany)=>{
                  if(ccmMetricType === 'average'){
                    if(indCompany.company === 'Average') mean = indCompany.peRatio;
                  }
                  else{
                    if(indCompany.company === 'Median') mean = indCompany.peRatio;
                  }
                })
              }
            }
            )
            // financialData.map((elements)=>{
            //   mean += convertToNumberOrZero(elements.peRatio);
            // })
            return convertToNumberOrZero(mean).toFixed(2);
          }
          return 0;
        })
        hbs.registerHelper('evByEbitdaMean',()=>{
          const ccmMetricType = allProcessStageDetails.stateInfo?.fifthStageInput?.ccmVPStype || 'average';
          let mean = 0;
          if(financialData){
            valuationDetails.modelResults.map((data)=>{
              if(data.model === MODEL[2] || data.model === MODEL[4]){
                const companies = data.valuationData?.companies;
                if(!companies?.length)
                  return mean = 0;
                companies.map((indCompany)=>{
                  if(ccmMetricType === 'average'){
                    if(indCompany.company === 'Average') mean = indCompany.ebitda;
                  }
                  else{
                    if(indCompany.company === 'Median') mean = indCompany.ebitda;
                  }
                })
              }
            }
            )
            // financialData.map((elements)=>{
            //   mean += convertToNumberOrZero(elements.ebitda);
            // })
            return convertToNumberOrZero(mean).toFixed(2);
          }
          return 0;
        })
    
        hbs.registerHelper('fixDecimalUptoTwo',(val)=>{
          if (val) {
            return formatPositiveAndNegativeValues(val);
          }
          return '-';
        })
    
        hbs.registerHelper('decimalAdjustment',(val)=>{
          if (val && !isNaN(+val)) {
            return parseFloat(val).toFixed(2).replace(/\d(?=(\d{3})+\.)/g, '$&,');
          }
          return '-';
        })
    
        hbs.registerHelper('lessDiscountRate',()=>{
          if (valuationDetails) {
            return valuationDetails.inputData[0].discountRateValue;
          }
          return '-';
        })

        hbs.registerHelper('lessDiscountRateExist',()=>{
          console.log(valuationDetails.inputData[0].discountRateValue)

          if (valuationDetails) {
            return valuationDetails.inputData[0].discountRateValue && 
            (
              valuationDetails.inputData[0].discountRateValue !== '0' &&
              valuationDetails.inputData[0].discountRateValue !== 0
            ) ? true : false;
          }
          return false;
        })
        hbs.registerHelper('postDiscount',(mean)=>{
          if (mean || valuationDetails.inputData[0].discountRateValue) {
            return (mean * (1 - (+valuationDetails.inputData[0].discountRateValue/100))).toFixed(2);
          }
          return '-';
        })
      }

}