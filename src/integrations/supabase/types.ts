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
          store_id: string | null
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
          store_id?: string | null
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
          store_id?: string | null
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
          {
            foreignKeyName: "budgets_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      canonical_families: {
        Row: {
          active: boolean
          canonical_name: string
          clinical_type: string
          commercial_tier: string
          comparable_attributes: string[] | null
          confidence: Database["public"]["Enums"]["data_confidence"]
          created_at: string
          description: string | null
          id: string
          review_status: Database["public"]["Enums"]["data_review_status"]
          updated_at: string
          value_axes: Json | null
        }
        Insert: {
          active?: boolean
          canonical_name: string
          clinical_type: string
          commercial_tier: string
          comparable_attributes?: string[] | null
          confidence?: Database["public"]["Enums"]["data_confidence"]
          created_at?: string
          description?: string | null
          id?: string
          review_status?: Database["public"]["Enums"]["data_review_status"]
          updated_at?: string
          value_axes?: Json | null
        }
        Update: {
          active?: boolean
          canonical_name?: string
          clinical_type?: string
          commercial_tier?: string
          comparable_attributes?: string[] | null
          confidence?: Database["public"]["Enums"]["data_confidence"]
          created_at?: string
          description?: string | null
          id?: string
          review_status?: Database["public"]["Enums"]["data_review_status"]
          updated_at?: string
          value_axes?: Json | null
        }
        Relationships: []
      }
      canonical_materials: {
        Row: {
          active: boolean
          aesthetic_score: number | null
          canonical_name: string
          created_at: string
          description: string | null
          id: string
          refractive_index: number
          thickness_category: string | null
        }
        Insert: {
          active?: boolean
          aesthetic_score?: number | null
          canonical_name: string
          created_at?: string
          description?: string | null
          id?: string
          refractive_index: number
          thickness_category?: string | null
        }
        Update: {
          active?: boolean
          aesthetic_score?: number | null
          canonical_name?: string
          created_at?: string
          description?: string | null
          id?: string
          refractive_index?: number
          thickness_category?: string | null
        }
        Relationships: []
      }
      canonical_treatments: {
        Row: {
          active: boolean
          canonical_name: string
          created_at: string
          description: string | null
          id: string
          performance_level: number | null
          treatment_type: string
        }
        Insert: {
          active?: boolean
          canonical_name: string
          created_at?: string
          description?: string | null
          id?: string
          performance_level?: number | null
          treatment_type: string
        }
        Update: {
          active?: boolean
          canonical_name?: string
          created_at?: string
          description?: string | null
          id?: string
          performance_level?: number | null
          treatment_type?: string
        }
        Relationships: []
      }
      catalog_pending_skus: {
        Row: {
          created_at: string
          description: string | null
          erp_code: string
          id: string
          raw_data: Json | null
          resolved_at: string | null
          resolved_by: string | null
          resolved_family_id: string | null
          status: string
          supplier_code: string
          sync_run_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          erp_code: string
          id?: string
          raw_data?: Json | null
          resolved_at?: string | null
          resolved_by?: string | null
          resolved_family_id?: string | null
          status?: string
          supplier_code: string
          sync_run_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          erp_code?: string
          id?: string
          raw_data?: Json | null
          resolved_at?: string | null
          resolved_by?: string | null
          resolved_family_id?: string | null
          status?: string
          supplier_code?: string
          sync_run_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "catalog_pending_skus_sync_run_id_fkey"
            columns: ["sync_run_id"]
            isOneToOne: false
            referencedRelation: "catalog_sync_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      catalog_sync_runs: {
        Row: {
          created_at: string
          executed_by: string | null
          file_name: string | null
          id: string
          pending_skus_count: number | null
          report: Json | null
          rows_created: number | null
          rows_matched: number | null
          rows_not_found: number | null
          rows_read: number | null
          rows_updated: number | null
          run_type: string
          status: string
          supplier_code: string
        }
        Insert: {
          created_at?: string
          executed_by?: string | null
          file_name?: string | null
          id?: string
          pending_skus_count?: number | null
          report?: Json | null
          rows_created?: number | null
          rows_matched?: number | null
          rows_not_found?: number | null
          rows_read?: number | null
          rows_updated?: number | null
          run_type: string
          status?: string
          supplier_code: string
        }
        Update: {
          created_at?: string
          executed_by?: string | null
          file_name?: string | null
          id?: string
          pending_skus_count?: number | null
          report?: Json | null
          rows_created?: number | null
          rows_matched?: number | null
          rows_not_found?: number | null
          rows_read?: number | null
          rows_updated?: number | null
          run_type?: string
          status?: string
          supplier_code?: string
        }
        Relationships: [
          {
            foreignKeyName: "catalog_sync_runs_supplier_code_fkey"
            columns: ["supplier_code"]
            isOneToOne: false
            referencedRelation: "supplier_profiles"
            referencedColumns: ["supplier_code"]
          },
        ]
      }
      catalog_validation_runs: {
        Row: {
          catalog_version_id: string | null
          conflicts_detail: Json | null
          created_at: string
          critical_conflicts: number
          id: string
          published: boolean
          total_conflicts: number
          user_id: string | null
          warning_conflicts: number
        }
        Insert: {
          catalog_version_id?: string | null
          conflicts_detail?: Json | null
          created_at?: string
          critical_conflicts?: number
          id?: string
          published?: boolean
          total_conflicts?: number
          user_id?: string | null
          warning_conflicts?: number
        }
        Update: {
          catalog_version_id?: string | null
          conflicts_detail?: Json | null
          created_at?: string
          critical_conflicts?: number
          id?: string
          published?: boolean
          total_conflicts?: number
          user_id?: string | null
          warning_conflicts?: number
        }
        Relationships: []
      }
      catalog_variant_grades: {
        Row: {
          addition_max: number | null
          addition_min: number | null
          company_id: string
          created_at: string
          created_by: string | null
          cylinder_max: number | null
          cylinder_min: number | null
          diameters_mm: number[] | null
          family_id: string
          id: string
          index: string
          lens_state: string
          notes: string | null
          sphere_max: number | null
          sphere_min: number | null
          updated_at: string
        }
        Insert: {
          addition_max?: number | null
          addition_min?: number | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          cylinder_max?: number | null
          cylinder_min?: number | null
          diameters_mm?: number[] | null
          family_id: string
          id?: string
          index: string
          lens_state?: string
          notes?: string | null
          sphere_max?: number | null
          sphere_min?: number | null
          updated_at?: string
        }
        Update: {
          addition_max?: number | null
          addition_min?: number | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          cylinder_max?: number | null
          cylinder_min?: number | null
          diameters_mm?: number[] | null
          family_id?: string
          id?: string
          index?: string
          lens_state?: string
          notes?: string | null
          sphere_max?: number | null
          sphere_min?: number | null
          updated_at?: string
        }
        Relationships: []
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
          clinical_eligibility_mode: string
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
          supplier_priorities: Json | null
          updated_at: string
          whatsapp: string | null
        }
        Insert: {
          address?: string | null
          budget_terms?: string | null
          clinical_eligibility_mode?: string
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
          supplier_priorities?: Json | null
          updated_at?: string
          whatsapp?: string | null
        }
        Update: {
          address?: string | null
          budget_terms?: string | null
          clinical_eligibility_mode?: string
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
          supplier_priorities?: Json | null
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
      family_equivalences: {
        Row: {
          canonical_family_id: string | null
          created_at: string
          created_by: string | null
          equivalence_confidence: string
          equivalence_notes: string | null
          id: string
          supplier_family_id: string | null
        }
        Insert: {
          canonical_family_id?: string | null
          created_at?: string
          created_by?: string | null
          equivalence_confidence?: string
          equivalence_notes?: string | null
          id?: string
          supplier_family_id?: string | null
        }
        Update: {
          canonical_family_id?: string | null
          created_at?: string
          created_by?: string | null
          equivalence_confidence?: string
          equivalence_notes?: string | null
          id?: string
          supplier_family_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "family_equivalences_canonical_family_id_fkey"
            columns: ["canonical_family_id"]
            isOneToOne: false
            referencedRelation: "canonical_families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "family_equivalences_supplier_family_id_fkey"
            columns: ["supplier_family_id"]
            isOneToOne: false
            referencedRelation: "supplier_families"
            referencedColumns: ["id"]
          },
        ]
      }
      material_equivalences: {
        Row: {
          canonical_material_id: string | null
          created_at: string
          id: string
          supplier_material_id: string | null
        }
        Insert: {
          canonical_material_id?: string | null
          created_at?: string
          id?: string
          supplier_material_id?: string | null
        }
        Update: {
          canonical_material_id?: string | null
          created_at?: string
          id?: string
          supplier_material_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "material_equivalences_canonical_material_id_fkey"
            columns: ["canonical_material_id"]
            isOneToOne: false
            referencedRelation: "canonical_materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_equivalences_supplier_material_id_fkey"
            columns: ["supplier_material_id"]
            isOneToOne: false
            referencedRelation: "supplier_materials"
            referencedColumns: ["id"]
          },
        ]
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
      recommendation_audit_logs: {
        Row: {
          catalog_version: string | null
          clinical_type: string
          created_at: string
          execution_time_ms: number | null
          fallbacks: Json
          families_analyzed: number
          families_eligible: number
          id: string
          input_summary: Json
          output_summary: Json
          scores: Json
          seller_id: string
          service_id: string | null
          store_id: string | null
          top_recommendation_id: string | null
          top_recommendation_name: string | null
        }
        Insert: {
          catalog_version?: string | null
          clinical_type: string
          created_at?: string
          execution_time_ms?: number | null
          fallbacks?: Json
          families_analyzed?: number
          families_eligible?: number
          id?: string
          input_summary?: Json
          output_summary?: Json
          scores?: Json
          seller_id: string
          service_id?: string | null
          store_id?: string | null
          top_recommendation_id?: string | null
          top_recommendation_name?: string | null
        }
        Update: {
          catalog_version?: string | null
          clinical_type?: string
          created_at?: string
          execution_time_ms?: number | null
          fallbacks?: Json
          families_analyzed?: number
          families_eligible?: number
          id?: string
          input_summary?: Json
          output_summary?: Json
          scores?: Json
          seller_id?: string
          service_id?: string | null
          store_id?: string | null
          top_recommendation_id?: string | null
          top_recommendation_name?: string | null
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
          supplier_priorities: Json | null
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
          supplier_priorities?: Json | null
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
          supplier_priorities?: Json | null
          updated_at?: string
          whatsapp?: string | null
        }
        Relationships: []
      }
      supplier_benefits: {
        Row: {
          active: boolean
          applicable_to: string[] | null
          benefit_category: string
          confidence: Database["public"]["Enums"]["data_confidence"]
          created_at: string
          id: string
          original_text: string
          perceived_value: string | null
          review_status: Database["public"]["Enums"]["data_review_status"]
          short_argument: string | null
          source_document_id: string | null
          supplier_code: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          applicable_to?: string[] | null
          benefit_category: string
          confidence?: Database["public"]["Enums"]["data_confidence"]
          created_at?: string
          id?: string
          original_text: string
          perceived_value?: string | null
          review_status?: Database["public"]["Enums"]["data_review_status"]
          short_argument?: string | null
          source_document_id?: string | null
          supplier_code: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          applicable_to?: string[] | null
          benefit_category?: string
          confidence?: Database["public"]["Enums"]["data_confidence"]
          created_at?: string
          id?: string
          original_text?: string
          perceived_value?: string | null
          review_status?: Database["public"]["Enums"]["data_review_status"]
          short_argument?: string | null
          source_document_id?: string | null
          supplier_code?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_benefits_source_document_id_fkey"
            columns: ["source_document_id"]
            isOneToOne: false
            referencedRelation: "supplier_source_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_families: {
        Row: {
          active: boolean
          benefit_ids: string[] | null
          clinical_type: string
          commercial_category: string | null
          confidence: Database["public"]["Enums"]["data_confidence"]
          created_at: string
          description: string | null
          display_name: string | null
          id: string
          key_differentiator: string | null
          material_ids: string[] | null
          original_name: string
          review_status: Database["public"]["Enums"]["data_review_status"]
          reviewed_at: string | null
          reviewed_by: string | null
          source_document_id: string | null
          supplier_code: string
          target_audience: string | null
          technology_ids: string[] | null
          tier_position: string | null
          treatment_ids: string[] | null
          updated_at: string
          value_axes: Json | null
        }
        Insert: {
          active?: boolean
          benefit_ids?: string[] | null
          clinical_type: string
          commercial_category?: string | null
          confidence?: Database["public"]["Enums"]["data_confidence"]
          created_at?: string
          description?: string | null
          display_name?: string | null
          id?: string
          key_differentiator?: string | null
          material_ids?: string[] | null
          original_name: string
          review_status?: Database["public"]["Enums"]["data_review_status"]
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_document_id?: string | null
          supplier_code: string
          target_audience?: string | null
          technology_ids?: string[] | null
          tier_position?: string | null
          treatment_ids?: string[] | null
          updated_at?: string
          value_axes?: Json | null
        }
        Update: {
          active?: boolean
          benefit_ids?: string[] | null
          clinical_type?: string
          commercial_category?: string | null
          confidence?: Database["public"]["Enums"]["data_confidence"]
          created_at?: string
          description?: string | null
          display_name?: string | null
          id?: string
          key_differentiator?: string | null
          material_ids?: string[] | null
          original_name?: string
          review_status?: Database["public"]["Enums"]["data_review_status"]
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_document_id?: string | null
          supplier_code?: string
          target_audience?: string | null
          technology_ids?: string[] | null
          tier_position?: string | null
          treatment_ids?: string[] | null
          updated_at?: string
          value_axes?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "supplier_families_source_document_id_fkey"
            columns: ["source_document_id"]
            isOneToOne: false
            referencedRelation: "supplier_source_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_family_map: {
        Row: {
          active: boolean
          catalog_family_id: string
          confidence: string
          created_at: string
          created_by: string | null
          erp_family_name: string
          id: string
          rule_type: string
          supplier: string
        }
        Insert: {
          active?: boolean
          catalog_family_id: string
          confidence?: string
          created_at?: string
          created_by?: string | null
          erp_family_name: string
          id?: string
          rule_type?: string
          supplier: string
        }
        Update: {
          active?: boolean
          catalog_family_id?: string
          confidence?: string
          created_at?: string
          created_by?: string | null
          erp_family_name?: string
          id?: string
          rule_type?: string
          supplier?: string
        }
        Relationships: []
      }
      supplier_materials: {
        Row: {
          abbe_number: number | null
          active: boolean
          aesthetic_score: number | null
          confidence: Database["public"]["Enums"]["data_confidence"]
          created_at: string
          density: number | null
          description: string | null
          id: string
          impact_resistance: string | null
          material_type: string
          original_name: string
          refractive_index: number | null
          review_status: Database["public"]["Enums"]["data_review_status"]
          source_document_id: string | null
          supplier_code: string
          thickness_reduction_percent: number | null
          updated_at: string
          uv_protection_percent: number | null
        }
        Insert: {
          abbe_number?: number | null
          active?: boolean
          aesthetic_score?: number | null
          confidence?: Database["public"]["Enums"]["data_confidence"]
          created_at?: string
          density?: number | null
          description?: string | null
          id?: string
          impact_resistance?: string | null
          material_type: string
          original_name: string
          refractive_index?: number | null
          review_status?: Database["public"]["Enums"]["data_review_status"]
          source_document_id?: string | null
          supplier_code: string
          thickness_reduction_percent?: number | null
          updated_at?: string
          uv_protection_percent?: number | null
        }
        Update: {
          abbe_number?: number | null
          active?: boolean
          aesthetic_score?: number | null
          confidence?: Database["public"]["Enums"]["data_confidence"]
          created_at?: string
          density?: number | null
          description?: string | null
          id?: string
          impact_resistance?: string | null
          material_type?: string
          original_name?: string
          refractive_index?: number | null
          review_status?: Database["public"]["Enums"]["data_review_status"]
          source_document_id?: string | null
          supplier_code?: string
          thickness_reduction_percent?: number | null
          updated_at?: string
          uv_protection_percent?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "supplier_materials_source_document_id_fkey"
            columns: ["source_document_id"]
            isOneToOne: false
            referencedRelation: "supplier_source_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_profiles: {
        Row: {
          abbreviation_map: Json | null
          column_mapping: Json
          created_at: string
          display_name: string
          family_dictionary: Json
          id: string
          index_parsing: Json | null
          is_active: boolean
          keywords_photo: string[] | null
          noise_tokens: string[] | null
          supplier_code: string
          updated_at: string
        }
        Insert: {
          abbreviation_map?: Json | null
          column_mapping?: Json
          created_at?: string
          display_name: string
          family_dictionary?: Json
          id?: string
          index_parsing?: Json | null
          is_active?: boolean
          keywords_photo?: string[] | null
          noise_tokens?: string[] | null
          supplier_code: string
          updated_at?: string
        }
        Update: {
          abbreviation_map?: Json | null
          column_mapping?: Json
          created_at?: string
          display_name?: string
          family_dictionary?: Json
          id?: string
          index_parsing?: Json | null
          is_active?: boolean
          keywords_photo?: string[] | null
          noise_tokens?: string[] | null
          supplier_code?: string
          updated_at?: string
        }
        Relationships: []
      }
      supplier_source_documents: {
        Row: {
          created_at: string
          document_type: string
          file_hash: string | null
          file_name: string
          file_url: string | null
          id: string
          notes: string | null
          parse_result: Json | null
          parse_status: string
          parsed_at: string | null
          parsed_by: string | null
          supplier_code: string
          updated_at: string
          uploaded_by: string | null
          version_label: string | null
        }
        Insert: {
          created_at?: string
          document_type: string
          file_hash?: string | null
          file_name: string
          file_url?: string | null
          id?: string
          notes?: string | null
          parse_result?: Json | null
          parse_status?: string
          parsed_at?: string | null
          parsed_by?: string | null
          supplier_code: string
          updated_at?: string
          uploaded_by?: string | null
          version_label?: string | null
        }
        Update: {
          created_at?: string
          document_type?: string
          file_hash?: string | null
          file_name?: string
          file_url?: string | null
          id?: string
          notes?: string | null
          parse_result?: Json | null
          parse_status?: string
          parsed_at?: string | null
          parsed_by?: string | null
          supplier_code?: string
          updated_at?: string
          uploaded_by?: string | null
          version_label?: string | null
        }
        Relationships: []
      }
      supplier_technologies: {
        Row: {
          active: boolean
          benefits: string[] | null
          confidence: Database["public"]["Enums"]["data_confidence"]
          created_at: string
          description_long: string | null
          description_short: string | null
          display_name: string | null
          icon: string | null
          id: string
          impact_axes: Json | null
          original_name: string
          review_status: Database["public"]["Enums"]["data_review_status"]
          source_document_id: string | null
          supplier_code: string
          tech_group: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          benefits?: string[] | null
          confidence?: Database["public"]["Enums"]["data_confidence"]
          created_at?: string
          description_long?: string | null
          description_short?: string | null
          display_name?: string | null
          icon?: string | null
          id?: string
          impact_axes?: Json | null
          original_name: string
          review_status?: Database["public"]["Enums"]["data_review_status"]
          source_document_id?: string | null
          supplier_code: string
          tech_group?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          benefits?: string[] | null
          confidence?: Database["public"]["Enums"]["data_confidence"]
          created_at?: string
          description_long?: string | null
          description_short?: string | null
          display_name?: string | null
          icon?: string | null
          id?: string
          impact_axes?: Json | null
          original_name?: string
          review_status?: Database["public"]["Enums"]["data_review_status"]
          source_document_id?: string | null
          supplier_code?: string
          tech_group?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_technologies_source_document_id_fkey"
            columns: ["source_document_id"]
            isOneToOne: false
            referencedRelation: "supplier_source_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_treatments: {
        Row: {
          active: boolean
          anti_reflective_level: number | null
          blue_light_filter_percent: number | null
          compatible_materials: string[] | null
          confidence: Database["public"]["Enums"]["data_confidence"]
          created_at: string
          description: string | null
          display_name: string | null
          easy_clean_level: number | null
          id: string
          key_benefit: string | null
          original_name: string
          performance_level: number | null
          photochromic_darkening_percent: number | null
          photochromic_speed: string | null
          review_status: Database["public"]["Enums"]["data_review_status"]
          scratch_resistance_level: number | null
          source_document_id: string | null
          supplier_code: string
          treatment_type: string
          updated_at: string
          uv_filter_percent: number | null
        }
        Insert: {
          active?: boolean
          anti_reflective_level?: number | null
          blue_light_filter_percent?: number | null
          compatible_materials?: string[] | null
          confidence?: Database["public"]["Enums"]["data_confidence"]
          created_at?: string
          description?: string | null
          display_name?: string | null
          easy_clean_level?: number | null
          id?: string
          key_benefit?: string | null
          original_name: string
          performance_level?: number | null
          photochromic_darkening_percent?: number | null
          photochromic_speed?: string | null
          review_status?: Database["public"]["Enums"]["data_review_status"]
          scratch_resistance_level?: number | null
          source_document_id?: string | null
          supplier_code: string
          treatment_type: string
          updated_at?: string
          uv_filter_percent?: number | null
        }
        Update: {
          active?: boolean
          anti_reflective_level?: number | null
          blue_light_filter_percent?: number | null
          compatible_materials?: string[] | null
          confidence?: Database["public"]["Enums"]["data_confidence"]
          created_at?: string
          description?: string | null
          display_name?: string | null
          easy_clean_level?: number | null
          id?: string
          key_benefit?: string | null
          original_name?: string
          performance_level?: number | null
          photochromic_darkening_percent?: number | null
          photochromic_speed?: string | null
          review_status?: Database["public"]["Enums"]["data_review_status"]
          scratch_resistance_level?: number | null
          source_document_id?: string | null
          supplier_code?: string
          treatment_type?: string
          updated_at?: string
          uv_filter_percent?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "supplier_treatments_source_document_id_fkey"
            columns: ["source_document_id"]
            isOneToOne: false
            referencedRelation: "supplier_source_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      treatment_equivalences: {
        Row: {
          canonical_treatment_id: string | null
          created_at: string
          id: string
          supplier_treatment_id: string | null
        }
        Insert: {
          canonical_treatment_id?: string | null
          created_at?: string
          id?: string
          supplier_treatment_id?: string | null
        }
        Update: {
          canonical_treatment_id?: string | null
          created_at?: string
          id?: string
          supplier_treatment_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "treatment_equivalences_canonical_treatment_id_fkey"
            columns: ["canonical_treatment_id"]
            isOneToOne: false
            referencedRelation: "canonical_treatments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "treatment_equivalences_supplier_treatment_id_fkey"
            columns: ["supplier_treatment_id"]
            isOneToOne: false
            referencedRelation: "supplier_treatments"
            referencedColumns: ["id"]
          },
        ]
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
      data_confidence: "explicit" | "inferred" | "manual" | "ai_extracted"
      data_review_status: "draft" | "reviewed" | "approved" | "rejected"
      service_status:
        | "draft"
        | "in_progress"
        | "budget_sent"
        | "converted"
        | "lost"
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
      data_confidence: ["explicit", "inferred", "manual", "ai_extracted"],
      data_review_status: ["draft", "reviewed", "approved", "rejected"],
      service_status: [
        "draft",
        "in_progress",
        "budget_sent",
        "converted",
        "lost",
      ],
    },
  },
} as const
