# 🚀 Cosmo Tycoon

Ein Weltraum-Idle-Tycoon für das iPhone (als Web-App/PWA): Vom Weltraumschrott-Sammler im Erdorbit bis zum Schwarzes-Loch-Reaktor im Galaxiekern.

## Features

- **10 Anlagen** mit Meilensteinen (Tempo ×2) und Imperium-Meilensteinen (alle Anlagen → Ertrag ×2)
- **Manager** automatisieren die Produktion – auch offline
- **132 Upgrades** in 12 Technologie-Stufen
- **Supernova (Rebirth):** Sternenstaub ✨ gibt dauerhaft +2 % Einkommen pro Stück
- **Sternen-Labor:** 16 dauerhafte Forschungen (Einkommen, Startkapital, Automatik, Offline …)
- **10 Planeten** von Erdorbit bis Galaxiekern, jeder ×1,5 Einkommen
- **Galaxie-Sprung:** zweite Prestige-Ebene mit Quantenkernen ⚛️ und Quanten-Perks
- **Goldene Kometen** ☄️, **Kristall-Shop** 💎, **86 Erfolge**, **Missionen**, **tägliche Belohnung**
- Offline-Einnahmen, Tutorial, Synth-Sounds und Musik, Haptik, Export/Import des Spielstands
- Läuft offline als Home-Bildschirm-App (Service Worker)

### Neu in Version 2.0

- **Offline-Automatik:** Auto-Käufer und Auto-Upgrader kaufen auch weiter, während die App zu ist
- **Raumflotte 🚀:** 10 Expeditionsziele (15 min bis 48 h, laufen in Echtzeit), Schiffsmodule Antrieb/Laderaum/Schilde, Exotische Materie ⚗️
- **24 Artefakte 🏺** in 4 Seltenheiten, Stufen 1–10 über doppelte Funde, 3–8 Ausrüstungs-Plätze, Artefakt-Kisten
- **8 Prüfungen 🏅** mit je 5 Stufen: Sonderläufe mit Einschränkung und dauerhafter Belohnung
- **Planeten-Boni:** jeder Planet stärkt eine eigene Anlage (oder Offline/Kometen/Expeditionen)
- **Kommandanten-Rang ⭐** bis Level 100 (+1 % Einkommen pro Level, schaltet Hangar- und Artefakt-Plätze frei)
- **Größere Galaxien:** nach jedem Galaxie-Sprung brauchen die Planeten mehr Sternenstaub
- Alte Spielstände werden automatisch migriert; eine unveränderte Kopie liegt unter `cosmo-tycoon:backup-v1`

### Neu in Version 2.1

- **Schlauer Auto-Käufer** (`src/core/autobuy.ts`): kauft nach Amortisationszeit (Kosten ÷ Einkommens-Zuwachs, plus Wartezeit), achtet auf Meilensteine (Tempo ×2), Imperium-Meilensteine und Upgrades, spart gezielt für starke Ziele und kauft tausende Stufen auf einmal
- **Offline wie online:** Auto-Käufer, Auto-Upgrader, Prüfungen und Auto-Supernova laufen in der Offline-Simulation mit (mitwachsende Zeitschritte) – jeweils nur, wenn im Labor bzw. als Quanten-Perk freigeschaltet und eingeschaltet
- **Auto-Supernova** löst auch aus, wenn ein Lauf seit 5 Minuten kaum noch wächst (mindestens +20 % Sternenstaub)
- **Faire Preise:** alle Anlagen werden pro Stufe 9 % teurer, eine bessere Anlage ist auf jeder Stufe teurer als eine schwächere
- Fortschrittsbalken der Prüfungen linear, Missionen lassen sich ohne Neu-Öffnen abholen
- **Zahlen-Schutz (2.1.1, `src/core/safe.ts`):** JavaScript rechnet nur bis ~1,8e308. Geld, Einkommen, Sternenstaub und Quantenkerne werden deshalb bei 1e300 gedeckelt; beim Speichern werden „unendlich“/NaN repariert, statt als `null` im Spielstand zu landen (das würde beim Laden zur 0). Härtetest: `tests/safe.test.ts`

### Neu in Version 3.0 „Imperium“

- **Neue Navigation:** 6 Tabs mit wischbaren Unterbereichen (🏭 Imperium = Anlagen | Manager | Upgrades), neue Bereiche werden mit einer kurzen Tour erklärt
- **👤 Kommando** (`src/core/commander.ts`, `src/data/talents.ts`): 1 Talentpunkt pro Kommandanten-Level (rückwirkend), 4 Zweige à 8 Reihen mit Entweder-oder-Reihen, Umskillen gegen 💎; 6 aktive Fähigkeiten mit Abklingzeit in einer Leiste in der Kopfzeile
- **📡 Funksprüche & Fraktionen** (`src/core/events.ts`): ~40 Ereignisse mit 2–3 Entscheidungen, Risiko-Würfen und Ketten; 4 Fraktionen mit je 5 Ruf-Stufen, dauerhaften Vorteilen und einem Wochen-Shop
- **🪐 Kolonien** (`src/core/colonies.ts`): jeder erreichte Planet wird eine Kolonie mit Spezialität; 8 Gebäude bis Stufe 25, Energie je Kolonie, Veredelung zu Legierung und Quantenchips, gemeinsames Lager; Produktion nach Wanduhr (auch offline); Wohlstand +0,5 % Einkommen je Ausbau-Stufe; Funksprüche und Expeditionen bringen Rohstoffe passend zur Produktion
- **🏗️ 7 Megaprojekte** in je 5 Stufen: Dyson-Schwarm (Einkommen bis ×32), Sternentor, Quantenrechner (Auto-Labor), Chronosphäre, Archiv der Architekten, Terraformer, Galaktische Börse
- **🗓️ Wochen-Ereignis** (`src/core/weekly.ts`): jede Kalenderwoche eine andere Galaxie-Bedingung und ein Sonderauftrag – ohne Server, über die Kalenderwoche als Zufallswert
- Spielstände werden auf Version 3 migriert; eine unveränderte Kopie liegt unter `cosmo-tycoon:backup-v2` (Wiederherstellen unter Mehr → ⚙️)

### Neu in Version 3.1

- **🤖 Kristall-Sammler:** holt fertige Missionen automatisch ab (einmalig 20.000 💎 im Kristall-Shop, sichtbar ab dem ersten Galaxie-Sprung, abschaltbar)
- **💎 Kristall-Kometen (3.1.1):** 15 % statt 10 % aller Kometen, 12–24 💎 plus 1 je 3 Kommandanten-Level (vor dem Kristall-Bonus) statt 2–5; im Kometensturm nur ein Viertel

## Auf dem iPhone installieren

1. Link in **Safari** öffnen
2. Unten auf **Teilen** (□↑) tippen
3. **„Zum Home-Bildschirm“** wählen

## Entwicklung

```bash
npm install
npm run dev        # Entwicklungsserver (mit ?debug=1 gibt es Test-Werkzeuge)
npm test           # Unit-Tests der Spiellogik
npm run sim -- 48  # Balancing-Bot: spielt 48 Stunden und zeigt die Zeitachse
                   # (OFFLINE=1: mit 8-h-Nächten offline, CHAL=0.35: Prüfungs-Häufigkeit,
                   #  STYLE=nutzer: schneller Spieler mit vielen kleinen Supernovas)
npm run build      # Produktions-Build nach dist/
npm run icons      # App-Icons aus public/icon.svg erzeugen
```

Jeder Push auf `main` baut das Spiel automatisch und veröffentlicht es auf GitHub Pages (`.github/workflows/deploy.yml`).

## Aufbau

- `src/core/` – Spiellogik ohne DOM (Formeln, Tick, Prestige, Speichern, Migration, Offline-Simulation, Flotte, Prüfungen, Rang, Kommando, Funksprüche, Kolonien, Wochen-Ereignis)
- `src/data/` – Spieldaten (Anlagen, Upgrades, Labor, Planeten, Erfolge, Artefakte, Expeditionen, Prüfungen, Talente, Funksprüche, Fraktionen, Kolonie-Gebäude, Megaprojekte …)
- `tests/` – Unit-Tests, inkl. Migrationstests mit einem echten v1-Spielstand (`tests/fixtures/save-v1.json`), einem späten v2-Stand (`save-late.json`) und einem Stand wie dem eines schnellen Spielers (`save-user-like.json`)
- `src/ui/` – Oberfläche, Effekte, Tutorial
- `src/audio/` – Sounds und Musik (WebAudio, keine Dateien)
- `scripts/simulate.ts` – Balancing-Simulation mit derselben Spiellogik (`scripts/bot-v3.ts`: Strategien für die Systeme von Version 3)
