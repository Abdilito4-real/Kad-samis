export type Database = {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          email: string;
          first_name: string | null;
          last_name: string | null;
          phone: string | null;
          avatar_url: string | null;
          role_id: string;
          ministry_id: string | null;
          department_id: string | null;
          is_active: boolean;
          last_login: string | null;
          created_at: string;
          updated_at: string;
          created_by: string | null;
          updated_by: string | null;
          deleted_at: string | null;
        };
        Insert: Omit<Database['public']['Tables']['users']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['users']['Insert']>;
      };
      roles: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          is_system_role: boolean;
          created_at: string;
          updated_at: string;
          created_by: string | null;
          deleted_at: string | null;
        };
        Insert: Omit<Database['public']['Tables']['roles']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['roles']['Insert']>;
      };
      permissions: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          resource: string;
          action: string;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: Omit<Database['public']['Tables']['permissions']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['permissions']['Insert']>;
      };
      assets: {
        Row: {
          id: string;
          asset_number: string;
          qr_code: string | null;
          barcode: string | null;
          name: string;
          category_id: string;
          subcategory_id: string | null;
          manufacturer: string | null;
          model: string | null;
          serial_number: string | null;
          purchase_date: string | null;
          purchase_price: number | null;
          current_value: number | null;
          depreciation_rate: number | null;
          warranty_expiry: string | null;
          condition: string;
          status: string;
          funding_source: string | null;
          supplier_id: string | null;
          latitude: number | null;
          longitude: number | null;
          building_id: string | null;
          floor_id: string | null;
          room_id: string | null;
          assigned_officer_id: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
          created_by: string | null;
          updated_by: string | null;
          deleted_at: string | null;
        };
        Insert: Omit<Database['public']['Tables']['assets']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['assets']['Insert']>;
      };
      ministries: {
        Row: {
          id: string;
          name: string;
          code: string;
          description: string | null;
          headquarters_address: string | null;
          phone: string | null;
          email: string | null;
          website: string | null;
          administrator_id: string | null;
          created_at: string;
          updated_at: string;
          created_by: string | null;
          updated_by: string | null;
          deleted_at: string | null;
        };
        Insert: Omit<Database['public']['Tables']['ministries']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['ministries']['Insert']>;
      };
      departments: {
        Row: {
          id: string;
          ministry_id: string;
          name: string;
          code: string;
          description: string | null;
          location: string | null;
          phone: string | null;
          email: string | null;
          head_id: string | null;
          created_at: string;
          updated_at: string;
          created_by: string | null;
          updated_by: string | null;
          deleted_at: string | null;
        };
        Insert: Omit<Database['public']['Tables']['departments']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['departments']['Insert']>;
      };
      facilities: {
        Row: {
          id: string;
          name: string;
          code: string;
          address: string;
          latitude: number;
          longitude: number;
          lga: string | null;
          ministry_id: string;
          department_id: string | null;
          facility_type: string;
          total_floors: number | null;
          constructed_year: number | null;
          manager_id: string | null;
          created_at: string;
          updated_at: string;
          created_by: string | null;
          updated_by: string | null;
          deleted_at: string | null;
        };
        Insert: Omit<Database['public']['Tables']['facilities']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['facilities']['Insert']>;
      };
      buildings: {
        Row: {
          id: string;
          facility_id: string;
          name: string;
          code: string;
          floors: number;
          constructed_date: string | null;
          latitude: number | null;
          longitude: number | null;
          created_at: string;
          updated_at: string;
          created_by: string | null;
          updated_by: string | null;
          deleted_at: string | null;
        };
        Insert: Omit<Database['public']['Tables']['buildings']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['buildings']['Insert']>;
      };
      maintenance_requests: {
        Row: {
          id: string;
          asset_id: string;
          status: string;
          priority: string;
          description: string;
          requested_by: string;
          assigned_to: string | null;
          requested_date: string;
          completed_date: string | null;
          cost_estimate: number | null;
          cost_actual: number | null;
          created_at: string;
          updated_at: string;
          created_by: string | null;
          updated_by: string | null;
          deleted_at: string | null;
        };
        Insert: Omit<Database['public']['Tables']['maintenance_requests']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['maintenance_requests']['Insert']>;
      };
      asset_categories: {
        Row: {
          id: string;
          name: string;
          code: string;
          description: string | null;
          depreciation_rate: number | null;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: Omit<Database['public']['Tables']['asset_categories']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['asset_categories']['Insert']>;
      };
      audit_logs: {
        Row: {
          id: string;
          user_id: string | null;
          action: string;
          table_name: string;
          record_id: string;
          old_values: Record<string, unknown> | null;
          new_values: Record<string, unknown> | null;
          ip_address: string | null;
          user_agent: string | null;
          timestamp: string;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['audit_logs']['Row'], 'id' | 'created_at'>;
        Update: never;
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
};
