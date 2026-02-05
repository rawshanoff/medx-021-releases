import client from '../api/client';

export type PatientRequiredFields = {
  phone: boolean;
  firstName: boolean;
  lastName: boolean;
  birthDate: boolean;
};

export const defaultPatientRequiredFields: PatientRequiredFields = {
  phone: true,
  firstName: true,
  lastName: true,
  birthDate: false,
};

export async function getPatientRequiredFields(): Promise<PatientRequiredFields> {
  try {
    const res = await client.get('/system/settings/patient_required_fields');
    const value = (res.data?.value ?? res.data) as Partial<PatientRequiredFields> | undefined;
    return { ...defaultPatientRequiredFields, ...(value || {}) };
  } catch {
    return defaultPatientRequiredFields;
  }
}

export async function setPatientRequiredFields(
  next: PatientRequiredFields,
): Promise<PatientRequiredFields> {
  await client.put('/system/settings/patient_required_fields', { value: next });
  return next;
}
