## timer-to-event — Discord-Bot (TypeScript)

Ein kompakter Discord-Bot, der Events per Slash-Command plant und in festen Intervallen vor dem Termin erinnert. Datumsformat und Zeitzone sind auf Deutschland ausgelegt: `dd.MM.yyyy-HH:mm` in Zone `Europe/Berlin`.

### Highlights

- **Slash-Commands**: `/timer create`, `/timer remove`, `/timer list`
- **Persistenz**: SQLite-Datei `data.sqlite`
- **Scheduler**: prüft alle 30 s und holt verpasste Erinnerungen nach
- **Einzigartigkeit**: pro (Guild, Kanal, Eventzeit) nur ein Timer
- **Datenbank-Treiber**: bevorzugt `better-sqlite3`, Fallback auf `sql.js` (WASM)

---

## Quickstart

Voraussetzungen: Node.js 18+, Git

```bash
git clone https://github.com/finndebird/timer-to-event.git
cd timer-to-event
yarn # oder npm install
```

`.env` erstellen (siehe Konfiguration) und starten:

```bash
# Entwicklung (hot reload per nodemon)
yarn dev

# Produktion
yarn build
yarn start
```

---

## Discord-App einrichten

1. `https://discord.com/developers/applications` → New Application
2. Tab Bot → Add Bot → Token kopieren
3. OAuth2 → URL Generator
   - Scopes: `bot`, `applications.commands`
   - Permissions: mindestens `Send Messages`
4. Bot mit der URL auf deinem Server hinzufügen
5. Optional: `GUILD_ID` deiner Dev-Guild notieren (schnellere Command-Updates)

Hinweis: Die Slash-Commands werden beim Start automatisch registriert (Guild, wenn `GUILD_ID` gesetzt; sonst global – kann bis zu 1 Stunde dauern).

---

## Konfiguration

`.env` im Projektverzeichnis anlegen:

```ini
DISCORD_TOKEN=dein_bot_token
APPLICATION_ID=deine_application_id
GUILD_ID=optional_guild_id_fuer_dev_registrierung
```

Zeitzone wird im Code explizit auf `Europe/Berlin` gesetzt. Du musst keine `TZ`-Variable setzen.

---

## Befehle

### `/timer create`

- **date** (erforderlich): `dd.MM.yyyy-HH:mm` — z. B. `20.09.2025-10:00`
- **remind** (erforderlich): Intervall, z. B. `12h`, `30m`, `45s`, `12:00:00h`, `01:30:00`
- **channel** (optional): Ziel-Textkanal (Standard: aktueller Kanal)
- **message** (optional): Zusatztext je Erinnerung

Beispiel:

```text
/timer create date:20.09.2025-10:00 remind:12h channel:#ankündigungen message:"Release in Kürze!"
```

Der Bot plant Erinnerungen in festen Abständen vor dem Event (…, 36h, 24h, 12h …). Wenn der erste Slot bereits in der Vergangenheit liegt, springt er automatisch zum nächsten zukünftigen Slot.

### `/timer remove`

- **date** (erforderlich): `dd.MM.yyyy-HH:mm`
- **channel** (optional): Standard ist der aktuelle Kanal

### `/timer list`

- **channel** (optional): Standard ist der aktuelle Kanal

---

## Projektstruktur

```text
.
├─ src/
│  ├─ bot.ts           # Bot-Start, Registrierung, Scheduler-Start
│  ├─ commands/
│  │  ├─ index.ts      # Slash-Command-Registrierung
│  │  └─ timer.ts      # create/remove/list Implementierungen
│  ├─ scheduler.ts     # periodisches Senden und Nachplanen
│  ├─ time.ts          # Parsing/Planungs-Utilities (Luxon)
│  ├─ db.ts            # DB-Bootstrap (better-sqlite3 → sql.js Fallback)
│  └─ config.ts        # ENV-Variablen
├─ data.sqlite         # wird automatisch erzeugt
├─ nodemon.json        # Dev-Runner (ts-node/esm)
├─ tsconfig.json
└─ package.json
```

Wichtige Abhängigkeiten: `discord.js` (v14), `luxon`, `dotenv`, optional `better-sqlite3` (nativ, schnell) mit Fallback `sql.js` (WASM).

---

## Betrieb & Datenbank

- Datei: `data.sqlite` im Projektverzeichnis
- Bei nativem Treiber wird WAL aktiviert (bessere Robustheit). Beim WASM-Fallback wird die Datei nach Mutationen persistiert.
- Backups: Datei regelmäßig sichern (z. B. `cp data.sqlite backup-YYYYMMDD.sqlite`).

Beispiel PM2 (Serverbetrieb):

```bash
yarn build
npm i -g pm2
pm2 start dist/bot.js --name timer-bot
pm2 save && pm2 startup
```

---

## Troubleshooting

- Slash-Commands erscheinen nicht? `APPLICATION_ID` prüfen; global kann bis zu 1 h dauern; für schnelle Iteration `GUILD_ID` setzen.
- Bot kann nicht schreiben? Channel-Permissions der Bot-Rolle prüfen.
- `better-sqlite3` Build-Probleme? Node-Version prüfen; auf Linux ggf. Build-Tools installieren (`build-essential`, `python3`, `make`, `g++`).

---

## Entwicklung

- TypeScript strict, ESM (`"type": "module"`), `module` = `NodeNext`
- Scheduler-Tick: 30 s (Konstante in `startScheduler`)
- Zeiten werden intern in UTC gespeichert, Anzeige/Parsing in `Europe/Berlin`.

---

## Lizenz

MIT
