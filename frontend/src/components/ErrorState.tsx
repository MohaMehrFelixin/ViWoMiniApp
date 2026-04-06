import { useTranslation } from "react-i18next";
import { IconWarning } from "./Icons";

interface ErrorStateProps {
  message?: string;
  onRetry?: () => void;
}

export function ErrorState({ message, onRetry }: ErrorStateProps) {
  const { t } = useTranslation();

  return (
    <div className="flex min-h-[50vh] items-center justify-center p-6">
      <div className="glass glass-animate flex flex-col items-center gap-4 p-8 text-center">
        <div style={{ color: "var(--cat-energy)" }}>
          <IconWarning size={48} />
        </div>
        <h2 className="text-primary text-lg font-semibold">
          {t("common.error")}
        </h2>
        <p className="text-secondary text-sm">
          {message ?? t("common.error")}
        </p>
        {onRetry && (
          <button onClick={onRetry} className="glass-btn glass-btn-primary">
            {t("common.retry")}
          </button>
        )}
      </div>
    </div>
  );
}
