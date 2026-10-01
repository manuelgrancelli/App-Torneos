
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "public": {
          Tables: {
            "courts": {
                  Row: {
                    "created_at": string,"id": string,"name": string,"position": number,"tournament_id": string,"venue": string | null
                  }
                  Insert: {
                    "created_at"?: string,"id"?: string,"name": string,"position"?: number,"tournament_id": string,"venue"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"name"?: string,"position"?: number,"tournament_id"?: string,"venue"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "courts_tournament_id_fkey"
      columns: ["tournament_id"]
isOneToOne: false
      referencedRelation: "tournaments"
      referencedColumns: ["id"]
    }
                  ]
                },"group_teams": {
                  Row: {
                    "group_id": string,"position": number,"team_id": string,"tournament_id": string
                  }
                  Insert: {
                    "group_id": string,"position"?: number,"team_id": string,"tournament_id": string
                  }
                  Update: {
                    "group_id"?: string,"position"?: number,"team_id"?: string,"tournament_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "group_teams_group_id_tournament_id_fkey"
      columns: ["group_id","tournament_id"]
isOneToOne: false
      referencedRelation: "tournament_groups"
      referencedColumns: ["id","tournament_id"]
    },{
      foreignKeyName: "group_teams_team_id_tournament_id_fkey"
      columns: ["team_id","tournament_id"]
isOneToOne: true
      referencedRelation: "teams"
      referencedColumns: ["id","tournament_id"]
    }
                  ]
                },"match_confirmations": {
                  Row: {
                    "comment": string | null,"created_at": string,"match_id": string,"responded_by": string | null,"response": Database["public"]['Enums']["confirmation_response"],"team_id": string,"tournament_id": string,"updated_at": string
                  }
                  Insert: {
                    "comment"?: string | null,"created_at"?: string,"match_id": string,"responded_by"?: string | null,"response": Database["public"]['Enums']["confirmation_response"],"team_id": string,"tournament_id": string,"updated_at"?: string
                  }
                  Update: {
                    "comment"?: string | null,"created_at"?: string,"match_id"?: string,"responded_by"?: string | null,"response"?: Database["public"]['Enums']["confirmation_response"],"team_id"?: string,"tournament_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "match_confirmations_match_id_tournament_id_fkey"
      columns: ["match_id","tournament_id"]
isOneToOne: false
      referencedRelation: "matches"
      referencedColumns: ["id","tournament_id"]
    },{
      foreignKeyName: "match_confirmations_match_id_tournament_id_fkey"
      columns: ["match_id","tournament_id"]
isOneToOne: false
      referencedRelation: "v_my_matches"
      referencedColumns: ["match_id","tournament_id"]
    },{
      foreignKeyName: "match_confirmations_responded_by_fkey"
      columns: ["responded_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "match_confirmations_team_id_tournament_id_fkey"
      columns: ["team_id","tournament_id"]
isOneToOne: false
      referencedRelation: "teams"
      referencedColumns: ["id","tournament_id"]
    }
                  ]
                },"matches": {
                  Row: {
                    "away_team_id": string | null,"court_id": string | null,"created_at": string,"ends_at": string | null,"group_id": string | null,"home_team_id": string | null,"id": string,"is_bye": boolean,"is_draw": boolean,"is_third_place": boolean,"is_walkover": boolean,"loser_next_match_id": string | null,"loser_next_match_side": Database["public"]['Enums']["match_side"] | null,"next_match_id": string | null,"next_match_side": Database["public"]['Enums']["match_side"] | null,"position": number,"result": Json | null,"result_recorded_at": string | null,"result_recorded_by": string | null,"result_status": Database["public"]['Enums']["result_status"] | null,"round": number,"schedule_locked": boolean,"slot_id": string | null,"stage": Database["public"]['Enums']["match_stage"],"starts_at": string | null,"tournament_id": string,"updated_at": string,"winner_team_id": string | null
                  }
                  Insert: {
                    "away_team_id"?: string | null,"court_id"?: string | null,"created_at"?: string,"ends_at"?: string | null,"group_id"?: string | null,"home_team_id"?: string | null,"id"?: string,"is_bye"?: boolean,"is_draw"?: boolean,"is_third_place"?: boolean,"is_walkover"?: boolean,"loser_next_match_id"?: string | null,"loser_next_match_side"?: Database["public"]['Enums']["match_side"] | null,"next_match_id"?: string | null,"next_match_side"?: Database["public"]['Enums']["match_side"] | null,"position"?: number,"result"?: Json | null,"result_recorded_at"?: string | null,"result_recorded_by"?: string | null,"result_status"?: Database["public"]['Enums']["result_status"] | null,"round": number,"schedule_locked"?: boolean,"slot_id"?: string | null,"stage": Database["public"]['Enums']["match_stage"],"starts_at"?: string | null,"tournament_id": string,"updated_at"?: string,"winner_team_id"?: string | null
                  }
                  Update: {
                    "away_team_id"?: string | null,"court_id"?: string | null,"created_at"?: string,"ends_at"?: string | null,"group_id"?: string | null,"home_team_id"?: string | null,"id"?: string,"is_bye"?: boolean,"is_draw"?: boolean,"is_third_place"?: boolean,"is_walkover"?: boolean,"loser_next_match_id"?: string | null,"loser_next_match_side"?: Database["public"]['Enums']["match_side"] | null,"next_match_id"?: string | null,"next_match_side"?: Database["public"]['Enums']["match_side"] | null,"position"?: number,"result"?: Json | null,"result_recorded_at"?: string | null,"result_recorded_by"?: string | null,"result_status"?: Database["public"]['Enums']["result_status"] | null,"round"?: number,"schedule_locked"?: boolean,"slot_id"?: string | null,"stage"?: Database["public"]['Enums']["match_stage"],"starts_at"?: string | null,"tournament_id"?: string,"updated_at"?: string,"winner_team_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "matches_away_team_id_tournament_id_fkey"
      columns: ["away_team_id","tournament_id"]
isOneToOne: false
      referencedRelation: "teams"
      referencedColumns: ["id","tournament_id"]
    },{
      foreignKeyName: "matches_court_id_tournament_id_fkey"
      columns: ["court_id","tournament_id"]
isOneToOne: false
      referencedRelation: "courts"
      referencedColumns: ["id","tournament_id"]
    },{
      foreignKeyName: "matches_group_id_tournament_id_fkey"
      columns: ["group_id","tournament_id"]
isOneToOne: false
      referencedRelation: "tournament_groups"
      referencedColumns: ["id","tournament_id"]
    },{
      foreignKeyName: "matches_home_team_id_tournament_id_fkey"
      columns: ["home_team_id","tournament_id"]
isOneToOne: false
      referencedRelation: "teams"
      referencedColumns: ["id","tournament_id"]
    },{
      foreignKeyName: "matches_loser_next_match_id_tournament_id_fkey"
      columns: ["loser_next_match_id","tournament_id"]
isOneToOne: false
      referencedRelation: "matches"
      referencedColumns: ["id","tournament_id"]
    },{
      foreignKeyName: "matches_loser_next_match_id_tournament_id_fkey"
      columns: ["loser_next_match_id","tournament_id"]
isOneToOne: false
      referencedRelation: "v_my_matches"
      referencedColumns: ["match_id","tournament_id"]
    },{
      foreignKeyName: "matches_next_match_id_tournament_id_fkey"
      columns: ["next_match_id","tournament_id"]
isOneToOne: false
      referencedRelation: "matches"
      referencedColumns: ["id","tournament_id"]
    },{
      foreignKeyName: "matches_next_match_id_tournament_id_fkey"
      columns: ["next_match_id","tournament_id"]
isOneToOne: false
      referencedRelation: "v_my_matches"
      referencedColumns: ["match_id","tournament_id"]
    },{
      foreignKeyName: "matches_result_recorded_by_fkey"
      columns: ["result_recorded_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "matches_slot_id_tournament_id_fkey"
      columns: ["slot_id","tournament_id"]
isOneToOne: false
      referencedRelation: "time_slots"
      referencedColumns: ["id","tournament_id"]
    },{
      foreignKeyName: "matches_tournament_id_fkey"
      columns: ["tournament_id"]
isOneToOne: false
      referencedRelation: "tournaments"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "matches_winner_team_id_tournament_id_fkey"
      columns: ["winner_team_id","tournament_id"]
isOneToOne: false
      referencedRelation: "teams"
      referencedColumns: ["id","tournament_id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "avatar_url": string | null,"created_at": string,"full_name": string,"id": string,"updated_at": string
                  }
                  Insert: {
                    "avatar_url"?: string | null,"created_at"?: string,"full_name": string,"id": string,"updated_at"?: string
                  }
                  Update: {
                    "avatar_url"?: string | null,"created_at"?: string,"full_name"?: string,"id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"sports": {
                  Row: {
                    "created_at": string,"default_scoring_config": NonNullable<Json>,"default_standings_config": NonNullable<Json>,"id": string,"max_team_size": number,"min_team_size": number,"name": string,"scoring_type": Database["public"]['Enums']["scoring_type"],"sort_order": number
                  }
                  Insert: {
                    "created_at"?: string,"default_scoring_config": NonNullable<Json>,"default_standings_config": NonNullable<Json>,"id": string,"max_team_size": number,"min_team_size": number,"name": string,"scoring_type": Database["public"]['Enums']["scoring_type"],"sort_order"?: number
                  }
                  Update: {
                    "created_at"?: string,"default_scoring_config"?: NonNullable<Json>,"default_standings_config"?: NonNullable<Json>,"id"?: string,"max_team_size"?: number,"min_team_size"?: number,"name"?: string,"scoring_type"?: Database["public"]['Enums']["scoring_type"],"sort_order"?: number
                  }
                  Relationships: [
                    
                  ]
                },"team_availability": {
                  Row: {
                    "created_at": string,"slot_id": string,"team_id": string,"tournament_id": string
                  }
                  Insert: {
                    "created_at"?: string,"slot_id": string,"team_id": string,"tournament_id": string
                  }
                  Update: {
                    "created_at"?: string,"slot_id"?: string,"team_id"?: string,"tournament_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "team_availability_slot_id_tournament_id_fkey"
      columns: ["slot_id","tournament_id"]
isOneToOne: false
      referencedRelation: "time_slots"
      referencedColumns: ["id","tournament_id"]
    },{
      foreignKeyName: "team_availability_team_id_tournament_id_fkey"
      columns: ["team_id","tournament_id"]
isOneToOne: false
      referencedRelation: "teams"
      referencedColumns: ["id","tournament_id"]
    }
                  ]
                },"team_members": {
                  Row: {
                    "created_at": string,"email": string,"id": string,"role": Database["public"]['Enums']["team_member_role"],"team_id": string,"tournament_id": string,"user_id": string | null
                  }
                  Insert: {
                    "created_at"?: string,"email": string,"id"?: string,"role"?: Database["public"]['Enums']["team_member_role"],"team_id": string,"tournament_id": string,"user_id"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"email"?: string,"id"?: string,"role"?: Database["public"]['Enums']["team_member_role"],"team_id"?: string,"tournament_id"?: string,"user_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "team_members_team_id_tournament_id_fkey"
      columns: ["team_id","tournament_id"]
isOneToOne: false
      referencedRelation: "teams"
      referencedColumns: ["id","tournament_id"]
    },{
      foreignKeyName: "team_members_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"teams": {
                  Row: {
                    "captain_id": string,"created_at": string,"id": string,"name": string,"status": Database["public"]['Enums']["team_status"],"tournament_id": string,"updated_at": string
                  }
                  Insert: {
                    "captain_id": string,"created_at"?: string,"id"?: string,"name": string,"status"?: Database["public"]['Enums']["team_status"],"tournament_id": string,"updated_at"?: string
                  }
                  Update: {
                    "captain_id"?: string,"created_at"?: string,"id"?: string,"name"?: string,"status"?: Database["public"]['Enums']["team_status"],"tournament_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "teams_captain_id_fkey"
      columns: ["captain_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "teams_tournament_id_fkey"
      columns: ["tournament_id"]
isOneToOne: false
      referencedRelation: "tournaments"
      referencedColumns: ["id"]
    }
                  ]
                },"time_slots": {
                  Row: {
                    "court_id": string | null,"created_at": string,"ends_at": string,"id": string,"starts_at": string,"tournament_id": string
                  }
                  Insert: {
                    "court_id"?: string | null,"created_at"?: string,"ends_at": string,"id"?: string,"starts_at": string,"tournament_id": string
                  }
                  Update: {
                    "court_id"?: string | null,"created_at"?: string,"ends_at"?: string,"id"?: string,"starts_at"?: string,"tournament_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "time_slots_court_id_tournament_id_fkey"
      columns: ["court_id","tournament_id"]
isOneToOne: false
      referencedRelation: "courts"
      referencedColumns: ["id","tournament_id"]
    },{
      foreignKeyName: "time_slots_tournament_id_fkey"
      columns: ["tournament_id"]
isOneToOne: false
      referencedRelation: "tournaments"
      referencedColumns: ["id"]
    }
                  ]
                },"tournament_groups": {
                  Row: {
                    "created_at": string,"id": string,"name": string,"position": number,"tiebreak_seed": number,"tournament_id": string
                  }
                  Insert: {
                    "created_at"?: string,"id"?: string,"name": string,"position": number,"tiebreak_seed"?: number,"tournament_id": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"name"?: string,"position"?: number,"tiebreak_seed"?: number,"tournament_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "tournament_groups_tournament_id_fkey"
      columns: ["tournament_id"]
isOneToOne: false
      referencedRelation: "tournaments"
      referencedColumns: ["id"]
    }
                  ]
                },"tournament_invites": {
                  Row: {
                    "code": string,"rotated_at": string,"tournament_id": string
                  }
                  Insert: {
                    "code": string,"rotated_at"?: string,"tournament_id": string
                  }
                  Update: {
                    "code"?: string,"rotated_at"?: string,"tournament_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "tournament_invites_tournament_id_fkey"
      columns: ["tournament_id"]
isOneToOne: true
      referencedRelation: "tournaments"
      referencedColumns: ["id"]
    }
                  ]
                },"tournaments": {
                  Row: {
                    "champion_team_id": string | null,"created_at": string,"description": string | null,"ends_on": string,"id": string,"max_teams": number,"name": string,"organizer_id": string,"playoff_config": NonNullable<Json>,"results_require_confirmation": boolean,"scoring_config": NonNullable<Json>,"slug": string,"sport_id": string,"standings_config": NonNullable<Json>,"starts_on": string,"status": Database["public"]['Enums']["tournament_status"],"timezone": string,"updated_at": string
                  }
                  Insert: {
                    "champion_team_id"?: string | null,"created_at"?: string,"description"?: string | null,"ends_on": string,"id"?: string,"max_teams": number,"name": string,"organizer_id": string,"playoff_config"?: NonNullable<Json>,"results_require_confirmation"?: boolean,"scoring_config": NonNullable<Json>,"slug": string,"sport_id": string,"standings_config": NonNullable<Json>,"starts_on": string,"status"?: Database["public"]['Enums']["tournament_status"],"timezone"?: string,"updated_at"?: string
                  }
                  Update: {
                    "champion_team_id"?: string | null,"created_at"?: string,"description"?: string | null,"ends_on"?: string,"id"?: string,"max_teams"?: number,"name"?: string,"organizer_id"?: string,"playoff_config"?: NonNullable<Json>,"results_require_confirmation"?: boolean,"scoring_config"?: NonNullable<Json>,"slug"?: string,"sport_id"?: string,"standings_config"?: NonNullable<Json>,"starts_on"?: string,"status"?: Database["public"]['Enums']["tournament_status"],"timezone"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "tournaments_champion_team_fk"
      columns: ["champion_team_id","id"]
isOneToOne: false
      referencedRelation: "teams"
      referencedColumns: ["id","tournament_id"]
    },{
      foreignKeyName: "tournaments_organizer_id_fkey"
      columns: ["organizer_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tournaments_sport_id_fkey"
      columns: ["sport_id"]
isOneToOne: false
      referencedRelation: "sports"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            "v_my_matches": {
                  Row: {
                    "court_id": string | null,"court_name": string | null,"court_venue": string | null,"ends_at": string | null,"is_draw": boolean | null,"is_home": boolean | null,"is_third_place": boolean | null,"is_walkover": boolean | null,"match_id": string | null,"my_team_id": string | null,"my_team_name": string | null,"outcome": string | null,"result": Json | null,"result_status": Database["public"]['Enums']["result_status"] | null,"rival_team_id": string | null,"rival_team_name": string | null,"round": number | null,"scoring_type": Database["public"]['Enums']["scoring_type"] | null,"sport_id": string | null,"sport_name": string | null,"stage": Database["public"]['Enums']["match_stage"] | null,"starts_at": string | null,"timezone": string | null,"tournament_id": string | null,"tournament_name": string | null,"tournament_slug": string | null,"tournament_status": Database["public"]['Enums']["tournament_status"] | null,"winner_team_id": string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "matches_court_id_tournament_id_fkey"
      columns: ["court_id","tournament_id"]
isOneToOne: false
      referencedRelation: "courts"
      referencedColumns: ["id","tournament_id"]
    },{
      foreignKeyName: "matches_tournament_id_fkey"
      columns: ["tournament_id"]
isOneToOne: false
      referencedRelation: "tournaments"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "matches_winner_team_id_tournament_id_fkey"
      columns: ["winner_team_id","tournament_id"]
isOneToOne: false
      referencedRelation: "teams"
      referencedColumns: ["id","tournament_id"]
    },{
      foreignKeyName: "tournaments_sport_id_fkey"
      columns: ["sport_id"]
isOneToOne: false
      referencedRelation: "sports"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Functions: {
            "add_team_members":
{ Args: { "p_emails": (string)[],"p_team_id": string,"p_tournament_id": string }; Returns: undefined
                           },
"apply_bracket":
{ Args: { "p_matches": Json,"p_tournament_id": string }; Returns: undefined
                           },
"apply_groups":
{ Args: { "p_groups": Json,"p_tournament_id": string }; Returns: undefined
                           },
"apply_schedule":
{ Args: { "p_assignments": Json,"p_clear_unlocked"?: boolean,"p_tournament_id": string }; Returns: number
                           },
"assign_match_slot":
{ Args: { "p_court_id": string,"p_match_id": string,"p_slot_id": string }; Returns: undefined
                           },
"clear_match_result":
{ Args: { "p_match_id": string }; Returns: undefined
                           },
"confirm_match_result":
{ Args: { "p_match_id": string }; Returns: undefined
                           },
"create_tournament":
{ Args: { "p_court_names": (string)[],"p_description": string,"p_ends_on": string,"p_max_teams": number,"p_name": string,"p_playoff_config"?: Json,"p_results_require_confirmation"?: boolean,"p_scoring_config"?: Json,"p_slug": string,"p_sport_id": string,"p_standings_config"?: Json,"p_starts_on": string,"p_timezone": string }; Returns: string
                           },
"generate_code":
{ Args: { "p_length"?: number }; Returns: string
                           },
"leave_team":
{ Args: { "p_team_id": string }; Returns: undefined
                           },
"normalize_code":
{ Args: { "p_code": string }; Returns: string
                           },
"normalize_emails":
{ Args: { "p_emails": (string)[] }; Returns: (string)[]
                           },
"place_team_in_match":
{ Args: { "p_match_id": string,"p_side": Database["public"]['Enums']["match_side"],"p_team_id": string }; Returns: undefined
                           },
"profile_values_from_user":
{ Args: { "p_email": string,"p_meta": Json }; Returns: {
              "avatar_url": string,"full_name": string
            }[]
                           },
"record_match_result":
{ Args: { "p_is_draw"?: boolean,"p_is_walkover"?: boolean,"p_match_id": string,"p_result": Json,"p_winner_team_id": string }; Returns: undefined
                           },
"register_team":
{ Args: { "p_code": string,"p_member_emails": (string)[],"p_team_name": string }; Returns: string
                           },
"require_match_organizer":
{ Args: { "p_match_id": string }; Returns: {
              "away_team_id": string | null,
"court_id": string | null,
"created_at": string,
"ends_at": string | null,
"group_id": string | null,
"home_team_id": string | null,
"id": string,
"is_bye": boolean,
"is_draw": boolean,
"is_third_place": boolean,
"is_walkover": boolean,
"loser_next_match_id": string | null,
"loser_next_match_side": Database["public"]['Enums']["match_side"] | null,
"next_match_id": string | null,
"next_match_side": Database["public"]['Enums']["match_side"] | null,
"position": number,
"result": Json | null,
"result_recorded_at": string | null,
"result_recorded_by": string | null,
"result_status": Database["public"]['Enums']["result_status"] | null,
"round": number,
"schedule_locked": boolean,
"slot_id": string | null,
"stage": Database["public"]['Enums']["match_stage"],
"starts_at": string | null,
"tournament_id": string,
"updated_at": string,
"winner_team_id": string | null
            }
                          SetofOptions: {
        from: "*"
        to: "matches"
        isOneToOne: true
        isSetofReturn: false
      } },
"require_user":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"resolve_invite_code":
{ Args: { "p_code": string }; Returns: {
              "approved_teams": number,"ends_on": string,"max_team_size": number,"max_teams": number,"min_team_size": number,"my_team_id": string,"name": string,"scoring_type": Database["public"]['Enums']["scoring_type"],"slug": string,"sport_id": string,"sport_name": string,"starts_on": string,"status": Database["public"]['Enums']["tournament_status"],"tournament_id": string
            }[]
                           },
"respond_result":
{ Args: { "p_comment"?: string,"p_match_id": string,"p_response": Database["public"]['Enums']["confirmation_response"] }; Returns: Database["public"]['Enums']["result_status"]
                           },
"review_registration":
{ Args: { "p_decision": Database["public"]['Enums']["team_status"],"p_team_id": string }; Returns: undefined
                           },
"rotate_invite_code":
{ Args: { "p_tournament_id": string }; Returns: string
                           },
"set_team_availability":
{ Args: { "p_slot_ids": (string)[],"p_team_id": string }; Returns: number
                           },
"set_tournament_status":
{ Args: { "p_champion_team_id"?: string,"p_status": Database["public"]['Enums']["tournament_status"],"p_tournament_id": string }; Returns: undefined
                           },
"tournament_status_label":
{ Args: { "p_status": Database["public"]['Enums']["tournament_status"] }; Returns: string
                           },
"update_team_roster":
{ Args: { "p_member_emails": (string)[],"p_team_id": string,"p_team_name": string }; Returns: undefined
                           },
"withdraw_team":
{ Args: { "p_team_id": string }; Returns: undefined
                           }
          }
          Enums: {
            "confirmation_response": "confirmed"|"disputed","match_side": "home"|"away","match_stage": "group"|"playoff","result_status": "provisional"|"confirmed"|"disputed","scoring_type": "sets"|"goals","team_member_role": "captain"|"player","team_status": "pending"|"approved"|"rejected","tournament_status": "draft"|"registration_open"|"group_stage"|"playoffs"|"finished"
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
            "confirmation_response": ["confirmed", "disputed"],"match_side": ["home", "away"],"match_stage": ["group", "playoff"],"result_status": ["provisional", "confirmed", "disputed"],"scoring_type": ["sets", "goals"],"team_member_role": ["captain", "player"],"team_status": ["pending", "approved", "rejected"],"tournament_status": ["draft", "registration_open", "group_stage", "playoffs", "finished"]
          }
        }
} as const

