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
                   # (OFFLINE=1: mit 8-h-Nächten offline, CHAL=0.35: Prüfungs-Häufigkeit)
npm run build      # Produktions-Build nach dist/
npm run icons      # App-Icons aus public/icon.svg erzeugen
```

Jeder Push auf `main` baut das Spiel automatisch und veröffentlicht es auf GitHub Pages (`.github/workflows/deploy.yml`).

## Aufbau

- `src/core/` – Spiellogik ohne DOM (Formeln, Tick, Prestige, Speichern, Migration, Offline-Simulation, Flotte, Prüfungen, Rang)
- `src/data/` – Spieldaten (Anlagen, Upgrades, Labor, Planeten, Erfolge, Artefakte, Expeditionen, Prüfungen …)
- `tests/` – Unit-Tests, inkl. Migrationstest mit einem echten v1-Spielstand (`tests/fixtures/save-v1.json`)
- `src/ui/` – Oberfläche, Effekte, Tutorial
- `src/audio/` – Sounds und Musik (WebAudio, keine Dateien)
- `scripts/simulate.ts` – Balancing-Simulation mit derselben Spiellogik
