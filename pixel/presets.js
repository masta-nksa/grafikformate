// Beispiele und Aufgaben für das Pixel-Labor.
// Jeder Eintrag hat dasselbe Format wie ein geteilter Link (siehe README.md).
'use strict';
(() => {
  const hexToBits = (hex) => hex.replace(/\s+/g, '').split('')
    .map((c) => parseInt(c, 16).toString(2).padStart(4, '0')).join('');

  // Pixel-Art: jedes Zeichen steht für eine Farbe; die Legende gibt die Hex-Ziffern an.
  const hexArt = (rows, legend) => hexToBits(rows.join('').split('').map((c) => legend[c]).join(''));

  const FOLIE_BITS = '001100001100111111111111001100001100';

  const HAUS = [
    '11111111111',
    '11111011111',
    '11110001111',
    '11100000111',
    '11000000011',
    '10000000001',
    '11000000011',
    '11011011011',
    '11011011011',
    '11000011011',
    '11000011011',
  ];

  const BIENE = [
    '................',
    '......WWW.WWW...',
    '.....WWWWWWWWW..',
    '......WWWWWWW...',
    '.....KYYKYYKKK..',
    '...KYYKYYKYKKKK.',
    '..KYYYKYYKYKKEKK',
    '.SKYYYKYYKYKKKKK',
    '..KYYYKYYKYKKKK.',
    '...KYYKYYKYKKK..',
    '....KKKKKKKK....',
    '................',
  ];
  const BIENE_FARBEN = { '.': '9CE', W: 'EEF', K: '000', Y: 'FC0', E: 'FFF', S: '421' };

  const verlauf = [];
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      verlauf.push([x * 17, y * 17, 0x99].map((v) => v.toString(16).padStart(2, '0')).join(''));
    }
  }

  const grau = [];
  for (let i = 0; i < 16; i++) grau.push(i);
  for (let i = 15; i >= 0; i--) grau.push(i);

  const ZIEL_A3 = [
    'FF0000', '000000', '008000', '800080',
    'FFFF00', 'FF0000', '000000', 'FFFFFF',
    'FFFFFF', '0000FF', 'FFFFFF', 'FF0000',
  ];

  window.PIXEL_PRESETS = [
    { group: 'Beispiele', id: 'neu', label: 'Neues Bild (8 × 8, 3 Bit)',
      cfg: { w: 8, h: 8, b: 3, bits: '0'.repeat(192) } },
    { group: 'Beispiele', id: 'folie-6x6', label: 'Folie: 6 × 6 Pixel, 1 Bit',
      cfg: { w: 6, h: 6, b: 1, bits: FOLIE_BITS } },
    { group: 'Beispiele', id: 'folie-4x3', label: 'Folie: dieselben Bits, 4 × 3 Pixel, 3 Bit',
      cfg: { w: 4, h: 3, b: 3, bits: FOLIE_BITS, labels: true } },
    { group: 'Beispiele', id: 'haus', label: 'Folie: Haus 11 × 11, 1 Bit',
      cfg: { w: 11, h: 11, b: 1, bits: HAUS.join('') } },
    { group: 'Beispiele', id: 'grau', label: 'Graustufen 16 × 2, 4 Bit',
      cfg: { w: 16, h: 2, b: 4, model: 'gray', bits: grau.map((v) => v.toString(2).padStart(4, '0')).join('') } },
    { group: 'Beispiele', id: 'biene', label: 'Biene 16 × 12, 12 Bit (Hex)',
      cfg: { w: 16, h: 12, b: 12, view: 'hex', bits: hexArt(BIENE, BIENE_FARBEN) } },
    { group: 'Beispiele', id: 'verlauf', label: 'Farbverlauf 16 × 16, 24 Bit',
      cfg: { w: 16, h: 16, b: 24, view: 'hex', bits: hexToBits(verlauf.join('')) } },

    { group: 'Aufgaben (Arbeitsblatt «Rastergrafik manuell»)', id: 'a1', label: 'A1 – Dieselben Bits, verschiedene Bilder',
      cfg: { w: 1, h: 1, b: 1, bits: FOLIE_BITS, task: {
        title: 'Aufgabe 1 – Dieselben Bits, verschiedene Bilder',
        text: 'Die Bitfolge **001100001100111111111111001100001100** ist bereits eingetragen.\n' +
          'a) Stellen Sie die Werte im Header so ein, dass man die Interpretation mit **1 Bit** Farbtiefe sieht (6 × 6 Pixel).\n' +
          'b) Ändern Sie die Einstellungen zu einer Farbtiefe von **3 Bit**. Welche Breite und Höhe passen jetzt?\n' +
          'c) Und wie sieht es mit einer Farbtiefe von **9 Bit** aus?\n' +
          'd) Wie viele unterschiedliche Farben gibt es bei einer Farbtiefe von 9 Bit?\n' +
          'e) Welches Bild ergibt sich mit **18 Bit**? Rechnen Sie zuerst aus, welche beiden Farben sich (in etwa) ergeben – dann ausprobieren.',
      } } },
    { group: 'Aufgaben (Arbeitsblatt «Rastergrafik manuell»)', id: 'a2', label: 'A2 – Hexadezimale Farben (Biene)',
      cfg: { w: 16, h: 12, b: 12, view: 'hex', bits: hexArt(BIENE, BIENE_FARBEN), task: {
        title: 'Aufgabe 2 – Hexadezimale Farbcodierung',
        text: 'Die Biene ist mit **12 Bit** Farbtiefe gespeichert und hexadezimal dargestellt.\n' +
          'a) Finden Sie eines der gelben Pixel im Körper der Biene und erklären Sie, wieso dieser Hex-Wert die Farbe Gelb ergibt.\n' +
          'b) Ändern Sie die Farbtiefe auf den typischen Wert von **24 Bit**. Finden Sie erneut ein Pixel aus dem Bienenkörper und erklären Sie dessen Farbe.\n' +
          'c) (schwierig) Wieso ergibt sich (zwei Mal) ein ähnliches Bild, wenn man die Farbtiefe verdoppelt?',
      } } },
    { group: 'Aufgaben (Arbeitsblatt «Rastergrafik manuell»)', id: 'a3', label: 'A3 – Ein Bild selbst codieren',
      cfg: { w: 4, h: 3, b: 24, view: 'hex', bits: '', lock: ['draw'], task: {
        title: 'Aufgabe 3 – Ein Bild selbst codieren',
        text: 'Geben Sie die Bits so ein, dass das Zielbild entsteht.\n' +
          'a) Version 1: Arbeiten Sie mit der typischen Codierung, also **24 Bit** Farbtiefe und Hexadezimalangaben.\n' +
          'b) Version 2: Für genau dieses Bild werden keine 16.7 Mio. Farben benötigt. Codieren Sie das Bild mit **möglichst wenigen Bits** (binär arbeiten). Wie viele Bits braucht das ganze Bild?',
        target: { w: 4, h: 3, colors: ZIEL_A3 },
      } } },
    { group: 'Aufgaben (Arbeitsblatt «Rastergrafik manuell»)', id: 'a4', label: 'A4 – Buchstaben als Farben',
      cfg: { w: 4, h: 2, b: 6, bits: '', task: {
        title: 'Aufgabe 4 – Buchstaben als Farben',
        text: 'Buchstaben sind auch nur Bitfolgen – und die kann man, wie oben gesehen, auch als Farben darstellen.\n' +
          'a) Übersetzen Sie die Buchstaben Ihres Namens in ASCII-Code – von Hand mit einer ASCII-Tabelle oder mit **Text → Bits**. Schauen Sie, welche Farben sich mit verschiedenen Farbtiefen ergeben (Breite und Höhe passend wählen).\n' +
          'b) Vermutlich unterscheiden sich Ihre Farben nicht allzu sehr von denen Ihres Nebensitzers. Können Sie das erklären?',
      } } },
    { group: 'Aufgaben (Arbeitsblatt «Rastergrafik manuell»)', id: 'a5', label: 'A5 – Bitfolge mit Header entschlüsseln',
      cfg: { w: 3, h: 3, b: 6, hdr: true, reveal: true,
        bits: '110000111111110000111111111111111111110000111111110000', task: {
          title: 'Aufgabe 5 – Zeichnen Sie …',
          text: 'Diese Bitfolge enthält am Anfang einen **Header**: Breite, Höhe und Farbtiefe sind je 1 Byte lang. Danach folgen die Pixeldaten.\n' +
            'a) Entschlüsseln Sie die Bits auf Papier: Wie gross ist das Bild, wie viele Bits gehören zu einem Pixel, welche Farben kommen vor?\n' +
            'b) Zeichnen Sie das Bild auf Papier. Decken Sie es erst danach auf.',
        } } },
    { group: 'Aufgaben (Weiterführend)', id: 'a6', label: 'A6 – Farbtabelle wie beim GIF',
      cfg: { w: 4, h: 3, b: 3, model: 'palette', bits: '', lock: ['draw', 'model'], task: {
        title: 'Aufgabe 6 – Indizierte Farben (wie beim GIF-Format)',
        text: 'Bei einer **Farbpalette** speichert jedes Pixel nur die Nummer einer Farbe in einer Tabelle.\n' +
          'a) Passen Sie die Farbtabelle an und geben Sie die Bits so ein, dass mit nur **3 Bit pro Pixel** das Zielbild entsteht.\n' +
          'b) Vergleichen Sie im Bereich «Speicherbedarf»: Wie viele Bits brauchen Pixeldaten und Farbtabelle zusammen – und wie viele wären es mit 24 Bit RGB?\n' +
          'c) Wann lohnt sich eine Farbtabelle, wann nicht?',
        target: { w: 4, h: 3, colors: ZIEL_A3 },
      } } },
    { group: 'Aufgaben (Weiterführend)', id: 'a7', label: 'A7 – Rätsel für den Nebensitzer',
      cfg: { w: 8, h: 6, b: 3, bits: '0'.repeat(144), task: {
        title: 'Aufgabe 7 – Rätsel für den Nebensitzer',
        text: 'a) Gestalten Sie ein eigenes Bild, z.B. die Flagge eines Landes – mit möglichst wenigen Bits.\n' +
          'b) Klicken Sie auf **Link teilen**, wählen Sie **Rätsel** und schicken Sie den Link Ihrem Nebensitzer.\n' +
          'c) Er oder sie muss zuerst aus den Bits herausfinden, was das Bild zeigt, und deckt es erst danach auf.',
      } } },
  ];
})();
