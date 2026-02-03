export type UserRead = {
  id: number;
  username: string;
  full_name?: string | null;
  role: string;
  is_active: boolean;
};
