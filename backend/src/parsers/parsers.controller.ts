import { Controller, Get, Query } from '@nestjs/common';
import { RozetkaParserService } from './rozetka-parser/rozetka-parser.service';
import { TelemartParserService } from './telemart-parser/telemart-parser.service';

@Controller('parsers')
export class ParsersController {
  constructor(
    private readonly telemartParserService: TelemartParserService,
    private readonly rozetkaParserService: RozetkaParserService,
  ) {}

  @Get('rozetka')
  rozetkaParserStart(@Query('fullLoad') fullLoad: boolean): void {
    this.rozetkaParserService.startParsing(fullLoad);
  }

  @Get('telemart')
  telemartParserStart(@Query('fullLoad') fullLoad: boolean): void {
    this.telemartParserService.startParsing(fullLoad);
  }
}
