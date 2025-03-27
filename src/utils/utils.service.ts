import { HttpException, HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import { FilterQuery, Model } from 'mongoose';
import { InjectModel } from '@nestjs/mongoose';
import { ValuationDocument } from 'src/valuationProcess/schema/valuation.schema';
import { catchError, forkJoin, from, of, switchMap } from 'rxjs';
import { ProcessManagerDocument } from 'src/processStatusManager/schema/process-status-manager.schema';
import { AuthenticationService } from 'src/authentication/authentication.service';
import * as fs from 'fs';
import * as wordListPath from 'word-list';

import { DataCheckListDocument } from './schema/dataCheckList.schema';
import { nanoid } from 'nanoid';
import { MandateDocument } from './schema/mandate.schema';
import { KeyCloakAuthGuard } from 'src/middleware/key-cloak-auth-guard';
@Injectable()
export class utilsService {
  constructor(
    @InjectModel('valuation') private readonly valuationModel: Model<ValuationDocument>,
    @InjectModel('processManager') private readonly processModel: Model<ProcessManagerDocument>,
    @InjectModel('dataChecklist') private readonly dataChecklistModel: Model<DataCheckListDocument>,
    @InjectModel('mandate') private readonly mandateModel: Model<MandateDocument>,
    private readonly authenticationService:AuthenticationService
  ) {}
  async paginateValuationByUserId(page: number, pageSize: number,req, query):Promise<any> {

    const skip = (page - 1) * pageSize;
    const KCGuard:any = new KeyCloakAuthGuard(); 
    return from(KCGuard.fetchAuthUser(req).toPromise()).pipe(
      switchMap((userDetails:any)=>{
        if(!userDetails.status)
          return of(userDetails);
        return forkJoin([
          from(
            this.processModel
              .find(this.constructQuery(userDetails.userId,query))
              .skip(skip)
              .limit(pageSize)
              .sort({ processIdentifierId: -1 })
              // .select('company model valuation createdAt')
              .exec(),
          ),
          from(
            this.processModel
              .find(this.constructQuery(userDetails.userId,query))
              // .select('company model valuation createdAt')
              .exec(),
          ),
        ]).pipe(
          switchMap(([response, totalPage]):any => {
            const totalPages = Math.ceil(totalPage.length / pageSize);

            return of({
                response,
                pagination: {
                  current: page,
                  pageSize,
                  hasPrevious: page > 1,
                  previous: page - 1,
                  hasNext: page < totalPages,
                  next: page + 1,
                  lastPage: totalPages,
                  totalElements: totalPage.length,
                },
              })
          }),
          catchError((error) => {
            throw new NotFoundException({
              error,
              message: 'Something went wrong',
            });
          })
        );
      })
    )
  }


  async paginateDatachecklist(page: number, pageSize: number,req):Promise<any> {

    const skip = (page - 1) * pageSize;

    const KCGuard:any = new KeyCloakAuthGuard();
    return from(KCGuard.fetchAuthUser(req)).pipe(
      switchMap((userDetails:any)=>{
        if(!userDetails.status)
          return of(userDetails);
        return forkJoin([
          from(this.dataChecklistModel.find({ emailFrom: { $ne: null } })
        .skip(skip)
        .limit(pageSize)
        .sort({ createdAt: -1 })
        .exec()
        ),
        from(this.dataChecklistModel.find({ emailFrom: { $ne: null } })
        .exec()
        )
        ])
       .pipe(
          switchMap(([response, totalPage]):any => {
            const totalPages = Math.ceil(totalPage.length / pageSize);

            return of({
                response,
                pagination: {
                  current: page,
                  pageSize,
                  hasPrevious: page > 1,
                  previous: page - 1,
                  hasNext: page < totalPages,
                  next: page + 1,
                  lastPage: totalPages,
                  totalElements: totalPage.length,
                },
              })
          }),
          catchError((error) => {
            throw new NotFoundException({
              error,
              message: 'Something went wrong',
            });
          })
        );
      })
    )
  }

  async getMaxObId(){
    const maxState = await this.processModel.findOne({ processIdentifierId: { $exists: true, $ne: null } }).sort({ processIdentifierId: -1 }).exec();
    return maxState ? maxState.processIdentifierId : 100000;
  }

  async getMaxDatachecklistObId() {
    const maxState = await this.dataChecklistModel.findOne({ dataChecklistIdentifierId: { $exists: true, $ne: null } }).sort({ dataChecklistIdentifierId: -1 }).exec();
    return maxState ? maxState.dataChecklistIdentifierId : 1000;
  }

  constructQuery(userId: string, query?: string): FilterQuery<any> {
    const baseQuery: FilterQuery<any> = { "userId": userId, "isDeleted": false };
  
    if (query && query !== undefined && query !== 'undefined') {
      baseQuery["$or"] = [
        { "firstStageInput.company": { "$regex": `${query}`, "$options": "i" }},
        { "processIdentifierId": parseInt(query) || -1 },
      ];
    }
    return baseQuery;
  }

  async getWordList(wordTyped){
    try{
      const wordArray = fs.readFileSync(wordListPath, 'utf8').split('\n');
      const newArray = wordArray
      .filter(word => word.toLowerCase().indexOf(wordTyped.toLowerCase()) === 0)
      .slice(0, 10);
      return newArray;
    }
    catch(error){
      return{
        error:error,
        status:false,
        msg:"Autocomplete list error"
      }
    }
  }

  async generateUniqueLink(request, emailData) {
    try{

    const uniqueLink = nanoid();
    const expirationDate = new Date();

    expirationDate.setHours(expirationDate.getHours() + 24);

    const body = {
      checkList: emailData.checkList,
      uniqueLink,
      expirationDate,
      emailTo: emailData?.emailTo
    }

    await this.updateDBChecklist(request, body);
    
    return {
      uniqueLink,
      status:true,
      msg:"Unique link id generated sucessfully"
    };
    }
    catch(error){
      throw new HttpException(
        {
          error: error,
          status: false,
          msg: 'unique link id generation failed',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async updateDBChecklist(request, body){
    try{
      switch(body.checkList){
        case 'mandatechecklist':
          await this.mandateModel.create({ uniqueLinkId: body.uniqueLink, expirationDate: body.expirationDate });
        break;

        case 'datachecklist':
          const KCGuard:any = new KeyCloakAuthGuard();

          const userDetails:any = await KCGuard.fetchAuthUser(request).toPromise();

          if(!userDetails.status)
            return {message:'unauthorized', status:false};

          const maxId = await this.getMaxDatachecklistObId();
          
          await this.dataChecklistModel.create(
            { 
              uniqueLinkId: body.uniqueLink, 
              expirationDate: body.expirationDate, 
              emailFrom: userDetails.email, 
              emailTo: body?.emailTo,
              dataChecklistIdentifierId: maxId + 1
            }
          );
        break;

        default:
          return {
            msg:"please provide checklist name",
            status:false
          }

      }
    }
    catch(error){
      return {
        error:error,
        status:false,
        msg:"checklist collection not updated"
      }
    }
  }

  async isValidUniqueLink(checklistDetails){
    try{
      const existingLink = await this.checkDBChecklist(checklistDetails.queryCheckList, checklistDetails.linkId);

      return {
        status:true,
        linkValid:existingLink.status,
        msg:"unique id status fetched success"
      }
    }
    catch(error){
      throw new HttpException(
        {
          error: error,
          status: false,
          msg: 'unique link id not found',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async checkDBChecklist(checkList, link){
    try{
      let checklistModel;
      let checklistName;
      
      switch(checkList){
        case 'mandatechecklist':
          checklistModel = this.mandateModel;
          checklistName = 'Mandate Checklist';
          break;
  
        case 'datachecklist':
          checklistModel = this.dataChecklistModel;
          checklistName = 'Data Checklist';
          break;
  
        default:
          return {
            msg: "Please provide a valid checklist name (mandatechecklist or datachecklist)",
            status: false
          };
      }
  
      const checklistDetails = await checklistModel.findOne({ uniqueLinkId: link });
  
      if(checklistDetails){
        return {
          data: checklistDetails,
          status: true,
          msg: `${checklistName} found`
        };
      } else {
        return {
          msg: `${checklistName} not found`,
          status: false
        };
      }
    } catch(error){
      return {
        error: error.message,
        status: false,
        msg: "Checklist collection not found"
      };
    }
  }
  
  async updateMandateChecklist(payload, link){
    try{
      const mandateData = await this.mandateModel.findOne({ uniqueLinkId: link.linkId }).exec();

      if(!mandateData)
        return {
          status:false,
          msg:"mandate record not found, please check linkid"
        }

      await this.mandateModel.findOneAndUpdate(
          {uniqueLinkId: link.linkId},
          { 
            $set: { 
              ...payload, isSubmitted: true
            }
          },
          { new: true }
      );

      return {
          uniqueLinkId:link.linkId,
          status:true,
          msg:'mandate updated successfully'
      }
    }
    catch(error){
      return {
        error:error,
        status:false,
        msg:"Mandate checklist update failed"
      }
    }
  }

  async updateDataChecklist(payload, link){
    try{
      const dataChecklistDetails = await this.dataChecklistModel.findOne({ uniqueLinkId: link.linkId }).exec();

      if(!dataChecklistDetails)
        return {
          status:false,
          msg:"data checklist record not found, please check linkid"
        }

      await this.dataChecklistModel.findOneAndUpdate(
          {uniqueLinkId: link.linkId},
          { 
            $set: { 
              ...payload, isSubmitted: true
            }
          },
          { new: true }
      );

      return {
          uniqueLinkId:link.linkId,
          status:true,
          msg:'data checklist updated successfully'
      }
    }
    catch(error){
      return{
        error:error,
        status:false,
        msg:"data checklist update failed"
      }
    }
  }

  async fetchMandateByLinkId(linkId){
    try{
      const mandateRecord = await this.mandateModel.findOne({uniqueLinkId: linkId}).exec();

      return {
        data:mandateRecord,
        status:true,
        msg:"mandate record found"
      }
    }
    catch(error){
      return {
        error:error,
        status:false,
        msg:"Mandate record not found"
      }
    }
  }
  async fetchDataChecklistByLinkId(link){
    try{
      const dataChecklistRecord = await this.dataChecklistModel.findOne({uniqueLinkId: link.linkId}).exec();

      return {
        data:dataChecklistRecord,
        status:true,
        msg:"datachecklist record found"
      }
    }
    catch(error){
      return {
        error:error,
        status:false,
        msg:"datachecklist record not found"
      }
    }
  }

  // async fetchDataChecklistAllEmails(){
  //   try{
  //     const dataCheckListEmails = await this.dataChecklistModel.find({ emailFrom: { $ne: null } }).exec();
  //     return {
  //       data:dataCheckListEmails,
  //       status:true,
  //       msg:"email fetched successfully"
  //     };
  //   }
  //   catch(error){
  //     return {
  //       error:error,
  //       status:false,
  //       msg:"emails fetched failed"
  //     }
  //   }
  // }

  async resendDatachecklist(link) {
    try {
      const expirationDate = new Date();
      expirationDate.setHours(expirationDate.getHours() + 24);

      await this.dataChecklistModel.findOneAndUpdate(
        { uniqueLinkId: link.linkId },
        { 
          $inc: { emailSendFrequency: 1 },
          $set: { expirationDate: expirationDate } 
        },
        { upsert: true, new: true }
      ).exec();
  
      return {
        uniqueLinkId: link.linkId,
        status: true,
        msg: 'data checklist re-sent successfully'
      };
    } catch (error) {
      return {
        error: error,
        status: false,
        msg: "datachecklist resend failed"
      };
    }
  }
  }