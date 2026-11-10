import { Order, CustomerUser, Product, Category } from '../../src/types';
import { WebhookOutboxRecord } from './webhook';

export interface UserDocument extends CustomerUser {
  passwordHash?: string;
}

export interface StoreState {
  orders: Order[];
  users: UserDocument[];
  products: Product[];
  categories?: Category[];
  webhookEvents?: WebhookOutboxRecord[];
  lastUpdated: string;
}
