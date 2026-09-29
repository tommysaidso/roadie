export type Role = "band" | "venue" | "booker" | "sponsor" | "public" | "admin";

export interface Band {
  id: number; name: string; genre?: string; genres?: string;
  home_city?: string; home_region?: string; lat?: number; lng?: number;
  bio?: string; bio_short?: string; members?: string; draw?: number;
  rate_min?: number; rate_max?: number; touring?: number; socials?: string;
  hero_image?: string; mymymy_artist_id?: string;
}
export interface Venue {
  id: number; name: string; city?: string; region?: string;
  lat?: number; lng?: number; capacity?: number; genres?: string;
  backline?: string; contact?: string;
  pay_model?: string; notes?: string;
}
export interface VenueSlot {
  id: number; venue_id: number; date: string; status: string;
  genre_wanted?: string; guarantee?: number; notes?: string; source?: string;
}
export interface Notice {
  id: number; kind: string; author_type?: string; author_id?: number;
  title?: string; body?: string; city?: string; region?: string;
  date_from?: string; date_to?: string; genre?: string; created_at?: string;
}
export interface Sponsor { id: number; name: string; kind?: string; city?: string; budget_monthly?: number; }
export interface AdPlacement {
  id: number; sponsor_id: number; surface?: string; label?: string;
  cost?: number; impressions?: number; clicks?: number; conversions?: number;
}
