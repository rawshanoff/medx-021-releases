export type Service = {
  id?: number;
  doctor_id?: number;
  name: string;
  price: number;
  priority: number;
};

export type Doctor = {
  id: number;
  full_name: string;
  specialty?: string | null;
  queue_prefix?: string | null;
  is_active: boolean;
  room_number?: string | null;
  services: Service[];
};

// Admin pages currently use the same shape.
export type DoctorAdmin = Doctor;
