import { Controller, Get } from '@nestjs/common';
import { ItemsService } from './items.service';
import { Item } from './entities/item.entity';

@Controller('items')
export class ItemsController {
  constructor(private readonly itemsService: ItemsService) {}

  @Get()
  findAll(): Promise<Item[]> {
    return this.itemsService.findAll();
  }
}
