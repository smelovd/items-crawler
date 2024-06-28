import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'items' })
export class Item {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 256 })
  title: string;

  @Column({ length: 256, nullable: true })
  subtitle: string | null;

  @Column({ length: 256 })
  link: string;

  @Column({ length: 2048, nullable: true })
  description: string | null;

  @Column({ type: 'float' })
  price: number;

  @Column({ length: 2048, nullable: true })
  specifications: string | null;

  @Column({ length: 128 })
  type: string;

  @Column({ length: 1024 })
  image: string;

  @Column()
  source: string; //enum type doesn't exist in sqlite //ItemSource
}
