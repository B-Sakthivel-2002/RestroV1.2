declare module 'bootstrap' {
  export class Modal {
    constructor(element: HTMLElement, options?: any);

    static getInstance(element: HTMLElement): Modal | null;

    toggle(): void;
    show(): void;
    hide(): void;
    handleUpdate(): void;
  }
}