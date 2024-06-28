import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Item } from './entities/item.entity';
import { Repository } from 'typeorm';

@Injectable()
export class ItemsService {
  constructor(
    @InjectRepository(Item)
    private readonly usersRepository: Repository<Item>,
  ) {}
  private readonly logger: Logger = new Logger(ItemsService.name);

  async saveAll(items: Item[]): Promise<void> {
    await this.usersRepository.insert(items);
    this.logger.log(`Saved new items batch with ${items.length} items`);
  }

  findAll(): Promise<Item[]> {
    return this.usersRepository.find();
  }
}
