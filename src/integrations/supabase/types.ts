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
          acsm_risk_category: string | null
          available_equipment: string[] | null
          body_fat_method: string | null
          body_fat_pct: number | null
          cardio_capacity: string | null
          client_id: string
          created_at: string
          dominant_side: string | null
          energy_levels: string | null
          experience_level: string | null
          extended: Json
          hip_cm: number | null
          hip_hinge_note: string | null
          hip_hinge_score: number | null
          hydration_glasses_per_day: number | null
          id: string
          injuries: string | null
          known_imbalances: string | null
          lifestyle: string | null
          max_lifts: string | null
          med_flags: string[] | null
          medical_conditions: string | null
          medications: string | null
          mobility_limitations: string | null
          nutrition_habits: string | null
          overhead_reach_note: string | null
          overhead_reach_score: number | null
          parq_passed: boolean | null
          preferences: string | null
          previous_program_style: string | null
          primary_goal: string | null
          readiness_stage: string | null
          recovery_capacity: string | null
          resting_heart_rate: number | null
          secondary_goals: string[] | null
          session_duration_minutes: number | null
          single_leg_balance_note: string | null
          single_leg_balance_score: number | null
          sleep_quality: number | null
          smart_deadline: string | null
          smart_measurable: string | null
          smart_specific: string | null
          squat_depth_note: string | null
          squat_depth_score: number | null
          standing_posture_notes: string | null
          stress_level: number | null
          trainer_id: string
          training_days_per_week: number | null
          training_location: string | null
          updated_at: string
          waist_cm: number | null
          years_training: number | null
        }
        Insert: {
          acsm_risk_category?: string | null
          available_equipment?: string[] | null
          body_fat_method?: string | null
          body_fat_pct?: number | null
          cardio_capacity?: string | null
          client_id: string
          created_at?: string
          dominant_side?: string | null
          energy_levels?: string | null
          experience_level?: string | null
          extended?: Json
          hip_cm?: number | null
          hip_hinge_note?: string | null
          hip_hinge_score?: number | null
          hydration_glasses_per_day?: number | null
          id?: string
          injuries?: string | null
          known_imbalances?: string | null
          lifestyle?: string | null
          max_lifts?: string | null
          med_flags?: string[] | null
          medical_conditions?: string | null
          medications?: string | null
          mobility_limitations?: string | null
          nutrition_habits?: string | null
          overhead_reach_note?: string | null
          overhead_reach_score?: number | null
          parq_passed?: boolean | null
          preferences?: string | null
          previous_program_style?: string | null
          primary_goal?: string | null
          readiness_stage?: string | null
          recovery_capacity?: string | null
          resting_heart_rate?: number | null
          secondary_goals?: string[] | null
          session_duration_minutes?: number | null
          single_leg_balance_note?: string | null
          single_leg_balance_score?: number | null
          sleep_quality?: number | null
          smart_deadline?: string | null
          smart_measurable?: string | null
          smart_specific?: string | null
          squat_depth_note?: string | null
          squat_depth_score?: number | null
          standing_posture_notes?: string | null
          stress_level?: number | null
          trainer_id: string
          training_days_per_week?: number | null
          training_location?: string | null
          updated_at?: string
          waist_cm?: number | null
          years_training?: number | null
        }
        Update: {
          acsm_risk_category?: string | null
          available_equipment?: string[] | null
          body_fat_method?: string | null
          body_fat_pct?: number | null
          cardio_capacity?: string | null
          client_id?: string
          created_at?: string
          dominant_side?: string | null
          energy_levels?: string | null
          experience_level?: string | null
          extended?: Json
          hip_cm?: number | null
          hip_hinge_note?: string | null
          hip_hinge_score?: number | null
          hydration_glasses_per_day?: number | null
          id?: string
          injuries?: string | null
          known_imbalances?: string | null
          lifestyle?: string | null
          max_lifts?: string | null
          med_flags?: string[] | null
          medical_conditions?: string | null
          medications?: string | null
          mobility_limitations?: string | null
          nutrition_habits?: string | null
          overhead_reach_note?: string | null
          overhead_reach_score?: number | null
          parq_passed?: boolean | null
          preferences?: string | null
          previous_program_style?: string | null
          primary_goal?: string | null
          readiness_stage?: string | null
          recovery_capacity?: string | null
          resting_heart_rate?: number | null
          secondary_goals?: string[] | null
          session_duration_minutes?: number | null
          single_leg_balance_note?: string | null
          single_leg_balance_score?: number | null
          sleep_quality?: number | null
          smart_deadline?: string | null
          smart_measurable?: string | null
          smart_specific?: string | null
          squat_depth_note?: string | null
          squat_depth_score?: number | null
          standing_posture_notes?: string | null
          stress_level?: number | null
          trainer_id?: string
          training_days_per_week?: number | null
          training_location?: string | null
          updated_at?: string
          waist_cm?: number | null
          years_training?: number | null
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
      backup_workout_plan_days_20260430: {
        Row: {
          content: Json | null
          created_at: string | null
          day_label: string | null
          day_number: number | null
          focus: string | null
          id: string | null
          plan_id: string | null
          rationale: string | null
          status: string | null
          trainer_id: string | null
          updated_at: string | null
          week_number: number | null
        }
        Insert: {
          content?: Json | null
          created_at?: string | null
          day_label?: string | null
          day_number?: number | null
          focus?: string | null
          id?: string | null
          plan_id?: string | null
          rationale?: string | null
          status?: string | null
          trainer_id?: string | null
          updated_at?: string | null
          week_number?: number | null
        }
        Update: {
          content?: Json | null
          created_at?: string | null
          day_label?: string | null
          day_number?: number | null
          focus?: string | null
          id?: string | null
          plan_id?: string | null
          rationale?: string | null
          status?: string | null
          trainer_id?: string | null
          updated_at?: string | null
          week_number?: number | null
        }
        Relationships: []
      }
      backup_workout_plans_20260430: {
        Row: {
          assessment_id: string | null
          client_id: string | null
          created_at: string | null
          duration_weeks: number | null
          generation_meta: Json | null
          generation_status: string | null
          id: string | null
          plan_data: Json | null
          share_token: string | null
          share_token_expires_at: string | null
          status: string | null
          summary: string | null
          title: string | null
          trainer_id: string | null
          updated_at: string | null
        }
        Insert: {
          assessment_id?: string | null
          client_id?: string | null
          created_at?: string | null
          duration_weeks?: number | null
          generation_meta?: Json | null
          generation_status?: string | null
          id?: string | null
          plan_data?: Json | null
          share_token?: string | null
          share_token_expires_at?: string | null
          status?: string | null
          summary?: string | null
          title?: string | null
          trainer_id?: string | null
          updated_at?: string | null
        }
        Update: {
          assessment_id?: string | null
          client_id?: string | null
          created_at?: string | null
          duration_weeks?: number | null
          generation_meta?: Json | null
          generation_status?: string | null
          id?: string | null
          plan_data?: Json | null
          share_token?: string | null
          share_token_expires_at?: string | null
          status?: string | null
          summary?: string | null
          title?: string | null
          trainer_id?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      clients: {
        Row: {
          age: number | null
          created_at: string
          email: string | null
          full_name: string
          height_cm: number | null
          id: string
          intake_status: Database["public"]["Enums"]["intake_status"]
          intake_submitted_at: string | null
          intake_token: string | null
          intake_token_expires_at: string | null
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
          intake_status?: Database["public"]["Enums"]["intake_status"]
          intake_submitted_at?: string | null
          intake_token?: string | null
          intake_token_expires_at?: string | null
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
          intake_status?: Database["public"]["Enums"]["intake_status"]
          intake_submitted_at?: string | null
          intake_token?: string | null
          intake_token_expires_at?: string | null
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
          onboarding_completed: boolean
          onboarding_steps: Json
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
          onboarding_completed?: boolean
          onboarding_steps?: Json
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
          onboarding_completed?: boolean
          onboarding_steps?: Json
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
      workout_plan_days: {
        Row: {
          content: Json
          created_at: string
          day_label: string | null
          day_number: number
          focus: string | null
          id: string
          plan_id: string
          rationale: string | null
          status: string
          trainer_id: string
          updated_at: string
          week_number: number
        }
        Insert: {
          content?: Json
          created_at?: string
          day_label?: string | null
          day_number: number
          focus?: string | null
          id?: string
          plan_id: string
          rationale?: string | null
          status?: string
          trainer_id: string
          updated_at?: string
          week_number: number
        }
        Update: {
          content?: Json
          created_at?: string
          day_label?: string | null
          day_number?: number
          focus?: string | null
          id?: string
          plan_id?: string
          rationale?: string | null
          status?: string
          trainer_id?: string
          updated_at?: string
          week_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "workout_plan_days_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "workout_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      workout_plans: {
        Row: {
          assessment_id: string | null
          client_id: string
          created_at: string
          duration_weeks: number | null
          generation_meta: Json
          generation_status: string
          id: string
          plan_data: Json
          share_token: string | null
          share_token_expires_at: string | null
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
          generation_meta?: Json
          generation_status?: string
          id?: string
          plan_data?: Json
          share_token?: string | null
          share_token_expires_at?: string | null
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
          generation_meta?: Json
          generation_status?: string
          id?: string
          plan_data?: Json
          share_token?: string | null
          share_token_expires_at?: string | null
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
      workout_sessions: {
        Row: {
          created_at: string
          day_label: string
          entries: Json
          id: string
          logged_by: string
          plan_id: string
          session_date: string
          session_notes: string | null
          status: Database["public"]["Enums"]["session_status"]
          trainer_id: string
          updated_at: string
          week_number: number
        }
        Insert: {
          created_at?: string
          day_label: string
          entries?: Json
          id?: string
          logged_by?: string
          plan_id: string
          session_date?: string
          session_notes?: string | null
          status?: Database["public"]["Enums"]["session_status"]
          trainer_id: string
          updated_at?: string
          week_number: number
        }
        Update: {
          created_at?: string
          day_label?: string
          entries?: Json
          id?: string
          logged_by?: string
          plan_id?: string
          session_date?: string
          session_notes?: string | null
          status?: Database["public"]["Enums"]["session_status"]
          trainer_id?: string
          updated_at?: string
          week_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "workout_sessions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "workout_plans"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_intake_branding: {
        Args: { _token: string }
        Returns: {
          business_name: string
          full_name: string
          logo_url: string
          primary_color: string
          tagline: string
        }[]
      }
      has_active_access: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      intake_status: "not_sent" | "sent" | "opened" | "submitted" | "reviewed"
      session_status: "done" | "partial" | "missed"
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
    Enums: {
      intake_status: ["not_sent", "sent", "opened", "submitted", "reviewed"],
      session_status: ["done", "partial", "missed"],
    },
  },
} as const
