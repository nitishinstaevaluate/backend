import { Test, TestingModule } from '@nestjs/testing';
import { StartUpValuationController } from './start-up-valuation.controller';

describe('StartUpValuationController', () => {
  let controller: StartUpValuationController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [StartUpValuationController],
    }).compile();

    controller = module.get<StartUpValuationController>(StartUpValuationController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
