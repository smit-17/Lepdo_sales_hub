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
      activities: {
        Row: {
          activity_date: string
          activity_time: string
          activity_type: string
          assigned_to: string | null
          auto_generated: boolean
          client_id: string
          created_at: string
          created_by: string | null
          id: string
          lead_id: string | null
          next_follow_up: string | null
          notes: string
          order_id: string | null
          quotation_id: string | null
        }
        Insert: {
          activity_date?: string
          activity_time?: string
          activity_type: string
          assigned_to?: string | null
          auto_generated?: boolean
          client_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          lead_id?: string | null
          next_follow_up?: string | null
          notes?: string
          order_id?: string | null
          quotation_id?: string | null
        }
        Update: {
          activity_date?: string
          activity_time?: string
          activity_type?: string
          assigned_to?: string | null
          auto_generated?: boolean
          client_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          lead_id?: string | null
          next_follow_up?: string | null
          notes?: string
          order_id?: string | null
          quotation_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activities_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_lead_fk"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_order_fk"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_quotation_fk"
            columns: ["quotation_id"]
            isOneToOne: false
            referencedRelation: "quotations"
            referencedColumns: ["id"]
          },
        ]
      }
      app_settings: {
        Row: {
          id: number
          settings: Json
          updated_at: string
        }
        Insert: {
          id?: number
          settings?: Json
          updated_at?: string
        }
        Update: {
          id?: number
          settings?: Json
          updated_at?: string
        }
        Relationships: []
      }
      audit_log: {
        Row: {
          action: string
          created_at: string
          from_value: string | null
          id: string
          module: string
          record: string
          to_value: string | null
          user_id: string | null
        }
        Insert: {
          action?: string
          created_at?: string
          from_value?: string | null
          id?: string
          module?: string
          record?: string
          to_value?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          from_value?: string | null
          id?: string
          module?: string
          record?: string
          to_value?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      clients: {
        Row: {
          added_date: string
          address: string
          archived: boolean
          assigned_to: string | null
          category: string
          city: string
          company: string
          contact_person: string
          country: string
          created_at: string
          created_by: string | null
          demo: boolean
          email: string
          id: string
          notes: string
          phone: string
          product_interest: string
          source: string
          status: string
          tags: string[]
          updated_at: string
          website: string
          whatsapp: string
        }
        Insert: {
          added_date?: string
          address?: string
          archived?: boolean
          assigned_to?: string | null
          category?: string
          city?: string
          company?: string
          contact_person?: string
          country?: string
          created_at?: string
          created_by?: string | null
          demo?: boolean
          email?: string
          id?: string
          notes?: string
          phone?: string
          product_interest?: string
          source?: string
          status?: string
          tags?: string[]
          updated_at?: string
          website?: string
          whatsapp?: string
        }
        Update: {
          added_date?: string
          address?: string
          archived?: boolean
          assigned_to?: string | null
          category?: string
          city?: string
          company?: string
          contact_person?: string
          country?: string
          created_at?: string
          created_by?: string | null
          demo?: boolean
          email?: string
          id?: string
          notes?: string
          phone?: string
          product_interest?: string
          source?: string
          status?: string
          tags?: string[]
          updated_at?: string
          website?: string
          whatsapp?: string
        }
        Relationships: []
      }
      follow_ups: {
        Row: {
          activity_id: string | null
          archived: boolean
          assigned_to: string | null
          channel: string
          client_id: string
          completed: boolean
          completed_at: string | null
          created_at: string
          created_by: string | null
          demo: boolean
          id: string
          last_contact: string | null
          lead_id: string | null
          next_date: string
          next_time: string
          notes: string
          outcome: string
          priority: string
          status: string
          updated_at: string
        }
        Insert: {
          activity_id?: string | null
          archived?: boolean
          assigned_to?: string | null
          channel?: string
          client_id: string
          completed?: boolean
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          demo?: boolean
          id?: string
          last_contact?: string | null
          lead_id?: string | null
          next_date?: string
          next_time?: string
          notes?: string
          outcome?: string
          priority?: string
          status?: string
          updated_at?: string
        }
        Update: {
          activity_id?: string | null
          archived?: boolean
          assigned_to?: string | null
          channel?: string
          client_id?: string
          completed?: boolean
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          demo?: boolean
          id?: string
          last_contact?: string | null
          lead_id?: string | null
          next_date?: string
          next_time?: string
          notes?: string
          outcome?: string
          priority?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "follow_ups_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "follow_ups_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "follow_ups_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          archived: boolean
          assigned_to: string | null
          client_id: string
          created_at: string
          created_by: string | null
          currency: string
          demo: boolean
          id: string
          loss_reason: string
          notes: string
          priority: string
          requirement: Json
          stage: string
          updated_at: string
          value: number
        }
        Insert: {
          archived?: boolean
          assigned_to?: string | null
          client_id: string
          created_at?: string
          created_by?: string | null
          currency?: string
          demo?: boolean
          id?: string
          loss_reason?: string
          notes?: string
          priority?: string
          requirement?: Json
          stage?: string
          updated_at?: string
          value?: number
        }
        Update: {
          archived?: boolean
          assigned_to?: string | null
          client_id?: string
          created_at?: string
          created_by?: string | null
          currency?: string
          demo?: boolean
          id?: string
          loss_reason?: string
          notes?: string
          priority?: string
          requirement?: Json
          stage?: string
          updated_at?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "leads_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: true
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      number_sequences: {
        Row: {
          key: string
          next_value: number
        }
        Insert: {
          key: string
          next_value?: number
        }
        Update: {
          key?: string
          next_value?: number
        }
        Relationships: []
      }
      orders: {
        Row: {
          amount: number
          amount_paid: number
          archived: boolean
          assigned_to: string | null
          client_id: string
          created_at: string
          created_by: string | null
          currency: string
          demo: boolean
          id: string
          lead_id: string | null
          notes: string
          order_date: string
          order_no: string
          order_status: string
          payment_status: string
          products: Json
          quotation_id: string | null
          tracking: string
          updated_at: string
        }
        Insert: {
          amount?: number
          amount_paid?: number
          archived?: boolean
          assigned_to?: string | null
          client_id: string
          created_at?: string
          created_by?: string | null
          currency?: string
          demo?: boolean
          id?: string
          lead_id?: string | null
          notes?: string
          order_date?: string
          order_no: string
          order_status?: string
          payment_status?: string
          products?: Json
          quotation_id?: string | null
          tracking?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          amount_paid?: number
          archived?: boolean
          assigned_to?: string | null
          client_id?: string
          created_at?: string
          created_by?: string | null
          currency?: string
          demo?: boolean
          id?: string
          lead_id?: string | null
          notes?: string
          order_date?: string
          order_no?: string
          order_status?: string
          payment_status?: string
          products?: Json
          quotation_id?: string | null
          tracking?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_quotation_id_fkey"
            columns: ["quotation_id"]
            isOneToOne: true
            referencedRelation: "quotations"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          active: boolean
          created_at: string
          department: string
          email: string
          id: string
          monthly_goal: number
          name: string
          phone: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          department?: string
          email?: string
          id: string
          monthly_goal?: number
          name?: string
          phone?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          department?: string
          email?: string
          id?: string
          monthly_goal?: number
          name?: string
          phone?: string
          updated_at?: string
        }
        Relationships: []
      }
      quotations: {
        Row: {
          archived: boolean
          assigned_to: string | null
          billing_address: string
          client_id: string | null
          client_snapshot: Json
          company_snapshot: Json
          created_at: string
          created_by: string | null
          currency: string
          delivery_terms: string
          demo: boolean
          diamond_items: Json
          discount: number
          grand_total: number
          id: string
          invoice: Json | null
          jewelry_items: Json
          lead_id: string | null
          notes: string
          number: string
          other_charges: number
          payment_terms: string
          quotation_type: string
          quote_date: string
          revision: number
          shipping: number
          status: string
          tax: number
          terms: string
          updated_at: string
          valid_until: string | null
        }
        Insert: {
          archived?: boolean
          assigned_to?: string | null
          billing_address?: string
          client_id?: string | null
          client_snapshot?: Json
          company_snapshot?: Json
          created_at?: string
          created_by?: string | null
          currency?: string
          delivery_terms?: string
          demo?: boolean
          diamond_items?: Json
          discount?: number
          grand_total?: number
          id?: string
          invoice?: Json | null
          jewelry_items?: Json
          lead_id?: string | null
          notes?: string
          number: string
          other_charges?: number
          payment_terms?: string
          quotation_type?: string
          quote_date?: string
          revision?: number
          shipping?: number
          status?: string
          tax?: number
          terms?: string
          updated_at?: string
          valid_until?: string | null
        }
        Update: {
          archived?: boolean
          assigned_to?: string | null
          billing_address?: string
          client_id?: string | null
          client_snapshot?: Json
          company_snapshot?: Json
          created_at?: string
          created_by?: string | null
          currency?: string
          delivery_terms?: string
          demo?: boolean
          diamond_items?: Json
          discount?: number
          grand_total?: number
          id?: string
          invoice?: Json | null
          jewelry_items?: Json
          lead_id?: string | null
          notes?: string
          number?: string
          other_charges?: number
          payment_terms?: string
          quotation_type?: string
          quote_date?: string
          revision?: number
          shipping?: number
          status?: string
          tax?: number
          terms?: string
          updated_at?: string
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quotations_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotations_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      targets: {
        Row: {
          amount: number
          archived: boolean
          assigned_to: string | null
          company_wide: boolean
          created_at: string
          created_by: string | null
          currency: string
          demo: boolean
          end_date: string
          id: string
          name: string
          period: string
          start_date: string
          updated_at: string
        }
        Insert: {
          amount?: number
          archived?: boolean
          assigned_to?: string | null
          company_wide?: boolean
          created_at?: string
          created_by?: string | null
          currency?: string
          demo?: boolean
          end_date?: string
          id?: string
          name?: string
          period?: string
          start_date?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          archived?: boolean
          assigned_to?: string | null
          company_wide?: boolean
          created_at?: string
          created_by?: string | null
          currency?: string
          demo?: boolean
          end_date?: string
          id?: string
          name?: string
          period?: string
          start_date?: string
          updated_at?: string
        }
        Relationships: []
      }
      tasks: {
        Row: {
          archived: boolean
          assigned_to: string | null
          client_id: string | null
          created_at: string
          created_by: string | null
          demo: boolean
          description: string
          due_date: string
          due_time: string
          goal_category: string
          id: string
          lead_id: string | null
          notes: string
          order_id: string | null
          priority: string
          quotation_id: string | null
          reminder: boolean
          start_date: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          archived?: boolean
          assigned_to?: string | null
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          demo?: boolean
          description?: string
          due_date?: string
          due_time?: string
          goal_category?: string
          id?: string
          lead_id?: string | null
          notes?: string
          order_id?: string | null
          priority?: string
          quotation_id?: string | null
          reminder?: boolean
          start_date?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Update: {
          archived?: boolean
          assigned_to?: string | null
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          demo?: boolean
          description?: string
          due_date?: string
          due_time?: string
          goal_category?: string
          id?: string
          lead_id?: string | null
          notes?: string
          order_id?: string | null
          priority?: string
          quotation_id?: string | null
          reminder?: boolean
          start_date?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_quotation_id_fkey"
            columns: ["quotation_id"]
            isOneToOne: false
            referencedRelation: "quotations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_see: {
        Args: { _assigned: string; _created: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_active_user: { Args: never; Returns: boolean }
      is_admin: { Args: never; Returns: boolean }
      next_number: { Args: { _key: string; _prefix?: string }; Returns: string }
      reset_crm_data: { Args: never; Returns: undefined }
    }
    Enums: {
      app_role: "super_admin" | "seller"
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
    Enums: {
      app_role: ["super_admin", "seller"],
    },
  },
} as const
