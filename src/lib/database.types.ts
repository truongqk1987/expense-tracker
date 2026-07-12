// Supabase schema types.
//
// In a real project generate this with:
//   npx supabase gen types typescript --project-id <ref> > src/lib/database.types.ts
// It is hand-maintained here to mirror supabase/schema.sql so the DB and client
// stay in sync without requiring the CLI at build time.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      expenses: {
        Row: {
          id: string
          user_id: string
          amount: number
          category: string
          note: string | null
          spent_at: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          amount: number
          category: string
          note?: string | null
          spent_at?: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          amount?: number
          category?: string
          note?: string | null
          spent_at?: string
          created_at?: string
        }
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
