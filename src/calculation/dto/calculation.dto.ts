import { IsNotEmpty, IsString, IsOptional } from "class-validator";

class valuationWeightage {
    results: [];
    // weightage: [];
  }
  
  export { valuationWeightage };

  export class WaccDTO {
    @IsOptional()
    adjCoe: any;
    
    @IsOptional()
    costOfDebt: any;
    
    @IsOptional()
    copShareCapital: any;
    
    @IsOptional()
    deRatio: any;

    @IsOptional()
    type: any;

    @IsOptional()
    taxRate: any;

    @IsOptional()
    capitalStructure: any;

    @IsOptional()
    processStateId: any;
  }