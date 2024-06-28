import { Test, TestingModule } from '@nestjs/testing';
import { HttpAdapter } from './http-adapter.service';

describe('HttpAdapterService', () => {
  let service: HttpAdapter;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [HttpAdapter],
    }).compile();

    service = module.get<HttpAdapter>(HttpAdapter);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
