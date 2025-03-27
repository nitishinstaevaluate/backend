import { HttpException, HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { plainToClass } from 'class-transformer';
import { Model } from 'mongoose';
import { CiqindustryhierarchyDto, CiqIndustryListDto, CiqSegmentDescriptionDto } from './dto/ciq-sp.dto';
import { SnowflakeClientServiceService } from 'src/snowflake/snowflake-client-service.service';
import { ciqcompanystatustypeDocument, ciqcompanytypeDocument, ciqindustryhierarchyDocument, ciqsimpleindustryDocument } from './schema/ciq-sp.chema';
import { RedisService } from 'src/middleware/redisConfig';
import { ProcessStatusManagerService } from 'src/processStatusManager/service/process-status-manager.service';
import { axiosInstance, axiosRejectUnauthorisedAgent } from 'src/middleware/axiosConfig';
import { CAPITALIQ_MARKET } from 'src/library/interfaces/api-endpoints.prod';
import { convertToNumberOrOne, convertToNumberOrZero } from 'src/excelFileServices/common.methods';
import { BETA_SUB_TYPE, BETA_TYPE, MNEMONICS_ARRAY, MNEMONICS_ARRAY_2, MNEMONIC_ENUMS, RATIO_TYPE } from 'src/constants/constants';
import { calculateMean, calculateMedian, extractValues, formatDateToMMDDYYYY, iqCreateStructure } from './ciq-common-functions';
import { ciqSpBetaService } from './ciq-sp-beta.service';
import { ciqSpCompanyMeanMedianService } from './ciq-sp-company-mean-median.service';
import { CiqSpFinancialService } from './ciq-sp-financial.service';
import { CIQ_ELASTIC_SEARCH_CRITERIA } from 'src/library/interfaces/api-endpoints.local';
import { AuthenticationService } from 'src/authentication/authentication.service';
import { HistoricalReturnsService } from 'src/data-references/data-references.service';
require('dotenv').config();

@Injectable()
export class CiqSpService {
    constructor( @InjectModel('ciqsimpleindustry') 
    private readonly ciqsimpleindustrymodel : Model<ciqsimpleindustryDocument>,
    @InjectModel('ciqindustryhierarchy')
    private readonly ciqindustryhierarchymodel: Model<ciqindustryhierarchyDocument>,
    @InjectModel('ciqcompanystatustype') 
    private readonly ciqcompanystatustypemodel: Model<ciqcompanystatustypeDocument>,
    @InjectModel('ciqcompanytype') 
    private readonly ciqcompanytypemodel: Model<ciqcompanytypeDocument>,
    private readonly snowflakeClientService: SnowflakeClientServiceService,
    // private readonly redisService: RedisService,
    private processStateManagerService:ProcessStatusManagerService,
    private ciqSpBetaService: ciqSpBetaService,
    private ciqSpCompanyMeanMedianService: ciqSpCompanyMeanMedianService,
    private ciqSpfinancialService: CiqSpFinancialService,
    private authenticationService: AuthenticationService,
    private historicalReturnsService:HistoricalReturnsService
    ){}

    async fetchSPHierarchyBasedIndustry(){
        try{
          // await this.snowflakeClientService.executeSnowflakeQuery('USE WAREHOUSE IFINLITE');
          // return await this.snowflakeClientService.executeSnowflakeQuery('SELECT * FROM ciqsimpleindustry');  // execute these queries if data is not present in db
          const industryData = plainToClass(CiqindustryhierarchyDto, await this.ciqindustryhierarchymodel.find({childLevel:3}).sort({GICSDescriptor:1}).exec(),{ excludeExtraneousValues: true});

          return {
            data:industryData,
            status:true,
            msg:'Ciqsimpleindustry fetch success'
          }
        }
        catch(err){
          return {
            error:err,
            status:false,
            msg:'Ciqsimpleindustry fetch failed'
          }
        }
      }
    
      async fetchAllSPIndustry(){
        try{
          await this.snowflakeClientService.executeSnowflakeQuery(`USE WAREHOUSE ${process.env.SNOWFLAKE_WAREHOUSE};`);
          const ciqIndustryBasedCompany = await this.snowflakeClientService.executeSnowflakeQuery(
            `SELECT a.companyid, a.companyname, b.* 
             FROM ciqCompany a 
             JOIN ciqsimpleindustry b ON a.simpleindustryid = b.simpleindustryid 
             where b.simpleindustrydescription like '%Commercial Services and Supplies%' 
             LIMIT 20`
             );

          const modifiedData = plainToClass(CiqIndustryListDto, ciqIndustryBasedCompany, {excludeExtraneousValues : true});

          return {
            data:modifiedData,
            status:true,
            msg:'Company based industry fetch success',
          }
        }
        catch(error){
          return {
            error:error,
            msg:'Company based industry fetch failed',
            status:false
         }
        }
      }

      async fetchSPIndustryListByName(industryName:string,location:string){ // redundant function (not in use)
        try{
          const decodeIndustry = industryName.replace(/%20/g, ' ');
          const decodeLocation = location.replace(/%20/g, ' ');

          const simpleIndustryDetails= await this.ciqsimpleindustrymodel.findOne({simpleindustrydescription:decodeIndustry}).select('simpleindustryid').exec();
          
          await this.snowflakeClientService.executeSnowflakeQuery(`USE WAREHOUSE ${process.env.SNOWFLAKE_WAREHOUSE};`);
          const ciqIndustryBasedCompany = await this.snowflakeClientService.executeSnowflakeQuery(
           `SELECT company.companyid, company.companyname, industry.*, company.city
            FROM ciqCompany AS company
            JOIN ciqCountryGeo AS geo ON geo.countryId = company.countryId
            JOIN ciqsimpleindustry AS industry ON company.simpleindustryid = industry.simpleindustryid 
            WHERE 1=1
            AND geo.country = '${decodeLocation}'
            AND company.simpleindustryid = ${simpleIndustryDetails.simpleindustryid}
            LIMIT 20;`
          );
 
          const modifiedData = plainToClass(CiqIndustryListDto, ciqIndustryBasedCompany, {excludeExtraneousValues : true});

          return {
            data:modifiedData,
            status:true,
            msg:'SP industry fetch success',
          }
        }
        catch(error){
          return {
            error:error,
            msg:'Company based industry fetch failed',
            status:false
         }
        }
      }

      async fetchSPLevelFourIndustryBasedList(descriptor:string){
        try{
          const industryData = plainToClass(CiqindustryhierarchyDto, await this.ciqindustryhierarchymodel.findOne({GICSDescriptor:descriptor,childLevel:3}).select('subTypeId').exec(),{ excludeExtraneousValues: true});

          const levelFourIndustyList = plainToClass(CiqindustryhierarchyDto, await this.ciqindustryhierarchymodel.find({subParentId:industryData.subTypeId,childLevel:4}).sort({GICSDescriptor:1}).exec(), { excludeExtraneousValues : true});

          return {
            data:levelFourIndustyList,
            status:true,
            msg:'Ciqsimpleindustry fetch success'
          }
        }
        catch(err){
          return {
            error:err,
            status:false,
            msg:'Ciqsimpleindustry fetch failed'
          }
        }
      }

      //#region  SANKET(22-01-2024) - SNOW SQL AND REDIS SEARCH CODE COMMENTED, REPLACED BY ELASTIC SEARCH
      // async fetchSPIndustryListByLevelFourIndustries(data){
      //   try{
      //     let industryId = [];
      //     let companyType = [];
      //     let companyStatusType = [];
      //     let decodeLocation, decodeIndustry, businessDescriptor, industryValueFromDb;
      //     let modifiedData;

      //     //#region fetch by company status types
      //     if(data?.companyStatusType){
      //       for await (const companyStatusTypes of data.companyStatusType){
      //         if(companyStatusTypes){
      //           const id = await this.ciqcompanystatustypemodel.findOne({companystatustypename:companyStatusTypes}).exec();
      //           if(!id)  
      //             return {
      //               msg:"Company Status type not exist",
      //               status:false
      //             }
      //             companyStatusType.push(id.companystatustypeid);
      //         }
      //       }
      //     }
      //     //#endregion

      //     //#region fetch by company type
      //     if(data?.companyType){
      //       for await (const companyTypes of data.companyType){
      //         if(companyTypes){
      //           const id = await this.ciqcompanytypemodel.findOne({companytypename:companyTypes}).exec();
      //           if(!id)  
      //             return {
      //               msg:"Company type not exist",
      //               status:false
      //             }
      //             companyType.push(id.companytypeid);
      //         }
      //       }
      //     }
      //     //#endregion

      //     //#region fetch by Industries List [Level - 4]
      //     if(data?.levelFourIndustries){
      //       for await (const levelFourIndustry of data.levelFourIndustries){
      //         if(levelFourIndustry){
      //           const id = await this.ciqindustryhierarchymodel.findOne({GICSDescriptor:levelFourIndustry}).exec();
      //           if(!id)  
      //             return {
      //               msg:"level four industry does not exist",
      //               status:false
      //             }
      //           industryId.push(id.subTypeId);
      //         }
      //       }
      //     }
      //     //#endregion

      //     //#region fetch by industry [Level - 3 Industries]
      //     if(data.industryName){
      //       decodeIndustry= await this.ciqsimpleindustrymodel.findOne({simpleindustrydescription:data.industryName}).select('simpleindustryid').exec();
      //     }
      //     //#endregion

      //     //#region fetch by location
      //     if(data?.location){
      //       decodeLocation = data.location;
      //     }
      //     //#endregion

      //     //#region fetch by business descriptor
      //     if(data?.businessDescriptor){
      //       businessDescriptor = data.businessDescriptor;
      //     }
      //     //#endregion

      //     const redisCacheExist = await this.redisService.getValueByKey('businessdescriptor');
      //     const businessDescriptionArray = redisCacheExist ?  JSON.parse(redisCacheExist) : [];

      //     let filteredDescriptorDetails = [];
      //     if(redisCacheExist && businessDescriptionArray?.length ){

      //       if(businessDescriptor){
      //         for await(const descriptors of businessDescriptionArray ){
      //           if(descriptors.SEGMENTDESCRIPTION.toLowerCase().includes(businessDescriptor.toLowerCase().trim()))
      //           {
      //             filteredDescriptorDetails.push(descriptors.COMPANYID)
      //           }
      //         }
      //       }
      //       else{
      //         filteredDescriptorDetails = []
      //       }
      //       const payload = {
      //         decodeIndustry,
      //         companyStatusType,
      //         companyType,
      //         industryName:data.industryName,
      //         industryId,
      //         decodeLocation,
      //         companyIdArray:filteredDescriptorDetails
      //       }
      //       const modifiedData:any = await this.fetchAggregateIndustryList(payload);
      //       return {
      //         data:modifiedData.data,
      //         status:true,
      //         msg:'SP industry fetch success',
      //         total:modifiedData.data.length
      //       }
      //     }

      //     await this.saveBusinessDescription();

      //     const payload = {
      //       decodeIndustry,
      //       companyStatusType,
      //       companyType,
      //       industryName:data.industryName,
      //       industryId,
      //       decodeLocation,
      //       companyIdArray:[]
      //     }
      //      modifiedData = await this.fetchAggregateIndustryList(payload);
              
      //     return {
      //       data:modifiedData.data,
      //       status:true,
      //       msg:'SP industry list fetch success',
      //       total:modifiedData.data.length
      //     }
      //   }
      //   catch(error){
      //     return {
      //       error:error,
      //       msg:'SP industry list fetch failed',
      //       status:false
      //    }
      //   }
      // }

      // async saveBusinessDescription(){
    //   try{
    //     // let descriptionQuery;
    //     await this.snowflakeClientService.executeSnowflakeQuery(`USE WAREHOUSE ${process.env.SNOWFLAKE_WAREHOUSE};`);

    //     const isAdminConnectionActive = await this.snowflakeClientService.isLocalConnectionActive();
    //     if(isAdminConnectionActive){
    //       await this.executeDefaultAdminRights();
    //     }
    //     let descriptionQuery = await this.snowflakeClientService.executeSnowflakeQuery(
    //       `SELECT 
    //       company.companyid, 
    //       description.segmentdescription 
    //      FROM 
    //       ${isAdminConnectionActive ? 'ciqsegmentdescriptionind' : 'ciqsegmentdescription'} AS description
    //      JOIN 
    //       ${isAdminConnectionActive ? 'ciqcompanyind' : 'ciqcompany'} AS company 
    //      ON 
    //       description.companyId = company.companyid
    //      JOIN 
    //       ciqCountryGeo AS geo 
    //      ON 
    //       geo.countryId = company.countryId
    //      WHERE 
    //       description.segmentdescription IS NOT NULL 
    //      AND 
    //       geo.country = 'India'` // default location as India
    //     )
  
    //     const businessDescriptorDetails = await plainToClass(CiqSegmentDescriptionDto, descriptionQuery, {excludeExtraneousValues:true});

    //     this.redisService.setKeyValue('businessdescriptor',JSON.stringify(businessDescriptorDetails))

    //     return {
    //       data:businessDescriptorDetails,
    //       status:true,
    //       msg:"Business descriptor stored successfully"
    //     }
    //   }
    //   catch(error){
    //     return {
    //       msg:"Segment description store failed",
    //       status:false,
    //       error:error
    //     }
    //   }
    // }

    // async fetchAggregateIndustryList(payload){
    //   try{
    //     await this.snowflakeClientService.executeSnowflakeQuery(`USE WAREHOUSE ${process.env.SNOWFLAKE_WAREHOUSE};`);
    //     const isAdminConnectionActive = await this.snowflakeClientService.isLocalConnectionActive();

    //     if(isAdminConnectionActive){
    //       await this.executeDefaultAdminRights();
    //     }
    //       const locationCondition = payload.decodeLocation ? `AND geo.country = '${payload.decodeLocation}'` : '';
    //       const companyStatusTypeCondition = payload.companyStatusType.length ? `AND cmpny.companystatustypeid IN (${payload.companyStatusType})` : '';
    //       const companyTypeCondition = payload.companyType.length ? `AND cmpny.companytypeid IN (${payload.companyType})` : '';
    //       const industryIdCondition = payload.industryId.length ? `AND cmpnyIndstry.industryid IN (${payload.industryId})` : '';
    //       const decodeIndustryCondition = payload.decodeIndustry ? `AND cmpny.simpleindustryid = ${payload.decodeIndustry.simpleindustryid}` : '';

    //       const formattedQuery = `
    //         ${locationCondition}
    //         ${companyStatusTypeCondition}
    //         ${companyTypeCondition}
    //         ${industryIdCondition}
    //         ${decodeIndustryCondition}
    //       `;

    //       const companyIdArrayCondition = payload?.companyIdArray?.length
    //         ? `AND 
    //         cmpny.companyid IN 
    //             (
    //               SELECT 
    //                 company.companyId 
    //                 FROM 
    //                 ${isAdminConnectionActive ? 'ciqcompanyind' : 'ciqcompany'} AS company 
    //                 JOIN 
    //                 ${isAdminConnectionActive ? 'ciqsegmentdescriptionind' : 'ciqsegmentdescription'} AS businessDesc ON businessDesc.companyId = company.companyid 
    //                 WHERE 
    //                 company.companyid IN (${payload?.companyIdArray.join(',')}) 
    //                   AND businessDesc.segmentdescription IS NOT NULL
    //             )`
    //         : '';

    //       let ciqIndustryBasedCompany = await this.snowflakeClientService.executeSnowflakeQuery(
    //         `SELECT 
    //           cmpny.*, 
    //           cmpnyIndstry.*, 
    //           industry.*
    //         FROM
    //           ${isAdminConnectionActive ? 'ciqcompanyind' : 'ciqcompany'} AS cmpny
    //         JOIN
    //           ciqCountryGeo AS geo ON geo.countryId = cmpny.countryId
    //         JOIN
    //           ${isAdminConnectionActive ? 'ciqCompanyIndustryInd' : 'ciqCompanyIndustry'} AS cmpnyIndstry ON cmpnyIndstry.companyId = cmpny.companyId
    //         JOIN
    //           ciqsimpleindustry AS industry ON cmpny.simpleindustryid = industry.simpleindustryid
    //         WHERE 1=1
    //           ${formattedQuery}
    //           ${companyIdArrayCondition}
    //           ${!payload.industryName ? `LIMIT 20` : ''};`
    //         );

    //       const modifiedData = plainToClass(CiqIndustryListDto, ciqIndustryBasedCompany, {excludeExtraneousValues : true});
          
    //     return {
    //       data:modifiedData,
    //       msg:"Industry list fetch success",
    //       status:true
    //     }
    //   }
    //   catch(error){
    //     return {
    //       error:error,
    //       msg:"Industry list fetch failed",
    //       status:false
    //     }
    //   }
    // }

    // async executeDefaultAdminRights(){
    //   try{
    //     await this.snowflakeClientService.executeSnowflakeQuery(`USE ROLE ${process.env.SNOWFLAKE_ROLE};`);
    //     await this.snowflakeClientService.executeSnowflakeQuery(`USE DATABASE ${process.env.SNOWFLAKE__LOCAL_DATABASE};`);
    //   }
    //   catch(error){
    //     return error
    //   }
    // }
    //#endregion

      async fetchSPCompanyStatusType(){
        try{
          const companyStatusTypeData = await this.ciqcompanystatustypemodel.find({ 'isactive': true }).sort({'companystatustypename':1}).exec();
          return {
            data:companyStatusTypeData,
            status:true,
            msg:"company status type fetched successfully"
          }
        }
        catch(error){
          return {
            error:error,
            status:false,
            msg:"company status type fetch failed"
          }
        }
      }

      async fetchSPCompanyType(){
        try{
          const companyTypeData = await this.ciqcompanytypemodel.find({ 'isactive': true }).sort({'companytypename':1}).exec();
          return {
            data:companyTypeData,
            status:true,
            msg:"company type fetched successfully"
          }
        }
        catch(error){
          return {
            error:error,
            status:false,
            msg:"company status type fetch failed"
          }
        }
      }

    //#region beta calculation starts
    async calculateBetaAggregate(data:any){
      try{
        const taxRate = parseFloat(data.taxRate?.replace("%", ""))/100 ?? parseFloat(data.taxRate)/100;
        const betaType = data.betaType;
        const betaSubType = data.betaSubType;
        
        const headers = {
          'Content-Type': 'application/json'
        }

        const auth = {
          username: process.env.CAPITALIQ_API_USERNAME,
          password: process.env.CAPITALIQ_API_PASSWORD
        }
        const date:any = await this.historicalReturnsService.getHistoricalBSE500Date(data.valuationDate);
        data.valuationDate = formatDateToMMDDYYYY(date.Date) || formatDateToMMDDYYYY(data.valuationDate);

        const createPayloadStructure = await this.ciqSpBetaService.createBetaPayloadStructure(data);
        const createBetaBase = await this.ciqSpBetaService.baseBetaWorking(data);
        const axiosBetaResponse = await axiosInstance.post(CAPITALIQ_MARKET, createPayloadStructure, {headers, auth});
        const betaData = await this.ciqSpBetaService.calculateBetaAggregate(axiosBetaResponse, taxRate, betaSubType, betaType, createBetaBase);

        return {
          coreBetaWorking:betaData.coreBetaWorking,
          betaMeanMedianWorking:betaData.betaMeanMedianWorking,
          msg:"beta calculation success",
          status:true,
          total:betaData.beta,
          deRatio:betaData.deRatio,
          betaSubType:data.betaSubType
        }
      }
      catch(error){
        return {
          error:error,
          msg:"beta calculation failed",
          status:false
        }
      }
    }
    //#endregion beta calculation ends

    //#region company mean median calculation starts
    async calculateCompaniesMeanMedianRatio(data){
      try{

        const ratioType = data.ratioType;
        const headers = {
          'Content-Type': 'application/json'
        }

        const auth = {
          username: process.env.CAPITALIQ_API_USERNAME,
          password: process.env.CAPITALIQ_API_PASSWORD
        }

        const date:any = await this.historicalReturnsService.getHistoricalBSE500Date(data.valuationDate);
        data.valuationDate = formatDateToMMDDYYYY(date.Date) || formatDateToMMDDYYYY(data.valuationDate);

        const createPayloadStructure = await this.ciqSpCompanyMeanMedianService.createRatioWisePayloadStructure(data.industryAggregateList, data.valuationDate);
        const axiosResponse = await axiosInstance.post(CAPITALIQ_MARKET, createPayloadStructure, {headers, auth});
        const ratioResponse = await this.ciqSpCompanyMeanMedianService.calculateCompanyMeanMedianAggregate(axiosResponse,data.industryAggregateList, ratioType);

        return {
          data:ratioResponse,
          msg:"mean and median calculation success",
          status:true,
          ratioType:ratioType
        }
      }
      catch(error){
        return {
          error:error,
          status:false,
          msg:'mean and median calculation failed'
        }
      }
    }
    //#endregion company mean median calculation ends

    //#region financial segment calculation starts
    async calculateFinancialData(data:any){
      try{
          const companyList = data.industryAggregateList;
          const valuationDate = data.valuationDate;

          const headers = {
            'Content-Type': 'application/json'
          }

          const auth = {
              username: process.env.CAPITALIQ_API_USERNAME,
              password: process.env.CAPITALIQ_API_PASSWORD
          }

          const createPayloadStructure = await this.ciqSpfinancialService.createFinancialSegmentPayloadStructure(data.industryAggregateList, valuationDate);
          const axiosResponse = await axiosInstance.post(CAPITALIQ_MARKET, createPayloadStructure, {headers, auth});
          const financialSegmentData = await this.ciqSpfinancialService.calculateFinancialAggregate(axiosResponse, companyList);

          return {
              data:financialSegmentData,
              msg:"financial segment calculation success",
              status:true,
          }
      }
      catch(error){
          return {
              error:error,
              status:false,
              msg:"financial segment calculation failed"
          }
      }
    }
    //#endregion financial segment calculation ends


    async fetchListedCompanyListDetails(data, req){
      try{
          let industryId = [];
          let companyType = [];
          let companyStatusType = [];
          let decodeLocation, decodeIndustry, businessDescriptor;

          //#region fetch by company status types
          if(data?.companyStatusType){
            for await (const companyStatusTypes of data.companyStatusType){
              if(companyStatusTypes){
                const id = await this.ciqcompanystatustypemodel.findOne({companystatustypename:companyStatusTypes}).exec();
                if(!id)  
                  return {
                    msg:"Company Status type not exist",
                    status:false
                  }
                  companyStatusType.push(id.companystatustypeid);
              }
            }
          }
          //#endregion

          //#region fetch by company type
          if(data?.companyType){
            for await (const companyTypes of data.companyType){
              if(companyTypes){
                const id = await this.ciqcompanytypemodel.findOne({companytypename:companyTypes}).exec();
                if(!id)  
                  return {
                    msg:"Company type not exist",
                    status:false
                  }
                  companyType.push(id.companytypeid);
              }
            }
          }
          //#endregion

          //#region fetch by Industries List [Level - 4]
          if(data?.levelFourIndustries){
            for await (const levelFourIndustry of data.levelFourIndustries){
              if(levelFourIndustry){
                const id = await this.ciqindustryhierarchymodel.findOne({GICSDescriptor:levelFourIndustry}).exec();
                if(!id)  
                  return {
                    msg:"level four industry does not exist",
                    status:false
                  }
                industryId.push(id.subTypeId);
              }
            }
          }
          //#endregion

          //#region fetch by industry [Level - 3 Industries]
          if(data.industryName){
            decodeIndustry= await this.ciqsimpleindustrymodel.findOne({simpleindustrydescription:data.industryName}).select('simpleindustryid').exec();
          }
          //#endregion

          //#region fetch by location
          if(data?.location){
            decodeLocation = data.location;
          }
          //#endregion

          //#region fetch by business descriptor
          if(data?.businessDescriptor){
            businessDescriptor = data.businessDescriptor;
          }
          //#endregion

          const payload = {
            decodeIndustry,
            companyStatusType,
            companyType,
            industryName:data.industryName,
            industryId,
            decodeLocation,
            businessDescriptor,
            pageStart: data?.pageStart,
            size: data?.size,
            valuationDate:data.valuationDate,
            companyName:data?.companyName
          }

          const bearerToken = await this.authenticationService.extractBearer(req);

          if(!bearerToken.status)
            return bearerToken;

          const headers = { 
            'Authorization':`${bearerToken.token}`,
            'Content-Type': 'application/json'
          }

          const companyList = await axiosInstance.post(`${CIQ_ELASTIC_SEARCH_CRITERIA}`, payload, {httpsAgent: axiosRejectUnauthorisedAgent,headers});

          if(companyList?.data?.data)
            return companyList.data

          return companyList.data;
      }
      catch(error){
        return {
          error:error,
          status:false,
          msg:"company list payload creation failed"
        }
      }
    }

    async calculateStockBeta(data){
      try{
        const headers = {
          'Content-Type': 'application/json'
        }

        const auth = {
          username: process.env.CAPITALIQ_API_USERNAME,
          password: process.env.CAPITALIQ_API_PASSWORD
        }
        
        const date:any = await this.historicalReturnsService.getHistoricalBSE500Date(data.valuationDate);
        data.valuationDate = formatDateToMMDDYYYY(date.Date) || formatDateToMMDDYYYY(data.valuationDate);

        const createPayloadStructure = await this.ciqSpBetaService.createStockBetaPayloadStructure(data);
        const axiosStockBetaResponse = await axiosInstance.post(CAPITALIQ_MARKET, createPayloadStructure, {headers, auth});
        const betaData = await this.ciqSpBetaService.calculateStockBeta(axiosStockBetaResponse);

        return {
          data:axiosStockBetaResponse.data,
          total:betaData.result,
          isStockBetaPositive:betaData.isStockBetaPositive,
          negativeBeta:betaData.value,
          msg:"stock beta calculation success",
          status:true,
        }
      }
      catch(error){
        return {
          error:error,
          status:false,
          msg:"Stock beta calculation failed"
        }
      }
    }

    async upsertBetaWorking(payload){
      try{
        return await this.ciqSpBetaService.upsertBetaWorkingAggregate(payload);
      }
      catch(error){
        throw new HttpException(
          {
            error: error,
            status: false,
            msg: 'beta working upsertion failed',
          },
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }
    }

    async getBetaWorking(processDetails){
      try{
        return await this.ciqSpBetaService.getBetaWorkingAggregate(processDetails.processId);
      }
      catch(error){
        throw new HttpException(
          {
            error: error,
            status: false,
            msg: 'beta working upsertion failed',
          },
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }
    }

    async cloneBetaWorking(payload){
      try{
        return await this.ciqSpBetaService.cloneBetaWorkingAggregate(payload);
      }
      catch(error){
        throw new HttpException(
          {
            error: error,
            status: false,
            msg: 'beta working clone failed',
          },
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }
    }
}