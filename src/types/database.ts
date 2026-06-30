export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      kdp_books: {
        Row: {
          id: string;
          title: string;
          subtitle: string | null;
          author_name: string;
          language: string;
          book_type: string;
          status: string;
          ai_usage_type: string;
          internal_description: string | null;
          created_by: string | null;
          created_by_user_id: string | null;
          created_by_email: string | null;
          updated_by_user_id: string | null;
          updated_by_email: string | null;
          archived_at: string | null;
          archived_by_user_id: string | null;
          archived_by_email: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          subtitle?: string | null;
          author_name: string;
          language?: string;
          book_type?: string;
          status?: string;
          ai_usage_type?: string;
          internal_description?: string | null;
          created_by?: string | null;
          created_by_user_id?: string | null;
          created_by_email?: string | null;
          updated_by_user_id?: string | null;
          updated_by_email?: string | null;
          archived_at?: string | null;
          archived_by_user_id?: string | null;
          archived_by_email?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          title?: string;
          subtitle?: string | null;
          author_name?: string;
          language?: string;
          book_type?: string;
          status?: string;
          ai_usage_type?: string;
          internal_description?: string | null;
          created_by?: string | null;
          created_by_user_id?: string | null;
          created_by_email?: string | null;
          updated_by_user_id?: string | null;
          updated_by_email?: string | null;
          archived_at?: string | null;
          archived_by_user_id?: string | null;
          archived_by_email?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      kdp_book_settings: {
        Row: {
          id: string;
          book_id: string;
          trim_size: string;
          bleed: boolean;
          interior_type: string;
          paper_type: string;
          body_font: string;
          heading_font: string;
          body_font_size: number;
          line_height: number;
          margin_top: number;
          margin_bottom: number;
          margin_inner: number;
          margin_outer: number;
          page_numbering: boolean;
          header_enabled: boolean;
          footer_enabled: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          book_id: string;
          trim_size?: string;
          bleed?: boolean;
          interior_type?: string;
          paper_type?: string;
          body_font?: string;
          heading_font?: string;
          body_font_size?: number;
          line_height?: number;
          margin_top?: number;
          margin_bottom?: number;
          margin_inner?: number;
          margin_outer?: number;
          page_numbering?: boolean;
          header_enabled?: boolean;
          footer_enabled?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          book_id?: string;
          trim_size?: string;
          bleed?: boolean;
          interior_type?: string;
          paper_type?: string;
          body_font?: string;
          heading_font?: string;
          body_font_size?: number;
          line_height?: number;
          margin_top?: number;
          margin_bottom?: number;
          margin_inner?: number;
          margin_outer?: number;
          page_numbering?: boolean;
          header_enabled?: boolean;
          footer_enabled?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "kdp_book_settings_book_id_fkey";
            columns: ["book_id"];
            isOneToOne: true;
            referencedRelation: "kdp_books";
            referencedColumns: ["id"];
          },
        ];
      };
      kdp_sections: {
        Row: {
          id: string;
          book_id: string;
          section_type: string;
          title: string | null;
          subtitle: string | null;
          body: string | null;
          sort_order: number;
          include_in_toc: boolean;
          section_status: string;
          page_break_before: boolean;
          layout_preset: string;
          editor_notes: string | null;
          settings: Json;
          created_by_user_id: string | null;
          created_by_email: string | null;
          updated_by_user_id: string | null;
          updated_by_email: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          book_id: string;
          section_type: string;
          title?: string | null;
          subtitle?: string | null;
          body?: string | null;
          sort_order?: number;
          include_in_toc?: boolean;
          section_status?: string;
          page_break_before?: boolean;
          layout_preset?: string;
          editor_notes?: string | null;
          settings?: Json;
          created_by_user_id?: string | null;
          created_by_email?: string | null;
          updated_by_user_id?: string | null;
          updated_by_email?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          book_id?: string;
          section_type?: string;
          title?: string | null;
          subtitle?: string | null;
          body?: string | null;
          sort_order?: number;
          include_in_toc?: boolean;
          section_status?: string;
          page_break_before?: boolean;
          layout_preset?: string;
          editor_notes?: string | null;
          settings?: Json;
          created_by_user_id?: string | null;
          created_by_email?: string | null;
          updated_by_user_id?: string | null;
          updated_by_email?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "kdp_sections_book_id_fkey";
            columns: ["book_id"];
            isOneToOne: false;
            referencedRelation: "kdp_books";
            referencedColumns: ["id"];
          },
        ];
      };
      kdp_assets: {
        Row: {
          id: string;
          book_id: string;
          asset_type: string;
          title: string | null;
          file_path: string | null;
          alt_text: string | null;
          prompt: string | null;
          status: string;
          created_by_user_id: string | null;
          created_by_email: string | null;
          updated_by_user_id: string | null;
          updated_by_email: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          book_id: string;
          asset_type?: string;
          title?: string | null;
          file_path?: string | null;
          alt_text?: string | null;
          prompt?: string | null;
          status?: string;
          created_by_user_id?: string | null;
          created_by_email?: string | null;
          updated_by_user_id?: string | null;
          updated_by_email?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          book_id?: string;
          asset_type?: string;
          title?: string | null;
          file_path?: string | null;
          alt_text?: string | null;
          prompt?: string | null;
          status?: string;
          created_by_user_id?: string | null;
          created_by_email?: string | null;
          updated_by_user_id?: string | null;
          updated_by_email?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "kdp_assets_book_id_fkey";
            columns: ["book_id"];
            isOneToOne: false;
            referencedRelation: "kdp_books";
            referencedColumns: ["id"];
          },
        ];
      };
      kdp_section_blocks: {
        Row: {
          id: string;
          book_id: string;
          section_id: string;
          asset_id: string | null;
          block_type: string;
          title: string | null;
          body: string | null;
          sort_order: number;
          layout_preset: string;
          print_visibility: string;
          editor_notes: string | null;
          created_by_user_id: string | null;
          created_by_email: string | null;
          updated_by_user_id: string | null;
          updated_by_email: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          book_id: string;
          section_id: string;
          asset_id?: string | null;
          block_type?: string;
          title?: string | null;
          body?: string | null;
          sort_order?: number;
          layout_preset?: string;
          print_visibility?: string;
          editor_notes?: string | null;
          created_by_user_id?: string | null;
          created_by_email?: string | null;
          updated_by_user_id?: string | null;
          updated_by_email?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          book_id?: string;
          section_id?: string;
          asset_id?: string | null;
          block_type?: string;
          title?: string | null;
          body?: string | null;
          sort_order?: number;
          layout_preset?: string;
          print_visibility?: string;
          editor_notes?: string | null;
          created_by_user_id?: string | null;
          created_by_email?: string | null;
          updated_by_user_id?: string | null;
          updated_by_email?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "kdp_section_blocks_asset_id_fkey";
            columns: ["asset_id"];
            isOneToOne: false;
            referencedRelation: "kdp_assets";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "kdp_section_blocks_book_id_fkey";
            columns: ["book_id"];
            isOneToOne: false;
            referencedRelation: "kdp_books";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "kdp_section_blocks_section_id_fkey";
            columns: ["section_id"];
            isOneToOne: false;
            referencedRelation: "kdp_sections";
            referencedColumns: ["id"];
          },
        ];
      };
      kdp_exports: {
        Row: {
          id: string;
          book_id: string;
          export_type: string;
          file_path: string | null;
          file_name: string | null;
          page_count: number | null;
          validation_status: string;
          validation_report: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          book_id: string;
          export_type: string;
          file_path?: string | null;
          file_name?: string | null;
          page_count?: number | null;
          validation_status?: string;
          validation_report?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          book_id?: string;
          export_type?: string;
          file_path?: string | null;
          file_name?: string | null;
          page_count?: number | null;
          validation_status?: string;
          validation_report?: Json;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "kdp_exports_book_id_fkey";
            columns: ["book_id"];
            isOneToOne: false;
            referencedRelation: "kdp_books";
            referencedColumns: ["id"];
          },
        ];
      };
      kdp_import_runs: {
        Row: {
          id: string;
          book_id: string;
          import_token: string;
          draft_hash: string;
          report: Json;
          created_by_user_id: string | null;
          created_by_email: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          book_id: string;
          import_token: string;
          draft_hash: string;
          report?: Json;
          created_by_user_id?: string | null;
          created_by_email?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          book_id?: string;
          import_token?: string;
          draft_hash?: string;
          report?: Json;
          created_by_user_id?: string | null;
          created_by_email?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "kdp_import_runs_book_id_fkey";
            columns: ["book_id"];
            isOneToOne: false;
            referencedRelation: "kdp_books";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: {
      import_kdp_structured_draft_v2: {
        Args: {
          p_book_id: string;
          p_import_token: string;
          p_draft_hash: string;
          p_actor_email: string;
          p_sections: Json;
        };
        Returns: Json;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

export type Tables<
  PublicTableName extends keyof Database["public"]["Tables"],
> = Database["public"]["Tables"][PublicTableName]["Row"];

export type TablesInsert<
  PublicTableName extends keyof Database["public"]["Tables"],
> = Database["public"]["Tables"][PublicTableName]["Insert"];

export type TablesUpdate<
  PublicTableName extends keyof Database["public"]["Tables"],
> = Database["public"]["Tables"][PublicTableName]["Update"];
