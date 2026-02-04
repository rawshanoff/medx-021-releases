import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, ShieldCheck, AlertCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '../components/ui/button';
import { cn } from '../lib/cn';
import client from '../api/client';

export default function Activation() {
  const { t } = useTranslation();
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFile(e.target.files[0]);
      setError('');
    }
  };

  const handleActivate = async () => {
    if (!file) {
      setError(t('auth.upload_key'));
      return;
    }

    setLoading(true);
    const reader = new FileReader();
    reader.onload = async (e) => {
      const content = e.target?.result as string;
      try {
        await client.post('/licenses/upload', { token: content });
        navigate('/');
      } catch (err) {
        setError(t('auth.invalid_key'));
      } finally {
        setLoading(false);
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm rounded-md border border-border bg-card p-5 text-center shadow-sm">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-md bg-secondary text-primary">
          <ShieldCheck size={20} />
        </div>

        <div className="text-[16px] font-medium">{t('auth.welcome')}</div>
        <div className="mt-1 text-[13px] text-muted-foreground">{t('auth.upload_key')}</div>

        <div className="mt-4">
          <label
            htmlFor="license-upload"
            className={cn(
              'flex cursor-pointer flex-col items-center gap-2 rounded-md border border-dashed border-border bg-background px-3 py-4 text-[13px] text-foreground',
              'hover:border-primary hover:bg-secondary/40',
            )}
          >
            <Upload size={16} className="text-muted-foreground" />
            <span className="truncate">{file ? file.name : t('auth.click_upload')}</span>
            <input
              id="license-upload"
              type="file"
              accept=".key"
              onChange={handleFileChange}
              className="hidden"
            />
          </label>
        </div>

        {error ? (
          <div className="mt-3 flex items-center justify-center gap-2 text-[13px] text-destructive">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        ) : null}

        <Button onClick={handleActivate} disabled={loading} className="mt-4 w-full">
          {loading ? t('auth.activating') : t('auth.activate_btn')}
        </Button>
      </div>
    </div>
  );
}
