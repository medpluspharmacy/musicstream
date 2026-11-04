import { ReactNode, useState } from "react";
import { Loader2, Eye, EyeOff } from "lucide-react";

export function PageHeader({ title, description, action, children }: { title: string, description?: string, action?: ReactNode, children?: ReactNode }) {
  const actions = action ?? children;
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
      <div>
        <h1 className="text-3xl font-bold text-foreground">{title}</h1>
        {description && <p className="text-muted-foreground mt-1 text-sm md:text-base">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-3">{actions}</div>}
    </div>
  );
}

export function Card({ children, className = "", onClick, ...rest }: { children: ReactNode, className?: string, onClick?: () => void, [k: string]: any }) {
  return (
    <div
      className={`bg-card rounded-2xl border border-border shadow-sm overflow-hidden transition-all duration-200 hover:shadow-md ${className}`}
      onClick={onClick}
      {...rest}
    >
      {children}
    </div>
  );
}

export function StatusBadge({ status, colors = {} }: { status: string, colors?: Record<string, string> }) {
  const colorClass = colors[status] ?? "bg-gray-100 text-gray-700 border-gray-200";
  const formattedStatus = status.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase());

  return (
    <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${colorClass}`}>
      {formattedStatus}
    </span>
  );
}

export function Button({
  children, variant = "primary", size = "md", className = "", isLoading = false, ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "outline" | "ghost" | "destructive";
  size?: "sm" | "md" | "lg";
  isLoading?: boolean;
}) {
  const baseClass = "inline-flex items-center justify-center font-medium rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none active:scale-[0.98]";

  const variants = {
    primary: "bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm hover:shadow",
    secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
    outline: "border-2 border-border bg-transparent hover:bg-muted text-foreground",
    ghost: "bg-transparent hover:bg-muted text-foreground",
    destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-sm",
  };

  const sizes = {
    sm: "px-3 py-1.5 text-sm",
    md: "px-4 py-2 text-sm",
    lg: "px-6 py-3 text-base",
  };

  return (
    <button className={`${baseClass} ${variants[variant]} ${sizes[size]} ${className}`} disabled={isLoading || props.disabled} {...props}>
      {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
      {children}
    </button>
  );
}

export function Input({ className = "", error, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { error?: string }) {
  return (
    <div className="w-full">
      <input
        className={`w-full px-4 py-2.5 rounded-xl bg-background border ${error ? 'border-destructive focus:ring-destructive/20' : 'border-border focus:border-primary focus:ring-primary/20'} focus:outline-none focus:ring-4 transition-all duration-200 text-foreground placeholder:text-muted-foreground ${className}`}
        {...props}
      />
      {error && <p className="mt-1.5 text-sm text-destructive font-medium">{error}</p>}
    </div>
  );
}

export function PasswordInput({ className = "", error, ...props }: Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> & { error?: string }) {
  const [show, setShow] = useState(false);
  return (
    <div className="w-full">
      <div className="relative">
        <input
          type={show ? "text" : "password"}
          className={`w-full px-4 py-2.5 pr-11 rounded-xl bg-background border ${error ? 'border-destructive focus:ring-destructive/20' : 'border-border focus:border-primary focus:ring-primary/20'} focus:outline-none focus:ring-4 transition-all duration-200 text-foreground placeholder:text-muted-foreground ${className}`}
          {...props}
        />
        <button
          type="button"
          tabIndex={-1}
          onClick={() => setShow(s => !s)}
          aria-label={show ? "Hide password" : "Show password"}
          aria-pressed={show}
          disabled={props.disabled}
          className="absolute right-3 top-1/2 -translate-y-1/2 inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 disabled:opacity-50"
        >
          {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>
      {error && <p className="mt-1.5 text-sm text-destructive font-medium">{error}</p>}
    </div>
  );
}

export function Label({ children, className = "" }: { children: ReactNode, className?: string }) {
  return (
    <label className={`block text-sm font-semibold text-foreground mb-1.5 ${className}`}>
      {children}
    </label>
  );
}

export function FullPageLoader() {
  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center bg-background">
      <Loader2 className="w-10 h-10 animate-spin text-primary mb-4" />
      <p className="text-muted-foreground font-medium animate-pulse">Loading MusicStream...</p>
    </div>
  );
}

export function EmptyState({ title, description, icon: Icon, action }: { title: string, description: string, icon: any, action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center p-12 text-center bg-muted/30 rounded-2xl border border-dashed border-border">
      <div className="w-16 h-16 bg-background rounded-full flex items-center justify-center shadow-sm border border-border mb-4">
        <Icon className="w-8 h-8 text-muted-foreground" />
      </div>
      <h3 className="text-xl font-semibold text-foreground">{title}</h3>
      <p className="mt-2 text-muted-foreground max-w-md">{description}</p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
