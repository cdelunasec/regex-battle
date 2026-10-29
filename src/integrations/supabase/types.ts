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
      lesson_progress: {
        Row: {
          completed_at: string
          id: string
          lesson_slug: string
          player_id: string
          solution: string | null
        }
        Insert: {
          completed_at?: string
          id?: string
          lesson_slug: string
          player_id: string
          solution?: string | null
        }
        Update: {
          completed_at?: string
          id?: string
          lesson_slug?: string
          player_id?: string
          solution?: string | null
        }
        Relationships: []
      }
      problems: {
        Row: {
          created_at: string
          difficulty: number
          id: string
          is_active: boolean
          language: string
          match_mode: string
          must_match: Json
          must_not_match: Json
          prompt: string
          slug: string
        }
        Insert: {
          created_at?: string
          difficulty: number
          id?: string
          is_active?: boolean
          language?: string
          match_mode?: string
          must_match: Json
          must_not_match: Json
          prompt: string
          slug: string
        }
        Update: {
          created_at?: string
          difficulty?: number
          id?: string
          is_active?: boolean
          language?: string
          match_mode?: string
          must_match?: Json
          must_not_match?: Json
          prompt?: string
          slug?: string
        }
        Relationships: []
      }
      rooms: {
        Row: {
          code: string
          config: Json
          created_at: string
          current_problem_id: string | null
          finished_at: string | null
          guest_hp: number
          guest_id: string | null
          host_hp: number
          host_id: string
          id: string
          round_number: number
          status: string
          updated_at: string
          used_problem_ids: string[]
          winner_id: string | null
        }
        Insert: {
          code: string
          config?: Json
          created_at?: string
          current_problem_id?: string | null
          finished_at?: string | null
          guest_hp?: number
          guest_id?: string | null
          host_hp?: number
          host_id: string
          id?: string
          round_number?: number
          status?: string
          updated_at?: string
          used_problem_ids?: string[]
          winner_id?: string | null
        }
        Update: {
          code?: string
          config?: Json
          created_at?: string
          current_problem_id?: string | null
          finished_at?: string | null
          guest_hp?: number
          guest_id?: string | null
          host_hp?: number
          host_id?: string
          id?: string
          round_number?: number
          status?: string
          updated_at?: string
          used_problem_ids?: string[]
          winner_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rooms_current_problem_id_fkey"
            columns: ["current_problem_id"]
            isOneToOne: false
            referencedRelation: "problems"
            referencedColumns: ["id"]
          },
        ]
      }
      rounds: {
        Row: {
          id: string
          problem_id: string
          resolved_at: string | null
          room_id: string
          round_number: number
          started_at: string
          winner_id: string | null
        }
        Insert: {
          id?: string
          problem_id: string
          resolved_at?: string | null
          room_id: string
          round_number: number
          started_at?: string
          winner_id?: string | null
        }
        Update: {
          id?: string
          problem_id?: string
          resolved_at?: string | null
          room_id?: string
          round_number?: number
          started_at?: string
          winner_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rounds_problem_id_fkey"
            columns: ["problem_id"]
            isOneToOne: false
            referencedRelation: "problems"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rounds_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      solo_runs: {
        Row: {
          best_streak: number
          created_at: string
          duration_ms: number
          finished_at: string | null
          id: string
          player_id: string
          solved_count: number
        }
        Insert: {
          best_streak?: number
          created_at?: string
          duration_ms?: number
          finished_at?: string | null
          id?: string
          player_id: string
          solved_count?: number
        }
        Update: {
          best_streak?: number
          created_at?: string
          duration_ms?: number
          finished_at?: string | null
          id?: string
          player_id?: string
          solved_count?: number
        }
        Relationships: []
      }
      submissions: {
        Row: {
          created_at: string
          id: string
          passed: boolean
          player_id: string
          regex: string
          room_id: string | null
          round_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          passed: boolean
          player_id: string
          regex: string
          room_id?: string | null
          round_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          passed?: boolean
          player_id?: string
          regex?: string
          room_id?: string | null
          round_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "submissions_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "submissions_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "rounds"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      assert_service_role: { Args: never; Returns: undefined }
      create_room:
        | {
            Args: never
            Returns: {
              code: string
              config: Json
              created_at: string
              current_problem_id: string | null
              finished_at: string | null
              guest_hp: number
              guest_id: string | null
              host_hp: number
              host_id: string
              id: string
              round_number: number
              status: string
              updated_at: string
              used_problem_ids: string[]
              winner_id: string | null
            }
            SetofOptions: {
              from: "*"
              to: "rooms"
              isOneToOne: true
              isSetofReturn: false
            }
          }
        | {
            Args: { p_difficulty: string; p_initial_hp: number }
            Returns: {
              code: string
              config: Json
              created_at: string
              current_problem_id: string | null
              finished_at: string | null
              guest_hp: number
              guest_id: string | null
              host_hp: number
              host_id: string
              id: string
              round_number: number
              status: string
              updated_at: string
              used_problem_ids: string[]
              winner_id: string | null
            }
            SetofOptions: {
              from: "*"
              to: "rooms"
              isOneToOne: true
              isSetofReturn: false
            }
          }
        | {
            Args: {
              p_difficulty: string
              p_initial_hp: number
              p_language: string
            }
            Returns: {
              code: string
              config: Json
              created_at: string
              current_problem_id: string | null
              finished_at: string | null
              guest_hp: number
              guest_id: string | null
              host_hp: number
              host_id: string
              id: string
              round_number: number
              status: string
              updated_at: string
              used_problem_ids: string[]
              winner_id: string | null
            }
            SetofOptions: {
              from: "*"
              to: "rooms"
              isOneToOne: true
              isSetofReturn: false
            }
          }
      generate_room_code: { Args: never; Returns: string }
      is_valid_case_list: { Args: { value: Json }; Returns: boolean }
      join_room: {
        Args: { p_code: string }
        Returns: {
          code: string
          config: Json
          created_at: string
          current_problem_id: string | null
          finished_at: string | null
          guest_hp: number
          guest_id: string | null
          host_hp: number
          host_id: string
          id: string
          round_number: number
          status: string
          updated_at: string
          used_problem_ids: string[]
          winner_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "rooms"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      leave_room: {
        Args: { p_room_id: string }
        Returns: {
          code: string
          config: Json
          created_at: string
          current_problem_id: string | null
          finished_at: string | null
          guest_hp: number
          guest_id: string | null
          host_hp: number
          host_id: string
          id: string
          round_number: number
          status: string
          updated_at: string
          used_problem_ids: string[]
          winner_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "rooms"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      pick_next_problem:
        | {
            Args: { p_round_number: number; p_used: string[] }
            Returns: string
          }
        | {
            Args: { p_config: Json; p_round_number: number; p_used: string[] }
            Returns: string
          }
        | {
            Args: {
              p_difficulty: string
              p_round_number: number
              p_used: string[]
            }
            Returns: string
          }
      submit_round_result: {
        Args: {
          p_passed: boolean
          p_player_id: string
          p_regex: string
          p_round_id: string
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
