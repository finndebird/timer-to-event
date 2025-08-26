# Discord Timer Bot (TypeScript)

Ein schlanker Discord-Bot, der **Events per Slash-Command** plant und **in festen Intervallen vorher erinnert** (z. B. 36 h, 24 h, 12 h vor dem Termin).
Zeitparsing ist **deutschland-freundlich** (`dd.MM.yyyy-HH:mm`, Zone **Europe/Berlin**), Timer sind **persistent** (SQLite) und der Scheduler ist **resilient** gegen kurze Ausfälle.

## Features

- `/timer create` — Event anlegen und in regelmäßigem Intervall erinnern
  Beispiele: `12h`, `30m`, `45s`, `12:00:00h`, `01:30:00`
- `/timer remove` — Timer für ein Datum (pro Kanal) löschen
- **Persistenz:** SQLite (WAL)
- **Scheduler:** pollt alle 30 s fällige Erinnerungen; holt nach einem Downtime Catch-up ein
- **Einzigartigkeit:** Pro (Guild, Channel, Eventzeit) nur **ein** Timer
- **Optionale Nachricht** pro Reminder, frei wählbarer Zielkanal

---

## Quickstart

> Voraussetzungen: **Node.js 18+**, Git. (Linux, macOS, Windows)

```bash
git clone <dein-repo>
cd discord-timer-bot
# mit Yarn (empfohlen)
yarn
# oder mit npm
# npm install
```

Erstelle eine `.env` (siehe unten) und starte lokal:

```bash
# Dev
yarn dev
# oder npm run dev
```

---

## Discord-App & Bot einrichten

1. [https://discord.com/developers/applications](https://discord.com/developers/applications) → **New Application**
2. Tab **Bot** → **Add Bot** → Token kopieren
3. **OAuth2 → URL Generator**

   - Scopes: `bot`, `applications.commands`
   - Bot Permissions: mindestens `Send Messages`

4. Bot mit der generierten URL auf deinen Server einladen
5. (Optional) Für schnellere Command-Updates: `GUILD_ID` deiner Dev-Guild notieren

---

## Konfiguration

`.env` anlegen:

```ini
DISCORD_TOKEN=dein_bot_token
APPLICATION_ID=deine_application_id
GUILD_ID=optional_guild_id_fuer_dev_registrierung
TZ=Europe/Berlin
```

---

## Installation & Scripts

```json
{
  "type": "module",
  "scripts": {
    "dev": "ts-node-dev --respawn --transpile-only src/bot.ts",
    "build": "tsc -p .",
    "start": "node dist/bot.js"
  }
}
```

```bash
# Entwicklung
yarn dev
# Produktion
yarn build
yarn start
```

---

## Slash-Commands

### `/timer create`

- `date` (erforderlich): `dd.MM.yyyy-HH:mm` (z. B. `20.09.2025-10:00`)
- `remind` (erforderlich): Intervall – Beispiele:

  - `12h`, `30m`, `45s`
  - `12:00:00h` (Suffix `h` wird toleriert)
  - `01:30:00` (hh\:mm\:ss)

- `channel` (optional): Ziel-Textkanal (Standard: aktueller Kanal)
- `message` (optional): Zusatztext für jede Erinnerung

**Beispiel:**

```
/timer create date:20.09.2025-10:00 remind:12h channel:#ankündigungen message:"Release in Kürze!"
```

> Der Bot plant Erinnerungen **alle X Stunden vor dem Event**: …, 36h, 24h, 12h. Liegt der erste Slot bereits in der Vergangenheit, springt er automatisch zum nächsten zukünftigen Slot.

### `/timer remove`

- `date` (erforderlich): `dd.MM.yyyy-HH:mm`
- `channel` (optional): Standard ist der aktuelle Kanal

**Beispiel:**

```
/timer remove date:20.09.2025-10:00
```

---

## Projektstruktur

```
.
├─ src/
│  └─ bot.ts          # Bot-Logik, Commands, Scheduler
├─ data.sqlite        # SQLite-DB (wird automatisch angelegt)
├─ .env
├─ tsconfig.json
└─ package.json
```

**Wichtige Abhängigkeiten**

- [`discord.js`](https://github.com/discordjs/discord.js) – Bot API
- [`luxon`](https://moment.github.io/luxon/) – Zeit/Zeitzonen
- [`better-sqlite3`](https://github.com/WiseLibs/better-sqlite3) – schnelle, synchrone SQLite-Bindings
- `dotenv`, `zod` (Validierung optional)

---

## Hosting

### Option A: Raspberry Pi / eigener Server

- ✅ Günstig, stromsparend, volle Kontrolle
- ⚠️ Uptime hängt an Netzwerk/Power
- **Empfohlen:** Node 18+, `pm2`, regelmäßige Backups von `data.sqlite`

```bash
# Build einmalig
yarn build

# pm2 installieren und starten
npm i -g pm2
pm2 start dist/bot.js --name timer-bot
pm2 save && pm2 startup
```

### Option B: VPS / Cloud

- ✅ 24/7 stabil, bessere Netzqualität
- ⚠️ Kosten (kleiner VPS reicht)
- Gleiches Setup wie oben; zusätzlich automatische Backups (z. B. tägliches Snapshot/rsync)

> **Nicht geeignet:** klassische „Serverless“-Funktionen (keine dauerhafte WebSocket-Verbindung).

---

## Datenbank & Backups

- Datei: `data.sqlite` (WAL-Modus aktiv)
- Backup (Linux Beispiel):

  ```bash
  sqlite3 data.sqlite ".backup 'backup-$(date +%F_%H%M).sqlite'"
  ```

- Restore: Datei ersetzen und Bot neu starten

---

## Häufige Probleme

- **Slash-Commands erscheinen nicht**

  - Prüfe `APPLICATION_ID`
  - Bei globaler Registrierung kann es bis zu 1 h dauern
  - Für schnelle Iteration `GUILD_ID` setzen

- **Bot darf nicht schreiben**

  - Channel-Permissions prüfen (Rolle des Bots)

- **`better-sqlite3` Build-Fehler**

  - Stelle sicher, dass Node-Version passt.
  - Linux: ggf. Build-Tools installieren (`build-essential`, `python3`, `make`, `g++`)

---

## Roadmap / Ideen

- `/timer list` & `/timer clear`
- 0-Stunden-Reminder direkt zum Event
- Pro-Guild Standard-Kanal speichern
- Postgres/Prisma für horizontale Skalierung
- i18n

---

## Entwicklung

- Code-Style: TypeScript strict, ESM (`"type": "module"`)
- Zeitzone: `Europe/Berlin`
- Intervall-Parsing robust (siehe Beispiele oben)
- Scheduler-Tick: 30 s (konfigurierbar)

---

## Sicherheit

- **Token niemals committen!**
- `.env` in `.gitignore` lassen
- Bot-Rechte minimal halten (i. d. R. reicht `Send Messages`)

---

## Lizenz

MIT – feel free to use & adapt.
