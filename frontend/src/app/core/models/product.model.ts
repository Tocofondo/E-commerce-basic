import { ProductCard } from '../../design-system/index';

export interface Product extends ProductCard {
  description: string;
  category: string;
  stock: number;
}
