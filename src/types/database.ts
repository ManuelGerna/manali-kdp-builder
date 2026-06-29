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
          body: string | null;
          sort_order: number;
          settings: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          book_id: string;
          section_type: string;
          title?: string | null;
          body?: string | null;
          sort_order?: number;
          settings?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          book_id?: string;
          section_type?: string;
          title?: string | null;
          body?: string | null;
          sort_order?: number;
          settings?: Json;
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
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
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
