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
      acsm_chapters: {
        Row: {
          chapter_number: number
          created_at: string
          id: string
          page_end: number | null
          page_start: number | null
          paraphrased_summary: string | null
          title: string
          updated_at: string
        }
        Insert: {
          chapter_number: number
          created_at?: string
          id?: string
          page_end?: number | null
          page_start?: number | null
          paraphrased_summary?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          chapter_number?: number
          created_at?: string
          id?: string
          page_end?: number | null
          page_start?: number | null
          paraphrased_summary?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      acsm_contraindications: {
        Row: {
          citation: string
          condition: string
          created_at: string
          id: string
          modality: string
          notes: string | null
          severity: string
          updated_at: string
        }
        Insert: {
          citation: string
          condition: string
          created_at?: string
          id?: string
          modality: string
          notes?: string | null
          severity?: string
          updated_at?: string
        }
        Update: {
          citation?: string
          condition?: string
          created_at?: string
          id?: string
          modality?: string
          notes?: string | null
          severity?: string
          updated_at?: string
        }
        Relationships: []
      }
      acsm_normatives: {
        Row: {
          age_high: number | null
          age_low: number | null
          citation: string
          created_at: string
          id: string
          percentile: number | null
          sex: string | null
          test: string
          unit: string | null
          value: number
        }
        Insert: {
          age_high?: number | null
          age_low?: number | null
          citation: string
          created_at?: string
          id?: string
          percentile?: number | null
          sex?: string | null
          test: string
          unit?: string | null
          value: number
        }
        Update: {
          age_high?: number | null
          age_low?: number | null
          citation?: string
          created_at?: string
          id?: string
          percentile?: number | null
          sex?: string | null
          test?: string
          unit?: string | null
          value?: number
        }
        Relationships: []
      }
      acsm_populations: {
        Row: {
          citation: string | null
          created_at: string
          id: string
          one_line_summary: string | null
          population: string
          source_chapter: number | null
          trigger_criteria: string | null
          updated_at: string
        }
        Insert: {
          citation?: string | null
          created_at?: string
          id?: string
          one_line_summary?: string | null
          population: string
          source_chapter?: number | null
          trigger_criteria?: string | null
          updated_at?: string
        }
        Update: {
          citation?: string | null
          created_at?: string
          id?: string
          one_line_summary?: string | null
          population?: string
          source_chapter?: number | null
          trigger_criteria?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      acsm_recommendations: {
        Row: {
          citation: string
          created_at: string
          id: string
          notes: string | null
          parameter: string
          population: string
          topic: string
          unit: string | null
          updated_at: string
          value_high: number | null
          value_low: number | null
        }
        Insert: {
          citation: string
          created_at?: string
          id?: string
          notes?: string | null
          parameter: string
          population?: string
          topic: string
          unit?: string | null
          updated_at?: string
          value_high?: number | null
          value_low?: number | null
        }
        Update: {
          citation?: string
          created_at?: string
          id?: string
          notes?: string | null
          parameter?: string
          population?: string
          topic?: string
          unit?: string | null
          updated_at?: string
          value_high?: number | null
          value_low?: number | null
        }
        Relationships: []
      }
      acsm_sections: {
        Row: {
          chapter_id: string
          created_at: string
          id: string
          page_end: number | null
          page_start: number | null
          paraphrased_notes: string | null
          section_code: string
          title: string
          updated_at: string
        }
        Insert: {
          chapter_id: string
          created_at?: string
          id?: string
          page_end?: number | null
          page_start?: number | null
          paraphrased_notes?: string | null
          section_code: string
          title: string
          updated_at?: string
        }
        Update: {
          chapter_id?: string
          created_at?: string
          id?: string
          page_end?: number | null
          page_start?: number | null
          paraphrased_notes?: string | null
          section_code?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "acsm_sections_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "acsm_chapters"
            referencedColumns: ["id"]
          },
        ]
      }
      acsm_thresholds: {
        Row: {
          applies_to: string
          citation: string
          created_at: string
          id: string
          notes: string | null
          parameter: string
          severity: string
          unit: string | null
          updated_at: string
          value_high: number | null
          value_low: number | null
        }
        Insert: {
          applies_to: string
          citation: string
          created_at?: string
          id?: string
          notes?: string | null
          parameter: string
          severity?: string
          unit?: string | null
          updated_at?: string
          value_high?: number | null
          value_low?: number | null
        }
        Update: {
          applies_to?: string
          citation?: string
          created_at?: string
          id?: string
          notes?: string | null
          parameter?: string
          severity?: string
          unit?: string | null
          updated_at?: string
          value_high?: number | null
          value_low?: number | null
        }
        Relationships: []
      }
      assessments: {
        Row: {
          acsm_risk_category: string | null
          available_equipment: string[] | null
          body_fat_method: string | null
          body_fat_pct: number | null
          bp_measured_at: string | null
          cardio_capacity: string | null
          carry_capacity: Json
          carry_form_criteria: Json
          client_id: string
          created_at: string
          current_capacity_vs_pb: number | null
          cvd_risk_factors: Json
          diastolic_bp_mmhg: number | null
          dominant_side: string | null
          energy_levels: string | null
          exerciser_status: string | null
          experience_level: string | null
          extended: Json
          hinge_capacity: Json
          hinge_form_criteria: Json
          hip_cm: number | null
          hip_hinge_note: string | null
          hip_hinge_score: number | null
          hydration_glasses_per_day: number | null
          id: string
          injuries: string | null
          kind: string
          known_imbalances: string | null
          lifestyle: string | null
          lunge_capacity: Json
          lunge_form_criteria: Json
          max_lifts: string | null
          med_flags: string[] | null
          medical_clearance_reason: string | null
          medical_clearance_required: boolean | null
          medical_conditions: string | null
          medications: string | null
          mobility_limitations: string | null
          nutrition_habits: string | null
          overhead_reach_note: string | null
          overhead_reach_score: number | null
          parq_passed: boolean | null
          performed_on: string | null
          preferences: string | null
          previous_program_style: string | null
          primary_goal: string | null
          pull_capacity: Json
          pull_form_criteria: Json
          push_capacity: Json
          push_form_criteria: Json
          readiness_stage: string | null
          recovery_capacity: string | null
          resting_heart_rate: number | null
          screen_not_assessed: Json
          secondary_goals: string[] | null
          section_analyses: Json
          section_analyses_locale: Json
          sections_analysed_at: Json
          session_duration_minutes: number | null
          signs_symptoms: Json
          single_leg_balance_note: string | null
          single_leg_balance_score: number | null
          sleep_quality: number | null
          smart_deadline: string | null
          smart_measurable: string | null
          smart_specific: string | null
          squat_capacity: Json
          squat_depth_note: string | null
          squat_depth_score: number | null
          squat_form_criteria: Json
          standing_posture_notes: string | null
          stress_level: number | null
          submax_test: Json
          systolic_bp_mmhg: number | null
          trainer_id: string
          training_days_per_week: number | null
          training_location: string[] | null
          updated_at: string
          waist_cm: number | null
          years_training: number | null
        }
        Insert: {
          acsm_risk_category?: string | null
          available_equipment?: string[] | null
          body_fat_method?: string | null
          body_fat_pct?: number | null
          bp_measured_at?: string | null
          cardio_capacity?: string | null
          carry_capacity?: Json
          carry_form_criteria?: Json
          client_id: string
          created_at?: string
          current_capacity_vs_pb?: number | null
          cvd_risk_factors?: Json
          diastolic_bp_mmhg?: number | null
          dominant_side?: string | null
          energy_levels?: string | null
          exerciser_status?: string | null
          experience_level?: string | null
          extended?: Json
          hinge_capacity?: Json
          hinge_form_criteria?: Json
          hip_cm?: number | null
          hip_hinge_note?: string | null
          hip_hinge_score?: number | null
          hydration_glasses_per_day?: number | null
          id?: string
          injuries?: string | null
          kind?: string
          known_imbalances?: string | null
          lifestyle?: string | null
          lunge_capacity?: Json
          lunge_form_criteria?: Json
          max_lifts?: string | null
          med_flags?: string[] | null
          medical_clearance_reason?: string | null
          medical_clearance_required?: boolean | null
          medical_conditions?: string | null
          medications?: string | null
          mobility_limitations?: string | null
          nutrition_habits?: string | null
          overhead_reach_note?: string | null
          overhead_reach_score?: number | null
          parq_passed?: boolean | null
          performed_on?: string | null
          preferences?: string | null
          previous_program_style?: string | null
          primary_goal?: string | null
          pull_capacity?: Json
          pull_form_criteria?: Json
          push_capacity?: Json
          push_form_criteria?: Json
          readiness_stage?: string | null
          recovery_capacity?: string | null
          resting_heart_rate?: number | null
          screen_not_assessed?: Json
          secondary_goals?: string[] | null
          section_analyses?: Json
          section_analyses_locale?: Json
          sections_analysed_at?: Json
          session_duration_minutes?: number | null
          signs_symptoms?: Json
          single_leg_balance_note?: string | null
          single_leg_balance_score?: number | null
          sleep_quality?: number | null
          smart_deadline?: string | null
          smart_measurable?: string | null
          smart_specific?: string | null
          squat_capacity?: Json
          squat_depth_note?: string | null
          squat_depth_score?: number | null
          squat_form_criteria?: Json
          standing_posture_notes?: string | null
          stress_level?: number | null
          submax_test?: Json
          systolic_bp_mmhg?: number | null
          trainer_id: string
          training_days_per_week?: number | null
          training_location?: string[] | null
          updated_at?: string
          waist_cm?: number | null
          years_training?: number | null
        }
        Update: {
          acsm_risk_category?: string | null
          available_equipment?: string[] | null
          body_fat_method?: string | null
          body_fat_pct?: number | null
          bp_measured_at?: string | null
          cardio_capacity?: string | null
          carry_capacity?: Json
          carry_form_criteria?: Json
          client_id?: string
          created_at?: string
          current_capacity_vs_pb?: number | null
          cvd_risk_factors?: Json
          diastolic_bp_mmhg?: number | null
          dominant_side?: string | null
          energy_levels?: string | null
          exerciser_status?: string | null
          experience_level?: string | null
          extended?: Json
          hinge_capacity?: Json
          hinge_form_criteria?: Json
          hip_cm?: number | null
          hip_hinge_note?: string | null
          hip_hinge_score?: number | null
          hydration_glasses_per_day?: number | null
          id?: string
          injuries?: string | null
          kind?: string
          known_imbalances?: string | null
          lifestyle?: string | null
          lunge_capacity?: Json
          lunge_form_criteria?: Json
          max_lifts?: string | null
          med_flags?: string[] | null
          medical_clearance_reason?: string | null
          medical_clearance_required?: boolean | null
          medical_conditions?: string | null
          medications?: string | null
          mobility_limitations?: string | null
          nutrition_habits?: string | null
          overhead_reach_note?: string | null
          overhead_reach_score?: number | null
          parq_passed?: boolean | null
          performed_on?: string | null
          preferences?: string | null
          previous_program_style?: string | null
          primary_goal?: string | null
          pull_capacity?: Json
          pull_form_criteria?: Json
          push_capacity?: Json
          push_form_criteria?: Json
          readiness_stage?: string | null
          recovery_capacity?: string | null
          resting_heart_rate?: number | null
          screen_not_assessed?: Json
          secondary_goals?: string[] | null
          section_analyses?: Json
          section_analyses_locale?: Json
          sections_analysed_at?: Json
          session_duration_minutes?: number | null
          signs_symptoms?: Json
          single_leg_balance_note?: string | null
          single_leg_balance_score?: number | null
          sleep_quality?: number | null
          smart_deadline?: string | null
          smart_measurable?: string | null
          smart_specific?: string | null
          squat_capacity?: Json
          squat_depth_note?: string | null
          squat_depth_score?: number | null
          squat_form_criteria?: Json
          standing_posture_notes?: string | null
          stress_level?: number | null
          submax_test?: Json
          systolic_bp_mmhg?: number | null
          trainer_id?: string
          training_days_per_week?: number | null
          training_location?: string[] | null
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
      capacity_domains: {
        Row: {
          created_at: string
          default_cadence_days: number
          display_order: number
          evidence_summary_key: string
          id: string
          name_key: string
          norm_reference_source: string | null
          reference_assessments: Json
          slug: string
          tier: string
        }
        Insert: {
          created_at?: string
          default_cadence_days?: number
          display_order: number
          evidence_summary_key: string
          id?: string
          name_key: string
          norm_reference_source?: string | null
          reference_assessments?: Json
          slug: string
          tier: string
        }
        Update: {
          created_at?: string
          default_cadence_days?: number
          display_order?: number
          evidence_summary_key?: string
          id?: string
          name_key?: string
          norm_reference_source?: string | null
          reference_assessments?: Json
          slug?: string
          tier?: string
        }
        Relationships: []
      }
      client_bookings: {
        Row: {
          client_id: string
          created_at: string
          duration_min: number
          id: string
          notes: string | null
          pack_id: string | null
          session_type: string
          starts_at: string
          status: string
          trainer_id: string
          updated_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          duration_min?: number
          id?: string
          notes?: string | null
          pack_id?: string | null
          session_type?: string
          starts_at: string
          status?: string
          trainer_id: string
          updated_at?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          duration_min?: number
          id?: string
          notes?: string | null
          pack_id?: string | null
          session_type?: string
          starts_at?: string
          status?: string
          trainer_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_bookings_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_bookings_pack_id_fkey"
            columns: ["pack_id"]
            isOneToOne: false
            referencedRelation: "client_packs"
            referencedColumns: ["id"]
          },
        ]
      }
      client_capacity_snapshots: {
        Row: {
          client_id: string
          created_at: string
          created_by: string | null
          domain_slug: string
          evidence_url: string | null
          id: string
          measured_at: string
          normalized_score: number | null
          notes: string | null
          provenance: string
          raw_unit: string | null
          raw_value: number | null
          test_used: string | null
        }
        Insert: {
          client_id: string
          created_at?: string
          created_by?: string | null
          domain_slug: string
          evidence_url?: string | null
          id?: string
          measured_at?: string
          normalized_score?: number | null
          notes?: string | null
          provenance: string
          raw_unit?: string | null
          raw_value?: number | null
          test_used?: string | null
        }
        Update: {
          client_id?: string
          created_at?: string
          created_by?: string | null
          domain_slug?: string
          evidence_url?: string | null
          id?: string
          measured_at?: string
          normalized_score?: number | null
          notes?: string | null
          provenance?: string
          raw_unit?: string | null
          raw_value?: number | null
          test_used?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_capacity_snapshots_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_capacity_snapshots_domain_slug_fkey"
            columns: ["domain_slug"]
            isOneToOne: false
            referencedRelation: "capacity_domains"
            referencedColumns: ["slug"]
          },
        ]
      }
      client_checkins: {
        Row: {
          checked_on: string
          client_id: string
          created_at: string
          energy_level: number | null
          id: string
          notes: string | null
          sleep_quality: number | null
          soreness_level: number | null
          trainer_id: string
          updated_at: string
        }
        Insert: {
          checked_on?: string
          client_id: string
          created_at?: string
          energy_level?: number | null
          id?: string
          notes?: string | null
          sleep_quality?: number | null
          soreness_level?: number | null
          trainer_id: string
          updated_at?: string
        }
        Update: {
          checked_on?: string
          client_id?: string
          created_at?: string
          energy_level?: number | null
          id?: string
          notes?: string | null
          sleep_quality?: number | null
          soreness_level?: number | null
          trainer_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_checkins_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      client_measurement_cadence: {
        Row: {
          client_id: string
          created_at: string
          domain_slug: string
          interval_days: number
          set_by: string | null
          updated_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          domain_slug: string
          interval_days: number
          set_by?: string | null
          updated_at?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          domain_slug?: string
          interval_days?: number
          set_by?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_measurement_cadence_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_measurement_cadence_domain_slug_fkey"
            columns: ["domain_slug"]
            isOneToOne: false
            referencedRelation: "capacity_domains"
            referencedColumns: ["slug"]
          },
        ]
      }
      client_measurement_prefs: {
        Row: {
          client_id: string
          daily_fields: string[]
          periodic_fields: string[]
          periodic_interval_days: number
          reassessment_interval_days: number
          trainer_id: string
          updated_at: string
        }
        Insert: {
          client_id: string
          daily_fields?: string[]
          periodic_fields?: string[]
          periodic_interval_days?: number
          reassessment_interval_days?: number
          trainer_id: string
          updated_at?: string
        }
        Update: {
          client_id?: string
          daily_fields?: string[]
          periodic_fields?: string[]
          periodic_interval_days?: number
          reassessment_interval_days?: number
          trainer_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_measurement_prefs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: true
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      client_measurements: {
        Row: {
          cadence: string
          client_id: string
          created_at: string
          id: string
          measured_on: string
          notes: string | null
          trainer_id: string
          values: Json
        }
        Insert: {
          cadence: string
          client_id: string
          created_at?: string
          id?: string
          measured_on?: string
          notes?: string | null
          trainer_id: string
          values?: Json
        }
        Update: {
          cadence?: string
          client_id?: string
          created_at?: string
          id?: string
          measured_on?: string
          notes?: string | null
          trainer_id?: string
          values?: Json
        }
        Relationships: [
          {
            foreignKeyName: "client_measurements_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      client_packs: {
        Row: {
          archived: boolean
          client_id: string
          color: string
          created_at: string
          id: string
          label: string
          pack_size: number
          price_per_session_eur: number
          session_type: string
          sessions_used: number
          start_date: string
          trainer_id: string
          updated_at: string
          weekly_frequency: number
        }
        Insert: {
          archived?: boolean
          client_id: string
          color?: string
          created_at?: string
          id?: string
          label?: string
          pack_size?: number
          price_per_session_eur?: number
          session_type?: string
          sessions_used?: number
          start_date?: string
          trainer_id: string
          updated_at?: string
          weekly_frequency?: number
        }
        Update: {
          archived?: boolean
          client_id?: string
          color?: string
          created_at?: string
          id?: string
          label?: string
          pack_size?: number
          price_per_session_eur?: number
          session_type?: string
          sessions_used?: number
          start_date?: string
          trainer_id?: string
          updated_at?: string
          weekly_frequency?: number
        }
        Relationships: [
          {
            foreignKeyName: "client_packs_client_id_fkey"
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
          assessment_completion: number
          color: string | null
          created_at: string
          date_of_birth: string | null
          email: string | null
          full_name: string
          height_cm: number | null
          id: string
          intake_status: Database["public"]["Enums"]["intake_status"]
          intake_submitted_at: string | null
          intake_token: string | null
          intake_token_expires_at: string | null
          is_demo: boolean
          is_self: boolean
          notes: string | null
          phone: string | null
          photo_url: string | null
          sex: string | null
          trainer_id: string
          trainer_summary: string | null
          updated_at: string
          user_id: string | null
          weight_kg: number | null
        }
        Insert: {
          age?: number | null
          assessment_completion?: number
          color?: string | null
          created_at?: string
          date_of_birth?: string | null
          email?: string | null
          full_name: string
          height_cm?: number | null
          id?: string
          intake_status?: Database["public"]["Enums"]["intake_status"]
          intake_submitted_at?: string | null
          intake_token?: string | null
          intake_token_expires_at?: string | null
          is_demo?: boolean
          is_self?: boolean
          notes?: string | null
          phone?: string | null
          photo_url?: string | null
          sex?: string | null
          trainer_id: string
          trainer_summary?: string | null
          updated_at?: string
          user_id?: string | null
          weight_kg?: number | null
        }
        Update: {
          age?: number | null
          assessment_completion?: number
          color?: string | null
          created_at?: string
          date_of_birth?: string | null
          email?: string | null
          full_name?: string
          height_cm?: number | null
          id?: string
          intake_status?: Database["public"]["Enums"]["intake_status"]
          intake_submitted_at?: string | null
          intake_token?: string | null
          intake_token_expires_at?: string | null
          is_demo?: boolean
          is_self?: boolean
          notes?: string | null
          phone?: string | null
          photo_url?: string | null
          sex?: string | null
          trainer_id?: string
          trainer_summary?: string | null
          updated_at?: string
          user_id?: string | null
          weight_kg?: number | null
        }
        Relationships: []
      }
      daily_activity_log: {
        Row: {
          client_id: string
          created_at: string
          date: string
          id: string
          notes: string | null
          steps: number
          trainer_id: string
          updated_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          date?: string
          id?: string
          notes?: string | null
          steps?: number
          trainer_id: string
          updated_at?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          date?: string
          id?: string
          notes?: string | null
          steps?: number
          trainer_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_activity_log_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      demo_runs: {
        Row: {
          cancelled: boolean
          client_id: string | null
          created_at: string
          error: string | null
          id: string
          plan_id: string | null
          stage: string
          status: string
          trainer_id: string
          updated_at: string
        }
        Insert: {
          cancelled?: boolean
          client_id?: string | null
          created_at?: string
          error?: string | null
          id?: string
          plan_id?: string | null
          stage?: string
          status?: string
          trainer_id: string
          updated_at?: string
        }
        Update: {
          cancelled?: boolean
          client_id?: string | null
          created_at?: string
          error?: string | null
          id?: string
          plan_id?: string | null
          stage?: string
          status?: string
          trainer_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "demo_runs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demo_runs_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "workout_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      generation_log: {
        Row: {
          assessment_id: string | null
          cost_usd: number
          created_at: string
          duration_ms: number
          error: string | null
          id: string
          input_snapshot: Json | null
          input_tokens: number
          model_used: string
          output_snapshot: Json | null
          output_tokens: number
          plan_id: string | null
          retry_count: number
          stage: string
          trainer_id: string
          zod_passed: boolean
        }
        Insert: {
          assessment_id?: string | null
          cost_usd?: number
          created_at?: string
          duration_ms?: number
          error?: string | null
          id?: string
          input_snapshot?: Json | null
          input_tokens?: number
          model_used: string
          output_snapshot?: Json | null
          output_tokens?: number
          plan_id?: string | null
          retry_count?: number
          stage: string
          trainer_id: string
          zod_passed: boolean
        }
        Update: {
          assessment_id?: string | null
          cost_usd?: number
          created_at?: string
          duration_ms?: number
          error?: string | null
          id?: string
          input_snapshot?: Json | null
          input_tokens?: number
          model_used?: string
          output_snapshot?: Json | null
          output_tokens?: number
          plan_id?: string | null
          retry_count?: number
          stage?: string
          trainer_id?: string
          zod_passed?: boolean
        }
        Relationships: []
      }
      knowledge_profile_versions: {
        Row: {
          change_summary: string
          changed_by: string | null
          created_at: string
          id: string
          profile_id: string
          rules: Json
          trainer_id: string
          version: number
        }
        Insert: {
          change_summary?: string
          changed_by?: string | null
          created_at?: string
          id?: string
          profile_id: string
          rules: Json
          trainer_id: string
          version: number
        }
        Update: {
          change_summary?: string
          changed_by?: string | null
          created_at?: string
          id?: string
          profile_id?: string
          rules?: Json
          trainer_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_profile_versions_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "knowledge_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_profiles: {
        Row: {
          created_at: string
          description: string
          id: string
          is_default: boolean
          is_system: boolean
          name: string
          rules: Json
          trainer_id: string
          updated_at: string
          version: number
        }
        Insert: {
          created_at?: string
          description?: string
          id?: string
          is_default?: boolean
          is_system?: boolean
          name: string
          rules?: Json
          trainer_id: string
          updated_at?: string
          version?: number
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          is_default?: boolean
          is_system?: boolean
          name?: string
          rules?: Json
          trainer_id?: string
          updated_at?: string
          version?: number
        }
        Relationships: []
      }
      missions: {
        Row: {
          client_id: string
          completed_at: string | null
          created_at: string
          evidence_required: boolean
          evidence_url: string | null
          id: string
          kind: Database["public"]["Enums"]["mission_kind"]
          status: Database["public"]["Enums"]["mission_status"]
          trainer_id: string
          updated_at: string
        }
        Insert: {
          client_id: string
          completed_at?: string | null
          created_at?: string
          evidence_required?: boolean
          evidence_url?: string | null
          id?: string
          kind: Database["public"]["Enums"]["mission_kind"]
          status?: Database["public"]["Enums"]["mission_status"]
          trainer_id: string
          updated_at?: string
        }
        Update: {
          client_id?: string
          completed_at?: string | null
          created_at?: string
          evidence_required?: boolean
          evidence_url?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["mission_kind"]
          status?: Database["public"]["Enums"]["mission_status"]
          trainer_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "missions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      pack_members: {
        Row: {
          client_id: string
          created_at: string
          id: string
          pack_id: string
          position: number
          primary_payer: boolean
          trainer_id: string
        }
        Insert: {
          client_id: string
          created_at?: string
          id?: string
          pack_id: string
          position?: number
          primary_payer?: boolean
          trainer_id: string
        }
        Update: {
          client_id?: string
          created_at?: string
          id?: string
          pack_id?: string
          position?: number
          primary_payer?: boolean
          trainer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pack_members_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_feedback: {
        Row: {
          author: string
          body: string
          category: string
          client_id: string
          created_at: string
          id: string
          metadata: Json
          plan_id: string | null
          resolved_at: string | null
          status: string
          trainer_id: string
          updated_at: string
        }
        Insert: {
          author: string
          body: string
          category: string
          client_id: string
          created_at?: string
          id?: string
          metadata?: Json
          plan_id?: string | null
          resolved_at?: string | null
          status?: string
          trainer_id: string
          updated_at?: string
        }
        Update: {
          author?: string
          body?: string
          category?: string
          client_id?: string
          created_at?: string
          id?: string
          metadata?: Json
          plan_id?: string | null
          resolved_at?: string | null
          status?: string
          trainer_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "plan_feedback_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_feedback_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "workout_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_templates: {
        Row: {
          blueprint: Json | null
          brief: Json | null
          created_at: string
          description: string | null
          duration_weeks: number
          id: string
          name: string
          plan_data: Json
          programming_variables: Json | null
          source_plan_id: string | null
          tags: string[]
          trainer_id: string
          updated_at: string
          use_count: number
        }
        Insert: {
          blueprint?: Json | null
          brief?: Json | null
          created_at?: string
          description?: string | null
          duration_weeks?: number
          id?: string
          name: string
          plan_data?: Json
          programming_variables?: Json | null
          source_plan_id?: string | null
          tags?: string[]
          trainer_id: string
          updated_at?: string
          use_count?: number
        }
        Update: {
          blueprint?: Json | null
          brief?: Json | null
          created_at?: string
          description?: string | null
          duration_weeks?: number
          id?: string
          name?: string
          plan_data?: Json
          programming_variables?: Json | null
          source_plan_id?: string | null
          tags?: string[]
          trainer_id?: string
          updated_at?: string
          use_count?: number
        }
        Relationships: []
      }
      profiles: {
        Row: {
          account_type: Database["public"]["Enums"]["account_type"] | null
          business_name: string | null
          contact_email: string | null
          contact_phone: string | null
          created_at: string
          demo_seeded_at: string | null
          demo_year_offset: number
          full_name: string | null
          id: string
          logo_url: string | null
          onboarding_completed: boolean
          onboarding_steps: Json
          phased_generation_enabled: boolean
          plan_quota_limit: number
          plan_quota_used: number
          primary_color: string | null
          tagline: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          account_type?: Database["public"]["Enums"]["account_type"] | null
          business_name?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          demo_seeded_at?: string | null
          demo_year_offset?: number
          full_name?: string | null
          id?: string
          logo_url?: string | null
          onboarding_completed?: boolean
          onboarding_steps?: Json
          phased_generation_enabled?: boolean
          plan_quota_limit?: number
          plan_quota_used?: number
          primary_color?: string | null
          tagline?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          account_type?: Database["public"]["Enums"]["account_type"] | null
          business_name?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          demo_seeded_at?: string | null
          demo_year_offset?: number
          full_name?: string | null
          id?: string
          logo_url?: string | null
          onboarding_completed?: boolean
          onboarding_steps?: Json
          phased_generation_enabled?: boolean
          plan_quota_limit?: number
          plan_quota_used?: number
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
      system_iterations: {
        Row: {
          affected_modules: string[]
          code: string
          created_at: string
          created_by: string | null
          id: string
          shipped_at: string
          summary: string
          title: string
        }
        Insert: {
          affected_modules?: string[]
          code: string
          created_at?: string
          created_by?: string | null
          id?: string
          shipped_at?: string
          summary: string
          title: string
        }
        Update: {
          affected_modules?: string[]
          code?: string
          created_at?: string
          created_by?: string | null
          id?: string
          shipped_at?: string
          summary?: string
          title?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      workout_plan_days: {
        Row: {
          approved_at: string | null
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
          validation_meta: Json
          week_number: number
        }
        Insert: {
          approved_at?: string | null
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
          validation_meta?: Json
          week_number: number
        }
        Update: {
          approved_at?: string | null
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
          validation_meta?: Json
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
          assessment_completion_pct: number | null
          assessment_id: string | null
          block_number: number
          block_transition_summary: string | null
          blueprint: Json | null
          brief: Json | null
          client_id: string
          completion_state: string | null
          created_at: string
          demo_critique: Json | null
          duration_weeks: number | null
          generation_meta: Json
          generation_state: Json
          generation_status: string
          id: string
          is_demo: boolean
          knowledge_profile_id: string | null
          knowledge_profile_version: number | null
          plan_data: Json
          plan_data_version: number
          prescription_parameters: Json
          prior_plan_id: string | null
          programming_variables: Json | null
          progression_plan: Json | null
          red_flag_accommodations: Json | null
          share_token: string | null
          share_token_expires_at: string | null
          status: string
          summary: string | null
          title: string
          trainer_id: string
          updated_at: string
        }
        Insert: {
          assessment_completion_pct?: number | null
          assessment_id?: string | null
          block_number?: number
          block_transition_summary?: string | null
          blueprint?: Json | null
          brief?: Json | null
          client_id: string
          completion_state?: string | null
          created_at?: string
          demo_critique?: Json | null
          duration_weeks?: number | null
          generation_meta?: Json
          generation_state?: Json
          generation_status?: string
          id?: string
          is_demo?: boolean
          knowledge_profile_id?: string | null
          knowledge_profile_version?: number | null
          plan_data?: Json
          plan_data_version?: number
          prescription_parameters?: Json
          prior_plan_id?: string | null
          programming_variables?: Json | null
          progression_plan?: Json | null
          red_flag_accommodations?: Json | null
          share_token?: string | null
          share_token_expires_at?: string | null
          status?: string
          summary?: string | null
          title?: string
          trainer_id: string
          updated_at?: string
        }
        Update: {
          assessment_completion_pct?: number | null
          assessment_id?: string | null
          block_number?: number
          block_transition_summary?: string | null
          blueprint?: Json | null
          brief?: Json | null
          client_id?: string
          completion_state?: string | null
          created_at?: string
          demo_critique?: Json | null
          duration_weeks?: number | null
          generation_meta?: Json
          generation_state?: Json
          generation_status?: string
          id?: string
          is_demo?: boolean
          knowledge_profile_id?: string | null
          knowledge_profile_version?: number | null
          plan_data?: Json
          plan_data_version?: number
          prescription_parameters?: Json
          prior_plan_id?: string | null
          programming_variables?: Json | null
          progression_plan?: Json | null
          red_flag_accommodations?: Json | null
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
          {
            foreignKeyName: "workout_plans_knowledge_profile_id_fkey"
            columns: ["knowledge_profile_id"]
            isOneToOne: false
            referencedRelation: "knowledge_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workout_plans_prior_plan_id_fkey"
            columns: ["prior_plan_id"]
            isOneToOne: false
            referencedRelation: "workout_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      workout_sessions: {
        Row: {
          client_feedback: Json | null
          created_at: string
          day_label: string
          entries: Json
          id: string
          logged_by: string
          plan_data_version: number
          plan_id: string
          pr_celebrated_at: string | null
          session_date: string
          session_notes: string | null
          status: Database["public"]["Enums"]["session_status"]
          trainer_id: string
          updated_at: string
          week_number: number
        }
        Insert: {
          client_feedback?: Json | null
          created_at?: string
          day_label: string
          entries?: Json
          id?: string
          logged_by?: string
          plan_data_version?: number
          plan_id: string
          pr_celebrated_at?: string | null
          session_date?: string
          session_notes?: string | null
          status?: Database["public"]["Enums"]["session_status"]
          trainer_id: string
          updated_at?: string
          week_number: number
        }
        Update: {
          client_feedback?: Json | null
          created_at?: string
          day_label?: string
          entries?: Json
          id?: string
          logged_by?: string
          plan_data_version?: number
          plan_id?: string
          pr_celebrated_at?: string | null
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
      backfill_measurement_snapshots_phase_a: {
        Args: never
        Returns: {
          inserted_count: number
          source: string
        }[]
      }
      can_create_more_plans: { Args: { _user_id: string }; Returns: boolean }
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
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      tier_to_plan_quota: { Args: { _tier: string }; Returns: number }
    }
    Enums: {
      account_type: "coach" | "solo" | "coached_client"
      app_role: "admin" | "coach"
      intake_status: "not_sent" | "sent" | "opened" | "submitted" | "reviewed"
      mission_kind:
        | "parq"
        | "rockport"
        | "blood_pressure"
        | "gym_class"
        | "photos"
        | "custom"
      mission_status: "pending" | "in_progress" | "done" | "skipped"
      session_status: "done" | "partial" | "missed" | "in_progress"
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
      account_type: ["coach", "solo", "coached_client"],
      app_role: ["admin", "coach"],
      intake_status: ["not_sent", "sent", "opened", "submitted", "reviewed"],
      mission_kind: [
        "parq",
        "rockport",
        "blood_pressure",
        "gym_class",
        "photos",
        "custom",
      ],
      mission_status: ["pending", "in_progress", "done", "skipped"],
      session_status: ["done", "partial", "missed", "in_progress"],
    },
  },
} as const
