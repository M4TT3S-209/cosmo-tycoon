export interface Screen {
  el: HTMLElement;
  title: string;
  /** baut den Inhalt komplett neu auf (bei Strukturänderungen) */
  build(): void;
  /** pro Frame: Zahlen, Balken, Buttons aktualisieren */
  update(dt: number): void;
}
