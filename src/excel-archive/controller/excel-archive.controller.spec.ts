import { Test, TestingModule } from '@nestjs/testing';
import { ExcelArchiveController } from './excel-archive.controller';

describe('ExcelArchiveController', () => {
  let controller: ExcelArchiveController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ExcelArchiveController],
    }).compile();

    controller = module.get<ExcelArchiveController>(ExcelArchiveController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
