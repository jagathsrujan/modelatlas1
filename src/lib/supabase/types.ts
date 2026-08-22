// Supabase types — generated via `npx supabase gen types typescript --linked`
// Project: miorhjebtgwjnboawams (ap-south-1, modelatlas1) — Option A Cloud
// When local Postgres is running (npx supabase start), regenerate with:
//   npx supabase gen types typescript --linked > src/lib/supabase/types.ts
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
    PostgrestVersion: "14.15"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      agent_traces: {
        Row: {
          action_type: string | null
          created_at: string | null
          id: string
          latency_ms: number | null
          model_provider: string | null
          result_reference: string | null
          session_id: string | null
          step_index: number | null
          tool_name: string | null
          validated_arguments: Json | null
        }
        Insert: {
          action_type?: string | null
          created_at?: string | null
          id?: string
          latency_ms?: number | null
          model_provider?: string | null
          result_reference?: string | null
          session_id?: string | null
          step_index?: number | null
          tool_name?: string | null
          validated_arguments?: Json | null
        }
        Update: {
          action_type?: string | null
          created_at?: string | null
          id?: string
          latency_ms?: number | null
          model_provider?: string | null
          result_reference?: string | null
          session_id?: string | null
          step_index?: number | null
          tool_name?: string | null
          validated_arguments?: Json | null
        }
        Relationships: []
      }
      decision_sessions: {
        Row: {
          completed_at: string | null
          confirmed_profile_version: string | null
          id: string
          mode: string | null
          owner_id: string | null
          privacy_classification: string | null
          selected_preset: string | null
          started_at: string | null
          status: string | null
          step_count: number | null
          workspace_id: string | null
        }
        Insert: {
          completed_at?: string | null
          confirmed_profile_version?: string | null
          id: string
          mode?: string | null
          owner_id?: string | null
          privacy_classification?: string | null
          selected_preset?: string | null
          started_at?: string | null
          status?: string | null
          step_count?: number | null
          workspace_id?: string | null
        }
        Update: {
          completed_at?: string | null
          confirmed_profile_version?: string | null
          id?: string
          mode?: string | null
          owner_id?: string | null
          privacy_classification?: string | null
          selected_preset?: string | null
          started_at?: string | null
          status?: string | null
          step_count?: number | null
          workspace_id?: string | null
        }
        Relationships: []
      }
      hardware_assets: {
        Row: {
          data: Json
          extraction_confidence: Json | null
          id: string
          last_verified_at: string | null
          owner_id: string | null
          source_documents: string[] | null
          user_confirmed: boolean | null
          workspace_id: string | null
        }
        Insert: {
          data: Json
          extraction_confidence?: Json | null
          id: string
          last_verified_at?: string | null
          owner_id?: string | null
          source_documents?: string[] | null
          user_confirmed?: boolean | null
          workspace_id?: string | null
        }
        Update: {
          data?: Json
          extraction_confidence?: Json | null
          id?: string
          last_verified_at?: string | null
          owner_id?: string | null
          source_documents?: string[] | null
          user_confirmed?: boolean | null
          workspace_id?: string | null
        }
        Relationships: []
      }
      implementation_plans: {
        Row: {
          approval_status: string | null
          created_at: string | null
          data: Json
          id: string
          workspace_id: string | null
        }
        Insert: {
          approval_status?: string | null
          created_at?: string | null
          data: Json
          id: string
          workspace_id?: string | null
        }
        Update: {
          approval_status?: string | null
          created_at?: string | null
          data?: Json
          id?: string
          workspace_id?: string | null
        }
        Relationships: []
      }
      recommendations: {
        Row: {
          candidate_id: string | null
          candidate_type: string | null
          confidence: number | null
          cost_breakdown: Json | null
          created_at: string | null
          id: string
          preset: string | null
          reasons: Json | null
          score_breakdown: Json | null
          session_id: string | null
          source_snapshot_ids: string[] | null
        }
        Insert: {
          candidate_id?: string | null
          candidate_type?: string | null
          confidence?: number | null
          cost_breakdown?: Json | null
          created_at?: string | null
          id?: string
          preset?: string | null
          reasons?: Json | null
          score_breakdown?: Json | null
          session_id?: string | null
          source_snapshot_ids?: string[] | null
        }
        Update: {
          candidate_id?: string | null
          candidate_type?: string | null
          confidence?: number | null
          cost_breakdown?: Json | null
          created_at?: string | null
          id?: string
          preset?: string | null
          reasons?: Json | null
          score_breakdown?: Json | null
          session_id?: string | null
          source_snapshot_ids?: string[] | null
        }
        Relationships: []
      }
      research_briefs: {
        Row: {
          checked_at: string | null
          claims: Json | null
          conflicts: Json | null
          id: string
          next_refresh_at: string | null
          query_groups: Json | null
          scope: string | null
          source_snapshot_ids: string[] | null
          status: string | null
        }
        Insert: {
          checked_at?: string | null
          claims?: Json | null
          conflicts?: Json | null
          id: string
          next_refresh_at?: string | null
          query_groups?: Json | null
          scope?: string | null
          source_snapshot_ids?: string[] | null
          status?: string | null
        }
        Update: {
          checked_at?: string | null
          claims?: Json | null
          conflicts?: Json | null
          id?: string
          next_refresh_at?: string | null
          query_groups?: Json | null
          scope?: string | null
          source_snapshot_ids?: string[] | null
          status?: string | null
        }
        Relationships: []
      }
      source_snapshots: {
        Row: {
          data: Json | null
          freshness_status: string | null
          id: string
          provider: string | null
          retrieved_at: string | null
          url: string | null
        }
        Insert: {
          data?: Json | null
          freshness_status?: string | null
          id: string
          provider?: string | null
          retrieved_at?: string | null
          url?: string | null
        }
        Update: {
          data?: Json | null
          freshness_status?: string | null
          id?: string
          provider?: string | null
          retrieved_at?: string | null
          url?: string | null
        }
        Relationships: []
      }
      team_opportunities: {
        Row: {
          data: Json
          id: string
          workspace_id: string | null
        }
        Insert: {
          data: Json
          id: string
          workspace_id?: string | null
        }
        Update: {
          data?: Json
          id?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "team_opportunities_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      team_research_collections: {
        Row: {
          comment: string | null
          created_at: string
          created_by: string | null
          id: string
          research_brief_id: string
          votes: number
          workspace_id: string
        }
        Insert: {
          comment?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          research_brief_id: string
          votes?: number
          workspace_id: string
        }
        Update: {
          comment?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          research_brief_id?: string
          votes?: number
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_research_collections_research_brief_id_fkey"
            columns: ["research_brief_id"]
            isOneToOne: false
            referencedRelation: "research_briefs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_research_collections_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      watchlist_items: {
        Row: {
          canonical_id: string
          created_at: string
          id: string
          last_checked_at: string
          notify_on_change: boolean
          user_id: string
        }
        Insert: {
          canonical_id: string
          created_at?: string
          id?: string
          last_checked_at?: string
          notify_on_change?: boolean
          user_id: string
        }
        Update: {
          canonical_id?: string
          created_at?: string
          id?: string
          last_checked_at?: string
          notify_on_change?: boolean
          user_id?: string
        }
        Relationships: []
      }
      workload_profiles: {
        Row: {
          created_at: string | null
          data: Json
          id: string
          owner_id: string | null
          workspace_id: string | null
        }
        Insert: {
          created_at?: string | null
          data: Json
          id: string
          owner_id?: string | null
          workspace_id?: string | null
        }
        Update: {
          created_at?: string | null
          data?: Json
          id?: string
          owner_id?: string | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "workload_profiles_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_members: {
        Row: {
          role: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          role: string
          user_id: string
          workspace_id: string
        }
        Update: {
          role?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_members_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_policies: {
        Row: {
          data: Json
          updated_at: string | null
          updated_by: string | null
          workspace_id: string
        }
        Insert: {
          data: Json
          updated_at?: string | null
          updated_by?: string | null
          workspace_id: string
        }
        Update: {
          data?: Json
          updated_at?: string | null
          updated_by?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_policies_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: true
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspaces: {
        Row: {
          created_at: string | null
          id: string
          maximum_privacy_classification: string | null
          name: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          maximum_privacy_classification?: string | null
          name: string
        }
        Update: {
          created_at?: string | null
          id?: string
          maximum_privacy_classification?: string | null
          name?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      compute_next_refresh: {
        Args: {
          checked_at: string
          freshness_type: string
          published_at: string
        }
        Returns: string
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
