import { Injectable } from '@nestjs/common';
import { RelativeValuationService } from './relativeValuation.service';
import { FCFEAndFCFFService } from './fcfeAndFCFF.service';
import { ExcessEarningsService } from './excessEarnings.service';
import { NetAssetValueService } from './netAssetValue.service';
import { MarketPriceService } from './market-price.service';

//Valuation Methods Service
@Injectable()
export class ValuationMethodsService {
  constructor(
    private readonly relativeValuationService: RelativeValuationService,
    private readonly fcfeAndFCFFService: FCFEAndFCFFService,
    private readonly excessEarningsService: ExcessEarningsService,
    private readonly netAssetValueService: NetAssetValueService,
    private readonly marketPriceService: MarketPriceService
  ) {}

  // async FCFEMethod(
  //   inputs: any,
  //   worksheet1: any,
  //   worksheet2: any,
  //   worksheet3: any,
  // ): Promise<any> {
  //   console.log("Hello Counter zFCFE");
  //   return await this.fcfeAndFCFFService.FCFEAndFCFF_Common(
  //     inputs,
  //     worksheet1,
  //     worksheet2,
  //     worksheet3,
  //   );
  // }
  async FCFEMethodVersionTwo(
    inputs: any,
    worksheet1: any,
    worksheet2: any,
    worksheet3: any,
  ): Promise<any> {
    console.log("Hello Counter zFCFE");
    const body = {
      inputs,
      worksheet1,
      worksheet2,
      worksheet3,
    }
    return await this.fcfeAndFCFFService.fcfeAndFcffValuation(body);
  }
  // async FCFFMethod(
  //   inputs: any,
  //   worksheet1: any,
  //   worksheet2: any,
  //   worksheet3: any,
  // ): Promise<any> {
  //   console.log("Hello Counter FCFF");
  //   return await this.fcfeAndFCFFService.FCFEAndFCFF_Common(
  //     inputs,
  //     worksheet1,
  //     worksheet2,
  //     worksheet3,
  //   );
  // }
  async FCFFMethod(
    inputs: any,
    worksheet1: any,
    worksheet2: any,
    worksheet3: any,
  ): Promise<any> {
    console.log("Hello Counter FCFF");
    const body = {
      inputs,
      worksheet1,
      worksheet2,
      worksheet3,
    }
    return await this.fcfeAndFCFFService.fcfeAndFcffValuation(body);
  }

  async Relative_Valuation_Method(
    inputs: any,
    // worksheet1: any,
    // worksheet2: any,
  ): Promise<any> {
    return await this.relativeValuationService.Relative_Valuation(
      inputs
      // worksheet1,
      // worksheet2,
    );
  }

  async Excess_Earnings_method(
    inputs: any,
    worksheet1: any,
    worksheet2: any,
    worksheet3: any,
  ): Promise<any> {
    return await this.excessEarningsService.Excess_Earnings(
      inputs,
      worksheet1,
      worksheet2,
      worksheet3,
    );
  }

  async Net_Asset_Value_method(
    inputs: any
  ): Promise<any> {
    return await this.netAssetValueService.navValuation(
      inputs
    );
  }

  async Market_Price_method(
    header, 
    payload
  ): Promise<any> {
    return await this.marketPriceService.fetchPriceEquityShare(
      header, 
      payload
    );
  }
}
