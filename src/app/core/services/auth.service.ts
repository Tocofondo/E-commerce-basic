import { Injectable, computed, signal } from '@angular/core';
import { User } from '../models/user.model';
import { Storage } from './storage';

const STORAGE_KEY = 'ec_session';

interface MockAccount extends User {
  password: string;
}

const MOCK_ACCOUNTS: MockAccount[] = [
  { id: 1, name: 'Admin Demo', email: 'admin@demo.com', password: 'admin', role: 'admin' },
  { id: 2, name: 'Cliente Demo', email: 'cliente@demo.com', password: 'cliente', role: 'customer' },
];

@Injectable({ providedIn: 'root' })
export class AuthService {
  private storage = new Storage();

  currentUser = signal<User | null>(this.storage.load<User | null>(STORAGE_KEY, null));
  isLoggedIn = computed(() => this.currentUser() !== null);
  isAdmin = computed(() => this.currentUser()?.role === 'admin');

  login(email: string, password: string): boolean {
    const account = MOCK_ACCOUNTS.find(
      a => a.email.toLowerCase() === email.toLowerCase() && a.password === password
    );
    if (!account) return false;

    const { password: _password, ...user } = account;
    this.currentUser.set(user);
    this.storage.save(STORAGE_KEY, user);
    return true;
  }

  logout(): void {
    this.currentUser.set(null);
    this.storage.save(STORAGE_KEY, null);
  }
}
