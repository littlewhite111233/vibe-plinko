import Phaser from 'phaser';
import {
  cheatSettings,
  MULTIPLIER_TIERS,
  resetCheatSettings,
  setManualLitCountFromMultiplier,
  toggleManualTunnel,
  TUNNEL_COUNT,
} from './CheatSettings';

type CheatPanelCallbacks = {
  onApplyRound: () => void;
  onClose: () => void;
};

export class CheatPanel {
  private _container?: Phaser.GameObjects.Container;
  private _weightLabels: Phaser.GameObjects.Text[] = [];
  private _tunnelButtons: Phaser.GameObjects.Rectangle[] = [];
  private _sumLabel?: Phaser.GameObjects.Text;
  private _modeLabel?: Phaser.GameObjects.Text;
  private _overrideLabel?: Phaser.GameObjects.Text;

  constructor(
    private readonly _scene: Phaser.Scene,
    private readonly _callbacks: CheatPanelCallbacks
  ) {}

  create(): void {
    const container = this._scene.add.container(0, 0);
    container.setVisible(false);
    container.setDepth(2000);

    const bg = this._scene.add.rectangle(0, 0, 480, 854, 0x000000, 0.85).setOrigin(0);
    bg.setInteractive();
    container.add(bg);

    const panel = this._scene.add.rectangle(240, 400, 440, 620, 0x1a1e2a).setOrigin(0.5);
    panel.setStrokeStyle(3, 0xff0055);
    container.add(panel);

    const title = this._scene.add
      .text(240, 110, 'CHEAT PANEL', {
        fontFamily: '"Press Start 2P"',
        fontSize: '14px',
        color: '#ff0055',
      })
      .setOrigin(0.5);
    container.add(title);

    this._overrideLabel = this._scene.add
      .text(240, 145, '', {
        fontFamily: '"Press Start 2P"',
        fontSize: '8px',
        color: '#b0b8c8',
      })
      .setOrigin(0.5);
    container.add(this._overrideLabel);

    const overrideBtn = this.makeButton(240, 175, 200, 28, 'OVERRIDE: OFF', () => {
      cheatSettings.overrideEnabled = !cheatSettings.overrideEnabled;
      this.refreshLabels();
    });
    container.add(overrideBtn.bg);
    container.add(overrideBtn.label);

    this._modeLabel = this._scene.add
      .text(240, 210, '', {
        fontFamily: '"Press Start 2P"',
        fontSize: '8px',
        color: '#ffb300',
      })
      .setOrigin(0.5);
    container.add(this._modeLabel);

    const modeGame = this.makeButton(120, 240, 90, 24, 'GAME', () => {
      cheatSettings.mode = 'game';
      this.refreshLabels();
    });
    const modeWeighted = this.makeButton(240, 240, 90, 24, 'WEIGHT', () => {
      cheatSettings.mode = 'weighted';
      this.refreshLabels();
    });
    const modeManual = this.makeButton(360, 240, 90, 24, 'MANUAL', () => {
      cheatSettings.mode = 'manual';
      this.refreshLabels();
    });
    container.add([modeGame.bg, modeGame.label, modeWeighted.bg, modeWeighted.label, modeManual.bg, modeManual.label]);

    const weightTitle = this._scene.add
      .text(240, 275, 'PROBABILITY %', {
        fontFamily: '"Press Start 2P"',
        fontSize: '8px',
        color: '#b0b8c8',
      })
      .setOrigin(0.5);
    container.add(weightTitle);

    this._weightLabels = [];
    MULTIPLIER_TIERS.forEach((tier, index) => {
      const y = 300 + index * 34;
      const tierLabel = this._scene.add
        .text(70, y, `${tier}X`, {
          fontFamily: '"Press Start 2P"',
          fontSize: '8px',
          color: '#b0b8c8',
        })
        .setOrigin(0, 0.5);

      const minus = this.makeButton(130, y, 28, 22, '-', () => {
        const next = Math.max(0, (cheatSettings.weights[index] ?? 0) - 5);
        cheatSettings.weights[index] = next;
        this.refreshLabels();
      });
      const value = this._scene.add
        .text(200, y, '0', {
          fontFamily: '"Press Start 2P"',
          fontSize: '10px',
          color: '#ffffff',
        })
        .setOrigin(0.5);
      const plus = this.makeButton(270, y, 28, 22, '+', () => {
        const next = Math.min(100, (cheatSettings.weights[index] ?? 0) + 5);
        cheatSettings.weights[index] = next;
        this.refreshLabels();
      });

      this._weightLabels.push(value);
      container.add([tierLabel, minus.bg, minus.label, value, plus.bg, plus.label]);
    });

    this._sumLabel = this._scene.add
      .text(240, 478, '', {
        fontFamily: '"Press Start 2P"',
        fontSize: '8px',
        color: '#888ea0',
      })
      .setOrigin(0.5);
    container.add(this._sumLabel);

    const multTitle = this._scene.add
      .text(240, 500, 'MANUAL MULT / SLOTS', {
        fontFamily: '"Press Start 2P"',
        fontSize: '8px',
        color: '#b0b8c8',
      })
      .setOrigin(0.5);
    container.add(multTitle);

    const multBtns: Phaser.GameObjects.GameObject[] = [];
    MULTIPLIER_TIERS.forEach((tier, index) => {
      const x = 70 + index * 70;
      const btn = this.makeButton(x, 530, 56, 24, `${tier}X`, () => {
        cheatSettings.manualMultiplier = tier;
        if (cheatSettings.mode === 'manual') {
          setManualLitCountFromMultiplier(tier);
          this.refreshTunnelButtons();
        }
        this.refreshLabels();
      });
      multBtns.push(btn.bg, btn.label);
    });
    container.add(multBtns);

    this._tunnelButtons = [];
    const tunnelBtns: Phaser.GameObjects.GameObject[] = [];
    for (let i = 0; i < TUNNEL_COUNT; i++) {
      const col = i % 6;
      const row = Math.floor(i / 6);
      const x = 70 + col * 60;
      const y = 570 + row * 30;
      const btn = this._scene.add.rectangle(x, y, 48, 22, 0x3a3f50).setOrigin(0.5);
      btn.setStrokeStyle(1, 0x888ea0);
      btn.setInteractive({ cursor: 'pointer' });
      const label = this._scene.add
        .text(x, y, `${i}`, {
          fontFamily: '"Press Start 2P"',
          fontSize: '8px',
          color: '#b0b8c8',
        })
        .setOrigin(0.5);
      const slotIndex = i;
      btn.on('pointerdown', () => {
        toggleManualTunnel(slotIndex);
        this.refreshTunnelButtons();
        this.refreshLabels();
      });
      this._tunnelButtons.push(btn);
      tunnelBtns.push(btn, label);
    }
    container.add(tunnelBtns);

    const applyBtn = this.makeButton(150, 660, 140, 32, 'APPLY', () => {
      this._callbacks.onApplyRound();
    });
    const rerollBtn = this.makeButton(330, 660, 140, 32, 'REROLL', () => {
      this._callbacks.onApplyRound();
    });
    const resetBtn = this.makeButton(150, 705, 140, 28, 'RESET', () => {
      resetCheatSettings();
      this.refreshLabels();
      this.refreshTunnelButtons();
    });
    const closeBtn = this.makeButton(330, 705, 140, 28, 'CLOSE', () => {
      this.hide();
      this._callbacks.onClose();
    });
    container.add([
      applyBtn.bg,
      applyBtn.label,
      rerollBtn.bg,
      rerollBtn.label,
      resetBtn.bg,
      resetBtn.label,
      closeBtn.bg,
      closeBtn.label,
    ]);

    this._container = container;
    this.refreshLabels();
    this.refreshTunnelButtons();
  }

  toggle(): void {
    if (!this._container) return;
    this._container.setVisible(!this._container.visible);
    if (this._container.visible) {
      this.refreshLabels();
      this.refreshTunnelButtons();
    }
  }

  hide(): void {
    this._container?.setVisible(false);
  }

  isVisible(): boolean {
    return this._container?.visible ?? false;
  }

  private makeButton(
    x: number,
    y: number,
    w: number,
    h: number,
    text: string,
    onClick: () => void
  ): { bg: Phaser.GameObjects.Rectangle; label: Phaser.GameObjects.Text } {
    const bg = this._scene.add.rectangle(x, y, w, h, 0x3a3f50).setOrigin(0.5);
    bg.setStrokeStyle(1, 0x888ea0);
    bg.setInteractive({ cursor: 'pointer' });
    const label = this._scene.add
      .text(x, y, text, {
        fontFamily: '"Press Start 2P"',
        fontSize: '8px',
        color: '#b0b8c8',
      })
      .setOrigin(0.5);
    bg.on('pointerdown', onClick);
    return { bg, label };
  }

  private refreshLabels(): void {
    if (this._overrideLabel) {
      this._overrideLabel.setText(
        cheatSettings.overrideEnabled ? 'OVERRIDE: ON' : 'OVERRIDE: OFF (uses game defaults)'
      );
    }
    if (this._modeLabel) {
      const modeText =
        cheatSettings.mode === 'game'
          ? 'MODE: GAME'
          : cheatSettings.mode === 'weighted'
            ? 'MODE: CUSTOM WEIGHTS'
            : 'MODE: MANUAL MULT + SLOTS';
      this._modeLabel.setText(modeText);
    }
    MULTIPLIER_TIERS.forEach((_, index) => {
      const label = this._weightLabels[index];
      if (label) {
        label.setText(String(cheatSettings.weights[index] ?? 0));
      }
    });
    if (this._sumLabel) {
      const sum = cheatSettings.weights.reduce((a, b) => a + b, 0);
      this._sumLabel.setText(`WEIGHT SUM: ${sum}% (auto-normalized on roll)`);
    }
  }

  private refreshTunnelButtons(): void {
    this._tunnelButtons.forEach((btn, index) => {
      const lit = cheatSettings.manualTunnels[index] ?? false;
      btn.fillColor = lit ? 0xff1a1a : 0x3a3f50;
      btn.setStrokeStyle(1, lit ? 0xff6677 : 0x888ea0);
    });
  }
}
