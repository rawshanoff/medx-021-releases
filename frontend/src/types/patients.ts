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

