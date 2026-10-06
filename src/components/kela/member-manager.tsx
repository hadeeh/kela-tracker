"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Crown, Save, X } from "lucide-react";
import { toast } from "sonner";

type Member = {
  id: string;
  name: string;
  email: string;
  ratePerKela: number;
  role: string | null;
  status: string;
  joinedAt: string;
};

type Props = {
  roomCode: string;
  memberId: string;
  members: Member[];
  onRateChanged: () => void;
};

export function MemberManager({ roomCode, memberId, members, onRateChanged }: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("50");
  const [saving, setSaving] = useState(false);

  function startEdit(m: Member) {
    setEditingId(m.id);
    setEditValue(String(m.ratePerKela));
  }

  async function saveRate(targetId: string, name: string) {
    const r = Number(editValue);
    if (Number.isNaN(r) || r < 0) {
      toast.error("Enter a valid rate.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/rooms/${roomCode}/rate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId, targetMemberId: targetId, ratePerKela: r }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.error || "Failed to save.");
      } else {
        toast.success(`Rate updated for ${name}: PKR ${r}/kela`);
        setEditingId(null);
        onRateChanged();
      }
    } catch {
      toast.error("Failed to save.");
    } finally {
      setSaving(false);
    }
  }

  const approvedMembers = members.filter((m) => m.status === "approved");

  return (
    <Card className="border-yellow-200">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          👥 Member Management
          <Badge variant="secondary" className="text-xs">{approvedMembers.length} members</Badge>
        </CardTitle>
        <CardDescription className="text-xs">
          View and edit each member's fine per kela. Click the rate to change it.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {approvedMembers.map((m) => (
          <div
            key={m.id}
            className={`flex items-center gap-3 rounded-lg border p-3 ${
              m.id === memberId ? "bg-yellow-50 border-yellow-300" : "bg-card"
            }`}
          >
            <Avatar className="h-8 w-8 bg-yellow-200 text-yellow-900 flex-shrink-0">
              <AvatarFallback className="text-xs">{m.name.slice(0, 2).toUpperCase()}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-sm truncate">{m.name}</span>
                {m.role === "minister" && <Crown className="h-3.5 w-3.5 text-yellow-600 flex-shrink-0" />}
                {m.id === memberId && <span className="text-[10px] text-yellow-700 font-normal">(you)</span>}
              </div>
              <div className="text-[11px] text-muted-foreground truncate">{m.email}</div>
            </div>
            {editingId === m.id ? (
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <div className="flex items-center gap-1">
                  <span className="text-xs text-muted-foreground">PKR</span>
                  <Input
                    type="number"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    className="w-16 h-8 text-sm text-center"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter") saveRate(m.id, m.name);
                      if (e.key === "Escape") setEditingId(null);
                    }}
                  />
                </div>
                <Button size="sm" className="h-7 w-7 p-0" onClick={() => saveRate(m.id, m.name)} disabled={saving}>
                  <Save className="h-3.5 w-3.5" />
                </Button>
                <Button size="sm" variant="outline" className="h-7 w-7 p-0" onClick={() => setEditingId(null)}>
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            ) : (
              <button
                onClick={() => startEdit(m)}
                className="flex items-center gap-1 rounded-lg bg-muted hover:bg-yellow-100 px-2.5 py-1.5 transition flex-shrink-0"
                title="Click to edit rate"
              >
                <span className="text-xs text-muted-foreground">PKR</span>
                <span className="text-sm font-bold">{m.ratePerKela}</span>
                <span className="text-[10px] text-muted-foreground">/kela</span>
              </button>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
