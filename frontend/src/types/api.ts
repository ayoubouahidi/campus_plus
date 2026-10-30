export type UserRole = 'STUDENT' | 'BOARD_MEMBER' | 'SUPERADMIN';

export interface User {
    id : string;
    email : string;
    full_name: string;
    avatar_url : string | null;
    role: UserRole;
    club_id : string | null;
}

export interface AuthTokens{
    access: string;
    refresh: string;
    user: User
}

export interface Department
{
    id : string;
    name : string;
    slug : string;
}

export interface Club {
    id : string;
    department_id : string;
    department_name : string;
    name : string;
    slug : string;
    description : string;
    logo_url : string;
    banner_url: string | null;
    president_name : string;
    president_phone : string;
    president_email : string;
    created_at : string;
}

export type EventCategory = 'Tech' | 'Media' | 'Music' | 'Sports' | 'Business' | 'EventsOrganization' | 'Gaming';

// A few attendees for the card's avatar stack; the full roster lives on /events/[id]
export interface AttendeePreview {
    id: string;
    full_name: string;
    avatar_url: string | null;
}

export interface EventItem {
    id: string;
    club_id: string;
    club_name: string;
    department_name: string;
    title: string;
    description: string;
    flyer_url: string; // '' when the organizer hasn't uploaded one
    location: string;
    category: EventCategory;
    start_time: string; // ISO 8601 string
    end_time: string;   // ISO 8601 string
    rsvps_count: number;
    has_user_rsvpd: boolean;
    attendees_preview: AttendeePreview[]; // at most 3, newest first
  }
  
  // Standard Paginated Response Envelope :  EventResponse, ClubResponse, UserResponse
  export interface ApiResponse<T> {
    count: number;
    next: string | null;
    previous: string | null;
    results: T;
  }
  
  // WebSocket Event Payloads
  export type WebSocketEventType = 'event_created' | 'event_updated' | 'event_deleted';
  
  export interface WebSocketEventPayload {
    type: WebSocketEventType;
    data: EventItem | { id: string };
  }