import { Injectable, signal } from '@angular/core';
import { Product } from '../models/product.model';
import { Storage } from './storage';

const STORAGE_KEY = 'ec_products';

const SEED_PRODUCTS: Product[] = [
  {
    id: 1,
    name: 'Auriculares Inalámbricos Pro Max',
    image: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400&h=400&fit=crop',
    price: 79.99,
    originalPrice: 129.99,
    badge: { label: 'Sale', variant: 'sale' },
    rating: 4.5,
    reviewCount: 128,
    inStock: true,
    description: 'Auriculares inalámbricos con cancelación de ruido activa y 30 horas de batería.',
    category: 'Electrónica',
    stock: 24,
  },
  {
    id: 2,
    name: 'Zapatillas Running Ultra Boost',
    image: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400&h=400&fit=crop',
    price: 149.99,
    badge: { label: 'Nuevo', variant: 'new' },
    rating: 5,
    reviewCount: 43,
    inStock: true,
    description: 'Zapatillas de running con amortiguación reactiva para largas distancias.',
    category: 'Deportes',
    stock: 12,
  },
  {
    id: 3,
    name: 'Mochila Urbana Minimalista 25L',
    image: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=400&h=400&fit=crop',
    price: 59.99,
    originalPrice: 89.99,
    rating: 4,
    reviewCount: 76,
    inStock: true,
    description: 'Mochila resistente al agua con compartimento acolchado para laptop de 15".',
    category: 'Accesorios',
    stock: 30,
  },
  {
    id: 4,
    name: 'Reloj Inteligente Serie X',
    image: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400&h=400&fit=crop',
    price: 199.99,
    badge: { label: 'Destacado', variant: 'featured' },
    rating: 4.5,
    reviewCount: 201,
    inStock: false,
    description: 'Reloj inteligente con GPS, monitor de ritmo cardíaco y resistencia al agua.',
    category: 'Electrónica',
    stock: 0,
  },
  {
    id: 5,
    name: 'Campera Impermeable Trekking',
    image: 'https://images.unsplash.com/photo-1551028719-00167b16eac5?w=400&h=400&fit=crop',
    price: 89.99,
    rating: 4.2,
    reviewCount: 34,
    inStock: true,
    description: 'Campera impermeable y transpirable, ideal para trekking y montaña.',
    category: 'Ropa',
    stock: 18,
  },
  {
    id: 6,
    name: 'Lámpara de Escritorio LED',
    image: 'https://images.unsplash.com/photo-1507473885765-e6ed057f782c?w=400&h=400&fit=crop',
    price: 34.99,
    originalPrice: 49.99,
    badge: { label: 'Sale', variant: 'sale' },
    rating: 4.7,
    reviewCount: 58,
    inStock: true,
    description: 'Lámpara LED regulable con puerto USB y temperatura de color ajustable.',
    category: 'Hogar',
    stock: 40,
  },
  {
    id: 7,
    name: 'Set de Sartenes Antiadherentes',
    image: 'https://images.unsplash.com/photo-1584990347449-a5d9f800a783?w=400&h=400&fit=crop',
    price: 69.99,
    rating: 4.3,
    reviewCount: 91,
    inStock: true,
    description: 'Set de 3 sartenes antiadherentes aptas para inducción.',
    category: 'Hogar',
    stock: 15,
  },
  {
    id: 8,
    name: 'Bicicleta Urbana Plegable',
    image: 'https://images.unsplash.com/photo-1485965120184-e220f721d03e?w=400&h=400&fit=crop',
    price: 349.99,
    badge: { label: 'Destacado', variant: 'featured' },
    rating: 4.8,
    reviewCount: 22,
    inStock: true,
    description: 'Bicicleta plegable liviana ideal para combinar con transporte público.',
    category: 'Deportes',
    stock: 6,
  },
];

@Injectable({ providedIn: 'root' })
export class ProductService {
  private storage = new Storage();
  private nextId = Math.max(...SEED_PRODUCTS.map(p => Number(p.id))) + 1;

  products = signal<Product[]>(this.storage.load(STORAGE_KEY, SEED_PRODUCTS));

  constructor() {
    this.nextId = Math.max(...this.products().map(p => Number(p.id)), 0) + 1;
  }

  getById(id: number): Product | undefined {
    return this.products().find(p => Number(p.id) === id);
  }

  create(data: Omit<Product, 'id'>): Product {
    const product: Product = { ...data, id: this.nextId++ };
    this.products.update(list => [...list, product]);
    this.persist();
    return product;
  }

  update(id: number, data: Omit<Product, 'id'>): void {
    this.products.update(list =>
      list.map(p => (Number(p.id) === id ? { ...data, id } : p))
    );
    this.persist();
  }

  remove(id: number): void {
    this.products.update(list => list.filter(p => Number(p.id) !== id));
    this.persist();
  }

  private persist(): void {
    this.storage.save(STORAGE_KEY, this.products());
  }
}
