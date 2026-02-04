import type { Dispatch, FormEvent, SetStateAction } from 'react';
import { UserPlus, Trash2 } from 'lucide-react';
import { cn } from '../../../lib/cn';
import { Button } from '../../../components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../../../components/ui/card';
import { Input } from '../../../components/ui/input';
import { SectionHeader } from '../SectionHeader';

type UserRow = {
  id: number;
  username: string;
  full_name: string;
  role: string;
  is_active: boolean;
};

type CreateUserForm = {
  username: string;
  password: string;
  full_name: string;
  role: string;
};

export function UsersPane({
  tr,
  users,
  usersPage,
  usersPageSize,
  setUsersPage,
  fetchUsers,
  showCreateUserInline,
  setShowCreateUserInline,
  formData,
  setFormData,
  handleCreateUser,
  handleDeleteUser,
}: {
  tr: (key: string, defaultValue: string) => string;
  users: UserRow[];
  usersPage: number;
  usersPageSize: number;
  setUsersPage: Dispatch<SetStateAction<number>>;
  fetchUsers: () => void;
  showCreateUserInline: boolean;
  setShowCreateUserInline: Dispatch<SetStateAction<boolean>>;
  formData: CreateUserForm;
  setFormData: Dispatch<SetStateAction<CreateUserForm>>;
  handleCreateUser: (e: FormEvent<HTMLFormElement>) => void;
  handleDeleteUser: (id: number) => void;
}) {
  return (
    <div className="grid gap-6">
      <SectionHeader
        title={tr('system.users_title', 'Пользователи')}
        subtitle={tr('system.users_description', 'Создание пользователей и управление ролями.')}
        right={
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" type="button" onClick={fetchUsers}>
              {tr('common.refresh', 'Обновить')}
            </Button>
            <Button size="sm" type="button" onClick={() => setShowCreateUserInline((v) => !v)}>
              <UserPlus size={16} /> {tr('common.add', 'Добавить')}
            </Button>
          </div>
        }
      />

      {showCreateUserInline ? (
        <Card>
          <CardHeader>
            <CardTitle>{tr('system.create_user', 'Создать пользователя')}</CardTitle>
            <CardDescription>
              {tr('system.create_user_desc', 'Логин, пароль и роль доступа.')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreateUser} className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {tr('system.username', 'Логин')}
                </label>
                <Input
                  required
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {tr('system.password', 'Пароль')}
                </label>
                <Input
                  required
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                />
              </div>
              <div className="md:col-span-2">
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {tr('system.full_name', 'ФИО')}
                </label>
                <Input
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                />
              </div>
              <div className="md:col-span-2">
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {tr('system.role', 'Роль')}
                </label>
                <select
                  className={cn(
                    'h-10 w-full rounded-md border border-border bg-background px-3 text-sm shadow-none outline-none',
                    'focus-visible:ring-2 focus-visible:ring-blue-500/20 focus-visible:border-blue-500',
                  )}
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                >
                  <option value="doctor">{tr('roles.doctor', 'Врач')}</option>
                  <option value="cashier">{tr('roles.cashier', 'Кассир')}</option>
                  <option value="registrar">{tr('roles.registrar', 'Регистратор')}</option>
                  <option value="admin">{tr('roles.admin', 'Администратор')}</option>
                  <option value="owner">{tr('roles.owner', 'Владелец')}</option>
                </select>
              </div>
              <div className="md:col-span-2 flex justify-end gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setShowCreateUserInline(false)}
                >
                  {tr('common.cancel', 'Отмена')}
                </Button>
                <Button type="submit">{tr('common.create', 'Создать')}</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>{tr('system.users_list', 'Список пользователей')}</CardTitle>
          <CardDescription>
            {tr('system.users_list_desc', 'Таблица в правой панели (без попапов).')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-hidden rounded-xl border border-slate-200/80 dark:border-slate-700/60">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-muted-foreground dark:bg-slate-900/30">
                <tr className="[&>th]:px-3 [&>th]:py-3 [&>th]:text-left [&>th]:font-semibold">
                  <th className="w-[80px]">{tr('common.id', 'ID')}</th>
                  <th>{tr('system.username', 'Логин')}</th>
                  <th>{tr('system.full_name', 'ФИО')}</th>
                  <th className="w-[140px]">{tr('system.role', 'Роль')}</th>
                  <th className="w-[110px] text-right">{tr('common.actions', 'Действия')}</th>
                </tr>
              </thead>
              <tbody className="[&>tr]:border-t [&>tr]:border-slate-200/80 dark:[&>tr]:border-slate-800">
                {users
                  .slice(usersPage * usersPageSize, usersPage * usersPageSize + usersPageSize)
                  .map((u) => (
                    <tr key={u.id} className="[&>td]:px-3 [&>td]:py-3">
                      <td className="text-muted-foreground">{u.id}</td>
                      <td className="font-medium">{u.username}</td>
                      <td>{u.full_name}</td>
                      <td>
                        <span className="inline-flex items-center rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-900/30">
                          {u.role}
                        </span>
                      </td>
                      <td className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          type="button"
                          title={tr('system.delete_user', 'Удалить пользователя')}
                          onClick={() => handleDeleteUser(u.id)}
                        >
                          <Trash2 size={16} />
                        </Button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>

          {users.length > usersPageSize ? (
            <div className="mt-4 flex items-center justify-between gap-3">
              <Button
                variant="secondary"
                size="sm"
                type="button"
                onClick={() => setUsersPage((p) => Math.max(0, p - 1))}
                disabled={usersPage === 0}
              >
                {tr('common.prev', 'Назад')}
              </Button>
              <div className="text-sm text-muted-foreground">
                {usersPage + 1} / {Math.max(1, Math.ceil(users.length / usersPageSize))}
              </div>
              <Button
                variant="secondary"
                size="sm"
                type="button"
                onClick={() =>
                  setUsersPage((p) => Math.min(Math.ceil(users.length / usersPageSize) - 1, p + 1))
                }
                disabled={usersPage >= Math.ceil(users.length / usersPageSize) - 1}
              >
                {tr('common.next', 'Вперёд')}
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
