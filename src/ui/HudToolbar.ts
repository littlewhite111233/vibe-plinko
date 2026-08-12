import Phaser from 'phaser';

type HudToolbarCallbacks = {
  onShop: () => void;
  onMap: () => void;
  onDebug: () => void;
};

type ToolbarButton = {
  bg: Phaser.GameObjects.Rectangle;
  label: Phaser.GameObjects.Text;
};

export class HudToolbar {
  private _buttons: ToolbarButton[] = [];

  constructor(
    private readonly _scene: Phaser.Scene,
    private readonly _callbacks: HudToolbarCallbacks
  ) {}

  create(): void {
    const container = this._scene.add.container(0, 0);
    container.setDepth(1600);

    const specs: Array<{ x: number; label: string; onClick: () => void }> = [
      { x: 24, label: 'SHOP', onClick: this._callbacks.onShop },
      { x: 92, label: 'MAP', onClick: this._callbacks.onMap },
      { x: 160, label: 'DBG', onClick: this._callbacks.onDebug },
    ];

    for (const spec of specs) {
      this._buttons.push(this.makeButton(spec.x, 178, 60, 26, spec.label, spec.onClick));
    }

    for (const btn of this._buttons) {
      container.add([btn.bg, btn.label]);
    }

    this.setEnabled(true);
  }

  setEnabled(enabled: boolean): void {
    for (const btn of this._buttons) {
      if (enabled) {
        btn.bg.setInteractive({ cursor: 'pointer' });
        btn.bg.setAlpha(1);
        btn.label.setAlpha(1);
      } else {
        btn.bg.disableInteractive();
        btn.bg.setAlpha(0.45);
        btn.label.setAlpha(0.45);
      }
    }
  }

  private makeButton(
    x: number,
    y: number,
    w: number,
    h: number,
    text: string,
    onClick: () => void
  ): ToolbarButton {
    const bg = this._scene.add.rectangle(x + w / 2, y + h / 2, w, h, 0x2a4a8a).setOrigin(0.5);
    bg.setStrokeStyle(2, 0xffb300);
    bg.setInteractive({ cursor: 'pointer' });
    const label = this._scene.add
      .text(x + w / 2, y + h / 2, text, {
        fontFamily: '"Press Start 2P"',
        fontSize: '8px',
        color: '#ffffff',
      })
      .setOrigin(0.5);
    bg.on('pointerdown', onClick);
    return { bg, label };
  }
}
