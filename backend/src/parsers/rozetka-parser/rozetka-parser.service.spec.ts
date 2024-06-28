import { Test, TestingModule } from '@nestjs/testing';
import { RozetkaParserService } from './rozetka-parser.service';

describe('RozetkaParserService', () => {
  let service: RozetkaParserService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [RozetkaParserService],
    }).compile();

    service = module.get<RozetkaParserService>(RozetkaParserService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
