import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Type } from 'class-transformer';
import { Document } from 'mongoose';

@Schema({ versionKey: false })
export class FieldValidation {
    @Prop({ type: String })
    processStateId:String;

    @Prop({ type: Number,required: false, default:1 })
    step:Number;

    @Prop({ type: Boolean, required:false, default: false  })
    isCompanyNameReset:Boolean;
    
    @Prop({ type: Boolean, required:false, default: false  })
    isValuationDateReset: Boolean;

    @Prop({ type: Boolean, required:false, default: false  })
    isUnitsReset: Boolean;

    @Prop({ type: Boolean, required:false, default: false  })
    isCurrencyReset: Boolean;

    @Prop({ type: Boolean, required:false, default: false  })
    isLocationReset: Boolean;

    @Prop({ type: Boolean, required:false, default: false  })
    isOutstandingSharesReset: Boolean;

    @Prop({ type: Boolean, required:false, default: false  })
    isTaxRateReset: Boolean;

    @Prop({ type: Boolean, required:false, default: false  })
    isCompanyListReset: Boolean;

    @Prop({ type: Boolean, required:false, default: false  })
    isDiscountRateReset: Boolean;

    @Prop({ type: Boolean, required:false, default: false  })
    isExcelModified: Boolean;

    @Prop({ type: Boolean, required:false, default: false  })
    isDiscountPeriodReset: Boolean;

    @Prop({ type: Boolean, required:false, default: false  })
    isDiscountCostOfEquityReset: Boolean;

    @Prop({ type: Boolean, required:false, default: false  })
    isRiskFreeRateReset: Boolean;

    @Prop({ type: Boolean, required:false, default: false  })
    isExpectedMarketReturnReset: Boolean;

    @Prop({ type: Boolean, required:false, default: false  })
    isBetaReset: Boolean;

    @Prop({ type: Boolean, required:false, default: false  })
    isCmpnySpecificRiskPremiumReset: Boolean;

    @Prop({ type: Boolean, required:false, default: false  })
    isSizeRiskPremiumReset: Boolean;

    @Prop({ type: Boolean, required:false, default: false  })
    isIndustryRiskPremiumReset: Boolean;

    @Prop({ type: Boolean, required:false, default: false  })
    isOthrAdjustmentReset: Boolean;

    @Prop({ type: Boolean, required:false, default: false  })
    isSensitivityAnalysis: Boolean;

    @Prop({ type: Boolean, required:false, default: false  })
    isCompanyIdReset: Boolean;

    @Prop({ type: Boolean, required:false, default: false  })
    isIssuanceOfShares: Boolean;

    @Prop({ type: Boolean, required:false, default: false  })
    firstFormStatus:Boolean;

    @Prop({ type: Boolean, required:false, default: false  })
    secondFormStatus:Boolean;
    
    @Prop({ type: Boolean, required:false, default: false  })
    thirdFormStatus:Boolean;
    
    @Prop({ type: Boolean, required:false, default: false  })
    fourthFormStatus: Boolean;

    @Prop({ type: Boolean, required:false, default: false  })
    fifthFormStatus: Boolean; 

    @Prop({ type: Boolean, required:false, default: false  })
    showBlackBox: Boolean; 

    @Prop({ default: () => new Date(), required: false })
    modifiedOn: Date;

    @Prop({ default: () => new Date(), required: false })
    createdOn: Date;

    @Prop({ type:Boolean, default: false, required: false })
    isDeleted: boolean;
}

export type FieldValidatiomDocument = FieldValidation & Document;
export const FieldValidationSchema = SchemaFactory.createForClass(FieldValidation);