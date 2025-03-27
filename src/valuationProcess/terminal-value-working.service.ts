import { HttpException, HttpStatus, Injectable, NotFoundException } from "@nestjs/common";
import { ValuationsService } from "./valuationProcess.service";
import { ProcessStatusManagerService } from "src/processStatusManager/service/process-status-manager.service";
import { MODEL } from "src/constants/constants";
import { TerminalValueWorkingDto } from "./dto/valuations.dto";
import { convertToNumberOrZero } from "src/excelFileServices/common.methods";

@Injectable()
export class terminalValueWorkingService{
    constructor(private processManagerService: ProcessStatusManagerService,
        private valuationService: ValuationsService){}
    async computeTerminalValue(id, valuationId?){
        try{
            let dcfValuation;
            const process = await this.processManagerService.fetchProcess(id);
            const fourthStageDetails:any = process.stateInfo.fourthStageInput;

            const valuationModelResult:any = await this.valuationService.getValuationById(valuationId || fourthStageDetails.appData.reportId);

            const valuationResult = valuationModelResult.modelResults;
            const boolContainsDcf = valuationResult.some((indValuation)=>indValuation.model === MODEL[0] || indValuation.model === MODEL[1]);

            if(!boolContainsDcf)
                throw new NotFoundException({msg:'DCF model not found'}).getResponse();

            let isFCFE = false;
            valuationResult.map((indValuation)=>{
                if(indValuation.model === MODEL[0] || indValuation.model === MODEL[1]){
                    dcfValuation = indValuation;
                }
                if(indValuation.model === MODEL[0]){
                    isFCFE = true;
                }
            })
            const dcfTerminalYearValuationData = dcfValuation.terminalYearWorking;
            const dcfRemainingYrsValuationData = dcfValuation.valuationData;

            let terminalValueWorking = new TerminalValueWorkingDto();
            terminalValueWorking.terminalGrowthRate = valuationModelResult.inputData[0].terminalGrowthRate;
            terminalValueWorking.costOfEquity = isFCFE ? valuationModelResult.inputData[0].adjustedCostOfEquity : valuationModelResult.inputData[0].wacc;

            // dcfValuationData.map((indElements)=>{
            //     if(indElements.particulars === 'Terminal Value'){
            //         terminalValueWorking.freeCashFlow = indElements.fcff;
            //         terminalValueWorking.pvFactor = indElements.discountingFactor;
            //     }
            // })
            terminalValueWorking.freeCashFlow = dcfTerminalYearValuationData.fcff;
            terminalValueWorking.pvFactor = dcfRemainingYrsValuationData[dcfRemainingYrsValuationData.length - 1].discountingFactor;

            terminalValueWorking.terminalYearValue =convertToNumberOrZero(terminalValueWorking.freeCashFlow)/
                (
                    (convertToNumberOrZero(terminalValueWorking.costOfEquity))/100 -
                    (convertToNumberOrZero(terminalValueWorking.terminalGrowthRate))/100
                    
                );
                
            terminalValueWorking.pvTerminalValue = (convertToNumberOrZero(terminalValueWorking.pvFactor) * convertToNumberOrZero(terminalValueWorking.terminalYearValue));
            return {
                status: true,
                terminalValueWorking,
                msg:"Terminal value working success"
            };
        }
        catch(error){
            throw new HttpException(
                {
                  error: error,
                  status: false,
                  msg: 'terminal value computation failed',
                },
                HttpStatus.INTERNAL_SERVER_ERROR,
              );
        }
    }
}