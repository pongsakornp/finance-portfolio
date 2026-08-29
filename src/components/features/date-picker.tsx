"use client"

import * as React from "react"
import { format } from "date-fns"
import { CalendarIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

export function DatePicker({
  name,
  defaultValue = new Date(),
  className,
}: {
  name: string;
  defaultValue?: Date;
  className?: string;
}) {
  const [date, setDate] = React.useState<Date | undefined>(defaultValue);

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            data-empty={!date}
            className={cn(
              "h-9 w-full justify-start rounded-3xl border-transparent bg-input/50 px-3 text-left font-normal text-sm text-foreground data-[empty=true]:text-muted-foreground",
              className
            )}
          />
        }
      >
        <CalendarIcon />
        {date ? format(date, "PPP") : <span>Pick a date</span>}
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0">
        <Calendar
          mode="single"
          selected={date}
          onSelect={setDate}
          defaultMonth={date ?? new Date()}
        />
      </PopoverContent>
      <input
        type="hidden"
        name={name}
        value={date ? `${format(date, "yyyy-MM-dd")}T12:00:00.000Z` : ""}
      />
    </Popover>
  );
}
