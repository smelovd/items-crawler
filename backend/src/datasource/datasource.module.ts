import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Item } from '../items/entities/item.entity';

@Global()
@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'sqlite',
      database: 'database.db',
      // type: 'mysql',
      // host: 'localhost',
      // port: 3306,
      // username: 'user',
      // password: 'password',
      // database: 'test',
      synchronize: true,
      entities: [`${__dirname}/../**/**.entity{.ts,.js}`],
    }),
    TypeOrmModule.forFeature([Item]),
  ],
  exports: [TypeOrmModule],
})
export class DatasourceModule {}
