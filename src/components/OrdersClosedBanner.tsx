import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Clock } from "lucide-react";

export function OrdersClosedBanner() {
  const { data: settings = {} } = useQuery<Record<string, string>>({
    queryKey: ["settings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("settings").select("*");
      if (error) return {};
      const map: Record<string, string> = {};
      (data || []).forEach((s) => {
        map[s.key] = s.value;
      });
      return map;
    },
    staleTime: 300_000,
  });

  if (settings.orders_open === "false") {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-red-200 bg-gradient-to-r from-red-50 to-red-100 px-4 py-3 shadow-sm sm:px-5 sm:py-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-100 sm:h-10 sm:w-10">
          <Clock className="h-4 w-4 text-red-600 sm:h-5 sm:w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-red-700 sm:text-base">Orders Currently Closed</p>
          <p className="text-xs text-red-500 sm:text-sm">
            We're not accepting orders right now. Please check back later.
          </p>
        </div>
      </div>
    );
  }

  return null;
}
