import { Order, CustomerUser, Product } from '../../src/types';
import { WebhookOutboxRecord } from './webhook';

export interface UserDocument extends CustomerUser {
  passwordHash: string;
}

export interface StoreState {
  orders: Order[];
  users: UserDocument[];
  products: Product[];
  webhookEvents?: WebhookOutboxRecord[];
  lastUpdated: string;
}
