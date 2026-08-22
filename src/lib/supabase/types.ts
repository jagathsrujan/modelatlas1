// Supabase types — generated via `npx supabase gen types typescript --local`
// When local Postgres is running (npx supabase start), regenerate with:
//   npx supabase gen types typescript --local > src/lib/supabase/types.ts
// This file is a hand-maintained fallback for environments without Docker.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      workspaces: {
        Row: {
          id: string;
          name: string;
          created_at: string | null;
          maximum_privacy_classification: string | null;
        };
        Insert: {
          id?: string;
          name: string;
          created_at?: string | null;
          maximum_privacy_classification?: string | null;
        };
        Update: {
          id?: string;
          name?: string;
          created_at?: string | null;
          maximum_privacy_classification?: string | null;
        };
        Relationships: [];
      };
      workspace_members: {
        Row: {
          workspace_id: string;
          user_id: string;
          role: string;
        };
        Insert: {
          workspace_id: string;
          user_id: string;
          role: string;
        };
        Update: {
          workspace_id?: string;
          user_id?: string;
          role?: string;
        };
        Relationships: [
          { foreignKeyName: "workspace_members_workspace_id_fkey"; columns: ["workspace_id"]; isOneToOne: false; referencedRelation: "workspaces"; referencedColumns: ["id"] },
        ];
      };
      workload_profiles: {
        Row: {
          id: string;
          owner_id: string | null;
          workspace_id: string | null;
          data: Json;
          created_at: string | null;
        };
        Insert: {
          id: string;
          owner_id?: string | null;
          workspace_id?: string | null;
          data: Json;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          owner_id?: string | null;
          workspace_id?: string | null;
          data?: Json;
          created_at?: string | null;
        };
        Relationships: [];
      };
      decision_sessions: {
        Row: {
          id: string;
          owner_id: string | null;
          workspace_id: string | null;
          mode: string | null;
          status: string | null;
          confirmed_profile_version: string | null;
          privacy_classification: string | null;
          selected_preset: string | null;
          step_count: number | null;
          started_at: string | null;
          completed_at: string | null;
        };
        Insert: {
          id: string;
          owner_id?: string | null;
          workspace_id?: string | null;
          mode?: string | null;
          status?: string | null;
          confirmed_profile_version?: string | null;
          privacy_classification?: string | null;
          selected_preset?: string | null;
          step_count?: number | null;
          started_at?: string | null;
          completed_at?: string | null;
        };
        Update: {
          id?: string;
          owner_id?: string | null;
          workspace_id?: string | null;
          mode?: string | null;
          status?: string | null;
          confirmed_profile_version?: string | null;
          privacy_classification?: string | null;
          selected_preset?: string | null;
          step_count?: number | null;
          started_at?: string | null;
          completed_at?: string | null;
        };
        Relationships: [];
      };
      agent_traces: {
        Row: {
          id: string;
          session_id: string | null;
          step_index: number | null;
          model_provider: string | null;
          action_type: string | null;
          tool_name: string | null;
          validated_arguments: Json | null;
          result_reference: string | null;
          latency_ms: number | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          session_id?: string | null;
          step_index?: number | null;
          model_provider?: string | null;
          action_type?: string | null;
          tool_name?: string | null;
          validated_arguments?: Json | null;
          result_reference?: string | null;
          latency_ms?: number | null;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          session_id?: string | null;
          step_index?: number | null;
          model_provider?: string | null;
          action_type?: string | null;
          tool_name?: string | null;
          validated_arguments?: Json | null;
          result_reference?: string | null;
          latency_ms?: number | null;
          created_at?: string | null;
        };
        Relationships: [];
      };
      workspace_policies: {
        Row: {
          workspace_id: string;
          data: Json;
          updated_by: string | null;
          updated_at: string | null;
        };
        Insert: {
          workspace_id: string;
          data: Json;
          updated_by?: string | null;
          updated_at?: string | null;
        };
        Update: {
          workspace_id?: string;
          data?: Json;
          updated_by?: string | null;
          updated_at?: string | null;
        };
        Relationships: [];
      };
      team_opportunities: {
        Row: {
          id: string;
          workspace_id: string | null;
          data: Json;
        };
        Insert: {
          id: string;
          workspace_id?: string | null;
          data: Json;
        };
        Update: {
          id?: string;
          workspace_id?: string | null;
          data?: Json;
        };
        Relationships: [];
      };
      hardware_assets: {
        Row: {
          id: string;
          owner_id: string | null;
          workspace_id: string | null;
          data: Json;
          source_documents: string[] | null;
          extraction_confidence: Json | null;
          user_confirmed: boolean | null;
          last_verified_at: string | null;
        };
        Insert: {
          id: string;
          owner_id?: string | null;
          workspace_id?: string | null;
          data: Json;
          source_documents?: string[] | null;
          extraction_confidence?: Json | null;
          user_confirmed?: boolean | null;
          last_verified_at?: string | null;
        };
        Update: {
          id?: string;
          owner_id?: string | null;
          workspace_id?: string | null;
          data?: Json;
          source_documents?: string[] | null;
          extraction_confidence?: Json | null;
          user_confirmed?: boolean | null;
          last_verified_at?: string | null;
        };
        Relationships: [];
      };
      recommendations: {
        Row: {
          id: string;
          session_id: string | null;
          candidate_type: string | null;
          candidate_id: string | null;
          preset: string | null;
          score_breakdown: Json | null;
          reasons: Json | null;
          cost_breakdown: Json | null;
          confidence: number | null;
          source_snapshot_ids: string[] | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          session_id?: string | null;
          candidate_type?: string | null;
          candidate_id?: string | null;
          preset?: string | null;
          score_breakdown?: Json | null;
          reasons?: Json | null;
          cost_breakdown?: Json | null;
          confidence?: number | null;
          source_snapshot_ids?: string[] | null;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          session_id?: string | null;
          candidate_type?: string | null;
          candidate_id?: string | null;
          preset?: string | null;
          score_breakdown?: Json | null;
          reasons?: Json | null;
          cost_breakdown?: Json | null;
          confidence?: number | null;
          source_snapshot_ids?: string[] | null;
          created_at?: string | null;
        };
        Relationships: [];
      };
      implementation_plans: {
        Row: {
          id: string;
          workspace_id: string | null;
          data: Json;
          approval_status: string | null;
          created_at: string | null;
        };
        Insert: {
          id: string;
          workspace_id?: string | null;
          data: Json;
          approval_status?: string | null;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          workspace_id?: string | null;
          data?: Json;
          approval_status?: string | null;
          created_at?: string | null;
        };
        Relationships: [];
      };
      research_briefs: {
        Row: {
          id: string;
          scope: string | null;
          query_groups: Json | null;
          claims: Json | null;
          source_snapshot_ids: string[] | null;
          checked_at: string | null;
          conflicts: Json | null;
          status: string | null;
        };
        Insert: {
          id: string;
          scope?: string | null;
          query_groups?: Json | null;
          claims?: Json | null;
          source_snapshot_ids?: string[] | null;
          checked_at?: string | null;
          conflicts?: Json | null;
          status?: string | null;
        };
        Update: {
          id?: string;
          scope?: string | null;
          query_groups?: Json | null;
          claims?: Json | null;
          source_snapshot_ids?: string[] | null;
          checked_at?: string | null;
          conflicts?: Json | null;
          status?: string | null;
        };
        Relationships: [];
      };
      source_snapshots: {
        Row: {
          id: string;
          provider: string | null;
          url: string | null;
          retrieved_at: string | null;
          data: Json | null;
          freshness_status: string | null;
        };
        Insert: {
          id: string;
          provider?: string | null;
          url?: string | null;
          retrieved_at?: string | null;
          data?: Json | null;
          freshness_status?: string | null;
        };
        Update: {
          id?: string;
          provider?: string | null;
          url?: string | null;
          retrieved_at?: string | null;
          data?: Json | null;
          freshness_status?: string | null;
        };
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: { [_ in never]: never };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
  storage: {
    Tables: {
      buckets: {
        Row: { id: string; name: string; public: boolean | null };
        Insert: { id: string; name: string; public?: boolean | null };
        Update: { id?: string; name?: string; public?: boolean | null };
        Relationships: [];
      };
      objects: {
        Row: { id: string; bucket_id: string | null; name: string | null };
        Insert: { id?: string; bucket_id?: string | null; name?: string | null };
        Update: { id?: string; bucket_id?: string | null; name?: string | null };
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: { [_ in never]: never };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};
