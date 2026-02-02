export type QueueStatus = 'WAITING' | 'COMPLETED' | 'CANCELLED';

export interface Patient {
    id: number;
    full_name: string;
    phone: string;
    birth_date?: string;
    history?: unknown[];
}

export interface Service {
    id: number;
    name: string;
    price: number;
    priority: number;
}

export interface Doctor {
    id: number;
    full_name: string;
    specialty: string;
    services: Service[];
}

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

