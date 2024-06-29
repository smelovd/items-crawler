import { Injectable, Logger } from '@nestjs/common';
import { Item } from 'src/items/entities/item.entity';
import { CheerioAPI, Element } from 'cheerio';
import { Parser } from '../parser.interface';
import { ItemSource } from 'src/items/entities/item-source.enum';
import { HttpAdapter } from '../http-adapter/http-adapter.service';
import { ItemsService } from 'src/items/items.service';
import { Category } from '../../items/dtos/category.dto';

@Injectable()
export class RozetkaParserService implements Parser {
  constructor(
    private readonly httpAdapter: HttpAdapter,
    private readonly itemsService: ItemsService,
  ) {}
  private readonly batchPageSize: number = parseInt(
    process.env.BATCH_PAGE_SIZE,
  );
  private readonly batchSize: number = parseInt(process.env.BATCH_SIZE);
  private readonly baseUrl: string = 'https://rozetka.com.ua/';
  private readonly logger: Logger = new Logger(RozetkaParserService.name);

  async startParsing(fullLoad: boolean): Promise<void> {
    this.logger.log(`Start parsing rozetka`);

    const categories: Category[] = await this.getAllCategories();
    this.logger.log(
      `Start parsing categories ${fullLoad ? `with` : `without`} full load`,
    );

    for (let i: number = 0; i < categories.length; i++) {
      await this.parseCategory(categories[i], fullLoad);
    }
  }

  private async getAllCategories(): Promise<Category[]> {
    const $: CheerioAPI = await this.httpAdapter.getCheerioApiPage(
      `${this.baseUrl}`,
    );
    const absoluteCategoriesLinks: string[] = $(
      '.menu-categories__item .menu-categories__link',
    )
      .map((_: number, element: Element) => $(element).attr('href'))
      .get();

    return (
      await Promise.all(
        absoluteCategoriesLinks.map(
          async (link: string): Promise<Category[]> => {
            const $: CheerioAPI =
              await this.httpAdapter.getCheerioApiPage(link);

            return $('.portal-grid__cell .tile-cats__heading')
              .map((_: number, element: Element): Category => {
                const link: string = $(element).attr('href');
                const title: string = $(element).text().trim();

                return {
                  link,
                  title,
                };
              })
              .get();
          },
        ),
      )
    ).flat();
  }

  private async parseCategory(
    category: Category,
    fullLoad: boolean,
  ): Promise<void> {
    this.logger.log(`Parsing category by link: ${category.link}`);
    const $: CheerioAPI = await this.httpAdapter.getCheerioApiPage(
      category.link,
    );
    const pagesCount: number = parseInt($('.pagination__link').text());

    for (let i: number = 1; i <= pagesCount; i++) {
      //TODO fix double request for first page (this + new `${link}page=1`)
      const links: string[] = [];

      for (let j: number = 0; j < this.batchSize && i <= pagesCount; j++, i++) {
        links.push(`${category.link}page=${i}`);
      }

      const itemsBatch: Item[] = (
        await Promise.all(
          links.map(
            async (link: string): Promise<Item[]> =>
              await this.getItemsFromPage(link, fullLoad, category.title),
          ),
        )
      ).flat();
      this.logger.log(
        `Parsed ${links.length} pages, ${itemsBatch.length} items`,
      );
      await this.itemsService.saveAll(itemsBatch);
    }
    this.logger.log(`Parsed category by link: ${category.link}`);
  }

  private async getItemsFromPage(
    link: string,
    fullLoad: boolean,
    categoryTitle: string,
  ): Promise<Item[]> {
    const $: CheerioAPI = await this.httpAdapter.getCheerioApiPage(link);
    const items: Item[] = this.mapItems($, categoryTitle);

    if (fullLoad) {
      await this.loadFull(items);
    }

    this.logger.log(
      `Parsed ${items.length} items ${fullLoad ? `with` : `without`} full load, page link: ${link}`,
    );
    return items;
  }

  private mapItems($: CheerioAPI, categoryTitle: string): Item[] {
    return $('.goods-tile__inner')
      .map((_: number, element: Element): Item => {
        return {
          id: null,
          title: $(element).find('.goods-tile__title').text().trim(),
          link: $(element).find('.product-link').attr('href'),
          description: null,
          price: parseFloat(
            $(element)
              .find('.goods-tile__price-value')
              .text()
              .replaceAll(/[^.\d]+/g, '')
              .replaceAll(/^([^.]*\.)|\./g, '$1'),
          ),
          specifications: null,
          type: categoryTitle,
          image: $(element).find('.goods-tile__picture img').attr('src'),
          source: ItemSource.ROZETKA.toString(),
          subtitle: null,
        };
      })
      .get();
  }

  private async loadFull(items: Item[]): Promise<void> {
    for (let i: number = 0; i < items.length; i += this.batchPageSize) {
      const itemsBatch: Item[] = items.slice(i, i + this.batchPageSize);

      await Promise.all(
        itemsBatch.map((item: Item) => {
          this.setSpecification(item);
          this.setDescriptionAndImage(item);
        }),
      );
    }
  }

  private async setDescriptionAndImage(item: Item): Promise<void> {
    const $: CheerioAPI = await this.httpAdapter.getCheerioApiPage(item.link);
    const image: string = $('.picture-container__picture').attr('src');
    const description: string = $('.product-about__description-content')
      .text()
      .trim();
    const richDescription: string[] = $('.rich-text')
      .map((_: number, element: Element) => $(element).text().trim())
      .get();

    if (image) {
      item.image = image;
    }

    if (description && description !== '') {
      item.description = description;
    } else if (richDescription.length > 0) {
      item.description = richDescription.join(' ');
    }
  }

  private async setSpecification(item: Item): Promise<void> {
    try {
      const $: CheerioAPI = await this.httpAdapter.getCheerioApiPage(
        `${item.link}characteristics/`,
      );

      const specifications = {};

      $('.item').each((_: number, element: Element) => {
        const label: string = $(element).find('.label span').text().trim();
        specifications[label] = $(element).find('.sub-list li').text().trim();
      });

      item.specifications = JSON.stringify(specifications);
    } catch (error) {
      this.logger.warn(`Request failed: ${error.message}`);
    }
  }
}
