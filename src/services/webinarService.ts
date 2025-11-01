import { supabase } from '../lib/supabaseClient';
import type {
  Webinar,
  WebinarWithSpeakers,
  WebinarSpeaker,
  WebinarTestimonial,
  WebinarRegistration,
  WebinarRegistrationWithDetails,
  WebinarRegistrationFormData,
  WebinarEmailLog,
  CreateWebinarData,
  UpdateWebinarData,
  WebinarFilters,
  WebinarStats,
  WebinarUpdate,
  WebinarUpdateWithViewStatus,
  CreateWebinarUpdateData,
  UpdateWebinarUpdateData
} from '../types/webinar';

class WebinarService {
  // ====== WEBINAR METHODS ======
  async getAllWebinars(filters?: WebinarFilters): Promise<Webinar[]> {
    let query = supabase.from('webinars').select('*').order('scheduled_at', { ascending: true });

    if (filters?.status) query = query.eq('status', filters.status);
    if (filters?.is_featured !== undefined) query = query.eq('is_featured', filters.is_featured);
    if (filters?.search)
      query = query.or(`title.ilike.%${filters.search}%,description.ilike.%${filters.search}%`);
    if (filters?.from_date) query = query.gte('scheduled_at', filters.from_date);
    if (filters?.to_date) query = query.lte('scheduled_at', filters.to_date);

    const { data, error } = await query;
    if (error) throw new Error('Failed to fetch webinars');
    return data || [];
  }

  async getWebinarBySlug(slug: string): Promise<WebinarWithSpeakers | null> {
    const { data: webinar, error } = await supabase.from('webinars').select('*').eq('slug', slug).maybeSingle();
    if (error) throw new Error('Failed to fetch webinar');
    if (!webinar) return null;

    if (webinar.speaker_ids?.length > 0) {
      const { data: speakers } = await supabase.from('webinar_speakers').select('*').in('id', webinar.speaker_ids);
      return { ...webinar, speakers: speakers || [] };
    }
    return webinar;
  }

  async getWebinarById(id: string): Promise<WebinarWithSpeakers | null> {
    const { data: webinar, error } = await supabase.from('webinars').select('*').eq('id', id).maybeSingle();
    if (error) throw new Error('Failed to fetch webinar');
    if (!webinar) return null;

    if (webinar.speaker_ids?.length > 0) {
      const { data: speakers } = await supabase.from('webinar_speakers').select('*').in('id', webinar.speaker_ids);
      return { ...webinar, speakers: speakers || [] };
    }
    return webinar;
  }

  async getUpcomingWebinars(limit?: number): Promise<Webinar[]> {
    let query = supabase
      .from('webinars')
      .select('*')
      .eq('status', 'upcoming')
      .gte('scheduled_at', new Date().toISOString())
      .order('scheduled_at', { ascending: true });
    if (limit) query = query.limit(limit);

    const { data, error } = await query;
    if (error) throw new Error('Failed to fetch upcoming webinars');
    return data || [];
  }

  async getFeaturedWebinars(): Promise<Webinar[]> {
    const { data, error } = await supabase
      .from('webinars')
      .select('*')
      .eq('is_featured', true)
      .eq('status', 'upcoming')
      .gte('scheduled_at', new Date().toISOString())
      .order('scheduled_at', { ascending: true })
      .limit(3);

    if (error) throw new Error('Failed to fetch featured webinars');
    return data || [];
  }

  async checkWebinarCapacity(webinarId: string): Promise<boolean> {
    const { data, error } = await supabase.rpc('check_webinar_capacity', { p_webinar_id: webinarId });
    if (error) return false;
    return data === true;
  }

  // ====== REGISTRATION METHODS ======
  async createRegistration(webinarId: string, userId: string, formData: WebinarRegistrationFormData): Promise<WebinarRegistration> {
    const { data, error } = await supabase
      .from('webinar_registrations')
      .insert({
        webinar_id: webinarId,
        user_id: userId,
        ...formData,
        registration_status: 'pending',
        payment_status: 'pending'
      })
      .select()
      .single();

    if (error) throw new Error('Failed to create registration');
    return data;
  }

  async updateRegistrationPayment(registrationId: string, paymentTransactionId: string, paymentStatus: 'completed' | 'failed'): Promise<void> {
    const updateData: any = {
      payment_transaction_id: paymentTransactionId,
      payment_status: paymentStatus,
      updated_at: new Date().toISOString()
    };
    if (paymentStatus === 'completed') updateData.registration_status = 'confirmed';

    const { error } = await supabase.from('webinar_registrations').update(updateData).eq('id', registrationId);
    if (error) throw new Error('Failed to update registration payment');
  }

  async getUserRegistrations(userId: string): Promise<WebinarRegistrationWithDetails[]> {
    const { data, error } = await supabase
      .from('webinar_registrations')
      .select(`*, webinar:webinars(*)`)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (error) throw new Error('Failed to fetch registrations');
    return data || [];
  }

  async getRegistrationById(registrationId: string): Promise<WebinarRegistrationWithDetails | null> {
    const { data, error } = await supabase
      .from('webinar_registrations')
      .select(`*, webinar:webinars(*)`)
      .eq('id', registrationId)
      .maybeSingle();

    if (error) throw new Error('Failed to fetch registration');
    return data;
  }

  async checkUserRegistration(userId: string, webinarId: string): Promise<WebinarRegistration | null> {
    const { data, error } = await supabase
      .from('webinar_registrations')
      .select('*')
      .eq('user_id', userId)
      .eq('webinar_id', webinarId)
      .maybeSingle();
    if (error) return null;
    return data;
  }

  // ====== SPEAKER METHODS ======
  async getAllSpeakers(): Promise<WebinarSpeaker[]> {
    const { data, error } = await supabase.from('webinar_speakers').select('*').order('created_at', { ascending: false });
    if (error) throw new Error('Failed to fetch speakers');
    return data || [];
  }

  async createSpeaker(speakerData: Omit<WebinarSpeaker, 'id' | 'created_at' | 'updated_at'>): Promise<WebinarSpeaker> {
    const { data, error } = await supabase.from('webinar_speakers').insert(speakerData).select().single();
    if (error) throw new Error('Failed to create speaker');
    return data;
  }

  async updateSpeaker(speakerId: string, speakerData: Partial<WebinarSpeaker>): Promise<WebinarSpeaker> {
    const { data, error } = await supabase
      .from('webinar_speakers')
      .update({ ...speakerData, updated_at: new Date().toISOString() })
      .eq('id', speakerId)
      .select()
      .single();
    if (error) throw new Error('Failed to update speaker');
    return data;
  }

  async deleteSpeaker(speakerId: string): Promise<void> {
    const { error } = await supabase.from('webinar_speakers').delete().eq('id', speakerId);
    if (error) throw new Error('Failed to delete speaker');
  }

  // ====== TESTIMONIAL METHODS ======
  async getTestimonials(featuredOnly = false): Promise<WebinarTestimonial[]> {
    let query = supabase.from('webinar_testimonials').select('*').order('created_at', { ascending: false });
    if (featuredOnly) query = query.eq('is_featured', true);
    const { data, error } = await query;
    if (error) throw new Error('Failed to fetch testimonials');
    return data || [];
  }

  async createTestimonial(testimonialData: Omit<WebinarTestimonial, 'id' | 'created_at'>): Promise<WebinarTestimonial> {
    const { data, error } = await supabase.from('webinar_testimonials').insert(testimonialData).select().single();
    if (error) throw new Error('Failed to create testimonial');
    return data;
  }

  async updateTestimonial(testimonialId: string, testimonialData: Partial<WebinarTestimonial>): Promise<WebinarTestimonial> {
    const { data, error } = await supabase.from('webinar_testimonials').update(testimonialData).eq('id', testimonialId).select().single();
    if (error) throw new Error('Failed to update testimonial');
    return data;
  }

  async deleteTestimonial(testimonialId: string): Promise<void> {
    const { error } = await supabase.from('webinar_testimonials').delete().eq('id', testimonialId);
    if (error) throw new Error('Failed to delete testimonial');
  }

  // ====== EMAIL LOGGING ======
  async logEmail(emailLog: Omit<WebinarEmailLog, 'id' | 'sent_at'>): Promise<void> {
    const { error } = await supabase.from('webinar_email_logs').insert(emailLog);
    if (error) console.error('Error logging email:', error);
  }

  // ====== WEBINAR STATS ======
  async getWebinarStats(): Promise<WebinarStats> {
    const { data: webinars } = await supabase.from('webinars').select('id, status, current_attendees, max_attendees');
    const { data: registrations } = await supabase
      .from('webinar_registrations')
      .select('payment_status')
      .eq('payment_status', 'completed');

    const totalWebinars = webinars?.length || 0;
    const upcomingWebinars = webinars?.filter(w => w.status === 'upcoming').length || 0;
    const totalRegistrations = registrations?.length || 0;
    const completed = webinars?.filter(w => w.status === 'completed') || [];
    const totalAttendees = completed.reduce((s, w) => s + (w.current_attendees || 0), 0);
    const totalCapacity = completed.reduce((s, w) => s + (w.max_attendees || 0), 0);
    const avgAttendance = totalCapacity ? (totalAttendees / totalCapacity) * 100 : 0;

    return {
      total_webinars: totalWebinars,
      upcoming_webinars: upcomingWebinars,
      total_registrations: totalRegistrations,
      total_revenue: 0,
      average_attendance: Math.round(avgAttendance)
    };
  }

  // ====== WEBINAR UPDATES ======
  async getWebinarUpdates(webinarId: string, userId?: string): Promise<WebinarUpdateWithViewStatus[]> {
    const { data: updates, error } = await supabase
      .from('webinar_updates')
      .select('*')
      .eq('webinar_id', webinarId)
      .eq('is_published', true)
      .order('created_at', { ascending: false });

    if (error) throw new Error('Failed to fetch webinar updates');
    if (!updates || !userId) return updates || [];

    const { data: views } = await supabase
      .from('webinar_update_views')
      .select('update_id')
      .eq('user_id', userId)
      .in('update_id', updates.map(u => u.id));

    const viewed = new Set((views || []).map(v => v.update_id));
    return updates.map(u => ({ ...u, is_viewed: viewed.has(u.id) }));
  }

  async getUnreadUpdatesCount(userId: string, webinarId: string): Promise<number> {
    const { data, error } = await supabase.rpc('get_unread_webinar_updates_count', {
      p_user_id: userId,
      p_webinar_id: webinarId
    });
    if (error) return 0;
    return data || 0;
  }

  async markUpdateAsViewed(updateId: string, userId: string): Promise<void> {
    const { error } = await supabase
      .from('webinar_update_views')
      .upsert({ update_id: updateId, user_id: userId }, { onConflict: 'update_id,user_id' });
    if (error) console.error('Error marking update as viewed:', error);
  }

  async markAllUpdatesAsViewed(webinarId: string, userId: string): Promise<void> {
    const { data: updates } = await supabase
      .from('webinar_updates')
      .select('id')
      .eq('webinar_id', webinarId)
      .eq('is_published', true);

    if (!updates?.length) return;
    const views = updates.map(u => ({ update_id: u.id, user_id: userId }));

    const { error } = await supabase.from('webinar_update_views').upsert(views, { onConflict: 'update_id,user_id' });
    if (error) console.error('Error marking all updates as viewed:', error);
  }

  // ====== ADMIN UPDATE MANAGEMENT ======
  async createWebinarUpdate(updateData: CreateWebinarUpdateData): Promise<WebinarUpdate> {
    const { data, error } = await supabase.from('webinar_updates').insert(updateData).select().single();
    if (error) throw new Error('Failed to create webinar update');
    return data;
  }

  async updateWebinarUpdate(updateData: UpdateWebinarUpdateData): Promise<WebinarUpdate> {
    const { id, ...fields } = updateData;
    const { data, error } = await supabase.from('webinar_updates').update(fields).eq('id', id).select().single();
    if (error) throw new Error('Failed to update webinar update');
    return data;
  }

  async deleteWebinarUpdate(updateId: string): Promise<void> {
    const { error } = await supabase.from('webinar_updates').delete().eq('id', updateId);
    if (error) throw new Error('Failed to delete webinar update');
  }

  async getAllWebinarUpdates(webinarId: string): Promise<WebinarUpdate[]> {
    const { data, error } = await supabase
      .from('webinar_updates')
      .select('*')
      .eq('webinar_id', webinarId)
      .order('created_at', { ascending: false });
    if (error) throw new Error('Failed to fetch all webinar updates');
    return data || [];
  }
}

export const webinarService = new WebinarService();
