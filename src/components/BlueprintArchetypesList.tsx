import { useMemo, useState } from "react";
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
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Plus, Search, Trash2 } from "lucide-react";
import type { Blueprint } from "@/server/phased/schemas";

type Archetype = Blueprint["session_archetypes"][number];

export function BlueprintArchetypesList({
  archetypes,
  onChange,
}: {
  archetypes: Archetype[];
  onChange: (next: Archetype[]) => void;
}) {
  const [query, setQuery] = useState("");
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const filteredIds = useMemo(() => {
    if (!query.trim()) return archetypes.map((a) => a.id);
    const q = query.toLowerCase();
    return archetypes
      .filter((a) => a.id.toLowerCase().includes(q) || a.focus.toLowerCase().includes(q))
      .map((a) => a.id);
  }, [archetypes, query]);

  const dragDisabled = query.trim().length > 0;

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = archetypes.findIndex((a) => a.id === active.id);
    const newIndex = archetypes.findIndex((a) => a.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    onChange(arrayMove(archetypes, oldIndex, newIndex));
  }

  function updateAt(index: number, patch: Partial<Archetype>) {
    const next = [...archetypes];
    next[index] = { ...next[index], ...patch };
    onChange(next);
  }

  function removeAt(index: number) {
    onChange(archetypes.filter((_, i) => i !== index));
  }

  function add() {
    onChange([
      ...archetypes,
      { id: `archetype_${archetypes.length + 1}`, focus: "Custom", primary_movements: [] },
    ]);
  }

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Procurar por id ou foco…"
          className="w-full rounded-lg border border-border bg-background py-1.5 pl-8 pr-3 text-xs outline-none focus:border-accent"
        />
      </div>
      {dragDisabled && (
        <p className="text-[11px] text-muted-foreground">
          Arrastar desativado durante a procura. Limpa o filtro para reordenar.
        </p>
      )}

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={archetypes.map((a) => a.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-2">
            {archetypes.map((a, i) => {
              const visible = filteredIds.includes(a.id);
              if (!visible) return null;
              return (
                <SortableRow
                  key={a.id}
                  archetype={a}
                  dragDisabled={dragDisabled}
                  onIdChange={(v) => updateAt(i, { id: v })}
                  onFocusChange={(v) => updateAt(i, { focus: v })}
                  onRemove={() => removeAt(i)}
                />
              );
            })}
          </div>
        </SortableContext>
      </DndContext>

      <button
        onClick={add}
        className="inline-flex items-center gap-1 rounded border border-dashed border-border px-2 py-1 text-xs text-muted-foreground hover:bg-muted"
      >
        <Plus className="h-3 w-3" /> Adicionar archetype
      </button>
    </div>
  );
}

function SortableRow({
  archetype,
  dragDisabled,
  onIdChange,
  onFocusChange,
  onRemove,
}: {
  archetype: Archetype;
  dragDisabled: boolean;
  onIdChange: (v: string) => void;
  onFocusChange: (v: string) => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: archetype.id,
    disabled: dragDisabled,
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 rounded-lg border border-border bg-background/40 p-1.5"
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        disabled={dragDisabled}
        aria-label="Reordenar"
        className="flex h-11 w-11 shrink-0 cursor-grab items-center justify-center rounded text-muted-foreground hover:bg-muted active:cursor-grabbing disabled:cursor-not-allowed disabled:opacity-30 touch-none"
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <input
        value={archetype.id}
        onChange={(e) => onIdChange(e.target.value)}
        className="w-32 rounded border border-border bg-background px-2 py-1 font-mono text-xs"
      />
      <input
        value={archetype.focus}
        onChange={(e) => onFocusChange(e.target.value)}
        className="flex-1 rounded border border-border bg-background px-2 py-1 text-sm"
      />
      <button
        type="button"
        onClick={onRemove}
        className="rounded p-1 text-muted-foreground hover:bg-muted"
        aria-label="Remover"
      >
        <Trash2 className="h-3 w-3" />
      </button>
    </div>
  );
}