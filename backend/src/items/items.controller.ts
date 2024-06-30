import { Controller, Get, Query } from '@nestjs/common';
import { ItemsService } from './items.service';
import { PaginateResponse } from '../models/responses/paginate.response';
import { Item } from './entities/item.entity';
import { PaginateRequest } from '../models/requests/paginate.request';

@Controller('items')
export class ItemsController {
  constructor(private readonly itemsService: ItemsService) {}

  @Get()
  findAllPaginate(
    @Query() request: PaginateRequest,
  ): Promise<PaginateResponse<Item>> {
    return this.itemsService.findAllPaginate(request.page || 1, request.count || 10);
  }
}
