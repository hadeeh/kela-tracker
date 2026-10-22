#!/usr/bin/env python3
"""
Wipe test data from the Kela Tracker Neon DB.

Connects to the production Neon PostgreSQL database and:
  1. Shows current row counts in each table (before)
  2. Runs DELETE queries to clear test data
  3. Shows new row counts (after)

KEEP:
  - Room (so the room link still works)
  - RoomMember (so the minister + any approved members can still log in)
  - AssetVersion (sound/sticker upload history — so minister can still revert)

CLEAR:
  - Vote (test votes)
  - KelaIncident (test kela accusations + verdicts + fines)
  - Mugshot (test funny photos)
  - CustomSound (test custom sounds — minister can re-upload or revert from history)
  - AchievementReward (test sticker/sound rewards — minister can re-upload or revert from history)
"""

import psycopg2
import sys

# Connection string (redact in logs)
CONN_STRING = "postgresql://neondb_owner:npg_02HWnTfbrRMC@ep-restless-grass-b3trlxm7-pooler.c-4.ap-southeast-1.aws.neon.tech/neondb?sslmode=require"

# Tables in dependency order (parents first, children last for DELETE)
TABLES = [
    "Room",
    "RoomMember",
    "Vote",
    "KelaIncident",
    "Mugshot",
    "CustomSound",
    "AchievementReward",
    "AssetVersion",
]

# Tables we KEEP (won't delete from)
KEEP_TABLES = {"Room", "RoomMember", "AssetVersion"}

def show_counts(cur, label):
    print(f"\n========== {label} ==========")
    for table in TABLES:
        try:
            cur.execute(f'SELECT COUNT(*) FROM "{table}"')
            count = cur.fetchone()[0]
            kept = " (KEPT)" if table in KEEP_TABLES else ""
            print(f"  {table:25s} {count:6d} rows{kept}")
        except Exception as e:
            print(f"  {table:25s} ERROR: {e}")

def run_wipe(cur):
    print("\n========== RUNNING WIPE ==========")
    # Delete in dependency order (children first, then parents)
    # Vote depends on KelaIncident, so delete Vote first (though cascade would handle it)
    deletes = [
        ("Vote",                'DELETE FROM "Vote"'),
        ("KelaIncident",        'DELETE FROM "KelaIncident"'),
        ("Mugshot",             'DELETE FROM "Mugshot"'),
        ("CustomSound",         'DELETE FROM "CustomSound"'),
        ("AchievementReward",   'DELETE FROM "AchievementReward"'),
        # AssetVersion is KEPT — minister can still revert to old sounds
        # Room and RoomMember are KEPT
    ]
    for name, sql in deletes:
        cur.execute(sql)
        print(f"  ✕ Deleted {cur.rowcount:6d} rows from {name}")

def main():
    print("Connecting to Neon...")
    try:
        conn = psycopg2.connect(CONN_STRING)
        conn.autocommit = False
    except Exception as e:
        print(f"❌ Connection failed: {e}")
        sys.exit(1)

    cur = conn.cursor()
    try:
        show_counts(cur, "BEFORE WIPE")
        run_wipe(cur)
        conn.commit()
        show_counts(cur, "AFTER WIPE")
        print("\n✅ Wipe committed successfully.")
        print("\nWhat was KEPT:")
        print("  - Room (room link still works)")
        print("  - RoomMember (you + any approved members can still log in)")
        print("  - AssetVersion (sound/sticker upload history — use the 📜 History tab to revert to old sounds)")
        print("\nWhat was CLEARED:")
        print("  - All kela incidents (accusations, verdicts, fines)")
        print("  - All votes")
        print("  - All mugshots (test funny photos)")
        print("  - All custom sounds (test uploads — re-upload or revert from History tab)")
        print("  - All achievement rewards (test sticker/sound uploads — re-upload or revert)")
    except Exception as e:
        conn.rollback()
        print(f"\n❌ Error during wipe, rolled back: {e}")
        sys.exit(1)
    finally:
        cur.close()
        conn.close()

if __name__ == "__main__":
    main()
