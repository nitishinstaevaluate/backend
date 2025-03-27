import { Injectable, NotFoundException } from '@nestjs/common';
import { postSensitivityAnalysisDto } from '../dto/sensitivity-analysis.dto';
import { InjectModel } from '@nestjs/mongoose';
import { sensitivityAnalysisDocument } from '../schema/sensitivity-analysis.schema';
import { Model } from 'mongoose';
import { ValuationsService } from 'src/valuationProcess/valuationProcess.service';
import { MODEL } from 'src/constants/constants';
import { ProcessStatusManagerService } from 'src/processStatusManager/service/process-status-manager.service';
import { REVALUATION_SA, VALUATION_PROCESS_V1 } from 'src/library/interfaces/api-endpoints.local';
import { axiosInstance, axiosRejectUnauthorisedAgent } from 'src/middleware/axiosConfig';

@Injectable()
export class SensitivityAnalysisService {
    constructor(@InjectModel('sensitivityanalysis')
    private readonly sensitiveAnalysisModal: Model<sensitivityAnalysisDocument>,
    private readonly valuationsService: ValuationsService,
    private readonly processStateManagerService: ProcessStatusManagerService){}

    async fetchById(id, headers){
        try{
            const SAdata = await this.sensitiveAnalysisModal.findById(id);

            if(!SAdata) 
                throw new NotFoundException({msg:'Record not found', status:false, description:"Id found to be incorrect"});

            return await this.pullSAdata(SAdata);
        }
        catch(error){
            throw error;
        }
    }

    async fetchByProcessId(id, headers){
        try{
            const SAdata = await this.sensitiveAnalysisModal.findOne({processStateId:id});

            if(!SAdata) 
                throw new NotFoundException({msg:'Record not found', status:false, description:"Id found to be incorrect"});
          
            return await this.pullSAdata(SAdata);
        }
        catch(error){
            throw error;
        }
    }

    async fetchActiveSAvaluationId(id){
        try{
            const SAdata = await this.sensitiveAnalysisModal.findById({_id: id});

            if(!SAdata) 
                throw new NotFoundException({msg:'Record not found', status:false, description:"Id found to be incorrect"});
          
            return {valuationId: SAdata.selectedReportId};
        }
        catch(error){
            throw error;
        }
    }


    async updateSelectedValuationId(payload, header){
        try{
            const SAid = payload.sensitivityAnalysisId;
            const valuationId = payload.valuationId;

            const SAdata =await this.sensitiveAnalysisModal.findById({_id: SAid});
            if(SAdata){
                await this.sensitiveAnalysisModal.findByIdAndUpdate(
                    {_id: SAid},
                    {
                        selectedReportId: valuationId
                    },
                    { new:true }
                )
                return true;
            }
            return false;
        }
        catch(error){
            throw error;
        }
    }


    async pullSAdata(SAdata){
        try{
            const id = SAdata.id;
            let sensitivityAnalysisLogger:any = new postSensitivityAnalysisDto();
            sensitivityAnalysisLogger.primaryValuation = SAdata.primaryValuation;
            sensitivityAnalysisLogger.processStateId = SAdata.processStateId;
            sensitivityAnalysisLogger.secondaryValuation = SAdata.secondaryValuation;
            sensitivityAnalysisLogger.primaryReportId = SAdata.primaryReportId;
            sensitivityAnalysisLogger.terminalSelectionType = SAdata.terminalSelectionType;

            let SABulk = [], valuePerShare = 0;
            const secondStageDetails = await this.processStateManagerService.fetchStageWiseDetails(sensitivityAnalysisLogger.processStateId, 'secondStageInput');

            // For Primary Valuation
            if(sensitivityAnalysisLogger.primaryValuation?.length){
                for await(const indSAdata of sensitivityAnalysisLogger.primaryValuation){

                    for await (const indValuation of indSAdata.modelResults){
                        if(indValuation.model === MODEL[0] || indValuation.model === MODEL[1] || indValuation.model === MODEL[3]){
                            valuePerShare = indValuation?.valuationData[0].valuePerShare;
                        }

                        if(valuePerShare) 
                            break;
                    }

                    SABulk.push({
                        formOneData:indSAdata.inputData[0],
                        formTwoData:{
                            formTwoData: secondStageDetails.data.secondStageInput,
                            formOneData: indSAdata.inputData[0],
                        },
                        formThreeData: indSAdata.inputData[0],
                        valuePerShare,
                        valuationId: indSAdata.valuationId,
                        terminalSelectionType: indSAdata.terminalSelectionType,
                        isPrimaryValuation:true
                    })
                }
            }


            // For Secondary Valuation
            if(sensitivityAnalysisLogger?.secondaryValuation?.length){
                for await(const indSAdata of sensitivityAnalysisLogger.secondaryValuation){

                    for await (const indValuation of indSAdata.modelResults){
                        if(indValuation.model === MODEL[0] || indValuation.model === MODEL[1] || indValuation.model === MODEL[3]){
                            valuePerShare = indValuation?.valuationData[0].valuePerShare;
                        }

                        if(valuePerShare) 
                            break;
                    }

                    SABulk.push({
                        formOneData:indSAdata.inputData[0],
                        formTwoData:{
                            formTwoData: secondStageDetails.data.secondStageInput,
                            formOneData: indSAdata.inputData[0],
                        },
                        formThreeData: indSAdata.inputData[0],
                        valuePerShare,
                        terminalSelectionType: indSAdata.terminalSelectionType,
                        valuationId: indSAdata.valuationId
                    })
                }
            }
            return {
                sensitiveAnalysisData: SABulk,
                sensitivityAnalysisId: id,
                selectedReportId: SAdata.selectedReportId,
                terminalSelectionType: sensitivityAnalysisLogger.terminalSelectionType,
                status: true,
                msg: "Sensitive Analysis data fetched successfully"
            }
        }
        catch(error){
            throw error;
        }
    }

    async upsertPrimaryValuationByReportId(reportId, secondaryValuationId?){
       try{
        const valuationData:any = await this.valuationsService.getValuationById(reportId);
        
        /**
         * We return record by process id incase secondary valuation id is passed in parameter
         * [CAUSE]
         * We do not want to perform upsert operation again for primary valuation, incase secondary (new) valuation is added 
        */
       let existingRecord = await this.sensitiveAnalysisModal.findOne({ processStateId: valuationData.processStateId });
        if(secondaryValuationId) return existingRecord;

        let SAValuation = [], containsDcfValuation = false;
        for await (const indValuation of valuationData.modelResults){
            if(indValuation.model === MODEL[0] || indValuation.model === MODEL[1] || indValuation.model === MODEL[3]){
                containsDcfValuation = true;
                SAValuation.push({
                    modelResults:valuationData.modelResults,
                    inputData: valuationData.inputData,
                    valuationId: valuationData.id,
                    terminalSelectionType: existingRecord?.terminalSelectionType || 'tvCashFlowBased'
                })
            }
        }
        if(!containsDcfValuation) return false;
        let sensitivityAnalysisLogger:any = new postSensitivityAnalysisDto();
        sensitivityAnalysisLogger.processStateId = valuationData.processStateId;
        sensitivityAnalysisLogger.primaryReportId = valuationData.id;
        sensitivityAnalysisLogger.userId = valuationData.userId;
        sensitivityAnalysisLogger.selectedReportId = valuationData.id;
        sensitivityAnalysisLogger.primaryValuation = SAValuation;

        

        if(existingRecord){
            return await this.sensitiveAnalysisModal.findOneAndUpdate(
                { processStateId: sensitivityAnalysisLogger.processStateId },
                {
                    modifiedAt: new Date(),
                    ...sensitivityAnalysisLogger,
                },
                { new: true }
                );
        }

        return await new this.sensitiveAnalysisModal(sensitivityAnalysisLogger).save();
       }
       catch(error){
        throw error;
       }
    }
    
    async upsertSecondaryValuationByReportId(reportId){
       try{
        const valuationData:any = await this.valuationsService.getValuationById(reportId);

        let existingRecord = await this.sensitiveAnalysisModal.findOne({ processStateId: valuationData.processStateId }).exec();
        
        let SAValuation = [], containsDcfValuation = false, valuePerShare;
        for await (const indValuation of valuationData.modelResults){
            if(indValuation.model === MODEL[0] || indValuation.model === MODEL[1] || indValuation.model === MODEL[3]){
                containsDcfValuation = true;
                SAValuation.push({
                    modelResults:valuationData.modelResults,
                    inputData: valuationData.inputData,
                    valuationId: valuationData.id,
                    terminalSelectionType: existingRecord.terminalSelectionType
                })
                
                valuePerShare = indValuation?.valuationData[0]?.valuePerShare;
            }
        }
        if(!containsDcfValuation) return false;
        
        let sensitivityAnalysisLogger:any = new postSensitivityAnalysisDto();
        sensitivityAnalysisLogger.processStateId = valuationData.processStateId;
        sensitivityAnalysisLogger.userId = valuationData.userId;
        

        if(existingRecord){
            const updatedRecord =  await this.sensitiveAnalysisModal.findOneAndUpdate(
                { processStateId: sensitivityAnalysisLogger.processStateId },
                {
                    $push: {
                        secondaryValuation: {
                          $each: SAValuation,
                        },
                        secondaryReportId:{
                            $each: [valuationData.id]
                        }
                      },
                      $set: {
                        modifiedAt: new Date(),
                        ...sensitivityAnalysisLogger,
                      },
                },
                { new: true }
                ).exec();

                return {
                    updatedRecord,
                    valuePerShare,
                    status:true,
                    msg:"secondary valuation updated successfully"
                }
        }

        /*
        * There has to be process State Id present at any cost inorder to add secondary valuation
        * return await new this.sensitiveAnalysisModal(sensitivityAnalysisLogger).save();
        */
       }
       catch(error){
        throw error;
       }
    }

    async SAsecondaryRevaluation(payload, header){
        try{

            const processId = payload.processStateId;
            const firstStageDetails:any = await this.processStateManagerService.fetchStageWiseDetails(processId, 'firstStageInput');
            const fourthStageDetails:any = await this.processStateManagerService.fetchStageWiseDetails(processId, 'fourthStageInput');

            const otherAdj = fourthStageDetails?.data?.fourthStageInput.otherAdj;
            const financialBasis = fourthStageDetails?.data?.fourthStageInput.financialBasis;
            const sensitivityAnalysisId = fourthStageDetails?.data?.fourthStageInput?.sensitivityAnalysisId; 

            const thirdStageDetails:any = await this.processStateManagerService.fetchStageWiseDetails(processId, 'thirdStageInput');

            let input:any = {};
            input = {
                ...firstStageDetails.data.firstStageInput, 
                otherAdj: otherAdj
            }
            for await (const indResponse of thirdStageDetails.data.thirdStageInput){
                const {model , ...rest} = indResponse;
                input = {
                    ...input, 
                    ...rest
                };
            }

            const headers = { 
              'Authorization':`${header.authorization}`,
              'Content-Type': 'application/json'
            }
            const {secondaryValuationId } = payload;
            const updatedInputPayload =  {...input,...payload, financialBasis, primaryValuationFlag:false};
            
            const valuationRepostData =  await axiosInstance.post(VALUATION_PROCESS_V1, updatedInputPayload, { httpsAgent: axiosRejectUnauthorisedAgent, headers });
            const newValuationId = valuationRepostData?.data?.reportId;
            
           const updatedResponse:any =  await this.findByReportIdAndReplaceSecondaryValuation(sensitivityAnalysisId, secondaryValuationId, newValuationId, processId, headers);
            return {
                sensitivityAnalysisId,
                valuePerShare:updatedResponse?.updatedValuation?.valuePerShare,
                newValuationId: updatedResponse?.updatedSAsecondaryValuationId,
                status:true,
                msg:"secondary revaluation success"
            }
          }
          catch(error){
            throw error;
          }
        }

        async findByReportIdAndReplaceSecondaryValuation(SAid, oldValuationId, newValuationId, processId, headers){
            try{
                let alreadyExistingRecord:any = await this.sensitiveAnalysisModal.findOne({ _id: SAid });
                let terminalSelectionType = 'tvCashFlowBased';

                if (alreadyExistingRecord) {
                  const modelExists = await this.sensitiveAnalysisModal.exists({
                    _id: SAid,
                    'secondaryReportId': { $in: oldValuationId },
                  });

                  if (modelExists) {

                    // const revaluationAsPerTerminalSelection = await this.fcfeAndFcffService.recalculateValuePerShare(processId, terminalSelectionType, false) 
                    for await(const indSAsecondaryValuation of alreadyExistingRecord.secondaryValuation){
                        if(indSAsecondaryValuation?.valuationId === oldValuationId ){
                            terminalSelectionType = indSAsecondaryValuation?.terminalSelectionType;
                        }
                    }
                    const payload = {
                        processId,
                        type: terminalSelectionType,
                        updateByValuationId: newValuationId,
                    }
                    
                    const updatedValuationAsPerTerminalType =  await axiosInstance.post(`${REVALUATION_SA}`, payload, { httpsAgent: axiosRejectUnauthorisedAgent, headers });
                    const updatedValuationId = updatedValuationAsPerTerminalType?.data?.reportId
                 
                    if(!updatedValuationId) throw new NotFoundException({status:false, msg:"Id not found", description:"Please check revaluation as per terminal type for SA"})
                 
                    const updatedValuation = await this.upsertSecondaryValuationByReportId(updatedValuationId);
                    await this.removeSecondaryValuationByReportId(SAid, oldValuationId);
                   
                    return {updatedValuation, updatedSAsecondaryValuationId: updatedValuationId};
                }
            }
            }
            catch(error){
                throw error;
            }
        }
        
        async removeSecondaryValuationByReportId(SAid, reportId){
            try{
                await this.sensitiveAnalysisModal.updateOne(
                    { _id: SAid },
                    { 
                        $pull: { 
                            'secondaryReportId': { $in: [reportId] },
                            'secondaryValuation': { valuationId: { $in: [reportId] } }
                        } 
                    }
                  );
                  return {
                    sensitivityAnalysisId: SAid,
                    status: true,
                    msg:"SA Record deleted success"
                };
            }
            catch(error){
                throw error;
            }
        }

        async updateSATerminalSelection(SAid, terminalSelType){
            try{
                await this.sensitiveAnalysisModal.updateOne(
                    { _id: SAid },
                    { 
                       terminalSelectionType: terminalSelType
                    }
                  );
                  
                  return {
                    sensitivityAnalysisId: SAid,
                    terminalSelectionType: terminalSelType,
                    status: true,
                    msg:"SA terminal selection updated success"
                };
            }
            catch(error){
                throw error;
            }
        }

        async computePrimaryAndSecondaryValuation(SAid, valuationId){
            try{
                const SAdata = await this.sensitiveAnalysisModal.findById({_id: SAid});

                if(!SAdata) throw new NotFoundException({status:false, msg:"Incorrect Id", description:"Please check SA id"});
                const selectedPrimaryIdSimilarBool = SAdata.primaryReportId === valuationId;
                if(!selectedPrimaryIdSimilarBool){
                    await this.upsertSecondaryValuationByReportId(SAdata.primaryReportId);
                    await this.upsertPrimaryValuationByReportId(valuationId);
                    await this.removeSecondaryValuationByReportId(SAid, valuationId);
                    return true;
                }
            }
            catch(error){
                throw error;
            }
        }

        async fetchPrimaryValuationId(id){
            try{
                const SAdata = await this.sensitiveAnalysisModal.findById({_id: id});
    
                if(!SAdata) 
                    throw new NotFoundException({msg:'Record not found', status:false, description:"Id found to be incorrect"});
              
                return {valuationId: SAdata.primaryReportId};
            }
            catch(error){
                throw error;
            }
        }
    }
