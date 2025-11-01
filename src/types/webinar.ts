// =============================
//  WEBINAR CORE TYPES
// =============================

export type WebinarStatus = 'upcoming' | 'live' | 'completed' | 'cancelled';

export interface WebinarLearningOutcomes {
  outcomes: string[];
}

export interface Webinar {
  id: string;
  title: string;
  slug: string;
  description: string;
  short_description?: string;
  thumbnail_url?: string;
  scheduled_at: string;
  duration_minutes: number;
  meet_link: string;
  original_price: number;
  discounted_price: number;
  max_attendees?: number;
  current_attendees: number;
  status: WebinarStatus;
  speaker_ids: string[];
  learning_outcomes?: WebinarLearningOutcomes;
  target_audience: string[];
  prerequisites: string[];
  is_featured: boolean;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface WebinarWithSpeakers extends Webinar {
  speakers?: WebinarSpeaker[];
}

// =============================
//  SPEAKERS & TESTIMONIALS
// =============================

export interface WebinarSpeaker {
  id: string;
  name: string;
  title?: string;
  bio?: string;
  photo_url?: string;
  linkedin_url?: string;
  expertise_areas: string[];
  created_at: string;
  updated_at: string;
}

export interface WebinarTestimonial {
  id: string;
  student_name: string;
  student_photo_url?: string;
  college_name?: string;
  testimonial_text: string;
  placement_company?: string;
  rating?: number;
  is_featured: boolean;
  created_at: string;
}

// =============================
//  REGISTRATIONS & PAYMENTS
// =============================

export type RegistrationStatus = 'pending' | 'confirmed' | 'cancelled';
export type PaymentStatus = 'pending' | 'completed' | 'failed' | 'refunded';

export interface WebinarRegistration {
  id: string;
  webinar_id: string;
  user_id?: string;
  full_name: string;
  email: string;
  college_name?: string;
  year_of_study?: string;
  branch?: string;
  phone_number?: string;
  payment_transaction_id?: string;
  registration_status: RegistrationStatus;
  payment_status: PaymentStatus;
  meet_link_sent: boolean;
  meet_link_sent_at?: string;
  attendance_marked: boolean;
  attended_at?: string;
  registration_source?: string;
  created_at: string;
  updated_at: string;
}

export interface WebinarRegistrationWithDetails extends WebinarRegistration {
  webinar?: Webinar;
}

export interface WebinarRegistrationFormData {
  full_name: string;
  email: string;
  college_name?: string;
  year_of_study?: string;
  branch?: string;
  phone_number?: string;
}

// =============================
//  EMAIL LOGGING
// =============================

export type EmailType =
  | 'confirmation'
  | 'reminder_24h'
  | 'reminder_1h'
  | 'followup'
  | 'cancellation';

export type EmailDeliveryStatus = 'sent' | 'delivered' | 'failed' | 'bounced';

export interface WebinarEmailLog {
  id: string;
  registration_id: string;
  email_type: EmailType;
  recipient_email: string;
  subject?: string;
  sent_at: string;
  delivery_status: EmailDeliveryStatus;
  error_message?: string;
  resend_count: number;
}

// =============================
//  CREATE / UPDATE TYPES
// =============================

export interface CreateWebinarData {
  title: string;
  slug: string;
  description: string;
  short_description?: string;
  thumbnail_url?: string;
  scheduled_at: string;
  duration_minutes: number;
  meet_link: string;
  original_price: number;
  discounted_price: number;
  max_attendees?: number;
  speaker_ids?: string[];
  learning_outcomes?: WebinarLearningOutcomes;
  target_audience?: string[];
  prerequisites?: string[];
  is_featured?: boolean;
}

export interface UpdateWebinarData extends Partial<CreateWebinarData> {
  id: string;
  status?: WebinarStatus;
}

export interface WebinarFilters {
  status?: WebinarStatus;
  is_featured?: boolean;
  search?: string;
  from_date?: string;
  to_date?: string;
}

// =============================
//  STATS
// =============================

export interface WebinarStats {
  total_webinars: number;
  upcoming_webinars: number;
  total_registrations: number;
  total_revenue: number;
  average_attendance: number;
}

// =============================
//  WEBINAR UPDATES MODULE
// =============================

export type WebinarUpdateType =
  | 'meet_link'
  | 'announcement'
  | 'material'
  | 'schedule_change'
  | 'reminder';

export interface WebinarUpdate {
  id: string;
  webinar_id: string;
  update_type: WebinarUpdateType;
  title: string;
  description?: string;
  link_url?: string;
  attachment_url?: string;
  is_published: boolean;
  publish_at?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface WebinarUpdateView {
  id: string;
  update_id: string;
  user_id: string;
  viewed_at: string;
}

export interface WebinarUpdateWithViewStatus extends WebinarUpdate {
  is_viewed?: boolean;
}

export interface CreateWebinarUpdateData {
  webinar_id: string;
  update_type: WebinarUpdateType;
  title: string;
  description?: string;
  link_url?: string;
  attachment_url?: string;
  is_published?: boolean;
  publish_at?: string;
}

export interface UpdateWebinarUpdateData extends Partial<CreateWebinarUpdateData> {
  id: string;
}
