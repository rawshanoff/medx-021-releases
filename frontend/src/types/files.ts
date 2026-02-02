export interface PatientFile {
  id: number;
  patient_id: number;
  file_type: string;
  original_filename: string;
  mime?: string | null;
  size: number;
  sha256: string;
  created_at: string;
}
