export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      accounts: {
        Row: {
          balance: number
          broker: string
          color: string
          created_at: string
          currency: string
          equity: number
          floating_pnl: number | null
          free_margin: number | null
          id: string
          is_default: boolean
          label: string
          margin_level: number | null
          margin_used: number | null
          status: string
          swap_total: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          balance?: number
          broker?: string
          color?: string
          created_at?: string
          currency?: string
          equity?: number
          floating_pnl?: number | null
          free_margin?: number | null
          id?: string
          is_default?: boolean
          label?: string
          margin_level?: number | null
          margin_used?: number | null
          status?: string
          swap_total?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          balance?: number
          broker?: string
          color?: string
          created_at?: string
          currency?: string
          equity?: number
          floating_pnl?: number | null
          free_margin?: number | null
          id?: string
          is_default?: boolean
          label?: string
          margin_level?: number | null
          margin_used?: number | null
          status?: string
          swap_total?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      broker_connections: {
        Row: {
          account_id: string
          created_at: string
          credentials: Json
          enabled: boolean
          external_account_id: string
          external_account_meta: Json
          id: string
          last_sync_error: string | null
          last_sync_status: string | null
          last_synced_at: string | null
          provider: string
          tokens: Json | null
          trades_synced: number
          updated_at: string
          user_id: string
        }
        Insert: {
          account_id: string
          created_at?: string
          credentials?: Json
          enabled?: boolean
          external_account_id: string
          external_account_meta?: Json
          id?: string
          last_sync_error?: string | null
          last_sync_status?: string | null
          last_synced_at?: string | null
          provider: string
          tokens?: Json | null
          trades_synced?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          account_id?: string
          created_at?: string
          credentials?: Json
          enabled?: boolean
          external_account_id?: string
          external_account_meta?: Json
          id?: string
          last_sync_error?: string | null
          last_sync_status?: string | null
          last_synced_at?: string | null
          provider?: string
          tokens?: Json | null
          trades_synced?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "broker_connections_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      economic_events: {
        Row: {
          actual: string | null
          created_at: string
          currency: string
          event: string
          forecast: string | null
          id: string
          impact: string
          previous: string | null
          scheduled_at: string
          source: string | null
        }
        Insert: {
          actual?: string | null
          created_at?: string
          currency: string
          event: string
          forecast?: string | null
          id?: string
          impact: string
          previous?: string | null
          scheduled_at: string
          source?: string | null
        }
        Update: {
          actual?: string | null
          created_at?: string
          currency?: string
          event?: string
          forecast?: string | null
          id?: string
          impact?: string
          previous?: string | null
          scheduled_at?: string
          source?: string | null
        }
        Relationships: []
      }
      goals: {
        Row: {
          created_at: string
          enabled: boolean
          id: string
          metric: string
          period: string
          target_value: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          id?: string
          metric: string
          period: string
          target_value: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          id?: string
          metric?: string
          period?: string
          target_value?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      journal_entries: {
        Row: {
          account_id: string | null
          cold_review: string | null
          created_at: string
          during_trade: Json
          id: string
          is_public: boolean
          kind: string
          last_edited_at: string
          lessons: string | null
          mistakes: string[]
          mood: string | null
          playbook_id: string | null
          post_trade: string | null
          pre_trade: string | null
          rule_break: boolean
          rule_break_tags: string[]
          screenshots: Json
          share_token: string | null
          tags: string[]
          title: string | null
          trade_id: string | null
          user_id: string
        }
        Insert: {
          account_id?: string | null
          cold_review?: string | null
          created_at?: string
          during_trade?: Json
          id?: string
          is_public?: boolean
          kind?: string
          last_edited_at?: string
          lessons?: string | null
          mistakes?: string[]
          mood?: string | null
          playbook_id?: string | null
          post_trade?: string | null
          pre_trade?: string | null
          rule_break?: boolean
          rule_break_tags?: string[]
          screenshots?: Json
          share_token?: string | null
          tags?: string[]
          title?: string | null
          trade_id?: string | null
          user_id: string
        }
        Update: {
          account_id?: string | null
          cold_review?: string | null
          created_at?: string
          during_trade?: Json
          id?: string
          is_public?: boolean
          kind?: string
          last_edited_at?: string
          lessons?: string | null
          mistakes?: string[]
          mood?: string | null
          playbook_id?: string | null
          post_trade?: string | null
          pre_trade?: string | null
          rule_break?: boolean
          rule_break_tags?: string[]
          screenshots?: Json
          share_token?: string | null
          tags?: string[]
          title?: string | null
          trade_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "journal_entries_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_entries_playbook_id_fkey"
            columns: ["playbook_id"]
            isOneToOne: false
            referencedRelation: "playbooks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_entries_trade_id_fkey"
            columns: ["trade_id"]
            isOneToOne: false
            referencedRelation: "trades"
            referencedColumns: ["id"]
          },
        ]
      }
      playbooks: {
        Row: {
          color: string
          created_at: string
          description: string | null
          icon: string
          id: string
          invalidations: string[]
          name: string
          notes: string | null
          pairs: string[]
          risk_per_trade_pct: number | null
          rules: string[]
          sessions: string[]
          status: string
          target_r: number | null
          timeframe: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          color?: string
          created_at?: string
          description?: string | null
          icon?: string
          id?: string
          invalidations?: string[]
          name: string
          notes?: string | null
          pairs?: string[]
          risk_per_trade_pct?: number | null
          rules?: string[]
          sessions?: string[]
          status?: string
          target_r?: number | null
          timeframe?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          color?: string
          created_at?: string
          description?: string | null
          icon?: string
          id?: string
          invalidations?: string[]
          name?: string
          notes?: string | null
          pairs?: string[]
          risk_per_trade_pct?: number | null
          rules?: string[]
          sessions?: string[]
          status?: string
          target_r?: number | null
          timeframe?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          last_used_at: string
          p256dh: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          last_used_at?: string
          p256dh: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          last_used_at?: string
          p256dh?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      risk_rules: {
        Row: {
          account_id: string
          created_at: string
          daily_loss_limit_pct: number | null
          daily_loss_limit_usd: number | null
          enabled: boolean
          id: string
          max_open_positions: number | null
          max_risk_per_trade_pct: number | null
          max_risk_per_trade_usd: number | null
          prop_firm_template: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          account_id: string
          created_at?: string
          daily_loss_limit_pct?: number | null
          daily_loss_limit_usd?: number | null
          enabled?: boolean
          id?: string
          max_open_positions?: number | null
          max_risk_per_trade_pct?: number | null
          max_risk_per_trade_usd?: number | null
          prop_firm_template?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          account_id?: string
          created_at?: string
          daily_loss_limit_pct?: number | null
          daily_loss_limit_usd?: number | null
          enabled?: boolean
          id?: string
          max_open_positions?: number | null
          max_risk_per_trade_pct?: number | null
          max_risk_per_trade_usd?: number | null
          prop_firm_template?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "risk_rules_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: true
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      trade_fills: {
        Row: {
          broker_comment: string | null
          commission: number | null
          created_at: string
          execution_type: string | null
          external_id: string | null
          external_provider: string | null
          filled_at: string
          id: string
          kind: string
          magic_number: string | null
          notes: string | null
          order_type: string | null
          pnl_contribution: number | null
          price: number
          r_realized: number | null
          reason: string | null
          request_price: number | null
          size: number
          swap: number | null
          tax: number | null
          trade_id: string
          user_id: string
        }
        Insert: {
          broker_comment?: string | null
          commission?: number | null
          created_at?: string
          execution_type?: string | null
          external_id?: string | null
          external_provider?: string | null
          filled_at?: string
          id?: string
          kind: string
          magic_number?: string | null
          notes?: string | null
          order_type?: string | null
          pnl_contribution?: number | null
          price: number
          r_realized?: number | null
          reason?: string | null
          request_price?: number | null
          size: number
          swap?: number | null
          tax?: number | null
          trade_id: string
          user_id: string
        }
        Update: {
          broker_comment?: string | null
          commission?: number | null
          created_at?: string
          execution_type?: string | null
          external_id?: string | null
          external_provider?: string | null
          filled_at?: string
          id?: string
          kind?: string
          magic_number?: string | null
          notes?: string | null
          order_type?: string | null
          pnl_contribution?: number | null
          price?: number
          r_realized?: number | null
          reason?: string | null
          request_price?: number | null
          size?: number
          swap?: number | null
          tax?: number | null
          trade_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trade_fills_trade_id_fkey"
            columns: ["trade_id"]
            isOneToOne: false
            referencedRelation: "trades"
            referencedColumns: ["id"]
          },
        ]
      }
      trades: {
        Row: {
          account_id: string
          cancel_reason: string | null
          cancelled_at: string | null
          closed_at: string | null
          contract_size: number
          created_at: string
          entry_price: number
          lifecycle_events: Json
          exit_price: number | null
          external_id: string | null
          external_provider: string | null
          id: string
          mood: string | null
          notes: string | null
          opened_at: string | null
          pair: string
          playbook_id: string | null
          pnl: number | null
          r: number | null
          risk_amount: number | null
          side: string
          size: number
          status: string
          stop_price: number | null
          tags: string[]
          target_price: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          account_id: string
          cancel_reason?: string | null
          cancelled_at?: string | null
          closed_at?: string | null
          contract_size?: number
          created_at?: string
          lifecycle_events?: Json
          entry_price: number
          exit_price?: number | null
          external_id?: string | null
          external_provider?: string | null
          id?: string
          mood?: string | null
          notes?: string | null
          opened_at?: string | null
          pair: string
          playbook_id?: string | null
          pnl?: number | null
          r?: number | null
          risk_amount?: number | null
          side: string
          size?: number
          status?: string
          stop_price?: number | null
          tags?: string[]
          target_price?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          account_id?: string
          cancel_reason?: string | null
          cancelled_at?: string | null
          closed_at?: string | null
          contract_size?: number
          created_at?: string
          lifecycle_events?: Json
          entry_price?: number
          exit_price?: number | null
          external_id?: string | null
          external_provider?: string | null
          id?: string
          mood?: string | null
          notes?: string | null
          opened_at?: string | null
          pair?: string
          playbook_id?: string | null
          pnl?: number | null
          r?: number | null
          risk_amount?: number | null
          side?: string
          size?: number
          status?: string
          stop_price?: number | null
          tags?: string[]
          target_price?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trades_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trades_playbook_id_fkey"
            columns: ["playbook_id"]
            isOneToOne: false
            referencedRelation: "playbooks"
            referencedColumns: ["id"]
          },
        ]
      }
      user_settings: {
        Row: {
          accent: string
          account_scope: string
          atr_multiplier: number
          atr_period: number
          avatar_url: string | null
          cap_by_prop_rule: boolean
          coach_auto_tag: boolean
          coach_cache: Json | null
          coach_use_ai: boolean
          confirm_above_pct: number
          created_at: string
          default_fixed_lots: number
          default_playbook_id: string | null
          default_risk_pct: number
          density: string
          display_currency: string
          display_name: string | null
          email_digest: string
          empty_state: boolean
          fx_rates: Json
          handle: string | null
          journal_timezone_mode: string
          kelly_fraction: number
          news_avoidance_enabled: boolean
          news_avoidance_minutes_after: number
          news_avoidance_minutes_before: number
          notify_coach: boolean
          notify_daily_dd: boolean
          notify_news: boolean
          notify_payout: boolean
          notify_rules_violation: boolean
          notify_weekly_report: boolean
          onboarded_at: string | null
          pnl_display: string
          require_journal_mood: boolean
          require_journal_note: boolean
          require_journal_screenshot: boolean
          round_lots_to: number
          sizing_method: string
          tax_carry_losses: boolean
          tax_estimated_rate: number
          tax_fiscal_year_start: string
          tax_fx_election: string
          tax_jurisdiction: string
          theme: string
          tilt_cooldown_hours: number
          tilt_cutoff: number
          tilt_enabled: boolean
          timezone: string
          updated_at: string
          user_id: string
          webhook_secret: string | null
        }
        Insert: {
          accent?: string
          account_scope?: string
          atr_multiplier?: number
          atr_period?: number
          avatar_url?: string | null
          cap_by_prop_rule?: boolean
          coach_auto_tag?: boolean
          coach_cache?: Json | null
          coach_use_ai?: boolean
          confirm_above_pct?: number
          created_at?: string
          default_fixed_lots?: number
          default_playbook_id?: string | null
          default_risk_pct?: number
          density?: string
          display_currency?: string
          display_name?: string | null
          email_digest?: string
          empty_state?: boolean
          fx_rates?: Json
          handle?: string | null
          journal_timezone_mode?: string
          kelly_fraction?: number
          news_avoidance_enabled?: boolean
          news_avoidance_minutes_after?: number
          news_avoidance_minutes_before?: number
          notify_coach?: boolean
          notify_daily_dd?: boolean
          notify_news?: boolean
          notify_payout?: boolean
          notify_rules_violation?: boolean
          notify_weekly_report?: boolean
          onboarded_at?: string | null
          pnl_display?: string
          require_journal_mood?: boolean
          require_journal_note?: boolean
          require_journal_screenshot?: boolean
          round_lots_to?: number
          sizing_method?: string
          tax_carry_losses?: boolean
          tax_estimated_rate?: number
          tax_fiscal_year_start?: string
          tax_fx_election?: string
          tax_jurisdiction?: string
          theme?: string
          tilt_cooldown_hours?: number
          tilt_cutoff?: number
          tilt_enabled?: boolean
          timezone?: string
          updated_at?: string
          user_id: string
          webhook_secret?: string | null
        }
        Update: {
          accent?: string
          account_scope?: string
          atr_multiplier?: number
          atr_period?: number
          avatar_url?: string | null
          cap_by_prop_rule?: boolean
          coach_auto_tag?: boolean
          coach_cache?: Json | null
          coach_use_ai?: boolean
          confirm_above_pct?: number
          created_at?: string
          default_fixed_lots?: number
          default_playbook_id?: string | null
          default_risk_pct?: number
          density?: string
          display_currency?: string
          display_name?: string | null
          email_digest?: string
          empty_state?: boolean
          fx_rates?: Json
          handle?: string | null
          journal_timezone_mode?: string
          kelly_fraction?: number
          news_avoidance_enabled?: boolean
          news_avoidance_minutes_after?: number
          news_avoidance_minutes_before?: number
          notify_coach?: boolean
          notify_daily_dd?: boolean
          notify_news?: boolean
          notify_payout?: boolean
          notify_rules_violation?: boolean
          notify_weekly_report?: boolean
          onboarded_at?: string | null
          pnl_display?: string
          require_journal_mood?: boolean
          require_journal_note?: boolean
          require_journal_screenshot?: boolean
          round_lots_to?: number
          sizing_method?: string
          tax_carry_losses?: boolean
          tax_estimated_rate?: number
          tax_fiscal_year_start?: string
          tax_fx_election?: string
          tax_jurisdiction?: string
          theme?: string
          tilt_cooldown_hours?: number
          tilt_cutoff?: number
          tilt_enabled?: boolean
          timezone?: string
          updated_at?: string
          user_id?: string
          webhook_secret?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_settings_default_playbook_id_fkey"
            columns: ["default_playbook_id"]
            isOneToOne: false
            referencedRelation: "playbooks"
            referencedColumns: ["id"]
          },
        ]
      }
      watchlist_pairs: {
        Row: {
          bias: string
          created_at: string
          id: string
          pair: string
          setup_note: string | null
          sort_order: number
          updated_at: string
          user_id: string
        }
        Insert: {
          bias?: string
          created_at?: string
          id?: string
          pair: string
          setup_note?: string | null
          sort_order?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          bias?: string
          created_at?: string
          id?: string
          pair?: string
          setup_note?: string | null
          sort_order?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      consume_rate_limit: {
        Args: { p_key: string; p_window_seconds: number }
        Returns: number
      }
      get_entry_by_share_token: {
        Args: { p_token: string }
        Returns: {
          cold_review: string
          created_at: string
          display_name: string
          handle: string
          id: string
          kind: string
          last_edited_at: string
          lessons: string
          mood: string
          post_trade: string
          pre_trade: string
          tags: string[]
          title: string
          trade_pair: string
          trade_pnl: number
          trade_r: number
          trade_side: string
        }[]
      }
      get_public_entries: {
        Args: { p_limit?: number; p_user_id: string }
        Returns: {
          cold_review: string
          created_at: string
          id: string
          lessons: string
          mood: string
          post_trade: string
          pre_trade: string
          tags: string[]
          title: string
          trade_pair: string
          trade_pnl: number
          trade_r: number
          trade_side: string
        }[]
      }
      get_public_profile: {
        Args: { p_handle: string }
        Returns: {
          avatar_url: string | null
          display_name: string
          handle: string
          joined_at: string
          loss_count: number
          total_pnl: number
          trade_count: number
          user_id: string
          win_count: number
        }[]
      }
      recompute_trade_aggregates: {
        Args: { p_trade_id: string }
        Returns: undefined
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
