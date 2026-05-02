export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: { PostgrestVersion: "14.5" }
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
          id: string
          is_default: boolean
          label: string
          status: string
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
          id?: string
          is_default?: boolean
          label?: string
          status?: string
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
          id?: string
          is_default?: boolean
          label?: string
          status?: string
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
          { foreignKeyName: "broker_connections_account_id_fkey"; columns: ["account_id"]; isOneToOne: false; referencedRelation: "accounts"; referencedColumns: ["id"] }
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
      journal_entries: {
        Row: {
          account_id: string | null
          cold_review: string | null
          created_at: string
          during_trade: Json
          id: string
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
          tags?: string[]
          title?: string | null
          trade_id?: string | null
          user_id?: string
        }
        Relationships: [
          { foreignKeyName: "journal_entries_account_id_fkey"; columns: ["account_id"]; isOneToOne: false; referencedRelation: "accounts"; referencedColumns: ["id"] },
          { foreignKeyName: "journal_entries_playbook_id_fkey"; columns: ["playbook_id"]; isOneToOne: false; referencedRelation: "playbooks"; referencedColumns: ["id"] },
          { foreignKeyName: "journal_entries_trade_id_fkey"; columns: ["trade_id"]; isOneToOne: false; referencedRelation: "trades"; referencedColumns: ["id"] }
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
          { foreignKeyName: "risk_rules_account_id_fkey"; columns: ["account_id"]; isOneToOne: true; referencedRelation: "accounts"; referencedColumns: ["id"] }
        ]
      }
      trade_fills: {
        Row: {
          created_at: string
          external_id: string | null
          external_provider: string | null
          filled_at: string
          id: string
          kind: string
          notes: string | null
          pnl_contribution: number | null
          price: number
          r_realized: number | null
          reason: string | null
          size: number
          trade_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          external_id?: string | null
          external_provider?: string | null
          filled_at?: string
          id?: string
          kind: string
          notes?: string | null
          pnl_contribution?: number | null
          price: number
          r_realized?: number | null
          reason?: string | null
          size: number
          trade_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          external_id?: string | null
          external_provider?: string | null
          filled_at?: string
          id?: string
          kind?: string
          notes?: string | null
          pnl_contribution?: number | null
          price?: number
          r_realized?: number | null
          reason?: string | null
          size?: number
          trade_id?: string
          user_id?: string
        }
        Relationships: [
          { foreignKeyName: "trade_fills_trade_id_fkey"; columns: ["trade_id"]; isOneToOne: false; referencedRelation: "trades"; referencedColumns: ["id"] }
        ]
      }
      trades: {
        Row: {
          account_id: string
          cancel_reason: string | null
          cancelled_at: string | null
          closed_at: string | null
          created_at: string
          entry_price: number
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
          created_at?: string
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
          created_at?: string
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
          { foreignKeyName: "trades_account_id_fkey"; columns: ["account_id"]; isOneToOne: false; referencedRelation: "accounts"; referencedColumns: ["id"] },
          { foreignKeyName: "trades_playbook_id_fkey"; columns: ["playbook_id"]; isOneToOne: false; referencedRelation: "playbooks"; referencedColumns: ["id"] }
        ]
      }
      user_settings: {
        Row: {
          accent: string
          account_scope: string
          atr_multiplier: number
          atr_period: number
          cap_by_prop_rule: boolean
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
          cap_by_prop_rule?: boolean
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
          cap_by_prop_rule?: boolean
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
          { foreignKeyName: "user_settings_default_playbook_id_fkey"; columns: ["default_playbook_id"]; isOneToOne: false; referencedRelation: "playbooks"; referencedColumns: ["id"] }
        ]
      }
    }
    Views: { [_ in never]: never }
    Functions: {
      recompute_trade_aggregates: {
        Args: { p_trade_id: string }
        Returns: undefined
      }
    }
    Enums: { [_ in never]: never }
    CompositeTypes: { [_ in never]: never }
  }
}
