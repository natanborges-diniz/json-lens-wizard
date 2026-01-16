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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      budgets: {
        Row: {
          ai_description: string | null
          base_price: number
          created_at: string
          extra_discount_type: string | null
          extra_discount_value: number | null
          family_id: string
          family_name: string
          final_total: number
          finalized_at: string | null
          id: string
          is_finalized: boolean | null
          notes: string | null
          payment_discount_percent: number | null
          payment_method: string | null
          second_pair_description: string | null
          second_pair_enabled: boolean | null
          second_pair_price: number | null
          selected_index: string
          selected_treatments: string[] | null
          service_id: string
          subtotal: number
          supplier: string
          total_discount: number | null
          updated_at: string
        }
        Insert: {
          ai_description?: string | null
          base_price: number
          created_at?: string
          extra_discount_type?: string | null
          extra_discount_value?: number | null
          family_id: string
          family_name: string
          final_total: number
          finalized_at?: string | null
          id?: string
          is_finalized?: boolean | null
          notes?: string | null
          payment_discount_percent?: number | null
          payment_method?: string | null
          second_pair_description?: string | null
          second_pair_enabled?: boolean | null
          second_pair_price?: number | null
          selected_index: string
          selected_treatments?: string[] | null
          service_id: string
          subtotal: number
          supplier: string
          total_discount?: number | null
          updated_at?: string
        }
        Update: {
          ai_description?: string | null
          base_price?: number
          created_at?: string
          extra_discount_type?: string | null
          extra_discount_value?: number | null
          family_id?: string
          family_name?: string
          final_total?: number
          finalized_at?: string | null
          id?: string
          is_finalized?: boolean | null
          notes?: string | null
          payment_discount_percent?: number | null
          payment_method?: string | null
          second_pair_description?: string | null
          second_pair_enabled?: boolean | null
          second_pair_price?: number | null
          selected_index?: string
          selected_treatments?: string[] | null
          service_id?: string
          subtotal?: number
          supplier?: string
          total_discount?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "budgets_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      catalog_versions: {
        Row: {
          addons_count: number | null
          changes_summary: Json | null
          created_at: string | null
          dataset_name: string | null
          families_count: number | null
          file_size_bytes: number | null
          id: string
          import_mode: string
          imported_at: string | null
          imported_by: string | null
          notes: string[] | null
          prices_count: number | null
          schema_version: string
          technologies_count: number | null
          version_number: string
        }
        Insert: {
          addons_count?: number | null
          changes_summary?: Json | null
          created_at?: string | null
          dataset_name?: string | null
          families_count?: number | null
          file_size_bytes?: number | null
          id?: string
          import_mode: string
          imported_at?: string | null
          imported_by?: string | null
          notes?: string[] | null
          prices_count?: number | null
          schema_version: string
          technologies_count?: number | null
          version_number: string
        }
        Update: {
          addons_count?: number | null
          changes_summary?: Json | null
          created_at?: string | null
          dataset_name?: string | null
          families_count?: number | null
          file_size_bytes?: number | null
          id?: string
          import_mode?: string
          imported_at?: string | null
          imported_by?: string | null
          notes?: string[] | null
          prices_count?: number | null
          schema_version?: string
          technologies_count?: number | null
          version_number?: string
        }
        Relationships: []
      }
      company_settings: {
        Row: {
          address: string | null
          budget_terms: string | null
          cnpj: string | null
          company_name: string
          created_at: string
          email: string | null
          facebook: string | null
          footer_text: string | null
          id: string
          instagram: string | null
          logo_url: string | null
          phone: string | null
          slogan: string | null
          updated_at: string
          whatsapp: string | null
        }
        Insert: {
          address?: string | null
          budget_terms?: string | null
          cnpj?: string | null
          company_name?: string
          created_at?: string
          email?: string | null
          facebook?: string | null
          footer_text?: string | null
          id?: string
          instagram?: string | null
          logo_url?: string | null
          phone?: string | null
          slogan?: string | null
          updated_at?: string
          whatsapp?: string | null
        }
        Update: {
          address?: string | null
          budget_terms?: string | null
          cnpj?: string | null
          company_name?: string
          created_at?: string
          email?: string | null
          facebook?: string | null
          footer_text?: string | null
          id?: string
          instagram?: string | null
          logo_url?: string | null
          phone?: string | null
          slogan?: string | null
          updated_at?: string
          whatsapp?: string | null
        }
        Relationships: []
      }
      customers: {
        Row: {
          birth_date: string | null
          cpf: string | null
          created_at: string
          created_by: string | null
          email: string | null
          id: string
          name: string
          notes: string | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          birth_date?: string | null
          cpf?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          birth_date?: string | null
          cpf?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string
          id: string
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name: string
          id?: string
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      sales: {
        Row: {
          budget_id: string
          created_at: string
          customer_id: string
          final_value: number
          id: string
          notes: string | null
          payment_method: string
          seller_id: string
          service_id: string
        }
        Insert: {
          budget_id: string
          created_at?: string
          customer_id: string
          final_value: number
          id?: string
          notes?: string | null
          payment_method: string
          seller_id: string
          service_id: string
        }
        Update: {
          budget_id?: string
          created_at?: string
          customer_id?: string
          final_value?: number
          id?: string
          notes?: string | null
          payment_method?: string
          seller_id?: string
          service_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_budget_id_fkey"
            columns: ["budget_id"]
            isOneToOne: true
            referencedRelation: "budgets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      services: {
        Row: {
          anamnesis_data: Json | null
          created_at: string
          customer_id: string
          frame_data: Json | null
          id: string
          lens_category: string | null
          notes: string | null
          prescription_data: Json | null
          seller_id: string
          status: Database["public"]["Enums"]["service_status"]
          updated_at: string
        }
        Insert: {
          anamnesis_data?: Json | null
          created_at?: string
          customer_id: string
          frame_data?: Json | null
          id?: string
          lens_category?: string | null
          notes?: string | null
          prescription_data?: Json | null
          seller_id: string
          status?: Database["public"]["Enums"]["service_status"]
          updated_at?: string
        }
        Update: {
          anamnesis_data?: Json | null
          created_at?: string
          customer_id?: string
          frame_data?: Json | null
          id?: string
          lens_category?: string | null
          notes?: string | null
          prescription_data?: Json | null
          seller_id?: string
          status?: Database["public"]["Enums"]["service_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "services_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      stores: {
        Row: {
          address: string | null
          budget_terms: string | null
          cnpj: string | null
          created_at: string
          email: string | null
          facebook: string | null
          footer_text: string | null
          id: string
          instagram: string | null
          is_active: boolean
          logo_url: string | null
          name: string
          phone: string | null
          slogan: string | null
          updated_at: string
          whatsapp: string | null
        }
        Insert: {
          address?: string | null
          budget_terms?: string | null
          cnpj?: string | null
          created_at?: string
          email?: string | null
          facebook?: string | null
          footer_text?: string | null
          id?: string
          instagram?: string | null
          is_active?: boolean
          logo_url?: string | null
          name: string
          phone?: string | null
          slogan?: string | null
          updated_at?: string
          whatsapp?: string | null
        }
        Update: {
          address?: string | null
          budget_terms?: string | null
          cnpj?: string | null
          created_at?: string
          email?: string | null
          facebook?: string | null
          footer_text?: string | null
          id?: string
          instagram?: string | null
          is_active?: boolean
          logo_url?: string | null
          name?: string
          phone?: string | null
          slogan?: string | null
          updated_at?: string
          whatsapp?: string | null
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
          role?: Database["public"]["Enums"]["app_role"]
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
      user_store_access: {
        Row: {
          created_at: string
          has_access_to_all: boolean
          id: string
          store_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          has_access_to_all?: boolean
          id?: string
          store_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          has_access_to_all?: boolean
          id?: string
          store_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_store_access_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin_or_manager: { Args: { _user_id: string }; Returns: boolean }
      user_has_store_access: {
        Args: { _store_id: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "manager" | "seller"
      service_status: "in_progress" | "budget_sent" | "converted" | "lost"
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
      app_role: ["admin", "manager", "seller"],
      service_status: ["in_progress", "budget_sent", "converted", "lost"],
    },
  },
} as const
