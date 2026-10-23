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
npm run build      # Produktions-Build nach dist/
npm run icons      # App-Icons aus public/icon.svg erzeugen
```

Jeder Push auf `main` baut das Spiel automatisch und veröffentlicht es auf GitHub Pages (`.github/workflows/deploy.yml`).

## Aufbau

- `src/core/` – Spiellogik ohne DOM (Formeln, Tick, Prestige, Speichern)
- `src/data/` – Spieldaten (Anlagen, Upgrades, Labor, Planeten, Erfolge …)
- `src/ui/` – Oberfläche, Effekte, Tutorial
- `src/audio/` – Sounds und Musik (WebAudio, keine Dateien)
- `scripts/simulate.ts` – Balancing-Simulation mit derselben Spiellogik
