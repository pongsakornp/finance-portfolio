"use client";

import * as React from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
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
import { GripVerticalIcon, MoveDownIcon, MoveUpIcon } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

import { reorderPortfoliosAction } from "@/actions/portfolio.actions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Portfolio = { id: string; name: string };

function SortablePortfolio({
  portfolio,
  index,
  total,
  onMove,
  disabled,
}: {
  portfolio: Portfolio;
  index: number;
  total: number;
  onMove: (from: number, to: number) => void;
  disabled: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: portfolio.id });

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "flex items-center gap-2 rounded-md border bg-card p-2",
        isDragging && "opacity-50 shadow-sm"
      )}
    >
      <Button
        ref={setActivatorNodeRef}
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label={`Drag ${portfolio.name} to reorder`}
        disabled={disabled}
        {...attributes}
        {...listeners}
      >
        <GripVerticalIcon aria-hidden="true" />
      </Button>
      <span className="min-w-0 flex-1 truncate text-sm font-medium">{portfolio.name}</span>
      <span className="text-xs text-muted-foreground">{index === 0 ? "Default" : index + 1}</span>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label={`Move ${portfolio.name} up`}
        disabled={disabled || index === 0}
        onClick={() => onMove(index, index - 1)}
      >
        <MoveUpIcon aria-hidden="true" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label={`Move ${portfolio.name} down`}
        disabled={disabled || index === total - 1}
        onClick={() => onMove(index, index + 1)}
      >
        <MoveDownIcon aria-hidden="true" />
      </Button>
    </li>
  );
}

export function PortfolioOrderManager({ portfolios }: { portfolios: Portfolio[] }) {
  const router = useRouter();
  const [items, setItems] = React.useState(portfolios);
  const [pending, startTransition] = React.useTransition();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  function persist(next: Portfolio[]) {
    const previous = items;
    setItems(next);
    startTransition(async () => {
      const result = await reorderPortfoliosAction(next.map((portfolio) => portfolio.id));
      if (result.error) {
        setItems(previous);
        toast.error(result.error);
        return;
      }
      toast.success("Portfolio order updated");
      router.refresh();
    });
  }

  function move(from: number, to: number) {
    if (pending || to < 0 || to >= items.length || from === to) return;
    persist(arrayMove(items, from, to));
  }

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (pending || !over || active.id === over.id) return;
    const from = items.findIndex((portfolio) => portfolio.id === active.id);
    const to = items.findIndex((portfolio) => portfolio.id === over.id);
    if (from >= 0 && to >= 0) move(from, to);
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={onDragEnd}
      accessibility={{
        screenReaderInstructions: {
          draggable: "To pick up a portfolio, press Space or Enter. Use the arrow keys to move it, then press Space or Enter to drop it.",
        },
      }}
    >
      <SortableContext items={items.map((portfolio) => portfolio.id)} strategy={verticalListSortingStrategy}>
        <ol className="flex flex-col gap-2" aria-label="Portfolio order">
          {items.map((portfolio, index) => (
            <SortablePortfolio
              key={portfolio.id}
              portfolio={portfolio}
              index={index}
              total={items.length}
              onMove={move}
              disabled={pending}
            />
          ))}
        </ol>
      </SortableContext>
    </DndContext>
  );
}
