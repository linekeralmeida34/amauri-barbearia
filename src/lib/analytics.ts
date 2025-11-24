// src/lib/analytics.ts
// Google Analytics 4 helper

const GA_MEASUREMENT_ID = 'G-XFDWZDXW80';

declare global {
  interface Window {
    gtag?: (...args: any[]) => void;
    dataLayer?: any[];
  }
}

/** Verifica se o GA4 está carregado */
function isGALoaded(): boolean {
  return typeof window !== 'undefined' && typeof window.gtag === 'function';
}

/** Rastreia visualização de página */
export function trackPageView(path: string, title?: string) {
  if (!isGALoaded()) return;

  window.gtag!('config', GA_MEASUREMENT_ID, {
    page_path: path,
    page_title: title || document.title,
  });
}

/** Rastreia evento customizado */
export function trackEvent(
  eventName: string,
  eventParams?: {
    [key: string]: string | number | boolean | null | undefined;
  }
) {
  if (!isGALoaded()) return;

  window.gtag!('event', eventName, {
    ...eventParams,
  });
}

/** Rastreia clique em botão/link */
export function trackClick(
  elementName: string,
  elementType: 'button' | 'link' | 'icon' = 'button',
  additionalParams?: {
    [key: string]: string | number | boolean | null | undefined;
  }
) {
  trackEvent('click', {
    element_name: elementName,
    element_type: elementType,
    ...additionalParams,
  });
}

/** Rastreia agendamento criado */
export function trackBookingCreated(serviceName: string, barberName: string, price: number) {
  trackEvent('booking_created', {
    service_name: serviceName,
    barber_name: barberName,
    value: price,
    currency: 'BRL',
  });
}

/** Rastreia agendamento cancelado */
export function trackBookingCanceled(bookingId: string, reason?: string) {
  trackEvent('booking_canceled', {
    booking_id: bookingId,
    reason: reason || 'customer_cancel',
  });
}

/** Rastreia login de cliente */
export function trackCustomerLogin(phone: string) {
  trackEvent('customer_login', {
    phone_length: phone.replace(/\D/g, '').length, // Não envia telefone completo por privacidade
  });
}

/** Rastreia login de admin/barbeiro */
export function trackAdminLogin(email: string) {
  trackEvent('admin_login', {
    // Não envia email completo por privacidade
    email_domain: email.split('@')[1] || 'unknown',
  });
}

/** Rastreia filtro aplicado */
export function trackFilterApplied(filterType: string, filterValue: string) {
  trackEvent('filter_applied', {
    filter_type: filterType,
    filter_value: filterValue,
  });
}

/** Rastreia busca de horários disponíveis */
export function trackAvailableTimesSearched(barberId: string, date: string, serviceId: string) {
  trackEvent('available_times_searched', {
    barber_id: barberId,
    date: date,
    service_id: serviceId,
  });
}

