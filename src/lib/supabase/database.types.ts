export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      user_settings: {
        Row: {
          accent: string
          account_scope: string
          created_at: string
          density: string
          empty_state: boolean
          theme: string
          updated_at: string
          user_id: string
        }
        Insert: {
          accent?: string
          account_scope?: string
          created_at?: string
          density?: string
          empty_state?: boolean
          theme?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          accent?: string
          account_scope?: string
          created_at?: string
          density?: string
          empty_state?: boolean
          theme?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: { [_ in never]: never }
    Functions: { [_ in never]: never }
    Enums: { [_ in never]: never }
    CompositeTypes: { [_ in never]: never }
  }
}
