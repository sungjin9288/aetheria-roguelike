/**
 * SoundManager - Web Audio API 기반 사운드 엔진
 * 오실레이터를 이용한 레트로 효과음 생성 (외부 파일 불필요)
 */
class SoundManager {
    constructor() {
        this.ctx = null;
        this.muted = false;
        this.initialized = false;
    }

    init() {
        if (this.initialized) return;
        try {
            window.AudioContext = window.AudioContext || window.webkitAudioContext;
            this.ctx = new AudioContext();
            this.initialized = true;
        } catch {
            console.warn('Web Audio API not supported');
        }
    }

    toggleMute() {
        this.muted = !this.muted;
        return this.muted;
    }

    _ensureReady() {
        if (!this.initialized) this.init();
        if (this.muted || !this.ctx) return false;
        if (this.ctx.state === 'suspended') this.ctx.resume();
        return true;
    }

    _createNodes() {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        return { osc, gain, now: this.ctx.currentTime };
    }

    play(type) {
        if (!this._ensureReady()) return;

        switch (type) {
            case 'hover': {
                const { osc, gain, now } = this._createNodes();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(800, now);
                osc.frequency.exponentialRampToValueAtTime(1200, now + 0.05);
                gain.gain.setValueAtTime(0.05, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
                osc.start(now);
                osc.stop(now + 0.05);
                break;
            }

            case 'click': {
                const { osc, gain, now } = this._createNodes();
                osc.type = 'square';
                osc.frequency.setValueAtTime(400, now);
                osc.frequency.exponentialRampToValueAtTime(200, now + 0.1);
                gain.gain.setValueAtTime(0.05, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
                osc.start(now);
                osc.stop(now + 0.1);
                break;
            }

            case 'error': {
                const { osc, gain, now } = this._createNodes();
                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(150, now);
                osc.frequency.linearRampToValueAtTime(100, now + 0.2);
                gain.gain.setValueAtTime(0.1, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
                osc.start(now);
                osc.stop(now + 0.2);
                break;
            }

            case 'attack': {
                const { osc, gain, now } = this._createNodes();
                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(100, now);
                osc.frequency.exponentialRampToValueAtTime(800, now + 0.1);
                gain.gain.setValueAtTime(0.1, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
                osc.start(now);
                osc.stop(now + 0.1);
                break;
            }

            case 'levelUp':
                // Arpeggio (별도 오실레이터 생성하지 않음)
                this._playTone(523.25, 0.1, 0);       // C5
                this._playTone(659.25, 0.1, 0.1);     // E5
                this._playTone(783.99, 0.1, 0.2);     // G5
                this._playTone(1046.50, 0.3, 0.3);    // C6
                break;

            case 'item': {
                const { osc, gain, now } = this._createNodes();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(1200, now);
                osc.frequency.exponentialRampToValueAtTime(2000, now + 0.2);
                gain.gain.setValueAtTime(0.05, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
                osc.start(now);
                osc.stop(now + 0.2);
                break;
            }

            case 'heal':
                this._playTone(523.25, 0.12, 0);    // C5
                this._playTone(659.25, 0.12, 0.1);  // E5
                this._playTone(783.99, 0.2, 0.2);   // G5
                break;

            case 'death':
                this._playTone(400, 0.15, 0);
                this._playTone(300, 0.15, 0.12);
                this._playTone(200, 0.15, 0.24);
                this._playTone(100, 0.4, 0.36);
                break;

            case 'skill': {
                const { osc, gain, now } = this._createNodes();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(600, now);
                osc.frequency.exponentialRampToValueAtTime(1800, now + 0.15);
                osc.frequency.exponentialRampToValueAtTime(900, now + 0.3);
                gain.gain.setValueAtTime(0.08, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
                osc.start(now);
                osc.stop(now + 0.3);
                break;
            }

            case 'explore': {
                const { osc, gain, now } = this._createNodes();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(800, now);
                osc.frequency.exponentialRampToValueAtTime(1200, now + 0.08);
                osc.frequency.exponentialRampToValueAtTime(800, now + 0.16);
                gain.gain.setValueAtTime(0.04, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
                osc.start(now);
                osc.stop(now + 0.16);
                break;
            }

            case 'victory':
                this._playTone(523.25, 0.1, 0);     // C5
                this._playTone(659.25, 0.1, 0.08);  // E5
                this._playTone(783.99, 0.1, 0.16);  // G5
                this._playTone(1046.50, 0.15, 0.24); // C6
                this._playTone(1318.51, 0.3, 0.36);  // E6
                break;

            default:
                break;
        }
    }

    _playTone(freq, dur, delay) {
        if (this.muted || !this.ctx) return;
        const { osc, gain } = this._createNodes();
        const startAt = this.ctx.currentTime + delay;
        osc.type = 'square';
        osc.frequency.setValueAtTime(freq, startAt);
        gain.gain.setValueAtTime(0.05, startAt);
        gain.gain.exponentialRampToValueAtTime(0.001, startAt + dur);
        osc.start(startAt);
        osc.stop(startAt + dur);
    }
}

export const soundManager = new SoundManager();
