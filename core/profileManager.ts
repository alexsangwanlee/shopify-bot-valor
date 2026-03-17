/**
 * @file core/profileManager.ts
 * @description 사용자 결제 프로필을 관리하며 암호화된 데이터베이스에 저장합니다.
 */

import { z } from 'zod';
import { EncryptedStore } from '../config/encrypted-store';
import { logger } from '../utils/logger';

// 프로필 데이터 스키마 정의
export const ProfileSchema = z.object({
  id: z.string().uuid().or(z.string()),
  name: z.string().min(1, 'Profile name is required'),
  email: z.string().email(),
  phone: z.string(),
  address: z.object({
    firstName: z.string(),
    lastName: z.string(),
    address1: z.string(),
    address2: z.string().optional(),
    city: z.string(),
    province: z.string(),
    country: z.string(),
    zip: z.string(),
  }),
  payment: z.object({
    cardHolder: z.string(),
    cardNumber: z.string().min(13).max(19),
    expiryMonth: z.string().min(2).max(2),
    expiryYear: z.string().min(2).max(4),
    cvv: z.string().min(3).max(4),
  }),
});

export type Profile = z.infer<typeof ProfileSchema>;

class ProfileManager {
  private store: EncryptedStore;

  constructor() {
    // 실제 구현에서는 사용자별 마스터 키를 사용해야 함
    this.store = new EncryptedStore('profiles.db', 'master-key-antigravity-2026');
  }

  addProfile(profile: Profile) {
    try {
      ProfileSchema.parse(profile);
      this.store.set(profile.id, profile);
      logger.info(`Profile added: ${profile.name}`);
    } catch (error: any) {
      logger.error('Failed to add profile', { error: error.message });
      throw error;
    }
  }

  getProfile(id: string): Profile | null {
    return this.store.get(id);
  }

  // ... delete, list, update 등 추가 구현 가능
}

export const profileManager = new ProfileManager();
