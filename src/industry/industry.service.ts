import { Injectable } from '@nestjs/common';
import { COST_OF_EQUITY_METHOD } from 'src/constants/constants';
import { convertToNumberOrZero } from 'src/excelFileServices/common.methods';

@Injectable()
export class IndustryService {
  // Get Adjusted Cost of Equity. Industry Calculation based on Cost of Equity.

  async getACOE(inputs: any): Promise<any> {
    const { coeMethod } = inputs;
    let result = null;
    if (coeMethod === 'CAPM') result = await this.CAPM_Method(inputs);
    else if (coeMethod === 'Build_Up_CAPM')
      result = await this.Build_Up_CAPM_Method();
    else if (coeMethod === 'BYRP') result = await this.BYRP_Method();
    else return { result: null, msg: 'Invalid Cost of Equity Method.' };

    return {
      result: result,
      msg: 'Industry Calculation based on Cost of Equity Method.',
    };
  }
  async getFCFEDisFactor(inputs: any): Promise<any> {
    return await this.getACOE(inputs);
  }
  // Industry Calculation based on WACC.
  async getFCFFDisFactor(inputs: any, inputObj: any): Promise<any> {
    const { taxRate, copShareCapitalType, copShareCapital } = inputs;
    let copShareCapitalValue = null;
    if (copShareCapitalType === 'user_input')
      copShareCapitalValue = copShareCapital;
    else copShareCapitalValue = 0; // calculated from another service.
    const res = await this.getACOE(inputs);

    if (res.result === null) return res;

    const adjustedCostOfEquity = res.result;

    const capitalStructure = inputObj.capitalStructure;
    // console.log('Testing capitalStructure:', capitalStructure);
    //WACC, formula: =+B19*B27+B23*(1-B6)*B26+B21*B28
    const wacc =
      adjustedCostOfEquity * inputObj.proportionOfEquity +
      inputObj.costOfDebt * (1 - taxRate) * inputObj.proportionOfDebt +
      copShareCapitalValue * inputObj.popShareCapital;
    return { result: wacc, msg: 'Industry Calculation based on WACC.' };
  }

  async CAPM_Method(inputs: any): Promise<number> {
    let adjustedCostOfEquity = 0, costOfEquity = 0;   

    const { riskFreeRate, expMarketReturn, beta, riskPremium, coeMethod, sizePremium, industryRiskPremium } = inputs;

    if(coeMethod === COST_OF_EQUITY_METHOD.capm.key){
      costOfEquity = convertToNumberOrZero(riskFreeRate) + (convertToNumberOrZero(expMarketReturn) - convertToNumberOrZero(riskFreeRate)) * convertToNumberOrZero(beta);
      adjustedCostOfEquity = costOfEquity + convertToNumberOrZero(riskPremium);
    }
    else if(coeMethod === COST_OF_EQUITY_METHOD.buildUpCapm.key){
      
      costOfEquity = convertToNumberOrZero(riskFreeRate) + 
      (
        convertToNumberOrZero(expMarketReturn) - convertToNumberOrZero(riskFreeRate)
      ) + 
      convertToNumberOrZero(industryRiskPremium) + convertToNumberOrZero(sizePremium);

      adjustedCostOfEquity = costOfEquity + convertToNumberOrZero(riskPremium);
    }
    
    return adjustedCostOfEquity;
  }

  //we will implement following two methods in future.
  async Build_Up_CAPM_Method(): Promise<number> {
    return 1;
  }
  async BYRP_Method(): Promise<number> {
    return 1;
  }




}
