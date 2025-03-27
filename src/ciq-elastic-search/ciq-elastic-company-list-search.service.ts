import { Injectable } from "@nestjs/common";
import { plainToClass } from "class-transformer";
import { CiqIndustryListDto, ciqUpdateCompaniesDto } from "src/ciq-sp/dto/ciq-sp.dto";
import { ElasticSearchService } from "src/elasticSearch/elastic-search-client.service";
import { convertUnixTimestampToQuarterAndYear, getFormattedProvisionalDate } from "src/excelFileServices/common.methods";
import { elasticSearchIndex } from 'src/library/enums/elastic-search-index.enum';
import { elasticSearchKey } from 'src/library/enums/elastic-search-keys.enum';

@Injectable()
export class ciqElasticCompanyListSearchService {
    simpleIndustryList=[];
    constructor(private readonly elasticSearchClientService:ElasticSearchService){}

    async fetchCompanyList(payload){
        try{
            let queryArray = [];
            let pageStart = 0, size = 10, totalListCount;

            if(payload.companyType.length){
                queryArray.push({terms: {[elasticSearchKey.COMPANYTYPEID] : payload.companyType}});
            }

            if(payload.companyStatusType.length){
                queryArray.push({terms: {[elasticSearchKey.COMPANYSTATUSTYPEID]: payload.companyStatusType}});
            }

            if(payload?.decodeIndustry?.simpleindustryid){
                queryArray.push({terms: { [elasticSearchKey.SIMPLEINDUSTRYID]: [+payload.decodeIndustry.simpleindustryid]}});
            }

            if(payload?.companyIdArray.length){
                queryArray.push({terms: {[elasticSearchKey.COMPANYID]: payload.companyIdArray}});
            }

            if(payload?.companyName){
                queryArray.push({match: {[elasticSearchKey.COMPANYNAME]: payload.companyName}});
            }

            // if(queryArray.length === 0){
            //     totalListCount = await this.elasticSearchClientService.countTotal('ciqcompanyindustryind');
            // }
            
            if(payload?.pageStart){
                pageStart = payload.pageStart;
            }

            if(payload?.size){
                size = payload.size;
            }

            queryArray.push({"exists": {"field": elasticSearchKey.SIMPLEINDUSTRYID}}); // null check filter to remove null simpleindustryid records 

            const criteria = {
                query: {
                    bool: {
                        must: queryArray
                    }
                },
                _source: {
                    includes: [elasticSearchKey.COMPANYID, elasticSearchKey.COMPANYNAME, elasticSearchKey.SIMPLEINDUSTRYID, elasticSearchKey.CITY],
                },
                from: `${pageStart}`,
                size: `${size}`,
                track_total_hits: true,
            };
            
            const ciqCompanyList = await this.elasticSearchClientService.search(elasticSearchIndex.ciqcompanyind, criteria);

            const date = payload.valuationDate;
            const companyList:any = await this.computeCompanyDetails(ciqCompanyList.data, date);
            return {
                data:companyList,
                status:true,
                msg:"ciq company list fetched",
                // listCount:totalListCount ? totalListCount.count :  companyList.total
                listCount: ciqCompanyList.total
            }
        }
        catch(error){
            return {
                error:error,
                status:false,
                msg:"company list while elastic search not found"
            }
        }
    }

    async computeCompanyDetails(companyList, date){
        try{
            let listedCompanyList = [];

            if(!this.simpleIndustryList.length){
                await this.fetchSimpleIndustry();
            }

            for await (const companyDetails of companyList) {
                for await (const simpleIndustry of this.simpleIndustryList) {
                    if (companyDetails.SIMPLEINDUSTRYID === simpleIndustry.SIMPLEINDUSTRYID) {
                        listedCompanyList.push({ ...companyDetails, SIMPLEINDUSTRYDESCRIPTION: simpleIndustry.SIMPLEINDUSTRYDESCRIPTION });
                    }
                }
            }
            const addMarketCapDetails = await this.elasticSearchMarketCap(listedCompanyList, date);
            // const addReturnOfCapitalEmployee = await this.elasticSearchReturnOfCapitalEmployee(addMarketCapDetails, date);

            const addEbitdaDetails = await this.elasticSearchEbitda(addMarketCapDetails, date);
            const addSalesDetails = await this.elasticSearchSales(addEbitdaDetails, date);

            const modifiedCompanyList = plainToClass(CiqIndustryListDto, addSalesDetails, {excludeExtraneousValues:true});
            return modifiedCompanyList;
        }
        catch(error){
            return{
                error:error,
                status:false,
                msg:"Company list computation failed"
            }
        }
    }

    async fetchSimpleIndustry(){
        try{
            const criteria = {
                query: {
                    match_all:{}
                },
                size: 10000
            };

            this.simpleIndustryList = (await this.elasticSearchClientService.search(elasticSearchIndex.ciqsimpleindustry, criteria)).data;
            return this.simpleIndustryList;
        }
        catch(error){
            return{
                error:error,
                status:false,
                msg:"elastic search simple industry failed"
            }
        }
    }

    async elasticSearchMarketCap(companyList, date){
        try{
            let companyId = [];
            let companyDetailsList = [];
            companyList.map((elements)=>{
                companyId.push(elements.COMPANYID)
            })
            // const criteria = {
            //     query:{
            //         bool :{
            //             must:[
            //                 {
            //                     terms: {
            //                         [elasticSearchKey.COMPANYID]: companyId
            //                     }
            //                 },{
            //                     term:{
            //                         [elasticSearchKey.PRICINGDATE]:`${convertUnixTimestampToQuarterAndYear(date).date.toISOString()}`
            //                     }
            //                 }
            //             ]
            //         }
            //                 //     sort : [
            //         { 
            //             [elasticSearchKey.PRICINGDATE] : {
            //                 "order" : "desc"
            //             }
            //         },
            //       ]
            // }
            const criteria = {
                query: {
                    bool: {
                        must: [
                            {
                                terms: {
                                    [elasticSearchKey.COMPANYID]: companyId
                                }
                            },{
                                term:{
                                    [elasticSearchKey.PRICINGDATE]:`${convertUnixTimestampToQuarterAndYear(date).date.toISOString()}`
                                }
                            }
                        ]
                    }
                },
                aggs: {
                    unique_company: {
                        terms: {
                            field: elasticSearchKey.COMPANYID,
                            size: 1000
                        },
                        aggs: {
                            top_company_hits: {
                                top_hits: {
                                    size: 1, // Get only the top record
                                    sort: [
                                        {
                                            [elasticSearchKey.PRICINGDATE]: {
                                                order: "desc" // Sorting by the latest date
                                            }
                                        }
                                    ]
                                }
                            }
                        }
                    }
                }
            };
            
            const companyMarketData = await this.elasticSearchClientService.search(elasticSearchIndex.ciqmarketcap, criteria);

            
            const companyMarketDetailsList = [];
            companyMarketData.aggregations.unique_company.buckets.forEach(bucket => {
                const topHit = bucket.top_company_hits.hits.hits[0]._source;
                companyMarketDetailsList.push(topHit);
            });
            for await(const individualCompanyDetails of companyList){
                let marketCapFound = false;
                for await(const individualMarketCapOfCompany of companyMarketDetailsList){
                    if(individualMarketCapOfCompany.COMPANYID === individualCompanyDetails.COMPANYID){
                        companyDetailsList.push({ ...individualCompanyDetails, ...individualMarketCapOfCompany});
                        marketCapFound = true;
                        break;
                    }
                }
                if (!marketCapFound) {
                    companyDetailsList.push({ ...individualCompanyDetails });
                }
            }
            return companyDetailsList;
        }

        catch(error){
            return {
                error:error,
                status:false,
                msg:"Market Cap search failed"
            }
        }
    }

    async elasticSearchReturnOfCapitalEmployee(companyList, date){
        try{
            let companyId = [];
            let companyDetailsList = [];
            companyList.map((elements)=>{
                companyId.push(elements.COMPANYID)
            })
            const criteria = {
                query:{
                    bool :{
                        must:[
                            {
                                terms: {
                                    [elasticSearchKey.COMPANYID]: companyId
                                }
                            },
                            // {
                            //     term:{
                            //         [elasticSearchKey.CALENDARYEAR]:`${convertUnixTimestampToQuarterAndYear(date).year}`
                            //     }
                            // },
                            // {
                            //     term:{
                            //         [elasticSearchKey.CALENDARQUARTER]:`${convertUnixTimestampToQuarterAndYear(date).quarter}`
                            //     }
                            // },
                            {
                                range: {
                                    [elasticSearchKey.PERIODENDDATE]: {
                                    lte: `${convertUnixTimestampToQuarterAndYear(date).date.toISOString()}`
                                  }
                                }
                            },
                            {
                                term:{
                                    [elasticSearchKey.DATAITEMID]:'4363' //using Return of capital employee code
                                }
                            },
                            {
                                term: {
                                    [elasticSearchKey.PERIODTYPEID]: '4'
                                }
                            },
                        ]
                    }
                },
                sort : [
                    { 
                        [elasticSearchKey.PERIODENDDATE] : {
                            "order" : "desc"
                        }
                    },
                  ]
            }
            const companyEbitdaData = await this.elasticSearchClientService.search(elasticSearchIndex.ciqlatestinstancefinperiodind, criteria);

            for await(const individualCompanyDetails of companyList){
                let returnOfCapitalEmployeeFound = false;
                for await(const individualRoceOfCompany of companyEbitdaData.data){
                    if(individualRoceOfCompany.COMPANYID === individualCompanyDetails.COMPANYID){
                        const ebidaValue = { ROCE: individualRoceOfCompany.DATAITEMVALUE};
                        companyDetailsList.push({ ...individualCompanyDetails, ...ebidaValue});
                        returnOfCapitalEmployeeFound = true;
                        break;
                    }
                }
                if (!returnOfCapitalEmployeeFound) {
                    companyDetailsList.push({ ...individualCompanyDetails });
                }
            }
            console.log(companyDetailsList,"company details")
            return companyDetailsList;
        }

        catch(error){
            return {
                error:error,
                status:false,
                msg:"Return search failed"
            }
        }
    }

    async elasticSearchEbitda(companyList, date){
        try{
            let companyId = [];
            let companyDetailsList = [];
            companyList.map((elements)=>{
                companyId.push(elements.COMPANYID)
            })
            const criteria = {
                query:{
                    bool :{
                        must:[
                            {
                                terms: {
                                    [elasticSearchKey.COMPANYID]: companyId
                                }
                            },
                            // {
                            //     term:{
                            //         [elasticSearchKey.CALENDARYEAR]:`${convertUnixTimestampToQuarterAndYear(date).year}`
                            //     }
                            // },
                            // {
                            //     term:{
                            //         [elasticSearchKey.CALENDARQUARTER]:`${convertUnixTimestampToQuarterAndYear(date).quarter}`
                            //     }
                            // },
                            {
                                range: {
                                    [elasticSearchKey.PERIODENDDATE]: {
                                    lte: `${convertUnixTimestampToQuarterAndYear(date).date.toISOString()}`
                                  }
                                }
                            },
                            {
                                term:{
                                    [elasticSearchKey.DATAITEMID]:'4047' //using EBITDA Margin code for getting ebitda
                                }
                            },
                            {
                                term: {
                                    [elasticSearchKey.PERIODTYPEID]: '4'
                                }
                            },
                        ]
                    }
                },
                sort : [
                    { 
                        [elasticSearchKey.PERIODENDDATE] : {
                            "order" : "desc"
                        }
                    },
                  ]
            }
            const companyEbitdaData = await this.elasticSearchClientService.search(elasticSearchIndex.ciqlatestinstancefinperiodind, criteria);

            for await(const individualCompanyDetails of companyList){
                let ebitdaFound = false;
                for await(const individualEbitdaOfCompany of companyEbitdaData.data){
                    if(individualEbitdaOfCompany.COMPANYID === individualCompanyDetails.COMPANYID){
                        const ebidaValue = { EBITDAVALUE: individualEbitdaOfCompany.DATAITEMVALUE};
                        companyDetailsList.push({ ...individualCompanyDetails, ...ebidaValue});
                        ebitdaFound = true;
                        break;
                    }
                }
                if (!ebitdaFound) {
                    companyDetailsList.push({ ...individualCompanyDetails });
                }
            }
            return companyDetailsList;
        }

        catch(error){
            console.log(error,"error")
            return {
                error:error,
                status:false,
                msg:"Ebit da search failed"
            }
        }
    }
    async elasticSearchSales(companyList, date){
        try{
            let companyId = [];
            let companyDetailsList = [];
            companyList.map((elements)=>{
                companyId.push(elements.COMPANYID)
            })
            const criteria = {
                query:{
                    bool :{
                        must:[
                            {
                                terms: {
                                    [elasticSearchKey.COMPANYID]: companyId
                                }
                            },
                            // {
                            //     term:{
                            //         [elasticSearchKey.CALENDARYEAR]:`${convertUnixTimestampToQuarterAndYear(date).year}`
                            //     }
                            // },
                            {
                                range: {
                                    [elasticSearchKey.PERIODENDDATE]: {
                                    lte: `${convertUnixTimestampToQuarterAndYear(date).date.toISOString()}`
                                  }
                                }
                            },
                            // {
                            //     term:{
                            //         [elasticSearchKey.CALENDARQUARTER]:`${convertUnixTimestampToQuarterAndYear(date).quarter}`
                            //     }
                            // },
                            {
                                term:{
                                    [elasticSearchKey.DATAITEMID]:'300' //using Sales code for getting sales
                                }
                            },
                            {
                                term: {
                                    [elasticSearchKey.PERIODTYPEID]: '4'
                                }
                            },
                        ]
                    }
                },
                sort : [
                    { 
                        [elasticSearchKey.PERIODENDDATE] : {
                            "order" : "desc"
                        }
                    },
                  ]
            }
            const companySalesData = await this.elasticSearchClientService.search(elasticSearchIndex.ciqlatestinstancefinperiodind, criteria);

            for await(const individualCompanyDetails of companyList){
                let salesFound = false;
                for await(const individualSalesOfCompany of companySalesData.data){
                    if(individualSalesOfCompany.COMPANYID === individualCompanyDetails.COMPANYID){ 
                        const salesValue = { SALESVALUE: individualSalesOfCompany.DATAITEMVALUE};
                        companyDetailsList.push({ ...individualCompanyDetails, ...salesValue});
                        salesFound = true;
                        break;
                    }
                }
                if (!salesFound) {
                    companyDetailsList.push({ ...individualCompanyDetails });
                }
            }
            return companyDetailsList;
        }

        catch(error){
            console.log(error,"error")
            return {
                error:error,
                status:false,
                msg:"Sales search failed"
            }
        }
    }

    async updateCompaniesAggregate(body: ciqUpdateCompaniesDto){
        try{
            const valuationDate = body.valuationDate;
            const companyList = body.industryAggregateList;

            const addMarketCapDetails = await this.elasticSearchMarketCap(companyList, valuationDate);
            const addEbitdaDetails = await this.elasticSearchEbitda(addMarketCapDetails, valuationDate);
            const addSalesDetails = await this.elasticSearchSales(addEbitdaDetails, valuationDate);

            const mapToClass = plainToClass(CiqIndustryListDto, addSalesDetails, {excludeExtraneousValues:true});
            return mapToClass;
        }
        catch(error){
            return {
                error:error,
                status:false,
                msg:"elastic search update companies failed"
            }
        }
    }
}