import { useEffect, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import {
  listNotices,
  createNotice,
  updateNotice,
  deleteNotice,
  reorderNotices,
  type Notice,
} from "../api/admin";
import { useToast } from "../components/Toast";
import { confirmDialog } from "../components/Dialog";
import { extractErrorMessage } from "../lib/errors";
import { Loader2, Plus, Trash2, GripVertical, Save } from "lucide-react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

const TYPE_COLORS: Record<string, string> = {
  info: "#3b82f6",
  warning: "#f59e0b",
  promo: "#22c55e",
};

interface SortableCardProps {
  notice: Notice;
  onUpdate: (patch: Partial<Notice>) => void;
  onDelete: () => void;
  onSave: () => Promise<void>;
  saving: boolean;
  dirty: boolean;
}

function SortableCard({ notice, onUpdate, onDelete, onSave, saving, dirty }: SortableCardProps) {
  const { t } = useTranslation();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: notice.id,
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="card p-5">
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <button
          {...attributes}
          {...listeners}
          aria-label={t("common.search")}
          style={{
            cursor: "grab",
            padding: 4,
            color: "var(--text-3)",
            background: "transparent",
            border: "none",
            display: "inline-flex",
          }}
        >
          <GripVertical size={16} />
        </button>
        <select
          className="input"
          style={{ width: 120 }}
          value={notice.type}
          onChange={(e) => onUpdate({ type: e.target.value as Notice["type"] })}
        >
          <option value="info">{t("notices.types.info")}</option>
          <option value="warning">{t("notices.types.warning")}</option>
          <option value="promo">{t("notices.types.promo")}</option>
        </select>
        <div className="h-3 w-3 rounded-full" style={{ background: TYPE_COLORS[notice.type] }} />
        <div className="flex-1" />
        <label className="flex items-center gap-2 text-xs" style={{ color: "var(--text-2)" }}>
          <input
            type="checkbox"
            checked={notice.active}
            onChange={(e) => onUpdate({ active: e.target.checked })}
          />
          {t("notices.active")}
        </label>
        {dirty && (
          <button className="btn btn-primary" onClick={onSave} disabled={saving} style={{ padding: "6px 12px" }}>
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            {t("common.save")}
          </button>
        )}
        <button className="btn btn-danger" onClick={onDelete} style={{ padding: "6px 10px" }}>
          <Trash2 size={14} />
        </button>
      </div>

      <div className="space-y-2">
        <input
          className="input"
          placeholder={t("notices.english")}
          dir="ltr"
          value={notice.text}
          onChange={(e) => onUpdate({ text: e.target.value })}
        />
        <input
          className="input"
          placeholder={t("notices.persian")}
          dir="rtl"
          value={notice.text_fa}
          onChange={(e) => onUpdate({ text_fa: e.target.value })}
        />
        <input
          className="input"
          placeholder={t("notices.linkOptional")}
          dir="ltr"
          value={notice.link ?? ""}
          onChange={(e) => onUpdate({ link: e.target.value })}
        />
      </div>
    </div>
  );
}

export function NoticesPage() {
  const { t } = useTranslation();
  const [notices, setNotices] = useState<Notice[]>([]);
  const [dirty, setDirty] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const toast = useToast();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const fetchAll = useCallback(async () => {
    try {
      const res = await listNotices();
      setNotices(res.notices ?? []);
      setDirty(new Set());
    } catch (err) {
      toast.error(await extractErrorMessage(err, t("errors.loadFailed")));
    }
    setLoading(false);
  }, [toast, t]);

  useEffect(() => {
    void fetchAll();
  }, [fetchAll]);

  const updateLocal = (id: string, patch: Partial<Notice>) => {
    setNotices((prev) => prev.map((n) => (n.id === id ? { ...n, ...patch } : n)));
    setDirty((prev) => new Set(prev).add(id));
  };

  const saveOne = async (id: string) => {
    const notice = notices.find((n) => n.id === id);
    if (!notice) return;
    setSavingId(id);
    try {
      await updateNotice(id, notice);
      toast.success(t("notices.toasts.saved"));
      setDirty((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    } catch (err) {
      toast.error(await extractErrorMessage(err, t("errors.saveFailed")));
    }
    setSavingId(null);
  };

  const handleAdd = async () => {
    setCreating(true);
    try {
      // Create as a draft (active=false). Backend force-disables blank
      // notices so they never reach the public banner cache; the user fills
      // in text + toggles active before saving via PUT.
      const created = await createNotice({
        text: "",
        text_fa: "",
        type: "info",
        active: false,
      });
      setNotices((prev) => [...prev, created]);
      setDirty((prev) => new Set(prev).add(created.id));
      toast.success(t("notices.toasts.added"));
    } catch (err) {
      toast.error(await extractErrorMessage(err, t("errors.createFailed")));
    }
    setCreating(false);
  };

  const handleDelete = async (id: string) => {
    const ok = await confirmDialog({
      title: t("notices.deleteTitle"),
      message: t("notices.deleteMessage"),
      confirmLabel: t("common.delete"),
      variant: "danger",
    });
    if (!ok) return;
    try {
      await deleteNotice(id);
      setNotices((prev) => prev.filter((n) => n.id !== id));
      toast.success(t("notices.toasts.deleted"));
    } catch (err) {
      toast.error(await extractErrorMessage(err, t("errors.deleteFailed")));
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = notices.findIndex((n) => n.id === active.id);
    const newIndex = notices.findIndex((n) => n.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;

    // Optimistic reorder.
    const reordered = [...notices];
    const [moved] = reordered.splice(oldIndex, 1);
    reordered.splice(newIndex, 0, moved);
    setNotices(reordered);

    try {
      await reorderNotices(reordered.map((n) => n.id));
      toast.success(t("notices.toasts.reordered"));
    } catch (err) {
      toast.error(await extractErrorMessage(err, t("notices.toasts.reorderFailed")));
      // Roll back.
      setNotices(notices);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 size={24} className="animate-spin" style={{ color: "var(--accent)" }} />
      </div>
    );
  }

  return (
    <div className="space-y-5 md:space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold" style={{ color: "var(--text-1)" }}>
            {t("notices.title")}
          </h1>
          <p className="text-xs md:text-sm mt-0.5 md:mt-1" style={{ color: "var(--text-3)" }}>
            {t("notices.subtitle")}
          </p>
        </div>
        <button className="btn btn-primary" onClick={handleAdd} disabled={creating}>
          {creating ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}{" "}
          {t("notices.addNotice")}
        </button>
      </div>

      {notices.length === 0 ? (
        <div className="card p-10 text-center">
          <p style={{ color: "var(--text-3)" }}>{t("notices.noNotices")}</p>
        </div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={notices.map((n) => n.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-3">
              {notices.map((notice) => (
                <SortableCard
                  key={notice.id}
                  notice={notice}
                  onUpdate={(patch) => updateLocal(notice.id, patch)}
                  onDelete={() => handleDelete(notice.id)}
                  onSave={() => saveOne(notice.id)}
                  saving={savingId === notice.id}
                  dirty={dirty.has(notice.id)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {notices.filter((n) => n.active && n.text).length > 0 && (
        <div className="card p-5">
          <h2 className="text-sm font-semibold mb-3" style={{ color: "var(--text-1)" }}>
            {t("notices.preview")}
          </h2>
          <div className="max-w-sm mx-auto space-y-2">
            {notices
              .filter((n) => n.active && n.text)
              .map((n) => (
                <div
                  key={n.id}
                  className="flex items-center gap-3 rounded-xl px-4 py-3"
                  style={{
                    background: `${TYPE_COLORS[n.type]}10`,
                    border: `1px solid ${TYPE_COLORS[n.type]}30`,
                  }}
                >
                  <div className="h-2 w-2 shrink-0 rounded-full" style={{ background: TYPE_COLORS[n.type] }} />
                  <p className="text-xs flex-1" style={{ color: "var(--text-1)" }}>
                    {n.text}
                  </p>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
