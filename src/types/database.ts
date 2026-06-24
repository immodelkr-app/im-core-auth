// ============================================================
// IM-CORE-AUTH: Supabase 데이터베이스 타입 정의
// 스키마: supabase/migrations/00001_create_core_tables.sql
// ============================================================

/** 허용된 앱 식별자 */
export type AppName = "MOCA" | "IMFF";

/** 포인트 거래 유형 */
export type TransactionType = "earn" | "use";

/** 쿠폰 할인 방식 */
export type DiscountType = "percent" | "fixed";

// ============================================================
// master_users
// ============================================================
export interface MasterUser {
  id: string;
  phone_number: string;
  name: string;
  integrated_points: number;
  created_at: string;
  updated_at: string;
}

export type MasterUserInsert = Omit<MasterUser, "id" | "created_at" | "updated_at"> & {
  id?: string;
  integrated_points?: number;
};

// ============================================================
// app_user_mapping
// ============================================================
export interface AppUserMapping {
  id: string;
  master_user_id: string;
  app_name: AppName;
  local_user_id: string;
  created_at: string;
}

export type AppUserMappingInsert = Omit<AppUserMapping, "id" | "created_at"> & {
  id?: string;
};

// ============================================================
// point_transactions
// ============================================================
export interface PointTransaction {
  id: string;
  master_user_id: string;
  source_app: AppName;
  type: TransactionType;
  amount: number;
  description: string | null;
  created_at: string;
}

export type PointTransactionInsert = Omit<PointTransaction, "id" | "created_at"> & {
  id?: string;
  description?: string | null;
};

// ============================================================
// coupon_master
// ============================================================
export interface CouponMaster {
  coupon_code: string;
  coupon_name: string;
  discount_type: DiscountType;
  discount_value: number;
  validity_days: number;
  is_active: boolean;
  created_at: string;
}

// ============================================================
// user_coupons
// ============================================================
export interface UserCoupon {
  id: string;
  master_user_id: string;
  coupon_code: string;
  is_used: boolean;
  used_at: string | null;
  expires_at: string;
  created_at: string;
}

// ============================================================
// Supabase Database 타입 (createClient 제네릭용)
// ============================================================
export interface Database {
  public: {
    Tables: {
      master_users: {
        Row: MasterUser;
        Insert: MasterUserInsert;
        Update: Partial<MasterUserInsert>;
      };
      app_user_mapping: {
        Row: AppUserMapping;
        Insert: AppUserMappingInsert;
        Update: Partial<AppUserMappingInsert>;
      };
      point_transactions: {
        Row: PointTransaction;
        Insert: PointTransactionInsert;
        Update: Partial<PointTransactionInsert>;
      };
      coupon_master: {
        Row: CouponMaster;
        Insert: Omit<CouponMaster, "created_at"> & { created_at?: string };
        Update: Partial<CouponMaster>;
      };
      user_coupons: {
        Row: UserCoupon;
        Insert: Omit<UserCoupon, "id" | "created_at"> & { id?: string };
        Update: Partial<UserCoupon>;
      };
    };
  };
}
