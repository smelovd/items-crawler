import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Item } from './entities/item.entity';
import { Repository } from 'typeorm';

@Injectable()
export class ItemsService {
  private readonly logger: Logger = new Logger(ItemsService.name);

  constructor(
    @InjectRepository(Item)
    private readonly usersRepository: Repository<Item>,
  ) {}

  async saveAll(items: Item[]): Promise<void> {
    await this.usersRepository.insert(items);
    this.logger.log(`Saved new items batch with ${items.length} items`);
  }

  async findAllPaginate(currentPage: number, countPerPage: number) {
    const skip: number = (currentPage - 1) * countPerPage;
    const [result, total]: [Item[], number] =
      await this.usersRepository.findAndCount({
        skip: skip,
        take: countPerPage,
      });
    const totalPages: number = Math.ceil(total / countPerPage);

    if (currentPage > totalPages) {
      throw new BadRequestException("Page doesn't exist");
    }

    return {
      content: result,
      meta: {
        countPerPage: countPerPage,
        currentPage: currentPage,
        totalPages: totalPages,
      },
    };
  }
}
