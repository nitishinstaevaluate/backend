import { Injectable } from "@nestjs/common";
import { plainToClass } from "class-transformer";
import { ElasticSearchService } from "src/elasticSearch/elastic-search-client.service";
import { CiqPriceEquityDto } from "./dto/ciq-elastic-search.dto";
import { elasticSearchKey } from "src/library/enums/elastic-search-keys.enum";
import { elasticSearchIndex } from "src/library/enums/elastic-search-index.enum";

@Injectable()
export class ciqElasticPriceEquityService {
    constructor(private readonly elasticSearchClientService:ElasticSearchService){}

    async calculatePriceEquityAggregate(body:any){
        try{
            const companyId = body.companyDetails.companyId;
            const date = body.companyDetails.date;
            const exchangeId = body.companyDetails.exchangeId;
            const criteria = {
              query: {
                bool: {
                  must: [
                          {
                            range: {
                              [elasticSearchKey.PRICINGDATE]: {
                                "lt": date
                              }
                            }
                          },
                          {
                            term: {
                              [elasticSearchKey.COMPANYID]: companyId
                            }
                          },
                          {
                            term: {
                              [elasticSearchKey.EXCHANGEID]: exchangeId || 161 //Default for NSEI 
                            }
                          }
                        ]
                      }
                    },
                    // sort: [
                    //   {
                    //     [elasticSearchKey.PRICINGDATE]: {
                    //       "order": "desc"
                    //     }
                    //   }
                    // ],
                    // size: 90,

                    /* 
                    * Since ciqpriceequity index has duplicate records [contains same records with same pricingdate]
                    * As an alternative, create aggregations
                    */
                    aggs: {   // First Aggregation
                      /*
                      * Creates buckets with unique Docs based on PRICINGDATE
                      * Note:[Each Bucket can also contain multiple records if it has same PRICINGDATE]
                      * To tackle this, use inner aggregation grouping clause
                      */
                      GROUP_BY_PRICINGDATE: {    
                        terms: {
                          field: elasticSearchKey.PRICINGDATE,
                          size: 90,
                          order: {
                            _key: "desc"
                          }
                        },

                        aggs: {   // Second Aggregation
                          /*
                          * Now from every bucket, only select the top document by using PRICINGDATE filter [**only recent one]
                          * This group only stores the top value and excludes duplicate
                          */
                          ONLY_TOP_DOC_BY_PRICINGDATE: {
                            top_hits: {
                              size: 1,
                              sort: [
                                {
                                  [elasticSearchKey.PRICINGDATE]: {
                                    order: "desc"
                                  }
                                }
                              ]
                            }
                          }
                        }
                      }
                    },
                  }
            
                  const companyData = await this.elasticSearchClientService.search(elasticSearchIndex.ciqpriceequity, criteria);
                  const groupByPricingDate = companyData.aggregations?.GROUP_BY_PRICINGDATE;

                  let pricingBucketES = [];
                  for await(const pricingBuckets of groupByPricingDate.buckets){
                    // Pushing the individual inner aggregated document from the nested inner group
                    pricingBucketES.push(pricingBuckets.ONLY_TOP_DOC_BY_PRICINGDATE.hits.hits[0]._source);
                  }

                  const priceEquityDetails:any = plainToClass(CiqPriceEquityDto, pricingBucketES, {excludeExtraneousValues:true});

                  let modifiedPriceEquityDetails = priceEquityDetails.map((elements,index)=>{
                    return {
                        SERIALNO:index + 1,
                        ...elements
                    }
                  })

                  return {
                    data:modifiedPriceEquityDetails,
                    total:modifiedPriceEquityDetails.length,
                    status:true
                  }
        }
        catch(error){
            return{
                error:error,
                status:false,
                msg:"price equity aggregate calculation failed"
            }
        }
    }
}