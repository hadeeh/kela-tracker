"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { useState, useMemo } from "react";

type Member = { id: string; name: string };

type Props = {
  open: boolean;
  members: Member[];
  onSelect: (member: Member) => void;
  onClose: () => void;
};

export function QuickAccusePicker({ open, members, onSelect, onClose }: Props) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!search.trim()) return members;
    const q = search.toLowerCase();
    return members.filter((m) => m.name.toLowerCase().includes(q));
  }, [members, search]);

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { onClose(); setSearch(""); } }}>
      <DialogContent className="sm:max-w-sm max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="p-4 pb-2 flex-shrink-0 border-b">
          <DialogTitle className="flex items-center gap-2 text-base">🍌 Quick Accuse</DialogTitle>
          <DialogDescription className="text-xs">Select who ate kela</DialogDescription>
        </DialogHeader>

        {/* Search bar (only show if > 5 members) */}
        {members.length > 5 && (
          <div className="px-4 pt-2 pb-2 flex-shrink-0 border-b">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search members..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-8 pl-7 text-xs"
              />
            </div>
          </div>
        )}

        {/* Scrollable member list */}
        <div className="flex-1 overflow-y-auto p-2 min-h-0">
          {filtered.length === 0 ? (
            <div className="text-center py-8 text-sm text-muted-foreground">
              {members.length === 0
                ? "No friends to accuse yet! Invite someone first."
                : "No members found."}
            </div>
          ) : (
            <div className="space-y-1">
              {filtered.map((m) => (
                <button
                  key={m.id}
                  onClick={() => { onSelect(m); setSearch(""); }}
                  className="w-full flex items-center gap-2.5 rounded-lg border p-2 hover:bg-yellow-50 hover:border-yellow-300 transition text-left"
                >
                  <Avatar className="h-8 w-8 bg-yellow-200 text-yellow-900 flex-shrink-0">
                    <AvatarFallback className="text-[10px]">{m.name.slice(0, 2).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <span className="font-semibold text-xs sm:text-sm truncate flex-1 min-w-0">{m.name}</span>
                  <span className="text-base flex-shrink-0">🍌</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer with count */}
        {members.length > 0 && (
          <div className="p-2 border-t text-center text-[10px] text-muted-foreground flex-shrink-0">
            {filtered.length} of {members.length} members
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
