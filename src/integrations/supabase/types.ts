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
      assessments: {
        Row: {
          available_equipment: string[] | null
          client_id: string
          created_at: string
          experience_level: string | null
          id: string
          injuries: string | null
          medical_conditions: string | null
          preferences: string | null
          primary_goal: string | null
          secondary_goals: string[] | null
          session_duration_minutes: number | null
          trainer_id: string
          training_days_per_week: number | null
          training_location: string | null
          updated_at: string
        }
        Insert: {
          available_equipment?: string[] | null
          client_id: string
          created_at?: string
          experience_level?: string | null
          id?: string
          injuries?: string | null
          medical_conditions?: string | null
          preferences?: string | null
          primary_goal?: string | null
          secondary_goals?: string[] | null
          session_duration_minutes?: number | null
          trainer_id: string
          training_days_per_week?: number | null
          training_location?: string | null
          updated_at?: string
        }
        Update: {
          available_equipment?: string[] | null
          client_id?: string
          created_at?: string
          experience_level?: string | null
          id?: string
          injuries?: string | null
          medical_conditions?: string | null
          preferences?: string | null
          primary_goal?: string | null
          secondary_goals?: string[] | null
          session_duration_minutes?: number | null
          trainer_id?: string
          training_days_per_week?: number | null
          training_location?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "assessments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          age: number | null
          created_at: string
          email: string | null
          full_name: string
          height_cm: number | null
          id: string
          notes: string | null
          phone: string | null
          sex: string | null
          trainer_id: string
          updated_at: string
          weight_kg: number | null
        }
        Insert: {
          age?: number | null
          created_at?: string
          email?: string | null
          full_name: string
          height_cm?: number | null
          id?: string
          notes?: string | null
          phone?: string | null
          sex?: string | null
          trainer_id: string
          updated_at?: string
          weight_kg?: number | null
        }
        Update: {
          age?: number | null
          created_at?: string
          email?: string | null
          full_name?: string
          height_cm?: number | null
          id?: string
          notes?: string | null
          phone?: string | null
          sex?: string | null
          trainer_id?: string
          updated_at?: string
          weight_kg?: number | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          business_name: string | null
          contact_email: string | null
          contact_phone: string | null
          created_at: string
          full_name: string | null
          id: string
          logo_url: string | null
          primary_color: string | null
          tagline: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          business_name?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          logo_url?: string | null
          primary_color?: string | null
          tagline?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          business_name?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          logo_url?: string | null
          primary_color?: string | null
          tagline?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      subscribers: {
        Row: {
          created_at: string
          current_period_end: string | null
          email: string
          id: string
          stripe_customer_id: string | null
          subscribed: boolean
          subscription_status: string | null
          subscription_tier: string | null
          trial_end: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          current_period_end?: string | null
          email: string
          id?: string
          stripe_customer_id?: string | null
          subscribed?: boolean
          subscription_status?: string | null
          subscription_tier?: string | null
          trial_end?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          current_period_end?: string | null
          email?: string
          id?: string
          stripe_customer_id?: string | null
          subscribed?: boolean
          subscription_status?: string | null
          subscription_tier?: string | null
          trial_end?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      workout_plans: {
        Row: {
          assessment_id: string | null
          client_id: string
          created_at: string
          duration_weeks: number | null
          id: string
          plan_data: Json
          status: string
          summary: string | null
          title: string
          trainer_id: string
          updated_at: string
        }
        Insert: {
          assessment_id?: string | null
          client_id: string
          created_at?: string
          duration_weeks?: number | null
          id?: string
          plan_data?: Json
          status?: string
          summary?: string | null
          title?: string
          trainer_id: string
          updated_at?: string
        }
        Update: {
          assessment_id?: string | null
          client_id?: string
          created_at?: string
          duration_weeks?: number | null
          id?: string
          plan_data?: Json
          status?: string
          summary?: string | null
          title?: string
          trainer_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "workout_plans_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "assessments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workout_plans_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
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
