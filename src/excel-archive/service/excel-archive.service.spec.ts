import { Test, TestingModule } from '@nestjs/testing';
import { ExcelArchiveService } from './excel-archive.service';

describe('ExcelArchiveService', () => {
  let service: ExcelArchiveService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ExcelArchiveService],
    }).compile();

    service = module.get<ExcelArchiveService>(ExcelArchiveService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
