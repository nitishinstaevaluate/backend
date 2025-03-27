import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export class firstStageInput{
    @Prop({ required: false,type:String,default:'' })
    company:String;

    @Prop({ required: false,type:String,default:'' })
    valuationDate:String;

    @Prop({ required: false,type:String,default:'' })
    projectionYears:Number;

    @Prop({ required: false,type:Number,default:0 })
    location:String

    @Prop({ required: false,type:String,default:'' })
    industry:String

    @Prop({ required: false,type:String,default:'' })
    subIndustry:String

    @Prop({ required: false,type:[String],default:[] })
    model:String[]

    @Prop({ required: false,type:String,default:'' })
    excelSheetId:String

    @Prop({ required: false,type:String,default:'' })
    exportExcelId:String

    @Prop({ required: false,type:String,default:'' })
    type:String

    @Prop({ required: false,type:String,default:'' })
    outstandingShares:String;

    @Prop({ required: false,type:String,default:'' })
    taxRate:String;

    @Prop({ required: false,type:String,default:'' })
    taxRateType:String;

    @Prop({ required: false,type:String,default:'' })
    terminalGrowthRate:String;

    @Prop({ required: false,type:String,default:'' })
    discountRateType:String;

    @Prop({ required: false,type:Number,default:0 })
    discountRateValue:Number;

    @Prop({ required: false,type:String,default:'' })
    reportingUnit:String;

    @Prop({ required: false,type:String,default:'' })
    currencyUnit:String;
    
    @Prop({ required: false,type:String,default:'' })
    modifiedExcelSheetId:String;

    @Prop({ required: false,type:Boolean,default:false })
    isExcelModified:Boolean;

    @Prop({ required: false,type:[],default:[] })       //remove this prop and handle it differently
    betaIndustry:[];

    @Prop({ required: false,type:[],default:[] })       //remove this prop and handle it differently
    preferenceCompanies:[];

    @Prop({ required: false,type:[],default:[] })       //remove this prop and handle it differently
    industriesRatio:[];
}

// export class alpha{
//     @Prop({ required: false,type:String,default:'' })
//     companySize:String;

//     @Prop({ required: false,type:String,default:'' })
//     marketPosition:String;

//     @Prop({ required: false,type:String,default:'' })
//     liquidityFactor:String;

//     @Prop({ required: false,type:String,default:'' })
//     competition:String;
// }

// export class fcfeInput{
//     @Prop({ required: false,type:String,default:'' })
//     discountRate:String;

//     @Prop({ required: false,type:String,default:'' })
//     discountingPeriod:String;

//     @Prop({ required: false,type:String,default:'' })
//     betaType:String;

//     @Prop({ required: false,type:String,default:'' })
//     coeMethod:String;

//     @Prop({ required: false,type:Number,default:0 })
//     riskFreeRate:Number;

//     @Prop({ required: false,type:String,default:'' })
//     expMarketReturnType:String;

//     @Prop({ required: false,type:Number,default:0 })
//     expMarketReturn:Number;

//     @Prop({ required: false,type:Boolean,default:false})
//     specificRiskPremium:Boolean;

//     @Prop({ required: false,type:Number,default:0 })
//     beta:Number;

//     @Prop({ required: false,type:Number,default:0 })
//     riskPremium:Number;

//     @Prop({ required: false,type:alpha,default:'' })
//     alpha:alpha;
// }

// export class excessEarningInput{
//     @Prop({ required: false,type:String,default:'' })
//     discountRate:String;

//     @Prop({ required: false,type:String,default:'' })
//     discountingPeriod:String;

//     @Prop({ required: false,type:String,default:'' })
//     betaType:String;

//     @Prop({ required: false,type:String,default:'' })
//     coeMethod:String;

//     @Prop({ required: false,type:Number,default:0 })
//     riskFreeRate:Number;

//     @Prop({ required: false,type:String,default:'' })
//     expMarketReturnType:String;

//     @Prop({ required: false,type:Number,default:0 })
//     expMarketReturn:Number;

//     @Prop({ required: false,type:Boolean,default:false})
//     specificRiskPremium:Boolean;

//     @Prop({ required: false,type:Number,default:0 })
//     beta:Number;

//     @Prop({ required: false,type:Number,default:0 })
//     riskPremium:Number;

//     @Prop({ required: false,type:alpha,default:'' })
//     alpha:alpha;
// }

// export class fcffInput{
//     @Prop({ required: false,type:String,default:'' })
//     discountRate:String;

//     @Prop({ required: false,type:String,default:'' })
//     discountingPeriod:String;

//     @Prop({ required: false,type:String,default:'' })
//     betaType:String;

//     @Prop({ required: false,type:String,default:'' })
//     coeMethod:String;

//     @Prop({ required: false,type:Number,default:0 })
//     riskFreeRate:Number;

//     @Prop({ required: false,type:String,default:'' })
//     expMarketReturnType:String;

//     @Prop({ required: false,type:Number,default:0 })
//     expMarketReturn:Number;

//     @Prop({ required: false,type:Boolean,default:false})
//     specificRiskPremium:Boolean;

//     @Prop({ required: false,type:Number,default:0 })
//     beta:Number;

//     @Prop({ required: false,type:Number,default:0 })
//     riskPremium:Number;

//     @Prop({ required: false,type:alpha })
//     alpha:alpha;

//     @Prop({ required: false,type:String,default:'' })
//     capitalStructureType:String;

//     @Prop({ required: false,type:String,default:'' })
//     costOfDebt:String;

//     @Prop({ required: false,type:String,default:'' })
//     copShareCapital:String;

//     @Prop({ required: false,type:String,default:'' })
//     fixedAsset:String;

//     @Prop({ required: false,type:String,default:'' })
//     longTermLoansAdvances:String;

//     @Prop({ required: false,type:String,default:'' })
//     nonCurrentInvestment:String;

//     @Prop({ required: false,type:String,default:'' })
//     deferredTaxAsset:String;

//     @Prop({ required: false,type:String,default:'' })
//     inventories:String;

//     @Prop({ required: false,type:String,default:'' })
//     shortTermLoanAdvances:String;

//     @Prop({ required: false,type:String,default:'' })
//     tradeReceivables:String;

//     @Prop({ required: false,type:String,default:'' })
//     cash:String;

//     @Prop({ required: false,type:String,default:'' })
//     otherCurrentAssets:String;

//     @Prop({ required: false,type:String,default:'' })
//     shortTermProvisions:String;

//     @Prop({ required: false,type:String,default:'' })
//     shortTermBorrowings:String;

//     @Prop({ required: false,type:String,default:'' })
//     tradePayables:String;

//     @Prop({ required: false,type:String,default:'' })
//     otherCurrentLiabilities:String;

//     @Prop({ required: false,type:String,default:'' })
//     lessLongTermBorrowings:String;

//     @Prop({ required: false,type:String,default:'' })
//     lessLongTermProvisions:String;

//     @Prop({ required: false,type:String,default:'' })
//     shareApplicationMoney:String;
// }

// export class navInput{
//     @Prop({ required: false,type:String,default:'' })
//     fixedAsset:String;

//     @Prop({ required: false,type:String,default:'' })
//     longTermLoansAdvances:String;

//     @Prop({ required: false,type:String,default:'' })
//     nonCurrentInvestment:String;

//     @Prop({ required: false,type:String,default:'' })
//     deferredTaxAsset:String;

//     @Prop({ required: false,type:String,default:'' })
//     inventories:String;

//     @Prop({ required: false,type:String,default:'' })
//     shortTermLoanAdvances:String;

//     @Prop({ required: false,type:String,default:'' })
//     tradeReceivables:String;

//     @Prop({ required: false,type:String,default:'' })
//     cash:String;

//     @Prop({ required: false,type:String,default:'' })
//     otherCurrentAssets:String;

//     @Prop({ required: false,type:String,default:'' })
//     shortTermProvisions:String;

//     @Prop({ required: false,type:String,default:'' })
//     shortTermBorrowings:String;

//     @Prop({ required: false,type:String,default:'' })
//     tradePayables:String;

//     @Prop({ required: false,type:String,default:'' })
//     otherCurrentLiabilities:String;

//     @Prop({ required: false,type:String,default:'' })
//     lessLongTermBorrowings:String;

//     @Prop({ required: false,type:String,default:'' })
//     lessLongTermProvisions:String;

//     @Prop({ required: false,type:String,default:'' })
//     shareApplicationMoney:String;
// }

// export class secondStageInput{
//     @Prop({required:true,type: fcfeInput,default:''})
//     fcfeInput:fcfeInput;
    
//     @Prop({required:true,type: fcffInput,default:''})
//     fcffInput:fcffInput;

//     @Prop({required:true,type: excessEarningInput,default:''})
//     excessEarningInput:excessEarningInput;

//     @Prop({required:true,type: navInput,default:''})
//     navInput:navInput
// }

export class fourthStageInput{
    @Prop({type:[],required:false})
    appData:[];

    @Prop({type:String,required:false,default:''})
    otherAdj:String;

    @Prop({type:Boolean,required:false,default:false})
    isExcelModified:Boolean;

    @Prop({type:String,required:false,default:''})
    modifiedExcelSheetId:String
}

export class totalWeightageModel{
    @Prop({type:String,required:false,default:''})
    weightedVal:String;

    @Prop({type:[],required:false})
    modelValue:[];
}

export class fifthStageInput{
    @Prop({type:String,required:false,default:''})
    valuationResultReportId:String;

    @Prop({type:totalWeightageModel,required:false})
    totalWeightageModel:totalWeightageModel;
}


export class sixthStageInput{
    @Prop({type:String,required:false,default:''})
    clientName:String;

    @Prop({type:String,required:false,default:''})
    reportDate:String;

    @Prop({type:Boolean,required:false,default:false})
    useExistingValuer:Boolean;
    
    @Prop({type:String,required:false,default:''})
    appointingAuthorityName:String;

    @Prop({type:String,required:false,default:''})
    dateOfAppointment:String;

    @Prop({type:String,required:false,default:''})
    reportPurpose:String;
    
    @Prop({type:[String],required:false,default:''})
    reportSection:String[];

    @Prop({type:String,required:false,default:''})
    natureOfInstrument:String;

    @Prop({type:String,required:false,default:''})
    registeredValuerName:String;
    
    @Prop({type:String,required:false,default:''})
    registeredValuerEmailId:String;
    
    @Prop({type:String,required:false,default:''})
    registeredValuerIbbiId:String;
    
    @Prop({type:String,required:false,default:''})
    registeredValuerMobileNumber:String;
    
    @Prop({type:String,required:false,default:''})
    registeredValuerGeneralAddress:String;
    
    @Prop({type:String,required:false,default:''})
    registeredValuerCorporateAddress:String;
    
    @Prop({type:String,required:false,default:''})
    registeredvaluerDOIorConflict:String;
    
    @Prop({type:String,required:false,default:''})
    registeredValuerQualifications:String;
    
    @Prop({type:String,required:false,default:''})
    valuationResultId:String;
    
    @Prop({type:[],required:false,default:[]})
    finalWeightedAverage:[];

    @Prop({type:String,required:false,default:''})
    valuationReportId:String;
}

@Schema({ versionKey: false })
export class ProcessManager {
    @Prop({ type: firstStageInput })
    firstStageInput:firstStageInput;

    @Prop({ type: Object,default:{} })
    secondStageInput:object;

    @Prop({ type: [], required:true})
    thirdStageInput:[];

    @Prop({ type: fourthStageInput,default:{}})
    fourthStageInput:fourthStageInput;

    @Prop({ type: fifthStageInput,default:{}})
    fifthStageInput:fifthStageInput;

    @Prop({ type: sixthStageInput,default:{}})
    sixthStageInput:sixthStageInput;

    @Prop({ type: String })
    userId:String;

    @Prop({ type: Number,default:0 })
    step:Number;

    @Prop({ type: Number,unique: true,required:true  })
    processIdentifierId:number;
    
    @Prop({ type: String, required: false, default:'' })
    uniqueLinkId: string;

    @Prop({ default: () => new Date(), required: false })
    createdOn: Date;

    @Prop({ default: () => new Date(), required: false })
    modifiedOn: Date;

    @Prop({ type:Boolean, default: false, required: false })
    isDeleted: boolean;
}

export type ProcessManagerDocument = ProcessManager & Document;
export const ProcessManagerSchema = SchemaFactory.createForClass(ProcessManager);
