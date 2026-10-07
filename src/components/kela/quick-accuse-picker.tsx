"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

type Member = { id: string; name: string };

type Props = {
  open: boolean;
  members: Member[];
  onSelect: (member: Member) => void;
  onClose: () => void;
};

export function QuickAccusePicker({ open, members, onSelect, onClose }: Props) {
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">🍌 Quick Accuse</DialogTitle>
          <DialogDescription>Select who ate kela</DialogDescription>
        </DialogHeader>
        <div className="space-y-2 max-h-80 overflow-y-auto">
          {members.length === 0 ? (
            <div className="text-center py-4 text-sm text-muted-foreground">
              No friends to accuse yet! Invite someone first.
            </div>
          ) : (
            members.map((m) => (
              <button
                key={m.id}
                onClick={() => onSelect(m)}
                className="w-full flex items-center gap-3 rounded-lg border p-3 hover:bg-yellow-50 hover:border-yellow-300 transition text-left"
              >
                <Avatar className="h-9 w-9 bg-yellow-200 text-yellow-900 flex-shrink-0">
                  <AvatarFallback className="text-xs">{m.name.slice(0, 2).toUpperCase()}</AvatarFallback>
                </Avatar>
                <span className="font-semibold text-sm">{m.name}</span>
                <span className="ml-auto text-lg">🍌</span>
              </button>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
