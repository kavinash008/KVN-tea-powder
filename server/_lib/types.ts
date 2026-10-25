import { Order, CustomerUser, CustomerAddress, Product } from '../../src/types';

export interface UserDocument extends CustomerUser {
  passwordHash: string;
}

export interface StoreState {
  orders: Order[];
  users: UserDocument[];
  products: Product[];
  lastUpdated: string;
}
