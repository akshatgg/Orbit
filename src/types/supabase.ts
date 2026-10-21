
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "public": {
          Tables: {
            "admin_audit_log": {
                  Row: {
                    "action": string,"actor": string | null,"created_at": string,"details": NonNullable<Json>,"id": string,"target_id": string | null,"target_type": string
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"actor"?: string | null,"created_at"?: string,"details"?: NonNullable<Json>,"id"?: string,"target_id"?: string | null,"target_type": string
                  }
                  Update: {
                    "action"?: string,"actor"?: string | null,"created_at"?: string,"details"?: NonNullable<Json>,"id"?: string,"target_id"?: string | null,"target_type"?: string
                  }
                  Relationships: [
                    
                  ]
                },"categories": {
                  Row: {
                    "created_at": string,"group": string,"id": string,"keywords": (string)[],"name": string,"slug": string,"sort_order": number
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"group": string,"id"?: string,"keywords"?: (string)[],"name": string,"slug": string,"sort_order"?: number
                  }
                  Update: {
                    "created_at"?: string,"group"?: string,"id"?: string,"keywords"?: (string)[],"name"?: string,"slug"?: string,"sort_order"?: number
                  }
                  Relationships: [
                    
                  ]
                },"event_duplicate_dismissals": {
                  Row: {
                    "created_at": string,"dismissed_by": string | null,"event_id": string,"other_event_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"dismissed_by"?: string | null,"event_id": string,"other_event_id": string
                  }
                  Update: {
                    "created_at"?: string,"dismissed_by"?: string | null,"event_id"?: string,"other_event_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "event_duplicate_dismissals_event_id_fkey"
      columns: ["event_id"]
isOneToOne: false
      referencedRelation: "events"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "event_duplicate_dismissals_other_event_id_fkey"
      columns: ["other_event_id"]
isOneToOne: false
      referencedRelation: "events"
      referencedColumns: ["id"]
    }
                  ]
                },"event_interactions": {
                  Row: {
                    "created_at": string,"event_id": string,"id": number,"kind": string,"user_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"event_id": string,"id"?: never,"kind": string,"user_id"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"event_id"?: string,"id"?: never,"kind"?: string,"user_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "event_interactions_event_id_fkey"
      columns: ["event_id"]
isOneToOne: false
      referencedRelation: "events"
      referencedColumns: ["id"]
    }
                  ]
                },"event_private": {
                  Row: {
                    "event_id": string,"guest_info": string | null,"online_url": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "event_id": string,"guest_info"?: string | null,"online_url"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "event_id"?: string,"guest_info"?: string | null,"online_url"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "event_private_event_id_fkey"
      columns: ["event_id"]
isOneToOne: true
      referencedRelation: "events"
      referencedColumns: ["id"]
    }
                  ]
                },"event_questions": {
                  Row: {
                    "created_at": string,"event_id": string,"id": string,"kind": string,"label": string,"options": (string)[],"required": boolean,"sort_order": number
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"event_id": string,"id"?: string,"kind"?: string,"label": string,"options"?: (string)[],"required"?: boolean,"sort_order"?: number
                  }
                  Update: {
                    "created_at"?: string,"event_id"?: string,"id"?: string,"kind"?: string,"label"?: string,"options"?: (string)[],"required"?: boolean,"sort_order"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "event_questions_event_id_fkey"
      columns: ["event_id"]
isOneToOne: false
      referencedRelation: "events"
      referencedColumns: ["id"]
    }
                  ]
                },"event_sources": {
                  Row: {
                    "attribution": string | null,"auto_category": boolean,"created_at": string,"created_by": string | null,"default_category_id": string | null,"default_organiser_id": string | null,"default_tags": (string)[],"enabled": boolean,"id": string,"kind": string,"last_error": string | null,"last_run_at": string | null,"last_status": string | null,"name": string,"permission_confirmed": boolean,"permission_note": string | null,"updated_at": string,"url": string
                  }
                  ComputedFields: never
                  Insert: {
                    "attribution"?: string | null,"auto_category"?: boolean,"created_at"?: string,"created_by"?: string | null,"default_category_id"?: string | null,"default_organiser_id"?: string | null,"default_tags"?: (string)[],"enabled"?: boolean,"id"?: string,"kind"?: string,"last_error"?: string | null,"last_run_at"?: string | null,"last_status"?: string | null,"name": string,"permission_confirmed"?: boolean,"permission_note"?: string | null,"updated_at"?: string,"url": string
                  }
                  Update: {
                    "attribution"?: string | null,"auto_category"?: boolean,"created_at"?: string,"created_by"?: string | null,"default_category_id"?: string | null,"default_organiser_id"?: string | null,"default_tags"?: (string)[],"enabled"?: boolean,"id"?: string,"kind"?: string,"last_error"?: string | null,"last_run_at"?: string | null,"last_status"?: string | null,"name"?: string,"permission_confirmed"?: boolean,"permission_note"?: string | null,"updated_at"?: string,"url"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "event_sources_default_category_id_fkey"
      columns: ["default_category_id"]
isOneToOne: false
      referencedRelation: "categories"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "event_sources_default_organiser_id_fkey"
      columns: ["default_organiser_id"]
isOneToOne: false
      referencedRelation: "organisers"
      referencedColumns: ["id"]
    }
                  ]
                },"events": {
                  Row: {
                    "address": string | null,"cancel_reason": string | null,"capacity": number | null,"category_id": string | null,"city": string | null,"country": string | null,"cover_url": string | null,"created_at": string,"created_by": string | null,"currency": string,"description": string | null,"duplicate_of": string | null,"ends_at": string | null,"external_label": string,"external_url": string | null,"format": string,"id": string,"is_featured": boolean,"last_verified_at": string,"latitude": number | null,"longitude": number | null,"needs_review": boolean,"organiser_id": string | null,"price_max": number | null,"price_min": number | null,"published_at": string | null,"registration_deadline": string | null,"registration_mode": string,"requires_approval": boolean,"search": unknown,"series_key": string | null,"series_label": string | null,"source": string,"source_event_id": string | null,"source_url": string | null,"starts_at": string,"status": string,"summary": string | null,"tags": (string)[],"tags_locked": boolean,"timezone": string,"title": string,"university": string | null,"updated_at": string,"venue_name": string | null,"waitlist_enabled": boolean
                  }
                  ComputedFields: never
                  Insert: {
                    "address"?: string | null,"cancel_reason"?: string | null,"capacity"?: number | null,"category_id"?: string | null,"city"?: string | null,"country"?: string | null,"cover_url"?: string | null,"created_at"?: string,"created_by"?: string | null,"currency"?: string,"description"?: string | null,"duplicate_of"?: string | null,"ends_at"?: string | null,"external_label"?: string,"external_url"?: string | null,"format"?: string,"id"?: string,"is_featured"?: boolean,"last_verified_at"?: string,"latitude"?: number | null,"longitude"?: number | null,"needs_review"?: boolean,"organiser_id"?: string | null,"price_max"?: number | null,"price_min"?: number | null,"published_at"?: string | null,"registration_deadline"?: string | null,"registration_mode"?: string,"requires_approval"?: boolean,"search"?: never,"series_key"?: string | null,"series_label"?: string | null,"source"?: string,"source_event_id"?: string | null,"source_url"?: string | null,"starts_at": string,"status"?: string,"summary"?: string | null,"tags"?: (string)[],"tags_locked"?: boolean,"timezone"?: string,"title": string,"university"?: string | null,"updated_at"?: string,"venue_name"?: string | null,"waitlist_enabled"?: boolean
                  }
                  Update: {
                    "address"?: string | null,"cancel_reason"?: string | null,"capacity"?: number | null,"category_id"?: string | null,"city"?: string | null,"country"?: string | null,"cover_url"?: string | null,"created_at"?: string,"created_by"?: string | null,"currency"?: string,"description"?: string | null,"duplicate_of"?: string | null,"ends_at"?: string | null,"external_label"?: string,"external_url"?: string | null,"format"?: string,"id"?: string,"is_featured"?: boolean,"last_verified_at"?: string,"latitude"?: number | null,"longitude"?: number | null,"needs_review"?: boolean,"organiser_id"?: string | null,"price_max"?: number | null,"price_min"?: number | null,"published_at"?: string | null,"registration_deadline"?: string | null,"registration_mode"?: string,"requires_approval"?: boolean,"search"?: never,"series_key"?: string | null,"series_label"?: string | null,"source"?: string,"source_event_id"?: string | null,"source_url"?: string | null,"starts_at"?: string,"status"?: string,"summary"?: string | null,"tags"?: (string)[],"tags_locked"?: boolean,"timezone"?: string,"title"?: string,"university"?: string | null,"updated_at"?: string,"venue_name"?: string | null,"waitlist_enabled"?: boolean
                  }
                  Relationships: [
                    {
      foreignKeyName: "events_category_id_fkey"
      columns: ["category_id"]
isOneToOne: false
      referencedRelation: "categories"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "events_duplicate_of_fkey"
      columns: ["duplicate_of"]
isOneToOne: false
      referencedRelation: "events"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "events_organiser_id_fkey"
      columns: ["organiser_id"]
isOneToOne: false
      referencedRelation: "organisers"
      referencedColumns: ["id"]
    }
                  ]
                },"follows": {
                  Row: {
                    "created_at": string,"organiser_id": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"organiser_id": string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"organiser_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "follows_organiser_id_fkey"
      columns: ["organiser_id"]
isOneToOne: false
      referencedRelation: "organisers"
      referencedColumns: ["id"]
    }
                  ]
                },"notification_log": {
                  Row: {
                    "channel": string,"event_id": string,"id": number,"kind": string,"registration_id": string | null,"sent_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "channel": string,"event_id": string,"id"?: never,"kind": string,"registration_id"?: string | null,"sent_at"?: string,"user_id": string
                  }
                  Update: {
                    "channel"?: string,"event_id"?: string,"id"?: never,"kind"?: string,"registration_id"?: string | null,"sent_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "notification_log_event_id_fkey"
      columns: ["event_id"]
isOneToOne: false
      referencedRelation: "events"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "notification_log_registration_id_fkey"
      columns: ["registration_id"]
isOneToOne: false
      referencedRelation: "registrations"
      referencedColumns: ["id"]
    }
                  ]
                },"notification_preferences": {
                  Row: {
                    "deadline_reminders": boolean,"email_enabled": boolean,"push_enabled": boolean,"remind_before_hours": number,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "deadline_reminders"?: boolean,"email_enabled"?: boolean,"push_enabled"?: boolean,"remind_before_hours"?: number,"updated_at"?: string,"user_id"?: string
                  }
                  Update: {
                    "deadline_reminders"?: boolean,"email_enabled"?: boolean,"push_enabled"?: boolean,"remind_before_hours"?: number,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"organiser_invites": {
                  Row: {
                    "code": string,"created_at": string,"created_by": string | null,"expires_at": string,"id": string,"max_uses": number,"organiser_id": string,"revoked": boolean,"role": string,"uses": number
                  }
                  ComputedFields: never
                  Insert: {
                    "code"?: string,"created_at"?: string,"created_by"?: string | null,"expires_at"?: string,"id"?: string,"max_uses"?: number,"organiser_id": string,"revoked"?: boolean,"role"?: string,"uses"?: number
                  }
                  Update: {
                    "code"?: string,"created_at"?: string,"created_by"?: string | null,"expires_at"?: string,"id"?: string,"max_uses"?: number,"organiser_id"?: string,"revoked"?: boolean,"role"?: string,"uses"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "organiser_invites_organiser_id_fkey"
      columns: ["organiser_id"]
isOneToOne: false
      referencedRelation: "organisers"
      referencedColumns: ["id"]
    }
                  ]
                },"organiser_members": {
                  Row: {
                    "created_at": string,"organiser_id": string,"role": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"organiser_id": string,"role"?: string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"organiser_id"?: string,"role"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "organiser_members_organiser_id_fkey"
      columns: ["organiser_id"]
isOneToOne: false
      referencedRelation: "organisers"
      referencedColumns: ["id"]
    }
                  ]
                },"organisers": {
                  Row: {
                    "bio": string | null,"contact_email": string | null,"created_at": string,"created_by": string | null,"id": string,"is_verified": boolean,"kind": string,"logo_url": string | null,"name": string,"review_note": string | null,"reviewed_at": string | null,"reviewed_by": string | null,"slug": string,"status": string,"stripe_account_id": string | null,"stripe_charges_enabled": boolean,"university": string | null,"updated_at": string,"website": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "bio"?: string | null,"contact_email"?: string | null,"created_at"?: string,"created_by"?: string | null,"id"?: string,"is_verified"?: boolean,"kind"?: string,"logo_url"?: string | null,"name": string,"review_note"?: string | null,"reviewed_at"?: string | null,"reviewed_by"?: string | null,"slug": string,"status"?: string,"stripe_account_id"?: string | null,"stripe_charges_enabled"?: boolean,"university"?: string | null,"updated_at"?: string,"website"?: string | null
                  }
                  Update: {
                    "bio"?: string | null,"contact_email"?: string | null,"created_at"?: string,"created_by"?: string | null,"id"?: string,"is_verified"?: boolean,"kind"?: string,"logo_url"?: string | null,"name"?: string,"review_note"?: string | null,"reviewed_at"?: string | null,"reviewed_by"?: string | null,"slug"?: string,"status"?: string,"stripe_account_id"?: string | null,"stripe_charges_enabled"?: boolean,"university"?: string | null,"updated_at"?: string,"website"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"profiles": {
                  Row: {
                    "availability": Json | null,"avatar_url": string | null,"career_interests": (string)[],"company": string | null,"course": string | null,"created_at": string,"department": string | null,"email": string | null,"full_name": string | null,"goals": (string)[],"graduation_year": number | null,"host_role": string | null,"id": string,"industry": string | null,"is_verified_student": boolean,"job_title": string | null,"location_preference": string | null,"onboarded_at": string | null,"personal_interests": (string)[],"preferred_categories": (string)[],"preferred_formats": (string)[],"role": string,"university": string | null,"updated_at": string,"user_type": string | null,"year_of_study": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "availability"?: Json | null,"avatar_url"?: string | null,"career_interests"?: (string)[],"company"?: string | null,"course"?: string | null,"created_at"?: string,"department"?: string | null,"email"?: string | null,"full_name"?: string | null,"goals"?: (string)[],"graduation_year"?: number | null,"host_role"?: string | null,"id": string,"industry"?: string | null,"is_verified_student"?: boolean,"job_title"?: string | null,"location_preference"?: string | null,"onboarded_at"?: string | null,"personal_interests"?: (string)[],"preferred_categories"?: (string)[],"preferred_formats"?: (string)[],"role"?: string,"university"?: string | null,"updated_at"?: string,"user_type"?: string | null,"year_of_study"?: string | null
                  }
                  Update: {
                    "availability"?: Json | null,"avatar_url"?: string | null,"career_interests"?: (string)[],"company"?: string | null,"course"?: string | null,"created_at"?: string,"department"?: string | null,"email"?: string | null,"full_name"?: string | null,"goals"?: (string)[],"graduation_year"?: number | null,"host_role"?: string | null,"id"?: string,"industry"?: string | null,"is_verified_student"?: boolean,"job_title"?: string | null,"location_preference"?: string | null,"onboarded_at"?: string | null,"personal_interests"?: (string)[],"preferred_categories"?: (string)[],"preferred_formats"?: (string)[],"role"?: string,"university"?: string | null,"updated_at"?: string,"user_type"?: string | null,"year_of_study"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"push_subscriptions": {
                  Row: {
                    "auth": string,"created_at": string,"endpoint": string,"id": string,"p256dh": string,"user_agent": string | null,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "auth": string,"created_at"?: string,"endpoint": string,"id"?: string,"p256dh": string,"user_agent"?: string | null,"user_id"?: string
                  }
                  Update: {
                    "auth"?: string,"created_at"?: string,"endpoint"?: string,"id"?: string,"p256dh"?: string,"user_agent"?: string | null,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"registrations": {
                  Row: {
                    "amount": number,"answers": NonNullable<Json>,"checked_in_at": string | null,"checked_in_by": string | null,"created_at": string,"currency": string,"decided_at": string | null,"event_id": string,"id": string,"payment_status": string,"qr_code": string,"status": string,"stripe_checkout_session_id": string | null,"stripe_payment_intent_id": string | null,"ticket_type_id": string | null,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "amount"?: number,"answers"?: NonNullable<Json>,"checked_in_at"?: string | null,"checked_in_by"?: string | null,"created_at"?: string,"currency"?: string,"decided_at"?: string | null,"event_id": string,"id"?: string,"payment_status"?: string,"qr_code"?: string,"status": string,"stripe_checkout_session_id"?: string | null,"stripe_payment_intent_id"?: string | null,"ticket_type_id"?: string | null,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "amount"?: number,"answers"?: NonNullable<Json>,"checked_in_at"?: string | null,"checked_in_by"?: string | null,"created_at"?: string,"currency"?: string,"decided_at"?: string | null,"event_id"?: string,"id"?: string,"payment_status"?: string,"qr_code"?: string,"status"?: string,"stripe_checkout_session_id"?: string | null,"stripe_payment_intent_id"?: string | null,"ticket_type_id"?: string | null,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "registrations_event_id_fkey"
      columns: ["event_id"]
isOneToOne: false
      referencedRelation: "events"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "registrations_ticket_type_id_fkey"
      columns: ["ticket_type_id"]
isOneToOne: false
      referencedRelation: "ticket_types"
      referencedColumns: ["id"]
    }
                  ]
                },"source_event_details": {
                  Row: {
                    "attempts": number,"event_id": string,"fetched_at": string,"last_error": string | null,"status": string
                  }
                  ComputedFields: never
                  Insert: {
                    "attempts"?: number,"event_id": string,"fetched_at"?: string,"last_error"?: string | null,"status": string
                  }
                  Update: {
                    "attempts"?: number,"event_id"?: string,"fetched_at"?: string,"last_error"?: string | null,"status"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "source_event_details_event_id_fkey"
      columns: ["event_id"]
isOneToOne: true
      referencedRelation: "events"
      referencedColumns: ["id"]
    }
                  ]
                },"source_runs": {
                  Row: {
                    "enriched": number,"errors": NonNullable<Json>,"finished_at": string | null,"flagged_missing": number,"found": number,"id": string,"inserted": number,"source_id": string,"started_at": string,"status": string,"trigger": string,"unchanged": number,"updated": number
                  }
                  ComputedFields: never
                  Insert: {
                    "enriched"?: number,"errors"?: NonNullable<Json>,"finished_at"?: string | null,"flagged_missing"?: number,"found"?: number,"id"?: string,"inserted"?: number,"source_id": string,"started_at"?: string,"status": string,"trigger"?: string,"unchanged"?: number,"updated"?: number
                  }
                  Update: {
                    "enriched"?: number,"errors"?: NonNullable<Json>,"finished_at"?: string | null,"flagged_missing"?: number,"found"?: number,"id"?: string,"inserted"?: number,"source_id"?: string,"started_at"?: string,"status"?: string,"trigger"?: string,"unchanged"?: number,"updated"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "source_runs_source_id_fkey"
      columns: ["source_id"]
isOneToOne: false
      referencedRelation: "event_sources"
      referencedColumns: ["id"]
    }
                  ]
                },"stripe_events": {
                  Row: {
                    "account": string | null,"id": string,"livemode": boolean,"received_at": string,"type": string
                  }
                  ComputedFields: never
                  Insert: {
                    "account"?: string | null,"id": string,"livemode"?: boolean,"received_at"?: string,"type": string
                  }
                  Update: {
                    "account"?: string | null,"id"?: string,"livemode"?: boolean,"received_at"?: string,"type"?: string
                  }
                  Relationships: [
                    
                  ]
                },"ticket_types": {
                  Row: {
                    "created_at": string,"currency": string,"description": string | null,"event_id": string,"id": string,"name": string,"price": number,"quantity": number | null,"sales_end_at": string | null,"sort_order": number
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"currency"?: string,"description"?: string | null,"event_id": string,"id"?: string,"name"?: string,"price"?: number,"quantity"?: number | null,"sales_end_at"?: string | null,"sort_order"?: number
                  }
                  Update: {
                    "created_at"?: string,"currency"?: string,"description"?: string | null,"event_id"?: string,"id"?: string,"name"?: string,"price"?: number,"quantity"?: number | null,"sales_end_at"?: string | null,"sort_order"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "ticket_types_event_id_fkey"
      columns: ["event_id"]
isOneToOne: false
      referencedRelation: "events"
      referencedColumns: ["id"]
    }
                  ]
                },"user_events": {
                  Row: {
                    "created_at": string,"event_id": string,"kind": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"event_id": string,"kind": string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"event_id"?: string,"kind"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "user_events_event_id_fkey"
      columns: ["event_id"]
isOneToOne: false
      referencedRelation: "events"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "accept_organiser_invite":
{ Args: { "p_code": string }; Returns: Json
                           },
"add_organiser_member":
{ Args: { "member_email": string,"member_role"?: string,"org": string }; Returns: string
                           },
"admin_signups_daily":
{ Args: { "p_days"?: number }; Returns: {
              "day": string,"signups": number
            }[]
                           },
"admin_stats":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"can_manage_event":
{ Args: { "ev": string }; Returns: boolean
                           },
"cancel_registration":
{ Args: { "p_event_id": string }; Returns: {
              "amount": number,
"answers": NonNullable<Json>,
"checked_in_at": string | null,
"checked_in_by": string | null,
"created_at": string,
"currency": string,
"decided_at": string | null,
"event_id": string,
"id": string,
"payment_status": string,
"qr_code": string,
"status": string,
"stripe_checkout_session_id": string | null,
"stripe_payment_intent_id": string | null,
"ticket_type_id": string | null,
"updated_at": string,
"user_id": string
            }
                          SetofOptions: {
        from: "*"
        to: "registrations"
        isOneToOne: true
        isSetofReturn: false
      } },
"check_in":
{ Args: { "p_code": string,"p_event_id": string }; Returns: Json
                           },
"create_organiser_invite":
{ Args: { "org": string }; Returns: string
                           },
"decide_registration":
{ Args: { "p_decision": string,"p_registration_id": string }; Returns: {
              "amount": number,
"answers": NonNullable<Json>,
"checked_in_at": string | null,
"checked_in_by": string | null,
"created_at": string,
"currency": string,
"decided_at": string | null,
"event_id": string,
"id": string,
"payment_status": string,
"qr_code": string,
"status": string,
"stripe_checkout_session_id": string | null,
"stripe_payment_intent_id": string | null,
"ticket_type_id": string | null,
"updated_at": string,
"user_id": string
            }
                          SetofOptions: {
        from: "*"
        to: "registrations"
        isOneToOne: true
        isSetofReturn: false
      } },
"event_counts":
{ Args: { "event_ids": (string)[] }; Returns: {
              "event_id": string,"going": number,"pending": number,"waitlisted": number
            }[]
                           },
"event_search_text":
{ Args: { "description": string,"summary": string,"tags": (string)[],"title": string }; Returns: string
                           },
"has_room":
{ Args: { "p_event_id": string,"p_exclude_user"?: string,"p_ticket_type_id": string }; Returns: boolean
                           },
"is_admin":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"is_org_member":
{ Args: { "org": string }; Returns: boolean
                           },
"is_org_owner":
{ Args: { "org": string }; Returns: boolean
                           },
"is_service":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"is_super_admin":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"log_admin_action":
{ Args: { "p_action": string,"p_details"?: Json,"p_target_id"?: string,"p_target_type": string }; Returns: string
                           },
"mark_registration_paid":
{ Args: { "p_checkout_session_id": string,"p_payment_intent_id": string,"p_registration_id": string }; Returns: {
              "amount": number,
"answers": NonNullable<Json>,
"checked_in_at": string | null,
"checked_in_by": string | null,
"created_at": string,
"currency": string,
"decided_at": string | null,
"event_id": string,
"id": string,
"payment_status": string,
"qr_code": string,
"status": string,
"stripe_checkout_session_id": string | null,
"stripe_payment_intent_id": string | null,
"ticket_type_id": string | null,
"updated_at": string,
"user_id": string
            }
                          SetofOptions: {
        from: "*"
        to: "registrations"
        isOneToOne: true
        isSetofReturn: false
      } },
"organiser_follower_count":
{ Args: { "org": string }; Returns: number
                           },
"organiser_members_list":
{ Args: { "org": string }; Returns: {
              "avatar_url": string,"created_at": string,"email": string,"full_name": string,"role": string,"user_id": string
            }[]
                           },
"organiser_slug_available":
{ Args: { "p_slug": string }; Returns: boolean
                           },
"payment_hold_ok":
{ Args: { "p_registration_id": string }; Returns: boolean
                           },
"peek_organiser_invite":
{ Args: { "p_code": string }; Returns: {
              "already_member": boolean,"expires_at": string,"logo_url": string,"max_uses": number,"org_status": string,"organiser_id": string,"organiser_name": string,"organiser_slug": string,"revoked": boolean,"role": string,"uses": number
            }[]
                           },
"promote_waitlist":
{ Args: { "p_event_id": string }; Returns: {
              "amount": number,
"answers": NonNullable<Json>,
"checked_in_at": string | null,
"checked_in_by": string | null,
"created_at": string,
"currency": string,
"decided_at": string | null,
"event_id": string,
"id": string,
"payment_status": string,
"qr_code": string,
"status": string,
"stripe_checkout_session_id": string | null,
"stripe_payment_intent_id": string | null,
"ticket_type_id": string | null,
"updated_at": string,
"user_id": string
            }[]
                          SetofOptions: {
        from: "*"
        to: "registrations"
        isOneToOne: false
        isSetofReturn: true
      } },
"register_for_event":
{ Args: { "p_answers"?: Json,"p_event_id": string,"p_ticket_type_id"?: string }; Returns: {
              "amount": number,
"answers": NonNullable<Json>,
"checked_in_at": string | null,
"checked_in_by": string | null,
"created_at": string,
"currency": string,
"decided_at": string | null,
"event_id": string,
"id": string,
"payment_status": string,
"qr_code": string,
"status": string,
"stripe_checkout_session_id": string | null,
"stripe_payment_intent_id": string | null,
"ticket_type_id": string | null,
"updated_at": string,
"user_id": string
            }
                          SetofOptions: {
        from: "*"
        to: "registrations"
        isOneToOne: true
        isSetofReturn: false
      } },
"remove_organiser_member":
{ Args: { "member": string,"org": string }; Returns: undefined
                           },
"save_push_subscription":
{ Args: { "p_auth": string,"p_endpoint": string,"p_p256dh": string,"p_user_agent"?: string }; Returns: string
                           },
"set_user_role":
{ Args: { "new_role": string,"target_email": string }; Returns: string
                           },
"super_admin_email":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"taken_spots":
{ Args: { "p_event_id": string,"p_exclude_user"?: string,"p_ticket_type_id"?: string }; Returns: number
                           },
"ticket_availability":
{ Args: { "p_event_id": string }; Returns: {
              "event_remaining": number,"remaining": number,"ticket_type_id": string
            }[]
                           },
"undo_check_in":
{ Args: { "p_registration_id": string }; Returns: undefined
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

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "public": {
          Enums: {
            
          }
        }
} as const
