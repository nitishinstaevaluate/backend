import { Injectable, NotFoundException } from '@nestjs/common';
import { StartupValuationDto } from '../dto/startup-valuation.dto';
import { BerkusService } from './berkus.service';
import { StartupValuationDocument } from '../schema/startup-valuation.schema';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { MODEL } from 'src/constants/constants';
import { RiskFactorService } from './risk-factor.service';
import { ScoreCardService } from './score-card.service';
import { VentureCapitalService } from './venture-capital.service';

@Injectable()
export class StartUpValuationService {

    constructor(@InjectModel('startupValuation')
    private readonly startupValuationModel: Model<StartupValuationDocument>,
    private berkusService: BerkusService,
    private riskFactorService: RiskFactorService,
    private scoreCardService: ScoreCardService,
    private ventureCapitalService: VentureCapitalService,){}

    async upsertValuation(payload){
        try{

            const pid = payload?.processStateId;

            if(!pid) throw new NotFoundException('PID not found').getResponse();

            switch(true){
                case payload.hasOwnProperty(MODEL[9]):
                    return await this.berkusService.upsert(payload);
                case payload.hasOwnProperty(MODEL[10]):
                    return await this.riskFactorService.upsert(payload);
                case payload.hasOwnProperty(MODEL[11]):
                    return await this.scoreCardService.upsert(payload);
                case payload.hasOwnProperty(MODEL[12]):
                    return await this.ventureCapitalService.upsert(payload);
                default:
                    return await this.startupValuationModel.findOne({ processStateId: pid }).lean();
            }
            
        }
        catch(error){
            throw error;
        }
    }
}
