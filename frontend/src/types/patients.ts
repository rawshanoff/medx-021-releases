export interface PatientBase {
  id: number;
  full_name: string;
  phone: string;
  birth_date?: string | null;
}

export interface Patient extends PatientBase {
  // Optional fields that exist on some endpoints/pages
  balance?: number;
  category?: string | null;
  telegram_chat_id?: number | null;
  telegram_username?: string | null;

  // Optional history field used by Reception history modal payloads
  history?: unknown;
}

export interface PatientWithBalance extends Patient {
  balance: number;
  category: string;
}

export interface PatientTransactionRead {
  id: number;
  amount: number;
  payment_method: string;
  cash_amount: number;
  card_amount: number;
  transfer_amount: number;
  description?: string | null;
  doctor_id?: string | null;
  created_at: string;
}

export interface PatientQueueHistoryRead {
  id: number;
  ticket_number: string;
  doctor_id?: number | null;
  status: string;
  created_at: string;
}

export interface PatientAppointmentHistoryRead {
  id: number;
  doctor_id?: string | null;
  start_time: string;
  end_time: string;
  status: string;
  notes?: string | null;
  created_at: string;
}

export interface PatientHistoryRead {
  transactions: PatientTransactionRead[];
  queue: PatientQueueHistoryRead[];
  appointments: PatientAppointmentHistoryRead[];
}
