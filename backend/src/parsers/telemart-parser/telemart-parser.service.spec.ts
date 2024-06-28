import { Test, TestingModule } from '@nestjs/testing';
import { TelemartParserService } from './telemart-parser.service';

describe('TelemartParserService', () => {
  let service: TelemartParserService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TelemartParserService],
    }).compile();

    service = module.get<TelemartParserService>(TelemartParserService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
