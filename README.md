## Description

Build an API that scrapes information from a website and saves it in a structured format (e.g., JSON) into databaseo have a MongoDb or Mysql). The required information should contain next fields:

- Item title (String, limit 256 chars)
- Item subtitle (String/null, limit 256 chars)
- Item description (String, limit 2048 chars)
- Item price (float)
- Item specifications (String, limit 2048 chars)
- Item type (String, limit 128. Could be Phone, Computer peripheral or any other)
- Item profile image (String, limit 1024)
- Item sourse (Enum - rozetka/telemart)

Requirements:

- API must be written on Typescript and any server-side framework like an Express or Nest.js.
- For data scrapping, you can use a library like Cheerio or Puppeteer.
- Error handling for cases where the website structure changes must be included.
- Well-written Readme file (How to start, scrap and retrieve products).
- Basic linters configuration would be preferable (Eslint, Prettier).

Required websites to scrap data are:

- rozetka.com
- telemart.ua

More advanced task:

Connect your API with React. All items should be rendered (use any styling library you want, it's not really matter) in a single page. This page must have a cards with item title, image, description, price, etc... Click on the item card should redirect to the store page where the item has been retrieved.

## About

Used cheerio, nestjs, axios, typeorm, sqlite

A good idea would be to additionally use categories (in database) with statuses (e.g. isParsed), if the server restarts it doesn't need to parse everything again

## Installation

```bash
$ cd backend && npm install
```

## Running the app

Used SQLite, so you can just run the application

```bash
# development
$ npm run start

# watch mode
$ npm run start:dev

# production mode
$ npm run start:prod
```

