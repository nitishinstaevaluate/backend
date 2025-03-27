import { Type } from "class-transformer";
import { IsNotEmpty, IsString, IsOptional, IsNumber, IsArray, ValidateNested, IsBoolean } from "class-validator";

export class FieldValidationDto {
    @IsOptional()
    @IsString({ message: 'processStateId is required' })
    processStateId: string;
    
    @IsOptional()
    @IsBoolean({ message: 'isCompanyNameReset should be bool' })
    isCompanyNameReset: boolean;

    @IsOptional()
    @IsBoolean({ message: 'isValuationDateReset should be bool' })
    isValuationDateReset: boolean;

    @IsOptional()
    @IsBoolean({ message: 'isUnitsReset should be bool' })
    isUnitsReset: boolean;

    @IsOptional()
    @IsBoolean({ message: 'isCurrencyReset should be bool' })
    isCurrencyReset: boolean;

    @IsOptional()
    @IsBoolean({ message: 'isLocationReset should be bool' })
    isLocationReset: boolean;

    @IsOptional()
    @IsBoolean({ message: 'isOutstandingSharesReset should be bool' })
    isOutstandingSharesReset: boolean;

    @IsOptional()
    @IsBoolean({ message: 'isTaxRateReset should be bool' })
    isTaxRateReset: boolean;

    @IsOptional()
    @IsBoolean({ message: 'isCompanyListReset should be bool' })
    isCompanyListReset: boolean;

    @IsOptional()
    @IsBoolean({ message: 'isDiscountRateReset should be bool' })
    isDiscountRateReset: boolean;

    @IsOptional()
    @IsBoolean({ message: 'isExcelModified should be bool' })
    isExcelModified: boolean;

    @IsOptional()
    @IsBoolean({ message: 'isDiscountPeriodReset should be bool' })
    isDiscountPeriodReset: boolean;

    @IsOptional()
    @IsBoolean({ message: 'isDiscountCostOfEquityReset should be bool' })
    isDiscountCostOfEquityReset: boolean;

    @IsOptional()
    @IsBoolean({ message: 'isExpectedMarketReturnReset should be bool' })
    isExpectedMarketReturnReset: boolean;

    @IsOptional()
    @IsBoolean({ message: 'isBetaReset should be bool' })
    isBetaReset: boolean;

    @IsOptional()
    @IsBoolean({ message: 'isIssuanceOfShares should be bool' })
    isIssuanceOfShares: boolean;

    @IsOptional()
    @IsBoolean({ message: 'isCmpnySpecificRiskPremiumReset should be bool' })
    isCmpnySpecificRiskPremiumReset: boolean;

    @IsOptional()
    @IsBoolean({ message: 'isSizeRiskPremiumReset should be bool' })
    isSizeRiskPremiumReset: boolean;

    @IsOptional()
    @IsBoolean({ message: 'isIndustryRiskPremiumReset should be bool' })
    isIndustryRiskPremiumReset: boolean;

    @IsOptional()
    @IsBoolean({ message: 'isOthrAdjustmentReset should be bool' })
    isOthrAdjustmentReset: boolean;

    @IsOptional()
    @IsBoolean({ message: 'showBlackBox should be bool' })
    showBlackBox: boolean;

    @IsOptional()
    @IsBoolean({ message: 'isSensitivityAnalysis should be bool' })
    isSensitivityAnalysis: boolean;

    @IsOptional()
    @IsBoolean({ message: 'isCompanyIdReset should be bool' })
    isCompanyIdReset: boolean;

    @IsOptional()
    @IsBoolean({ message: 'firstFormStatus should be bool' })
    firstFormStatus:boolean;

    @IsOptional()
    @IsBoolean({ message: 'secondFormStatus should be bool' })
    secondFormStatus:boolean;
    
    @IsOptional()
    @IsBoolean({ message: 'thirdFormStatus should be bool' })
    thirdFormStatus:boolean;
    
    @IsOptional()
    @IsBoolean({ message: 'fourthFormStatus should be bool' })
    fourthFormStatus: boolean;

    @IsOptional()
    @IsBoolean({ message: 'fifthFormStatus should be bool' })
    fifthFormStatus: boolean; 
  }