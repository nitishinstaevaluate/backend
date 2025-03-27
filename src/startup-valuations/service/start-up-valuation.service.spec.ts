import { Test, TestingModule } from '@nestjs/testing';
import { StartUpValuationService } from './start-up-valuation.service';

describe('StartUpValuationService', () => {
  let service: StartUpValuationService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [StartUpValuationService],
    }).compile();

    service = module.get<StartUpValuationService>(StartUpValuationService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
