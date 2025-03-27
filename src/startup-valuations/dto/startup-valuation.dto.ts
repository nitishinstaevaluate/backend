import { Type } from "class-transformer";
import { IsOptional, IsString, IsBoolean, ValidateNested, IsNumber, IsObject, IsArray, ValidateIf } from "class-validator";

export class soundIdeaDto {
    @IsOptional()
    @IsString({ message: 'proprietaryNature is required' })
    proprietaryNature: string;

    @IsOptional()
    @IsNumber({}, { message: 'proprietaryNatureDoa is required' })
    proprietaryNatureDoa: number;

    @IsOptional()
    @IsString({ message: 'futurePlan is required' })
    futurePlan: string;

    @IsOptional()
    @IsNumber({}, { message: 'futurePlanDoa is required' })
    futurePlanDoa: number;

    @IsOptional()
    @IsString({ message: 'scalability is required' })
    scalability: string;

    @IsOptional()
    @IsNumber({}, { message: 'scalabilityDoa is required' })
    scalabilityDoa: number;

    @IsOptional()
    @IsString({ message: 'socioPolticalRelevance is required' })
    socioPolticalRelevance: string;

    @IsOptional()
    @IsNumber({}, { message: 'socioPolticalRelevanceDoa is required' })
    socioPolticalRelevanceDoa: number;

    @IsOptional()
    @IsString({ message: 'validationOfIdea is required' })
    validationOfIdea: string;

    @IsOptional()
    @IsNumber({}, { message: 'validationOfIdeaDoa is required' })
    validationOfIdeaDoa: number;
}

export class prototypeDto {
    @IsOptional()
    @IsString({ message: 'functionality is required' })
    functionality: string;

    @IsOptional()
    @IsNumber({}, { message: 'functionalityDoa is required' })
    functionalityDoa: number;

    @IsOptional()
    @IsString({ message: 'viability is required' })
    viability: string;

    @IsOptional()
    @IsNumber({}, { message: 'viabilityDoa is required' })
    viabilityDoa: number;

    @IsOptional()
    @IsString({ message: 'userExprnce is required' })
    userExprnce: string;

    @IsOptional()
    @IsNumber({}, { message: 'userExprnceDoa is required' })
    userExprnceDoa: number;

    @IsOptional()
    @IsString({ message: 'innovation is required' })
    innovation: string;

    @IsOptional()
    @IsNumber({}, { message: 'innovationDoa is required' })
    innovationDoa: number;

    @IsOptional()
    @IsString({ message: 'costEffeciency is required' })
    costEffeciency: string;

    @IsOptional()
    @IsNumber({}, { message: 'costEffeciencyDoa is required' })
    costEffeciencyDoa: number;

    @IsOptional()
    @IsString({ message: 'timeEffeciency is required' })
    timeEffeciency: string;

    @IsOptional()
    @IsNumber({}, { message: 'timeEffeciencyDoa is required' })
    timeEffeciencyDoa: number;
}

export class managementDto {
    @IsOptional()
    @IsString({ message: 'experienceAndExpertise is required' })
    experienceAndExpertise: string;

    @IsOptional()
    @IsNumber({}, { message: 'experienceAndExpertiseDoa is required' })
    experienceAndExpertiseDoa: number;

    @IsOptional()
    @IsString({ message: 'visionAndStrategy is required' })
    visionAndStrategy: string;

    @IsOptional()
    @IsNumber({}, { message: 'visionAndStrategyDoa is required' })
    visionAndStrategyDoa: number;

    @IsOptional()
    @IsString({ message: 'executionSkills is required' })
    executionSkills: string;

    @IsOptional()
    @IsNumber({}, { message: 'executionSkillsDoa is required' })
    executionSkillsDoa: number;

    @IsOptional()
    @IsString({ message: 'networkAndRelationships is required' })
    networkAndRelationships: string;

    @IsOptional()
    @IsNumber({}, { message: 'networkAndRelationshipsDoa is required' })
    networkAndRelationshipsDoa: number;

    @IsOptional()
    @IsString({ message: 'leadershipAndTeamDynamic is required' })
    leadershipAndTeamDynamic: string;

    @IsOptional()
    @IsNumber({}, { message: 'leadershipAndTeamDynamicDoa is required' })
    leadershipAndTeamDynamicDoa: number;

    @IsOptional()
    @IsString({ message: 'industryKnowledgeAndInsights is required' })
    industryKnowledgeAndInsights: string;

    @IsOptional()
    @IsNumber({}, { message: 'industryKnowledgeAndInsightsDoa is required' })
    industryKnowledgeAndInsightsDoa: number;
}

export class strategicRelationshipDto {
    @IsOptional()
    @IsString({ message: 'partnership is required' })
    partnership: string;

    @IsOptional()
    @IsNumber({}, { message: 'partnershipDoa is required' })
    partnershipDoa: number;

    @IsOptional()
    @IsString({ message: 'customerRelationship is required' })
    customerRelationship: string;

    @IsOptional()
    @IsNumber({}, { message: 'customerRelationshipDoa is required' })
    customerRelationshipDoa: number;

    @IsOptional()
    @IsString({ message: 'supplierRelationship is required' })
    supplierRelationship: string;

    @IsOptional()
    @IsNumber({}, { message: 'supplierRelationshipDoa is required' })
    supplierRelationshipDoa: number;

    @IsOptional()
    @IsString({ message: 'distributionChannel is required' })
    distributionChannel: string;

    @IsOptional()
    @IsNumber({}, { message: 'distributionChannelDoa is required' })
    distributionChannelDoa: number;

    @IsOptional()
    @IsString({ message: 'intellectualPropertyRelationship is required' })
    intellectualPropertyRelationship: string;

    @IsOptional()
    @IsNumber({}, { message: 'intellectualPropertyRelationshipDoa is required' })
    intellectualPropertyRelationshipDoa: number;
}

export class productRollOutDto {
    @IsOptional()
    @IsString({ message: 'marketPotential is required' })
    marketPotential: string;

    @IsOptional()
    @IsNumber({}, { message: 'marketPotentialDoa is required' })
    marketPotentialDoa: number;

    @IsOptional()
    @IsString({ message: 'customerAcquisitionPlan is required' })
    customerAcquisitionPlan: string;

    @IsOptional()
    @IsNumber({}, { message: 'customerAcquisitionPlanDoa is required' })
    customerAcquisitionPlanDoa: number;

    @IsOptional()
    @IsString({ message: 'productDifferentiation is required' })
    productDifferentiation: string;

    @IsOptional()
    @IsNumber({}, { message: 'productDifferentiationDoa is required' })
    productDifferentiationDoa: number;

    @IsOptional()
    @IsString({ message: 'executionRisk is required' })
    executionRisk: string;

    @IsOptional()
    @IsNumber({}, { message: 'executionRiskDoa is required' })
    executionRiskDoa: number;

    @IsOptional()
    @IsString({ message: 'feedbackAndIterationProcess is required' })
    feedbackAndIterationProcess: string;

    @IsOptional()
    @IsNumber({}, { message: 'feedbackAndIterationProcessDoa is required' })
    feedbackAndIterationProcessDoa: number;
}

export class berkusDto {
    @ValidateNested()
    @Type(() => soundIdeaDto)
    soundIdea: soundIdeaDto

    @ValidateNested()
    @Type(() => prototypeDto)
    prototype: prototypeDto

    @ValidateNested()
    @Type(() => managementDto)
    management: managementDto

    @ValidateNested()
    @Type(() => strategicRelationshipDto)
    strategicRelationship: strategicRelationshipDto

    @ValidateNested()
    @Type(() => productRollOutDto)
    productRollOut: productRollOutDto
}

export class riskFactorDto {
    @IsOptional()
    @IsString({ message: 'managementRisk is required' })
    managementRisk: string;

    @IsOptional()
    @IsNumber({}, { message: 'managementRiskRFCoeff is required' })
    managementRiskRFCoeff: number;

    @IsOptional()
    @IsString({ message: 'stateOfBusiness is required' })
    stateOfBusiness: string;

    @IsOptional()
    @IsNumber({}, { message: 'stateOfBusinessRFCoeff is required' })
    stateOfBusinessRFCoeff: number;

    @IsOptional()
    @IsString({ message: 'politicalRisk is required' })
    politicalRisk: string;

    @IsOptional()
    @IsNumber({}, { message: 'politicalRiskRFCoeff is required' })
    politicalRiskRFCoeff: number;

    @IsOptional()
    @IsString({ message: 'supplyChainOrManufacturingRisk is required' })
    supplyChainOrManufacturingRisk: string;

    @IsOptional()
    @IsNumber({}, { message: 'supplyChainOrManufacturingRiskRFCoeff is required' })
    supplyChainOrManufacturingRiskRFCoeff: number;

    @IsOptional()
    @IsString({ message: 'salesAndMarketingRisk is required' })
    salesAndMarketingRisk: string;

    @IsOptional()
    @IsNumber({}, { message: 'salesAndMarketingRiskRFCoeff is required' })
    salesAndMarketingRiskRFCoeff: number;

    @IsOptional()
    @IsString({ message: 'capitalRaisingRisk is required' })
    capitalRaisingRisk: string;

    @IsOptional()
    @IsNumber({}, { message: 'capitalRaisingRiskRFCoeff is required' })
    capitalRaisingRiskRFCoeff: number;

    @IsOptional()
    @IsString({ message: 'competitionRisk is required' })
    competitionRisk: string;

    @IsOptional()
    @IsNumber({}, { message: 'competitionRiskRFCoeff is required' })
    competitionRiskRFCoeff: number;

    @IsOptional()
    @IsString({ message: 'riskOfTechnology is required' })
    riskOfTechnology: string;

    @IsOptional()
    @IsNumber({}, { message: 'riskOfTechnologyRFCoeff is required' })
    riskOfTechnologyRFCoeff: number;

    @IsOptional()
    @IsString({ message: 'riskOfLitigation is required' })
    riskOfLitigation: string;

    @IsOptional()
    @IsNumber({}, { message: 'riskOfLitigationRFCoeff is required' })
    riskOfLitigationRFCoeff: number;

    @IsOptional()
    @IsString({ message: 'internationalRisk is required' })
    internationalRisk: string;

    @IsOptional()
    @IsNumber({}, { message: 'internationalRiskRFCoeff is required' })
    internationalRiskRFCoeff: number;

    @IsOptional()
    @IsString({ message: 'riskOfReputation is required' })
    riskOfReputation: string;

    @IsOptional()
    @IsNumber({}, { message: 'riskOfReputationRFCoeff is required' })
    riskOfReputationRFCoeff: number;

    @IsOptional()
    @IsString({ message: 'exitValueRisk is required' })
    exitValueRisk: string;

    @IsOptional()
    @IsNumber({}, { message: 'exitValueRiskRFCoeff is required' })
    exitValueRiskRFCoeff: number;
}
export class scoreCardDto {
    @IsOptional()
    @IsString({ message: 'experience is required' })
    experience: string;

    @IsOptional()
    @IsNumber({}, { message: 'experienceDoa is required' })
    experienceDoa: number;

    @IsOptional()
    @IsString({ message: 'adaptability is required' })
    adaptability: string;

    @IsOptional()
    @IsNumber({}, { message: 'adaptabilityDoa is required' })
    adaptabilityDoa: number;

    @IsOptional()
    @IsString({ message: 'teamCompleteness is required' })
    teamCompleteness: string;

    @IsOptional()
    @IsNumber({}, { message: 'teamCompletenessDoa is required' })
    teamCompletenessDoa: number;

    @IsOptional()
    @IsString({ message: 'marketSize is required' })
    marketSize: string;

    @IsOptional()
    @IsNumber({}, { message: 'marketSizeDoa is required' })
    marketSizeDoa: number;

    @IsOptional()
    @IsString({ message: 'revenuePotential is required' })
    revenuePotential: string;

    @IsOptional()
    @IsNumber({}, { message: 'revenuePotentialDoa is required' })
    revenuePotentialDoa: number;

    @IsOptional()
    @IsString({ message: 'stage is required' })
    stage: string;

    @IsOptional()
    @IsNumber({}, { message: 'stageDoa is required' })
    stageDoa: number;

    @IsOptional()
    @IsString({ message: 'compelling is required' })
    compelling: string;

    @IsOptional()
    @IsNumber({}, { message: 'compellingDoa is required' })
    compellingDoa: number;

    @IsOptional()
    @IsString({ message: 'uniqueness is required' })
    uniqueness: string;

    @IsOptional()
    @IsNumber({}, { message: 'uniquenessDoa is required' })
    uniquenessDoa: number;

    @IsOptional()
    @IsString({ message: 'executionRisk is required' })
    executionRisk: string;

    @IsOptional()
    @IsNumber({}, { message: 'executionRiskDoa is required' })
    executionRiskDoa: number;

    @IsOptional()
    @IsString({ message: 'competition is required' })
    competition: string;

    @IsOptional()
    @IsNumber({}, { message: 'competitionDoa is required' })
    competitionDoa: number;

    @IsOptional()
    @IsString({ message: 'strengthofCompetitiveProduct is required' })
    strengthofCompetitiveProduct: string;

    @IsOptional()
    @IsNumber({}, { message: 'strengthofCompetitiveProductDoa is required' })
    strengthofCompetitiveProductDoa: number;

    @IsOptional()
    @IsString({ message: 'barrierToEntry is required' })
    barrierToEntry: string;

    @IsOptional()
    @IsNumber({}, { message: 'barrierToEntryDoa is required' })
    barrierToEntryDoa: number;

    @IsOptional()
    @IsString({ message: 'salesChannel is required' })
    salesChannel: string;

    @IsOptional()
    @IsNumber({}, { message: 'salesChannelDoa is required' })
    salesChannelDoa: number;

    @IsOptional()
    @IsString({ message: 'salesPartner is required' })
    salesPartner: string;

    @IsOptional()
    @IsNumber({}, { message: 'salesPartnerDoa is required' })
    salesPartnerDoa: number;

    @IsOptional()
    @IsString({ message: 'customerAcquisition is required' })
    customerAcquisition: string;

    @IsOptional()
    @IsNumber({}, { message: 'customerAcquisitionDoa is required' })
    customerAcquisitionDoa: number;

    @IsOptional()
    @IsString({ message: 'funding is required' })
    funding: string;

    /**
     * Exposed on front end, pending on backend
     * @IsOptional()
     * @IsNumber({}, { message: 'fundingDoa is required' })
     * fundingDoa: number;
     */
}

export class ventureCapitalDto {
    @IsOptional()
    @IsString({ message: 'startupName is required' })
    startupName: string;

    @IsOptional()
    @IsString({ message: 'industryType is required' })
    industryType: string;

    @IsOptional()
    @IsNumber({}, { message: 'investmentAmount is required' })
    investmentAmount: number;

    @IsOptional()
    @IsString({ message: 'financialPerformanceMetrics is required' })
    financialPerformanceMetrics: string;

    @IsOptional()
    @ValidateIf((o) => typeof o.financialPerformanceMetricsSubType === 'string')
    @IsString({ message: 'financialPerformanceMetricsSubType must be a string' })
    @ValidateIf((o) => typeof o.financialPerformanceMetricsSubType === 'number')
    @IsNumber({}, { message: 'financialPerformanceMetricsSubType must be a number' })
    financialPerformanceMetricsSubType: string | number;

    @IsOptional()
    @IsNumber({}, { message: 'targetMarginAndBenchmarking is required' })
    targetMarginAndBenchmarking: number;
    
    @IsOptional()
    @IsNumber({}, { message: 'exitYear is required' })
    exitYear: number;

    @IsOptional()
    @IsString({ message: 'exitMultipleExpected is required' })
    exitMultipleExpected: string;

    @IsOptional()
    @IsNumber({}, { message: 'exitInvestorMultipleAndBenchmarking is required' })
    exitInvestorMultipleAndBenchmarking: number;

    @IsOptional()
    @IsNumber({}, { message: 'probabilityOfFailure is required' })
    probabilityOfFailure: number;

    @IsOptional()
    @IsNumber({}, { message: 'requiredReturn is required' })
    requiredReturn: number;
}

export class berkusValuationDto {
    @IsArray()
    @IsObject({ each: true })
    soundIdeaValuation: object[]

    @IsArray()
    @IsObject({ each: true })
    prototypeValuation: object[]

    @IsArray()
    @IsObject({ each: true })
    managementValuation: object[]

    @IsArray()
    @IsObject({ each: true })
    strategicRelationshipValuation: object[]

    @IsArray()
    @IsObject({ each: true })
    productRollOutValuation: object[]
}

export class StartupValuationDto {
    @IsOptional()
    @IsString({ message: 'processStateId is required' })
    processStateId: string;

    @IsOptional()
    @ValidateNested()
    @Type(() => berkusDto)
    berkus: berkusDto;

    @IsOptional()
    @ValidateNested()
    @Type(() => riskFactorDto)
    riskFactor: riskFactorDto;

    @IsOptional()
    @ValidateNested()
    @Type(() => scoreCardDto)
    scoreCard: scoreCardDto;

    @IsOptional()
    @ValidateNested()
    @Type(() => ventureCapitalDto)
    ventureCapital: ventureCapitalDto;

    @IsOptional()
    @ValidateNested()
    @Type(() => berkusValuationDto)
    berkusValuation: berkusValuationDto;

    @IsOptional()
    @ValidateNested({ each: true })
    @IsObject({ each: true })
    riskFactorValuation: Record<string, any>[];

    @IsOptional()
    @ValidateNested({ each: true })
    @IsObject({ each: true })
    scoreCardValuation: Record<string, any>[];

    @IsOptional()
    @IsObject({ each: true })
    ventureCapitalValuation: object;
}