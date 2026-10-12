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
          ended_at: string | null
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
          ended_at?: string | null
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
          ended_at?: string | null
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
          origin: string
          period_end: string | null
          period_start: string | null
          place_id: string | null
          sent_at: string | null
        }
        Insert: {
          business_id: string
          content?: Json | null
          created_at?: string | null
          id?: string
          kind?: string | null
          origin?: string
          period_end?: string | null
          period_start?: string | null
          place_id?: string | null
          sent_at?: string | null
        }
        Update: {
          business_id?: string
          content?: Json | null
          created_at?: string | null
          id?: string
          kind?: string | null
          origin?: string
          period_end?: string | null
          period_start?: string | null
          place_id?: string | null
          sent_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "business_reports_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "business_reports_place_id_fkey"
            columns: ["place_id"]
            isOneToOne: false
            referencedRelation: "places"
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
          coverage_radius_m: number
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
          coverage_radius_m?: number
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
          coverage_radius_m?: number
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
          reject_reason: string | null
          resolved_at: string | null
          resolved_by: string | null
          created_at: string | null
          evidence: Json | null
          id: string
          method: string | null
          place_id: string
          status: string | null
          user_id: string
        }
        Insert: {
          reject_reason?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          created_at?: string | null
          evidence?: Json | null
          id?: string
          method?: string | null
          place_id: string
          status?: string | null
          user_id: string
        }
        Update: {
          reject_reason?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
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
      coverage_requests: {
        Row: {
          created_at: string
          id: string
          lat: number
          lng: number
          locale: string | null
          tz: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          lat: number
          lng: number
          locale?: string | null
          tz?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          lat?: number
          lng?: number
          locale?: string | null
          tz?: string | null
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
      email_log: {
        Row: {
          attempts: number
          category: string
          created_at: string
          dedupe_key: string | null
          error: string | null
          id: number
          meta: Json
          provider: string | null
          provider_id: string | null
          sent_at: string | null
          status: string
          subject: string | null
          template: string
          to_email: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          attempts?: number
          category: string
          created_at?: string
          dedupe_key?: string | null
          error?: string | null
          id?: never
          meta?: Json
          provider?: string | null
          provider_id?: string | null
          sent_at?: string | null
          status?: string
          subject?: string | null
          template: string
          to_email: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          attempts?: number
          category?: string
          created_at?: string
          dedupe_key?: string | null
          error?: string | null
          id?: never
          meta?: Json
          provider?: string | null
          provider_id?: string | null
          sent_at?: string | null
          status?: string
          subject?: string | null
          template?: string
          to_email?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      email_preferences: {
        Row: {
          category: string
          source: string | null
          subscribed: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          category: string
          source?: string | null
          subscribed?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string
          source?: string | null
          subscribed?: boolean
          updated_at?: string
          user_id?: string
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
      job_runs: {
        Row: {
          counts: Json
          error: string | null
          finished_at: string | null
          id: number
          job: string
          ok: boolean | null
          started_at: string
        }
        Insert: {
          counts?: Json
          error?: string | null
          finished_at?: string | null
          id?: never
          job: string
          ok?: boolean | null
          started_at?: string
        }
        Update: {
          counts?: Json
          error?: string | null
          finished_at?: string | null
          id?: never
          job?: string
          ok?: boolean | null
          started_at?: string
        }
        Relationships: []
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
      notifications: {
        Row: {
          dedupe_key: string | null
          link: string | null
          place_id: string | null
          body: string | null
          created_at: string | null
          event_id: string | null
          id: string
          kind: string
          read: boolean | null
          title: string
          user_id: string
        }
        Insert: {
          dedupe_key?: string | null
          link?: string | null
          place_id?: string | null
          body?: string | null
          created_at?: string | null
          event_id?: string | null
          id?: string
          kind: string
          read?: boolean | null
          title: string
          user_id: string
        }
        Update: {
          dedupe_key?: string | null
          link?: string | null
          place_id?: string | null
          body?: string | null
          created_at?: string | null
          event_id?: string | null
          id?: string
          kind?: string
          read?: boolean | null
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
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
      place_change_requests: {
        Row: {
          business_id: string | null
          created_at: string
          current_value: Json | null
          id: string
          kind: string
          message: string | null
          payload: Json
          place_id: string
          reject_reason: string | null
          resolved_at: string | null
          resolved_by: string | null
          status: string
          user_id: string
        }
        Insert: {
          business_id?: string | null
          created_at?: string
          current_value?: Json | null
          id?: string
          kind: string
          message?: string | null
          payload?: Json
          place_id: string
          reject_reason?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          user_id: string
        }
        Update: {
          business_id?: string | null
          created_at?: string
          current_value?: Json | null
          id?: string
          kind?: string
          message?: string | null
          payload?: Json
          place_id?: string
          reject_reason?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "place_change_requests_place_id_fkey"
            columns: ["place_id"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["id"]
          },
        ]
      }
      place_proposals: {
        Row: {
          address: string | null
          business_id: string | null
          category_id: number | null
          city_id: number | null
          city_name: string | null
          created_at: string
          id: string
          lat: number | null
          lng: number | null
          location_ref: string | null
          message: string | null
          name: string
          phone: string | null
          place_id: string | null
          reject_reason: string | null
          resolved_at: string | null
          resolved_by: string | null
          status: string
          user_id: string
          website: string | null
        }
        Insert: {
          address?: string | null
          business_id?: string | null
          category_id?: number | null
          city_id?: number | null
          city_name?: string | null
          created_at?: string
          id?: string
          lat?: number | null
          lng?: number | null
          location_ref?: string | null
          message?: string | null
          name: string
          phone?: string | null
          place_id?: string | null
          reject_reason?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          user_id: string
          website?: string | null
        }
        Update: {
          address?: string | null
          business_id?: string | null
          category_id?: number | null
          city_id?: number | null
          city_name?: string | null
          created_at?: string
          id?: string
          lat?: number | null
          lng?: number | null
          location_ref?: string | null
          message?: string | null
          name?: string
          phone?: string | null
          place_id?: string | null
          reject_reason?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          user_id?: string
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "place_proposals_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "place_proposals_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "place_proposals_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "place_proposals_place_id_fkey"
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
          owner_paused_at: string | null
          address: Json | null
          ai_enriched_at: string | null
          business_id: string | null
          business_status: string | null
          city_id: number
          claimed: boolean | null
          cover_url: string | null
          created_at: string | null
          description: string | null
          email: string | null
          embedding: string | null
          embedding_model: string | null
          enrich_tier: string
          hours: Json | null
          id: string
          instagram: string | null
          is_published: boolean | null
          location: unknown
          logo_url: string | null
          menu: Json | null
          menu_updated_at: string | null
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
          owner_paused_at?: string | null
          address?: Json | null
          ai_enriched_at?: string | null
          business_id?: string | null
          business_status?: string | null
          city_id: number
          claimed?: boolean | null
          cover_url?: string | null
          created_at?: string | null
          description?: string | null
          email?: string | null
          embedding?: string | null
          embedding_model?: string | null
          enrich_tier?: string
          hours?: Json | null
          id?: string
          instagram?: string | null
          is_published?: boolean | null
          location: unknown
          logo_url?: string | null
          menu?: Json | null
          menu_updated_at?: string | null
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
          owner_paused_at?: string | null
          address?: Json | null
          ai_enriched_at?: string | null
          business_id?: string | null
          business_status?: string | null
          city_id?: number
          claimed?: boolean | null
          cover_url?: string | null
          created_at?: string | null
          description?: string | null
          email?: string | null
          embedding?: string | null
          embedding_model?: string | null
          enrich_tier?: string
          hours?: Json | null
          id?: string
          instagram?: string | null
          is_published?: boolean | null
          location?: unknown
          logo_url?: string | null
          menu?: Json | null
          menu_updated_at?: string | null
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
      rate_limits: {
        Row: {
          expires_at: string
          hits: number
          key: string
          window_start: string
        }
        Insert: {
          expires_at: string
          hits?: number
          key: string
          window_start: string
        }
        Update: {
          expires_at?: string
          hits?: number
          key?: string
          window_start?: string
        }
        Relationships: []
      }
      region_jobs: {
        Row: {
          bbox: Json | null
          city_id: number | null
          city_name: string | null
          counts: Json
          country: string | null
          created_at: string
          created_by: string | null
          error: string | null
          id: string
          log: Json
          progress: number
          region: string | null
          stage: string | null
          status: string
          updated_at: string
        }
        Insert: {
          bbox?: Json | null
          city_id?: number | null
          city_name?: string | null
          counts?: Json
          country?: string | null
          created_at?: string
          created_by?: string | null
          error?: string | null
          id?: string
          log?: Json
          progress?: number
          region?: string | null
          stage?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          bbox?: Json | null
          city_id?: number | null
          city_name?: string | null
          counts?: Json
          country?: string | null
          created_at?: string
          created_by?: string | null
          error?: string | null
          id?: string
          log?: Json
          progress?: number
          region?: string | null
          stage?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "region_jobs_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          owner_replied_at: string | null
          owner_reply: string | null
          owner_reply_by: string | null
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
          owner_replied_at?: string | null
          owner_reply?: string | null
          owner_reply_by?: string | null
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
          owner_replied_at?: string | null
          owner_reply?: string | null
          owner_reply_by?: string | null
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
      waitlist: {
        Row: {
          created_at: string
          detected_label: string | null
          email: string
          id: string
          lat: number | null
          lng: number | null
        }
        Insert: {
          created_at?: string
          detected_label?: string | null
          email: string
          id?: string
          lat?: number | null
          lng?: number | null
        }
        Update: {
          created_at?: string
          detected_label?: string | null
          email?: string
          id?: string
          lat?: number | null
          lng?: number | null
        }
        Relationships: []
      }
    }
    Views: {
      public_profiles: {
        Row: {
          avatar_url: string | null
          display_name: string | null
          id: string | null
        }
        Insert: {
          avatar_url?: string | null
          display_name?: string | null
          id?: string | null
        }
        Update: {
          avatar_url?: string | null
          display_name?: string | null
          id?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      admin_ai_usage_breakdown: {
        Args: { p_days?: number }
        Returns: {
          dimension: string
          key: string
          n: number
          tok: number
          usd: number
        }[]
      }
      admin_ai_usage_daily: {
        Args: { p_days?: number }
        Returns: {
          day: string
          usd: number
        }[]
      }
      admin_ai_usage_summary: {
        Args: never
        Returns: {
          calls: number
          scope: string
          tokens: number
          usd: number
        }[]
      }
      admin_ai_usage_totals: {
        Args: { p_days?: number }
        Returns: {
          n: number
          tok_cached: number
          tok_in: number
          tok_out: number
          usd: number
        }[]
      }
      admin_audit_log: {
        Args: {
          p_actor?: string
          p_limit?: number
          p_object_type?: string
          p_offset?: number
          p_prefix?: string
        }
        Returns: {
          action: string | null
          actor_email: string | null
          actor_name: string | null
          created_at: string | null
          id: number
          object_id: string | null
          object_type: string | null
          payload: Json | null
          place_id: string | null
          place_name: string | null
          total: number
          user_id: string | null
        }[]
      }
      admin_coverage_zones: {
        Args: { p_days?: number; p_limit?: number }
        Returns: {
          hits: number
          last_seen: string
          lat: number
          lng: number
          locale: string
          tz: string
        }[]
      }
      admin_interaction_counts: {
        Args: never
        Returns: {
          d30: number
          d7: number
          kind: string
          total: number
        }[]
      }
      admin_interaction_daily: {
        Args: { p_days?: number }
        Returns: {
          day: string
          n: number
        }[]
      }
      admin_places_with_photo: { Args: never; Returns: number }
      admin_save_place: {
        Args: {
          p_category_ids: number[]
          p_city_id?: number
          p_description: string
          p_email: string
          p_id: string
          p_instagram: string
          p_is_published: boolean
          p_lat: number
          p_lng: number
          p_name: string
          p_phone: string
          p_price_level: number
          p_slug: string
          p_tags: string[]
          p_vibe_line: string
          p_website: string
          p_whatsapp: string
        }
        Returns: string
      }
      admin_set_place_location: {
        Args: { p_lat: number; p_lng: number; p_place_id: string }
        Returns: undefined
      }
      admin_top_places: {
        Args: { p_limit?: number; p_value_only?: boolean }
        Returns: {
          id: string
          n: number
          name: string
          slug: string
        }[]
      }
      admin_user_activity: {
        Args: never
        Returns: {
          businesses: number
          favorites: number
          reviews: number
          rsvps: number
          user_id: string
        }[]
      }
      assign_nearest_city: {
        Args: {
          p_city_id: number
          p_e: number
          p_n: number
          p_s: number
          p_w: number
        }
        Returns: number
      }
      enqueue_event_reminders: { Args: never; Returns: undefined }
      event_boost_stats: {
        Args: { p_place_id: string }
        Returns: {
          boost_id: string
          comparable: boolean
          ended_at: string | null
          ends_at: string
          event_id: string
          event_name: string
          impressions: number
          opens: number
          prev_impressions: number
          prev_opens: number
          prev_rsvps: number
          rsvps: number
          starts_at: string
          status: string | null
        }[]
      }
      event_gender_stats: {
        Args: { p_event_ids: string[] }
        Returns: {
          event_id: string
          female: number
          going: number
          male: number
        }[]
      }
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
          hours: Json
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
          timezone: string
          vibe_line: string
        }[]
      }
      get_feed_events: {
        Args: {
          p_lat: number
          p_limit?: number
          p_lng: number
          p_radius_m?: number
        }
        Returns: {
          boosted: boolean
          description: string
          distance_m: number
          id: string
          image_url: string
          lat: number
          lng: number
          name: string
          photo_url: string
          place_id: string
          place_name: string
          place_slug: string
          starts_at: string
          timezone: string
        }[]
      }
      increment_concierge_quota: {
        Args: { p_month: string; p_user: string }
        Returns: undefined
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
      ping: { Args: never; Returns: string }
      place_boost_stats: {
        Args: { p_place_id: string }
        Returns: {
          actions: number
          boost_id: string
          clicks: number
          ended_at: string | null
          ends_at: string
          impressions: number
          starts_at: string
          status: string | null
        }[]
      }
      place_proposal_duplicates: {
        Args: {
          p_city_id?: number
          p_lat?: number
          p_lng?: number
          p_name: string
        }
        Returns: {
          city_name: string | null
          claimed: boolean
          distance_m: number | null
          id: string
          is_published: boolean
          name: string
          similarity: number
          slug: string
        }[]
      }
      place_metrics: {
        Args: { p_days?: number; p_place_id: string }
        Returns: {
          kind: string
          n: number
        }[]
      }
      place_metrics_range: {
        Args: { p_from: string; p_place_id: string; p_to: string }
        Returns: {
          kind: string
          n: number
        }[]
      }
      place_metrics_series: {
        Args: { p_days?: number; p_group?: string; p_place_id: string }
        Returns: {
          bucket: string
          kind: string
          n: number
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
      rate_limit_hit: {
        Args: { p_key: string; p_max: number; p_window_seconds: number }
        Returns: boolean
      }
      recompute_place_stats: { Args: { p_place: string }; Returns: undefined }
      recompute_trending: { Args: never; Returns: undefined }
      run_maintenance: { Args: never; Returns: Json }
      resolve_coverage: {
        Args: { p_lat: number; p_lng: number }
        Returns: {
          city_id: number
          distance_m: number
          name: string
          slug: string
        }[]
      }
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
          timezone: string
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
