export interface Service {
  id?: number;
  name: string;
  price: number;
  priority: number;
}

export interface DoctorBase {
  id: number;
  full_name: string;
  specialty: string;
  services: Service[];
}

export interface Doctor extends DoctorBase {
  // Optional admin fields
  queue_prefix?: string;
  is_active?: boolean;
}

export interface DoctorAdmin extends DoctorBase {
  queue_prefix: string;
  is_active: boolean;
}
