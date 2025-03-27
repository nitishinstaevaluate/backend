import { Expose, Type } from "class-transformer";
import { IsNumber, IsNotEmpty, IsString, ValidateNested } from "class-validator";

export class CiqPriceEquityDto {

    @Expose()
    @IsNumber()
    @IsNotEmpty()
    COMPANYID: string;

    @Expose()
    @IsString()
    PRICINGDATE: number;
  
    @Expose()
    @IsNumber()
    PRICEOPEN: string;
  
    @Expose()
    @IsNumber()
    PRICEHIGH: number;
  
    @Expose()
    @IsNumber()
    PRICELOW: string;

    @Expose()
    @IsNumber()
    PRICEMID: string;

    @Expose()
    @IsString()
    PRICECLOSE: string;

    @Expose()
    @IsNumber()
    PRICEBID: string;

    @Expose()
    @IsNumber()
    PRICEASK: string;

    @Expose()
    @IsNumber()
    VOLUME: string;

    @Expose()
    @IsNumber()
    VWAP: string;

    @Expose()
    @IsString()
    TICKERSYMBOL: string;

    @Expose()
    @IsString()
    EXCHANGENAME: string;

    @Expose()
    @IsString()
    EXCHANGESYMBOL: string; 

    @Expose()
    @IsNumber()
    CURRENCYID: string;

    @Expose()
    @IsString()
    SECURITYNAME: string;
  }

  export class companyDetailsDto {
    @IsNotEmpty({ message: 'date cannot be empty eg.2023-03-29T00:00:00.000000' })
    @IsString({ message: 'date should be string eg. 2023-03-29T00:00:00.000000' })
    date: string;

    @IsNotEmpty({ message: 'CompanyId cannot be empty eg.874487' })
    @IsNumber({}, { message: 'CompanyId cannot be empty eg.874487' })
    companyId: number;

    @IsNumber({}, { message: 'exchangeId should be number eg.161' })
    exchangeId: number;
  }

  export class ciqFetchPriceEquityDto {
    @ValidateNested({ message: 'CompanyDetails cannot be empty' })
    @IsNotEmpty({ message: 'CompanyDetails cannot be empty' })
    @Type(() => companyDetailsDto) 
    companyDetails: companyDetailsDto;
  }

