export type QueueStatus = 'WAITING' | 'COMPLETED' | 'CANCELLED' | 'REFUNDED';

export type { Doctor, Service } from './doctors';
export type { Patient } from './patients';

export interface QueueItem {
  id: number;
  ticket_number: string;
  patient_name: string;
  patient_id?: number | null;
  doctor_id?: number | null;
  doctor_name: string;
  status: QueueStatus;
  created_at: string;
}
