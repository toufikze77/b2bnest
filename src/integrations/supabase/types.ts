export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instanciate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "12.2.3 (519615d)"
  }
  public: {
    Tables: {
      advertisement_categories: {
        Row: {
          created_at: string
          description: string | null
          icon: string | null
          id: string
          is_active: boolean
          name: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean
          name: string
        }
        Update: {
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean
          name?: string
        }
        Relationships: []
      }
      advertisements: {
        Row: {
          category: string
          contact_email: string | null
          contact_phone: string | null
          created_at: string
          currency: string | null
          description: string
          featured_until: string | null
          id: string
          image_urls: string[] | null
          is_active: boolean
          is_service: boolean
          price: number | null
          subcategory: string | null
          title: string
          updated_at: string
          user_id: string
          view_count: number | null
          website_url: string | null
        }
        Insert: {
          category: string
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          currency?: string | null
          description: string
          featured_until?: string | null
          id?: string
          image_urls?: string[] | null
          is_active?: boolean
          is_service?: boolean
          price?: number | null
          subcategory?: string | null
          title: string
          updated_at?: string
          user_id: string
          view_count?: number | null
          website_url?: string | null
        }
        Update: {
          category?: string
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          currency?: string | null
          description?: string
          featured_until?: string | null
          id?: string
          image_urls?: string[] | null
          is_active?: boolean
          is_service?: boolean
          price?: number | null
          subcategory?: string | null
          title?: string
          updated_at?: string
          user_id?: string
          view_count?: number | null
          website_url?: string | null
        }
        Relationships: []
      }
      ai_conversations: {
        Row: {
          context: Json | null
          conversation_type: string
          created_at: string
          id: string
          messages: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          context?: Json | null
          conversation_type: string
          created_at?: string
          id?: string
          messages?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          context?: Json | null
          conversation_type?: string
          created_at?: string
          id?: string
          messages?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      ai_workflows: {
        Row: {
          created_at: string
          description: string | null
          id: string
          industry_tags: string[] | null
          is_active: boolean
          name: string
          updated_at: string
          usage_count: number
          user_id: string
          workflow_steps: Json
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          industry_tags?: string[] | null
          is_active?: boolean
          name: string
          updated_at?: string
          usage_count?: number
          user_id: string
          workflow_steps: Json
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          industry_tags?: string[] | null
          is_active?: boolean
          name?: string
          updated_at?: string
          usage_count?: number
          user_id?: string
          workflow_steps?: Json
        }
        Relationships: []
      }
      ai_workspaces: {
        Row: {
          blocks: Json
          created_at: string
          id: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          blocks?: Json
          created_at?: string
          id?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          blocks?: Json
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          id: string
          ip_address: unknown | null
          resource_id: string | null
          resource_type: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          id?: string
          ip_address?: unknown | null
          resource_id?: string | null
          resource_type: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          id?: string
          ip_address?: unknown | null
          resource_id?: string | null
          resource_type?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      bank_accounts: {
        Row: {
          account_id: string
          account_number: string | null
          account_type: string
          available_balance: number | null
          balance: number | null
          created_at: string
          currency: string
          id: string
          is_active: boolean
          last_synced_at: string | null
          provider_id: string
          provider_name: string
          sort_code: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          account_id: string
          account_number?: string | null
          account_type: string
          available_balance?: number | null
          balance?: number | null
          created_at?: string
          currency?: string
          id?: string
          is_active?: boolean
          last_synced_at?: string | null
          provider_id: string
          provider_name: string
          sort_code?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          account_id?: string
          account_number?: string | null
          account_type?: string
          available_balance?: number | null
          balance?: number | null
          created_at?: string
          currency?: string
          id?: string
          is_active?: boolean
          last_synced_at?: string | null
          provider_id?: string
          provider_name?: string
          sort_code?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      bank_transactions: {
        Row: {
          amount: number
          balance_after: number | null
          bank_account_id: string
          category: string | null
          created_at: string
          currency: string
          description: string | null
          id: string
          merchant_name: string | null
          timestamp: string
          transaction_date: string
          transaction_id: string
          transaction_type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          balance_after?: number | null
          bank_account_id: string
          category?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          id?: string
          merchant_name?: string | null
          timestamp: string
          transaction_date: string
          transaction_id: string
          transaction_type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          balance_after?: number | null
          bank_account_id?: string
          category?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          id?: string
          merchant_name?: string | null
          timestamp?: string
          transaction_date?: string
          transaction_id?: string
          transaction_type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bank_transactions_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      business_insights: {
        Row: {
          confidence_score: number | null
          created_at: string
          data: Json
          expires_at: string | null
          generated_at: string
          id: string
          insight_type: string
          user_id: string
        }
        Insert: {
          confidence_score?: number | null
          created_at?: string
          data: Json
          expires_at?: string | null
          generated_at?: string
          id?: string
          insight_type: string
          user_id: string
        }
        Update: {
          confidence_score?: number | null
          created_at?: string
          data?: Json
          expires_at?: string | null
          generated_at?: string
          id?: string
          insight_type?: string
          user_id?: string
        }
        Relationships: []
      }
      companies: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          founded_year: number | null
          id: string
          industry: string | null
          location: string | null
          logo_url: string | null
          name: string
          size: string | null
          updated_at: string
          website: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          founded_year?: number | null
          id?: string
          industry?: string | null
          location?: string | null
          logo_url?: string | null
          name: string
          size?: string | null
          updated_at?: string
          website?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          founded_year?: number | null
          id?: string
          industry?: string | null
          location?: string | null
          logo_url?: string | null
          name?: string
          size?: string | null
          updated_at?: string
          website?: string | null
        }
        Relationships: []
      }
      connections: {
        Row: {
          addressee_id: string
          created_at: string
          id: string
          message: string | null
          requester_id: string
          status: string
          updated_at: string
        }
        Insert: {
          addressee_id: string
          created_at?: string
          id?: string
          message?: string | null
          requester_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          addressee_id?: string
          created_at?: string
          id?: string
          message?: string | null
          requester_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      crm_contacts: {
        Row: {
          company: string | null
          created_at: string
          email: string | null
          id: string
          last_contact: string | null
          name: string
          notes: string | null
          phone: string | null
          position: string | null
          source: string | null
          status: string | null
          tags: string[] | null
          updated_at: string
          user_id: string
          value: number | null
        }
        Insert: {
          company?: string | null
          created_at?: string
          email?: string | null
          id?: string
          last_contact?: string | null
          name: string
          notes?: string | null
          phone?: string | null
          position?: string | null
          source?: string | null
          status?: string | null
          tags?: string[] | null
          updated_at?: string
          user_id: string
          value?: number | null
        }
        Update: {
          company?: string | null
          created_at?: string
          email?: string | null
          id?: string
          last_contact?: string | null
          name?: string
          notes?: string | null
          phone?: string | null
          position?: string | null
          source?: string | null
          status?: string | null
          tags?: string[] | null
          updated_at?: string
          user_id?: string
          value?: number | null
        }
        Relationships: []
      }
      crm_deals: {
        Row: {
          close_date: string | null
          contact_id: string | null
          created_at: string
          id: string
          notes: string | null
          probability: number | null
          stage: string | null
          title: string
          updated_at: string
          user_id: string
          value: number | null
        }
        Insert: {
          close_date?: string | null
          contact_id?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          probability?: number | null
          stage?: string | null
          title: string
          updated_at?: string
          user_id: string
          value?: number | null
        }
        Update: {
          close_date?: string | null
          contact_id?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          probability?: number | null
          stage?: string | null
          title?: string
          updated_at?: string
          user_id?: string
          value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_deals_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "crm_contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          category: string
          created_at: string | null
          description: string | null
          file_name: string | null
          file_size: number | null
          file_url: string | null
          id: string
          preview_url: string | null
          price: number | null
          subcategory: string | null
          tags: string[] | null
          thumbnail_url: string | null
          title: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          category: string
          created_at?: string | null
          description?: string | null
          file_name?: string | null
          file_size?: number | null
          file_url?: string | null
          id?: string
          preview_url?: string | null
          price?: number | null
          subcategory?: string | null
          tags?: string[] | null
          thumbnail_url?: string | null
          title: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          category?: string
          created_at?: string | null
          description?: string | null
          file_name?: string | null
          file_size?: number | null
          file_url?: string | null
          id?: string
          preview_url?: string | null
          price?: number | null
          subcategory?: string | null
          tags?: string[] | null
          thumbnail_url?: string | null
          title?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      expenses: {
        Row: {
          amount: number
          category: string
          created_at: string
          date: string
          description: string
          id: string
          receipt_url: string | null
          status: string | null
          supplier_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          category: string
          created_at?: string
          date: string
          description: string
          id?: string
          receipt_url?: string | null
          status?: string | null
          supplier_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string
          date?: string
          description?: string
          id?: string
          receipt_url?: string | null
          status?: string | null
          supplier_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "expenses_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      forum_posts: {
        Row: {
          category: Database["public"]["Enums"]["business_category"]
          content: string
          created_at: string
          id: string
          is_pinned: boolean
          last_reply_at: string | null
          reply_count: number
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          category?: Database["public"]["Enums"]["business_category"]
          content: string
          created_at?: string
          id?: string
          is_pinned?: boolean
          last_reply_at?: string | null
          reply_count?: number
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: Database["public"]["Enums"]["business_category"]
          content?: string
          created_at?: string
          id?: string
          is_pinned?: boolean
          last_reply_at?: string | null
          reply_count?: number
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      forum_replies: {
        Row: {
          content: string
          created_at: string
          id: string
          post_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          post_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          post_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "forum_replies_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "forum_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_settings: {
        Row: {
          created_at: string
          id: string
          integration_name: string
          is_enabled: boolean | null
          settings: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          integration_name: string
          is_enabled?: boolean | null
          settings?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          integration_name?: string
          is_enabled?: boolean | null
          settings?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      invoices: {
        Row: {
          client_address: string | null
          client_email: string | null
          client_name: string | null
          company_address: string | null
          company_name: string | null
          created_at: string
          currency: string | null
          due_date: string | null
          id: string
          invoice_number: string
          items: Json | null
          logo_url: string | null
          notes: string | null
          status: string | null
          subtotal: number | null
          tax_amount: number | null
          tax_rate: number | null
          total_amount: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          client_address?: string | null
          client_email?: string | null
          client_name?: string | null
          company_address?: string | null
          company_name?: string | null
          created_at?: string
          currency?: string | null
          due_date?: string | null
          id?: string
          invoice_number: string
          items?: Json | null
          logo_url?: string | null
          notes?: string | null
          status?: string | null
          subtotal?: number | null
          tax_amount?: number | null
          tax_rate?: number | null
          total_amount?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          client_address?: string | null
          client_email?: string | null
          client_name?: string | null
          company_address?: string | null
          company_name?: string | null
          created_at?: string
          currency?: string | null
          due_date?: string | null
          id?: string
          invoice_number?: string
          items?: Json | null
          logo_url?: string | null
          notes?: string | null
          status?: string | null
          subtotal?: number | null
          tax_amount?: number | null
          tax_rate?: number | null
          total_amount?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      job_postings: {
        Row: {
          application_url: string | null
          benefits: string[] | null
          company_id: string | null
          created_at: string
          description: string
          id: string
          is_active: boolean | null
          job_type: string | null
          location: string | null
          posted_by: string
          requirements: string[] | null
          salary_range: string | null
          title: string
          updated_at: string
        }
        Insert: {
          application_url?: string | null
          benefits?: string[] | null
          company_id?: string | null
          created_at?: string
          description: string
          id?: string
          is_active?: boolean | null
          job_type?: string | null
          location?: string | null
          posted_by: string
          requirements?: string[] | null
          salary_range?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          application_url?: string | null
          benefits?: string[] | null
          company_id?: string | null
          created_at?: string
          description?: string
          id?: string
          is_active?: boolean | null
          job_type?: string | null
          location?: string | null
          posted_by?: string
          requirements?: string[] | null
          salary_range?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_postings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string | null
          id: string
          message: string
          read: boolean | null
          title: string
          type: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          message: string
          read?: boolean | null
          title: string
          type?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          message?: string
          read?: boolean | null
          title?: string
          type?: string | null
          user_id?: string
        }
        Relationships: []
      }
      outgoings: {
        Row: {
          amount: number
          category: string
          created_at: string
          frequency: string
          id: string
          is_active: boolean | null
          name: string
          next_payment_date: string
          supplier_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          category: string
          created_at?: string
          frequency: string
          id?: string
          is_active?: boolean | null
          name: string
          next_payment_date: string
          supplier_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string
          frequency?: string
          id?: string
          is_active?: boolean | null
          name?: string
          next_payment_date?: string
          supplier_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "outgoings_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      post_comments: {
        Row: {
          content: string
          created_at: string
          id: string
          post_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          post_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          post_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "social_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      post_likes: {
        Row: {
          created_at: string
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_likes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "social_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      products_services: {
        Row: {
          category: string
          cost: number | null
          created_at: string
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          price: number
          stock_quantity: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          category: string
          cost?: number | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          price?: number
          stock_quantity?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string
          cost?: number | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          price?: number
          stock_quantity?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          company: string | null
          connection_count: number | null
          country_code: string | null
          created_at: string | null
          currency_code: string | null
          date_format: string | null
          email: string | null
          experience_years: number | null
          full_name: string | null
          headline: string | null
          id: string
          industry: string | null
          is_public: boolean | null
          language_code: string | null
          linkedin_url: string | null
          location: string | null
          position: string | null
          skills: string[] | null
          time_format: string | null
          timezone: string | null
          twitter_url: string | null
          updated_at: string | null
          website: string | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          company?: string | null
          connection_count?: number | null
          country_code?: string | null
          created_at?: string | null
          currency_code?: string | null
          date_format?: string | null
          email?: string | null
          experience_years?: number | null
          full_name?: string | null
          headline?: string | null
          id: string
          industry?: string | null
          is_public?: boolean | null
          language_code?: string | null
          linkedin_url?: string | null
          location?: string | null
          position?: string | null
          skills?: string[] | null
          time_format?: string | null
          timezone?: string | null
          twitter_url?: string | null
          updated_at?: string | null
          website?: string | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          company?: string | null
          connection_count?: number | null
          country_code?: string | null
          created_at?: string | null
          currency_code?: string | null
          date_format?: string | null
          email?: string | null
          experience_years?: number | null
          full_name?: string | null
          headline?: string | null
          id?: string
          industry?: string | null
          is_public?: boolean | null
          language_code?: string | null
          linkedin_url?: string | null
          location?: string | null
          position?: string | null
          skills?: string[] | null
          time_format?: string | null
          timezone?: string | null
          twitter_url?: string | null
          updated_at?: string | null
          website?: string | null
        }
        Relationships: []
      }
      quotes: {
        Row: {
          client_address: string | null
          client_email: string | null
          client_name: string | null
          company_address: string | null
          company_name: string | null
          created_at: string
          currency: string | null
          id: string
          items: Json | null
          logo_url: string | null
          notes: string | null
          quote_number: string
          status: string | null
          subtotal: number | null
          tax_amount: number | null
          tax_rate: number | null
          total_amount: number | null
          updated_at: string
          user_id: string
          valid_until: string | null
        }
        Insert: {
          client_address?: string | null
          client_email?: string | null
          client_name?: string | null
          company_address?: string | null
          company_name?: string | null
          created_at?: string
          currency?: string | null
          id?: string
          items?: Json | null
          logo_url?: string | null
          notes?: string | null
          quote_number: string
          status?: string | null
          subtotal?: number | null
          tax_amount?: number | null
          tax_rate?: number | null
          total_amount?: number | null
          updated_at?: string
          user_id: string
          valid_until?: string | null
        }
        Update: {
          client_address?: string | null
          client_email?: string | null
          client_name?: string | null
          company_address?: string | null
          company_name?: string | null
          created_at?: string
          currency?: string | null
          id?: string
          items?: Json | null
          logo_url?: string | null
          notes?: string | null
          quote_number?: string
          status?: string | null
          subtotal?: number | null
          tax_amount?: number | null
          tax_rate?: number | null
          total_amount?: number | null
          updated_at?: string
          user_id?: string
          valid_until?: string | null
        }
        Relationships: []
      }
      social_posts: {
        Row: {
          comment_count: number | null
          company_id: string | null
          content: string
          created_at: string
          id: string
          is_public: boolean | null
          like_count: number | null
          media_urls: string[] | null
          post_type: string | null
          share_count: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          comment_count?: number | null
          company_id?: string | null
          content: string
          created_at?: string
          id?: string
          is_public?: boolean | null
          like_count?: number | null
          media_urls?: string[] | null
          post_type?: string | null
          share_count?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          comment_count?: number | null
          company_id?: string | null
          content?: string
          created_at?: string
          id?: string
          is_public?: boolean | null
          like_count?: number | null
          media_urls?: string[] | null
          post_type?: string | null
          share_count?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "social_posts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_posts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      subscribers: {
        Row: {
          created_at: string
          email: string
          id: string
          stripe_customer_id: string | null
          subscribed: boolean
          subscription_end: string | null
          subscription_tier: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          stripe_customer_id?: string | null
          subscribed?: boolean
          subscription_end?: string | null
          subscription_tier?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          stripe_customer_id?: string | null
          subscribed?: boolean
          subscription_end?: string | null
          subscription_tier?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      suppliers: {
        Row: {
          address: string | null
          contact_person: string | null
          created_at: string
          email: string | null
          id: string
          is_active: boolean | null
          name: string
          payment_terms: string | null
          phone: string | null
          updated_at: string
          user_id: string
          website: string | null
        }
        Insert: {
          address?: string | null
          contact_person?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          payment_terms?: string | null
          phone?: string | null
          updated_at?: string
          user_id: string
          website?: string | null
        }
        Update: {
          address?: string | null
          contact_person?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          payment_terms?: string | null
          phone?: string | null
          updated_at?: string
          user_id?: string
          website?: string | null
        }
        Relationships: []
      }
      user_2fa_codes: {
        Row: {
          code: string
          code_type: string
          created_at: string
          expires_at: string
          id: string
          used: boolean
          user_id: string | null
        }
        Insert: {
          code: string
          code_type: string
          created_at?: string
          expires_at?: string
          id?: string
          used?: boolean
          user_id?: string | null
        }
        Update: {
          code?: string
          code_type?: string
          created_at?: string
          expires_at?: string
          id?: string
          used?: boolean
          user_id?: string | null
        }
        Relationships: []
      }
      user_2fa_settings: {
        Row: {
          backup_codes: string[] | null
          created_at: string
          email_verified: boolean
          id: string
          is_enabled: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          backup_codes?: string[] | null
          created_at?: string
          email_verified?: boolean
          id?: string
          is_enabled?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          backup_codes?: string[] | null
          created_at?: string
          email_verified?: boolean
          id?: string
          is_enabled?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_ai_preferences: {
        Row: {
          business_stage: string | null
          created_at: string
          id: string
          industry: string | null
          interaction_history: Json | null
          preferred_ai_features: string[] | null
          updated_at: string
          user_id: string
        }
        Insert: {
          business_stage?: string | null
          created_at?: string
          id?: string
          industry?: string | null
          interaction_history?: Json | null
          preferred_ai_features?: string[] | null
          updated_at?: string
          user_id: string
        }
        Update: {
          business_stage?: string | null
          created_at?: string
          id?: string
          industry?: string | null
          interaction_history?: Json | null
          preferred_ai_features?: string[] | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_documents: {
        Row: {
          document_id: string
          download_count: number
          id: string
          last_downloaded_at: string | null
          purchased_at: string
          user_id: string
        }
        Insert: {
          document_id: string
          download_count?: number
          id?: string
          last_downloaded_at?: string | null
          purchased_at?: string
          user_id: string
        }
        Update: {
          document_id?: string
          download_count?: number
          id?: string
          last_downloaded_at?: string | null
          purchased_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_documents_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      user_favorites: {
        Row: {
          created_at: string
          document_id: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          document_id: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          document_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_favorites_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
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
      cleanup_expired_2fa_codes: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      has_role: {
        Args: {
          _user_id: string
          _role: Database["public"]["Enums"]["app_role"]
        }
        Returns: boolean
      }
      is_admin_or_owner: {
        Args: { _user_id: string }
        Returns: boolean
      }
      log_user_action: {
        Args: {
          p_user_id: string
          p_action: string
          p_resource_type: string
          p_resource_id?: string
          p_details?: Json
          p_ip_address?: unknown
          p_user_agent?: string
        }
        Returns: string
      }
    }
    Enums: {
      app_role: "owner" | "admin" | "moderator" | "user"
      business_category:
        | "startup"
        | "marketing"
        | "finance"
        | "legal"
        | "operations"
        | "hr"
        | "sales"
        | "technology"
        | "networking"
        | "general"
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
      app_role: ["owner", "admin", "moderator", "user"],
      business_category: [
        "startup",
        "marketing",
        "finance",
        "legal",
        "operations",
        "hr",
        "sales",
        "technology",
        "networking",
        "general",
      ],
    },
  },
} as const
