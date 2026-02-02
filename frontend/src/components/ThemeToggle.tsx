import { Moon, Sun } from 'lucide-react';
import { useTheme } from '../ThemeProvider';
import { Button } from './ui/button';

export function ThemeToggle() {
  const { resolvedTheme, toggleTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggleTheme}
      title="Toggle Theme"
      aria-label="Toggle Theme"
      className={
        isDark
          ? 'h-[40px] w-[40px] rounded-full border border-border bg-secondary/70 shadow-sm hover:bg-secondary'
          : 'h-[40px] w-[40px] rounded-full border border-border bg-card/80 shadow-sm backdrop-blur hover:bg-secondary/70'
      }
    >
      {resolvedTheme === 'dark' ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
    </Button>
  );
}
