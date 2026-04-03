export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
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
      body_composition_logs: {
        Row: {
          arm_right_cm: number | null
          bmi: number | null
          chest_cm: number | null
          created_at: string | null
          date: string
          fat_mass_kg: number | null
          fat_pct: number | null
          id: string
          muscle_mass_kg: number | null
          notes: string | null
          source: string | null
          thigh_right_cm: number | null
          updated_at: string | null
          user_id: string
          waist_cm: number | null
          weight_kg: number | null
        }
        Insert: {
          arm_right_cm?: number | null
          bmi?: number | null
          chest_cm?: number | null
          created_at?: string | null
          date: string
          fat_mass_kg?: number | null
          fat_pct?: number | null
          id?: string
          muscle_mass_kg?: number | null
          notes?: string | null
          source?: string | null
          thigh_right_cm?: number | null
          updated_at?: string | null
          user_id: string
          waist_cm?: number | null
          weight_kg?: number | null
        }
        Update: {
          arm_right_cm?: number | null
          bmi?: number | null
          chest_cm?: number | null
          created_at?: string | null
          date?: string
          fat_mass_kg?: number | null
          fat_pct?: number | null
          id?: string
          muscle_mass_kg?: number | null
          notes?: string | null
          source?: string | null
          thigh_right_cm?: number | null
          updated_at?: string | null
          user_id?: string
          waist_cm?: number | null
          weight_kg?: number | null
        }
        Relationships: []
      }
      body_weight_logs: {
        Row: {
          created_at: string
          date: string
          id: string
          source: string
          user_id: string
          weight_kg: number
        }
        Insert: {
          created_at?: string
          date: string
          id?: string
          source?: string
          user_id: string
          weight_kg: number
        }
        Update: {
          created_at?: string
          date?: string
          id?: string
          source?: string
          user_id?: string
          weight_kg?: number
        }
        Relationships: [
          {
            foreignKeyName: "body_weight_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          content: string
          context_used: Json | null
          created_at: string | null
          id: string
          message_type: string | null
          role: string
          session_id: string | null
          tokens_used: number | null
          user_id: string
        }
        Insert: {
          content: string
          context_used?: Json | null
          created_at?: string | null
          id?: string
          message_type?: string | null
          role: string
          session_id?: string | null
          tokens_used?: number | null
          user_id: string
        }
        Update: {
          content?: string
          context_used?: Json | null
          created_at?: string | null
          id?: string
          message_type?: string | null
          role?: string
          session_id?: string | null
          tokens_used?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "chat_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_messages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_sessions: {
        Row: {
          created_at: string | null
          id: string
          last_message_at: string | null
          message_count: number | null
          started_at: string | null
          title: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          last_message_at?: string | null
          message_count?: number | null
          started_at?: string | null
          title?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          last_message_at?: string | null
          message_count?: number | null
          started_at?: string | null
          title?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      coaching_memory: {
        Row: {
          category: string
          created_at: string
          id: string
          key: string
          source_date: string
          updated_at: string
          user_id: string
          value: string
        }
        Insert: {
          category: string
          created_at?: string
          id?: string
          key: string
          source_date?: string
          updated_at?: string
          user_id: string
          value: string
        }
        Update: {
          category?: string
          created_at?: string
          id?: string
          key?: string
          source_date?: string
          updated_at?: string
          user_id?: string
          value?: string
        }
        Relationships: []
      }
      daily_activity: {
        Row: {
          active_calories: number | null
          active_minutes: number | null
          created_at: string | null
          date: string
          hrv_average: number | null
          id: string
          resting_heart_rate: number | null
          source: string | null
          stand_hours: number | null
          steps: number | null
          total_calories: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          active_calories?: number | null
          active_minutes?: number | null
          created_at?: string | null
          date: string
          hrv_average?: number | null
          id?: string
          resting_heart_rate?: number | null
          source?: string | null
          stand_hours?: number | null
          steps?: number | null
          total_calories?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          active_calories?: number | null
          active_minutes?: number | null
          created_at?: string | null
          date?: string
          hrv_average?: number | null
          id?: string
          resting_heart_rate?: number | null
          source?: string | null
          stand_hours?: number | null
          steps?: number | null
          total_calories?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_activity_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_aggregations: {
        Row: {
          created_at: string | null
          date: string
          gym_minutes: number | null
          hrv: number | null
          id: string
          is_rest_day: boolean | null
          movement_pattern_volume: Json | null
          muscle_load: Json | null
          padel_minutes: number | null
          resting_heart_rate: number | null
          running_minutes: number | null
          total_reps: number | null
          total_running_km: number | null
          total_sets: number | null
          total_tonnage_kg: number | null
          total_training_minutes: number | null
          training_load_score: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          date: string
          gym_minutes?: number | null
          hrv?: number | null
          id?: string
          is_rest_day?: boolean | null
          movement_pattern_volume?: Json | null
          muscle_load?: Json | null
          padel_minutes?: number | null
          resting_heart_rate?: number | null
          running_minutes?: number | null
          total_reps?: number | null
          total_running_km?: number | null
          total_sets?: number | null
          total_tonnage_kg?: number | null
          total_training_minutes?: number | null
          training_load_score?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          date?: string
          gym_minutes?: number | null
          hrv?: number | null
          id?: string
          is_rest_day?: boolean | null
          movement_pattern_volume?: Json | null
          muscle_load?: Json | null
          padel_minutes?: number | null
          resting_heart_rate?: number | null
          running_minutes?: number | null
          total_reps?: number | null
          total_running_km?: number | null
          total_sets?: number | null
          total_tonnage_kg?: number | null
          total_training_minutes?: number | null
          training_load_score?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_aggregations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_nutrition_summary: {
        Row: {
          calorie_status: string | null
          calorie_target: number | null
          created_at: string | null
          date: string
          id: string
          protein_status: string | null
          protein_target_g: number | null
          total_calories: number | null
          total_carbs_g: number | null
          total_fat_g: number | null
          total_fiber_g: number | null
          total_protein_g: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          calorie_status?: string | null
          calorie_target?: number | null
          created_at?: string | null
          date: string
          id?: string
          protein_status?: string | null
          protein_target_g?: number | null
          total_calories?: number | null
          total_carbs_g?: number | null
          total_fat_g?: number | null
          total_fiber_g?: number | null
          total_protein_g?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          calorie_status?: string | null
          calorie_target?: number | null
          created_at?: string | null
          date?: string
          id?: string
          protein_status?: string | null
          protein_target_g?: number | null
          total_calories?: number | null
          total_carbs_g?: number | null
          total_fat_g?: number | null
          total_fiber_g?: number | null
          total_protein_g?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_nutrition_summary_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      exercise_definitions: {
        Row: {
          category: string | null
          created_at: string | null
          equipment: string | null
          hevy_exercise_id: string | null
          id: string
          image_url: string | null
          is_compound: boolean | null
          movement_pattern: string
          name: string
          primary_muscle_group: string
          secondary_muscle_groups: string[] | null
          sport_specificity: string[] | null
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          equipment?: string | null
          hevy_exercise_id?: string | null
          id?: string
          image_url?: string | null
          is_compound?: boolean | null
          movement_pattern: string
          name: string
          primary_muscle_group: string
          secondary_muscle_groups?: string[] | null
          sport_specificity?: string[] | null
        }
        Update: {
          category?: string | null
          created_at?: string | null
          equipment?: string | null
          hevy_exercise_id?: string | null
          id?: string
          image_url?: string | null
          is_compound?: boolean | null
          movement_pattern?: string
          name?: string
          primary_muscle_group?: string
          secondary_muscle_groups?: string[] | null
          sport_specificity?: string[] | null
        }
        Relationships: []
      }
      goals: {
        Row: {
          category: string
          completed_at: string | null
          created_at: string | null
          current_value: number | null
          deadline: string | null
          description: string | null
          id: string
          priority: number | null
          status: string | null
          target_type: string
          target_unit: string | null
          target_value: number | null
          title: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          category: string
          completed_at?: string | null
          created_at?: string | null
          current_value?: number | null
          deadline?: string | null
          description?: string | null
          id?: string
          priority?: number | null
          status?: string | null
          target_type: string
          target_unit?: string | null
          target_value?: number | null
          title: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          category?: string
          completed_at?: string | null
          created_at?: string | null
          current_value?: number | null
          deadline?: string | null
          description?: string | null
          id?: string
          priority?: number | null
          status?: string | null
          target_type?: string
          target_unit?: string | null
          target_value?: number | null
          title?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "goals_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      hevy_routines: {
        Row: {
          created_at: string
          exercises: Json
          folder_id: string | null
          hevy_routine_id: string
          id: string
          title: string
          updated_at: string
          updated_at_hevy: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          exercises?: Json
          folder_id?: string | null
          hevy_routine_id: string
          id?: string
          title: string
          updated_at?: string
          updated_at_hevy?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          exercises?: Json
          folder_id?: string | null
          hevy_routine_id?: string
          id?: string
          title?: string
          updated_at?: string
          updated_at_hevy?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "hevy_routines_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      injury_logs: {
        Row: {
          ai_analysis: string | null
          ai_recommendations: string | null
          body_location: string
          created_at: string | null
          date: string
          description: string
          id: string
          related_workout_ids: string[] | null
          resolved_at: string | null
          severity: string | null
          status: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          ai_analysis?: string | null
          ai_recommendations?: string | null
          body_location: string
          created_at?: string | null
          date: string
          description: string
          id?: string
          related_workout_ids?: string[] | null
          resolved_at?: string | null
          severity?: string | null
          status?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          ai_analysis?: string | null
          ai_recommendations?: string | null
          body_location?: string
          created_at?: string | null
          date?: string
          description?: string
          id?: string
          related_workout_ids?: string[] | null
          resolved_at?: string | null
          severity?: string | null
          status?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "injury_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      monthly_aggregations: {
        Row: {
          avg_daily_calories: number | null
          avg_daily_protein_g: number | null
          avg_weekly_km: number | null
          avg_weekly_sessions: number | null
          avg_weekly_tonnage: number | null
          created_at: string | null
          gym_sessions: number | null
          id: string
          injury_count: number | null
          month: number
          padel_sessions: number | null
          prs_achieved: Json | null
          running_highlights: Json | null
          running_sessions: number | null
          strength_highlights: Json | null
          total_running_km: number | null
          total_sessions: number | null
          total_tonnage_kg: number | null
          total_training_hours: number | null
          updated_at: string | null
          user_id: string
          year: number
        }
        Insert: {
          avg_daily_calories?: number | null
          avg_daily_protein_g?: number | null
          avg_weekly_km?: number | null
          avg_weekly_sessions?: number | null
          avg_weekly_tonnage?: number | null
          created_at?: string | null
          gym_sessions?: number | null
          id?: string
          injury_count?: number | null
          month: number
          padel_sessions?: number | null
          prs_achieved?: Json | null
          running_highlights?: Json | null
          running_sessions?: number | null
          strength_highlights?: Json | null
          total_running_km?: number | null
          total_sessions?: number | null
          total_tonnage_kg?: number | null
          total_training_hours?: number | null
          updated_at?: string | null
          user_id: string
          year: number
        }
        Update: {
          avg_daily_calories?: number | null
          avg_daily_protein_g?: number | null
          avg_weekly_km?: number | null
          avg_weekly_sessions?: number | null
          avg_weekly_tonnage?: number | null
          created_at?: string | null
          gym_sessions?: number | null
          id?: string
          injury_count?: number | null
          month?: number
          padel_sessions?: number | null
          prs_achieved?: Json | null
          running_highlights?: Json | null
          running_sessions?: number | null
          strength_highlights?: Json | null
          total_running_km?: number | null
          total_sessions?: number | null
          total_tonnage_kg?: number | null
          total_training_hours?: number | null
          updated_at?: string | null
          user_id?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "monthly_aggregations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      nutrition_logs: {
        Row: {
          ai_analysis: string | null
          confidence: string | null
          created_at: string | null
          date: string
          estimated_calories: number | null
          estimated_carbs_g: number | null
          estimated_fat_g: number | null
          estimated_fiber_g: number | null
          estimated_protein_g: number | null
          id: string
          meal_type: string | null
          raw_input: string
          time_of_day: string | null
          user_id: string
        }
        Insert: {
          ai_analysis?: string | null
          confidence?: string | null
          created_at?: string | null
          date: string
          estimated_calories?: number | null
          estimated_carbs_g?: number | null
          estimated_fat_g?: number | null
          estimated_fiber_g?: number | null
          estimated_protein_g?: number | null
          id?: string
          meal_type?: string | null
          raw_input: string
          time_of_day?: string | null
          user_id: string
        }
        Update: {
          ai_analysis?: string | null
          confidence?: string | null
          created_at?: string | null
          date?: string
          estimated_calories?: number | null
          estimated_carbs_g?: number | null
          estimated_fat_g?: number | null
          estimated_fiber_g?: number | null
          estimated_protein_g?: number | null
          id?: string
          meal_type?: string | null
          raw_input?: string
          time_of_day?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "nutrition_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      padel_sessions: {
        Row: {
          apple_health_id: string | null
          avg_heart_rate: number | null
          calories_burned: number | null
          created_at: string | null
          duration_seconds: number
          ended_at: string | null
          id: string
          intensity: string | null
          max_heart_rate: number | null
          notes: string | null
          session_type: string | null
          source: string
          started_at: string
          user_id: string
        }
        Insert: {
          apple_health_id?: string | null
          avg_heart_rate?: number | null
          calories_burned?: number | null
          created_at?: string | null
          duration_seconds: number
          ended_at?: string | null
          id?: string
          intensity?: string | null
          max_heart_rate?: number | null
          notes?: string | null
          session_type?: string | null
          source?: string
          started_at: string
          user_id: string
        }
        Update: {
          apple_health_id?: string | null
          avg_heart_rate?: number | null
          calories_burned?: number | null
          created_at?: string | null
          duration_seconds?: number
          ended_at?: string | null
          id?: string
          intensity?: string | null
          max_heart_rate?: number | null
          notes?: string | null
          session_type?: string | null
          source?: string
          started_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "padel_sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      personal_records: {
        Row: {
          achieved_at: string
          created_at: string | null
          exercise_definition_id: string | null
          id: string
          previous_record: number | null
          record_category: string
          record_type: string
          run_id: string | null
          unit: string
          user_id: string
          value: number
          workout_id: string | null
        }
        Insert: {
          achieved_at: string
          created_at?: string | null
          exercise_definition_id?: string | null
          id?: string
          previous_record?: number | null
          record_category: string
          record_type: string
          run_id?: string | null
          unit: string
          user_id: string
          value: number
          workout_id?: string | null
        }
        Update: {
          achieved_at?: string
          created_at?: string | null
          exercise_definition_id?: string | null
          id?: string
          previous_record?: number | null
          record_category?: string
          record_type?: string
          run_id?: string | null
          unit?: string
          user_id?: string
          value?: number
          workout_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "personal_records_exercise_definition_id_fkey"
            columns: ["exercise_definition_id"]
            isOneToOne: false
            referencedRelation: "exercise_definitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "personal_records_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "personal_records_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "personal_records_workout_id_fkey"
            columns: ["workout_id"]
            isOneToOne: false
            referencedRelation: "workouts"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          activity_level: string | null
          created_at: string | null
          date_of_birth: string | null
          dietary_preference: string | null
          display_name: string
          height_cm: number | null
          id: string
          updated_at: string | null
          weight_kg: number | null
        }
        Insert: {
          activity_level?: string | null
          created_at?: string | null
          date_of_birth?: string | null
          dietary_preference?: string | null
          display_name: string
          height_cm?: number | null
          id: string
          updated_at?: string | null
          weight_kg?: number | null
        }
        Update: {
          activity_level?: string | null
          created_at?: string | null
          date_of_birth?: string | null
          dietary_preference?: string | null
          display_name?: string
          height_cm?: number | null
          id?: string
          updated_at?: string | null
          weight_kg?: number | null
        }
        Relationships: []
      }
      runs: {
        Row: {
          apple_health_id: string | null
          avg_heart_rate: number | null
          avg_pace_seconds_per_km: number | null
          calories_burned: number | null
          created_at: string | null
          distance_meters: number
          duration_seconds: number
          elevation_gain_meters: number | null
          ended_at: string | null
          id: string
          max_heart_rate: number | null
          notes: string | null
          run_type: string | null
          source: string
          started_at: string
          user_id: string
        }
        Insert: {
          apple_health_id?: string | null
          avg_heart_rate?: number | null
          avg_pace_seconds_per_km?: number | null
          calories_burned?: number | null
          created_at?: string | null
          distance_meters: number
          duration_seconds: number
          elevation_gain_meters?: number | null
          ended_at?: string | null
          id?: string
          max_heart_rate?: number | null
          notes?: string | null
          run_type?: string | null
          source?: string
          started_at: string
          user_id: string
        }
        Update: {
          apple_health_id?: string | null
          avg_heart_rate?: number | null
          avg_pace_seconds_per_km?: number | null
          calories_burned?: number | null
          created_at?: string | null
          distance_meters?: number
          duration_seconds?: number
          elevation_gain_meters?: number | null
          ended_at?: string | null
          id?: string
          max_heart_rate?: number | null
          notes?: string | null
          run_type?: string | null
          source?: string
          started_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "runs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      schema_block_summaries: {
        Row: {
          adherence_percentage: number | null
          created_at: string | null
          end_reason: string | null
          exercises_used: string[] | null
          id: string
          key_progressions: Json | null
          schema_id: string
          summary: string
          total_sessions_completed: number | null
          total_sessions_planned: number | null
          user_id: string
        }
        Insert: {
          adherence_percentage?: number | null
          created_at?: string | null
          end_reason?: string | null
          exercises_used?: string[] | null
          id?: string
          key_progressions?: Json | null
          schema_id: string
          summary: string
          total_sessions_completed?: number | null
          total_sessions_planned?: number | null
          user_id: string
        }
        Update: {
          adherence_percentage?: number | null
          created_at?: string | null
          end_reason?: string | null
          exercises_used?: string[] | null
          id?: string
          key_progressions?: Json | null
          schema_id?: string
          summary?: string
          total_sessions_completed?: number | null
          total_sessions_planned?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "schema_block_summaries_schema_id_fkey"
            columns: ["schema_id"]
            isOneToOne: false
            referencedRelation: "training_schemas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schema_block_summaries_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      sleep_logs: {
        Row: {
          awake_minutes: number | null
          created_at: string
          date: string
          deep_sleep_minutes: number | null
          id: string
          light_sleep_minutes: number | null
          rem_sleep_minutes: number | null
          sleep_efficiency: number | null
          sleep_end: string | null
          sleep_start: string | null
          source: string
          total_sleep_minutes: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          awake_minutes?: number | null
          created_at?: string
          date: string
          deep_sleep_minutes?: number | null
          id?: string
          light_sleep_minutes?: number | null
          rem_sleep_minutes?: number | null
          sleep_efficiency?: number | null
          sleep_end?: string | null
          sleep_start?: string | null
          source?: string
          total_sleep_minutes?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          awake_minutes?: number | null
          created_at?: string
          date?: string
          deep_sleep_minutes?: number | null
          id?: string
          light_sleep_minutes?: number | null
          rem_sleep_minutes?: number | null
          sleep_efficiency?: number | null
          sleep_end?: string | null
          sleep_start?: string | null
          source?: string
          total_sleep_minutes?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sleep_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      training_schemas: {
        Row: {
          ai_generated: boolean | null
          created_at: string | null
          current_week: number | null
          description: string | null
          end_date: string | null
          generation_context: string | null
          id: string
          is_active: boolean | null
          progression_rules: Json | null
          scheduled_overrides: Json | null
          schema_type: string
          start_date: string
          title: string
          updated_at: string | null
          user_id: string
          weeks_planned: number | null
          workout_schedule: Json
        }
        Insert: {
          ai_generated?: boolean | null
          created_at?: string | null
          current_week?: number | null
          description?: string | null
          end_date?: string | null
          generation_context?: string | null
          id?: string
          is_active?: boolean | null
          progression_rules?: Json | null
          scheduled_overrides?: Json | null
          schema_type: string
          start_date: string
          title: string
          updated_at?: string | null
          user_id: string
          weeks_planned?: number | null
          workout_schedule?: Json
        }
        Update: {
          ai_generated?: boolean | null
          created_at?: string | null
          current_week?: number | null
          description?: string | null
          end_date?: string | null
          generation_context?: string | null
          id?: string
          is_active?: boolean | null
          progression_rules?: Json | null
          scheduled_overrides?: Json | null
          schema_type?: string
          start_date?: string
          title?: string
          updated_at?: string | null
          user_id?: string
          weeks_planned?: number | null
          workout_schedule?: Json
        }
        Relationships: [
          {
            foreignKeyName: "training_schemas_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_settings: {
        Row: {
          ai_custom_instructions: string | null
          created_at: string | null
          google_calendar_access_token: string | null
          google_calendar_email: string | null
          google_calendar_refresh_token: string | null
          google_calendar_token_expiry: string | null
          health_auto_export_token: string | null
          hevy_api_key: string | null
          last_apple_health_sync_at: string | null
          last_hevy_sync_at: string | null
          preferred_unit_system: string | null
          protein_target_per_kg: number | null
          updated_at: string | null
          user_id: string
          weekly_training_target: Json | null
        }
        Insert: {
          ai_custom_instructions?: string | null
          created_at?: string | null
          google_calendar_access_token?: string | null
          google_calendar_email?: string | null
          google_calendar_refresh_token?: string | null
          google_calendar_token_expiry?: string | null
          health_auto_export_token?: string | null
          hevy_api_key?: string | null
          last_apple_health_sync_at?: string | null
          last_hevy_sync_at?: string | null
          preferred_unit_system?: string | null
          protein_target_per_kg?: number | null
          updated_at?: string | null
          user_id: string
          weekly_training_target?: Json | null
        }
        Update: {
          ai_custom_instructions?: string | null
          created_at?: string | null
          google_calendar_access_token?: string | null
          google_calendar_email?: string | null
          google_calendar_refresh_token?: string | null
          google_calendar_token_expiry?: string | null
          health_auto_export_token?: string | null
          hevy_api_key?: string | null
          last_apple_health_sync_at?: string | null
          last_hevy_sync_at?: string | null
          preferred_unit_system?: string | null
          protein_target_per_kg?: number | null
          updated_at?: string | null
          user_id?: string
          weekly_training_target?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "user_settings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      weekly_aggregations: {
        Row: {
          acute_chronic_ratio: number | null
          acute_load: number | null
          adherence_percentage: number | null
          avg_daily_calories: number | null
          avg_daily_protein_g: number | null
          avg_hrv: number | null
          avg_resting_heart_rate: number | null
          chronic_load: number | null
          completed_sessions: number | null
          created_at: string | null
          gym_sessions: number | null
          id: string
          padel_sessions: number | null
          planned_sessions: number | null
          running_sessions: number | null
          total_running_km: number | null
          total_sessions: number | null
          total_tonnage_kg: number | null
          total_training_minutes: number | null
          updated_at: string | null
          user_id: string
          week_number: number
          week_start: string
          week_training_load_total: number | null
          weekly_movement_volume: Json | null
          weekly_muscle_load: Json | null
          workload_status: string | null
          year: number
        }
        Insert: {
          acute_chronic_ratio?: number | null
          acute_load?: number | null
          adherence_percentage?: number | null
          avg_daily_calories?: number | null
          avg_daily_protein_g?: number | null
          avg_hrv?: number | null
          avg_resting_heart_rate?: number | null
          chronic_load?: number | null
          completed_sessions?: number | null
          created_at?: string | null
          gym_sessions?: number | null
          id?: string
          padel_sessions?: number | null
          planned_sessions?: number | null
          running_sessions?: number | null
          total_running_km?: number | null
          total_sessions?: number | null
          total_tonnage_kg?: number | null
          total_training_minutes?: number | null
          updated_at?: string | null
          user_id: string
          week_number: number
          week_start: string
          week_training_load_total?: number | null
          weekly_movement_volume?: Json | null
          weekly_muscle_load?: Json | null
          workload_status?: string | null
          year: number
        }
        Update: {
          acute_chronic_ratio?: number | null
          acute_load?: number | null
          adherence_percentage?: number | null
          avg_daily_calories?: number | null
          avg_daily_protein_g?: number | null
          avg_hrv?: number | null
          avg_resting_heart_rate?: number | null
          chronic_load?: number | null
          completed_sessions?: number | null
          created_at?: string | null
          gym_sessions?: number | null
          id?: string
          padel_sessions?: number | null
          planned_sessions?: number | null
          running_sessions?: number | null
          total_running_km?: number | null
          total_sessions?: number | null
          total_tonnage_kg?: number | null
          total_training_minutes?: number | null
          updated_at?: string | null
          user_id?: string
          week_number?: number
          week_start?: string
          week_training_load_total?: number | null
          weekly_movement_volume?: Json | null
          weekly_muscle_load?: Json | null
          workload_status?: string | null
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "weekly_aggregations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      weekly_reviews: {
        Row: {
          calendar_synced: boolean | null
          completed_at: string | null
          created_at: string | null
          highlights: Json | null
          id: string
          inbody_fat_mass_kg: number | null
          inbody_fat_pct: number | null
          inbody_muscle_mass_kg: number | null
          inbody_waist_cm: number | null
          inbody_weight_kg: number | null
          manual_additions: Json | null
          next_week_plan: Json | null
          sessions_completed: number | null
          sessions_planned: number | null
          summary_text: string | null
          updated_at: string | null
          user_id: string
          week_end: string
          week_number: number
          week_start: string
        }
        Insert: {
          calendar_synced?: boolean | null
          completed_at?: string | null
          created_at?: string | null
          highlights?: Json | null
          id?: string
          inbody_fat_mass_kg?: number | null
          inbody_fat_pct?: number | null
          inbody_muscle_mass_kg?: number | null
          inbody_waist_cm?: number | null
          inbody_weight_kg?: number | null
          manual_additions?: Json | null
          next_week_plan?: Json | null
          sessions_completed?: number | null
          sessions_planned?: number | null
          summary_text?: string | null
          updated_at?: string | null
          user_id: string
          week_end: string
          week_number: number
          week_start: string
        }
        Update: {
          calendar_synced?: boolean | null
          completed_at?: string | null
          created_at?: string | null
          highlights?: Json | null
          id?: string
          inbody_fat_mass_kg?: number | null
          inbody_fat_pct?: number | null
          inbody_muscle_mass_kg?: number | null
          inbody_waist_cm?: number | null
          inbody_weight_kg?: number | null
          manual_additions?: Json | null
          next_week_plan?: Json | null
          sessions_completed?: number | null
          sessions_planned?: number | null
          summary_text?: string | null
          updated_at?: string | null
          user_id?: string
          week_end?: string
          week_number?: number
          week_start?: string
        }
        Relationships: []
      }
      workout_exercises: {
        Row: {
          created_at: string | null
          exercise_definition_id: string
          exercise_order: number
          id: string
          notes: string | null
          workout_id: string
        }
        Insert: {
          created_at?: string | null
          exercise_definition_id: string
          exercise_order: number
          id?: string
          notes?: string | null
          workout_id: string
        }
        Update: {
          created_at?: string | null
          exercise_definition_id?: string
          exercise_order?: number
          id?: string
          notes?: string | null
          workout_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workout_exercises_exercise_definition_id_fkey"
            columns: ["exercise_definition_id"]
            isOneToOne: false
            referencedRelation: "exercise_definitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workout_exercises_workout_id_fkey"
            columns: ["workout_id"]
            isOneToOne: false
            referencedRelation: "workouts"
            referencedColumns: ["id"]
          },
        ]
      }
      workout_sets: {
        Row: {
          created_at: string | null
          distance_meters: number | null
          duration_seconds: number | null
          id: string
          reps: number | null
          rpe: number | null
          set_order: number
          set_type: string | null
          weight_kg: number | null
          workout_exercise_id: string
        }
        Insert: {
          created_at?: string | null
          distance_meters?: number | null
          duration_seconds?: number | null
          id?: string
          reps?: number | null
          rpe?: number | null
          set_order: number
          set_type?: string | null
          weight_kg?: number | null
          workout_exercise_id: string
        }
        Update: {
          created_at?: string | null
          distance_meters?: number | null
          duration_seconds?: number | null
          id?: string
          reps?: number | null
          rpe?: number | null
          set_order?: number
          set_type?: string | null
          weight_kg?: number | null
          workout_exercise_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workout_sets_workout_exercise_id_fkey"
            columns: ["workout_exercise_id"]
            isOneToOne: false
            referencedRelation: "workout_exercises"
            referencedColumns: ["id"]
          },
        ]
      }
      workouts: {
        Row: {
          avg_heart_rate: number | null
          calories_burned: number | null
          created_at: string | null
          duration_seconds: number | null
          ended_at: string | null
          exercise_count: number | null
          hevy_workout_id: string | null
          id: string
          max_heart_rate: number | null
          notes: string | null
          pr_count: number | null
          set_count: number | null
          source: string
          started_at: string
          title: string
          total_volume_kg: number | null
          user_id: string
        }
        Insert: {
          avg_heart_rate?: number | null
          calories_burned?: number | null
          created_at?: string | null
          duration_seconds?: number | null
          ended_at?: string | null
          exercise_count?: number | null
          hevy_workout_id?: string | null
          id?: string
          max_heart_rate?: number | null
          notes?: string | null
          pr_count?: number | null
          set_count?: number | null
          source?: string
          started_at: string
          title: string
          total_volume_kg?: number | null
          user_id: string
        }
        Update: {
          avg_heart_rate?: number | null
          calories_burned?: number | null
          created_at?: string | null
          duration_seconds?: number | null
          ended_at?: string | null
          exercise_count?: number | null
          hevy_workout_id?: string | null
          id?: string
          max_heart_rate?: number | null
          notes?: string | null
          pr_count?: number | null
          set_count?: number | null
          source?: string
          started_at?: string
          title?: string
          total_volume_kg?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workouts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const

