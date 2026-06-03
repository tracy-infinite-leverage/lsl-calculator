// Auto-generated Supabase types — DO NOT EDIT BY HAND.
//
// Generated via `mcp__supabase__generate_typescript_types` against the
// E5.3 Phase 1 Supabase branch `oahgcmqlqdfeqfibsfej` on 2026-06-02.
//
// To regenerate after a schema migration:
//   1. Apply the migration to the relevant Supabase branch.
//   2. Verify advisors clean (security + performance).
//   3. Call mcp__supabase__generate_typescript_types(project_id=<branch_ref>).
//   4. Paste the result into this file (preserving this header comment).
//   5. Commit alongside the migration.
//
// Tables covered (E5.1 + E5.2 + E5.3 Phase 1):
//   - organisations (with E5.3 llm_assist_enabled column)
//   - org_members
//   - auth_audit_log
//   - employees
//   - employee_history
//   - tags
//   - pay_code_mappings              [E5.3 v0.2 Phase 1]
//   - pay_code_mapping_versions      [E5.3 v0.2 Phase 1]
//   - pay_code_aliases               [E5.3 v0.2 Phase 1]
//   - value_normalisation_aliases    [E5.3 v0.2 Phase 1]
//   - value_normalisation_aliases_versions [E5.3 v0.2 Phase 1]
//
// Convenience aliases re-exported at the bottom of this file for ergonomic
// imports across `website/src/lib/`:
//   - MappingRow, MappingVersionRow, ValueNormaliseAliasRow

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
      auth_audit_log: {
        Row: {
          created_at: string
          event_type: string
          id: string
          ip: unknown
          metadata: Json | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          ip?: unknown
          metadata?: Json | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          ip?: unknown
          metadata?: Json | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      employee_history: {
        Row: {
          change_reason: string | null
          classification: string | null
          created_at: string
          created_by: string
          default_work_jurisdiction: string | null
          effective_from: string
          effective_to: string | null
          employee_id: string
          employment_type: string | null
          hours_per_week: number | null
          id: string
          org_id: string
          pay_frequency: string | null
        }
        Insert: {
          change_reason?: string | null
          classification?: string | null
          created_at?: string
          created_by: string
          default_work_jurisdiction?: string | null
          effective_from: string
          effective_to?: string | null
          employee_id: string
          employment_type?: string | null
          hours_per_week?: number | null
          id?: string
          org_id: string
          pay_frequency?: string | null
        }
        Update: {
          change_reason?: string | null
          classification?: string | null
          created_at?: string
          created_by?: string
          default_work_jurisdiction?: string | null
          effective_from?: string
          effective_to?: string | null
          employee_id?: string
          employment_type?: string | null
          hours_per_week?: number | null
          id?: string
          org_id?: string
          pay_frequency?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employee_history_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_history_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      employees: {
        Row: {
          archived_at: string | null
          classification: string | null
          created_at: string
          created_by: string
          default_work_jurisdiction: string
          dob: string | null
          employee_external_id: string
          employment_type: string
          end_date: string | null
          full_name: string
          hours_per_week: number | null
          id: string
          opening_balance_as_at_date: string | null
          opening_balance_taken_weeks: number | null
          opening_balance_weeks: number | null
          org_id: string
          pay_frequency: string
          retention_expires_at: string | null
          scheme: string
          sex: string | null
          start_date: string
          tags: string[]
          updated_at: string
          updated_by: string
        }
        Insert: {
          archived_at?: string | null
          classification?: string | null
          created_at?: string
          created_by: string
          default_work_jurisdiction: string
          dob?: string | null
          employee_external_id: string
          employment_type: string
          end_date?: string | null
          full_name: string
          hours_per_week?: number | null
          id?: string
          opening_balance_as_at_date?: string | null
          opening_balance_taken_weeks?: number | null
          opening_balance_weeks?: number | null
          org_id: string
          pay_frequency: string
          retention_expires_at?: string | null
          scheme?: string
          sex?: string | null
          start_date: string
          tags?: string[]
          updated_at?: string
          updated_by: string
        }
        Update: {
          archived_at?: string | null
          classification?: string | null
          created_at?: string
          created_by?: string
          default_work_jurisdiction?: string
          dob?: string | null
          employee_external_id?: string
          employment_type?: string
          end_date?: string | null
          full_name?: string
          hours_per_week?: number | null
          id?: string
          opening_balance_as_at_date?: string | null
          opening_balance_taken_weeks?: number | null
          opening_balance_weeks?: number | null
          org_id?: string
          pay_frequency?: string
          retention_expires_at?: string | null
          scheme?: string
          sex?: string | null
          start_date?: string
          tags?: string[]
          updated_at?: string
          updated_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "employees_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      org_members: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          joined_at: string | null
          org_id: string
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          joined_at?: string | null
          org_id: string
          role: string
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          joined_at?: string | null
          org_id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_members_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      organisations: {
        Row: {
          abn: string | null
          created_at: string
          default_pay_frequency: string | null
          default_work_jurisdiction: string | null
          delete_scheduled_at: string | null
          deleted_at: string | null
          employer_legal_name: string | null
          employer_trading_name: string | null
          id: string
          llm_assist_enabled: boolean
          name: string
          opening_balances_method: string | null
          updated_at: string
        }
        Insert: {
          abn?: string | null
          created_at?: string
          default_pay_frequency?: string | null
          default_work_jurisdiction?: string | null
          delete_scheduled_at?: string | null
          deleted_at?: string | null
          employer_legal_name?: string | null
          employer_trading_name?: string | null
          id?: string
          llm_assist_enabled?: boolean
          name: string
          opening_balances_method?: string | null
          updated_at?: string
        }
        Update: {
          abn?: string | null
          created_at?: string
          default_pay_frequency?: string | null
          default_work_jurisdiction?: string | null
          delete_scheduled_at?: string | null
          deleted_at?: string | null
          employer_legal_name?: string | null
          employer_trading_name?: string | null
          id?: string
          llm_assist_enabled?: boolean
          name?: string
          opening_balances_method?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      pay_code_aliases: {
        Row: {
          bucket: string
          confidence: number
          created_at: string
          id: string
          pattern: string
          pattern_kind: string
          source: string
        }
        Insert: {
          bucket: string
          confidence: number
          created_at?: string
          id?: string
          pattern: string
          pattern_kind: string
          source?: string
        }
        Update: {
          bucket?: string
          confidence?: number
          created_at?: string
          id?: string
          pattern?: string
          pattern_kind?: string
          source?: string
        }
        Relationships: []
      }
      pay_code_mapping_versions: {
        Row: {
          bucket: string
          change_reason: string | null
          created_at: string
          created_by: string
          effective_from: string
          effective_to: string | null
          id: string
          mapping_id: string
          org_id: string
          raw_code: string
          source: string
        }
        Insert: {
          bucket: string
          change_reason?: string | null
          created_at?: string
          created_by: string
          effective_from?: string
          effective_to?: string | null
          id?: string
          mapping_id: string
          org_id: string
          raw_code: string
          source: string
        }
        Update: {
          bucket?: string
          change_reason?: string | null
          created_at?: string
          created_by?: string
          effective_from?: string
          effective_to?: string | null
          id?: string
          mapping_id?: string
          org_id?: string
          raw_code?: string
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "pay_code_mapping_versions_mapping_id_fkey"
            columns: ["mapping_id"]
            isOneToOne: false
            referencedRelation: "pay_code_mappings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pay_code_mapping_versions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      pay_code_mappings: {
        Row: {
          archived_at: string | null
          bucket: string
          created_at: string
          current_version_id: string | null
          id: string
          org_id: string
          raw_code: string
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          bucket: string
          created_at?: string
          current_version_id?: string | null
          id?: string
          org_id: string
          raw_code: string
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          bucket?: string
          created_at?: string
          current_version_id?: string | null
          id?: string
          org_id?: string
          raw_code?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pay_code_mappings_current_version_fk"
            columns: ["current_version_id"]
            isOneToOne: false
            referencedRelation: "pay_code_mapping_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pay_code_mappings_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      tags: {
        Row: {
          created_at: string
          created_by: string
          id: string
          name: string
          org_id: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          name: string
          org_id: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          name?: string
          org_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tags_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      value_normalisation_aliases: {
        Row: {
          canonical_value: string
          confidence: number
          created_at: string
          created_by: string | null
          current_version_id: string | null
          id: string
          org_id: string | null
          source: string
          surface_form: string
          target_field: string
        }
        Insert: {
          canonical_value: string
          confidence: number
          created_at?: string
          created_by?: string | null
          current_version_id?: string | null
          id?: string
          org_id?: string | null
          source: string
          surface_form: string
          target_field: string
        }
        Update: {
          canonical_value?: string
          confidence?: number
          created_at?: string
          created_by?: string | null
          current_version_id?: string | null
          id?: string
          org_id?: string | null
          source?: string
          surface_form?: string
          target_field?: string
        }
        Relationships: [
          {
            foreignKeyName: "value_normalisation_aliases_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vna_current_version_fk"
            columns: ["current_version_id"]
            isOneToOne: false
            referencedRelation: "value_normalisation_aliases_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      value_normalisation_aliases_versions: {
        Row: {
          alias_id: string
          canonical_value: string
          change_reason: string | null
          confidence: number
          created_at: string
          created_by: string
          effective_from: string
          effective_to: string | null
          id: string
          org_id: string
          source: string
          surface_form: string
          target_field: string
        }
        Insert: {
          alias_id: string
          canonical_value: string
          change_reason?: string | null
          confidence: number
          created_at?: string
          created_by: string
          effective_from?: string
          effective_to?: string | null
          id?: string
          org_id: string
          source: string
          surface_form: string
          target_field: string
        }
        Update: {
          alias_id?: string
          canonical_value?: string
          change_reason?: string | null
          confidence?: number
          created_at?: string
          created_by?: string
          effective_from?: string
          effective_to?: string | null
          id?: string
          org_id?: string
          source?: string
          surface_form?: string
          target_field?: string
        }
        Relationships: [
          {
            foreignKeyName: "value_normalisation_aliases_versions_alias_id_fkey"
            columns: ["alias_id"]
            isOneToOne: false
            referencedRelation: "value_normalisation_aliases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "value_normalisation_aliases_versions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      purge_expired_employees: { Args: never; Returns: number }
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

// ─────────────────────────────────────────────────────────────────────────────
// Convenience aliases — ergonomic imports for `website/src/lib/` code.
// Per the E5.3 Phase 1 tasks T1.7 acceptance criteria.
// ─────────────────────────────────────────────────────────────────────────────

export type MappingRow = Tables<"pay_code_mappings">
export type MappingVersionRow = Tables<"pay_code_mapping_versions">
export type PayCodeAliasRow = Tables<"pay_code_aliases">
export type ValueNormaliseAliasRow = Tables<"value_normalisation_aliases">
export type ValueNormaliseAliasVersionRow = Tables<"value_normalisation_aliases_versions">

export type MappingInsert = TablesInsert<"pay_code_mappings">
export type MappingVersionInsert = TablesInsert<"pay_code_mapping_versions">
export type ValueNormaliseAliasInsert = TablesInsert<"value_normalisation_aliases">

// E5.2 re-exports (commonly needed alongside mapping types)
export type EmployeeRow = Tables<"employees">
export type EmployeeHistoryRow = Tables<"employee_history">
export type OrganisationRow = Tables<"organisations">
export type TagRow = Tables<"tags">
