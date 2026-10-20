# Grafikformate – Lernmaterial

Material zum Thema Grafikformate (Raster- und Vektorgrafik) für die gymnasiale Stufe, in drei Stufen:

| Stufe | Inhalt | Stand |
|---|---|---|
| 1 – Unplugged | Dossier ohne Computer | geplant |
| 2 – Am Computer erleben | interaktive Werkzeuge | **Pixel-Labor** fertig, weitere geplant |
| 3 – Verständnis prüfen | Online-Checks | geplant |

Alles ist reines HTML/CSS/JavaScript ohne Build-Schritt und ohne externe Abhängigkeiten. Es läuft auf GitHub Pages, aber auch offline (Ordner herunterladen, `index.html` öffnen).

## Pixel-Labor (`pixel/`)

Ein Editor für Rastergrafiken im Stil des Pixelation-Widgets von code.org. Das Dateiformat:

```
Breite (1 Byte) | Höhe (1 Byte) | Farbtiefe (1 Byte) | Breite × Höhe × Farbtiefe Bits Pixeldaten
```

Funktionen:

- **Header** einstellen (Breite, Höhe, Farbtiefe 1–24 Bit), jeweils mit Binärdarstellung des Bytes. Standardmässig steht der Header als erste 3 Bytes im Bitstrom (wie in den späteren code.org-Levels); das lässt sich abschalten.
- **Bits binär oder hexadezimal** eingeben. Leerzeichen und Zeilenumbrüche werden ignoriert, ungültige Zeichen gemeldet. Fehlende Bits werden als schraffierte Pixel gezeigt, überzählige Bits markiert.
- **Farbmodelle:** Graustufen, RGB (Bits werden auf R, G, B verteilt, der Rest geht an Grün, dann an Rot), Farbpalette (indiziert wie bei GIF, bis 8 Bit). «Automatisch» bedeutet 1–2 Bit Graustufen, ab 3 Bit RGB. Bei 1 Bit gilt 0 = schwarz, 1 = weiss (wie in den Folien).
- **Untersuchen:** Beim Überfahren eines Pixels erscheinen die Bit-Position, die Kanalwerte und der Farbcode. Die **Zuordnung** zeigt für jedes Pixel seine Bits und seine Farbe.
- **Zeichnen:** Pixel einfärben, die Bits ändern sich mit. Die gewählte Farbe wird auf die Farbtiefe gerundet.
- **Speicherbedarf:** unkomprimiert, mit Farbtabelle (GIF-Idee) und mit gleichfarbigen Blöcken (Lauflängen) im Vergleich.
- **Text → Bits:** ASCII/UTF-8-Codes eines Textes als Bitfolge übernehmen (Aufgabe 4 des Arbeitsblatts).
- **PNG speichern**, **Link teilen**, Rätsel-Modus (Bild zuerst verdeckt).

### Beispiele und Aufgaben

Im Menü «Beispiel oder Aufgabe laden» gibt es die Beispiele aus den Folien (6 × 6 / 4 × 3 mit derselben Bitfolge, Haus 11 × 11 usw.) und die Aufgaben des Arbeitsblatts «Rastergrafik manuell», an das Tool angepasst:

- **A1** Dieselben Bits, verschiedene Bilder (1, 3, 9 und 18 Bit)
- **A2** Hexadezimale Farbcodierung (Biene, 12 → 24 Bit)
- **A3** Ein Bild selbst codieren – mit Zielbild und automatischer Prüfung (24 Bit Hex und «so wenig Bits wie möglich»)
- **A4** Buchstaben als Farben (ASCII)
- **A5** Bitfolge mit Header entschlüsseln (Rätsel, Bild verdeckt)
- **A6** Farbtabelle wie beim GIF (weiterführend)
- **A7** Rätsel für den Nebensitzer (weiterführend)

Die Beispiele und Aufgaben stehen in `pixel/presets.js` und lassen sich dort einfach ergänzen.

### Eigene Aufgaben per Link erstellen

**Link teilen → «Als Aufgabe einrichten»**: Titel und Aufgabentext eingeben, optional das aktuelle Bild als **Zielbild** verwenden (die Lösung wird dann automatisch geprüft), ohne Pixeldaten starten und einzelne Funktionen sperren (z.B. Zeichnen, damit das Zielbild nicht einfach nachgemalt wird). Der entstehende Link enthält alles und kann z.B. im LMS oder per QR-Code verteilt werden.

Beim Vergleich mit dem Zielbild gilt eine Farbe als richtig, wenn jeder Kanal höchstens 48 vom Ziel abweicht. So werden auch Lösungen mit kleinerer Farbtiefe akzeptiert (z.B. Dunkelgrün `#008000` mit 6 Bit als `00 10 00`).

Link-Parameter (im Teil nach `#`):

| Parameter | Bedeutung |
|---|---|
| `w`, `h`, `b` | Breite, Höhe, Farbtiefe |
| `m` | Farbmodell: `gray`, `rgb`, `palette` (sonst automatisch) |
| `hdr=0` | Header nicht in den Bitstrom schreiben (Standard: Header steht im Bitstrom) |
| `v=hex` | Hex-Ansicht |
| `lbl=1` | Bits im Pixel anzeigen |
| `n`, `d` | Anzahl Bits und Pixeldaten (Base64url) |
| `pal` | Farbtabelle als aneinandergehängte 6-stellige Hex-Codes |
| `r=1` | Rätsel: Bild zuerst verdeckt |
| `t`, `x` | Titel und Text der Aufgabe (`**fett**` möglich) |
| `tw`, `th`, `tc`, `tol` | Zielbild: Breite, Höhe, Farben (Hex), Toleranz |
| `lock` | gesperrte Funktionen, kommagetrennt: `size`, `bpp`, `model`, `header`, `view`, `draw`, `map`, `analysis` |

## Auf GitHub Pages veröffentlichen

1. Auf GitHub ein neues Repository anlegen, z.B. `grafikformate`.
2. Den Inhalt dieses Ordners hochladen (oder `git push`).
3. Im Repository unter **Settings → Pages** bei «Build and deployment» die Quelle **Deploy from a branch**, Branch `main`, Ordner `/ (root)` wählen.
4. Nach ca. einer Minute ist die Seite unter `https://<benutzername>.github.io/grafikformate/` erreichbar, das Pixel-Labor unter `…/grafikformate/pixel/`.
