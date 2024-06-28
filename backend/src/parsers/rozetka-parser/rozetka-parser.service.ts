import { Injectable, Logger } from '@nestjs/common';
import { Item } from 'src/items/entities/item.entity';
import cheerio, { CheerioAPI, Element } from 'cheerio';
import { Parser } from '../parser.interface';
import { ItemSource } from 'src/items/entities/item-source.enum';
import { HttpAdapter } from '../http-adapter/http-adapter.service';
import { ItemsService } from 'src/items/items.service';

@Injectable()
export class RozetkaParserService implements Parser {
  constructor(
    private readonly httpAdapter: HttpAdapter,
    private readonly itemsService: ItemsService,
  ) {}
  private static readonly baseUrl: string = 'https://rozetka.com.ua/';
  private readonly logger: Logger = new Logger(RozetkaParserService.name);

  async startParsing(fullLoad: boolean): Promise<void> {
    const $: CheerioAPI = cheerio.load(
      await this.httpAdapter.getPage(`${RozetkaParserService.baseUrl}`),
    );
    const categories: string[] = this.getCategoriesLinks($);

    const allSubCategories: string[] = (
      await Promise.all(
        categories.map((link: string) => this.getSubCategoriesLinks(link)),
      )
    ).flat();
    this.logger.log(`Found all absolute categories`);
    this.logger.log(
      `Start parsing categories ${fullLoad ? `with` : `without`} full load`,
    );

    for (let i: number = 0; i < allSubCategories.length; i++) {
      await this.parseSubCategory(allSubCategories[i], fullLoad);
    }
  }

  private getCategoriesLinks($: CheerioAPI): string[] {
    return $('.menu-categories__item .menu-categories__link')
      .map((_: number, element: Element) => $(element).attr('href'))
      .get()
      .filter(Boolean);
  }

  private async getSubCategoriesLinks(link: string): Promise<string[]> {
    const $: CheerioAPI = cheerio.load(await this.httpAdapter.getPage(link));

    return $('.portal-grid__cell .tile-cats__heading')
      .map((_: number, element: Element) => $(element).attr('href'))
      .get()
      .filter(Boolean);
  }

  private async parseSubCategory(
    link: string,
    fullLoad: boolean,
  ): Promise<void> {
    this.logger.log(`Parsing category by link: ${link}`);
    const $: CheerioAPI = cheerio.load(await this.httpAdapter.getPage(link));
    const pagesCount: number = parseInt($('.pagination__link').text());

    for (let i: number = 1; i <= pagesCount; i++) {
      //TODO fix double request for first page (this + new `${link}page=${i}`)
      const links: string[] = [];

      if (fullLoad) {
        const pageItems: Item[] = await this.getItemsFromPage(
          `${link}page=${i}`,
          fullLoad,
        );
        await this.itemsService.saveAll(pageItems);
        this.logger.log(`Parsed category by link: ${link}page=${i}`);
        continue;
      }

      for (let j: number = 0; j < 10 && i <= pagesCount; j++, i++) {
        links.push(`${link}page=${i}`);
      }

      const itemsBatch: Item[] = (
        await Promise.all(
          links.map(
            async (link): Promise<Item[]> =>
              await this.getItemsFromPage(link, fullLoad),
          ),
        )
      ).flat();
      this.logger.log(
        `Parsed ${links.length} pages, ${itemsBatch.length} items`,
      );
      await this.itemsService.saveAll(itemsBatch);
    }
    this.logger.log(`Parsed category by link: ${link}`);
  }

  private async getItemsFromPage(
    link: string,
    fullLoad: boolean,
  ): Promise<Item[]> {
    const $: CheerioAPI = cheerio.load(await this.httpAdapter.getPage(link));
    const items: Item[] = this.getItems($, link);

    if (fullLoad) {
      await this.setSpecificationsAndDescriptionAndImage(items);
    }

    this.logger.log(
      `Parsed ${items.length} items ${fullLoad ? `with` : `without`} full load, page link: ${link}`,
    );
    return items;
  }

  private getItems($: CheerioAPI, link: string): Item[] {
    return $('.goods-tile__inner')
      .map((_, element) => this.mapItem($, element, link))
      .get();
  }

  private mapItem($: CheerioAPI, element: Element, link: string): Item {
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
      type: link.split('/')[4],
      image: $(element).find('.goods-tile__picture img').attr('src'),
      source: ItemSource.ROZETKA.toString(),
      subtitle: null,
    };
  }

  private async setSpecificationsAndDescriptionAndImage(
    items: Item[],
  ): Promise<void> {
    for (let i = 0; i < items.length; i += 10) {
      const itemsBatch: Item[] = items.slice(i, i + 10);

      await Promise.all(
        itemsBatch.map(async (item): Promise<void> => {
          await this.setSpecification(item);
          await this.setDescriptionAndImage(item);
        }),
      );
    }
  }

  private async setDescriptionAndImage(item: Item): Promise<void> {
    const $: CheerioAPI = cheerio.load(
      await this.httpAdapter.getPage(`${item.link}`),
    );
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
      const $: CheerioAPI = cheerio.load(
        await this.httpAdapter.getPage(`${item.link}characteristics/`),
      );

      const specifications = {};

      $('.item').each((_: number, element: Element) => {
        const label = $(element).find('.label span').text().trim();
        specifications[label] = $(element).find('.sub-list li').text().trim();
      });

      item.specifications = JSON.stringify(specifications);
    } catch (error) {
      this.logger.warn(`Request failed: ${error.message}`);
    }
  }
}
