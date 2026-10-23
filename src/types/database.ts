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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      companies: {
        Row: {
          capital: number | null
          code: string
          full_name: string | null
          industry: string | null
          is_active: boolean
          listed_at: string | null
          market: string
          name: string
          report_type: string | null
          shares_outstanding: number | null
          updated_at: string
        }
        Insert: {
          capital?: number | null
          code: string
          full_name?: string | null
          industry?: string | null
          is_active?: boolean
          listed_at?: string | null
          market: string
          name: string
          report_type?: string | null
          shares_outstanding?: number | null
          updated_at?: string
        }
        Update: {
          capital?: number | null
          code?: string
          full_name?: string | null
          industry?: string | null
          is_active?: boolean
          listed_at?: string | null
          market?: string
          name?: string
          report_type?: string | null
          shares_outstanding?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      daily_valuation: {
        Row: {
          block_trade_value: number | null
          block_volume: number | null
          change: number | null
          close: number | null
          code: string
          dividend_yield: number | null
          odd_trade_value: number | null
          odd_volume: number | null
          pb: number | null
          pe: number | null
          source: string | null
          trade_date: string
          trade_value: number | null
          volume: number | null
        }
        Insert: {
          block_trade_value?: number | null
          block_volume?: number | null
          change?: number | null
          close?: number | null
          code: string
          dividend_yield?: number | null
          odd_trade_value?: number | null
          odd_volume?: number | null
          pb?: number | null
          pe?: number | null
          source?: string | null
          trade_date: string
          trade_value?: number | null
          volume?: number | null
        }
        Update: {
          block_trade_value?: number | null
          block_volume?: number | null
          change?: number | null
          close?: number | null
          code?: string
          dividend_yield?: number | null
          odd_trade_value?: number | null
          odd_volume?: number | null
          pb?: number | null
          pe?: number | null
          source?: string | null
          trade_date?: string
          trade_value?: number | null
          volume?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "daily_valuation_code_fkey"
            columns: ["code"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["code"]
          },
        ]
      }
      data_freshness: {
        Row: {
          as_of: string
          finished_at: string
          job: string
        }
        Insert: {
          as_of: string
          finished_at?: string
          job: string
        }
        Update: {
          as_of?: string
          finished_at?: string
          job?: string
        }
        Relationships: []
      }
      dividends: {
        Row: {
          board_date: string | null
          cash_dividend: number | null
          code: string
          fiscal_year: number
          period: string
          stock_dividend: number | null
        }
        Insert: {
          board_date?: string | null
          cash_dividend?: number | null
          code: string
          fiscal_year: number
          period: string
          stock_dividend?: number | null
        }
        Update: {
          board_date?: string | null
          cash_dividend?: number | null
          code?: string
          fiscal_year?: number
          period?: string
          stock_dividend?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "dividends_code_fkey"
            columns: ["code"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["code"]
          },
        ]
      }
      etl_runs: {
        Row: {
          details: Json
          error: string | null
          finished_at: string | null
          id: number
          job: string
          rows_written: number | null
          started_at: string
          status: string
        }
        Insert: {
          details?: Json
          error?: string | null
          finished_at?: string | null
          id?: never
          job: string
          rows_written?: number | null
          started_at?: string
          status?: string
        }
        Update: {
          details?: Json
          error?: string | null
          finished_at?: string | null
          id?: never
          job?: string
          rows_written?: number | null
          started_at?: string
          status?: string
        }
        Relationships: []
      }
      financials_quarterly: {
        Row: {
          book_value_per_share: number | null
          code: string
          current_assets: number | null
          current_liabilities: number | null
          eps: number | null
          equity: number | null
          equity_parent: number | null
          gross_profit: number | null
          net_income: number | null
          net_income_parent: number | null
          operating_cash_flow: number | null
          operating_income: number | null
          pretax_income: number | null
          quarter: number
          report_type: string | null
          revenue: number | null
          total_assets: number | null
          total_liabilities: number | null
          updated_at: string
          year: number
        }
        Insert: {
          book_value_per_share?: number | null
          code: string
          current_assets?: number | null
          current_liabilities?: number | null
          eps?: number | null
          equity?: number | null
          equity_parent?: number | null
          gross_profit?: number | null
          net_income?: number | null
          net_income_parent?: number | null
          operating_cash_flow?: number | null
          operating_income?: number | null
          pretax_income?: number | null
          quarter: number
          report_type?: string | null
          revenue?: number | null
          total_assets?: number | null
          total_liabilities?: number | null
          updated_at?: string
          year: number
        }
        Update: {
          book_value_per_share?: number | null
          code?: string
          current_assets?: number | null
          current_liabilities?: number | null
          eps?: number | null
          equity?: number | null
          equity_parent?: number | null
          gross_profit?: number | null
          net_income?: number | null
          net_income_parent?: number | null
          operating_cash_flow?: number | null
          operating_income?: number | null
          pretax_income?: number | null
          quarter?: number
          report_type?: string | null
          revenue?: number | null
          total_assets?: number | null
          total_liabilities?: number | null
          updated_at?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "financials_quarterly_code_fkey"
            columns: ["code"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["code"]
          },
        ]
      }
      monthly_revenue: {
        Row: {
          code: string
          cum_revenue: number | null
          cum_yoy: number | null
          mom: number | null
          month: number
          note: string | null
          revenue: number | null
          revenue_last_year: number | null
          year: number
          yoy: number | null
        }
        Insert: {
          code: string
          cum_revenue?: number | null
          cum_yoy?: number | null
          mom?: number | null
          month: number
          note?: string | null
          revenue?: number | null
          revenue_last_year?: number | null
          year: number
          yoy?: number | null
        }
        Update: {
          code?: string
          cum_revenue?: number | null
          cum_yoy?: number | null
          mom?: number | null
          month?: number
          note?: string | null
          revenue?: number | null
          revenue_last_year?: number | null
          year?: number
          yoy?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "monthly_revenue_code_fkey"
            columns: ["code"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["code"]
          },
        ]
      }
      screen_snapshot: {
        Row: {
          avg_volume_20d: number | null
          cash_dividend_avg_5y: number | null
          cash_dividend_latest: number | null
          change: number | null
          change_pct: number | null
          close: number | null
          code: string
          current_ratio: number | null
          debt_ratio: number | null
          dividend_streak_years: number | null
          dividend_yield: number | null
          eps_growth_quarters: number | null
          eps_ttm: number | null
          eps_yoy: number | null
          financial_period: string | null
          gross_margin: number | null
          industry: string | null
          market: string
          market_cap: number | null
          name: string
          net_margin: number | null
          operating_margin: number | null
          pb: number | null
          pe: number | null
          price_date: string | null
          revenue_cum_yoy: number | null
          revenue_growth_months: number | null
          revenue_mom: number | null
          revenue_period: string | null
          revenue_yoy: number | null
          revenue_yoy_3m: number | null
          roa_ttm: number | null
          roe_ttm: number | null
          trade_value: number | null
          updated_at: string
          volume: number | null
        }
        Insert: {
          avg_volume_20d?: number | null
          cash_dividend_avg_5y?: number | null
          cash_dividend_latest?: number | null
          change?: number | null
          change_pct?: number | null
          close?: number | null
          code: string
          current_ratio?: number | null
          debt_ratio?: number | null
          dividend_streak_years?: number | null
          dividend_yield?: number | null
          eps_growth_quarters?: number | null
          eps_ttm?: number | null
          eps_yoy?: number | null
          financial_period?: string | null
          gross_margin?: number | null
          industry?: string | null
          market: string
          market_cap?: number | null
          name: string
          net_margin?: number | null
          operating_margin?: number | null
          pb?: number | null
          pe?: number | null
          price_date?: string | null
          revenue_cum_yoy?: number | null
          revenue_growth_months?: number | null
          revenue_mom?: number | null
          revenue_period?: string | null
          revenue_yoy?: number | null
          revenue_yoy_3m?: number | null
          roa_ttm?: number | null
          roe_ttm?: number | null
          trade_value?: number | null
          updated_at?: string
          volume?: number | null
        }
        Update: {
          avg_volume_20d?: number | null
          cash_dividend_avg_5y?: number | null
          cash_dividend_latest?: number | null
          change?: number | null
          change_pct?: number | null
          close?: number | null
          code?: string
          current_ratio?: number | null
          debt_ratio?: number | null
          dividend_streak_years?: number | null
          dividend_yield?: number | null
          eps_growth_quarters?: number | null
          eps_ttm?: number | null
          eps_yoy?: number | null
          financial_period?: string | null
          gross_margin?: number | null
          industry?: string | null
          market?: string
          market_cap?: number | null
          name?: string
          net_margin?: number | null
          operating_margin?: number | null
          pb?: number | null
          pe?: number | null
          price_date?: string | null
          revenue_cum_yoy?: number | null
          revenue_growth_months?: number | null
          revenue_mom?: number | null
          revenue_period?: string | null
          revenue_yoy?: number | null
          revenue_yoy_3m?: number | null
          roa_ttm?: number | null
          roe_ttm?: number | null
          trade_value?: number | null
          updated_at?: string
          volume?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "screen_snapshot_code_fkey"
            columns: ["code"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["code"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
