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
      ai_usage: {
        Row: {
          business_id: string | null
          cached_tokens: number | null
          cost_usd: number | null
          created_at: string | null
          feature: string
          id: number
          input_tokens: number | null
          model: string
          output_tokens: number | null
          user_id: string | null
        }
        Insert: {
          business_id?: string | null
          cached_tokens?: number | null
          cost_usd?: number | null
          created_at?: string | null
          feature: string
          id?: never
          input_tokens?: number | null
          model: string
          output_tokens?: number | null
          user_id?: string | null
        }
        Update: {
          business_id?: string | null
          cached_tokens?: number | null
          cost_usd?: number | null
          created_at?: string | null
          feature?: string
          id?: never
          input_tokens?: number | null
          model?: string
          output_tokens?: number | null
          user_id?: string | null
        }
        Relationships: []
      }
      audit_log: {
        Row: {
          action: string | null
          created_at: string | null
          id: number
          ip: unknown
          object_id: string | null
          object_type: string | null
          payload: Json | null
          user_id: string | null
        }
        Insert: {
          action?: string | null
          created_at?: string | null
          id?: never
          ip?: unknown
          object_id?: string | null
          object_type?: string | null
          payload?: Json | null
          user_id?: string | null
        }
        Update: {
          action?: string | null
          created_at?: string | null
          id?: never
          ip?: unknown
          object_id?: string | null
          object_type?: string | null
          payload?: Json | null
          user_id?: string | null
        }
        Relationships: []
      }
      boosts: {
        Row: {
          amount_usd: number | null
          business_id: string
          ends_at: string
          event_id: string | null
          id: string
          place_id: string | null
          starts_at: string
          status: string | null
        }
        Insert: {
          amount_usd?: number | null
          business_id: string
          ends_at: string
          event_id?: string | null
          id?: string
          place_id?: string | null
          starts_at: string
          status?: string | null
        }
        Update: {
          amount_usd?: number | null
          business_id?: string
          ends_at?: string
          event_id?: string | null
          id?: string
          place_id?: string | null
          starts_at?: string
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "boosts_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "boosts_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "boosts_place_id_fkey"
            columns: ["place_id"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["id"]
          },
        ]
      }
      business_members: {
        Row: {
          business_id: string
          role: string | null
          user_id: string
        }
        Insert: {
          business_id: string
          role?: string | null
          user_id: string
        }
        Update: {
          business_id?: string
          role?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_members_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      business_reports: {
        Row: {
          business_id: string
          content: Json | null
          created_at: string | null
          id: string
          kind: string | null
          period_end: string | null
          period_start: string | null
        }
        Insert: {
          business_id: string
          content?: Json | null
          created_at?: string | null
          id?: string
          kind?: string | null
          period_end?: string | null
          period_start?: string | null
        }
        Update: {
          business_id?: string
          content?: Json | null
          created_at?: string | null
          id?: string
          kind?: string | null
          period_end?: string | null
          period_start?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "business_reports_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      businesses: {
        Row: {
          brand_voice: string | null
          created_at: string | null
          id: string
          name: string
          plan: string
          stripe_customer_id: string | null
        }
        Insert: {
          brand_voice?: string | null
          created_at?: string | null
          id?: string
          name: string
          plan?: string
          stripe_customer_id?: string | null
        }
        Update: {
          brand_voice?: string | null
          created_at?: string | null
          id?: string
          name?: string
          plan?: string
          stripe_customer_id?: string | null
        }
        Relationships: []
      }
      categories: {
        Row: {
          emoji: string | null
          enabled: boolean | null
          id: number
          name: string
          parent_id: number | null
          slug: string
          sort: number | null
        }
        Insert: {
          emoji?: string | null
          enabled?: boolean | null
          id?: never
          name: string
          parent_id?: number | null
          slug: string
          sort?: number | null
        }
        Update: {
          emoji?: string | null
          enabled?: boolean | null
          id?: never
          name?: string
          parent_id?: number | null
          slug?: string
          sort?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      category_mappings: {
        Row: {
          category_id: number
          osm_tag: string
        }
        Insert: {
          category_id: number
          osm_tag: string
        }
        Update: {
          category_id?: number
          osm_tag?: string
        }
        Relationships: [
          {
            foreignKeyName: "category_mappings_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      cities: {
        Row: {
          center: unknown
          country: string
          created_at: string | null
          id: number
          is_active: boolean | null
          name: string
          region: string | null
          slug: string
          timezone: string
        }
        Insert: {
          center: unknown
          country: string
          created_at?: string | null
          id?: never
          is_active?: boolean | null
          name: string
          region?: string | null
          slug: string
          timezone?: string
        }
        Update: {
          center?: unknown
          country?: string
          created_at?: string | null
          id?: never
          is_active?: boolean | null
          name?: string
          region?: string | null
          slug?: string
          timezone?: string
        }
        Relationships: []
      }
      claims: {
        Row: {
          created_at: string | null
          evidence: Json | null
          id: string
          method: string | null
          place_id: string
          status: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          evidence?: Json | null
          id?: string
          method?: string | null
          place_id: string
          status?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          evidence?: Json | null
          id?: string
          method?: string | null
          place_id?: string
          status?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "claims_place_id_fkey"
            columns: ["place_id"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["id"]
          },
        ]
      }
      concierge_quota: {
        Row: {
          month: string
          used: number | null
          user_id: string
        }
        Insert: {
          month: string
          used?: number | null
          user_id: string
        }
        Update: {
          month?: string
          used?: number | null
          user_id?: string
        }
        Relationships: []
      }
      devices: {
        Row: {
          fcm_token: string | null
          id: string
          last_seen: string | null
          platform: string | null
          user_id: string | null
        }
        Insert: {
          fcm_token?: string | null
          id?: string
          last_seen?: string | null
          platform?: string | null
          user_id?: string | null
        }
        Update: {
          fcm_token?: string | null
          id?: string
          last_seen?: string | null
          platform?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      event_rsvps: {
        Row: {
          created_at: string | null
          event_id: string
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          event_id: string
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          event_id?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_rsvps_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          business_id: string | null
          created_at: string | null
          description: string | null
          ends_at: string | null
          id: string
          image_url: string | null
          is_boosted: boolean | null
          name: string
          place_id: string
          starts_at: string
          status: string | null
        }
        Insert: {
          business_id?: string | null
          created_at?: string | null
          description?: string | null
          ends_at?: string | null
          id?: string
          image_url?: string | null
          is_boosted?: boolean | null
          name: string
          place_id: string
          starts_at: string
          status?: string | null
        }
        Update: {
          business_id?: string | null
          created_at?: string | null
          description?: string | null
          ends_at?: string | null
          id?: string
          image_url?: string | null
          is_boosted?: boolean | null
          name?: string
          place_id?: string
          starts_at?: string
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "events_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_place_id_fkey"
            columns: ["place_id"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["id"]
          },
        ]
      }
      favorites: {
        Row: {
          created_at: string | null
          place_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          place_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          place_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "favorites_place_id_fkey"
            columns: ["place_id"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["id"]
          },
        ]
      }
      feed_config: {
        Row: {
          key: string
          value: Json | null
        }
        Insert: {
          key: string
          value?: Json | null
        }
        Update: {
          key?: string
          value?: Json | null
        }
        Relationships: []
      }
      interactions: {
        Row: {
          context: Json | null
          created_at: string | null
          device_id: string | null
          event_id: string | null
          id: number
          kind: string
          place_id: string | null
          user_id: string | null
        }
        Insert: {
          context?: Json | null
          created_at?: string | null
          device_id?: string | null
          event_id?: string | null
          id?: never
          kind: string
          place_id?: string | null
          user_id?: string | null
        }
        Update: {
          context?: Json | null
          created_at?: string | null
          device_id?: string | null
          event_id?: string | null
          id?: never
          kind?: string
          place_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "interactions_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interactions_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interactions_place_id_fkey"
            columns: ["place_id"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["id"]
          },
        ]
      }
      moderation_queue: {
        Row: {
          ai_reason: string | null
          ai_verdict: string | null
          created_at: string | null
          id: string
          object_id: string
          object_type: string
          resolved_at: string | null
          resolved_by: string | null
        }
        Insert: {
          ai_reason?: string | null
          ai_verdict?: string | null
          created_at?: string | null
          id?: string
          object_id: string
          object_type: string
          resolved_at?: string | null
          resolved_by?: string | null
        }
        Update: {
          ai_reason?: string | null
          ai_verdict?: string | null
          created_at?: string | null
          id?: string
          object_id?: string
          object_type?: string
          resolved_at?: string | null
          resolved_by?: string | null
        }
        Relationships: []
      }
      place_categories: {
        Row: {
          category_id: number
          place_id: string
        }
        Insert: {
          category_id: number
          place_id: string
        }
        Update: {
          category_id?: number
          place_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "place_categories_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "place_categories_place_id_fkey"
            columns: ["place_id"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["id"]
          },
        ]
      }
      place_photos: {
        Row: {
          author_id: string | null
          created_at: string | null
          id: string
          place_id: string
          source: string | null
          status: string | null
          storage_path: string | null
          url: string
        }
        Insert: {
          author_id?: string | null
          created_at?: string | null
          id?: string
          place_id: string
          source?: string | null
          status?: string | null
          storage_path?: string | null
          url: string
        }
        Update: {
          author_id?: string | null
          created_at?: string | null
          id?: string
          place_id?: string
          source?: string | null
          status?: string | null
          storage_path?: string | null
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "place_photos_place_id_fkey"
            columns: ["place_id"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["id"]
          },
        ]
      }
      place_stats: {
        Row: {
          place_id: string
          rating: number | null
          reviews_count: number | null
          saves_count: number | null
          trending_score: number | null
          views_30d: number | null
          votes_1: number | null
          votes_2: number | null
          votes_3: number | null
          votes_4: number | null
          votes_5: number | null
        }
        Insert: {
          place_id: string
          rating?: number | null
          reviews_count?: number | null
          saves_count?: number | null
          trending_score?: number | null
          views_30d?: number | null
          votes_1?: number | null
          votes_2?: number | null
          votes_3?: number | null
          votes_4?: number | null
          votes_5?: number | null
        }
        Update: {
          place_id?: string
          rating?: number | null
          reviews_count?: number | null
          saves_count?: number | null
          trending_score?: number | null
          views_30d?: number | null
          votes_1?: number | null
          votes_2?: number | null
          votes_3?: number | null
          votes_4?: number | null
          votes_5?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "place_stats_place_id_fkey"
            columns: ["place_id"]
            isOneToOne: true
            referencedRelation: "places"
            referencedColumns: ["id"]
          },
        ]
      }
      places: {
        Row: {
          address: Json | null
          ai_enriched_at: string | null
          business_id: string | null
          city_id: number
          claimed: boolean | null
          cover_url: string | null
          created_at: string | null
          description: string | null
          email: string | null
          embedding: string | null
          embedding_model: string | null
          hours: Json | null
          id: string
          instagram: string | null
          is_published: boolean | null
          location: unknown
          logo_url: string | null
          name: string
          phone: string | null
          price_level: number | null
          slug: string
          source: string
          tags: string[] | null
          updated_at: string | null
          vibe_line: string | null
          website: string | null
          whatsapp: string | null
        }
        Insert: {
          address?: Json | null
          ai_enriched_at?: string | null
          business_id?: string | null
          city_id: number
          claimed?: boolean | null
          cover_url?: string | null
          created_at?: string | null
          description?: string | null
          email?: string | null
          embedding?: string | null
          embedding_model?: string | null
          hours?: Json | null
          id?: string
          instagram?: string | null
          is_published?: boolean | null
          location: unknown
          logo_url?: string | null
          name: string
          phone?: string | null
          price_level?: number | null
          slug: string
          source?: string
          tags?: string[] | null
          updated_at?: string | null
          vibe_line?: string | null
          website?: string | null
          whatsapp?: string | null
        }
        Update: {
          address?: Json | null
          ai_enriched_at?: string | null
          business_id?: string | null
          city_id?: number
          claimed?: boolean | null
          cover_url?: string | null
          created_at?: string | null
          description?: string | null
          email?: string | null
          embedding?: string | null
          embedding_model?: string | null
          hours?: Json | null
          id?: string
          instagram?: string | null
          is_published?: boolean | null
          location?: unknown
          logo_url?: string | null
          name?: string
          phone?: string | null
          price_level?: number | null
          slug?: string
          source?: string
          tags?: string[] | null
          updated_at?: string | null
          vibe_line?: string | null
          website?: string | null
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "places_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "places_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          birth_year: number | null
          created_at: string | null
          display_name: string | null
          home_city_id: number | null
          id: string
          is_admin: boolean | null
          onboarding: Json | null
        }
        Insert: {
          avatar_url?: string | null
          birth_year?: number | null
          created_at?: string | null
          display_name?: string | null
          home_city_id?: number | null
          id: string
          is_admin?: boolean | null
          onboarding?: Json | null
        }
        Update: {
          avatar_url?: string | null
          birth_year?: number | null
          created_at?: string | null
          display_name?: string | null
          home_city_id?: number | null
          id?: string
          is_admin?: boolean | null
          onboarding?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_home_city_id_fkey"
            columns: ["home_city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          body: string | null
          created_at: string | null
          id: string
          place_id: string
          rating: number
          status: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string | null
          id?: string
          place_id: string
          rating: number
          status?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string | null
          id?: string
          place_id?: string
          rating?: number
          status?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reviews_place_id_fkey"
            columns: ["place_id"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          business_id: string
          current_period_end: string | null
          id: string
          plan: string
          status: string
          stripe_sub_id: string | null
        }
        Insert: {
          business_id: string
          current_period_end?: string | null
          id?: string
          plan: string
          status: string
          stripe_sub_id?: string | null
        }
        Update: {
          business_id?: string
          current_period_end?: string | null
          id?: string
          plan?: string
          status?: string
          stripe_sub_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      taste_profiles: {
        Row: {
          cat_affinity: Json | null
          embedding: string | null
          embedding_model: string | null
          summary: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          cat_affinity?: Json | null
          embedding?: string | null
          embedding_model?: string | null
          summary?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          cat_affinity?: Json | null
          embedding?: string | null
          embedding_model?: string | null
          summary?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_feed: {
        Args: {
          p_lat: number
          p_limit?: number
          p_lng: number
          p_offset?: number
          p_radius_m?: number
        }
        Returns: {
          boosted: boolean
          category_emoji: string
          category_name: string
          description: string
          distance_m: number
          id: string
          lat: number
          lng: number
          name: string
          photo_url: string
          price_level: number
          rating: number
          reviews_count: number
          score: number
          slug: string
          tags: string[]
          vibe_line: string
        }[]
      }
      is_admin: { Args: never; Returns: boolean }
      is_member: { Args: { b: string }; Returns: boolean }
      is_owner: { Args: { b: string }; Returns: boolean }
      match_places: {
        Args: {
          p_embedding: string
          p_lat: number
          p_limit?: number
          p_lng: number
          p_radius_m?: number
        }
        Returns: {
          category_name: string
          description: string
          distance_m: number
          id: string
          lat: number
          lng: number
          name: string
          photo_url: string
          price_level: number
          similarity: number
          slug: string
          tags: string[]
          vibe_line: string
        }[]
      }
      places_lnglat: {
        Args: { ids: string[] }
        Returns: {
          id: string
          lat: number
          lng: number
        }[]
      }
      recompute_place_stats: { Args: { p_place: string }; Returns: undefined }
      recompute_trending: { Args: never; Returns: undefined }
      search_places: {
        Args: {
          p_category?: number
          p_lat?: number
          p_limit?: number
          p_lng?: number
          p_max_price?: number
          p_q?: string
          p_radius_m?: number
        }
        Returns: {
          category_emoji: string
          category_name: string
          distance_m: number
          hours: Json
          id: string
          name: string
          photo_url: string
          price_level: number
          rating: number
          slug: string
          vibe_line: string
        }[]
      }
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
