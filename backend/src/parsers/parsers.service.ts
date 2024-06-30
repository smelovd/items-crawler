import { Injectable } from '@nestjs/common';
import { RozetkaParserService } from './rozetka-parser/rozetka-parser.service';
import { TelemartParserService } from './telemart-parser/telemart-parser.service';

@Injectable()
export class ParsersService {
  constructor(
    private readonly rozetkaParserService: RozetkaParserService,
    private readonly telemartParserService: TelemartParserService,
  ) {}

  onModuleInit(): void {
    // this.rozetkaParserService.startParsing(true);
    // this.telemartParserService.startParsing(true);
  }
}
